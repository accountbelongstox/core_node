# -*- coding: utf-8 -*-
"""
LLM orchestrator — ONE entry that picks the highest-priority AVAILABLE local
LLM server and runs an OpenAI-compatible chat completion against it.

Priority (highest first): ollama -> lmstudio -> llamacpp
(override with env ``LLM_ENGINE_PRIORITY``, e.g. ``lmstudio->ollama``).

Lifecycle: this module owns priority only. Every HTTP call holds a
``managed_services.lease(name)`` so the shared lifecycle contract
(single-active, busy protection, idle unload) applies — the same pattern the
TTS orchestrator uses for class-C servers. Only ollama is auto-started;
lmstudio/llamacpp are external servers used only while already running.

When NO local engine works, chat() returns success=False with a clear error so
the caller can fall back to a cloud provider (OpenRouter).
"""

from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.coded_message import message_fields
from pycore.pyutils.common.engine_registry import build_engine_panel
from pycore.pyutils.common.managed_service import managed_services
from pycore.pyutils.common.model_reasons import (
    MODEL_REASON_SERVER_NOT_RUNNING,
    MODEL_REASON_SERVER_UNREACHABLE,
    model_reason,
)
from pycore.pyutils.llm.llm_engines import (
    LLMEngineAdapter,
    chat_completion_raw,
    llm_engine_registry,
)
from pycore.pyutils.llm.llm_service_manager import llm_service_facade


def _disabled_reason(adapter: LLMEngineAdapter, available: bool) -> Optional[str]:
    """Coded hint when an engine is off (boot block, server down, not installed)."""
    if available:
        return None
    boot_reason = adapter.boot_reason()
    if boot_reason:
        return boot_reason
    if llm_service_facade.contains(adapter.name) and adapter.installed():
        return model_reason(MODEL_REASON_SERVER_NOT_RUNNING, model=adapter.name)
    if not adapter.external:
        return adapter.install_reason()
    return model_reason(MODEL_REASON_SERVER_UNREACHABLE, model=adapter.name)


def _status_row(adapter: LLMEngineAdapter) -> Dict[str, Any]:
    available = adapter.available()
    row = adapter.status_row(available)
    row.update({
        "installed": adapter.installed(),
        "base_url": adapter.base_url,
        "default_model": adapter.default_model,
    })
    row.update(llm_service_facade.runtime_status(adapter.name))
    row.update(message_fields(_disabled_reason(adapter, available), "disabled_reason"))
    return row


def llm_status() -> Dict[str, Any]:
    """Availability panel for the UI (no chat run), plus the managed options."""
    settings = llm_service_facade.settings(refresh=False)
    rows = [
        _status_row(adapter)
        for adapter in (llm_engine_registry.get(name) for name in llm_engine_registry.priority())
        if adapter is not None
    ]
    return build_engine_panel(
        rows,
        auto_manage=bool(settings.get("llm_auto_manage", True)),
        single_active=bool(settings.get("llm_single_active", True)),
        idle_shutdown_s=int(settings.get("llm_idle_shutdown_s", 180)),
    )


def chat(
    messages: List[Dict[str, Any]],
    engine: Optional[str] = None,
    model: Optional[str] = None,
    temperature: float = 0.3,
) -> Dict[str, Any]:
    """Run one chat completion on the best available local engine.

    Walks the priority chain (or the single requested ``engine``). Each call
    acquires one managed-service lease; on failure the next engine is tried. Returns
    ``{success, provider: "local", engine, model, text, error}`` — success=False
    with a clear error when no local engine works (caller falls back to
    OpenRouter)."""
    candidates = [engine] if engine else list(llm_engine_registry.priority())
    tried: List[str] = []
    last_error: Optional[str] = None
    for name in candidates:
        adapter = llm_engine_registry.get(name)
        if adapter is None or not llm_service_facade.contains(name):
            last_error = f"unknown llm engine: {name}"
            continue
        if adapter.boot_blocked():
            last_error = f"{name}: blocked - {adapter.boot_reason()}"
            continue
        use_model = (model or "").strip() or adapter.default_model
        tried.append(name)
        try:
            with managed_services.lease(name):
                res = chat_completion_raw(
                    messages,
                    base=adapter.base_url,
                    model=use_model,
                    temperature=temperature,
                )
        except Exception as exc:  # noqa: BLE001 - lease/start boundary; try the next engine
            last_error = f"{name}: {exc}"
            ColorPrint.yellow(f"[llm] {name} unavailable ({exc}); trying next engine")
            continue
        if res.get("success"):
            return {
                "success": True,
                "provider": "local",
                "engine": name,
                "model": use_model,
                "text": res.get("text") or "",
                "error": None,
            }
        last_error = f"{name}: {res.get('error')}"
        ColorPrint.yellow(f"[llm] {name} failed ({res.get('error')}); trying next engine")
    return {
        "success": False,
        "provider": "local",
        "engine": None,
        "model": model,
        "text": "",
        "error": last_error or "No local LLM engine available",
        "tried": tried,
    }


__all__ = ["chat", "llm_status"]
