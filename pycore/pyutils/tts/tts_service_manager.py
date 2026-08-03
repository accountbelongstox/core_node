# -*- coding: utf-8 -*-
"""
Managed lifecycle for local TTS services - the TTS-category facade over the
unified `managed_services` manager (pycore/pyutils/common/managed_service.py).
Implements the TTS view of the shared contract in
development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md (§3-§5).

Covers TWO kinds of TTS services under category "tts":
  - kind="server" : subprocess HTTP API servers (chattts, cosyvoice, fishspeech,
                    gptsovits, f5tts, qwen3tts, melotts). start = Popen + HTTP
                    health; stop = terminate. Single-active applies ONLY among
                    these servers (class C, spec §1). qwen3tts, melotts and
                    gptsovits are ISOLATED-VENV class-C servers (Bucket B): their
                    api server (qwen3tts_api_server.py / melotts_api_server.py /
                    the cloned GPT-SoVITS api_v2.py) runs under a DEDICATED
                    per-engine venv resolved by isolated_venv - because
                    each pins a transformers that cannot coexist with the main
                    interpreter's shared pin. PYTHONPATH/PYTHONHOME are stripped so
                    the venv's packages are never shadowed. Per-engine venv dirs +
                    ports: qwen3tts py_venv_<ver> :57210, melotts
                    py_venv_melotts_<ver> :57212, gptsovits py_venv_gptsovits_<ver>
                    :9880 (existing GPTSOVITS_URL bind).
  - kind="model"  : in-process model engines (bark, voxcpm2, kokoro, sherpa).
                    load on first synth; parallel OK; each idle-unloads
                    independently (class B, spec §1).

Unified contract (enforced by managed_services):
  - idempotent start on call (`prepare_server_for_use` / `managed_services.using`).
  - default no memory: auto-stop after `server_idle_shutdown_s` idle (default 180s).
  - single-active: starting one SERVER stops other TTS servers (not models).
  - busy protection: a service with an in-flight call is never stopped/unloaded.

Settings persist in user_data.json section "tts" (legacy `server_*` keys, kept
for router/UI compatibility): server_auto_manage / server_single_active /
server_idle_shutdown_s / server_enabled (per-service map, servers + models).
"""

import importlib
import os
import shutil
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.python_env.isolated_venv import (
    MAIN_INTERPRETER,
    resolve_python as resolve_isolated_python,
)
from pycore.pyutils.common.python_env.isolated_venv import venv_ready as isolated_venv_ready
from pycore.pyfoundations.third_party.api import get_third_package_psutil, get_third_package_requests
from pycore.pyutils.common.managed_service import CategorySettings, ServiceSpec, managed_services
from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.tts.tts_engine_probe import engine_installed, staging_dir

import pycore.pyutils.tts.chattts_engine as chattts_engine
import pycore.pyutils.tts.cosyvoice_engine as cosyvoice_engine
import pycore.pyutils.tts.gptsovits_engine as gptsovits_engine
import pycore.pyutils.tts.f5tts_engine as f5tts_engine

import pycore.pyutils.tts.fishspeech_engine as fishspeech_engine
import pycore.pyutils.tts.melotts_engine as melotts_engine
import pycore.pyutils.tts.qwen.engine as qwen_engine
import pycore.pyutils.tts.qwen.events as qwen_events
import pycore.pyutils.tts.qwen.weights as qwen_weights
from pycore.pyutils.tts.qwen.config import (
    DEFAULT_PORT as QWEN_DEFAULT_PORT,
    ENGINE_NAME as QWEN_ENGINE_NAME,
    api_server_path as qwen_api_server_path,
)


