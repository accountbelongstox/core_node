# -*- coding: utf-8 -*-
"""Canonical Pyservice startup mode vocabulary."""

from __future__ import annotations

import json
import os
from typing import Dict, Optional

from pycore.pyfoundations.app_config_path import get_app_config_dir


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
        with open(cache_path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
        return pyservice_mode_contract.normalize(payload.get("mode"))
    except (OSError, ValueError, KeyError, AttributeError):
        return None


def persist_pyservice_mode(mode: str) -> bool:
    """Cache the mode in the user config store (atomic write).

    Best-effort: an unwritable store (e.g. a missing Windows D: drive) must
    never break startup, so OSError degrades to False instead of raising.
    """
    normalized = pyservice_mode_contract.normalize(mode)
    try:
        cache_path = get_app_config_dir() / PY_SERVICE_MODE_CACHE_FILE
        temp_path = cache_path.with_suffix(".json.tmp")
        with open(temp_path, "w", encoding="utf-8") as handle:
            json.dump({"mode": normalized}, handle)
        os.replace(temp_path, cache_path)
    except OSError:
        return False
    return True


__all__ = [
    "pyservice_mode_contract",
    "read_persisted_pyservice_mode",
    "persist_pyservice_mode",
]
