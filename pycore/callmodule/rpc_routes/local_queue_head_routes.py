# -*- coding: utf-8 -*-
"""RPC entry for pycore-manager LOCAL queue-head promotion (Part1 fill).

Routing only: the controller forwards the promote to the shared audio
queue library, which fills Part1 of the item's lane directly (a missing item
gets a local manual task), and dedups against the whole Queue. This path
NEVER notifies Laravel — wordnew is the sole actor that notifies Laravel of
head moves (the Part2 fill path).
"""

from typing import Any, Dict, List

from pycore.callmodule.rpc_routes.route_names import (
    ROUTE_ERROR_QUEUE_HEAD_ITEMS_REQUIRED,
    UI_QUEUE_CENTER_PROMOTE_LOCAL_HEAD,
)
from pycore.pyutils.common.queue_center_contract import word_identity_md5
from pycore.pyutils.tts.audio_queue_model import (
    AUDIO_LANE_ERROR_UNKNOWN,
    AUDIO_QUEUE_LANE_BY_KIND,
    AUDIO_QUEUE_LANES,
    LOCAL_SOURCE_MANUAL,
)
from pycore.pyutils.tts.audio_queue_center import audio_queue_center

# X4: the only Laravel word identity is a 32-hex md5 (word_identity.rule);
# an item's md5 is normalized to it (case-insensitive) or dropped, so the
# item falls back to the contract's word_identity.fallback_when_md5_absent
# key (<lang>:text:<cleaned_word>) instead of being uploaded under a
# mismatched-case or foreign md5.
_RPC_ITEM_FIELDS = ("language", "text", "kind", "content_id")


def _resolve_lane(params: Dict[str, Any], items: List[Dict[str, Any]]) -> str:
    """Lane from ``queue`` param, else from the first item's ``kind``."""
    queue = str(params.get("queue") or "").strip()
    if queue in AUDIO_QUEUE_LANES:
        return queue
    if items:
        return AUDIO_QUEUE_LANE_BY_KIND.get(str(items[0].get("kind") or "").strip(), "")
    return ""


def _sanitize_item_md5(item: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize ``md5`` to the Laravel word identity, or drop it (X4)."""
    raw_md5 = item.get("md5")
    if raw_md5 is None:
        return item
    normalized = word_identity_md5(raw_md5)
    if normalized:
        item["md5"] = normalized
    else:
        item.pop("md5", None)
    return item


def _build_rpc_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """Build one manual-promote RPC item: language/text/kind/content_id plus
    the sanitized md5 only. Every other caller-supplied key, ``task``
    included, is dropped.
    """
    built = {field: item[field] for field in _RPC_ITEM_FIELDS if field in item}
    sanitized = _sanitize_item_md5(dict(item))
    if "md5" in sanitized:
        built["md5"] = sanitized["md5"]
    return built


def register_local_queue_head_routes(server) -> None:
    """Register the local queue-head promotion controller."""

    def promote_handler(params, _request_id, _context):
        raw_items = params.get("items")
        items = (
            [_build_rpc_item(item) for item in raw_items if isinstance(item, dict)]
            if isinstance(raw_items, list)
            else []
        )
        if not items:
            return {"success": False, "error_code": ROUTE_ERROR_QUEUE_HEAD_ITEMS_REQUIRED}
        lane = _resolve_lane(params, items)
        if lane not in AUDIO_QUEUE_LANES:
            return {"success": False, "error_code": AUDIO_LANE_ERROR_UNKNOWN}
        return audio_queue_center.promote_local_head(
            lane,
            items,
            owner=str(params.get("owner") or ""),
            local_source=LOCAL_SOURCE_MANUAL,
        )

    server.post(path=UI_QUEUE_CENTER_PROMOTE_LOCAL_HEAD, handler=promote_handler)