_TTS_SECTION = "tts"
# Parler is disabled because it pins an older transformers release. qwen3tts,
# melotts and gptsovits are class-C API servers running in DEDICATED per-engine
# venvs (Bucket B), never in-process - their pinned transformers conflicts with
# the main interpreter's shared pin.
_SERVER_ENGINES = (
    "chattts", "cosyvoice", "fishspeech", "gptsovits", "f5tts", "qwen3tts", "melotts",
)
_MODEL_ENGINES = ("bark", "voxcpm2", "kokoro", "sherpa")
_MODEL_MODULE = {
    "bark": "bark_engine",
    "voxcpm2": "voxcpm2_engine",
    "kokoro": "kokoro_engine",
    "sherpa": "sherpa_engine",
}
_MELOTTS_API_SERVER = "melotts_api_server.py"


# --------------------------------------------------------------------------- #
# Server specs (subprocess HTTP API servers)                                   #
# --------------------------------------------------------------------------- #
class _ServerSpec:
    """Static spec for a server engine: health paths + base URL."""

    def __init__(self, health_paths: Tuple[str, ...], base_url: str) -> None:
        self.health_paths = health_paths
        self.base_url = base_url


def _parse_port(url: str, default: int) -> int:
    try:
        parsed = urlparse(url)
        if parsed.port:
            return int(parsed.port)
    except Exception:  # noqa: BLE001
        pass
    return default


def _server_spec(engine: str) -> Optional[_ServerSpec]:
    if engine == "chattts":
        return _ServerSpec(("/health", "/"), chattts_engine.base_url())
    if engine == "cosyvoice":
        return _ServerSpec(("/docs", "/"), cosyvoice_engine.base_url())
    if engine == "fishspeech":
        return _ServerSpec(("/v1/health", "/health", "/"), fishspeech_engine.base_url())
    if engine == "gptsovits":
        return _ServerSpec(("/",), gptsovits_engine.base_url())
    if engine == "f5tts":
        return _ServerSpec(("/health", "/"), f5tts_engine.base_url())
    if engine == "qwen3tts":
        return _ServerSpec(("/health", "/"), qwen_engine.base_url())
    if engine == "melotts":
        return _ServerSpec(("/health", "/"), melotts_engine.base_url())
    return None


def _fishspeech_sdk_ready() -> bool:
    try:
        return bool((os.environ.get("FISH_API_KEY") or "").strip()) and fishspeech_engine._sdk_available()
    except Exception:  # noqa: BLE001
        return False


def _is_server_kind(engine: str) -> bool:
    spec = managed_services.spec(engine)
    return spec is not None and spec.kind == "server"


def _needs_local_server(engine: str) -> bool:
    """Server engines that actually need a local subprocess (fishspeech in SDK
    mode does not)."""
    if engine == "fishspeech" and _fishspeech_sdk_ready():
        return False
    return _is_server_kind(engine)


def _python_exe() -> str:
    return str(MAIN_INTERPRETER)


def _sync_server_script(staging: Path, filename: str) -> None:
    """Keep staging api server aligned with pycore/tts_install_assets template."""
    src = Path(__file__).resolve().parents[2] / "tts_install_assets" / filename
    dst = staging / filename
    if src.is_file():
        try:
            shutil.copy2(src, dst)
        except OSError:
            pass


