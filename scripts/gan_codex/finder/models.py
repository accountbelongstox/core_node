"""Dataclasses shared across finder modules."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Tuple

from ..config import TerminalDefinition


@dataclass(frozen=True)
class TerminalCandidate:
    definition: TerminalDefinition
    resolved_paths: Tuple[Path, ...]

    @property
    def found(self) -> bool:
        return bool(self.resolved_paths)


@dataclass(frozen=True)
class TerminalMatch:
    key: str
    name: str
    description: str
    paths: Tuple[Path, ...]

    @property
    def is_available(self) -> bool:
        return bool(self.paths)
