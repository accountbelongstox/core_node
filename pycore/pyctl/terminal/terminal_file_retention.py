# -*- coding: utf-8 -*-
"""Count/age retention shared by the terminal file stores."""

from __future__ import annotations

import os
import time
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


def prune_files(directory: Path, retain_count: int, retain_seconds: int, label: str) -> None:
    """Drop files older than the retention window, then the oldest beyond the count cap."""
    if not directory.is_dir():
        return
    try:
        entries = sorted(
            ((entry.stat().st_mtime, Path(entry.path)) for entry in os.scandir(directory) if entry.is_file()),
            reverse=True,
        )
    except OSError as exc:
        ColorPrint.yellow(f"[{label}] scan failed dir={directory}: {exc}")
        return
    cutoff = time.time() - retain_seconds
    for index, (mtime, path) in enumerate(entries):
        if index < retain_count and mtime >= cutoff:
            continue
        try:
            path.unlink()
        except OSError as exc:
            ColorPrint.yellow(f"[{label}] prune failed path={path}: {exc}")
