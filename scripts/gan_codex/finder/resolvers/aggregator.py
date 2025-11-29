"""Aggregate candidate information into matches."""

from __future__ import annotations

from typing import Iterable, List

from ..models import TerminalCandidate, TerminalMatch


class CandidateAggregator:
    def build_matches(self, candidates: Iterable[TerminalCandidate]) -> List[TerminalMatch]:
        matches: List[TerminalMatch] = []
        for candidate in candidates:
            definition = candidate.definition
            matches.append(
                TerminalMatch(
                    key=definition.key,
                    name=definition.display_name,
                    description=definition.description,
                    paths=candidate.resolved_paths,
                )
            )
        matches.sort(key=lambda item: (not item.is_available, item.name.lower()))
        return matches
