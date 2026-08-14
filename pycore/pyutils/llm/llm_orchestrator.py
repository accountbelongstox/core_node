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
from pycore.pyutils.common.managed_service import managed_services
from pycore.pyutils.llm.llm_engines import (
    chat_completion_raw,
    engine_priority,
    llm_engine_registry,
)
from pycore.pyutils.llm.llm_service_manager import (
    get_server_settings,
    is_llm_engine,
    server_runtime_status,
)


def engine_available(name: str) -> bool:
    adapter = llm_engine_registry.get(name)
    return bool(adapter and adapter.healthy())


def best_engine() -> Optional[str]:
    for name in engine_priority():
        if engine_available(name):
            return name
    return None


def _engine_disabled_reason(
    name: str,
    available: Optional[bool] = None,
) -> Optional[str]:
    """UI hint when an engine is off (not installed, or server down)."""
    is_available = engine_available(name) if available is None else available
    if is_available:
        return None
    adapter = llm_engine_registry.get(name)
    if is_llm_engine(name) and adapter and adapter.installed():
        return "server not running (auto-start on use when enabled)"
    if name == "ollama":
        return "ollama binary not found — install Ollama"
    return "external server not reachable — start it manually"


def llm_status() -> Dict[str, Any]:
    """Availability snapshot for the UI (no chat run). Same panel shape as
    tts_status(): success/best/active/available_count/engines[]."""
    engines: List[Dict[str, Any]] = []
    for i, name in enumerate(engine_priority()):
        adapter = llm_engine_registry.get(name)
        if adapter is None:
            continue
        avail = adapter.healthy()
        entry: Dict[str, Any] = {
            "name": name,
            "priority": i + 1,
            "available": avail,
            "installed": adapter.installed(),
            "note": adapter.note,
            "base_url": adapter.base_url,
            "default_model": adapter.default_model,
        }
        entry.update(server_runtime_status(name))
        reason = _engine_disabled_reason(name, avail)
        if reason:
            entry["disabled_reason"] = reason
        engines.append(entry)
    avail_count = sum(1 for e in engines if e["available"])
    best = next((e["name"] for e in engines if e["available"]), None)
    settings = get_server_settings()
    return {
        "success": True,
        "best": best,
        "active": best,
        "available_count": avail_count,
        "engines": engines,
        "auto_manage": bool(settings.get("llm_auto_manage", True)),
        "single_active": bool(settings.get("llm_single_active", True)),
        "idle_shutdown_s": int(settings.get("llm_idle_shutdown_s", 180)),
    }


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
    candidates = [engine] if engine else list(engine_priority())
    tried: List[str] = []
    last_error: Optional[str] = None
    for name in candidates:
        adapter = llm_engine_registry.get(name)
        if adapter is None or not is_llm_engine(name):
            last_error = f"unknown llm engine: {name}"
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
        except Exception as exc:  # noqa: BLE001
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


__all__ = [
    "engine_available",
    "best_engine",
    "llm_status",
    "chat",
]
