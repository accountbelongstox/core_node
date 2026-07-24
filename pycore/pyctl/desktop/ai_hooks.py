# -*- coding: utf-8 -*-
"""
AI hooks for the desktop voice-subtitle pipelines (dependency injection point).

pyctl/* packages must not import sibling pyctl/* packages, so the desktop
pipelines (processor, background_services) cannot import pycore.pyctl.ai
directly. Instead they call THESE hooks, and the APP layer (callmodule) injects
the unified AI gateway at startup:

    from pycore.pyctl.ai import generate_text, describe_image
    from pycore.pyctl.desktop.ai_hooks import set_ai_handlers
    set_ai_handlers(text_handler=generate_text, image_handler=describe_image)

Both handlers use the gateway's unified contract:
    { success, provider, model, text, latency_ms, error }
The ``source`` kwarg labels the task in the gateway records so the UI can show
which AI handled it. Until handlers are injected, calls return a clear error
instead of silently falling back to a hardcoded provider — the gateway is the
ONLY AI exit.
"""

from typing import Any, Callable, Dict, Optional

from pycore import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedValue

_AI_HANDLERS = SerializedValue(
    (None, None),
    "DesktopAIHandlersStateThread",
)


def set_ai_handlers(
    text_handler: Optional[Callable[..., Dict[str, Any]]] = None,
    image_handler: Optional[Callable[..., Dict[str, Any]]] = None,
) -> None:
    """Inject the unified AI gateway functions (called once at app startup)."""
    current_text_handler, current_image_handler = _AI_HANDLERS.get()
    next_text_handler = text_handler or current_text_handler
    next_image_handler = image_handler or current_image_handler
    _AI_HANDLERS.set((next_text_handler, next_image_handler))
    ColorPrint.green(
        f"[ai_hooks] AI handlers wired (text={next_text_handler is not None}, "
        f"image={next_image_handler is not None})")


def _not_wired() -> Dict[str, Any]:
    return {
        "success": False, "provider": "", "model": "", "text": "",
        "latency_ms": None,
        "error": "AI gateway not wired (set_ai_handlers was never called)",
    }


def ai_generate_text(prompt: str, source: str = "") -> Dict[str, Any]:
    """Text generation through the injected gateway (prompt passed unchanged)."""
    text_handler, _ = _AI_HANDLERS.get()
    if text_handler is None:
        return _not_wired()
    return text_handler(prompt=prompt, source=source)


def ai_describe_image(image_path: str, prompt: Optional[str] = None, source: str = "") -> Dict[str, Any]:
    """Image description through the injected gateway."""
    _, image_handler = _AI_HANDLERS.get()
    if image_handler is None:
        return _not_wired()
    return image_handler(image_path=image_path, prompt=prompt, source=source)


__all__ = ["set_ai_handlers", "ai_generate_text", "ai_describe_image"]
