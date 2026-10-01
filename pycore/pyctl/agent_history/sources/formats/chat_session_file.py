# -*- coding: utf-8 -*-
"""Chat-session files of VS Code-family editors
(``workspaceStorage/<id>/chatSessions/<session>.json[l]`` and
``globalStorage/emptyWindowChatSessions/``).

``.json`` files hold one session document. ``.jsonl`` files are a mutation
log: a ``kind`` 0 row carries the initial document in ``v``, ``kind`` 1 sets
the value ``v`` at key path ``k``, ``kind`` 2 appends the items ``v`` to the
list at ``k`` (truncating it to index ``i`` first when given), and
``kind`` 3 deletes the key at ``k``. The replayed document is read with the
declared ``ChatLayout`` (option ``chat``).
"""

from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from pycore.pyctl.agent_history.sources.formats.chat_conversations import document_sessions
from pycore.pyctl.agent_history.sources.source_kit import file_stem, load_json, load_jsonl
from pycore.pyctl.agent_history.sources.source_specs import SourceSpec

LOG_INITIAL = 0
LOG_SET = 1
LOG_PUSH = 2
LOG_DELETE = 3


def _parent(document: Any, path: List[Any]) -> Optional[Any]:
    node = document
    for key in path[:-1]:
        if isinstance(node, dict) and key in node:
            node = node[key]
        elif isinstance(node, list) and isinstance(key, int) and 0 <= key < len(node):
            node = node[key]
        else:
            return None
    return node


def _set(document: Any, path: List[Any], value: Any) -> None:
    node = _parent(document, path)
    key = path[-1]
    if isinstance(node, dict):
        node[key] = value
    elif isinstance(node, list) and isinstance(key, int):
        if 0 <= key < len(node):
            node[key] = value
        elif key == len(node):
            node.append(value)


def _target(document: Any, path: List[Any]) -> Optional[Any]:
    if not path:
        return document
    node = _parent(document, path)
    key = path[-1]
    if isinstance(node, dict):
        return node.get(key)
    if isinstance(node, list) and isinstance(key, int) and 0 <= key < len(node):
        return node[key]
    return None


def replay_log(rows: List[Dict[str, Any]]) -> Any:
    document: Any = None
    for row in rows:
        kind = row.get("kind")
        path = row.get("k") if isinstance(row.get("k"), list) else []
        if kind == LOG_INITIAL:
            document = row.get("v")
        elif document is None:
            continue
        elif kind == LOG_SET and path:
            _set(document, path, row.get("v"))
        elif kind == LOG_PUSH:
            target = _target(document, path)
            if isinstance(target, list):
                if isinstance(row.get("i"), int):
                    del target[row["i"]:]
                target.extend(row.get("v") if isinstance(row.get("v"), list) else [])
        elif kind == LOG_DELETE and path:
            node = _parent(document, path)
            if isinstance(node, dict):
                node.pop(path[-1], None)
    return document


def parse(path: str, user: str, tool: str, spec: SourceSpec) -> List[Dict[str, Any]]:
    document = replay_log(load_jsonl(path)) if path.lower().endswith(".jsonl") else load_json(path)
    project = os.path.basename(os.path.dirname(os.path.dirname(path)))
    return document_sessions(document, spec.options["chat"], path, user, tool, file_stem(path), project)


__all__ = ["parse", "replay_log"]
