"""Classify finder matches."""

from __future__ import annotations

from typing import Iterable, List, Tuple

from ..models import TerminalMatch


class ResultValidator:
    def split(self, matches: Iterable[TerminalMatch]) -> Tuple[List[TerminalMatch], List[TerminalMatch]]:
        available: List[TerminalMatch] = []
        missing: List[TerminalMatch] = []
        for match in matches:
            (available if match.is_available else missing).append(match)
        return available, missing
