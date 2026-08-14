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
  - idempotent start and ownership on call (`managed_services.lease`).
  - default no memory: auto-stop after `llm_idle_shutdown_s` idle (default 180s).
  - busy protection: a service with an in-flight call is never stopped.

Settings persist in user_data.json section "llm" (`llm_*` keys):
llm_auto_manage / llm_single_active / llm_idle_shutdown_s / llm_enabled
(per-service map).
"""

from typing import Any, Dict

from pycore.pyutils.common.managed_service import (
    ServiceSpec,
)
from pycore.pyutils.common.managed_service_facade import ManagedServiceFacade
from pycore.pyutils.llm.llm_engines import (
    llm_engine_registry,
)

_LLM_SERVICE_FACADE = ManagedServiceFacade("llm", "llm_")


def _register_services() -> None:
    for adapter in llm_engine_registry.values("server"):
        _LLM_SERVICE_FACADE.register(ServiceSpec(
            name=adapter.name,
            category="llm",
            kind="server",
            installed=(lambda: True) if adapter.external else adapter.installed,
            start_command=None if adapter.external else adapter.start_command,
            health=adapter.healthy,
            external=adapter.external,
        ))


_register_services()


# --------------------------------------------------------------------------- #
# Public facade (delegates to managed_services; mirrors the TTS facade shape)  #
# --------------------------------------------------------------------------- #
def is_llm_engine(name: str) -> bool:
    """True for any registered LLM service (managed or external)."""
    return _LLM_SERVICE_FACADE.contains(name)


def is_server_running(name: str) -> bool:
    """Reachability: server HTTP health (cached)."""
    return _LLM_SERVICE_FACADE.is_running(name)


def start_server(name: str) -> Dict[str, Any]:
    """Manual start (UI button). Only ollama has a managed start command;
    external engines must be started by the user outside pycore."""
    return _LLM_SERVICE_FACADE.start(name)


def stop_server(name: str) -> Dict[str, Any]:
    return _LLM_SERVICE_FACADE.stop(name)


def set_engine_enabled(name: str, enabled: bool, *, start_now: bool = False) -> Dict[str, Any]:
    return _LLM_SERVICE_FACADE.set_enabled(
        name,
        enabled,
        start_now=start_now,
    )


def get_server_settings() -> Dict[str, Any]:
    return _LLM_SERVICE_FACADE.settings(refresh=False)


def apply_server_settings(patch: Dict[str, Any]) -> Dict[str, Any]:
    return _LLM_SERVICE_FACADE.apply_settings(patch)


def server_runtime_status(name: str) -> Dict[str, Any]:
    """Per-engine runtime state for the status payload (same `server_*` field
    shape the TTS panel uses, so the UI controls are interchangeable)."""
    return _LLM_SERVICE_FACADE.runtime_status(name)


__all__ = [
    "is_llm_engine",
    "is_server_running",
    "get_server_settings",
    "apply_server_settings",
    "start_server",
    "stop_server",
    "set_engine_enabled",
    "server_runtime_status",
]
