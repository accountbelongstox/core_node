# -*- coding: utf-8 -*-
"""Response-item rollout JSONL (Codex CLI ``sessions/YYYY/MM/DD/rollout-*.jsonl``).

Rows carry ``type``/``record_type`` plus a ``payload`` (``session_meta``,
``message``, ``function_call``, ``function_call_output``)."""

from __future__ import annotations

import json
from typing import Any, Dict, List

from pycore.pyctl.agent_history.sources.source_kit import (
    SessionDraft,
    file_stem,
    is_injected_prompt,
    load_jsonl,
    one,
    ts_to_epoch,
)
from pycore.pyctl.agent_history.sources.source_specs import SourceSpec


def _response_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts: List[str] = []
    for b in content:
        if isinstance(b, dict) and "text" in b:
            parts.append(str(b["text"]))
        elif isinstance(b, str):
            parts.append(b)
    return "\n".join(parts)


def parse(path: str, user: str, tool: str, spec: SourceSpec) -> List[Dict[str, Any]]:
    rows = load_jsonl(path)
    if not rows:
        return []
    draft = SessionDraft(tool, user, path)
    session_id = project = ""
    for e in rows:
        ts = ts_to_epoch(e.get("timestamp"))
        draft.seen(ts)
        etype = e.get("type") or e.get("record_type") or ""
        payload = e.get("payload") or e
        ptype = payload.get("type", "")

        if etype == "session_meta" or ptype == "session_meta":
            session_id = session_id or str(payload.get("id") or "")
            project = project or str(payload.get("cwd") or "")
            continue
        if not project and payload.get("cwd"):
            project = str(payload["cwd"])

        if ptype == "message":
            role = str(payload.get("role") or "assistant")
            text = _response_text(payload.get("content") or [])
            if not text.strip():
                continue
            if role == "user" and is_injected_prompt(text):
                draft.add_turn(ts, "system", text)
            elif role == "user":
                draft.add_prompt(ts, text, ts <= 0)
                draft.add_turn(ts, "user", text)
            else:
                draft.add_turn(ts, "assistant", text)
        elif ptype == "function_call":
            args = json.dumps(payload.get("arguments"), ensure_ascii=False)
            draft.add_turn(ts, "tool_use", args, False, None, str(payload.get("name") or "?"))
        elif ptype == "function_call_output":
            draft.add_turn(ts, "tool_result", str(payload.get("output") or ""))

        if draft.full():
            break
    return one(draft.build(session_id or file_stem(path), project=project))


__all__ = ["parse"]
