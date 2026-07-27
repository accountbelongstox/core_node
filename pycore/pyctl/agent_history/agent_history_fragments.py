# -*- coding: utf-8 -*-
"""Collect and batch Agent History text fragments into >=min_words raw blocks."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.text_parsing import tokenize_words
import pycore.pyctl.agent_history.agent_history_txt as txt

_CODE_TOKEN_RE = re.compile(r"\[\[CODE_\d+\]\]")
_FENCE_RE = re.compile(r"```[\s\S]*?```|`[^`]+`")
_NOISE_RE = re.compile(r"[^\w\s\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af.,!?;:'\"()-]+")
_WS_RE = re.compile(r"\s+")

# session_id -> (mtime, events). Invalidated when the session .txt mtime changes.
_SESSION_EVENTS_CACHE: Dict[str, Tuple[float, List[Dict[str, Any]]]] = {}


def sanitize_fragment_text(text: str) -> str:
    """Strip code placeholders, fences, and noisy symbols for word counting."""
    out = (text or "").strip()
    if not out:
        return ""
    out = _FENCE_RE.sub(" ", out)
    out = _CODE_TOKEN_RE.sub(" ", out)
    out = _NOISE_RE.sub(" ", out)
    out = _WS_RE.sub(" ", out).strip()
    return out


def count_words(text: str) -> int:
    clean = sanitize_fragment_text(text)
    if not clean:
        return 0
    return len(tokenize_words(clean))


def _session_events(detail: Dict[str, Any]) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    seen_prompt_text: set = set()
    for p in detail.get("prompts") or []:
        body = sanitize_fragment_text(str(p.get("text") or ""))
        if not body:
            continue
        key = body[:200]
        seen_prompt_text.add(key)
        events.append({
            "kind": "prompt",
            "text": body,
            "ts": int(p.get("ts") or 0),
            "session_id": detail.get("id") or "",
            "fragment_id": p.get("id") or "",
        })
    for t in detail.get("turns") or []:
        role = str(t.get("role") or "").lower()
        if role not in ("assistant", "user"):
            continue
        body = sanitize_fragment_text(str(t.get("text") or ""))
        if not body:
            continue
        if role == "user" and body[:200] in seen_prompt_text:
            continue
        kind = "prompt" if role == "user" else "response"
        events.append({
            "kind": kind,
            "text": body,
            "ts": int(t.get("ts") or 0),
            "session_id": detail.get("id") or "",
            "fragment_id": f"{detail.get('id') or ''}#turn-{t.get('ts') or 0}",
        })
    events.sort(key=lambda e: (e.get("ts") or 0, e.get("fragment_id") or ""))
    return events


def _session_events_cached(session_id: str, detail: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Parse session events once per file mtime."""
    sid = str(session_id or "")
    path = txt.sessions_dir() / f"{txt.safe_id(sid)}.txt"
    try:
        mtime = float(path.stat().st_mtime)
    except OSError:
        mtime = 0.0
    cached = _SESSION_EVENTS_CACHE.get(sid)
    if cached is not None and cached[0] == mtime:
        return cached[1]
    events = _session_events(detail)
    _SESSION_EVENTS_CACHE[sid] = (mtime, events)
    return events


def collect_fragments(
    *,
    after_ts: int = 0,
    after_fragment_id: str = "",
) -> List[Dict[str, Any]]:
    """Return chronological fragments from all sessions (oldest first)."""
    index = txt.read_index()
    sessions = list(index.get("sessions") or [])
    sessions.sort(key=lambda s: int(s.get("started_ts") or 0))
    out: List[Dict[str, Any]] = []
    for summary in sessions:
        sid = str(summary.get("id") or "")
        if not sid:
            continue
        detail = txt.read_session(sid)
        if not detail:
            continue
        for ev in _session_events_cached(sid, detail):
            ts = int(ev.get("ts") or 0)
            fid = str(ev.get("fragment_id") or "")
            if ts < after_ts:
                continue
            if ts == after_ts and after_fragment_id and fid <= after_fragment_id:
                continue
            out.append(ev)
    out.sort(key=lambda e: (int(e.get("ts") or 0), str(e.get("fragment_id") or "")))
    return out


def build_raw_batches(
    fragments: List[Dict[str, Any]],
    *,
    min_words: int = 200,
    start_index: int = 0,
) -> Tuple[List[Dict[str, Any]], int]:
    """Pack adjacent fragments into raw blocks with at least min_words."""
    batches: List[Dict[str, Any]] = []
    idx = max(0, int(start_index or 0))
    n = len(fragments)
    while idx < n:
        parts: List[str] = []
        used: List[Dict[str, Any]] = []
        words = 0
        while idx < n and words < min_words:
            frag = fragments[idx]
            idx += 1
            text = sanitize_fragment_text(str(frag.get("text") or ""))
            if not text:
                continue
            parts.append(text)
            used.append(frag)
            # Incremental word count — avoid O(n^2) re-join counting inside the loop.
            words += count_words(text)
        if words < min_words:
            break
        raw_text = "\n\n".join(parts)
        # One precise recount for the joined batch (joiners can change token boundaries).
        words = count_words(raw_text)
        if words < min_words:
            break
        batches.append({
            "raw_text": raw_text,
            "word_count": words,
            "fragment_count": len(used),
            "first_ts": int(used[0].get("ts") or 0) if used else 0,
            "last_ts": int(used[-1].get("ts") or 0) if used else 0,
            "last_fragment_id": str(used[-1].get("fragment_id") or "") if used else "",
            "next_fragment_index": idx,
            "fragments": used,
        })
    return batches, idx
