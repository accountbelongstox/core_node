# -*- coding: utf-8 -*-
"""
Managed lifecycle for local TTS services - the TTS-category facade over the
unified `managed_services` manager (pycore/pyutils/common/managed_service.py).
Implements the TTS view of the shared contract in
development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md (§3-§5).

Covers TWO kinds of TTS services under category "tts":
  - kind="server" : subprocess HTTP API servers (chattts, cosyvoice, fishspeech,
                    gptsovits, f5tts, qwen3tts, melotts, voxcpm2). start = Popen +
                    HTTP health; stop = terminate. Single-active applies ONLY
                    among these servers (class C, spec §1). qwen3tts, melotts,
                    gptsovits, cosyvoice, fishspeech and voxcpm2 are
                    ISOLATED-VENV class-C servers (Bucket B): their api server
                    runs under a DEDICATED per-engine venv resolved by
                    isolated_venv - because each pins a transformers (or a Python
                    ABI window) that cannot coexist with the main interpreter.
                    PYTHONPATH/PYTHONHOME are stripped so the venv's packages are
                    never shadowed. Per-engine venv dirs + ports: qwen3tts
                    py_venv_qwen3tts_<ver> :57210, melotts py_venv_melotts_<ver>
                    :57212, gptsovits py_venv_gptsovits_<ver> :9880 (existing
                    GPTSOVITS_URL bind), voxcpm2 py_venv_voxcpm2_3.12 :57214
                    (self-contained, dedicated base Python 3.10).
  - kind="model"  : in-process model engines (bark, kokoro, sherpa).
                    load on first synth; parallel OK; each idle-unloads
                    independently (class B, spec §1).

Unified contract (enforced by managed_services):
  - idempotent start and ownership on call (`managed_services.lease`).
  - default no memory: auto-stop after `server_idle_shutdown_s` idle (default 180s).
  - single-active: starting one SERVER stops other TTS servers (not models).
  - busy protection: a service with an in-flight call is never stopped/unloaded.

Settings persist in user_data.json section "tts" (legacy `server_*` keys, kept
for router/UI compatibility): server_auto_manage / server_single_active /
server_idle_shutdown_s / server_enabled (per-service map, servers + models).
"""

from typing import Any, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.managed_service import ServiceSpec
from pycore.pyutils.common.managed_service_facade import ManagedServiceFacade
from pycore.pyutils.tts import runtime_profile
from pycore.pyutils.tts.engine_registry import tts_engine_registry
from pycore.pyutils.tts.qwen.engine import qwen_engine
import pycore.pyutils.tts.qwen.events as qwen_events
from pycore.pyutils.tts.tts_server_launch import server_scripts, start_command
from pycore.pyutils.tts.tts_server_ownership import foreign_server_present, stop_foreign_server

_TTS_SERVICE_FACADE = ManagedServiceFacade("tts", "server_")


def invalidate_server_engine_cache(engine: str) -> None:
    """Reset the server engine's availability TTL cache (after start/stop)."""
    adapter = tts_engine_registry.get(engine)
    if adapter is not None:
        adapter.invalidate_availability()


def _on_server_started(engine: str) -> None:
    invalidate_server_engine_cache(engine)
    if engine == qwen_engine.name:
        qwen_events.start_qwen3tts_http_events()


def _on_server_stopped(engine: str) -> None:
    invalidate_server_engine_cache(engine)
    if engine == qwen_engine.name:
        qwen_events.stop_qwen3tts_http_events()


