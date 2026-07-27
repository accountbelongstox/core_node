# -*- coding: utf-8 -*-
"""
WebSocket client for the isolated Qwen3-TTS API server (FIX V3).

Primary transport for synthesis; health/capabilities may still use HTTP.
"""
from __future__ import annotations

import base64
import json
import threading
import uuid
from typing import Any, Dict, Optional, Tuple

from pycore.pyutils.tts.qwen3tts_engine import base_url

_LOCK = threading.Lock()
_TIMEOUT_S = float(__import__("os").environ.get("QWEN3TTS_WS_TIMEOUT_S", "900") or "900")


def ws_url() -> str:
    http = base_url()
    if http.startswith("https://"):
        return "wss://" + http[len("https://") :] + "/ws"
    if http.startswith("http://"):
        return "ws://" + http[len("http://") :] + "/ws"
    return f"ws://{http}/ws"


def _call(op: str, params: Dict[str, Any], timeout: float = _TIMEOUT_S) -> Dict[str, Any]:
    try:
        from websocket import create_connection
    except ImportError as exc:
        return {"ok": False, "error": f"websocket-client unavailable: {exc}"}

    req_id = uuid.uuid4().hex
    payload = {"op": op, "id": req_id, "params": params or {}}
    ws = None
    try:
        ws = create_connection(ws_url(), timeout=timeout)
        ws.send(json.dumps(payload, ensure_ascii=False))
        raw = ws.recv()
        if not raw:
            return {"ok": False, "error": "empty websocket response"}
        resp = json.loads(raw)
        if not isinstance(resp, dict):
            return {"ok": False, "error": "malformed websocket response"}
        if resp.get("id") != req_id:
            return {"ok": False, "error": "websocket response id mismatch"}
        return resp
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)}
    finally:
        if ws is not None:
            try:
                ws.close()
            except Exception:  # noqa: BLE001
                pass


def ws_synthesize(payload: Dict[str, Any]) -> Tuple[bool, bytes, Optional[str]]:
    resp = _call("synthesize", payload)
    if not resp.get("ok"):
        return False, b"", str(resp.get("error") or "qwen3tts websocket synthesize failed")
    audio_b64 = resp.get("audio_base64")
    if not audio_b64:
        return False, b"", "missing audio_base64 in websocket response"
    try:
        return True, base64.b64decode(str(audio_b64)), None
    except (ValueError, TypeError) as exc:
        return False, b"", str(exc)


def ws_synthesize_batch(payload: Dict[str, Any]) -> Tuple[bool, Any, Optional[str]]:
    resp = _call("synthesize_batch", payload)
    if not resp.get("ok"):
        return False, None, str(resp.get("error") or "qwen3tts websocket batch failed")
    body = resp.get("data")
    if not isinstance(body, dict):
        return False, None, "malformed batch websocket response"
    return True, body, None


__all__ = ["ws_url", "ws_synthesize", "ws_synthesize_batch"]
