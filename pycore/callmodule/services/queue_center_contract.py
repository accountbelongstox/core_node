# -*- coding: utf-8 -*-
"""Dependency-neutral Queue Center catalog and scheduler metadata."""

from typing import Any, Dict, List, Tuple

from pycore.callmodule.callmodule_config import Config
from pycore.callmodule.services.translation_worker import get_translation_worker_service


CALLBACK_QUEUE_ROLES: Dict[str, str] = {
    "translation_worker": "consumer",
    "translation_queue_monitor": "monitor",
    "translation_ws_client": "signal",
    "tts_queue_poller": "consumer",
    "tts_sentence_worker": "consumer",
    "ai_rate_reset": "maintainer",
    "agent_history_extraction": "maintainer",
}

QUEUE_CATEGORY_CATALOG: List[Dict[str, str]] = [
    {"key": "word_translation", "label": "Word Translation", "handler": "any"},
    {"key": "ai_translate", "label": "AI Translate", "handler": "any"},
    {"key": "word_media", "label": "Word Media", "handler": "chrome"},
    {"key": "word_audio", "label": "Word Audio", "handler": "pycore"},
    {"key": "sentence_audio", "label": "Sentence Audio", "handler": "pycore"},
    {"key": "subtitle_search", "label": "Subtitle Search", "handler": "pycore"},
    {"key": "poster", "label": "Poster", "handler": "chrome"},
    {"key": "gemini_image", "label": "Gemini Image", "handler": "chrome"},
    {"key": "notebooklm", "label": "NotebookLM", "handler": "chrome"},
    {"key": "gemini_chat", "label": "Gemini Chat", "handler": "chrome"},
]

QUEUE_COUNT_KEYS: Tuple[str, ...] = ("pending", "processing", "leased", "total")


def build_fast_lane() -> Dict[str, Any]:
    """Build the shared Laravel fast-lane worker status block."""
    worker = get_translation_worker_service(
        laravel_api_url=Config.LARAVEL_WORKER_API_URL,
    )
    raw: Dict[str, Any] = {}
    getter = getattr(worker, "get_queue_status", None)
    if callable(getter):
        try:
            result = getter()
            if isinstance(result, dict):
                raw = result
        except Exception:
            raw = {}
    status = worker.get_status()
    return {
        "capabilities": raw.get("capabilities", status.get("capabilities", [])),
        "processor_types": raw.get("processor_types", status.get("processor_types", [])),
        "queue_depth": raw.get("queue_depth", status.get("inflight_tasks", 0)),
        "pending_fast": raw.get("pending_fast", 0),
        "pending_urgent": raw.get("pending_urgent", 0),
        "registered": raw.get("registered", status.get("registered", False)),
    }
