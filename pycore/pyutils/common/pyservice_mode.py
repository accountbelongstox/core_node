# -*- coding: utf-8 -*-
"""Canonical Pyservice startup mode vocabulary."""

from __future__ import annotations

from typing import Dict


PY_SERVICE_MODE_LOCAL_UI = "1"
PY_SERVICE_MODE_RELAY_UI = "2"
PY_SERVICE_MODE_DEFAULT = PY_SERVICE_MODE_LOCAL_UI
PY_SERVICE_MODE_ENVIRONMENT_KEY = "PYCORE_SERVICE_MODE"
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


__all__ = ["pyservice_mode_contract"]
