# -*- coding: utf-8 -*-
"""
F3_Baseline 起算状态 (ROSBOT_FLOW_MERMAID F3_Baseline 节点).
起算：已存在 -> log 最后修改时间（F3 内 run_f3_log_timeout 取）；刚启动 -> 本 started_at（UI 时长）。Set when ROSBOT just started (E/D/extension/panel); read by F3 log timeout.
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
