# -*- coding: utf-8 -*-
"""
Word-dictionary TTS router — auto-start toggle + status + run-once.

Endpoints (prefix /api/local/word-tts):
  GET  /status
  POST /config   { auto_start: bool }
  POST /run-once
"""

import fastapi
from pydantic import BaseModel

from pycore.callmodule.services import get_tts_queue_poller_service
from pycore.callmodule.services.word_tts_auto import apply_auto_start, get_status

router = fastapi.APIRouter(prefix="/api/local/word-tts", tags=["Local Processing - Word TTS"])


class WordTtsConfigRequest(BaseModel):
    auto_start: bool


@router.get("/status")
def status():
    return get_status()


@router.post("/config")
def config(req: WordTtsConfigRequest):
    return apply_auto_start(bool(req.auto_start))


@router.post("/run-once")
def run_once():
    try:
        get_tts_queue_poller_service().poll_and_process()
        return {"ok": True}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
