# -*- coding: utf-8 -*-
"""STT status application service."""

from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
import pycore.pyctl.ai.speech_history as speech_history
from pycore.pyutils.stt.stt_orchestrator import stt_status as orchestrator_status, stt_test as orchestrator_test


def status():
    """STT engine availability + priority snapshot."""
    return orchestrator_status()


def test(params: Optional[Dict[str, Any]] = None):
    """Live recognition test for ONE engine (or the best available)."""
    p = params or {}
    ColorPrint.yellow("[DEPRECATED] HTTP POST /api/local/stt/test — use WS route local.stt.test")
    result = orchestrator_test(
        engine=p.get("engine"),
        language=str(p.get("language") or "en"),
        text=p.get("text"),
    )
    try:
        entry = speech_history.record_test_result("stt", result, source="stt-test")
        if entry:
            result["record_id"] = entry["id"]
    except Exception as e:  # noqa: BLE001 — history is best-effort
        ColorPrint.yellow(f"[stt] could not record test audio: {e}")
    return result
