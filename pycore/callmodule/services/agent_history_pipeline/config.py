# -*- coding: utf-8 -*-
from typing import Any, Dict

from pycore.pyfoundations.system_paths import get_user_data_store

_SECTION = "agent_history_article"
_DEFAULT_MODEL = "openrouter/free"

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
        "cursor": {
            "fragment_index": 0,
            "after_ts": 0,
            "after_fragment_id": "",
            "raw_index": 0,
            "attempts": 0,
        },
        "last_error": None,
        "last_error_at": None,
        "last_run_at": None,
        "published": [],
    }

def get_config() -> Dict[str, Any]:
    store = get_user_data_store()
    cfg = store.get_section(_SECTION) or {}
    out = _default_config()
    out.update({k: v for k, v in cfg.items() if k in out or k == "cursor" or k == "last_error_at"})
    if not isinstance(out.get("cursor"), dict):
        out["cursor"] = _default_config()["cursor"]
    if not isinstance(out.get("published"), list):
        out["published"] = []
    return out

def save_config(patch: Dict[str, Any]) -> Dict[str, Any]:
    cfg = get_config()
    for key in (
        "enabled", "extract_as_article", "reference_lang", "target_lang",
        "min_raw_words", "openrouter_model",
        "live_listen", "phase",
    ):
        if key in patch:
            cfg[key] = patch[key]
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
