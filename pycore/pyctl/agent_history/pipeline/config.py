# -*- coding: utf-8 -*-
from typing import Any, Dict, List

import pycore.pyutils.agent_history.article_records as article_records
from pycore.pyutils.common.user_data_store import user_data_store

_SECTION = "agent_history_article"

# Supported tool keys (extractor tool() values). The UI renders checkboxes in
# this order; only checked tools are planned into the article pipeline.
SUPPORTED_TOOLS: List[str] = [
    "agent", "pi", "claude", "codex", "cursor", "gemini",
    "kimi", "antigravity", "cline",
]

def _default_cursor() -> Dict[str, Any]:
    defaults = user_data_store.get_default_section(_SECTION)
    cursor = defaults.get("cursor")
    return dict(cursor) if isinstance(cursor, dict) else {}

def _default_config() -> Dict[str, Any]:
    return user_data_store.get_default_section(_SECTION)

def normalize_enabled_tools(raw: Any) -> List[str]:
    """Keep only known tool keys, preserving SUPPORTED_TOOLS order."""
    if not isinstance(raw, (list, tuple)):
        return []
    wanted = {str(t).strip().lower() for t in raw}
    return [t for t in SUPPORTED_TOOLS if t in wanted]

def get_config() -> Dict[str, Any]:
    store = user_data_store
    cfg = store.get_section(_SECTION) or {}
    out = _default_config()
    out.update({k: v for k, v in cfg.items() if k in out or k == "last_error_at"})
    if not isinstance(out.get("cursor"), dict):
        out["cursor"] = _default_cursor()
    if not isinstance(out.get("cursors"), dict):
        out["cursors"] = {}
    if not isinstance(out.get("live_cursors"), dict):
        out["live_cursors"] = {}
    if not isinstance(out.get("live_completed"), dict):
        out["live_completed"] = {}
    if not isinstance(out.get("backfill_targets"), dict):
        out["backfill_targets"] = {}
    out["enabled_tools"] = normalize_enabled_tools(out.get("enabled_tools"))
    if not isinstance(out.get("published"), list):
        out["published"] = []
    return out

def get_tool_cursor(cfg: Dict[str, Any], tool: str) -> Dict[str, Any]:
    """Per-tool cursor; falls back to the legacy global cursor."""
    cursors = cfg.get("cursors") if isinstance(cfg.get("cursors"), dict) else {}
    cur = cursors.get(tool)
    if isinstance(cur, dict):
        return cur
    legacy = cfg.get("cursor") if isinstance(cfg.get("cursor"), dict) else {}
    return {
        "after_ts": int(legacy.get("after_ts") or 0),
        "after_fragment_id": str(legacy.get("after_fragment_id") or ""),
    }

def get_tool_live_cursor(cfg: Dict[str, Any], tool: str) -> Dict[str, Any]:
    cursors = cfg.get("live_cursors") if isinstance(cfg.get("live_cursors"), dict) else {}
    cursor = cursors.get(tool)
    return dict(cursor) if isinstance(cursor, dict) else {}

def get_tool_backfill_target(cfg: Dict[str, Any], tool: str) -> Dict[str, Any]:
    targets = cfg.get("backfill_targets") if isinstance(cfg.get("backfill_targets"), dict) else {}
    target = targets.get(tool)
    return dict(target) if isinstance(target, dict) else {}

def initialize_tool_lanes(
    cfg: Dict[str, Any],
    tool: str,
    target_ts: int,
    target_fragment_id: str,
) -> bool:
    targets = cfg.setdefault("backfill_targets", {})
    live_cursors = cfg.setdefault("live_cursors", {})
    if tool in targets and tool in live_cursors:
        return False
    boundary = {
        "after_ts": int(target_ts or 0),
        "after_fragment_id": str(target_fragment_id or ""),
    }
    targets.setdefault(tool, dict(boundary))
    live_cursors.setdefault(tool, dict(boundary))
    return True

