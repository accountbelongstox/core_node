# -*- coding: utf-8 -*-
"""Collect and batch Agent History text fragments into >=min_words raw blocks."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pycore.pyctl.agent_history.agent_history_txt as txt
from pycore.pyctl.agent_history.snapshot_cache import (
    SESSION_EVENTS_CACHE_PREFIX,
    agent_history_snapshot_cache,
    file_revision,
    read_index_catalog,
)
from pycore.pyfoundations.text_parsing import tokenize_words

_CODE_TOKEN_RE = re.compile(r"\[\[CODE_\d+\]\]")
_FENCE_RE = re.compile(r"```[\s\S]*?```|`[^`]+`")
_NOISE_RE = re.compile(r"[^\w\s\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af.,!?;:'\"()-]+")
_WS_RE = re.compile(r"\s+")

def _summary_last_ts(summary: Dict[str, Any]) -> int:
    ended_ts = int(summary.get("ended_ts") or 0)
    if ended_ts > 0:
        return ended_ts
    ended_at = str(summary.get("ended_at") or "").strip()
    if ended_at:
        return int(datetime.strptime(ended_at, "%Y-%m-%d %H:%M:%S").timestamp())
    return int(summary.get("started_ts") or 0)


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
        direct_text = bool(p.get("direct_text"))
        raw_body = str(p.get("text") or "").strip()
        body = raw_body if direct_text else sanitize_fragment_text(raw_body)
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
            "article_boundary": bool(p.get("article_boundary")),
            "direct_text": direct_text,
        })
    for turn_index, t in enumerate(detail.get("turns") or []):
        role = str(t.get("role") or "").lower()
        if role not in ("assistant", "user"):
            continue
        direct_text = bool(t.get("direct_text"))
        raw_body = str(t.get("text") or "").strip()
        body = raw_body if direct_text else sanitize_fragment_text(raw_body)
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
            "fragment_id": f"{detail.get('id') or ''}#turn-{turn_index}-{t.get('ts') or 0}",
            "article_boundary": bool(t.get("article_boundary")),
            "direct_text": direct_text,
        })
    events.sort(key=lambda e: (e.get("ts") or 0, e.get("fragment_id") or ""))
    return events


def _session_events_cached(session_id: str) -> List[Dict[str, Any]]:
    """Read and parse one session only when its file revision changes."""
    sid = str(session_id or "")
    path = txt.sessions_dir() / f"{txt.safe_id(sid)}.txt"
    revision = file_revision(path)

    def load_events() -> Dict[str, Any]:
        detail = txt.read_session(sid)
        return {"events": _session_events(detail) if detail else []}

    snapshot = agent_history_snapshot_cache.get(
        SESSION_EVENTS_CACHE_PREFIX + sid,
        load_events,
        ttl_seconds=float("inf"),
        version=revision,
        stale_while_refresh=False,
    )
    events = snapshot.get("events") or []
    return events if isinstance(events, list) else []


def collect_fragments(
    *,
    after_ts: int = 0,
    after_fragment_id: str = "",
    tool: Optional[str] = None,
    tools: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """Return chronological fragments from all sessions (oldest first).

    Each fragment carries the session's ``tool`` key so the planner can filter
    and rotate per tool. When ``tool`` is given only that tool's sessions are
    collected.
    """
    index_snapshot = read_index_catalog()
    index = index_snapshot.get("data") or {}
    sessions = list(index.get("sessions") or [])
    sessions.sort(key=lambda s: int(s.get("started_ts") or 0))
    allowed_tools = {
        str(item).strip().lower()
        for item in (tools or [])
        if str(item).strip()
    }
    out: List[Dict[str, Any]] = []
    for summary in sessions:
        session_tool = str(summary.get("tool") or "").lower()
        if tool and session_tool != str(tool).lower():
            continue
        if not tool and allowed_tools and session_tool not in allowed_tools:
            continue
        if _summary_last_ts(summary) < after_ts:
            continue
        sid = str(summary.get("id") or "")
        if not sid:
            continue
        for cached_event in _session_events_cached(sid):
            ev = dict(cached_event)
            ts = int(ev.get("ts") or 0)
            fid = str(ev.get("fragment_id") or "")
            if ts < after_ts:
                continue
            if ts == after_ts and after_fragment_id and fid <= after_fragment_id:
                continue
            ev["tool"] = session_tool
            out.append(ev)
    out.sort(key=lambda e: (int(e.get("ts") or 0), str(e.get("fragment_id") or "")))
    return out


def summarize_tool_fragments(
    tool: str,
    *,
    after_ts: int = 0,
    after_fragment_id: str = "",
) -> Dict[str, int]:
    """Count one tool's processable prompt/reply records around its cursor."""
    key = str(tool or "").strip().lower()
    summaries = summarize_tool_fragments_many({
        key: {
            "after_ts": int(after_ts or 0),
            "after_fragment_id": str(after_fragment_id or ""),
        },
    })
    return summaries.get(key) or {
        "total": 0,
        "processed": 0,
        "pending": 0,
        "prompts": 0,
        "replies": 0,
    }


