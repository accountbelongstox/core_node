# -*- coding: utf-8 -*-
"""Pure record helpers shared by the agent-history extractor and store reader."""

from __future__ import annotations

import hashlib
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

IS_DEV_MACHINE = True
PROMPT_ID_HASH_LEN = 12
LOCAL_TIME_FORMAT = "%Y-%m-%d %H:%M:%S"

_CJK_PATTERN = re.compile(r"[一-鿿぀-ヿ가-힯]")
_PROMPT_ID_PATTERN = re.compile(r"^(.+)#[^#]+$")


def local_time_text(ts: Optional[float] = None) -> str:
    """Local wall-clock text used by every agent-history store field."""
    moment = datetime.now() if ts is None else datetime.fromtimestamp(ts)
    return moment.strftime(LOCAL_TIME_FORMAT)


def detect_lang(text: str) -> str:
    if not text:
        return ""
    return "zh" if _CJK_PATTERN.search(text) else "en"


def newest_prompts_first(prompts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Newest first by ts; ties (same second or file-derived ts) resolve to the
    later record in source order, never to the first line of a file."""
    return [
        p for _, p in sorted(
            enumerate(prompts),
            key=lambda item: (int(item[1].get("ts") or 0), item[0]),
            reverse=True,
        )
    ]


def source_id(path: str) -> str:
    return hashlib.md5(str(path or "").encode("utf-8")).hexdigest()


def prompt_session_id(prompt_id: str) -> str:
    """Session id part of a ``<session>#<digest>`` prompt id ('' when malformed)."""
    match = _PROMPT_ID_PATTERN.match(str(prompt_id or ""))
    return match.group(1) if match else ""


def assign_prompt_ids(detail: Dict[str, Any], session_id: str) -> None:
    """Content-stable ids: a prompt keeps its id when the source is
    trimmed/rotated or earlier entries are filtered, so a genuinely new
    prompt can never inherit a known id (index ids masked new prompts)."""
    counts: Dict[str, int] = {}
    for i, p in enumerate(detail.get("prompts") or []):
        # A file-derived ts moves on every rewrite of the source; keying on it
        # would re-announce the whole file as new, so such ids are content-only.
        ts_key = "" if p.pop("ts_estimated", False) else str(int(p.get("ts") or 0))
        digest = hashlib.sha1(
            f"{ts_key}|{p.get('text') or ''}".encode("utf-8")
        ).hexdigest()[:PROMPT_ID_HASH_LEN]
        counts[digest] = counts.get(digest, 0) + 1
        suffix = "" if counts[digest] == 1 else f"-{counts[digest]}"
        p["id"] = f"{session_id}#{digest}{suffix}"
        p["legacy_id"] = f"{session_id}#{i}"


def apply_edits(prompts: List[Dict[str, Any]], edits: Dict[str, Dict[str, str]]) -> None:
    for p in prompts:
        pid = p.get("id") or ""
        if pid not in edits:
            pid = p.pop("legacy_id", "") or pid
        p.pop("legacy_id", None)
        if pid and pid in edits and edits[pid].get("text") is not None:
            p["text"] = edits[pid]["text"]
            p["edited"] = True


def prompt_entry(prompt: Dict[str, Any], meta: Dict[str, Any], session_id: str) -> Dict[str, Any]:
    """Flat prompt-list row from one session prompt block plus its session meta."""
    ts = int(prompt.get("ts") or 0)
    text = str(prompt.get("text") or "")
    return {
        "id": prompt.get("id"),
        "tool": meta.get("tool") or "",
        "os_user": meta.get("os_user") or "",
        "project": meta.get("project") or "",
        "session_id": session_id,
        "ts": ts,
        "time": local_time_text(ts) if ts else "",
        "text": text,
        "lang": detect_lang(text),
        "edited": bool(prompt.get("edited")),
    }


__all__ = [
    "IS_DEV_MACHINE",
    "LOCAL_TIME_FORMAT",
    "apply_edits",
    "assign_prompt_ids",
    "detect_lang",
    "local_time_text",
    "newest_prompts_first",
    "prompt_entry",
    "prompt_session_id",
    "source_id",
]