def _advance_cursor_map(
    cfg: Dict[str, Any],
    map_key: str,
    tool: str,
    after_ts: int,
    after_fragment_id: str,
) -> None:
    cursors = cfg.setdefault(map_key, {})
    if not isinstance(cursors, dict):
        cursors = {}
        cfg[map_key] = cursors
    current = cursors.get(tool) if isinstance(cursors.get(tool), dict) else {}
    old_ts = int(current.get("after_ts") or 0)
    old_fragment_id = str(current.get("after_fragment_id") or "")
    new_ts = int(after_ts or 0)
    new_fragment_id = str(after_fragment_id or "")
    if new_ts > old_ts or (new_ts == old_ts and new_fragment_id > old_fragment_id):
        cursors[tool] = {
            "after_ts": new_ts,
            "after_fragment_id": new_fragment_id,
        }

def advance_tool_cursor(cfg: Dict[str, Any], tool: str, after_ts: int, after_fragment_id: str) -> None:
    """Move one tool's backfill cursor forward only."""
    _advance_cursor_map(cfg, "cursors", tool, after_ts, after_fragment_id)

def advance_tool_live_cursor(cfg: Dict[str, Any], tool: str, after_ts: int, after_fragment_id: str) -> None:
    """Advance only the live priority lane for one tool."""
    _advance_cursor_map(cfg, "live_cursors", tool, after_ts, after_fragment_id)

def mark_tool_live_item_completed(
    cfg: Dict[str, Any],
    tool: str,
    item_key: str,
    after_ts: int,
    after_fragment_id: str,
) -> None:
    """Persist one live batch completion without skipping older live batches."""
    completed = cfg.setdefault("live_completed", {})
    if not isinstance(completed, dict):
        completed = {}
        cfg["live_completed"] = completed
    tool_items = completed.get(tool)
    if not isinstance(tool_items, dict):
        tool_items = {}
        completed[tool] = tool_items
    tool_items[str(item_key)] = {
        "after_ts": int(after_ts or 0),
        "after_fragment_id": str(after_fragment_id or ""),
    }

def save_config(patch: Dict[str, Any]) -> Dict[str, Any]:
    cfg = get_config()
    for key in (
        "enabled", "extract_as_article", "reference_lang", "target_lang",
        "min_raw_words", "openrouter_model",
        "live_listen", "phase",
    ):
        if key in patch:
            cfg[key] = patch[key]
    if "enabled_tools" in patch:
        cfg["enabled_tools"] = normalize_enabled_tools(patch.get("enabled_tools"))
    # Cursor state is written by the pipeline worker (per-tool advance +
    # rotation) — pass it through explicitly; nested-dict side effects are
    # not a persistence mechanism.
    if isinstance(patch.get("cursor"), dict):
        cfg["cursor"] = patch["cursor"]
    if isinstance(patch.get("cursors"), dict):
        cfg["cursors"] = patch["cursors"]
    if isinstance(patch.get("live_cursors"), dict):
        cfg["live_cursors"] = patch["live_cursors"]
    if isinstance(patch.get("live_completed"), dict):
        cfg["live_completed"] = patch["live_completed"]
    if isinstance(patch.get("backfill_targets"), dict):
        cfg["backfill_targets"] = patch["backfill_targets"]
    if "last_tool" in patch:
        cfg["last_tool"] = str(patch.get("last_tool") or "")
    if patch.get("enabled") is True:
        cfg["extract_as_article"] = True
        cfg["live_listen"] = True
        if cfg.get("phase") == "idle":
            cfg["phase"] = "backfill"
        elif cfg.get("phase") == "done":
            cfg["phase"] = "live"
    user_data_store.set_section(_SECTION, cfg)
    return cfg

def get_status() -> Dict[str, Any]:
    cfg = get_config()
    summary = article_records.summarize_records()
    # Note: pending_fragments is now managed by the worker operation
    return {
        "config": cfg,
        "pending_fragments": 0, 
        "published_count": int(summary["uploaded"]),
    }

def list_articles(limit: int = 50) -> list:
    return article_records.list_records(max(1, min(int(limit or 50), 200)))
