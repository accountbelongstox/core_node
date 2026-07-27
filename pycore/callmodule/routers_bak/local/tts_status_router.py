# -*- coding: utf-8 -*-
"""
TTS status router.

Endpoints (prefix /api/local/tts):
  GET  /status[?refresh=1]  -> live edge-tts availability + version.
  POST /test                -> live synth for ONE engine (not /api/local/ai/*).
  GET  /settings            -> synth timeout + managed server options.
  POST /settings            -> persist TTS tuning.
  POST /server              -> start/stop ONE subprocess TTS API server.

AI chat/image routes live under /api/local/ai/* — do not reuse them for TTS tests.
STT/OCR mirrors: /api/local/stt/test, /api/local/ocr/test.

The edge endpoint periodically returns HTTP 403 (rate-limit / regional block).
This route does a REAL synth round-trip to report whether TTS actually works
right now, so the Voice & Subtitle page can show it red when it is down. The
result is cached ~60s in the client (each test counts against rate limits);
?refresh=1 forces a fresh test.
"""

import fastapi
from typing import Any, Dict, Optional
from pydantic import BaseModel

from pycore import ColorPrint, get_user_data_store
from pycore.pyutils.edge_tts.edge_tts_client import (
    get_edge_tts_client,
    get_synth_timeout,
    set_synth_timeout,
)
from pycore.pyctl.ai import speech_history
from pycore.pyutils.common.api_secrets import streamelements_key_present
from pycore.pyutils.tts import tts_status as orchestrator_status
from pycore.pyutils.tts.tts_orchestrator import (
    get_edge_cooldown_seconds,
    set_edge_cooldown_seconds,
    tts_test as orchestrator_test,
)
from pycore.pyutils.tts.tts_service_manager import (
    apply_server_settings,
    get_server_settings,
    is_server_engine,
    set_engine_enabled,
    start_server,
    stop_server,
)

router = fastapi.APIRouter(prefix="/api/local/tts", tags=["Local Processing - TTS"])

# Settings-adjustable TTS tuning is persisted in user_data.json under this section
# and re-applied to the engines on import, so a saved override survives restarts.
_TTS_SECTION = "tts"


def _load_persisted_tts_settings() -> None:
    """Apply persisted synth timeout / edge cooldown to the engines (best-effort)."""
    try:
        section = get_user_data_store().get_section(_TTS_SECTION) or {}
    except Exception:
        return
    if section.get("synth_timeout_s") is not None:
        set_synth_timeout(section["synth_timeout_s"])
    if section.get("edge_cooldown_s") is not None:
        set_edge_cooldown_seconds(section["edge_cooldown_s"])


_load_persisted_tts_settings()


@router.get("/status")
def status(refresh: int = 0):
    """
    TTS status: the live edge-tts probe (version/availability) PLUS the
    multi-engine orchestrator's priority/availability (chattts -> cosyvoice ->
    gptsovits -> f5tts -> melotts -> sherpa -> edge -> …).

    Returns:
        { success,
          providers: [ {name, available, version, proxy, error, cached} ],   # edge live
          best: str|None,
          engines: [ {name, priority, available, note} ] }                   # orchestrator
    """
    client = get_edge_tts_client()
    # A live edge probe is a real synth round-trip that can hang for seconds
    # (403 rate-limiting). The periodic status poll must stay fast, so it only
    # PEEKS the last cached result; the user's Refresh button (refresh=1) forces
    # a fresh live probe. The orchestrator snapshot below is purely local.
    if refresh:
        edge = client.test_availability(force=True)
    else:
        edge = client.peek_availability()
        if edge is None:
            # Cold/stale cache: fill it in the background so the NEXT poll has a
            # real result, without blocking this request on a network synth.
            client.ensure_background_probe()
    edge = edge or {"available": None, "version": None, "proxy": False,
                    "error": None, "cached": False, "pending": True}
    orch = orchestrator_status()
    engines = list(orch.get("engines") or [])
    for entry in engines:
        if entry.get("name") != "edge":
            continue
        entry["version"] = edge.get("version") or entry.get("version")
        entry["live_available"] = edge.get("available")
        entry["proxy"] = edge.get("proxy", False)
        entry["probe_error"] = edge.get("error")
        entry["probe_cached"] = edge.get("cached", False)
        entry["probe_pending"] = edge.get("pending", False)
        break
    return {
        "success": True,
        # Deprecated: edge live probe is merged into engines[].name=="edge".
        "providers": [
            {
                "name": "edge",
                "available": edge.get("available", False),
                "version": edge.get("version"),
                "proxy": edge.get("proxy", False),
                "error": edge.get("error"),
                "cached": edge.get("cached", False),
                "pending": edge.get("pending", False),
            }
        ],
        "best": orch.get("best"),
        # The engine the NEXT synth would actually use (honours the edge cooldown).
        "active": orch.get("active"),
        # Seconds left on the edge-tts failure cooldown (0 = not cooling). When > 0,
        # synthesis is falling back to the offline engine until it elapses.
        "edge_cooldown_remaining": orch.get("edge_cooldown_remaining", 0),
        # Whether STREAMELEMENTS_API_KEY exists in .secret_keys (value never returned).
        "streamelements_key_present": streamelements_key_present(),
        # Per-engine: name, priority, available, note, version (+ edge live probe).
        "engines": engines,
    }


