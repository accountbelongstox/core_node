# -*- coding: utf-8 -*-
"""Runtime orchestration policy selected by the Pyservice startup mode."""

from __future__ import annotations

import os

from pycore.pyutils.common.pyservice_mode import (
    PY_SERVICE_MODE_DEFAULT,
    PY_SERVICE_MODE_ENVIRONMENT_KEY,
    persist_pyservice_mode,
    pyservice_mode_contract,
    read_persisted_pyservice_mode,
)


class PyserviceModeService:
    """Own the immutable startup mode used by runtime composition.

    Resolution order: explicit environment value (persisted on sight) ->
    persisted user-config cache -> default local-ui mode.
    """

    def __init__(self) -> None:
        env_value = os.environ.get(PY_SERVICE_MODE_ENVIRONMENT_KEY)
        if env_value is not None:
            self._mode = self.configure(env_value)
            return
        self._mode = read_persisted_pyservice_mode() or PY_SERVICE_MODE_DEFAULT

    def configure(self, value: str) -> str:
        mode = pyservice_mode_contract.normalize(value)
        self._mode = mode
        os.environ[PY_SERVICE_MODE_ENVIRONMENT_KEY] = mode
        persist_pyservice_mode(mode)
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