def _start_command(engine: str) -> Optional[Tuple]:
    """Return (cwd, argv) for same-interpreter servers, or (cwd, argv, env) for
    servers that need a custom environment (qwen3tts runs under its isolated venv)."""
    staging = staging_dir(engine)
    py = _python_exe()
    if engine == "chattts":
        _sync_server_script(staging, "chattts_api_server.py")
        script = staging / "chattts_api_server.py"
        if not script.is_file():
            return None
        return staging, [py, str(script)]
    if engine == "cosyvoice":
        script = staging / "runtime" / "python" / "fastapi" / "server.py"
        if not script.is_file():
            return None
        port = _parse_port(_server_spec(engine).base_url, 50000)
        model = runtime_engine_model("cosyvoice") or "iic/CosyVoice2-0.5B"
        return staging, [py, str(script), "--port", str(port), "--model_dir", model]
    if engine == "fishspeech":
        _sync_server_script(staging, "fishspeech_api_server.py")
        script = staging / "fishspeech_api_server.py"
        if not script.is_file():
            script = staging / "tools" / "api_server.py"
        if not script.is_file():
            return None
        port = _parse_port(_server_spec(engine).base_url, 8080)
        if script.name == "fishspeech_api_server.py":
            return staging, [py, str(script)]
        return staging, [py, str(script), "--listen", f"0.0.0.0:{port}"]
    if engine == "gptsovits":
        return _gptsovits_start_command(staging)
    if engine == "f5tts":
        _sync_server_script(staging, "f5tts_api_server.py")
        script = staging / "f5tts_api_server.py"
        if not script.is_file():
            return None
        return staging, [py, str(script)]
    if engine == "qwen3tts":
        return _qwen3tts_start_command(staging)
    if engine == "melotts":
        return _melotts_start_command(staging)
    return None


def _isolated_env(extra: Dict[str, str]) -> Dict[str, str]:
    """Base environment for a class-C server run under an ISOLATED per-engine venv:
    inherit os.environ, strip PYTHONPATH/PYTHONHOME (so the main interpreter's
    site-packages cannot shadow the venv's pinned packages), force unbuffered
    stdout, then apply the engine-specific overrides."""
    env = dict(os.environ)
    env.pop("PYTHONPATH", None)
    env.pop("PYTHONHOME", None)
    env["PYTHONUNBUFFERED"] = "1"
    env.update(extra)
    return env


def _gptsovits_start_command(staging: Path) -> Optional[Tuple[Path, List[str], Dict[str, str]]]:
    """Class-C start command for gptsovits: launch its api_v2.py under the ISOLATED
    per-engine venv (never the main interpreter, whose transformers pin conflicts
    with GPT-SoVITS's). RUNTIME only RESOLVES the pre-built venv - a missing venv
    -> no start (the installer provisions it via isolated_venv.ensure_venv)."""
    script = staging / "api_v2.py"
    if not script.is_file():
        return None
    venv_python = resolve_isolated_python("gptsovits")
    if not venv_python:
        return None
    return staging, [venv_python, str(script)], _isolated_env({})


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
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or 57212
    extra: Dict[str, str] = {"MELOTTS_HOST": host, "MELOTTS_PORT": str(port)}
    model = (os.environ.get("MELOTTS_MODEL") or "").strip()
    if model:
        extra["MELOTTS_MODEL"] = model
    device = (os.environ.get("MELOTTS_DEVICE") or "").strip()
    if device:
        extra["MELOTTS_DEVICE"] = device
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
    (Step61_InstallQwen3Tts.ps1 / 140_install_qwen3tts.sh) that pyservice runs; a
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
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or QWEN_DEFAULT_PORT
    extra: Dict[str, str] = {
        "QWEN3TTS_HOST": host,
        "QWEN3TTS_PORT": str(port),
        "QWEN3TTS_MODEL": model_id,
        "HF_HUB_OFFLINE": "1",
        "TRANSFORMERS_OFFLINE": "1",
    }
    device = (os.environ.get("QWEN3TTS_DEVICE") or "").strip()
    if device:
        extra["QWEN3TTS_DEVICE"] = device
    return staging, [venv_python, str(api_server)], _isolated_env(extra)


def _http_healthy(engine: str) -> bool:
    spec = _server_spec(engine)
    if spec is None:
        return False
    requests = get_third_package_requests()
    if requests is None:
        return False
    base = spec.base_url.rstrip("/")
    for path in spec.health_paths:
        try:
            resp = requests.get(f"{base}{path}", timeout=(1.0, 2.0))
            if resp.status_code < 500:
                return True
        except requests.exceptions.ConnectionError:
            # Port not answering (refused / connect timeout) - other paths on the
            # same port will fail identically, skip them.
            return False
        except Exception:  # noqa: BLE001
            continue
    return False


