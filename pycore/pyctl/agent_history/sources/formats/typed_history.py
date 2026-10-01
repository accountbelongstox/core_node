# -*- coding: utf-8 -*-
"""Global typed-prompt lists: one JSONL row per prompt the user typed.

Declared options: ``text_fields`` / ``ts_fields`` (first truthy wins),
``name_field`` (per-row value stored as the turn name, e.g. the project),
``skip_prefixes`` (rows such as slash commands), ``raw_id`` (``{stem}`` is
the file stem) and ``title``. Undated rows take the file mtime and are
marked estimated.
"""

from __future__ import annotations

from typing import Any, Dict, List

from pycore.pyctl.agent_history.sources.source_kit import (
    SessionDraft,
    file_stem,
    first_field,
    is_injected_prompt,
    load_jsonl,
    one,
    ts_to_epoch,
)
from pycore.pyctl.agent_history.sources.source_specs import SourceSpec

ALL_PROJECTS = "(all projects)"


def parse(path: str, user: str, tool: str, spec: SourceSpec) -> List[Dict[str, Any]]:
    rows = load_jsonl(path)
    if not rows:
        return []
    opts = spec.options
    text_fields = tuple(opts["text_fields"])
    ts_fields = tuple(opts["ts_fields"])
    name_field = str(opts.get("name_field") or "")
    skip_prefixes = tuple(opts.get("skip_prefixes") or ())
    draft = SessionDraft(tool, user, path)
    for row in rows:
        text = str(first_field(row, text_fields) or "").strip()
        if not text or is_injected_prompt(text) or (skip_prefixes and text.startswith(skip_prefixes)):
            continue
        raw_ts = ts_to_epoch(first_field(row, ts_fields))
        ts = raw_ts or draft.mtime
        draft.seen(ts)
        draft.add_prompt(ts, text, raw_ts <= 0)
        name = str(row.get(name_field) or "") if name_field else None
        draft.add_turn(ts, "user", text, False, None, name)
        if draft.full():
            break
    raw_id = str(opts["raw_id"]).format(stem=file_stem(path))
    return one(draft.build(raw_id, project=ALL_PROJECTS, title=str(opts["title"])))


__all__ = ["parse"]
