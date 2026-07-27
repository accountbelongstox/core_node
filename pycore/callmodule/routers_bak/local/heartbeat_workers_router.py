# -*- coding: utf-8 -*-
"""
Heartbeat workers router — unified worker status + auxiliary toggles.

Endpoints (prefix /api/local/heartbeat-workers):
  GET  /status
  POST /config   { callback_name: str, enabled: bool }
"""

from typing import Any, Dict, List

import fastapi
from pydantic import BaseModel

from pycore.pyheartbeat import get_heartbeat_system
from pycore.callmodule.services.queue_center_contract import CALLBACK_QUEUE_ROLES
from pycore.callmodule.services.heartbeat_worker_prefs import (
    apply_callback_enabled,
    get_auxiliary_status,
)
from pycore.callmodule.services.sentence_audio_auto import get_status as sentence_audio_status
from pycore.callmodule.services.word_tts_auto import get_status as word_tts_status

router = fastapi.APIRouter(
    prefix="/api/local/heartbeat-workers",
    tags=["Local Processing - Heartbeat Workers"],
)

_AUX_CALLBACKS = frozenset({"translation_queue_monitor", "translation_ws_client"})


class HeartbeatWorkerConfigRequest(BaseModel):
    callback_name: str
    enabled: bool


def _callback_rows() -> List[Dict[str, Any]]:
    heartbeat = get_heartbeat_system()
    stats = heartbeat.get_stats()
    raw = (stats.get("heartbeat") or {}).get("callbacks") or {}
    rows: List[Dict[str, Any]] = []
    for name, info in sorted(raw.items()):
        rows.append({
            "name": name,
            "enabled": bool(info.get("enabled")),
            "interval": int(info.get("interval") or 0),
            "run_count": int(info.get("run_count") or 0),
            "queue_role": CALLBACK_QUEUE_ROLES.get(name),
        })
    return rows


@router.get("/status")
def status():
    aux = get_auxiliary_status()
    return {
        "success": True,
        "callbacks": _callback_rows(),
        "auxiliary": aux,
        "word_tts": word_tts_status(),
        "sentence_audio": sentence_audio_status(),
    }


@router.post("/config")
def config(req: HeartbeatWorkerConfigRequest):
    name = (req.callback_name or "").strip()
    if name in _AUX_CALLBACKS:
        result = apply_callback_enabled(name, bool(req.enabled))
        return {"success": bool(result.get("ok")), **result}
    return {
        "success": False,
        "error": f"Use /api/local/word-tts/config or /api/local/sentence-audio/config for {name}",
    }
