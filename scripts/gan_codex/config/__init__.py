"""Configuration helpers for the terminal auto finder."""

from .base.settings import FinderSettings, TerminalDefinition
from .monitoring import MonitoringPreferences
from .outputs import OutputPreferences
from .platforms import load_platform_definitions

__all__ = [
    "FinderSettings",
    "TerminalDefinition",
    "MonitoringPreferences",
    "OutputPreferences",
    "load_platform_definitions",
]
