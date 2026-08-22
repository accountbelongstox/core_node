# -*- coding: utf-8 -*-
"""
Code Sync runtime toggles backed by the unified user settings map.

Unlike role/peers (peer_config) and filter presets (sync_settings), these are
the dev "distributing" and client "skip_update" switches. Tray and UI both call
the same manager methods; persisting here keeps behaviour identical regardless
of which surface last changed a toggle.

The former runtime_prefs.json is read once as a migration source. New writes
go to the codesync_runtime section in user_data.json.
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, Optional

from pycore.pyutils.common.user_data_store import user_data_store

from pycore.pyutils.codesync.runtime import (
    get_codesync_cache_dir,
    init_serialized_owner,
    log as ColorPrint,
    serialized_method,
)

_KEYS = ("distributing", "skip_update")
_SECTION = "codesync_runtime"


def get_runtime_prefs_file() -> Path:
    return get_codesync_cache_dir() / "runtime_prefs.json"


class RuntimePrefs:
    def __init__(self, path: Optional[Path] = None):
        self._path = Path(path) if path else None
        self._legacy_path = get_runtime_prefs_file()
        init_serialized_owner(self, "codesync.runtime_prefs", "CodeSyncRuntimePrefs")

    def _read(self) -> Dict[str, Any]:
        if self._path is None:
            personalized = user_data_store.get_personalized_section(_SECTION)
            if personalized:
                return personalized
            legacy = self._read_file(self._legacy_path)
            if legacy:
                user_data_store.set_section(_SECTION, legacy)
                return legacy
            return user_data_store.get_section(_SECTION)
        return self._read_file(self._path)

    @staticmethod
    def _read_file(path: Path) -> Dict[str, Any]:
        try:
            if path.exists():
                data = json.loads(path.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    return data
        except Exception as exc:
            ColorPrint.yellow(f"[CodeSyncPrefs] read {path} failed: {exc}")
        return {}

    @serialized_method
    def get(self) -> Dict[str, bool]:
        raw = self._read()
        return {
            "distributing": bool(raw.get("distributing")),
            "skip_update": bool(raw.get("skip_update")),
        }

    @serialized_method
    def update(self, patch: Dict[str, Any]) -> Dict[str, bool]:
        data = self._read()
        for key in _KEYS:
            if key in patch and patch[key] is not None:
                data[key] = bool(patch[key])
        if self._path is None:
            user_data_store.set_section(_SECTION, data)
        else:
            try:
                self._path.parent.mkdir(parents=True, exist_ok=True)
                tmp = self._path.with_suffix(self._path.suffix + ".tmp")
                tmp.write_text(
                    json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True),
                    encoding="utf-8",
                )
                os.replace(str(tmp), str(self._path))
            except Exception as exc:
                ColorPrint.red(f"[CodeSyncPrefs] save {self._path} failed: {exc}")
        return self.get()


class _RuntimePrefsProvider:
    def __init__(self) -> None:
        self._instance: Optional[RuntimePrefs] = None
        init_serialized_owner(self, "codesync.runtime_prefs_provider", "CodeSyncRuntimePrefsProvider")

    @serialized_method
    def get(self) -> RuntimePrefs:
        if self._instance is None:
            self._instance = RuntimePrefs()
        return self._instance


_runtime_prefs_provider = _RuntimePrefsProvider()


def get_runtime_prefs() -> RuntimePrefs:
    return _runtime_prefs_provider.get()
