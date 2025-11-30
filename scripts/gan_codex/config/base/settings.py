"""Dataclasses shared by the configuration packages."""

from __future__ import annotations

from dataclasses import dataclass, replace
from pathlib import Path
from typing import Iterable, Tuple


@dataclass(frozen=True)
class TerminalDefinition:
    """Describe how to locate a terminal application on disk."""

    key: str
    display_name: str
    exec_names: Tuple[str, ...]
    description: str = ""
    search_paths: Tuple[Path, ...] = tuple()

    def with_extra_paths(self, paths: Iterable[Path]) -> "TerminalDefinition":
        """Return a copy that also checks the provided paths."""

        merged = tuple(dict.fromkeys((*self.search_paths, *paths)))
        return replace(self, search_paths=merged)


@dataclass(frozen=True)
class FinderSettings:
    """Runtime options for the finder."""

    custom_search_paths: Tuple[Path, ...] = tuple()
    require_executable: bool = True

    @classmethod
    def from_paths(cls, paths: Iterable[str | Path]) -> "FinderSettings":
        normalized = tuple(Path(p).expanduser() for p in paths)
        return cls(custom_search_paths=normalized)

    def expand_paths(self) -> Tuple[Path, ...]:
        return tuple(p.expanduser() for p in self.custom_search_paths)
