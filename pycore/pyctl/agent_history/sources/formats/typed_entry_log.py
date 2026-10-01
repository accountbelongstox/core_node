# -*- coding: utf-8 -*-
"""Typed-entry session JSONL (Pi coding agent session format version 3).

A ``session`` header row ({id, cwd, timestamp}) is followed by ``message``
rows; user text becomes an article-boundary prompt, consecutive assistant
text is coalesced and split into article chunks of ``article_words``.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pycore.pyctl.agent_history.sources.source_kit import (
    SessionDraft,
    file_stem,
    load_jsonl,
    one,
    stringify_content,
    ts_to_epoch,
)
from pycore.pyctl.agent_history.sources.source_specs import SourceSpec
from pycore.pyfoundations.text_parsing import split_by_word_count

ASSISTANT_ARTICLE_WORDS = 600
ARTICLE_FLAGS = {"article_boundary": True, "direct_text": True}


def _assistant_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if not isinstance(content, list):
        return ""
    parts = [
        str(block.get("text") or "")
        for block in content
        if isinstance(block, dict) and block.get("type") == "text"
    ]
    return "\n".join(part for part in parts if part).strip()


def _flush_assistant(draft: SessionDraft, parts: List[str], ts: int, model: Optional[str], words: int) -> None:
    text = "\n\n".join(part.strip() for part in parts if part.strip()).strip()
    if not text:
        return
    for chunk in split_by_word_count(text, words):
        draft.add_turn(ts, "assistant", chunk, model=model, **ARTICLE_FLAGS)


def parse(path: str, user: str, tool: str, spec: SourceSpec) -> List[Dict[str, Any]]:
    rows = load_jsonl(path)
    if not rows:
        return []
    words = int(spec.options.get("article_words") or ASSISTANT_ARTICLE_WORDS)
    draft = SessionDraft(tool, user, path)
    header: Dict[str, Any] = {}
    assistant_parts: List[str] = []
    assistant_model: Optional[str] = None
    assistant_ts = 0

    for entry in rows:
        entry_type = str(entry.get("type") or "")
        if entry_type == "session":
            header = entry
            draft.seen(ts_to_epoch(entry.get("timestamp")))
            continue
        if entry_type != "message" or not isinstance(entry.get("message"), dict):
            continue
        message = entry["message"]
        role = str(message.get("role") or "").lower()
        ts = ts_to_epoch(entry.get("timestamp") or message.get("timestamp"))
        ts_estimated = ts <= 0
        if ts_estimated:
            ts = draft.file_ts()
        draft.seen(ts)

        if role == "user":
            _flush_assistant(draft, assistant_parts, assistant_ts, assistant_model, words)
            assistant_parts, assistant_model, assistant_ts = [], None, 0
            text = stringify_content(message.get("content")).strip()
            if text:
                draft.add_prompt(ts, text, ts_estimated, **ARTICLE_FLAGS)
                draft.add_turn(ts, "user", text, **ARTICLE_FLAGS)
        elif role == "assistant":
            text = _assistant_text(message.get("content"))
            if text:
                assistant_parts.append(text)
                assistant_ts = ts
                assistant_model = str(message.get("model") or assistant_model or "") or None
    _flush_assistant(draft, assistant_parts, assistant_ts, assistant_model, words)

    raw_id = str(header.get("id") or file_stem(path))
    return one(draft.build(raw_id, project=str(header.get("cwd") or ""), title=draft.title_from_prompts(raw_id)))


__all__ = ["ASSISTANT_ARTICLE_WORDS", "parse"]