class _TtsTestReq(BaseModel):
    engine: Optional[str] = None
    text: Optional[str] = None
    language: str = "en"
    rate: Optional[str] = None


@router.post("/test")
def test(req: _TtsTestReq):
    """DEPRECATED: use WS route ``local.tts.test`` instead.
    Live synth test for ONE engine (or the best available): actually runs the
    engine and reports {success, engine, latency_ms, bytes, error}. The produced
    audio is persisted to the shared speech history (record id echoed back)."""
    ColorPrint.yellow("[DEPRECATED] HTTP POST /api/local/tts/test — use WS route local.tts.test")
    result = orchestrator_test(engine=req.engine, text=req.text, language=req.language, rate=req.rate)
    try:
        entry = speech_history.record_test_result("tts", result, source="tts-test")
        if entry:
            result["record_id"] = entry["id"]
    except Exception as e:  # noqa: BLE001 — history is best-effort
        ColorPrint.yellow(f"[tts] could not record test audio: {e}")
    return result


class _TtsSettingsPatch(BaseModel):
    synth_timeout_s: Optional[float] = None
    edge_cooldown_s: Optional[float] = None
    server_auto_manage: Optional[bool] = None
    server_single_active: Optional[bool] = None
    server_idle_shutdown_s: Optional[int] = None
    server_enabled: Optional[Dict[str, bool]] = None


class _TtsServerAction(BaseModel):
    engine: str
    enabled: Optional[bool] = None
    start: Optional[bool] = None


@router.get("/settings")
def get_settings():
    """Current Settings-adjustable TTS tuning + managed local server options."""
    srv = get_server_settings()
    return {
        "success": True,
        "synth_timeout_s": get_synth_timeout(),
        "edge_cooldown_s": get_edge_cooldown_seconds(),
        "server_auto_manage": srv.get("server_auto_manage"),
        "server_single_active": srv.get("server_single_active"),
        "server_idle_shutdown_s": srv.get("server_idle_shutdown_s"),
        "server_enabled": srv.get("server_enabled"),
    }


@router.post("/settings")
def post_settings(req: _TtsSettingsPatch):
    """Update + persist synth timeout / edge cooldown / managed server options."""
    patch = {}
    if req.synth_timeout_s is not None:
        patch["synth_timeout_s"] = set_synth_timeout(req.synth_timeout_s)
    if req.edge_cooldown_s is not None:
        patch["edge_cooldown_s"] = set_edge_cooldown_seconds(req.edge_cooldown_s)
    if patch:
        try:
            section = get_user_data_store().get_section(_TTS_SECTION) or {}
            section.update(patch)
            get_user_data_store().set_section(_TTS_SECTION, section)
        except Exception as e:
            ColorPrint.yellow(f"[tts] failed to persist tts settings: {e}")
    server_patch: Dict[str, Any] = {}
    if req.server_auto_manage is not None:
        server_patch["server_auto_manage"] = req.server_auto_manage
    if req.server_single_active is not None:
        server_patch["server_single_active"] = req.server_single_active
    if req.server_idle_shutdown_s is not None:
        server_patch["server_idle_shutdown_s"] = req.server_idle_shutdown_s
    if req.server_enabled is not None:
        server_patch["server_enabled"] = req.server_enabled
    srv = apply_server_settings(server_patch) if server_patch else get_server_settings()
    return {
        "success": True,
        "synth_timeout_s": get_synth_timeout(),
        "edge_cooldown_s": get_edge_cooldown_seconds(),
        "server_auto_manage": srv.get("server_auto_manage"),
        "server_single_active": srv.get("server_single_active"),
        "server_idle_shutdown_s": srv.get("server_idle_shutdown_s"),
        "server_enabled": srv.get("server_enabled"),
    }


@router.post("/server")
def post_server_action(req: _TtsServerAction):
    """Enable/disable or start/stop ONE managed local TTS server engine."""
    engine = (req.engine or "").strip().lower()
    if not is_server_engine(engine):
        return {"success": False, "error": f"Unknown server engine: {req.engine}"}
    try:
        if req.enabled is not None:
            out = set_engine_enabled(engine, bool(req.enabled), start_now=bool(req.start))
            return out
        if req.start is True:
            return start_server(engine)
        if req.start is False:
            return stop_server(engine)
        return get_server_settings()
    except Exception as e:  # noqa: BLE001
        return {"success": False, "error": str(e)}
