# -*- coding: utf-8 -*-
"""Apply persisted Assist user settings to canonical queue workers."""

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.laravel.endpoint_manager import (
    laravel_endpoint_manager,
)
from pycore.pyctl.translation.worker.worker import translation_worker_service
from pycore.pyctl.tts.laravel_audio_worker import (
    laravel_sentence_audio_worker,
    laravel_word_audio_worker,
)


def resolve_selected_endpoint_for_ui(*, monitor_reachable: bool = False) -> Optional[Dict[str, Any]]:
    """Fast resolver for hot HTTP status paths — reuses monitor's active URL when up."""
    try:
        manager = laravel_endpoint_manager
        stored = manager.peek_stored_base_url()
        if monitor_reachable:
            base = manager.get_active_base_url()
            label = "active" if base != stored else "selected"
        else:
            base = manager.resolve_for_ui(skip_probe=True)
            label = "stored" if base == stored else "active"
        if not base:
            return None
        return {"base_url": base, "label": label, "stored_url": stored}
    except Exception as e:  # noqa: BLE001 — resolver must never kill a cycle
        ColorPrint.yellow(f"[AssistWiring] UI endpoint resolution failed: {e}")
        return None


def bind_selected_endpoint_for_workers(base_url: str) -> Dict[str, Any]:
    """Persist a frontend-selected endpoint and update local worker state."""
    normalized = str(base_url or "").strip().rstrip("/")
    if not normalized:
        return {"success": False, "error": "LARAVEL_ENDPOINT_REQUIRED"}
    selected = laravel_endpoint_manager.select(normalized, probe=False)
    if not selected.get("success"):
        return selected
    translation_worker_service.on_endpoint_changed(normalized)
    laravel_word_audio_worker.on_endpoint_changed(normalized)
    laravel_sentence_audio_worker.on_endpoint_changed(normalized)
    return {"success": True, "endpoint": normalized}
