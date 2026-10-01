#!/usr/bin/env python3
"""Shared runtime for the standalone TTS api servers.

Standard library at import time (same contract as tts_text_chunking.py): no
pycore imports, so it can be staged next to any standalone API server and
imported as a sibling. Third-party modules a helper needs (numpy, pydub,
fastapi, uvicorn) are imported inside that helper; every engine venv that
calls it ships them.

Jobs:

1. Load pycore.pyfoundations modules FROM SOURCE (network_constants is the
   single definition site of the shared ports / VRAM floors / speed bounds)
   for servers that run in isolated venvs or staging copies where ``import
   pycore`` is unavailable. The pycore package root resolves from
   PYCORE_PROJECT_ROOT (injected by tts_service_manager for staging launches)
   or from this file's own location when running from pycore/tts_install_assets.
2. Own the standalone scratch TMP_DIR.
3. Device selection (one nvidia-smi VRAM reader), audio encoding, env parsing,
   the /health, / and /load lifecycle routes, and the uvicorn bootstrap.
"""
from __future__ import annotations

import importlib
import importlib.util
import io
import os
import shutil
import subprocess
import sys
import time
import wave
from pathlib import Path
from types import ModuleType
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

PYCORE_MODULE_NAME = "pycore"
PYFOUNDATIONS_MODULE_NAME = "pycore.pyfoundations"
NETWORK_CONSTANTS_MODULE_NAME = "pycore.pyfoundations.network_constants"
DEFAULT_HOST = "127.0.0.1"
MEDIA_WAV = "audio/wav"
MEDIA_MP3 = "audio/mpeg"
_NVIDIA_SMI_POSIX_CANDIDATES = ("/usr/bin/nvidia-smi", "/usr/local/bin/nvidia-smi", "/bin/nvidia-smi")

# Model weights and NLTK data are provisioned by the shell installers only; a
# server never downloads. Forced before any engine import reads them.
OFFLINE_ENV = ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "HF_DATASETS_OFFLINE")
for _offline_name in OFFLINE_ENV:
    os.environ[_offline_name] = "1"

# pycore exports its resolved temp root (pygvar CORE_NODE_TMP_DIR) to the servers it starts.
TMP_DIR = Path(os.environ.get("CORE_NODE_TMP_DIR") or (r"D:\.tmp" if os.name == "nt" else "/var/_core_node/_tmp"))


def pycore_package_root() -> Path:
    root = (os.environ.get("PYCORE_PROJECT_ROOT") or "").strip()
    if root:
        candidate = Path(root) / PYCORE_MODULE_NAME
        if (candidate / "pyfoundations" / "network_constants.py").is_file():
            return candidate
    return Path(__file__).resolve().parents[1]


def register_pycore_namespace(package_root: Path) -> None:
    """Register minimal pycore / pycore.pyfoundations namespace packages so
    source-loaded pyfoundations modules can resolve their own relative
    imports (e.g. network_constants -> service_contract)."""
    pycore_module = sys.modules.get(PYCORE_MODULE_NAME)
    if pycore_module is None:
        pycore_module = ModuleType(PYCORE_MODULE_NAME)
        pycore_module.__path__ = [str(package_root)]
        sys.modules[PYCORE_MODULE_NAME] = pycore_module
    pyfoundations_module = sys.modules.get(PYFOUNDATIONS_MODULE_NAME)
    if pyfoundations_module is None:
        pyfoundations_module = ModuleType(PYFOUNDATIONS_MODULE_NAME)
        pyfoundations_module.__path__ = [str(package_root / "pyfoundations")]
        sys.modules[PYFOUNDATIONS_MODULE_NAME] = pyfoundations_module
    pycore_module.pyfoundations = pyfoundations_module