def _config_ready(engine: str) -> bool:
    """Synth config present - without it a running server still can't synthesize,
    so auto-start would only waste memory (and evict the active server in
    single-active mode)."""
    if engine == "cosyvoice":
        return cosyvoice_engine.disabled_reason() is None
    if engine == "gptsovits":
        return gptsovits_engine._ref_audio() is not None
    if engine == "f5tts":
        return f5tts_engine.disabled_reason() is None
    if engine == "fishspeech":
        return fishspeech_engine.synth_ready()
    if engine == "qwen3tts":
        # Class C: without the isolated venv the api server cannot start, so
        # auto-start would only churn (and evict the active server single-active).
        return isolated_venv_ready("qwen3tts")
    if engine == "melotts":
        # Class C: same as qwen3tts - the per-engine isolated venv gates start.
        return isolated_venv_ready("melotts")
    return True


def invalidate_server_engine_cache(engine: str) -> None:
    """Reset the server engine module's 30s availability cache (after start/stop)."""
    mod_map = {
        "chattts": "chattts_engine",
        "cosyvoice": "cosyvoice_engine",
        "fishspeech": "fishspeech_engine",
        "gptsovits": "gptsovits_engine",
        "f5tts": "f5tts_engine",
        "melotts": "melotts_engine",
    }
    mod_name = mod_map.get(engine)
    if not mod_name:
        return
    try:
        mod = importlib.import_module(f"pycore.pyutils.tts.{mod_name}")
        lock = getattr(mod, "_avail_lock", None)
        cache = getattr(mod, "_avail_cache", None)
        # Qwen3TTS and melotts_engine are stateless HTTP clients with no
        # availability cache - nothing to invalidate; skip gracefully.
        if lock is not None and isinstance(cache, dict):
            with lock:
                cache["ts"] = 0.0
    except Exception:  # noqa: BLE001
        pass


def _on_server_started(engine: str) -> None:
    invalidate_server_engine_cache(engine)
    if engine == "qwen3tts":
        qwen_events.start_qwen3tts_http_events()


def _on_server_stopped(engine: str) -> None:
    invalidate_server_engine_cache(engine)
    if engine == "qwen3tts":
        qwen_events.stop_qwen3tts_http_events()


# --------------------------------------------------------------------------- #
# Model specs (in-process engines)                                             #
# --------------------------------------------------------------------------- #
def _model_module(engine: str) -> Any:
    mod = _MODEL_MODULE.get(engine)
    if not mod:
        return None
    try:
        return importlib.import_module(f"pycore.pyutils.tts.{mod}")
    except Exception:  # noqa: BLE001
        return None


def _model_available(engine: str) -> bool:
    mod = _model_module(engine)
    return bool(mod and mod.available())


def _model_is_loaded(engine: str) -> bool:
    mod = _model_module(engine)
    return bool(mod and mod.is_model_loaded())


def _model_unload(engine: str) -> None:
    mod = _model_module(engine)
    if mod:
        mod.unload_model()


# --------------------------------------------------------------------------- #
# Registration into the unified manager                                        #
# --------------------------------------------------------------------------- #
def _listener_pids(psutil: Any, port: int) -> List[int]:
    """Return process IDs currently listening on one TCP port."""
    pids = set()
    for conn in psutil.net_connections(kind="tcp"):
        local_address = getattr(conn, "laddr", None)
        if not local_address or getattr(local_address, "port", None) != port:
            continue
        if conn.status == psutil.CONN_LISTEN and conn.pid:
            pids.add(int(conn.pid))
    return sorted(pids)


