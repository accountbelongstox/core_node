# -*- coding: utf-8 -*-
"""
STT status router — the speech-to-text mirror of tts_status_router.

Endpoints (prefix /api/local/stt):
  GET  /status   -> multi-engine availability snapshot
                    (faster-whisper -> whisper -> vosk -> azure), Azure quota note.
  POST /test     -> live round-trip test for ONE engine (or the best available):
                    synth a known phrase, recognize it, return {success, engine,
                    text, latency_ms, error, route}.

Distinct from TTS (/api/local/tts/test) and AI (/api/local/ai/*). Shares the
same response shape as /api/local/tts/test and /api/local/ocr/test so the
capability panel renders TTS/STT/OCR identically.
"""

import fastapi
from typing import Optional
from pydantic import BaseModel

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.ai import speech_history
from pycore.pyutils.stt import stt_status as orchestrator_status, stt_test as orchestrator_test

router = fastapi.APIRouter(prefix="/api/local/stt", tags=["Local Processing - STT"])


@router.get("/status")
def status():
    """STT engine availability + priority (+ Azure free-F0 quota note).

    Returns:
        { success, best, active, available_count,
          engines: [ {name, priority, available, note, quota?} ] }
    """
    return orchestrator_status()


class _SttTestReq(BaseModel):
    engine: Optional[str] = None
    language: str = "en"
    # Optional phrase to synthesize and then recognize (defaults to the
    # orchestrator's sample phrase). Lets the popup test arbitrary text.
    text: Optional[str] = None


@router.post("/test")
def test(req: _SttTestReq):
    """DEPRECATED: use WS route ``local.stt.test`` instead.
    Live recognition test for ONE engine (or the best available). The sample
    clip is persisted to the shared speech history (record id echoed back)."""
    ColorPrint.yellow("[DEPRECATED] HTTP POST /api/local/stt/test — use WS route local.stt.test")
    result = orchestrator_test(engine=req.engine, language=req.language, text=req.text)
    try:
        entry = speech_history.record_test_result("stt", result, source="stt-test")
        if entry:
            result["record_id"] = entry["id"]
    except Exception as e:  # noqa: BLE001 — history is best-effort
        ColorPrint.yellow(f"[stt] could not record test audio: {e}")
    return result
