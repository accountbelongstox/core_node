"""CLI entry-point for the terminal auto finder."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Iterable

from .config import FinderSettings
from .config.outputs import OutputPreferences
from .finder import TerminalFinder
from .finder.window_controller import TerminalWindowController


def _parse_args(argv: Iterable[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Automatically discover installed terminal applications.",
    )
    parser.add_argument(
        "--extra-path",
        action="append",
        default=[],
        metavar="PATH",
        help="Additional directories to scan for terminal executables",
    )
    parser.add_argument(
        "--hide-missing",
        action="store_true",
        help="Suppress the missing terminals list",
    )
    parser.add_argument(
        "--compact",
        action="store_true",
        help="Render a single line per terminal without descriptions",
    )
    return parser.parse_args(argv)


def run(argv: Iterable[str] | None = None) -> int:
    args = _parse_args(argv)
    settings = FinderSettings.from_paths(args.extra_path)
    preferences = OutputPreferences(show_missing=not args.hide_missing, compact=args.compact)

    finder = TerminalFinder(settings=settings, output_preferences=preferences)
    available, missing, summary = finder.run()
    print(summary)

    controller = TerminalWindowController()
    if controller.is_supported:
        if available:
            clicked = controller.click_first_available(available)
            if not clicked:
                print("[WindowController] No matching terminal window found to click.")
        else:
            print("[WindowController] No available terminals to interact with.")
    else:
        print("[WindowController] Window automation libraries are unavailable on this platform.")
    return 0 if available else 1


if __name__ == "__main__":
    sys.exit(run())