def _stop_foreign_server(engine: str) -> Optional[bool]:
    """Terminate a process we did NOT launch that is LISTENING on this engine's
    port — typically a stale orphan from a previous pycore run (its stdout pipe
    is dead, so every synth request 500s instantly while /health keeps passing).
    Returns True when reclaimed, False when a listener remains, and None when
    no listener can be identified."""
    spec = _server_spec(engine)
    if spec is None:
        return False
    port = _parse_port(spec.base_url, 0)
    if not port:
        return False
    try:
        psutil = get_third_package_psutil()
    except Exception:  # noqa: BLE001
        return None
    try:
        listener_pids = _listener_pids(psutil, port)
        if not listener_pids:
            return None
        if os.getpid() in listener_pids:
            ColorPrint.yellow(
                f"[tts] refusing to reclaim {engine} port {port} from this process"
            )
            return False
        for pid in listener_pids:
            try:
                proc = psutil.Process(pid)
                proc.terminate()
                try:
                    proc.wait(timeout=8)
                except psutil.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=8)
            except psutil.NoSuchProcess:
                pass
            except Exception as exc:  # noqa: BLE001
                ColorPrint.yellow(
                    f"[tts] failed to stop foreign {engine} server "
                    f"(pid={pid}, port={port}): {exc}"
                )
        remaining = _listener_pids(psutil, port)
        if remaining:
            ColorPrint.yellow(
                f"[tts] foreign {engine} listener still owns port {port}: {remaining}"
            )
            return False
        for pid in listener_pids:
            ColorPrint.yellow(
                f"[tts] stopped foreign {engine} server "
                f"(pid={pid}) on port {port}"
            )
    except Exception:  # noqa: BLE001
        return None
    return True


def _register_services() -> None:
    managed_services.register_category("tts", CategorySettings("tts", "server_", idle_default=180))
    for e in _SERVER_ENGINES:
        managed_services.register(ServiceSpec(
            name=e, category="tts", kind="server",
            installed=lambda e=e: engine_installed(e),
            config_ready=lambda e=e: _config_ready(e),
            start_command=lambda e=e: _start_command(e),
            health=lambda e=e: _http_healthy(e),
            on_started=lambda e=e: _on_server_started(e),
            on_stopped=lambda e=e: _on_server_stopped(e),
            adopt_foreign=(
                (lambda: qwen_engine.get_queue_status() is not None)
                if e == "qwen3tts"
                else None
            ),
            stop_foreign=lambda e=e: _stop_foreign_server(e),
        ))
    for e in _MODEL_ENGINES:
        managed_services.register(ServiceSpec(
            name=e, category="tts", kind="model",
            installed=lambda e=e: _model_available(e),
            unload=lambda e=e: _model_unload(e),
            is_loaded=lambda e=e: _model_is_loaded(e),
        ))


_register_services()


# --------------------------------------------------------------------------- #
# Public facade (delegates to managed_services; keeps the legacy API shape)    #
# --------------------------------------------------------------------------- #
def is_server_engine(name: str) -> bool:
    """True for any managed TTS service (server OR model). The orchestrator uses
    this to gate prepare/record, so model engines get the same lifecycle hooks."""
    spec = managed_services.spec(name)
    return spec is not None and spec.category == "tts"


def is_server_running(engine: str) -> bool:
    """Reachability: server HTTP health (cached) or model loaded."""
    return managed_services.is_running(engine)


def start_server(engine: str, *, force_single: Optional[bool] = None) -> Dict[str, Any]:
    """Manual start (UI button). Force-starts bypassing auto_manage/enabled,
    still honouring single-active. Models load on use, so this is a no-op marker."""
    spec = managed_services.spec(engine)
    if spec is None or spec.category != "tts":
        return {"success": False, "error": f"not a managed TTS service: {engine}"}
    if spec.kind == "model":
        managed_services.record_use(engine)
        return {"success": True, "engine": engine, "running": managed_services.is_running(engine),
                "managed": False, "note": "model loads on use"}
    if not engine_installed(engine):
        return {"success": False, "error": f"{engine} not installed"}
    if not _needs_local_server(engine):
        return {"success": True, "engine": engine, "running": True, "managed": False, "note": "sdk mode"}
    if managed_services.is_running(engine):
        managed_services.record_use(engine)
        return {"success": True, "engine": engine, "running": True, "managed": True, "note": "already up"}
    ok = managed_services.ensure_running(engine, force=True)
    return {"success": ok, "engine": engine, "running": managed_services.is_running(engine), "managed": ok}


