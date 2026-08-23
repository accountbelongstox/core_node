# -*- coding: utf-8 -*-
"""Runtime orchestration policy selected by the Pyservice startup mode."""

from __future__ import annotations

import os

from pycore.pyutils.common.pyservice_mode import (
    PY_SERVICE_MODE_DEFAULT,
    PY_SERVICE_MODE_ENVIRONMENT_KEY,
    pyservice_mode_contract,
)


class PyserviceModeService:
    """Own the immutable startup mode used by runtime composition."""

    def __init__(self) -> None:
        self._mode = pyservice_mode_contract.normalize(
            os.environ.get(
                PY_SERVICE_MODE_ENVIRONMENT_KEY,
                PY_SERVICE_MODE_DEFAULT,
            )
        )

    def configure(self, value: str) -> str:
        mode = pyservice_mode_contract.normalize(value)
        self._mode = mode
        os.environ[PY_SERVICE_MODE_ENVIRONMENT_KEY] = mode
        return mode

    def mode(self) -> str:
        return self._mode

    def allowed_modes(self) -> tuple[str, ...]:
        return pyservice_mode_contract.values()

    def name(self) -> str:
        return pyservice_mode_contract.name(self._mode)

    def local_ui_enabled(self) -> bool:
        return pyservice_mode_contract.local_ui_enabled(self._mode)

    def relay_enabled(self) -> bool:
        return pyservice_mode_contract.relay_enabled(self._mode)


pyservice_mode_service = PyserviceModeService()


__all__ = ["pyservice_mode_service"]
