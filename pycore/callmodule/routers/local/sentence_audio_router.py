# -*- coding: utf-8 -*-
"""
Sentence-audio router — auto-start toggle + status + run-once.

Endpoints (prefix /api/local/sentence-audio):
  GET  /status
  POST /config   { auto_start: bool }
  POST /run-once
"""

from typing import Optional

import fastapi
from pydantic import BaseModel

from pycore.callmodule.services import get_tts_sentence_worker_service
from pycore.callmodule.services.sentence_audio_auto import apply_auto_start, get_status

router = fastapi.APIRouter(prefix="/api/local/sentence-audio", tags=["Local Processing - Sentence Audio"])


class SentenceAudioConfigRequest(BaseModel):
    auto_start: bool


@router.get("/status")
def status():
    return get_status()


@router.post("/config")
def config(req: SentenceAudioConfigRequest):
    return apply_auto_start(bool(req.auto_start))


@router.post("/run-once")
def run_once():
    """Trigger one claim+synth cycle immediately (manual assist)."""
    try:
        get_tts_sentence_worker_service().poll_and_process()
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
