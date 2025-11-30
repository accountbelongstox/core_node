"""macOS specific terminal definitions."""

from __future__ import annotations

from pathlib import Path
from typing import List

from ..base.settings import TerminalDefinition


def _app_path(app_name: str) -> Path:
    return Path("/Applications") / f"{app_name}.app/Contents/MacOS/{app_name}"


def get_definitions() -> List[TerminalDefinition]:
    return [
        TerminalDefinition(
            key="terminal",
            display_name="Terminal.app",
            exec_names=("/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal",),
            description="Default macOS Terminal application",
            search_paths=(
                Path("/Applications/Utilities/Terminal.app/Contents/MacOS/Terminal"),
            ),
        ),
        TerminalDefinition(
            key="iterm",
            display_name="iTerm2",
            exec_names=("iterm2", "iTerm2"),
            description="Popular replacement terminal",
            search_paths=(
                Path("/Applications/iTerm.app/Contents/MacOS/iTerm2"),
                Path("/Applications/iTerm.app/Contents/MacOS/iTerm"),
                Path("/Applications/iTerm2.app/Contents/MacOS/iTerm2"),
            ),
        ),
        TerminalDefinition(
            key="kitty",
            display_name="Kitty",
            exec_names=("kitty",),
            description="Kitty terminal",
            search_paths=(
                _app_path("kitty"),
                Path("/usr/local/bin/kitty"),
            ),
        ),
        TerminalDefinition(
            key="wezterm",
            display_name="WezTerm",
            exec_names=("wezterm",),
            description="WezTerm GPU terminal",
            search_paths=(
                _app_path("WezTerm"),
                Path("/usr/local/bin/wezterm"),
            ),
        ),
    ]
