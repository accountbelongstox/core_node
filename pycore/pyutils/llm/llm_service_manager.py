# -*- coding: utf-8 -*-
"""
Managed lifecycle for local LLM servers - the LLM-category facade over the
unified `managed_services` manager (pycore/pyutils/common/managed_service.py).
Mirrors tts_service_manager.py (same contract, same settings mechanics).

Category "llm" holds kind="server" specs only:
  - ollama   : managed server. start = Popen ``ollama serve`` + HTTP health;
               stop = terminate. Single-active applies among llm servers.
  - lmstudio : external server (no start_command) — available only while the
               user-started server answers GET {base}/models.
  - llamacpp : external server (no start_command) — same rule.

Unified contract (enforced by managed_services):
  - idempotent start on call (`prepare_server_for_use` / `managed_services.using`).
  - default no memory: auto-stop after `llm_idle_shutdown_s` idle (default 180s).
  - busy protection: a service with an in-flight call is never stopped.

Settings persist in user_data.json section "llm" (`llm_*` keys):
llm_auto_manage / llm_single_active / llm_idle_shutdown_s / llm_enabled
(per-service map).
"""

from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from pycore.pyutils.common.managed_service import (
    CategorySettings,
    ServiceSpec,
    managed_services,
)
from pycore.pyutils.llm.llm_engines import (
    engine_healthy,
    engine_installed,
    ollama_binary,
)

_LLM_SECTION = "llm"
# Servers pycore can start/stop itself.
_MANAGED_ENGINES = ("ollama",)
# External servers: reachable only while the user runs them (no start_command).
_EXTERNAL_ENGINES = ("lmstudio", "llamacpp")


def _ollama_start_command() -> Optional[Tuple]:
    """(cwd, argv) for the managed ollama server; None when not installed."""
    binary = ollama_binary()
    if not binary:
        return None
    return Path(binary).parent, [binary, "serve"]


def _register_services() -> None:
    managed_services.register_category(
        "llm", CategorySettings(_LLM_SECTION, "llm_", idle_default=180))
    for e in _MANAGED_ENGINES:
        managed_services.register(ServiceSpec(
            name=e, category="llm", kind="server",
            installed=lambda e=e: engine_installed(e),
            start_command=_ollama_start_command,
            health=lambda e=e: engine_healthy(e),
        ))
    for e in _EXTERNAL_ENGINES:
        managed_services.register(ServiceSpec(
            name=e, category="llm", kind="server",
            installed=lambda e=e: False,
            start_command=None,
            health=lambda e=e: engine_healthy(e),
        ))


_register_services()


# --------------------------------------------------------------------------- #
# Public facade (delegates to managed_services; mirrors the TTS facade shape)  #
# --------------------------------------------------------------------------- #
def is_llm_engine(name: str) -> bool:
    """True for any registered LLM service (managed or external)."""
    spec = managed_services.spec(name)
    return spec is not None and spec.category == "llm"


def is_server_running(name: str) -> bool:
    """Reachability: server HTTP health (cached)."""
    return managed_services.is_running(name)


def start_server(name: str) -> Dict[str, Any]:
    """Manual start (UI button). Only ollama has a managed start command;
    external engines must be started by the user outside pycore."""
    spec = managed_services.spec(name)
    if spec is None or spec.category != "llm":
        return {"success": False, "error": f"not a managed LLM service: {name}"}
    if spec.start_command is None:
        return {"success": False, "engine": name,
                "running": managed_services.is_running(name),
                "error": f"{name} is an external server — start it manually"}
    if not engine_installed(name):
        return {"success": False, "error": f"{name} not installed"}
    if managed_services.is_running(name):
        managed_services.record_use(name)
        return {"success": True, "engine": name, "running": True,
                "managed": True, "note": "already up"}
    ok = managed_services.ensure_running(name, force=True)
    return {"success": ok, "engine": name,
            "running": managed_services.is_running(name), "managed": ok}


def stop_server(name: str) -> Dict[str, Any]:
    if not is_llm_engine(name):
        return {"success": False, "error": f"not a managed LLM service: {name}"}
    out = managed_services.stop(name)
    return {"success": bool(out.get("success", False)), "engine": name,
            "running": managed_services.is_running(name)}


def set_engine_enabled(name: str, enabled: bool, *, start_now: bool = False) -> Dict[str, Any]:
    if not is_llm_engine(name):
        return {"success": False, "error": f"not a managed LLM service: {name}"}
    out = apply_server_settings({"llm_enabled": {name: bool(enabled)}})
    if not enabled:
        managed_services.stop(name)
        return {**out, "engine": name, "enabled": False,
                "running": managed_services.is_running(name)}
    if start_now:
        start = start_server(name)
        return {**out, **start, "enabled": True}
    return {**out, "engine": name, "enabled": True,
            "running": managed_services.is_running(name)}


def prepare_server_for_use(name: str) -> bool:
    """Idempotent: ensure an LLM service is usable before a chat call. Managed
    servers may be Popen-started (auto_manage+enabled); external servers only
    get an activity touch when already reachable."""
    return managed_services.ensure_running(name)


def record_server_use(name: str) -> None:
    """Refresh the idle-shutdown timer after a successful call."""
    managed_services.record_use(name)


def get_server_settings() -> Dict[str, Any]:
    return managed_services.get_settings("llm")


def apply_server_settings(patch: Dict[str, Any]) -> Dict[str, Any]:
    return managed_services.apply_settings("llm", patch)


def server_runtime_status(name: str) -> Dict[str, Any]:
    """Per-engine runtime state for the status payload (same `server_*` field
    shape the TTS panel uses, so the UI controls are interchangeable)."""
    spec = managed_services.spec(name)
    if spec is None:
        return {}
    st = managed_services.runtime_status(name)
    return {
        "server_engine": True,
        "server_running": st["running"],
        "server_managed": st["managed"],
        "server_enabled": st["enabled"],
        "server_idle_remaining_s": st["idle_remaining_s"],
    }


__all__ = [
    "is_llm_engine",
    "is_server_running",
    "get_server_settings",
    "apply_server_settings",
    "start_server",
    "stop_server",
    "set_engine_enabled",
    "prepare_server_for_use",
    "record_server_use",
    "server_runtime_status",
]
