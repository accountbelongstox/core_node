"""Public API for running the terminal finder."""

from __future__ import annotations

from typing import Iterable, List, Tuple

from ..config import FinderSettings, load_platform_definitions
from ..config.outputs import OutputPreferences
from .models import TerminalMatch
from .reporters import SummaryReporter
from .resolvers import CandidateAggregator
from .scanners import PathScanner
from .validators import ResultValidator


class TerminalFinder:
    def __init__(
        self,
        settings: FinderSettings | None = None,
        output_preferences: OutputPreferences | None = None,
    ) -> None:
        self.settings = settings or FinderSettings()
        self.output_preferences = output_preferences or OutputPreferences()

    def run(self) -> Tuple[List[TerminalMatch], List[TerminalMatch], str]:
        definitions = list(load_platform_definitions())
        scanner = PathScanner(self.settings)
        candidates = scanner.scan(definitions)
        matches = CandidateAggregator().build_matches(candidates)
        available, missing = ResultValidator().split(matches)
        summary = SummaryReporter(self.output_preferences).render(available, missing)
        return available, missing, summary