def load_source_module(module_name: str, module_path: Path) -> Any:
    existing_module = sys.modules.get(module_name)
    if existing_module is not None:
        return existing_module
    spec = importlib.util.spec_from_file_location(module_name, module_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load source module: {module_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


def load_pycore_source(module_name: str, relative_path: str) -> Any:
    """Load one pycore source file (path relative to the pycore package root)."""
    package_root = pycore_package_root()
    register_pycore_namespace(package_root)
    return load_source_module(module_name, package_root / relative_path)


def load_network_constants() -> Any:
    return load_pycore_source(NETWORK_CONSTANTS_MODULE_NAME, "pyfoundations/network_constants.py")


def env_int(name: str, default: int, minimum: Optional[int] = None) -> int:
    raw = (os.environ.get(name) or "").strip()
    try:
        value = int(raw) if raw else int(default)
    except ValueError:
        return int(default)
    return value if minimum is None else max(minimum, value)


def env_uint(name: str, default: int) -> int:
    """Non-negative integer env value; anything but plain digits -> default."""
    raw = (os.environ.get(name) or "").strip()
    return int(raw) if raw.isdigit() else int(default)


def env_float(name: str, default: float, minimum: Optional[float] = None) -> float:
    raw = (os.environ.get(name) or "").strip()
    try:
        value = float(raw) if raw else float(default)
    except ValueError:
        return float(default)
    return value if minimum is None else max(minimum, value)


def log(message: str) -> None:
    """print() that never raises: an orphaned server outliving its parent
    reader writes to a broken pipe."""
    try:
        print(message, flush=True)
    except (OSError, ValueError):
        pass


class EngineImports:
    """Guarded engine imports: a server stays up when an engine package fails
    to import (missing or broken install) and reports the failure as
    ``load_error`` on /health and /load (see ``add_lifecycle_routes``).
    Optional modules (``required=False``) are recorded but do not mark the
    server as failed."""

    def __init__(self) -> None:
        self._errors: Dict[str, str] = {}
        self._optional: Dict[str, str] = {}

    def module(self, name: str, required: bool = True) -> Optional[ModuleType]:
        try:
            return importlib.import_module(name)
        except Exception as exc:  # noqa: BLE001 - engine packages fail with arbitrary errors (OSError, RuntimeError)
            message = f"{name}: {type(exc).__name__}: {exc}"
            (self._errors if required else self._optional)[name] = message
            log(f"[tts-server] engine import failed ({'required' if required else 'optional'}): {message}")
            return None

    def error(self) -> Optional[str]:
        return "; ".join(self._errors.values()) or None

    def optional_error(self, name: str) -> Optional[str]:
        return self._optional.get(name)

    def require(self, value: Any, name: str = "") -> Any:
        """``value`` when its import succeeded, else RuntimeError carrying the
        recorded import error."""
        if value is None:
            detail = self._errors.get(name) or self._optional.get(name) or self.error()
            raise RuntimeError(f"engine import failed: {detail or name}")
        return value


engine_imports = EngineImports()


def installer_step(linux_script: str, windows_script: str) -> str:
    return f"{linux_script} (Linux) / {windows_script} (Windows)"


def weights_missing(model: str, step: str, detail: str = "") -> str:
    suffix = f" ({detail})" if detail else ""
    return f"model weights not installed for {model}{suffix}; run the installer step {step}"


HF_CACHE_ENV = ("HF_HUB_CACHE", "HF_HOME")


def hf_cache_error(step: str) -> Optional[str]:
    """Hugging Face cached weights live only in the shared cache the launcher
    passes (HF_HUB_CACHE / HF_HOME); with neither set nothing is guessed (no
    per-user ~/.cache) and the result is the missing-weights load_error."""
    if any((os.environ.get(name) or "").strip() for name in HF_CACHE_ENV):
        return None
    return weights_missing("the Hugging Face cache", step, f"{' / '.join(HF_CACHE_ENV)} not set by the launcher")


def local_weights_error(model: str, step: str) -> Optional[str]:
    """None when ``model`` is a non-empty local directory or an HF repo id
    already in the local cache (cache lookup only, never a download); else the
    load_error naming the installer step."""
    try:
        resolve_local_weights(model, step)
    except RuntimeError as exc:
        return str(exc)
    return None


def resolve_local_weights(model: str, step: str) -> str:
    """Local directory of ``model``: the path itself, or the cached snapshot of
    an HF repo id (``local_files_only``). RuntimeError naming ``step`` when the
    installer has not provisioned it."""
    text = str(model or "").strip()
    if not text:
        raise RuntimeError(weights_missing("<unset>", step))
    path = Path(text).expanduser()
    if path.is_dir():
        if any(path.iterdir()):
            return str(path)
        raise RuntimeError(weights_missing(text, step, "empty directory"))
    if path.is_absolute() or text.startswith("."):
        raise RuntimeError(weights_missing(text, step, "directory missing"))
    cache_error = hf_cache_error(step)
    if cache_error:
        raise RuntimeError(cache_error)
    hub = engine_imports.module("huggingface_hub", required=False)
    if hub is None:
        raise RuntimeError(weights_missing(text, step, "huggingface_hub unavailable for the cache lookup"))
    try:
        return str(hub.snapshot_download(text, local_files_only=True))
    except Exception as exc:  # noqa: BLE001 - huggingface_hub raises several cache-miss types
        raise RuntimeError(weights_missing(text, step, type(exc).__name__)) from exc


def forbid_nltk_downloads() -> None:
    """Make nltk.download a refusal: NLTK data comes from the installer. A
    library that tries to fetch missing data at import then fails on the
    missing resource, which the server reports as load_error."""
    nltk = engine_imports.module("nltk", required=False)
    if nltk is None:
        return

    def refuse(info_or_id: Any = None, *_args: Any, **_kwargs: Any) -> bool:
        log(f"[tts-server] refused nltk.download({info_or_id!r}): NLTK data is provisioned by the installer")
        return False

    nltk.download = refuse


def nvidia_smi_executable() -> str:
    found = shutil.which("nvidia-smi")
    if found:
        return found
    candidates: List[str] = []
    if os.name == "nt":
        system_root = os.environ.get("SystemRoot") or r"C:\Windows"
        candidates.append(os.path.join(system_root, "System32", "nvidia-smi.exe"))
        for variable in ("ProgramFiles", "ProgramW6432", "ProgramFiles(x86)"):
            program_files = os.environ.get(variable)
            if program_files:
                candidates.append(os.path.join(program_files, "NVIDIA Corporation", "NVSMI", "nvidia-smi.exe"))
    else:
        candidates.extend(_NVIDIA_SMI_POSIX_CANDIDATES)
    return next(
        (path for path in candidates if os.path.isfile(path) and os.access(path, os.X_OK)),
        "",
    )


def nvidia_smi_query(fields: Sequence[str]) -> Optional[List[List[str]]]:
    """The one VRAM/GPU reader of the standalone servers: one row of stripped
    csv values per GPU, or None when nvidia-smi is missing or fails. Never
    torch.cuda: a cpu-fallback decision must not create a CUDA context in this
    process (the context alone claims several hundred MiB of the GPU)."""
    executable = nvidia_smi_executable()
    if not executable:
        return None
    timeout = getattr(load_network_constants(), "NVIDIA_SMI_TIMEOUT_SECONDS", 10)
    try:
        output = subprocess.run(
            [executable, f"--query-gpu={','.join(fields)}", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            timeout=timeout,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        log(f"[tts-server] nvidia-smi query {list(fields)} failed: {exc}")
        return None
    if output.returncode != 0:
        return None
    rows = [
        [part.strip() for part in line.split(",")]
        for line in (output.stdout or "").splitlines()
        if line.strip()
    ]
    return [row for row in rows if len(row) >= len(fields)]


def nvidia_smi_free_mb(device_index: Optional[int] = None) -> Optional[int]:
    """Free VRAM (MiB) of one physical GPU, or of the freest GPU when no index
    is given; None when unknown."""
    rows = nvidia_smi_query(("index", "memory.free"))
    if not rows:
        return None
    free = {int(index): int(value) for index, value in rows if index.isdigit() and value.isdigit()}
    if not free:
        return None
    if device_index is None:
        return max(free.values())
    return free.get(int(device_index))


def resolve_device(
    env_name: str,
    torch_module: Any,
    *,
    cuda_device: str = "cuda:0",
    min_free_vram_mb: int = 0,
    gpu_index: Optional[int] = None,
    requirement: str = "",
    explicit: Optional[Sequence[str]] = None,
    lowercase: bool = True,
    free_vram_mb: Optional[Callable[[], Optional[int]]] = None,
) -> str:
    """Device of a server. An explicit ``env_name`` value wins (only values in
    ``explicit`` when given; any other value means auto). ``auto`` picks
    ``cuda_device`` when CUDA is available and, with a floor, the GPU has at
    least ``min_free_vram_mb`` MiB free (``free_vram_mb`` reader, else
    nvidia-smi memory.free); otherwise cpu. A missing torch (None) is cpu."""
    want = (os.environ.get(env_name) or "auto").strip()
    want = (want.lower() if lowercase else want) or "auto"
    if want != "auto" and (explicit is None or want in explicit):
        return want
    if torch_module is None or not torch_module.cuda.is_available():
        return "cpu"
    if min_free_vram_mb > 0:
        free_mb = free_vram_mb() if free_vram_mb is not None else nvidia_smi_free_mb(gpu_index)
        if free_mb is not None and free_mb < min_free_vram_mb:
            gpu_label = "" if gpu_index is None else f" on GPU {gpu_index}"
            source = f" by {requirement}" if requirement else ""
            log(
                f"[tts-server] auto device: {free_mb} MiB VRAM free{gpu_label} "
                f"< {min_free_vram_mb} MiB required{source}; falling back to cpu"
            )
            return "cpu"
    return cuda_device


def apply_gpu_memory_fraction(torch_module: Any, device_index: int = 0) -> float:
    """Cap this process's CUDA caching allocator to the fraction the launcher
    computed (PYCORE_GPU_MEMORY_FRACTION) so a display GPU keeps its headroom.
    Returns the applied fraction, 0.0 when unset/unusable."""
    fraction = env_float(load_network_constants().GPU_MEMORY_FRACTION_ENV, 0.0)
    try:
        if not 0.0 < fraction < 1.0 or not torch_module.cuda.is_available():
            return 0.0
        torch_module.cuda.set_per_process_memory_fraction(fraction, device_index)
    except Exception as exc:  # noqa: BLE001 - torch/CUDA raise arbitrary errors here
        log(f"[tts-server] CUDA memory fraction {fraction} on device {device_index} failed: {exc}")
        return 0.0
    return fraction


def pcm16_bytes(samples: Any) -> bytes:
    import numpy as np

    array = np.clip(np.asarray(samples, dtype=np.float32).reshape(-1), -1.0, 1.0)
    return (array * 32767.0).astype("<i2").tobytes()


def encode_wav(samples: Any, sample_rate: int) -> bytes:
    """Mono float samples -> PCM16 WAV bytes (stdlib wave; no ffmpeg)."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(int(sample_rate))
        handle.writeframes(pcm16_bytes(samples))
    return buffer.getvalue()


def encode_wav_soundfile(samples: Any, sample_rate: int) -> bytes:
    """Mono float samples -> PCM16 WAV bytes via soundfile (libsndfile rounding
    and header), for the servers that always encoded with soundfile."""
    import numpy as np
    import soundfile

    array = np.clip(np.asarray(samples, dtype=np.float32).reshape(-1), -1.0, 1.0)
    buffer = io.BytesIO()
    soundfile.write(buffer, array, int(sample_rate), format="WAV", subtype="PCM_16")
    return buffer.getvalue()


def encode_mp3(samples: Any, sample_rate: int) -> bytes:
    """Mono float samples -> MP3 bytes (pydub + ffmpeg)."""
    from pydub import AudioSegment

    segment = AudioSegment(pcm16_bytes(samples), frame_rate=int(sample_rate), sample_width=2, channels=1)
    buffer = io.BytesIO()
    segment.export(buffer, format="mp3")
    return buffer.getvalue()


def encode_audio(
    samples: Any,
    sample_rate: int,
    fmt: str,
    wav_encoder: Callable[[Any, int], bytes] = encode_wav,
) -> Tuple[bytes, str]:
    """(bytes, media type) for the requested ``wav`` or ``mp3`` (default) format."""
    if (fmt or "mp3").strip().lower() == "wav":
        return wav_encoder(samples, sample_rate), MEDIA_WAV
    return encode_mp3(samples, sample_rate), MEDIA_MP3


def add_lifecycle_routes(
    app: Any,
    health: Callable[[], Any],
    *,
    warm: Optional[Callable[[], Dict[str, Any]]] = None,
    load_error: Optional[Callable[[], Optional[str]]] = None,
    health_paths: Sequence[str] = ("/health", "/"),
) -> None:
    """GET ``health_paths`` -> ``health()``; with ``warm``, GET /load warms the
    model and returns ``{ok, model_loaded, **warm(), elapsed_ms}`` or a 500
    ``{ok: false, model_loaded: false, error}``. A recorded engine import
    failure (``engine_imports``) fills ``load_error`` on /health and fails
    /load with it without calling ``warm``."""
    from fastapi.responses import JSONResponse

    def reported_health():
        payload = health()
        import_error = engine_imports.error()
        if import_error and isinstance(payload, dict):
            payload["model_loaded"] = False
            payload["load_error"] = payload.get("load_error") or import_error
        return payload

    for path in health_paths:
        app.get(path)(reported_health)
    if warm is None:
        return

    def load():
        started = time.monotonic()
        import_error = engine_imports.error()
        if import_error:
            return JSONResponse({"ok": False, "model_loaded": False, "error": import_error}, status_code=500)
        try:
            details = warm()
        except Exception as exc:  # noqa: BLE001 - engine load errors are arbitrary
            error = (load_error() if load_error else None) or str(exc)
            log(f"[tts-server] /load failed: {error}")
            return JSONResponse({"ok": False, "model_loaded": False, "error": error}, status_code=500)
        return {
            "ok": True,
            "model_loaded": True,
            **details,
            "elapsed_ms": round((time.monotonic() - started) * 1000),
        }

    app.get("/load")(load)


def server_address(env_prefix: str, default_port: int) -> Tuple[str, int]:
    """(host, port) from ``{env_prefix}_HOST`` / ``{env_prefix}_PORT``."""
    host = (os.environ.get(f"{env_prefix}_HOST") or DEFAULT_HOST).strip() or DEFAULT_HOST
    return host, env_int(f"{env_prefix}_PORT", default_port)


def run_server(app: Any, env_prefix: str, default_port: int, banner: str = "") -> None:
    import uvicorn

    host, port = server_address(env_prefix, default_port)
    log(f"[tts-server] {banner or env_prefix} starting on {host}:{port}")
    uvicorn.run(app, host=host, port=port)


__all__ = [
    "DEFAULT_HOST",
    "MEDIA_MP3",
    "MEDIA_WAV",
    "NETWORK_CONSTANTS_MODULE_NAME",
    "TMP_DIR",
    "add_lifecycle_routes",
    "apply_gpu_memory_fraction",
    "encode_audio",
    "encode_mp3",
    "HF_CACHE_ENV",
    "OFFLINE_ENV",
    "hf_cache_error",
    "encode_wav",
    "encode_wav_soundfile",
    "env_uint",
    "forbid_nltk_downloads",
    "installer_step",
    "local_weights_error",
    "resolve_local_weights",
    "weights_missing",
    "engine_imports",
    "EngineImports",
    "env_float",
    "env_int",
    "load_network_constants",
    "load_pycore_source",
    "load_source_module",
    "log",
    "nvidia_smi_executable",
    "nvidia_smi_free_mb",
    "nvidia_smi_query",
    "pcm16_bytes",
    "pycore_package_root",
    "register_pycore_namespace",
    "resolve_device",
    "run_server",
    "server_address",
]