def _register_services() -> None:
    for adapter in tts_engine_registry.values("server"):
        engine = adapter.name
        # Code-identity contract activates only when BOTH halves exist: the
        # launch script set (identity of what a start runs) and one canonical
        # lifecycle probe (health plus code identity). Engines missing either
        # half keep the plain adoption/reclaim behavior.
        status_capable = adapter.service_status_capable
        code_scripts = (
            (lambda e=engine: server_scripts(e))
            if status_capable and server_scripts(engine)
            else None
        )
        _TTS_SERVICE_FACADE.register(ServiceSpec(
            name=engine, category="tts", kind="server",
            # An engine whose weights live server-side counts as installed
            # while a healthy server answers on its port.
            installed=lambda adapter=adapter: adapter.installed() or (adapter.external_server_ok and adapter.healthy()),
            config_ready=lambda adapter=adapter: (
                adapter.config_ready() or (adapter.external_server_ok and adapter.healthy())
            ),
            start_command=lambda engine=engine: start_command(engine),
            health=adapter.healthy,
            on_started=lambda engine=engine: _on_server_started(engine),
            on_stopped=lambda engine=engine: _on_server_stopped(engine),
            on_acquired=adapter.invalidate_availability,
            foreign_present=lambda engine=engine: foreign_server_present(engine),
            stop_foreign=lambda engine=engine: stop_foreign_server(engine),
            server_scripts=code_scripts,
            status_report=adapter.service_report if status_capable else None,
            ready_without_process=adapter.ready_without_process if adapter.process_free else None,
        ))
    for adapter in tts_engine_registry.values("model"):
        _TTS_SERVICE_FACADE.register(ServiceSpec(
            name=adapter.name,
            category="tts",
            kind="model",
            installed=adapter.available,
            unload=adapter.unload_model,
            is_loaded=adapter.is_model_loaded,
        ))


_register_services()


# --------------------------------------------------------------------------- #
# Public facade (delegates to managed_services; keeps the legacy API shape)    #
# --------------------------------------------------------------------------- #
def is_server_engine(name: str) -> bool:
    """True for any managed TTS service (server OR model). The orchestrator uses
    this to give model engines the same lifecycle lease as server engines."""
    return _TTS_SERVICE_FACADE.contains(name)


def is_server_running(engine: str) -> bool:
    """Reachability: server HTTP health (cached) or model loaded."""
    return _TTS_SERVICE_FACADE.is_running(engine)


def start_server(engine: str) -> Dict[str, Any]:
    """Manual start (UI button). Force-starts bypassing auto_manage/enabled,
    still honouring single-active. Models load on use, so this is a no-op marker.

    The explicit UI start is the ONLY way a non-pinned engine may run; it must
    still pass the RAM/VRAM scheduling gateway (runtime_profile consults
    memory_gate) before any weights are touched."""
    allowed, reason = runtime_profile.engine_start_allowed(engine, explicit=True)
    if not allowed:
        ColorPrint.yellow(
            f"[tts-service] {engine}: start denied by the scheduling gateway ({reason})"
        )
        return {"success": False, "engine": engine, "error": reason}
    return _TTS_SERVICE_FACADE.start(engine)


def stop_server(engine: str) -> Dict[str, Any]:
    result = _TTS_SERVICE_FACADE.stop(engine)
    invalidate_server_engine_cache(engine)
    return result


def set_engine_enabled(engine: str, enabled: bool, *, start_now: bool = False) -> Dict[str, Any]:
    return _TTS_SERVICE_FACADE.set_enabled(
        engine,
        enabled,
        start_now=start_now,
    )


def get_server_settings() -> Dict[str, Any]:
    return _TTS_SERVICE_FACADE.settings(refresh=False)


def apply_server_settings(patch: Dict[str, Any]) -> Dict[str, Any]:
    return _TTS_SERVICE_FACADE.apply_settings(patch)


def server_runtime_status(engine: str, refresh: bool = True) -> Dict[str, Any]:
    """Per-engine runtime state for the status payload. Server engines keep the
    legacy `server_*` fields (UI controls); model engines report `model_loaded`
    + `model_idle_remaining_s` with `server_engine=False` (no controls)."""
    status = _TTS_SERVICE_FACADE.runtime_status(engine, refresh=refresh)
    if engine == "qwen3tts" and status.get("server_running") and refresh:
        status["server_url"] = status.get("server_url") or qwen_engine.base_url()
        queue = qwen_engine.status_snapshot()
        if queue is not None:
            status["queue"] = queue
    return status


def all_server_runtime_status() -> Dict[str, Dict[str, Any]]:
    names = (
        tts_engine_registry.names("server")
        + tts_engine_registry.names("model")
    )
    return {name: server_runtime_status(name) for name in names}


__all__ = [
    "is_server_engine",
    "is_server_running",
    "get_server_settings",
    "apply_server_settings",
    "start_server",
    "stop_server",
    "set_engine_enabled",
    "invalidate_server_engine_cache",
    "server_runtime_status",
    "all_server_runtime_status",
]
