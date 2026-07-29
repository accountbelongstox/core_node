# -*- coding: utf-8 -*-
from typing import Any, Dict, List

from pycore.pyfoundations.system_paths import get_user_data_store

_SECTION = "agent_history_article"
_DEFAULT_MODEL = "openrouter/free"

# Supported tool keys (extractor tool() values). The UI renders checkboxes in
# this order; only checked tools are planned into the article pipeline.
SUPPORTED_TOOLS: List[str] = [
    "agent", "claude", "codex", "cursor", "gemini",
    "kimi", "antigravity", "cline", "ark-cli",
]

def _default_cursor() -> Dict[str, Any]:
    return {
        "fragment_index": 0,
        "after_ts": 0,
        "after_fragment_id": "",
        "raw_index": 0,
        "attempts": 0,
    }

def _default_config() -> Dict[str, Any]:
    return {
        "enabled": False,
        "extract_as_article": False,
        "reference_lang": "CN",
        "target_lang": "EN",
        "min_raw_words": 200,
        "openrouter_model": _DEFAULT_MODEL,
        "phase": "idle",
        "live_listen": False,
        "enabled_tools": [],
        # Per-tool cursors: {tool: {after_ts, after_fragment_id}}. Newest
        # prompts are planned at the head of the queue and tools rotate.
        "cursors": {},
        "last_tool": "",
        "cursor": _default_cursor(),
        "last_error": None,
        "last_error_at": None,
        "last_run_at": None,
        "published": [],
    }

def normalize_enabled_tools(raw: Any) -> List[str]:
    """Keep only known tool keys, preserving SUPPORTED_TOOLS order."""
    if not isinstance(raw, (list, tuple)):
        return []
    wanted = {str(t).strip().lower() for t in raw}
    return [t for t in SUPPORTED_TOOLS if t in wanted]

def get_config() -> Dict[str, Any]:
    store = get_user_data_store()
    cfg = store.get_section(_SECTION) or {}
    out = _default_config()
    out.update({k: v for k, v in cfg.items() if k in out or k == "last_error_at"})
    if not isinstance(out.get("cursor"), dict):
        out["cursor"] = _default_cursor()
    if not isinstance(out.get("cursors"), dict):
        out["cursors"] = {}
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

def advance_tool_cursor(cfg: Dict[str, Any], tool: str, after_ts: int, after_fragment_id: str) -> None:
    """Move a tool cursor forward only — newest-first processing must never
    rewind a cursor onto older fragments."""
    cursors = cfg.setdefault("cursors", {})
    if not isinstance(cursors, dict):
        cursors = {}
        cfg["cursors"] = cursors
    cur = get_tool_cursor(cfg, tool)
    old_ts = int(cur.get("after_ts") or 0)
    new_ts = int(after_ts or 0)
    if new_ts > old_ts:
        cursors[tool] = {"after_ts": new_ts, "after_fragment_id": str(after_fragment_id or "")}
    elif new_ts == old_ts and str(after_fragment_id or "") > str(cur.get("after_fragment_id") or ""):
        cursors[tool] = {"after_ts": new_ts, "after_fragment_id": str(after_fragment_id or "")}

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
    if "last_tool" in patch:
        cfg["last_tool"] = str(patch.get("last_tool") or "")
    cfg["reference_lang"] = "CN"
    cfg["target_lang"] = "EN"
    if patch.get("enabled") is True:
        cfg["extract_as_article"] = True
        cfg["live_listen"] = True
        if cfg.get("phase") == "idle":
            cfg["phase"] = "backfill"
        elif cfg.get("phase") == "done":
            cfg["phase"] = "live"
    get_user_data_store().set_section(_SECTION, cfg)
    return cfg

def get_status() -> Dict[str, Any]:
    cfg = get_config()
    # Note: pending_fragments is now managed by the worker operation
    return {
        "config": cfg,
        "pending_fragments": 0, 
        "published_count": len(cfg.get("published") or []),
    }

def list_articles(limit: int = 50) -> list:
    cfg = get_config()
    rows = list(cfg.get("published") or [])
    rows.sort(key=lambda r: str(r.get("published_at") or ""), reverse=True)
    return rows[: max(1, min(int(limit or 50), 200))]
