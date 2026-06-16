# -*- coding: utf-8 -*-
"""
TTS status router.

Endpoints (prefix /api/local/tts):
  GET /status[?refresh=1]  -> live edge-tts availability + version.

The edge endpoint periodically returns HTTP 403 (rate-limit / regional block).
This route does a REAL synth round-trip to report whether TTS actually works
right now, so the Voice & Subtitle page can show it red when it is down. The
result is cached ~60s in the client (each test counts against rate limits);
?refresh=1 forces a fresh test.
"""

import fastapi
from typing import Optional
from pydantic import BaseModel

from pycore import ColorPrint, get_user_data_store
from pycore.pyutils.edge_tts.edge_tts_client import (
    get_edge_tts_client,
    get_synth_timeout,
    set_synth_timeout,
)
from pycore.pyutils.tts import tts_status as orchestrator_status
from pycore.pyutils.tts.tts_orchestrator import (
    get_edge_cooldown_seconds,
    set_edge_cooldown_seconds,
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
    multi-engine orchestrator's priority/availability (edge -> sherpa -> melotts
    -> gptsovits).

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
    return {
        "success": True,
        "providers": [
            {
                "name": "edge",
                "available": edge.get("available", False),
                "version": edge.get("version"),
                "proxy": edge.get("proxy", False),
                "error": edge.get("error"),
                "cached": edge.get("cached", False),
                # True until the first live probe has populated the cache.
                "pending": edge.get("pending", False),
            }
        ],
        "best": orch.get("best"),
        # The engine the NEXT synth would actually use (honours the edge cooldown).
        "active": orch.get("active"),
        # Seconds left on the edge-tts failure cooldown (0 = not cooling). When > 0,
        # synthesis is falling back to the offline engine until it elapses.
        "edge_cooldown_remaining": orch.get("edge_cooldown_remaining", 0),
        # Per-engine: name, priority, available, note (+ cooldown_remaining on edge).
        "engines": orch.get("engines", []),
    }


class _TtsSettingsPatch(BaseModel):
    synth_timeout_s: Optional[float] = None
    edge_cooldown_s: Optional[float] = None


@router.get("/settings")
def get_settings():
    """Current Settings-adjustable TTS tuning (per-attempt synth timeout + edge cooldown)."""
    return {
        "success": True,
        "synth_timeout_s": get_synth_timeout(),
        "edge_cooldown_s": get_edge_cooldown_seconds(),
    }


@router.post("/settings")
def post_settings(req: _TtsSettingsPatch):
    """Update + persist the synth timeout / edge cooldown. Applied immediately (and
    survives restart via the user_data 'tts' section). Values are clamped by the
    engine setters (timeout 5–120s, cooldown 0–3600s)."""
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
    return {
        "success": True,
        "synth_timeout_s": get_synth_timeout(),
        "edge_cooldown_s": get_edge_cooldown_seconds(),
    }
