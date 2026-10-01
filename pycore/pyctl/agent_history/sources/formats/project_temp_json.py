# -*- coding: utf-8 -*-
"""Gemini CLI project-temp files (``tmp/<project-hash>/...``), by shape:
- object with ``messages``: chat session -> ``message_list`` with the
  declared ``chat`` options;
- list in ``logs.json``: prompt log rows grouped by ``sessionId``;
- any other list: checkpoint / saved-tag contents (``role`` + ``parts``)."""

from __future__ import annotations

import json
import os
from dataclasses import replace
from typing import Any, Dict, List, Optional

from pycore.pyctl.agent_history.sources.formats import message_list
from pycore.pyctl.agent_history.sources.source_kit import (
    SessionDraft,
    file_stem,
    load_records,
    one,
    ts_to_epoch,
)
from pycore.pyctl.agent_history.sources.source_specs import SourceSpec

LOGS_FILE = "logs.json"


def _logs(rows: List[Any], path: str, user: str, tool: str, project: str) -> List[Dict[str, Any]]:
    by_session: Dict[str, List[Dict[str, Any]]] = {}
    for row in rows:
        if isinstance(row, dict):
            by_session.setdefault(str(row.get("sessionId") or "default"), []).append(row)
    out: List[Dict[str, Any]] = []
    for sid, items in by_session.items():
        draft = SessionDraft(tool, user, path)
        for row in items:
            ts = ts_to_epoch(row.get("timestamp"))
            draft.seen(ts)
            text = str(row.get("message") or "").strip()
            if not text:
                continue
            if str(row.get("type") or "") == "user":
                draft.add_prompt(ts, text, ts <= 0)
                draft.add_turn(ts, "user", text)
            else:
                draft.add_turn(ts, "assistant", text)
            if draft.full():
                break
        session = draft.build(f"log-{project}-{sid}", project=project)
        if session:
            out.append(session)
    return out


def _part_text(parts: List[Any]) -> tuple:
    text = ""
    is_call = is_resp = False
    call_name: Optional[str] = None
    for p in parts:
        if not isinstance(p, dict):
            continue
        if "text" in p:
            text += ("\n" if text else "") + str(p["text"])
        elif "functionCall" in p:
            is_call = True
            call_name = str((p["functionCall"] or {}).get("name") or "?")
            text += json.dumps((p["functionCall"] or {}).get("args"), ensure_ascii=False)
        elif "functionResponse" in p:
            is_resp = True
            text += json.dumps((p["functionResponse"] or {}).get("response"), ensure_ascii=False)
    return text.strip(), is_call, is_resp, call_name


def _checkpoint(contents: List[Any], path: str, user: str, tool: str, project: str) -> Optional[Dict[str, Any]]:
    draft = SessionDraft(tool, user, path)
    ts = draft.mtime
    for c in contents:
        if not isinstance(c, dict) or not isinstance(c.get("parts") or [], list):
            continue
        text, is_call, is_resp, call_name = _part_text(c.get("parts") or [])
        if not text:
            continue
        if is_call:
            draft.add_turn(ts, "tool_use", text, False, None, call_name)
        elif is_resp:
            draft.add_turn(ts, "tool_result", text)
        elif str(c.get("role") or "") == "user":
            draft.add_prompt(ts, text, True)
            draft.add_turn(ts, "user", text)
        else:
            draft.add_turn(ts, "assistant", text)
        if draft.full():
            break
    stem = file_stem(path)
    return draft.build(f"{project}-{stem}", project=project, title=stem, first_ts=ts, last_ts=ts)


def parse(path: str, user: str, tool: str, spec: SourceSpec) -> List[Dict[str, Any]]:
    data = load_records(path)
    chat = dict(spec.options["chat"])
    if isinstance(data, dict) and isinstance(data.get("messages"), list):
        return message_list.parse_document(data, path, user, tool, replace(spec, options=chat))
    if not isinstance(data, list):
        return []
    project = message_list.project_dir_name(path, tuple(chat.get("project_skip_dirs") or ()))
    if os.path.basename(path) == LOGS_FILE:
        return _logs(data, path, user, tool, project)
    return one(_checkpoint(data, path, user, tool, project))


__all__ = ["LOGS_FILE", "parse"]
