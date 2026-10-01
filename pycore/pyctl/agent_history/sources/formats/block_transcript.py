# -*- coding: utf-8 -*-
"""Role + content-block transcript JSONL (Cursor ``agent-transcripts``).

Each line: {"role":"user|assistant","message":{"content":[{type,text|tool_use|
tool_result},...]}}. Consecutive assistant text blocks are coalesced (deduped)
into one assistant turn closed by the next user line. Declared options:
``query_tag`` (user text inside ``<tag>...</tag>`` is the prompt body),
``strip_tags`` (wrapper elements removed otherwise), ``project_anchor`` (the
path segment after it is the project) and ``container_dir`` (the parent dir
name of a flat transcript; nested transcripts use their own dir as the id).
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Optional

from pycore.pyctl.agent_history.sources.source_kit import (
    SessionDraft,
    file_stem,
    load_jsonl,
    one,
    path_segment_after,
    stringify_content,
    ts_to_epoch,
)
from pycore.pyctl.agent_history.sources.source_specs import SourceSpec


def _clean_text(text: str, query_tag: str, strip_tags: tuple) -> str:
    """Keep the query body; drop wrapper elements when present."""
    if query_tag:
        m = re.search(rf"<{query_tag}>\s*(.*?)\s*</{query_tag}>", text, re.DOTALL | re.IGNORECASE)
        if m:
            return m.group(1).strip()
    for tag in strip_tags:
        text = re.sub(rf"<{tag}>.*?</{tag}>\s*", "", text, flags=re.DOTALL | re.IGNORECASE)
    return text.strip()


class _AssistantBuffer:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.texts: List[str] = []
        self.seen: set[str] = set()
        self.ts = 0
        self.model: Optional[str] = None

    def add(self, texts: List[str], ts: int, model: Optional[str]) -> None:
        for text in texts:
            if text not in self.seen:
                self.seen.add(text)
                self.texts.append(text)
        if texts:
            self.ts = ts
            self.model = model

    def flush(self, draft: SessionDraft) -> None:
        if self.texts and not draft.full():
            draft.add_turn(self.ts, "assistant", "\n\n".join(self.texts), False, self.model)
        self.reset()


def parse(path: str, user: str, tool: str, spec: SourceSpec) -> List[Dict[str, Any]]:
    rows = load_jsonl(path)
    if not rows:
        return []
    opts = spec.options
    query_tag = str(opts.get("query_tag") or "")
    strip_tags = tuple(opts.get("strip_tags") or ())
    draft = SessionDraft(tool, user, path)
    mtime = draft.mtime
    buffer = _AssistantBuffer()

    for index, e in enumerate(rows):
        raw_ts = ts_to_epoch(e.get("timestamp"))
        ts = raw_ts or (mtime + index)
        draft.seen(ts)
        msg = e.get("message") or {}
        model = msg.get("model")
        draft.add_model(model)
        content = msg.get("content")
        if isinstance(content, str):
            content = [{"type": "text", "text": content}]
        if not isinstance(content, list):
            continue

        text_blocks: List[str] = []
        for block in content:
            if not isinstance(block, dict):
                continue
            btype = block.get("type", "")
            if btype == "text":
                text = _clean_text(str(block.get("text") or "").strip(), query_tag, strip_tags)
                if text:
                    text_blocks.append(text)
            elif btype == "tool_use":
                inp = json.dumps(block.get("input") or {}, ensure_ascii=False)
                draft.add_turn(ts, "tool_use", inp, False, model, str(block.get("name") or "?"))
            elif btype == "tool_result":
                text = stringify_content(block.get("content") or block.get("output") or "")
                if text.strip():
                    draft.add_turn(ts, "tool_result", text, False, model)

        if str(e.get("role") or "") == "user":
            buffer.flush(draft)
            prompt_text = "\n\n".join(text_blocks).strip()
            if prompt_text:
                draft.add_prompt(ts, prompt_text, raw_ts <= 0)
                draft.add_turn(ts, "user", prompt_text)
        else:
            buffer.add(text_blocks, ts, model)
        if draft.full():
            break
    buffer.flush(draft)

    session_id = file_stem(path)
    if os.path.basename(os.path.dirname(path)) != str(opts.get("container_dir") or ""):
        session_id = os.path.basename(os.path.dirname(path))
    project = path_segment_after(path, str(opts.get("project_anchor") or ""))
    return one(draft.build(
        session_id,
        project=project,
        title=session_id,
        first_ts=draft.first_ts or mtime,
        last_ts=draft.last_ts or mtime,
    ))


__all__ = ["parse"]
