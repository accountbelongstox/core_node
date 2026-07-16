# -*- coding: utf-8 -*-
"""
Managed lifecycle for local TTS services - the TTS-category facade over the
unified `managed_services` manager (pycore/pyutils/common/managed_service.py).

Covers TWO kinds of TTS services under category "tts":
  - kind="server" : subprocess HTTP API servers (chattts, cosyvoice, fishspeech,
                    gptsovits, f5tts). start = Popen + HTTP health; stop = terminate.
                    Single-active applies ONLY among these servers.
  - kind="model"  : in-process model engines (qwen3tts, bark, parler, voxcpm2,
                    melotts, kokoro, sherpa). load on first synth; parallel OK;
                    each idle-unloads independently after 60s without a call.

Unified contract (enforced by managed_services):
  - idempotent start on call (`prepare_server_for_use` / `managed_services.using`).
  - default no memory: auto-stop after `server_idle_shutdown_s` idle (default 60s).
  - single-active: starting one SERVER stops other TTS servers (not models).
  - busy protection: a service with an in-flight call is never stopped/unloaded.

Settings persist in user_data.json section "tts" (legacy `server_*` keys, kept
for router/UI compatibility): server_auto_manage / server_single_active /
server_idle_shutdown_s / server_enabled (per-service map, servers + models).
"""

import importlib
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyutils.common.managed_service import CategorySettings, ServiceSpec, managed_services
from pycore.pyutils.common.model_tiers import runtime_engine_model
from pycore.pyutils.tts.tts_engine_probe import engine_installed, staging_dir

from pycore.pyutils.tts import chattts_engine
import sys
from pycore.pyutils.tts import cosyvoice_engine
from pycore.pyutils.tts import gptsovits_engine
from pycore.pyutils.tts import f5tts_engine

from pycore.pyutils.tts import fishspeech_engine

import os




_TTS_SECTION = "tts"
_SERVER_ENGINES = ("chattts", "cosyvoice", "fishspeech", "gptsovits", "f5tts")
_MODEL_ENGINES = ("qwen3tts", "bark", "parler", "voxcpm2", "melotts", "kokoro", "sherpa")
_MODEL_MODULE = {
    "qwen3tts": "qwen3tts_engine",
    "bark": "bark_engine",
    "parler": "parler_engine",
    "voxcpm2": "voxcpm2_engine",
    "melotts": "melotts_engine",
    "kokoro": "kokoro_engine",
    "sherpa": "sherpa_engine",
}


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
    return sys.executable


def _sync_server_script(staging: Path, filename: str) -> None:
    """Keep staging api server aligned with pycore/tts_install_assets template."""
    src = Path(__file__).resolve().parents[2] / "tts_install_assets" / filename
    dst = staging / filename
    if src.is_file():
        try:
            shutil.copy2(src, dst)
        except OSError:
            pass


def _start_command(engine: str) -> Optional[Tuple[Path, List[str]]]:
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
        script = staging / "api_v2.py"
        if not script.is_file():
            return None
        return staging, [py, str(script)]
    if engine == "f5tts":
        _sync_server_script(staging, "f5tts_api_server.py")
        script = staging / "f5tts_api_server.py"
        if not script.is_file():
            return None
        return staging, [py, str(script)]
    return None


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
    return True


def invalidate_server_engine_cache(engine: str) -> None:
    """Reset the server engine module's 30s availability cache (after start/stop)."""
    mod_map = {
        "chattts": "chattts_engine",
        "cosyvoice": "cosyvoice_engine",
        "fishspeech": "fishspeech_engine",
        "gptsovits": "gptsovits_engine",
        "f5tts": "f5tts_engine",
    }
    mod_name = mod_map.get(engine)
    if not mod_name:
        return
    try:
        mod = importlib.import_module(f"pycore.pyutils.tts.{mod_name}")
        lock = getattr(mod, "_avail_lock", None)
        cache = getattr(mod, "_avail_cache", None)
        if lock is not None and isinstance(cache, dict):
            with lock:
                cache["ts"] = 0.0
    except Exception:  # noqa: BLE001
        pass


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
def _register_services() -> None:
    managed_services.register_category("tts", CategorySettings("tts", "server_", idle_default=60))
    for e in _SERVER_ENGINES:
        managed_services.register(ServiceSpec(
            name=e, category="tts", kind="server",
            installed=lambda e=e: engine_installed(e),
            config_ready=lambda e=e: _config_ready(e),
            start_command=lambda e=e: _start_command(e),
            health=lambda e=e: _http_healthy(e),
            on_started=lambda e=e: invalidate_server_engine_cache(e),
            on_stopped=lambda e=e: invalidate_server_engine_cache(e),
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
    return managed_services.get_settings("tts")


def apply_server_settings(patch: Dict[str, Any]) -> Dict[str, Any]:
    return managed_services.apply_settings("tts", patch)


def server_runtime_status(engine: str) -> Dict[str, Any]:
    """Per-engine runtime state for the status payload. Server engines keep the
    legacy `server_*` fields (UI controls); model engines report `model_loaded`
    + `model_idle_remaining_s` with `server_engine=False` (no controls)."""
    spec = managed_services.spec(engine)
    if spec is None:
        return {}
    st = managed_services.runtime_status(engine)
    if spec.kind == "server":
        return {
            "server_engine": True,
            "server_running": st["running"],
            "server_managed": st["managed"],
            "server_enabled": st["enabled"],
            "server_idle_remaining_s": st["idle_remaining_s"],
        }
    return {
        "server_engine": False,
        "model_loaded": st["running"],
        "model_idle_remaining_s": st["idle_remaining_s"],
    }


def all_server_runtime_status() -> Dict[str, Dict[str, Any]]:
    return {name: server_runtime_status(name) for name in _SERVER_ENGINES}


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
