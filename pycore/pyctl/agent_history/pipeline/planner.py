# -*- coding: utf-8 -*-
import hashlib
from typing import Any, Dict, List, Tuple

from pycore.pyctl.agent_history.agent_history_fragments import (
    build_raw_batches,
    collect_fragments,
)
from pycore.pyctl.agent_history.pipeline.config import (
    get_config,
    get_tool_backfill_target,
    get_tool_cursor,
    get_tool_live_cursor,
    initialize_tool_lanes,
    save_config,
)


def _rotation_order(tools: List[str], last_tool: str) -> List[str]:
    """Rotate the tool list so the tool after ``last_tool`` comes first —
    processing stays evenly distributed across AIs."""
    if not tools:
        return []
    if last_tool in tools:
        idx = (tools.index(last_tool) + 1) % len(tools)
        return tools[idx:] + tools[:idx]
    return list(tools)


def _position(fragment: Dict[str, Any]) -> Tuple[int, str]:
    return (
        int(fragment.get("ts") or 0),
        str(fragment.get("fragment_id") or ""),
    )


def _cursor_position(cursor: Dict[str, Any]) -> Tuple[int, str]:
    return (
        int(cursor.get("after_ts") or 0),
        str(cursor.get("after_fragment_id") or ""),
    )


def _build_items(
    tool: str,
    fragments: List[Dict[str, Any]],
    min_words: int,
    lane: str,
) -> List[Dict[str, Any]]:
    batches, _ = build_raw_batches(fragments, min_words=min_words, start_index=0)
    items: List[Dict[str, Any]] = []
    for batch in batches:
        fragment_ids = [str(fragment.get("fragment_id") or "") for fragment in batch.get("fragments", [])]
        hash_input = f"{lane}|{tool}|{','.join(fragment_ids)}".encode("utf-8")
        items.append({
            "item_key": f"batch_{hashlib.md5(hash_input).hexdigest()}",
            "tool": tool,
            "lane": lane,
            "raw_text": batch.get("raw_text", ""),
            "word_count": batch.get("word_count", 0),
            "fragment_count": batch.get("fragment_count", 0),
            "last_fragment_id": batch.get("last_fragment_id", ""),
            "last_ts": batch.get("last_ts", 0),
            "next_fragment_index": batch.get("next_fragment_index", 0),
            "live": lane == "live",
        })
    items.sort(key=lambda item: int(item.get("last_ts") or 0))
    return items


def plan_batches() -> Tuple[List[Dict[str, Any]], int]:
    """
    Collect fragments for every enabled tool and plan batches.

    Queue semantics:
    - only checked tools (config.enabled_tools) contribute work;
    - each tool has a forward backfill lane and a forward live lane;
    - newly discovered live work preempts backfill across every tool;
    - backfill tools are interleaved round-robin after the last processed tool;
    - both lane cursors move forward only, so priority work never drops backlog.
    """
    cfg = get_config()
    tools = [str(t) for t in (cfg.get("enabled_tools") or []) if str(t)]
    if not tools:
        return [], 0

    min_words = int(cfg.get("min_raw_words") or 200)
    last_tool = str(cfg.get("last_tool") or "")

    backfill_by_tool: Dict[str, List[Dict[str, Any]]] = {}
    live_by_tool: Dict[str, List[Dict[str, Any]]] = {}
    pending_count = 0
    config_changed = False
    for tool in tools:
        fragments = collect_fragments(tool=tool)
        boundary = _position(fragments[-1]) if fragments else (0, "")
        if initialize_tool_lanes(cfg, tool, boundary[0], boundary[1]):
            config_changed = True
        cursor_position = _cursor_position(get_tool_cursor(cfg, tool))
        target_position = _cursor_position(get_tool_backfill_target(cfg, tool))
        live_position = _cursor_position(get_tool_live_cursor(cfg, tool))
        backfill_fragments = [
            fragment
            for fragment in fragments
            if cursor_position < _position(fragment) <= target_position
        ]
        live_fragments = [
            fragment
            for fragment in fragments
            if _position(fragment) > live_position
        ]
        pending_count += len(backfill_fragments) + len(live_fragments)
        backfill_items = _build_items(tool, backfill_fragments, min_words, "backfill")
        live_items = _build_items(tool, live_fragments, min_words, "live")
        if backfill_items:
            backfill_by_tool[tool] = backfill_items
        if live_items:
            live_by_tool[tool] = live_items

    if config_changed:
        save_config(cfg)

    live_heads = [items[0] for items in live_by_tool.values() if items]
    if live_heads:
        live_heads.sort(key=lambda item: int(item.get("last_ts") or 0), reverse=True)
        return live_heads, pending_count

    # Round-robin interleave across tools (rotation starts after last_tool).
    merged: List[Dict[str, Any]] = []
    order = _rotation_order(tools, last_tool)
    depth = 0
    while True:
        added = False
        for tool in order:
            items = backfill_by_tool.get(tool) or []
            if depth < len(items):
                merged.append(items[depth])
                added = True
        if not added:
            break
        depth += 1

    return merged, pending_count
