# -*- coding: utf-8 -*-
import hashlib
from typing import Any, Dict, List, Tuple

from pycore.pyctl.agent_history.agent_history_fragments import (
    build_raw_batches,
    collect_fragments,
)
from pycore.callmodule.services.agent_history_pipeline.config import get_config


def plan_batches(live: bool = False) -> Tuple[List[Dict[str, Any]], int]:
    """
    Collect fragments and plan batches based on the current cursor.
    Returns a list of planned items and the total number of pending fragments.
    """
    cfg = get_config()
    cursor = cfg.get("cursor") or {}
    
    frags = collect_fragments(
        after_ts=int(cursor.get("after_ts") or 0),
        after_fragment_id=str(cursor.get("after_fragment_id") or ""),
    )
    
    pending_count = len(frags)
    min_words = int(cfg.get("min_raw_words") or 200)
    
    batches, _ = build_raw_batches(frags, min_words=min_words, start_index=0)
    
    items = []
    for batch in batches:
        # Create a deterministic item key based on fragments
        frag_ids = [f.get("id", "") for f in batch.get("fragments", [])]
        hash_input = ",".join(frag_ids).encode("utf-8")
        item_key = f"batch_{hashlib.md5(hash_input).hexdigest()}"
        
        items.append({
            "item_key": item_key,
            "raw_text": batch.get("raw_text", ""),
            "word_count": batch.get("word_count", 0),
            "fragment_count": batch.get("fragment_count", 0),
            "last_fragment_id": batch.get("last_fragment_id", ""),
            "last_ts": batch.get("last_ts", 0),
            "next_fragment_index": batch.get("next_fragment_index", 0),
            "live": live,
        })
        
    return items, pending_count
