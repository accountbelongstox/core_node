# -*- coding: utf-8 -*-
"""
Engine model-load status router — the UNIFIED progress surface for EVERY speech
engine load, class-B in-process models and class-C HTTP servers, TTS and STT.

Endpoint (prefix /api/local/engines):
  GET /load-status -> { success, engines: { <name>: {state, message, device,
                       started_at, updated_at, elapsed_ms, log_tail:[...] } } }

`state` is one of idle | loading | loaded | error. An engine that has never been
asked to load is simply absent from the map.

Source of truth: pycore/pyutils/common/model_load_status.py, written from ONE
place per engine class — class-C servers report from managed_service (subprocess
start -> health), class-B models from the TTS/STT orchestrators (first synth /
transcribe). Each state change is ALSO best-effort broadcast over the rpc_v2
WS/SSE bus ('engine_load_status_update'); this polled endpoint is authoritative.

Mirrors the TTS/STT status routers so the capability UI can render load progress
alongside availability. See TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md
'Model-load progress'.
"""

import fastapi

from pycore.pyutils.common import model_load_status
from pycore.pyutils.common.managed_service import managed_services

router = fastapi.APIRouter(prefix="/api/local/engines", tags=["Local Processing - Engines"])


@router.get("/load-status")
def load_status():
    """Live model-load progress for every engine that has reported a load.

    For a class-C server still in the `loading` state the per-service log tail is
    refreshed ON DEMAND here (the registry only snapshots it at the terminal
    loaded/error transitions), so a long subprocess startup shows live progress.

    Returns:
        { success, engines: { <name>: {state, message, device, started_at,
          updated_at, elapsed_ms, log_tail} } }
    """
    engines = model_load_status.snapshot()
    for name, entry in engines.items():
        if entry.get("state") == "loading":
            tail = managed_services.read_log_tail(name)
            if tail:
                entry["log_tail"] = tail
    return {"success": True, "engines": engines}
