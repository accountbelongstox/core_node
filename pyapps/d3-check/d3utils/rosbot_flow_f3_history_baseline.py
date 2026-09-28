# -*- coding: utf-8 -*-
"""
F3 history baseline (ROSBOT_FLOW_MERMAID F3_Baseline node). For history/flow timeout only; not for log.txt.
started_at is in memory only (time.time()), not read from or written to any file.
Used by F3 history timeout; log_monitor_thread reads logs.txt only and does not use this module.
"""
import time

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

_f3_history_started_at: float = 0.0


def get_f3_history_started_at() -> float:
    """Return F3 history baseline timestamp (0 if not set). Used by F3 history timeout."""
    return _f3_history_started_at


def set_f3_history_started_at() -> None:
    """Call when ROSBOT was just started this run; F3 history timeout uses this as baseline."""
    global _f3_history_started_at
    _f3_history_started_at = time.time()
    ColorPrint.gray(f"[F3] set_f3_history_started_at: started_at={_f3_history_started_at:.3f}")
