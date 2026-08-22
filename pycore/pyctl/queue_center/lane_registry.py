# -*- coding: utf-8 -*-
"""Canonical Queue Center lane registry (single source of truth).

Every actor that needs "which heartbeat callback / assist capability / worker
singleton belongs to this Queue Center control" resolves it here instead of
keeping its own hand-maintained table. Consumers: runtime callback
registration (event_handlers), settings->runtime sync (capability_sync), the
control entry point (task_center_service), and the realtime wake path
(snapshot_service).

Worker singletons are bound explicitly so a missing lane fails visibly during
startup instead of being omitted forever after one swallowed import error.
"""

from typing import Any, Dict, Optional

from pycore.pyctl.translation.worker.worker import translation_worker_service
from pycore.pyctl.tts.laravel_audio_worker import (
    laravel_sentence_audio_worker,
    laravel_word_audio_worker,
)

LANE_REGISTRY: Dict[str, Dict[str, Any]] = {
    "assist_translation": {
        "heartbeat_callback": "translation_worker",
        "capability": "translation",
        "worker": translation_worker_service,
    },
    "word_audio": {
        "heartbeat_callback": "tts_queue_poller",
        "capability": "tts",
        "worker": laravel_word_audio_worker,
    },
    "sentence_audio": {
        "heartbeat_callback": "tts_sentence_worker",
        "capability": "sentence_audio",
        "worker": laravel_sentence_audio_worker,
    },
}

LANE_BY_CALLBACK: Dict[str, str] = {
    entry["heartbeat_callback"]: control
    for control, entry in LANE_REGISTRY.items()
}


def lane_worker(control_name: str) -> Optional[Any]:
    """Return one explicitly registered lane worker singleton."""
    entry = LANE_REGISTRY.get(str(control_name or ""))
    return entry.get("worker") if entry else None


def lane_capability(control_name: str) -> str:
    entry = LANE_REGISTRY.get(str(control_name or ""))
    return str(entry["capability"]) if entry else ""


def lane_callback_name(control_name: str) -> str:
    entry = LANE_REGISTRY.get(str(control_name or ""))
    return str(entry["heartbeat_callback"]) if entry else ""


__all__ = [
    "LANE_BY_CALLBACK",
    "LANE_REGISTRY",
    "lane_callback_name",
    "lane_capability",
    "lane_worker",
]
