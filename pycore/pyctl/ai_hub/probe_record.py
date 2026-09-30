# -*- coding: utf-8 -*-
"""Turns one raw test result into exactly one hub history record.

Leaf module: the legacy per-category test entry points and the hub runner both
call ``record_result`` so every test lands in one record stream.
"""

import time
from typing import Any, Dict, Optional

from pycore.pyctl.ai import ai_image_history
from pycore.pyctl.ai_hub import manifest_loader, probe_history
from pycore.pyutils.common.model_manifest import (
    CATEGORY_AI_IMAGE,
    CATEGORY_STT,
    CATEGORY_TRANSLATE,
    CATEGORY_TTS,
    model_key,
)

REF_SPEECH = "speech_history"
REF_IMAGE = "image_history"
IMAGE_REF_WINDOW_S = 5.0


def result_ok(result: Any) -> bool:
    return isinstance(result, dict) and bool(result.get("success", True)) and not result.get("error")


def _summary(category: str, result: Dict[str, Any]) -> str:
    if category == CATEGORY_AI_IMAGE:
        return str(result.get("model") or result.get("mime") or "image")
    if category == CATEGORY_TRANSLATE:
        return str(result.get("translated_text") or result.get("text") or "")
    if category == CATEGORY_TTS:
        return str(result.get("text") or result.get("path") or result.get("engine") or "")
    return str(result.get("text") or result.get("model") or result.get("engine") or "")


def _result_ref(category: str, result: Dict[str, Any], started_at: float) -> Optional[Dict[str, Any]]:
    if category in (CATEGORY_TTS, CATEGORY_STT) and result.get("record_id"):
        return {"kind": REF_SPEECH, "id": str(result["record_id"])}
    if category == CATEGORY_AI_IMAGE and result.get("success"):
        latest = ai_image_history.list_history(1)
        if latest and float(latest[0].get("ts") or 0) >= started_at - IMAGE_REF_WINDOW_S:
            return {"kind": REF_IMAGE, "id": str(latest[0].get("id"))}
    return None


def record_result(
    category: str,
    entry_id: str,
    params: Optional[Dict[str, Any]],
    result: Any,
    elapsed_ms: int,
    started_at: Optional[float] = None,
) -> Dict[str, Any]:
    """Persist the record of one finished test and return it."""
    outcome = result if isinstance(result, dict) else {"success": False, "error": "invalid test result"}
    ok = result_ok(outcome)
    entry = manifest_loader.load().get(entry_id, category)
    canonical_id = entry.id if entry is not None else str(entry_id)
    return probe_history.record(
        key=model_key(category, canonical_id),
        entry_id=canonical_id,
        category=category,
        ok=ok,
        elapsed_ms=elapsed_ms,
        summary=_summary(category, outcome),
        params=params,
        result_ref=_result_ref(category, outcome, started_at or time.time() - elapsed_ms / 1000.0),
        error=None if ok else (outcome.get("error") or "test failed"),
    )


__all__ = ["record_result", "result_ok"]
