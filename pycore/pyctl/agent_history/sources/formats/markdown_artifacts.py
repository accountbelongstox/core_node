# -*- coding: utf-8 -*-
"""Directory of plaintext markdown work artifacts, one session per directory.

Used where raw conversation blobs are unreadable (Antigravity
``brain/<conversation-uuid>/*.md``: the ``conversations/*.pb`` blobs are
encrypted on disk). Every artifact (task.md, implementation_plan.md, ...) is a
"user" fragment, the closest available to a prompt; names containing an
``ARTIFACT_SKIP_MARKERS`` value are ignored. The session title is the first
heading of the declared ``title_file``.
"""

from __future__ import annotations

import os
from glob import glob
from typing import Any, Dict, List, Optional

from pycore.pyctl.agent_history.sources.source_kit import (
    SessionDraft,
    one,
    read_text,
    stat_source,
)
from pycore.pyctl.agent_history.sources.source_specs import SourceSpec

ARTIFACT_PATTERN = "*.md"
ARTIFACT_SKIP_MARKERS = (".resolved", ".metadata.json")


def _artifacts(directory: str) -> List[str]:
    return [
        f for f in sorted(glob(os.path.join(directory, ARTIFACT_PATTERN)))
        if not any(marker in os.path.basename(f) for marker in ARTIFACT_SKIP_MARKERS)
    ]


def describe(directory: str) -> Optional[Dict[str, Any]]:
    """Directory descriptor: newest artifact mtime and total artifact bytes."""
    files = _artifacts(directory)
    if not files:
        return None
    mtime = nbytes = 0
    for f in files:
        file_mtime, file_bytes = stat_source(f)
        mtime = max(mtime, file_mtime)
        nbytes += file_bytes
    return {"path": directory, "mtime": mtime, "bytes": nbytes}


def _title(files: List[str], title_file: str, fallback: str) -> str:
    for f in files:
        if os.path.basename(f) != title_file:
            continue
        for line in (read_text(f) or "").splitlines():
            line = line.strip()
            if line.startswith("#"):
                return line.lstrip("#").strip() or fallback
            if line:
                break
    return fallback


def parse(path: str, user: str, tool: str, spec: SourceSpec) -> List[Dict[str, Any]]:
    if not os.path.isdir(path):
        return []
    files = _artifacts(path)
    draft = SessionDraft(tool, user, path)
    for f in files:
        text = (read_text(f) or "").strip()
        if not text:
            continue
        mtime, _ = stat_source(f)
        draft.seen(mtime)
        draft.add_prompt(mtime, text, True)
        draft.add_turn(mtime, "user", text, False, None, os.path.basename(f))
        if draft.full():
            break
    conv_id = os.path.basename(path)
    return one(draft.build(conv_id, title=_title(files, str(spec.options.get("title_file") or ""), conv_id)))


__all__ = ["describe", "parse"]
