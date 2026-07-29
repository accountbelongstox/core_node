# -*- coding: utf-8 -*-
"""Heartbeat workers status + auxiliary toggles."""

from typing import Any, Dict, List

from pycore.pyheartbeat.heartbeat import get_heartbeat_system
from pycore.callmodule.services.queue_center_contract import CALLBACK_QUEUE_ROLES
from pycore.callmodule.services.heartbeat_worker_prefs import (
    apply_callback_enabled,
    get_auxiliary_status,
)
from pycore.callmodule.services.sentence_audio_auto import get_status as sentence_audio_status
from pycore.callmodule.services.word_tts_auto import get_status as word_tts_status

_AUX_CALLBACKS = frozenset({"translation_queue_monitor", "translation_ws_client"})


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


def status():
    aux = get_auxiliary_status()
    return {
        "success": True,
        "callbacks": _callback_rows(),
        "auxiliary": aux,
        "word_tts": word_tts_status(),
        "sentence_audio": sentence_audio_status(),
    }


def config(callback_name: str, enabled: bool):
    name = (callback_name or "").strip()
    if name in _AUX_CALLBACKS:
        result = apply_callback_enabled(name, bool(enabled))
        return {"success": bool(result.get("ok")), **result}
    return {
        "success": False,
        "error": f"Use word-tts/config or sentence-audio/config for {name}",
    }
