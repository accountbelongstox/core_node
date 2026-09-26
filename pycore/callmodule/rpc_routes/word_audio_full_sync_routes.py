# -*- coding: utf-8 -*-
"""RPC entries for the audio-lane full pull (on-demand backlog mirror).

Routing only: the controllers kick the same full-pull entry as lane
activation (docs_fix/REQUIREMENTS_20260926_AUDIO_ORCH_QUEUE_STATE_DRIVEN.md
§5.4) on a background bus task and return the live status block. The pull is
pycore-local: it reads Laravel's without-audio listing of the lane and
mirrors it into Part2 of that lane's Queue; it NEVER mutates Laravel's queue.
``ui/queue_center/word_audio_full_sync`` is the word-lane compatibility
entry of ``ui/queue_center/audio_lane_full_sync {lane}``.
"""

from pycore.callmodule.rpc_routes.route_names import (
    UI_QUEUE_CENTER_AUDIO_LANE_FULL_SYNC,
    UI_QUEUE_CENTER_WORD_AUDIO_FULL_SYNC,
)
from pycore.pyctl.tts.audio_lane_activation import AUDIO_LANE_FULL_SYNC


def register_word_audio_full_sync_routes(server) -> None:
    """Register the audio-lane full-sync controllers."""

    def _run(lane, params):
        full_sync = AUDIO_LANE_FULL_SYNC.get(lane)
        if full_sync is None:
            return {"success": False, "error": "AUDIO_LANE_UNKNOWN"}
        base_url = str((params or {}).get("base_url") or "").strip()
        result = full_sync.start_background(base_url)
        result["status"] = full_sync.get_status()
        return result

    def word_full_sync_handler(params, _request_id, _context):
        return _run("word_audio", params)

    def lane_full_sync_handler(params, _request_id, _context):
        return _run(str((params or {}).get("lane") or "").strip(), params)

    server.post(path=UI_QUEUE_CENTER_WORD_AUDIO_FULL_SYNC, handler=word_full_sync_handler)
    server.post(path=UI_QUEUE_CENTER_AUDIO_LANE_FULL_SYNC, handler=lane_full_sync_handler)
