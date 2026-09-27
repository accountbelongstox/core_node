# -*- coding: utf-8 -*-
"""RPC entry for pycore-manager LOCAL queue-head promotion (Part1 fill).

Routing only: the controller forwards the promote to the shared audio
queue library, which fills Part1 of the item's lane directly (a missing item
gets a local manual task), and dedups against the whole Queue. This path
NEVER notifies Laravel — wordnew is the sole actor that notifies Laravel of
head moves (the Part2 fill path).
"""

import re
from typing import Any, Dict, List

from pycore.callmodule.rpc_routes.route_names import (
    ROUTE_ERROR_AUDIO_LANE_UNKNOWN,
    ROUTE_ERROR_QUEUE_HEAD_ITEMS_REQUIRED,
    UI_QUEUE_CENTER_PROMOTE_LOCAL_HEAD,
)
from pycore.pyutils.tts.audio_queue_center import (
    AUDIO_QUEUE_LANE_BY_KIND,
    AUDIO_QUEUE_LANES,
    LOCAL_SOURCE_MANUAL,
    audio_queue_center,
)

# X4: the only Laravel word identity is a 32-hex md5 (word_identity.rule); a
# caller-supplied value that does not match it is dropped here so the item
# falls back to the contract's word_identity.fallback_when_md5_absent key
# (<lang>:text:<cleaned_word>) instead of being uploaded under a foreign md5.
_MD5_RE = re.compile(r"^[0-9a-fA-F]{32}$")


def _resolve_lane(params: Dict[str, Any], items: List[Dict[str, Any]]) -> str:
    """Lane from ``queue`` param, else from the first item's ``kind``."""
    queue = str(params.get("queue") or "").strip()
    if queue in AUDIO_QUEUE_LANES:
        return queue
    if items:
        return AUDIO_QUEUE_LANE_BY_KIND.get(str(items[0].get("kind") or "").strip(), "")
    return ""


def _sanitize_item_md5(item: Dict[str, Any]) -> Dict[str, Any]:
    """Drop ``md5`` when it is not a 32-hex Laravel word identity (X4)."""
    raw_md5 = item.get("md5")
    if raw_md5 is not None and not _MD5_RE.fullmatch(str(raw_md5)):
        item.pop("md5", None)
    return item


def register_local_queue_head_routes(server) -> None:
    """Register the local queue-head promotion controller."""

    def promote_handler(params, _request_id, _context):
        raw_items = params.get("items")
        items = (
            [_sanitize_item_md5(dict(item)) for item in raw_items if isinstance(item, dict)]
            if isinstance(raw_items, list)
            else []
        )
        if not items:
            return {"success": False, "error_code": ROUTE_ERROR_QUEUE_HEAD_ITEMS_REQUIRED}
        lane = _resolve_lane(params, items)
        if lane not in AUDIO_QUEUE_LANES:
            return {"success": False, "error_code": ROUTE_ERROR_AUDIO_LANE_UNKNOWN}
        return audio_queue_center.promote_local_head(
            lane,
            items,
            owner=str(params.get("owner") or ""),
            local_source=LOCAL_SOURCE_MANUAL,
        )

    server.post(path=UI_QUEUE_CENTER_PROMOTE_LOCAL_HEAD, handler=promote_handler)
