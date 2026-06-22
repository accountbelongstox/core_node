# -*- coding: utf-8 -*-
"""
F3-only refresh: one identifier, one refresh-print. When True, D3/ROSBOT refresh and manager do not print;
flow_master_driver builds one line and gray_refresh once so all F3-only messages appear on the same line.
"""
from typing import Optional

_f3_refresh_silent: bool = False


def set_f3_refresh_silent(value: bool) -> None:
    global _f3_refresh_silent
    _f3_refresh_silent = value


def is_f3_refresh_silent() -> bool:
    return _f3_refresh_silent


def build_f3_only_refresh_line(
    status_prefix: str,
    d3_ok: bool,
    rosbot_status: str,
    f3_short: str,
) -> str:
    """Build single line for F3-only refresh: Tick | D3 | ROSBOT | F3. running = no main UI; paused = main UI visible."""
    d3 = "ok" if d3_ok else "no"
    return f"{status_prefix}D3 {d3} | ROSBOT {rosbot_status} | {f3_short}"