def summarize_tool_fragments_many(
    cursors: Dict[str, Dict[str, Any]],
) -> Dict[str, Dict[str, int]]:
    """Count several tools in one session-store pass."""
    normalized = {
        str(tool).strip().lower(): {
            "after_ts": int((cursor or {}).get("after_ts") or 0),
            "after_fragment_id": str((cursor or {}).get("after_fragment_id") or ""),
            "backfill_target_ts": int((cursor or {}).get("backfill_target_ts") or 0),
            "backfill_target_fragment_id": str((cursor or {}).get("backfill_target_fragment_id") or ""),
            "live_after_ts": int((cursor or {}).get("live_after_ts") or 0),
            "live_after_fragment_id": str((cursor or {}).get("live_after_fragment_id") or ""),
            "lane_aware": bool((cursor or {}).get("lane_aware")),
        }
        for tool, cursor in cursors.items()
        if str(tool).strip()
    }
    summaries: Dict[str, Dict[str, int]] = {
        tool: {"total": 0, "processed": 0, "pending": 0, "prompts": 0, "replies": 0}
        for tool in normalized
    }
    if not normalized:
        return summaries
    for fragment in collect_fragments(tools=list(normalized)):
        tool = str(fragment.get("tool") or "").lower()
        summary = summaries.get(tool)
        cursor = normalized.get(tool)
        if summary is None or cursor is None:
            continue
        summary["total"] += 1
        kind = str(fragment.get("kind") or "")
        if kind == "prompt":
            summary["prompts"] += 1
        elif kind == "response":
            summary["replies"] += 1
        timestamp = int(fragment.get("ts") or 0)
        fragment_id = str(fragment.get("fragment_id") or "")
        after_ts = int(cursor["after_ts"])
        after_fragment_id = str(cursor["after_fragment_id"])
        position = (timestamp, fragment_id)
        backfill_position = (after_ts, after_fragment_id)
        if cursor["lane_aware"]:
            target_position = (
                int(cursor["backfill_target_ts"]),
                str(cursor["backfill_target_fragment_id"]),
            )
            live_position = (
                int(cursor["live_after_ts"]),
                str(cursor["live_after_fragment_id"]),
            )
            if backfill_position < position <= target_position or position > live_position:
                summary["pending"] += 1
        elif position > backfill_position:
            summary["pending"] += 1
    for summary in summaries.values():
        summary["processed"] = max(0, summary["total"] - summary["pending"])
    return summaries


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
        first_fragment = fragments[idx]
        if bool(first_fragment.get("article_boundary")):
            idx += 1
            direct_text = bool(first_fragment.get("direct_text"))
            raw_value = str(first_fragment.get("text") or "").strip()
            raw_text = raw_value if direct_text else sanitize_fragment_text(raw_value)
            words = count_words(raw_text)
            if not raw_text:
                continue
            batches.append({
                "raw_text": raw_text,
                "word_count": words,
                "fragment_count": 1,
                "first_ts": int(first_fragment.get("ts") or 0),
                "last_ts": int(first_fragment.get("ts") or 0),
                "last_fragment_id": str(first_fragment.get("fragment_id") or ""),
                "next_fragment_index": idx,
                "fragments": [first_fragment],
            })
            continue
        parts: List[str] = []
        used: List[Dict[str, Any]] = []
        words = 0
        while idx < n and words < min_words:
            frag = fragments[idx]
            if bool(frag.get("article_boundary")):
                break
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
