# -*- coding: utf-8 -*-
"""Terminal window views: build live/offline window payloads from stored records."""
from __future__ import annotations

import os
import re
from typing import Any, Dict, List

from pycore.pyctl.terminal.terminal_state_keys import (
    MAX_VISIBLE_LOG_ENTRIES,
    SLOT_VERSION,
)


def window_key(platform_name: str, window: Dict[str, Any]) -> str:
    return ":".join(
        (
            platform_name,
            str(window.get("id") or ""),
            str(window.get("process_id") or 0),
            str(window.get("class_name") or ""),
        )
    )


def new_record(
    terminal_number: int,
    platform_name: str,
    window_key: str,
    window: Dict[str, Any],
    now: str,
) -> Dict[str, Any]:
    rectangle = window.get("rect") or {}
    return {
        "terminal_number": terminal_number,
        "platform": platform_name,
        "window_key": window_key,
        "window_id": str(window.get("id") or ""),
        "native_id": str(window.get("native_id") or ""),
        "title": str(window.get("title") or ""),
        "app": str(window.get("app") or ""),
        "class_name": str(window.get("class_name") or ""),
        "process_id": str(int(window.get("process_id") or 0)),
        "rect_x": str(int(rectangle.get("x") or 0)),
        "rect_y": str(int(rectangle.get("y") or 0)),
        "rect_width": str(int(rectangle.get("width") or 1)),
        "rect_height": str(int(rectangle.get("height") or 1)),
        "draft": "",
        "created_at": now,
        "updated_at": now,
        "last_seen_at": now,
        "preview_expanded": "0",
        "slot_version": SLOT_VERSION,
        "logs": [],
        "logs_by_id": {},
    }


def decorate_live_window(
    window: Dict[str, Any],
    record: Dict[str, Any],
) -> Dict[str, Any]:
    logs = record.get("logs") or []
    window["terminal_number"] = int(record["terminal_number"])
    window["online"] = True
    window["has_draft"] = int(record.get("draft") or 0) > 0
    window["log_count"] = len(logs)
    window["logs"] = logs[:MAX_VISIBLE_LOG_ENTRIES]
    window["preview_expanded"] = (
        str(record.get("preview_expanded") or "0") == "1"
    )
    window["custom_title"] = str(record.get("custom_title") or "")
    window["state_updated_at"] = str(record.get("updated_at") or "")
    return window


def build_offline_window(record: Dict[str, Any]) -> Dict[str, Any]:
    terminal_number = int(record["terminal_number"])
    x = int(record.get("rect_x") or 0)
    y = int(record.get("rect_y") or 0)
    width = int(record.get("rect_width") or 1)
    height = int(record.get("rect_height") or 1)
    logs = record.get("logs") or []
    return {
        "id": f"stored:{terminal_number}",
        "native_id": str(record.get("native_id") or ""),
        "title": str(record.get("title") or ""),
        "app": str(record.get("app") or ""),
        "class_name": str(record.get("class_name") or ""),
        "process_id": int(record.get("process_id") or 0),
        "active": False,
        "online": False,
        "terminal_number": terminal_number,
        "rect": {
            "x": x,
            "y": y,
            "width": width,
            "height": height,
        },
        "center": {
            "x": x + width // 2,
            "y": y + height // 2,
        },
        "screenshot": None,
        "has_draft": int(record.get("draft") or 0) > 0,
        "log_count": len(logs),
        "logs": logs[:MAX_VISIBLE_LOG_ENTRIES],
        "preview_expanded": (
            str(record.get("preview_expanded") or "0") == "1"
        ),
        "custom_title": str(record.get("custom_title") or ""),
        "state_updated_at": str(record.get("updated_at") or ""),
        "last_seen_at": str(record.get("last_seen_at") or ""),
    }


def has_retained_state(record: Dict[str, Any]) -> bool:
    return (
        int(record.get("draft") or 0) > 0
        or bool(record.get("logs"))
        or str(record.get("preview_expanded") or "0") == "1"
    )


TITLE_BOUNDARY_PATTERN = re.compile(r"[\s\-_:|/\\·•]")
TITLE_LEADING_SYMBOLS_PATTERN = re.compile(r"^[^\w]+", re.UNICODE)
TITLE_EMPTY_PLACEHOLDER = "-"


def _first_token(name: str) -> str:
    """Text up to and including the first word boundary; empty when the name has none."""
    match = TITLE_BOUNDARY_PATTERN.search(name)
    return name[:match.end()] if match else ""


def _shared_prefix(names: List[str]) -> str:
    prefix = os.path.commonprefix(names)
    while prefix and not TITLE_BOUNDARY_PATTERN.match(prefix[-1]):
        prefix = prefix[:-1]
    return prefix


def strip_shared_prefixes(titles: List[str]) -> List[str]:
    """Repeatedly drop the word-boundary prefix shared by two or more names (all of them first, then any subgroup), plus leading status glyphs."""
    names = [TITLE_LEADING_SYMBOLS_PATTERN.sub("", title) for title in titles]
    changed = True
    while changed:
        changed = False
        groups: Dict[str, List[int]] = {}
        for index, name in enumerate(names):
            token = _first_token(name)
            if token:
                groups.setdefault(token, []).append(index)
        for indexes in groups.values():
            if len(indexes) < 2:
                continue
            prefix = _shared_prefix([names[index] for index in indexes])
            if not prefix:
                continue
            for index in indexes:
                names[index] = TITLE_LEADING_SYMBOLS_PATTERN.sub("", names[index][len(prefix):])
            changed = True
    return [name.strip() or TITLE_EMPTY_PLACEHOLDER for name in names]


def assign_short_titles(windows: List[Dict[str, Any]]) -> None:
    """short_title: the title with every shared prefix stripped (strip_shared_prefixes); "-" when nothing is left."""
    titled = [window for window in windows if window.get("title")]
    for window, short in zip(titled, strip_shared_prefixes([str(window["title"]) for window in titled])):
        window["short_title"] = short
    for window in windows:
        window.setdefault("short_title", "")
