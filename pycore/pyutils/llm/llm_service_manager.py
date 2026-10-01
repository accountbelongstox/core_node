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

from pycore.pyutils.common.managed_service import ServiceSpec
from pycore.pyutils.common.managed_service_facade import ManagedServiceFacade
from pycore.pyutils.llm.llm_engines import llm_engine_registry

llm_service_facade = ManagedServiceFacade("llm", "llm_")

for _adapter in llm_engine_registry.values("server"):
    llm_service_facade.register(ServiceSpec(
        name=_adapter.name,
        category="llm",
        kind="server",
        installed=(lambda: True) if _adapter.external else _adapter.installed,
        start_command=None if _adapter.external else _adapter.start_command,
        health=_adapter.healthy,
        external=_adapter.external,
    ))


__all__ = ["llm_service_facade"]
