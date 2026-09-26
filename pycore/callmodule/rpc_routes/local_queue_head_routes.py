# -*- coding: utf-8 -*-
"""RPC entry for pycore-manager LOCAL queue-head promotion (Part1 fill).

Routing only: the controller forwards the promote to the shared audio
queue library, which fills Part1 of the item's lane directly (a missing item
gets a local manual task), and dedups against the whole Queue. This path
NEVER notifies Laravel — wordnew is the sole actor that notifies Laravel of
head moves (the Part2 fill path).
"""

from typing import Any, Dict, List

from pycore.callmodule.rpc_routes.route_names import UI_QUEUE_CENTER_PROMOTE_LOCAL_HEAD
from pycore.pyutils.tts.audio_queue_center import (
    AUDIO_QUEUE_LANES,
    LOCAL_SOURCE_MANUAL,
    audio_queue_center,
)

_KIND_LANES = {"word": "word_audio", "sentence": "sentence_audio"}


def _resolve_lane(params: Dict[str, Any], items: List[Dict[str, Any]]) -> str:
    """Lane from ``queue`` param, else from the first item's ``kind``."""
    queue = str(params.get("queue") or "").strip()
    if queue in AUDIO_QUEUE_LANES:
        return queue
    if items:
        return _KIND_LANES.get(str(items[0].get("kind") or "").strip(), "")
    return ""


def register_local_queue_head_routes(server) -> None:
    """Register the local queue-head promotion controller."""

    def promote_handler(params, _request_id, _context):
        raw_items = params.get("items")
        items = (
            [dict(item) for item in raw_items if isinstance(item, dict)]
            if isinstance(raw_items, list)
            else []
        )
        lane = _resolve_lane(params, items)
        if lane not in AUDIO_QUEUE_LANES or not items:
            return {"success": False, "error": "queue (or item kind) and items are required"}
        return audio_queue_center.promote_local_head(
            lane,
            items,
            owner=str(params.get("owner") or ""),
            local_source=LOCAL_SOURCE_MANUAL,
        )

    server.post(path=UI_QUEUE_CENTER_PROMOTE_LOCAL_HEAD, handler=promote_handler)
