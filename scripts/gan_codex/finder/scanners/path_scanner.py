"""Scan the file-system for terminal executables."""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Iterable, List, Sequence

from ...config import FinderSettings, TerminalDefinition
from ..models import TerminalCandidate


class PathScanner:
    def __init__(self, settings: FinderSettings):
        self.settings = settings

    def scan(self, definitions: Sequence[TerminalDefinition]) -> List[TerminalCandidate]:
        extra_dirs = self.settings.expand_paths()
        candidates: List[TerminalCandidate] = []
        for definition in definitions:
            resolved = self._resolve_definition(definition, extra_dirs)
            candidates.append(TerminalCandidate(definition, resolved))
        return candidates

    def _resolve_definition(
        self, definition: TerminalDefinition, extra_dirs: Sequence[Path]
    ) -> tuple[Path, ...]:
        ordered: List[Path] = []

        def add_path(path: Path | None):
            if not path:
                return
            path = path.expanduser()
            if self.settings.require_executable and not os.access(path, os.X_OK):
                return
            if not path.exists():
                return
            if path not in ordered:
                ordered.append(path)

        for exec_name in definition.exec_names:
            found = shutil.which(exec_name)
            if found:
                add_path(Path(found))
            exec_path = Path(exec_name)
            if exec_path.is_absolute():
                add_path(exec_path)
            else:
                for directory in extra_dirs:
                    add_path(directory / exec_name)

        for candidate in definition.search_paths:
            add_path(candidate)

        return tuple(ordered)
