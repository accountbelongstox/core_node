# -*- coding: utf-8 -*-
"""
Code Sync runtime toggles backed by the unified user settings map.

Unlike role/peers (peer_config) and filter presets (sync_settings), these are
the dev "distributing" and client "skip_update" switches. Tray and UI both call
the same manager methods; persisting here keeps behaviour identical regardless
of which surface last changed a toggle.

The former runtime_prefs.json is migrated into user_data.json once, then deleted.
"""

from typing import Any, Dict

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.codesync.legacy_json import migrate_legacy_json_section
from pycore.pyutils.codesync.paths import codesync_cache_dir
from pycore.pyutils.common.user_data_store import user_data_store

_KEYS = ("distributing", "skip_update")
_SECTION = "codesync_runtime"
LEGACY_RUNTIME_PREFS_FILE_NAME = "runtime_prefs.json"


class RuntimePrefs:
    def __init__(self) -> None:
        self._migrated = False
        init_serialized_owner(self, "codesync.runtime_prefs", "CodeSyncRuntimePrefs")

    def _read(self) -> Dict[str, Any]:
        if not self._migrated:
            migrate_legacy_json_section(codesync_cache_dir() / LEGACY_RUNTIME_PREFS_FILE_NAME, _SECTION)
            self._migrated = True
        return dict(user_data_store.get_section(_SECTION) or {})

    @serialized_method
    def get(self) -> Dict[str, bool]:
        raw = self._read()
        return {key: bool(raw.get(key)) for key in _KEYS}

    @serialized_method
    def update(self, patch: Dict[str, Any]) -> Dict[str, bool]:
        data = self._read()
        for key in _KEYS:
            if key in patch and patch[key] is not None:
                data[key] = bool(patch[key])
        user_data_store.set_section(_SECTION, data)
        return self.get()


runtime_prefs = RuntimePrefs()


__all__ = ["RuntimePrefs", "runtime_prefs"]
