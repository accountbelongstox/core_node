# -*- coding: utf-8 -*-
"""
Unified tick driver: single clock source, use % to simulate flow periods. No third-party independent timers.
- Clock: task thread calls on_tick() every 1s, _global_tick_count += 1.
- Flow periods (% based):
  - flow_master / bn_only: tick % 2 == 0 (every 2 ticks = 2s, matches _flow_tick_count)
  - smart_echo OCR: tick % 3 == 0 (every 3 ticks = 3s)
  - sigint_guard: tick % 1 == 0 (GUI mode reset SIGINT every 1s)
  - inactive_refresh: tick % 10 == 0 (when flow off refresh status every 10s)
- Log monitor: driven only by watchdog (file change), not from tick.
"""
from typing import Optional

import timers.window_monitor_timer as _wm
import d3utils.smart_echo as _smart
from d3utils.signal_utils import _reapply_sigint_sigbreak_ignore
from pycore.pyfoundations.color_print import ColorPrint

_global_tick_count: int = 0

# Flow periods (tick count, 1 tick = 1s)
TICK_FLOW_STEP = 2
TICK_SMART_ECHO = 3
TICK_INACTIVE_REFRESH = 10
TICK_SIGINT_GUARD = 1


def get_global_tick() -> int:
    """Current global tick count (+1 every 1s)."""
    return _global_tick_count


def get_flow_tick_from_global() -> int:
    """Flow step tick: every 2 global ticks = 1 flow tick (aligned with rosbot_task_processor._flow_tick_count)."""
    return _global_tick_count // TICK_FLOW_STEP


def on_tick() -> None:
    """
    Called once per 1s by task thread. Increment _global_tick_count, dispatch by %:
    - sigint_guard (tick % 1), smart_echo (tick % 3), inactive_refresh (tick % 10).
    Log monitor is driven only by watchdog (file change), not here.
    Do not call flow here (process_rosbot_task calls when tick % 2 == 0).
    """
    global _global_tick_count
    _global_tick_count += 1
    t = _global_tick_count

    if t % TICK_SIGINT_GUARD == 0:
        try:
            _reapply_sigint_sigbreak_ignore()
        except Exception as e:
            ColorPrint.red(f"[TickDriver] sigint_guard: {e}")

    if t % TICK_SMART_ECHO == 0:
        try:
            _smart.on_tick_from_driver()
        except Exception as e:
            ColorPrint.red(f"[TickDriver] smart_echo: {e}")

    if t % TICK_INACTIVE_REFRESH == 0:
        try:
            _wm.refresh_window_status_if_inactive()
        except Exception as e:
            ColorPrint.red(f"[TickDriver] inactive_refresh: {e}")
