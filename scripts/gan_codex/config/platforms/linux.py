"""Linux specific terminal definitions."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, List

from ..base.settings import TerminalDefinition


_COMMON_BIN = Path("/usr/bin")


def _paths(*suffixes: str) -> List[Path]:
    return [Path(path).expanduser() for path in suffixes]


def _make_definition(
    key: str,
    name: str,
    executables: Iterable[str],
    description: str,
    *paths: str,
) -> TerminalDefinition:
    base_paths = [_COMMON_BIN / exe for exe in executables]
    extra_paths = [Path(p) for p in paths]
    return TerminalDefinition(
        key=key,
        display_name=name,
        exec_names=tuple(executables),
        description=description,
        search_paths=tuple(base_paths + extra_paths),
    )


def get_definitions() -> List[TerminalDefinition]:
    return [
        _make_definition(
            "gnome-terminal",
            "GNOME Terminal",
            ["gnome-terminal"],
            "Default GNOME desktop terminal",
        ),
        _make_definition(
            "konsole",
            "Konsole",
            ["konsole"],
            "KDE Plasma terminal",
        ),
        _make_definition(
            "xterm",
            "xterm",
            ["xterm"],
            "Classic X11 terminal",
        ),
        _make_definition(
            "alacritty",
            "Alacritty",
            ["alacritty"],
            "GPU accelerated terminal",
            "/usr/local/bin/alacritty",
        ),
        _make_definition(
            "kitty",
            "Kitty",
            ["kitty"],
            "Fast GPU terminal",
            "/usr/local/bin/kitty",
        ),
        _make_definition(
            "wezterm",
            "WezTerm",
            ["wezterm"],
            "Wez's cross platform terminal",
            "/usr/local/bin/wezterm",
        ),
    ]
