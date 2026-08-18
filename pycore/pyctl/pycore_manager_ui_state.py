# -*- coding: utf-8 -*-
from __future__ import annotations

from typing import Any, Dict

from pycore.pyfoundations.revisioned_json_store import RevisionedJsonStore
from pycore.pyfoundations.serialized_worker import SerializedWorkerThread, call_serialized
from pycore.pyfoundations.system_paths import get_ui_state_cache_dir


_SCHEMA_VERSION = 1
_MAX_KEYS = 128
_MAX_KEY_CHARACTERS = 128
_MAX_VALUE_CHARACTERS = 512_000
_MAX_DOCUMENT_CHARACTERS = 2_000_000
_WORK_QUEUE = "pyctl.pycore_manager.ui_state.operations"


def _sanitize_values(value: Any) -> Dict[str, str]:
    source = value if isinstance(value, dict) else {}
    values: Dict[str, str] = {}
    for key, raw_value in list(source.items())[:_MAX_KEYS]:
        normalized_key = str(key)
        if not normalized_key or len(normalized_key) > _MAX_KEY_CHARACTERS:
            continue
        if not isinstance(raw_value, str) or len(raw_value) > _MAX_VALUE_CHARACTERS:
            continue
        values[normalized_key] = raw_value
    document_characters = sum(
        len(key) + len(raw_value) for key, raw_value in values.items()
    )
    if document_characters > _MAX_DOCUMENT_CHARACTERS:
        raise ValueError("pycore-manager UI state exceeds the document size limit")
    return values


_STORE = RevisionedJsonStore(
    get_ui_state_cache_dir() / "pycore_manager_ui_state.json",
    _SCHEMA_VERSION,
    _sanitize_values,
)


def _read_state() -> Dict[str, Any]:
    return _STORE.read()


def _write_state(
    values: Dict[str, str],
    base_revision: int,
    initialize_only: bool,
) -> Dict[str, Any]:
    return _STORE.write(values, base_revision, initialize_only)


_WORKER = SerializedWorkerThread(_WORK_QUEUE, "PycoreManagerUiStateThread")
_WORKER.start()


def read_pycore_manager_ui_state() -> Dict[str, Any]:
    return call_serialized(_WORK_QUEUE, _read_state)


def write_pycore_manager_ui_state(
    values: Dict[str, str],
    base_revision: int,
    initialize_only: bool = False,
) -> Dict[str, Any]:
    return call_serialized(
        _WORK_QUEUE,
        _write_state,
        values,
        base_revision,
        initialize_only,
    )


__all__ = [
    "read_pycore_manager_ui_state",
    "write_pycore_manager_ui_state",
]
