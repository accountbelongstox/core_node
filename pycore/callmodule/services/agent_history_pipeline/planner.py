# -*- coding: utf-8 -*-
import hashlib
from typing import Any, Dict, List, Tuple

from pycore.pyctl.agent_history.agent_history_fragments import (
    build_raw_batches,
    collect_fragments,
)
from pycore.callmodule.services.agent_history_pipeline.config import (
    get_config,
    get_tool_cursor,
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


def plan_batches(live: bool = False) -> Tuple[List[Dict[str, Any]], int]:
    """
    Collect fragments for every enabled tool and plan batches.

    Queue semantics:
    - only checked tools (config.enabled_tools) contribute work;
    - batches of each tool are ordered newest-first, so freshly discovered
      prompts land at the head of the queue instead of waiting for the whole
      backlog;
    - tools are interleaved round-robin starting after the last processed
      tool, so every AI is processed evenly;
    - cursors are per-tool and move forward only, so a newer batch processed
      first never rewinds onto older fragments.
    """
    cfg = get_config()
    tools = [str(t) for t in (cfg.get("enabled_tools") or []) if str(t)]
    if not tools:
        return [], 0

    min_words = int(cfg.get("min_raw_words") or 200)
    last_tool = str(cfg.get("last_tool") or "")

    # tool -> list of planned items (newest first within each tool)
    per_tool: Dict[str, List[Dict[str, Any]]] = {}
    pending_count = 0
    for tool in tools:
        cursor = get_tool_cursor(cfg, tool)
        frags = collect_fragments(
            after_ts=int(cursor.get("after_ts") or 0),
            after_fragment_id=str(cursor.get("after_fragment_id") or ""),
            tool=tool,
        )
        pending_count += len(frags)
        batches, _ = build_raw_batches(frags, min_words=min_words, start_index=0)
        items: List[Dict[str, Any]] = []
        for batch in batches:
            # Deterministic item key over real fragment ids (+ tool so two
            # tools can never collide on operation_items.item_key).
            frag_ids = [str(f.get("fragment_id") or "") for f in batch.get("fragments", [])]
            hash_input = f"{tool}|{','.join(frag_ids)}".encode("utf-8")
            item_key = f"batch_{hashlib.md5(hash_input).hexdigest()}"
            items.append({
                "item_key": item_key,
                "tool": tool,
                "raw_text": batch.get("raw_text", ""),
                "word_count": batch.get("word_count", 0),
                "fragment_count": batch.get("fragment_count", 0),
                "last_fragment_id": batch.get("last_fragment_id", ""),
                "last_ts": batch.get("last_ts", 0),
                "next_fragment_index": batch.get("next_fragment_index", 0),
                "live": live,
            })
        # Newest batch at the head of this tool's queue.
        items.sort(key=lambda it: int(it.get("last_ts") or 0), reverse=True)
        if items:
            per_tool[tool] = items

    # Round-robin interleave across tools (rotation starts after last_tool).
    merged: List[Dict[str, Any]] = []
    order = _rotation_order(tools, last_tool)
    depth = 0
    while True:
        added = False
        for tool in order:
            items = per_tool.get(tool) or []
            if depth < len(items):
                merged.append(items[depth])
                added = True
        if not added:
            break
        depth += 1

    return merged, pending_count
