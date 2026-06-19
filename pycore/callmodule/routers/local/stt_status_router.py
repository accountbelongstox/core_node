# -*- coding: utf-8 -*-
"""
STT status router — the speech-to-text mirror of tts_status_router.

Endpoints (prefix /api/local/stt):
  GET  /status   -> multi-engine availability snapshot
                    (faster-whisper -> whisper -> vosk -> azure), Azure quota note.
  POST /test     -> live round-trip test for ONE engine (or the best available):
                    synth a known phrase, recognize it, return {success, engine,
                    text, latency_ms, error}.

Shares ONE status/test contract with /api/local/tts and /api/local/ocr so the
capability panel renders TTS/STT/OCR identically.
"""

import fastapi
from typing import Optional
from pydantic import BaseModel

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


@router.post("/test")
def test(req: _SttTestReq):
    """Live recognition test for ONE engine (or the best available)."""
    return orchestrator_test(engine=req.engine, language=req.language)
