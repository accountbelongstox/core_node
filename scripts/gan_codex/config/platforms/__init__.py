"""Platform specific terminal definitions."""

from __future__ import annotations

import sys
from typing import Iterable

from ..base.settings import TerminalDefinition
from . import linux, macos, windows


def load_platform_definitions() -> Iterable[TerminalDefinition]:
    """Return terminal definitions for the active platform."""

    platform = sys.platform
    if platform.startswith("win"):
        return windows.get_definitions()
    if platform == "darwin":
        return macos.get_definitions()
    return linux.get_definitions()
