# -*- coding: utf-8 -*-
"""Start commands of the managed class-C TTS servers: launch script sets,
interpreter and environment, GPU device choice from live free VRAM, and the
missing-only runtime self-heals. ``start_command(engine)`` returns (cwd, argv)
or (cwd, argv, env); None when the engine cannot start."""

import os
import re
import shutil
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

from pycore.pyfoundations.network_constants import (
    CHATTTS_HTTP_PORT,
    CHATTTS_MIN_FREE_VRAM_MB,
    COSYVOICE_HTTP_PORT,
    F5TTS_HTTP_PORT,
    FISHSPEECH_HTTP_PORT,
    HTTP_LOOPBACK_HOST,
    MELOTTS_HTTP_PORT,
    VOXCPM2_HTTP_PORT,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pygvar import PROJECT_ROOT
from pycore.pyfoundations.system_paths import (
    get_hf_home_dir,
    get_hf_hub_cache_dir,
    get_shared_download_cache_dir,
)
from pycore.pyutils.common.model_tiers import gpu_present, runtime_engine_model
from pycore.pyutils.common.python_env.isolated_venv import (
    resolve_python as resolve_isolated_python,
)
from pycore.pyutils.tts import memory_gate
from pycore.pyutils.tts.cosyvoice_engine import cosyvoice_engine
from pycore.pyutils.tts.engine_registry import tts_engine_registry
from pycore.pyutils.tts.fishspeech_engine import FISH_API_KEY_ENV, fishspeech_engine
from pycore.pyutils.tts.gptsovits_engine import gptsovits_engine
from pycore.pyutils.tts.melotts_engine import melotts_engine
from pycore.pyutils.tts.qwen.config import (
    DEFAULT_PORT as QWEN_DEFAULT_PORT,
    ENGINE_NAME as QWEN_ENGINE_NAME,
    api_server_path as qwen_api_server_path,
)
from pycore.pyutils.tts.qwen.engine import qwen_engine
import pycore.pyutils.tts.qwen.weights as qwen_weights
from pycore.pyutils.tts.voxcpm2_engine import voxcpm2_engine

_MELOTTS_API_SERVER = "melotts_api_server.py"
ASSETS_DIR = Path(__file__).resolve().parents[2] / "tts_install_assets"
_PYFOUNDATIONS_DIR = Path(__file__).resolve().parents[2] / "pyfoundations"
_NETWORK_CONSTANTS_SOURCE = _PYFOUNDATIONS_DIR / "network_constants.py"
_SENTENCE_SEGMENTER_SOURCE = _PYFOUNDATIONS_DIR / "sentence_segmenter.py"
_SENTENCE_CONTRACT_SOURCE = _PYFOUNDATIONS_DIR.parents[1] / "config" / "sentence_segmentation_contract.json"
_SERVICE_CONTRACT_SOURCE = _PYFOUNDATIONS_DIR / "service_contract.py"
_RPC_ROUTE_CONTRACT_SOURCE = _PYFOUNDATIONS_DIR / "rpc_route_contract.py"
_HTTP_SSE_SOURCE = _PYFOUNDATIONS_DIR / "http_sse.py"
_EVENT_RECORDS_SOURCE = _PYFOUNDATIONS_DIR / "event_records.py"
_TIME_UTILS_SOURCE = _PYFOUNDATIONS_DIR / "time_utils.py"

# Free-VRAM floors (MiB) for launching a class-C server onto the GPU. When a
# busy peer legitimately holds the card (single-active never interrupts an
# in-flight service), the newcomer starts on CPU instead of dying inside
# model load with a CUDA OOM. ChatTTS floor follows its official FAQ
# ("at least 4GB of GPU memory"). Before the qwen3tts device decision the
# opt-in reclaim (QWEN3TTS_VRAM_RECLAIM=1) stops pycore-started GPU processes
# when free VRAM is below the recommended floor, then the launcher applies the
# minimum free-VRAM floor and falls back to CPU below it.
_CHATTTS_MIN_FREE_VRAM_MB = CHATTTS_MIN_FREE_VRAM_MB


def _hf_cache_env() -> Dict[str, str]:
    """Shared Hugging Face cache for a server that loads a model id."""
    return {"HF_HOME": str(get_hf_home_dir()), "HF_HUB_CACHE": str(get_hf_hub_cache_dir())}


def _nltk_data_dir() -> Path:
    """NLTK data root the installers provision: NLTK_DATA, else <shared cache>/nltk_data."""
    explicit = (os.environ.get("NLTK_DATA") or "").strip()
    return Path(explicit) if explicit else get_shared_download_cache_dir() / "nltk_data"
_MIB = 1024 ** 2


def _env_int(name: str) -> Optional[int]:
    raw = (os.environ.get(name) or "").strip()
    return int(raw) if raw.isdigit() else None


def _gpu_device_or_fallback(
    engine: str,
    required_mb: int,
    device_index: Optional[int] = None,
) -> str:
    """"cuda" when the target GPU has >= required_mb free, "cpu" when it is
    short, "" (the engine's own auto logic) when VRAM cannot be read."""
    free_bytes = memory_gate.free_vram_bytes(device_index)
    if free_bytes is None:
        return ""
    free_mb = int(free_bytes) // _MIB - memory_gate.display_reserve_mb(device_index)
    if free_mb >= required_mb:
        return "cuda"
    ColorPrint.yellow(
        f"[tts-service] {engine}: {free_mb} MiB VRAM free on GPU "
        f"{device_index if device_index is not None else 0} < {required_mb} MiB "
        "required; starting on cpu (a busy peer is holding the card)"
    )
    return "cpu"


def _python_exe() -> str:
    """Interpreter for same-interpreter servers (chattts, f5tts): the RUNNING
    interpreter, which is the exact target the installers pip into (on Linux the
    project venv python3_venv; on Windows the shared python313). sys.executable
    keeps the venv's site-packages; the venv's base interpreter (e.g.
    /usr/bin/python3.13) does not see venv-installed packages like ChatTTS."""
    return sys.executable


def _sync_server_script(staging: Path, filename: str, source: Optional[Path] = None) -> None:
    """Keep staging api server aligned with pycore/tts_install_assets template
    (or with an explicit shared source such as the sentence segmenter)."""
    src = source or Path(__file__).resolve().parents[2] / "tts_install_assets" / filename
    dst = staging / filename
    if src.is_file():
        try:
            shutil.copy2(src, dst)
        except OSError as exc:
            ColorPrint.yellow(f"[tts-service] sync {src} -> {dst} failed: {exc}")


def _sync_sentence_segmenter(staging: Path) -> None:
    """A staged server splits sentences with the shared segmenter: the module and
    its contract are copied next to it (the segmenter reads the sibling contract)."""
    _sync_server_script(staging, _SENTENCE_SEGMENTER_SOURCE.name, _SENTENCE_SEGMENTER_SOURCE)
    _sync_server_script(staging, _SENTENCE_CONTRACT_SOURCE.name, _SENTENCE_CONTRACT_SOURCE)


def server_scripts(engine: str) -> List[Path]:
    """Launch script set of one owned class-C server - the identity source of
    the managed code-identity contract (managed_service.service_script_code_id).

    qwen3tts and melotts launch straight from tts_install_assets; chattts,
    fishspeech and f5tts launch a staging copy that _start_command re-syncs
    from the SAME template right before every launch, so hashing the template
    hashes exactly what a fresh start would run. Engines whose server code
    pycore does not own (cosyvoice, gptsovits run cloned repositories) return
    [] and stay off the contract. An engine also needs a get_status probe
    (engine lifecycle probe) before registration activates it."""
    if engine == "qwen3tts":
        # Every module the server imports or loads from source at start
        # (qwen3tts_synthesis imports tts_text_chunking and tts_audio_assembly;
        # the api server loads network_constants with its service_contract and
        # rpc_route_contract imports, http_sse and the event records journal by path).
        return [
            ASSETS_DIR / "qwen3tts_api_server.py",
            ASSETS_DIR / "qwen3tts_capabilities.py",
            ASSETS_DIR / "qwen3tts_synthesis.py",
            ASSETS_DIR / "qwen3tts_queue.py",
            ASSETS_DIR / "qwen3tts_gpu.py",
            ASSETS_DIR / "qwen3tts_web.py",
            ASSETS_DIR / "tts_text_chunking.py",
            ASSETS_DIR / "tts_audio_assembly.py",
            ASSETS_DIR / "tts_server_common.py",
            _SENTENCE_SEGMENTER_SOURCE,
            _SENTENCE_CONTRACT_SOURCE,
            _NETWORK_CONSTANTS_SOURCE,
            _SERVICE_CONTRACT_SOURCE,
            _RPC_ROUTE_CONTRACT_SOURCE,
            _HTTP_SSE_SOURCE,
            ASSETS_DIR / "qwen3tts_events.py",
            _EVENT_RECORDS_SOURCE,
            _TIME_UTILS_SOURCE,
        ]
    if engine == "chattts":
        return [
            ASSETS_DIR / "chattts_api_server.py",
            ASSETS_DIR / "tts_server_common.py",
        ]
    if engine == "fishspeech":
        return [
            ASSETS_DIR / "fishspeech_api_server.py",
            ASSETS_DIR / "tts_text_chunking.py",
            ASSETS_DIR / "tts_server_common.py",
            _SENTENCE_SEGMENTER_SOURCE,
            _SENTENCE_CONTRACT_SOURCE,
        ]
    if engine == "f5tts":
        return [
            ASSETS_DIR / "f5tts_api_server.py",
            ASSETS_DIR / "tts_server_common.py",
        ]
    if engine == "melotts":
        return [
            ASSETS_DIR / "melotts_api_server.py",
            ASSETS_DIR / "tts_text_chunking.py",
            ASSETS_DIR / "tts_server_common.py",
            _SENTENCE_SEGMENTER_SOURCE,
            _SENTENCE_CONTRACT_SOURCE,
        ]
    if engine == "voxcpm2":
        return [
            ASSETS_DIR / "voxcpm2_api_server.py",
            ASSETS_DIR / "tts_text_chunking.py",
            ASSETS_DIR / "tts_audio_assembly.py",
            ASSETS_DIR / "tts_server_common.py",
            _SENTENCE_SEGMENTER_SOURCE,
            _SENTENCE_CONTRACT_SOURCE,
        ]
    return []


def start_command(engine: str) -> Optional[Tuple]:
    """Return (cwd, argv) for same-interpreter servers, or (cwd, argv, env) for
    servers that need a custom environment (qwen3tts runs under its isolated venv)."""
    adapter = tts_engine_registry.get(engine)
    if adapter is None:
        return None
    staging = adapter.staging_dir()
    py = _python_exe()
    if engine == "chattts":
        _sync_server_script(staging, "chattts_api_server.py")
        _sync_server_script(staging, "tts_server_common.py")
        script = staging / "chattts_api_server.py"
        if not script.is_file():
            return None
        model_path = adapter.model_path()
        if model_path is None:
            return None
        parsed = urlparse(adapter.base_url())
        env = dict(os.environ)
        env["PYCORE_PROJECT_ROOT"] = str(PROJECT_ROOT)
        env["CHATTTS_HOST"] = parsed.hostname or HTTP_LOOPBACK_HOST
        env["CHATTTS_PORT"] = str(parsed.port or CHATTTS_HTTP_PORT)
        env["CHATTTS_MODEL_DIR"] = str(model_path)
        env["HF_HUB_OFFLINE"] = "1"
        env["TRANSFORMERS_OFFLINE"] = "1"
        # PyTorch official anti-fragmentation setting (docs.pytorch.org
        # docs/stable/notes/cuda.html); explicit opt-out wins.
        env.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
        # Device decided HERE from live free VRAM: single-active never stops a
        # busy peer, so an occupied card must degrade chattts to cpu instead of
        # letting it crash with a CUDA OOM inside model load. An explicit
        # CHATTTS_DEVICE in the environment wins over the probe.
        if not (os.environ.get("CHATTTS_DEVICE") or "").strip():
            required_mb = _env_int("CHATTTS_MIN_FREE_VRAM_MB") or _CHATTTS_MIN_FREE_VRAM_MB
            env["CHATTTS_DEVICE"] = _gpu_device_or_fallback("chattts", required_mb)
        if env.get("CHATTTS_DEVICE") != "cpu":
            env.update(memory_gate.gpu_memory_env())
        return staging, [py, str(script)], env
    if engine == "cosyvoice":
        script = staging / "runtime" / "python" / "fastapi" / "server.py"
        if not script.is_file():
            return None
        venv_python = resolve_isolated_python("cosyvoice")
        if not venv_python:
            return None
        port = urlparse(adapter.base_url()).port or COSYVOICE_HTTP_PORT
        model_dir = cosyvoice_engine.model_dir()
        if not cosyvoice_engine.model_ready():
            # The official server downloads a missing model; runtime never does.
            ColorPrint.yellow(
                f"[tts-service] cosyvoice: model missing at {model_dir}; run {cosyvoice_engine.installer_hint()}"
            )
            return None
        model = str(model_dir)
        return (
            staging,
            [venv_python, str(script), "--port", str(port), "--model_dir", model],
            _isolated_env({}),
        )
    if engine == "fishspeech":
        _sync_server_script(staging, "fishspeech_api_server.py")
        _sync_server_script(staging, "tts_text_chunking.py")
        _sync_server_script(staging, "tts_server_common.py")
        _sync_sentence_segmenter(staging)
        venv_python = resolve_isolated_python("fishspeech")
        if not venv_python:
            return None
        parsed = urlparse(adapter.base_url())
        host = parsed.hostname or HTTP_LOOPBACK_HOST
        port = parsed.port or FISHSPEECH_HTTP_PORT
        extra: Dict[str, str] = {"FISHSPEECH_HOST": host, "FISHSPEECH_PORT": str(port)}
        for key in (
            "FISHSPEECH_UPSTREAM",
            "FISHSPEECH_REFERENCE_ID",
        ):
            value = (os.environ.get(key) or "").strip()
            if value:
                extra[key] = value
        # The child inherits os.environ: the cloud key is set (or cleared on a
        # local-models-only node) explicitly.
        extra[FISH_API_KEY_ENV] = fishspeech_engine.fish_api_key()
        # Local inference mode: the cloned repo's official api_server plus
        # downloaded checkpoint weights (fishaudio/s1-mini).
        local_server = staging / "tools" / "api_server.py"
        checkpoint = _fishspeech_checkpoint_dir(staging)
        if local_server.is_file() and checkpoint is not None:
            return (
                staging,
                [
                    venv_python,
                    str(local_server),
                    "--listen",
                    f"{host}:{port}",
                    "--checkpoint-path",
                    str(checkpoint),
                ],
                _isolated_env(extra),
            )
        # Bridge mode: our asset proxies to FISHSPEECH_UPSTREAM or the cloud SDK.
        script = staging / "fishspeech_api_server.py"
        if not script.is_file():
            return None
        return staging, [venv_python, str(script)], _isolated_env(extra)
    if engine == "gptsovits":
        return _gptsovits_start_command(staging)
    if engine == "f5tts":
        _sync_server_script(staging, "f5tts_api_server.py")
        _sync_server_script(staging, "tts_server_common.py")
        script = staging / "f5tts_api_server.py"
        if not script.is_file():
            return None
        parsed = urlparse(adapter.base_url())
        env = dict(os.environ)
        env["PYCORE_PROJECT_ROOT"] = str(PROJECT_ROOT)
        env["F5TTS_HOST"] = parsed.hostname or HTTP_LOOPBACK_HOST
        env["F5TTS_PORT"] = str(parsed.port or F5TTS_HTTP_PORT)
        env.update(_hf_cache_env())
        env["HF_HUB_OFFLINE"] = "1"
        env["TRANSFORMERS_OFFLINE"] = "1"
        return staging, [py, str(script)], env
    if engine == "qwen3tts":
        return _qwen3tts_start_command(staging)
    if engine == "melotts":
        return _melotts_start_command(staging)
    if engine == "voxcpm2":
        return _voxcpm2_start_command(staging)
    return None


def _fishspeech_checkpoint_dir(staging: Path) -> Optional[Path]:
    """Local fish-speech checkpoint directory, when fully downloaded.

    The name comes from FISHSPEECH_CHECKPOINT or the runtime model tier
    (fishaudio/s1-mini); readiness is the official config.json,
    not directory existence."""
    name = (os.environ.get("FISHSPEECH_CHECKPOINT") or "").strip()
    if not name:
        try:
            name = str(runtime_engine_model("fishspeech") or "")
        except Exception as exc:  # noqa: BLE001 - tier table boundary
            ColorPrint.gray(f"[tts-service] fishspeech model tier lookup failed: {exc}")
            name = ""
    name = name.rsplit("/", 1)[-1]
    if not name:
        return None
    candidate = staging / "checkpoints" / name
    return candidate if (candidate / "config.json").is_file() else None


def _isolated_env(extra: Dict[str, str]) -> Dict[str, str]:
    """Base environment for a class-C server run under an ISOLATED per-engine venv:
    inherit os.environ, strip PYTHONPATH/PYTHONHOME (so the main interpreter's
    site-packages cannot shadow the venv's pinned packages), force unbuffered
    stdout, then apply the engine-specific overrides."""
    env = dict(os.environ)
    env.pop("PYTHONPATH", None)
    env.pop("PYTHONHOME", None)
    env["PYTHONUNBUFFERED"] = "1"
    # hf_xet (the Rust xet downloader used by huggingface_hub) has been seen
    # hard-crashing its host process (BEX64) on Windows; plain HTTP chunk
    # downloads are the stable path. setdefault so an explicit opt-out wins.
    env.setdefault("HF_HUB_DISABLE_XET", "1")
    # Weights are provisioned by the shell installers; a server never downloads.
    env["HF_HUB_OFFLINE"] = "1"
    env["TRANSFORMERS_OFFLINE"] = "1"
    # PyTorch official anti-fragmentation setting (docs.pytorch.org
    # docs/stable/notes/cuda.html); setdefault so an explicit opt-out wins.
    env.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
    env.setdefault("PYCORE_PROJECT_ROOT", str(PROJECT_ROOT))
    env.update(extra)
    return env


def _missing_torchcodec_ffmpeg_dlls(venv_python: str) -> List[str]:
    """Windows: torchcodec's libtorchcodec_core*.dll links against UNHASHED
    FFmpeg DLL names while PyAV's av.libs ships delvewheel-hashed names;
    Model_Gptsovits.ps1 copies both namings next to libtorchcodec.
    Returns the missing names (empty off Windows or without torchcodec)."""
    if os.name != "nt":
        return []
    site_packages = Path(venv_python).resolve().parents[1] / "Lib" / "site-packages"
    torchcodec_dir = site_packages / "torchcodec"
    av_libs = site_packages / "av.libs"
    if not av_libs.is_dir() or not list(torchcodec_dir.glob("libtorchcodec_core*.dll")):
        return []
    names = set()
    for dll in av_libs.glob("*.dll"):
        names.update({dll.name, re.sub(r"-[0-9a-f]{16,}\.dll$", ".dll", dll.name)})
    return sorted(name for name in names if not (torchcodec_dir / name).exists())


GPTSOVITS_NLTK_RESOURCES = (
    ("taggers", "averaged_perceptron_tagger_eng"),
    ("corpora", "cmudict"),
)


def _missing_gptsovits_nltk_data(venv_python: str) -> List[str]:
    """GPT-SoVITS's English G2P needs NLTK data (pos_tag ->
    averaged_perceptron_tagger_eng, g2p_en -> cmudict) in the NLTK_DATA root,
    or every /tts call fails with a 400."""
    del venv_python
    root = _nltk_data_dir()
    return [
        name
        for category, name in GPTSOVITS_NLTK_RESOURCES
        if not (root / category / name).exists() and not (root / category / f"{name}.zip").exists()
    ]


def _gptsovits_start_command(staging: Path) -> Optional[Tuple[Path, List[str], Dict[str, str]]]:
    """Class-C start command for gptsovits: launch its api_v2.py under the ISOLATED
    per-engine venv (never the main interpreter, whose transformers pin conflicts
    with GPT-SoVITS's). Runtime only resolves the venv and its data; anything
    missing means no start and names the installer step."""
    script = staging / "api_v2.py"
    if not script.is_file():
        return None
    venv_python = resolve_isolated_python("gptsovits")
    if not venv_python:
        return None
    installer = gptsovits_engine.installer_hint()
    missing_dlls = _missing_torchcodec_ffmpeg_dlls(venv_python)
    if missing_dlls:
        ColorPrint.yellow(
            f"[tts-service] gptsovits: torchcodec FFmpeg DLLs missing ({len(missing_dlls)}); run {installer}"
        )
        return None
    missing_nltk = _missing_gptsovits_nltk_data(venv_python)
    if missing_nltk:
        ColorPrint.yellow(
            f"[tts-service] gptsovits: NLTK data missing ({', '.join(missing_nltk)}); run {installer}"
        )
        return None
    return staging, [venv_python, str(script)], _isolated_env({"NLTK_DATA": str(_nltk_data_dir())})


def _melotts_start_command(staging: Path) -> Optional[Tuple[Path, List[str], Dict[str, str]]]:
    """Class-C start command for melotts: launch the api server under the ISOLATED
    per-engine venv (never the main interpreter, which lacks - and must not gain -
    MeloTTS's old transformers pin). Mirrors _qwen3tts_start_command; PYTHONPATH/
    PYTHONHOME are stripped so the venv's packages are not shadowed.

    RUNTIME only RESOLVES the pre-built venv (resolve_python) - it never builds/pips
    at start time; a missing venv -> no start (the installer provisions it)."""
    venv_python = resolve_isolated_python("melotts")
    if not venv_python:
        return None
    api_server = Path(__file__).resolve().parents[2] / "tts_install_assets" / _MELOTTS_API_SERVER
    if not api_server.is_file():
        return None
    parsed = urlparse(melotts_engine.base_url())
    host = parsed.hostname or HTTP_LOOPBACK_HOST
    port = parsed.port or MELOTTS_HTTP_PORT
    extra: Dict[str, str] = {
        "MELOTTS_HOST": host,
        "MELOTTS_PORT": str(port),
        "NLTK_DATA": str(_nltk_data_dir()),
        **_hf_cache_env(),
    }
    model = (os.environ.get("MELOTTS_MODEL") or "").strip()
    if model:
        extra["MELOTTS_MODEL"] = model
    device = (os.environ.get("MELOTTS_DEVICE") or "").strip()
    if device:
        extra["MELOTTS_DEVICE"] = device
    return staging, [venv_python, str(api_server)], _isolated_env(extra)


def _voxcpm2_start_command(staging: Path) -> Optional[Tuple[Path, List[str], Dict[str, str]]]:
    """Class-C start command for voxcpm2: launch the api server under the
    ISOLATED self-contained per-engine venv (base Python 3.10; never the main
    3.13 interpreter, which is outside VoxCPM2's official 3.10-3.12 window).
    Mirrors _melotts_start_command.

    RUNTIME only RESOLVES the pre-built venv (resolve_python) - it never
    builds/pips at start time; a missing venv -> no start (the installer
    provisions it)."""
    venv_python = resolve_isolated_python("voxcpm2")
    if not venv_python:
        return None
    api_server = ASSETS_DIR / "voxcpm2_api_server.py"
    if not api_server.is_file():
        return None
    parsed = urlparse(voxcpm2_engine.base_url())
    host = parsed.hostname or HTTP_LOOPBACK_HOST
    port = parsed.port or VOXCPM2_HTTP_PORT
    extra: Dict[str, str] = {"VOXCPM2_HOST": host, "VOXCPM2_PORT": str(port)}
    model = voxcpm2_engine.local_model_dir()
    if model is None:
        ColorPrint.yellow(f"[tts-service] voxcpm2: local weights missing; run {voxcpm2_engine.installer_hint()}")
        return None
    extra["VOXCPM2_MODEL"] = model
    if not Path(model).is_dir():
        extra.update(_hf_cache_env())
    for key in (
        "VOXCPM2_DEVICE",
        "VOXCPM2_CFG",
        "VOXCPM2_TIMESTEPS",
        "VOXCPM2_PROMPT_WAV",
        "VOXCPM2_PROMPT_TEXT",
    ):
        value = (os.environ.get(key) or "").strip()
        if value:
            extra[key] = value
    return staging, [venv_python, str(api_server)], _isolated_env(extra)


def _qwen3tts_start_command(staging: Path) -> Optional[Tuple[Path, List[str], Dict[str, str]]]:
    """Class-C start command for qwen3tts: launch the api server under the ISOLATED
    venv (never the main interpreter, which lacks the required transformers pin).
    PYTHONPATH/PYTHONHOME are stripped so the
    venv's pinned transformers is not shadowed by the main interpreter.

    qwen.weights.resolve_model_id() converts a matching verified HF repo id
    to staging/weights. The venv is package-only and must never own or download
    another managed model copy.

    RUNTIME only RESOLVES the pre-built venv (resolve_python) - it never builds/pips
    at start time. Provisioning is done idempotently by the install scripts
    (Model_Qwen3Tts.ps1 / 183_install_qwen3tts.sh) that pyservice runs; a
    missing venv -> no start + disabled_reason points at the installer."""
    venv_python = resolve_isolated_python(QWEN_ENGINE_NAME)
    model_id = qwen_weights.resolve_model_id(allow_remote=False)
    if not venv_python or not model_id:
        return None
    api_server = qwen_api_server_path()
    if not api_server.is_file():
        return None
    base = qwen_engine.base_url()
    parsed = urlparse(base)
    host = parsed.hostname or HTTP_LOOPBACK_HOST
    port = parsed.port or QWEN_DEFAULT_PORT
    extra: Dict[str, str] = {
        "QWEN3TTS_HOST": host,
        "QWEN3TTS_PORT": str(port),
        "QWEN3TTS_MODEL": model_id,
        "HF_HUB_OFFLINE": "1",
        "TRANSFORMERS_OFFLINE": "1",
    }
    device = (os.environ.get("QWEN3TTS_DEVICE") or "").strip().lower()
    runtime_model = str(runtime_engine_model(QWEN_ENGINE_NAME) or "")
    installed_model = str(qwen_weights.sentinel_model_id() or runtime_model)
    extra["QWEN3TTS_MODEL_VARIANT"] = (
        "0.6B" if "0.6b" in installed_model.lower() else "1.7B"
    )
    gpu_tier = "1.7b" in runtime_model.lower()
    if not device:
        # qwen3tts is the only GPU consumer by design: first RECLAIM the card
        # from foreign processes when free VRAM is below the recommended
        # floor (6 GB), then apply the 800 MB minimum free-VRAM floor — an
        # under-provisioned GPU start still degrades to cpu instead of dying
        # inside from_pretrained with a CUDA OOM. An explicit QWEN3TTS_DEVICE
        # pin skips both (it always wins).
        required_mb = (
            _env_int(memory_gate.QWEN3TTS_MIN_FREE_VRAM_MB_ENV)
            or memory_gate.QWEN3TTS_MIN_FREE_VRAM_MB
        )
        index_raw = (os.environ.get("QWEN3TTS_GPU_INDEX") or "").strip()
        probe_index = int(index_raw) if index_raw.isdigit() else 0
        memory_gate.reclaim_vram(probe_index)
        if _gpu_device_or_fallback(QWEN_ENGINE_NAME, required_mb, probe_index) == "cpu":
            device = "cpu"
    if device == "cpu":
        extra["QWEN3TTS_DEVICE"] = "cpu"
    elif device.startswith("cuda") or (gpu_tier and gpu_present()):
        configured_index = (os.environ.get("QWEN3TTS_GPU_INDEX") or "").strip()
        device_suffix = device.rsplit(":", 1)[-1] if ":" in device else ""
        physical_index = (
            configured_index
            if configured_index.isdigit()
            else device_suffix if device_suffix.isdigit() else "0"
        )
        extra["CUDA_DEVICE_ORDER"] = "PCI_BUS_ID"
        extra["CUDA_VISIBLE_DEVICES"] = physical_index
        extra["QWEN3TTS_PHYSICAL_GPU_INDEX"] = physical_index
        extra["QWEN3TTS_DEVICE"] = "cuda:0"
        extra.update(memory_gate.gpu_memory_env(int(physical_index)))
    elif device:
        extra["QWEN3TTS_DEVICE"] = device
    if not Path(model_id).is_dir():
        extra.update(_hf_cache_env())
    return staging, [venv_python, str(api_server)], _isolated_env(extra)


__all__ = ["ASSETS_DIR", "server_scripts", "start_command"]
