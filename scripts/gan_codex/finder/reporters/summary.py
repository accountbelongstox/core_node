"""Produce human readable summaries."""

from __future__ import annotations

from typing import Iterable, List

from ...config.outputs import OutputPreferences
from ..models import TerminalMatch


class SummaryReporter:
    def __init__(self, preferences: OutputPreferences | None = None):
        self.preferences = preferences or OutputPreferences()

    def render(
        self,
        available: Iterable[TerminalMatch],
        missing: Iterable[TerminalMatch],
    ) -> str:
        lines: List[str] = []
        lines.append("Detected terminal programs:")
        lines.extend(self._format_group("Available", available))
        if self.preferences.show_missing:
            lines.extend(self._format_group("Missing", missing))
        return "\n".join(lines)

    def _format_group(self, title: str, matches: Iterable[TerminalMatch]) -> List[str]:
        matches = list(matches)
        if not matches:
            return [f"  {title}: none"]
        lines = [f"  {title} ({len(matches)}):"]
        for match in matches:
            if match.paths:
                location = ", ".join(str(p) for p in match.paths)
            else:
                location = "<not found>"
            lines.append(f"    - {match.name}: {location}")
            if match.description and not self.preferences.compact:
                lines.append(f"        {match.description}")
        return lines
