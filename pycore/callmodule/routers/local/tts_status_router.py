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

from pycore.pyutils.edge_tts.edge_tts_client import get_edge_tts_client
from pycore.pyutils.tts import tts_status as orchestrator_status

router = fastapi.APIRouter(prefix="/api/local/tts", tags=["Local Processing - TTS"])


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
    edge = client.test_availability(force=bool(refresh))
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
            }
        ],
        "best": orch.get("best"),
        "engines": orch.get("engines", []),
    }
