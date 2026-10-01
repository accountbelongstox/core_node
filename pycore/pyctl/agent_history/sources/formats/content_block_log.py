# -*- coding: utf-8 -*-
"""Anthropic content-block session JSONL (Claude Code ``projects/*/*.jsonl``).

Human prompts (verified on Claude Code 2.1.283):
- ``type=user`` entries whose ``origin.kind`` is the declared human kind (or
  absent on older builds), excluding ``isMeta``, sidechain (subagent task)
  and injected harness text;
- ``type=attachment`` with ``attachment.type=queued_command`` and a human
  origin: prompts typed while a turn is running are absorbed mid-turn and
  never written as a user entry.
The same text recorded both ways within ``dedupe_window_s`` is kept once.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Tuple

from pycore.pyctl.agent_history.sources.source_kit import (
    SessionDraft,
    file_stem,
    is_injected_prompt,
    load_jsonl,
    one,
    stringify_content,
    truncate,
    ts_to_epoch,
)
from pycore.pyctl.agent_history.sources.source_specs import SourceSpec

PROMPT_DEDUPE_LOOKBACK = 8


def _is_human(origin: Any, human_kind: str) -> bool:
    if isinstance(origin, dict) and origin.get("kind"):
        return str(origin.get("kind")) == human_kind
    return True


def _classify_user(entry: Dict[str, Any]) -> Tuple[str, str]:
    content = (entry.get("message") or {}).get("content")
    if isinstance(content, list):
        chunks: List[str] = []
        is_tool_result = False
        for block in content:
            if not isinstance(block, dict):
                chunks.append(str(block))
                continue
            btype = block.get("type", "")
            if btype == "tool_result":
                is_tool_result = True
                chunks.append(stringify_content(block.get("content", "")))
            elif btype == "text":
                chunks.append(str(block.get("text", "")))
            elif btype == "image":
                chunks.append("[image]")
        text = "\n".join(c for c in chunks if c)
        if is_tool_result:
            return "tool_result", text
        return ("meta" if is_injected_prompt(text) else "prompt"), text
    text = content if isinstance(content, str) else stringify_content(content)
    return ("meta" if is_injected_prompt(text) else "prompt"), text or ""


def _add_prompt(draft: SessionDraft, ts: int, text: str, window_s: int) -> None:
    stored = truncate(text)
    for p in draft.prompts[-PROMPT_DEDUPE_LOOKBACK:]:
        if p["text"] == stored and abs(int(p["ts"] or 0) - ts) <= window_s:
            return
    draft.add_prompt(ts, text, ts <= 0)


def _add_assistant(draft: SessionDraft, entry: Dict[str, Any], ts: int, is_side: bool) -> None:
    msg = entry.get("message") or {}
    model = msg.get("model")
    draft.add_model(model)
    content = msg.get("content", [])
    if isinstance(content, str):
        content = [{"type": "text", "text": content}]
    if not isinstance(content, list):
        return
    for b in content:
        if not isinstance(b, dict):
            continue
        bt = b.get("type", "")
        if bt == "text" and str(b.get("text", "")).strip():
            draft.add_turn(ts, "assistant", str(b["text"]), is_side, model)
        elif bt == "thinking" and str(b.get("thinking", "")).strip():
            draft.add_turn(ts, "thinking", str(b["thinking"]), is_side, model)
        elif bt == "tool_use":
            inp = json.dumps(b.get("input") or {}, ensure_ascii=False)
            draft.add_turn(ts, "tool_use", inp, is_side, model, str(b.get("name") or "?"))


def parse(path: str, user: str, tool: str, spec: SourceSpec) -> List[Dict[str, Any]]:
    rows = load_jsonl(path)
    if not rows:
        return []
    human_kind = str(spec.options["human_origin_kind"])
    window_s = int(spec.options["dedupe_window_s"])
    draft = SessionDraft(tool, user, path)
    session_id = project = title = ""

    for e in rows:
        etype = e.get("type", "")
        ts = ts_to_epoch(e.get("timestamp"))
        draft.seen(ts)
        session_id = session_id or str(e.get("sessionId") or "")
        project = project or str(e.get("cwd") or "")
        is_side = e.get("isSidechain") is True
        draft.has_subagent = draft.has_subagent or is_side

        if etype == "ai-title":
            title = str(e.get("title") or e.get("message") or title)
        elif etype == "attachment":
            att = e.get("attachment") or {}
            if att.get("type") != "queued_command" or not _is_human(att.get("origin"), human_kind):
                continue
            text = str(att.get("prompt") or "").strip()
            if text and not is_injected_prompt(text) and not is_side:
                _add_prompt(draft, ts, text, window_s)
                draft.add_turn(ts, "user", text, is_side)
        elif etype == "user":
            kind, text = _classify_user(e)
            text = text.strip()
            if not text:
                continue
            if kind == "prompt" and (e.get("isMeta") or not _is_human(e.get("origin"), human_kind)):
                kind = "meta"
            if kind == "prompt":
                if not is_side:
                    # Sidechain user entries are AI-dispatched subagent tasks.
                    _add_prompt(draft, ts, text, window_s)
                draft.add_turn(ts, "user", text, is_side)
            elif kind == "tool_result":
                draft.add_turn(ts, "tool_result", text, is_side)
        elif etype == "assistant":
            _add_assistant(draft, e, ts, is_side)

        if draft.full():
            break

    return one(draft.build(session_id or file_stem(path), project=project, title=title))


__all__ = ["parse"]
