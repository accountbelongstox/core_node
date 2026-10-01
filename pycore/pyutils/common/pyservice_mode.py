# -*- coding: utf-8 -*-
"""Canonical Pyservice startup mode vocabulary."""

from __future__ import annotations

import json
from typing import Dict, Optional

from pycore.pyfoundations.atomic_json_store import atomic_write_json
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.system_paths import get_app_config_dir


PY_SERVICE_MODE_LOCAL_UI = "1"
PY_SERVICE_MODE_RELAY_UI = "2"
PY_SERVICE_MODE_DEFAULT = PY_SERVICE_MODE_LOCAL_UI
PY_SERVICE_MODE_ENVIRONMENT_KEY = "PYCORE_SERVICE_MODE"
PY_SERVICE_MODE_CACHE_FILE = "pyservice_mode.json"
PY_SERVICE_MODE_NAMES: Dict[str, str] = {
    PY_SERVICE_MODE_LOCAL_UI: "local-ui",
    PY_SERVICE_MODE_RELAY_UI: "relay-ui",
}


class PyserviceModeContract:
    """Validate modes and expose transport-neutral mode capabilities."""

    @staticmethod
    def normalize(value: str) -> str:
        normalized = str(value or PY_SERVICE_MODE_DEFAULT).strip()
        if normalized not in PY_SERVICE_MODE_NAMES:
            raise ValueError("pyservice_mode_invalid")
        return normalized

    @staticmethod
    def values() -> tuple[str, ...]:
        return tuple(PY_SERVICE_MODE_NAMES)

    def name(self, value: str) -> str:
        return PY_SERVICE_MODE_NAMES[self.normalize(value)]

    def local_ui_enabled(self, value: str) -> bool:
        return self.normalize(value) == PY_SERVICE_MODE_LOCAL_UI

    def relay_enabled(self, value: str) -> bool:
        return self.normalize(value) == PY_SERVICE_MODE_RELAY_UI


pyservice_mode_contract = PyserviceModeContract()


def read_persisted_pyservice_mode() -> Optional[str]:
    """Return the cached mode from the user config store, or None."""
    try:
        cache_path = get_app_config_dir() / PY_SERVICE_MODE_CACHE_FILE
        if not cache_path.is_file():
            return None
        payload = json.loads(cache_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        ColorPrint.yellow(f"[PyserviceMode] read cached mode failed: {exc}")
        return None
    if not isinstance(payload, dict):
        return None
    return pyservice_mode_contract.normalize(payload.get("mode"))


def persist_pyservice_mode(mode: str) -> bool:
    """Cache the mode in the user config store (atomic write).

    Best-effort: an unwritable store (e.g. a missing Windows D: drive) must
    never break startup, so OSError degrades to False instead of raising.
    """
    normalized = pyservice_mode_contract.normalize(mode)
    try:
        atomic_write_json(get_app_config_dir() / PY_SERVICE_MODE_CACHE_FILE, {"mode": normalized}, indent=None)
    except OSError as exc:
        ColorPrint.yellow(f"[PyserviceMode] persist mode={normalized} failed: {exc}")
        return False
    return True


__all__ = [
    "pyservice_mode_contract",
    "read_persisted_pyservice_mode",
    "persist_pyservice_mode",
]
