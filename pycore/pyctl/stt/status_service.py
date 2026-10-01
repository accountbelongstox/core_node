# -*- coding: utf-8 -*-
"""STT test application service (records the round trip in the speech history)."""

from typing import Any, Dict, Optional

import pycore.pyctl.ai.speech_history as speech_history
from pycore.pyctl.stt.probe_service import test as probe_test


def test(params: Optional[Dict[str, Any]] = None):
    """Live recognition test for ONE engine (or the best available)."""
    request = params or {}
    result = probe_test(
        engine=request.get("engine"),
        language=str(request.get("language") or "en"),
        text=request.get("text"),
    )
    entry = speech_history.record_test_result("stt", result, source="stt-test")
    if entry:
        result["record_id"] = entry["id"]
    return result