def stop_server(engine: str) -> Dict[str, Any]:
    if not is_server_engine(engine):
        return {"success": False, "error": f"not a managed TTS service: {engine}"}
    out = managed_services.stop(engine)
    invalidate_server_engine_cache(engine)
    return {"success": bool(out.get("success", False)), "engine": engine,
            "running": managed_services.is_running(engine)}


def set_engine_enabled(engine: str, enabled: bool, *, start_now: bool = False) -> Dict[str, Any]:
    if not is_server_engine(engine):
        return {"success": False, "error": f"not a managed TTS service: {engine}"}
    out = apply_server_settings({"server_enabled": {engine: bool(enabled)}})
    if not enabled:
        managed_services.stop(engine)
        return {**out, "engine": engine, "enabled": False, "running": managed_services.is_running(engine)}
    if start_now:
        start = start_server(engine)
        return {**out, **start, "enabled": True}
    return {**out, "engine": engine, "enabled": True, "running": managed_services.is_running(engine)}


def prepare_server_for_use(engine: str) -> bool:
    """Idempotent: ensure a TTS service is usable before synth. Servers may be
    Popen-started (auto_manage+enabled); models only get an activity touch (parallel
    load/unload — the engine loads weights on synth). fishspeech SDK mode is a no-op."""
    if engine == "fishspeech" and _fishspeech_sdk_ready():
        return True
    return managed_services.ensure_running(engine)


def record_server_use(engine: str) -> None:
    """Refresh the idle-shutdown timer after a successful call."""
    managed_services.record_use(engine)


def get_server_settings() -> Dict[str, Any]:
    return managed_services.peek_settings("tts")


def apply_server_settings(patch: Dict[str, Any]) -> Dict[str, Any]:
    return managed_services.apply_settings("tts", patch)


def server_runtime_status(engine: str, refresh: bool = True) -> Dict[str, Any]:
    """Per-engine runtime state for the status payload. Server engines keep the
    legacy `server_*` fields (UI controls); model engines report `model_loaded`
    + `model_idle_remaining_s` with `server_engine=False` (no controls)."""
    spec = managed_services.spec(engine)
    if spec is None:
        return {}
    st = (
        managed_services.runtime_status(engine)
        if refresh
        else managed_services.peek_runtime_status(engine)
    )
    if spec.kind == "server":
        status = {
            "server_engine": True,
            "server_running": st["running"],
            "server_managed": st["managed"],
            "server_enabled": st["enabled"],
            "server_idle_remaining_s": st["idle_remaining_s"],
            "server_url": st.get("ready_url"),
        }
        if engine == "qwen3tts" and st["running"] and refresh:
            status["server_url"] = status["server_url"] or qwen_engine.base_url()
            queue = qwen_engine.get_queue_status()
            if queue is not None:
                status["queue"] = queue
        return status
    return {
        "server_engine": False,
        "model_loaded": st["running"],
        "model_idle_remaining_s": st["idle_remaining_s"],
    }


def all_server_runtime_status() -> Dict[str, Dict[str, Any]]:
    names = list(_SERVER_ENGINES) + list(_MODEL_ENGINES)
    return {name: server_runtime_status(name) for name in names}


__all__ = [
    "is_server_engine",
    "is_server_running",
    "get_server_settings",
    "apply_server_settings",
    "start_server",
    "stop_server",
    "set_engine_enabled",
    "prepare_server_for_use",
    "record_server_use",
    "invalidate_server_engine_cache",
    "server_runtime_status",
    "all_server_runtime_status",
]
