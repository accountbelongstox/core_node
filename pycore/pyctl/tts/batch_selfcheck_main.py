#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Standalone TTS batch self-check entry (own process, clean console).

pyservice.ps1 / pyservice.sh run this entry to completion BEFORE launching the
main worker (pycore/pycore_module_caller.py): the sweep owns the console — no
interleaved service/worker logs — and the machine's RAM/VRAM, and only after it
exits does the shell start the RPC server and the remaining services.

Prints the test word batch and every directory involved, runs the sweep, prints
a per-engine summary, then offers to open the output directory (explorer on
Windows, xdg-open on Debian/Ubuntu, open on macOS).

Usage:
  python pycore/pyctl/tts/batch_selfcheck_main.py [--lang en] [--words a b c]
                                                  [--open | --no-open]
"""

import argparse
import os
import subprocess
import sys
from pathlib import Path

# Same sys.path contract as pycore/pycore_module_caller.py: the project root
# (parent of the pycore package) must be importable, and the package dir itself
# must NOT shadow submodule imports with duplicate module objects.
PYCORE_ROOT = Path(__file__).resolve().parents[2]          # .../core_node/pycore
PROJECT_ROOT = PYCORE_ROOT.parent                           # .../core_node
sys.path[:] = [p for p in sys.path
               if not (p and Path(p).resolve() == PYCORE_ROOT)]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.system_paths import apply_shared_cache_env

apply_shared_cache_env()

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyctl.tts import batch_startup_selfcheck as selfcheck
from pycore.pyutils.tts.batch import batch_constants as const


def _open_dir(path: Path) -> None:
    """Open a directory in the platform file manager (fire-and-forget)."""
    try:
        if sys.platform.startswith("win"):
            os.startfile(str(path))  # shell association == explorer
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(path)])
        else:  # Debian/Ubuntu and other freedesktop Linux
            subprocess.Popen(
                ["xdg-open", str(path)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        ColorPrint.green(f"[tts-selfcheck] opened {path}")
    except OSError as exc:
        ColorPrint.yellow(f"[tts-selfcheck] could not open {path}: {exc}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Standalone TTS batch self-check")
    parser.add_argument("--words", nargs="*", default=None,
                        help="Override the self-check word batch")
    parser.add_argument("--lang", default=const.SELFCHECK_LANG,
                        help=f"Language code (default: {const.SELFCHECK_LANG})")
    open_group = parser.add_mutually_exclusive_group()
    open_group.add_argument("--open", action="store_true",
                            help="Open the output directory when done (no prompt)")
    open_group.add_argument("--no-open", action="store_true",
                            help="Never prompt to open the output directory")
    args = parser.parse_args()

    words = [w.strip() for w in (args.words or []) if w.strip()] or None

    report = selfcheck.run_selfcheck(words=words, lang=args.lang)

    engines = report.get("engines") or []
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("[tts-selfcheck] summary")
    for entry in engines:
        status = entry.get("status", "?")
        line = (f"  {entry.get('engine', '?'):<10} {status:<8} "
                f"words_ok={entry.get('words_ok', 0)}/{entry.get('words_total', 0)} "
                f"elapsed={entry.get('elapsed_ms', 0)}ms")
        reason = entry.get("reason") or entry.get("error")
        if reason:
            line += f"  ({reason})"
        (ColorPrint.green if status == "ok" else ColorPrint.yellow)(line)
    ColorPrint.blue(f"[tts-selfcheck] report: {report.get('report_path', const.selfcheck_dir() / const.SELFCHECK_REPORT_NAME)}")
    ColorPrint.blue(f"[tts-selfcheck] output dir: {const.selfcheck_dir()}")
    ColorPrint.blue("=" * 70)

    out_dir = const.selfcheck_dir()
    if args.open:
        _open_dir(out_dir)
    elif not args.no_open and sys.stdin.isatty():
        try:
            answer = input("Open the self-check output directory now? [y/N]: ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            answer = ""
        if answer in ("y", "yes"):
            _open_dir(out_dir)

    failed = sum(1 for entry in engines if entry.get("status") == "failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
