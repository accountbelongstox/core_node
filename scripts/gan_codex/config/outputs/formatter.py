"""Simple output preference container."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class OutputPreferences:
    """Represent how the CLI should emit information."""

    show_missing: bool = True
    compact: bool = False
