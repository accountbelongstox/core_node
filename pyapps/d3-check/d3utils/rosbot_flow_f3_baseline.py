# -*- coding: utf-8 -*-
"""
F3_Baseline start time (ROSBOT_FLOW_MERMAID F3_Baseline node). For flow/history timeout only, not for log.txt monitoring.
started_at is in memory only (time.time()), not read from or written to any file.
Used by F3 timeout (history/flow); log_monitor_thread reads logs.txt only and does not use this module.
"""
import time

from pycore.pyfoundations.color_print import ColorPrint

_f3_rosbot_started_at: float = 0.0


def get_f3_rosbot_started_at() -> float:
    """Return F3 baseline timestamp (0 if not set). Used by F3 log timeout logic."""
    return _f3_rosbot_started_at


def set_f3_rosbot_started_at() -> None:
    """Call when ROSBOT was just started this run; F3 uses this as timeout baseline."""
    global _f3_rosbot_started_at
    _f3_rosbot_started_at = time.time()
    ColorPrint.gray(f"[F3] set_f3_rosbot_started_at: started_at={_f3_rosbot_started_at:.3f}")
