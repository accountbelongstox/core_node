# -*- coding: utf-8 -*-
"""Role/content message lists stored as a JSON document or JSONL rows.

Declared options:
- ``containers``: list keys of a JSON object document (first list wins; a
  bare object without one is a single record);
- ``skip_types``: record ``type`` values that are not messages;
- ``role_fields`` / ``role_map`` / ``default_role``: role lookup (record
  ``message`` object first, then the record) mapped to a turn role;
  unmapped roles take ``default_role``, or are skipped when it is empty;
- ``text_fields``, ``ts_fields``: first truthy value wins;
- ``start_field`` / ``end_field`` / ``id_field``: session-level document keys;
- ``raw_id``: ``stem`` (file stem) or ``parent_dir``;
- ``project``: a literal, or ``project_from_dir`` with ``project_skip_dirs``.
Undated records take the document start/end time, else file mtime + order.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List

from pycore.pyctl.agent_history.sources.source_kit import (
    SessionDraft,
    file_stem,
    first_field,
    load_records,
    one,
    stringify_content,
    ts_to_epoch,
)
from pycore.pyctl.agent_history.sources.source_specs import SourceSpec

RAW_ID_PARENT_DIR = "parent_dir"


def project_dir_name(path: str, skip_dirs: tuple) -> str:
    parent = os.path.dirname(path)
    if os.path.basename(parent) in skip_dirs:
        parent = os.path.dirname(parent)
    return os.path.basename(parent)


def _records(document: Any, containers: tuple) -> List[Any]:
    if isinstance(document, list):
        return document
    if not isinstance(document, dict):
        return []
    for key in containers:
        candidate = document.get(key)
        if isinstance(candidate, list):
            return candidate
    return [document]


def parse_document(document: Any, path: str, user: str, tool: str, spec: SourceSpec) -> List[Dict[str, Any]]:
    opts = spec.options
    role_fields = tuple(opts["role_fields"])
    role_map: Dict[str, str] = dict(opts["role_map"])
    default_role = str(opts.get("default_role") or "")
    text_fields = tuple(opts["text_fields"])
    ts_fields = tuple(opts["ts_fields"])
    skip_types = tuple(opts.get("skip_types") or ())
    doc = document if isinstance(document, dict) else {}
    doc_start = ts_to_epoch(doc.get(opts.get("start_field") or ""))
    doc_end = ts_to_epoch(doc.get(opts.get("end_field") or ""))

    draft = SessionDraft(tool, user, path)
    draft.seen(doc_start)
    draft.seen(doc_end)
    for index, row in enumerate(_records(document, tuple(opts.get("containers") or ()))):
        if not isinstance(row, dict):
            continue
        if skip_types and str(row.get("type") or "").lower() in skip_types:
            continue
        message = row.get("message") if isinstance(row.get("message"), dict) else row
        role_value = str(first_field(message, role_fields) or first_field(row, role_fields) or "").lower()
        role = role_map.get(role_value) or default_role
        if not role:
            continue
        body = stringify_content(first_field(message, text_fields) or first_field(row, text_fields) or "").strip()
        if not body:
            continue
        ts = ts_to_epoch(first_field(row, ts_fields) or first_field(message, ts_fields))
        ts_estimated = ts <= 0
        if ts_estimated:
            ts = doc_start or doc_end or draft.file_ts(index)
        draft.seen(ts)
        draft.add_turn(
            ts,
            role,
            body,
            model=message.get("model") or row.get("model"),
            name=message.get("toolName") or row.get("toolName"),
        )
        if role == "user":
            draft.add_prompt(ts, body, ts_estimated)
        if draft.full():
            break

    if opts.get("raw_id") == RAW_ID_PARENT_DIR:
        raw_id = os.path.basename(os.path.dirname(path))
    else:
        raw_id = str(doc.get(opts.get("id_field") or "") or file_stem(path))
    if opts.get("project_from_dir"):
        project = project_dir_name(path, tuple(opts.get("project_skip_dirs") or ()))
    else:
        project = str(opts.get("project") or "")
    return one(draft.build(raw_id, project=project, title=draft.title_from_prompts(raw_id)))


def parse(path: str, user: str, tool: str, spec: SourceSpec) -> List[Dict[str, Any]]:
    return parse_document(load_records(path), path, user, tool, spec)


__all__ = ["parse", "parse_document", "project_dir_name"]
