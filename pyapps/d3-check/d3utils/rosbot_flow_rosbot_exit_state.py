# -*- coding: utf-8 -*-
"""
F3_ProcessGone 节点逻辑：Process gone 时 mark 原因 (ROSBOT_FLOW_MERMAID).
- set_f7_sent: F4b/面板/Debug 发 F7 时调用；之后 process gone 记为 normal_pause。
- mark_rosbot_exit_reason_when_process_gone: status_provider 或 F3 超时处调用；F7 sent=normal_pause，否则=test_debug_exit。
- Test：record 时长在 mark 时 count++；F3_Test 分支在 rosbot_flow_f3_log_timeout 内。
"""
from typing import Optional

from pycore.pyfoundations.color_print import ColorPrint

# Exit reason values: normal_pause = F7 sent then ROSBOT exited; test_debug_exit = process disappeared without F7
ROSBOT_EXIT_NORMAL_PAUSE = "normal_pause"
ROSBOT_EXIT_TEST_DEBUG = "test_debug_exit"

_f7_sent_for_rosbot: bool = False
_rosbot_exit_reason: Optional[str] = None
_recorded_debug_duration_sec: Optional[float] = None
_debug_exit_record_count: int = 0
_test_wait_50_percent_until: float = 0.0


def set_f7_sent_for_rosbot() -> None:
    """Call when F7 is sent to system to close/pause ROSBOT. Next time we detect process gone, mark as normal_pause."""
    global _f7_sent_for_rosbot
    _f7_sent_for_rosbot = True


def mark_rosbot_exit_reason_when_process_gone(debug_duration_sec: Optional[float] = None) -> str:
    """
    Call when ROSBOT process is detected gone. If F7 was sent recently -> normal_pause; else -> test_debug_exit.
    When test_debug_exit and debug_duration_sec is set, record DEBUG duration for test-mode tick logic.
    Returns the reason set (for logging).
    """
    global _f7_sent_for_rosbot, _rosbot_exit_reason, _recorded_debug_duration_sec, _debug_exit_record_count
    if _f7_sent_for_rosbot:
        _rosbot_exit_reason = ROSBOT_EXIT_NORMAL_PAUSE
        ColorPrint.gray("[ROSBOT_EXIT] normal_pause (F7 sent to system, ROSBOT exited)")
    else:
        _rosbot_exit_reason = ROSBOT_EXIT_TEST_DEBUG
        ColorPrint.gray("[ROSBOT_EXIT] test_debug_exit (process gone without F7)")
        if debug_duration_sec is not None and debug_duration_sec > 0:
            _recorded_debug_duration_sec = debug_duration_sec
            _debug_exit_record_count += 1
            ColorPrint.gray(f"[ROSBOT_EXIT] Record DEBUG duration: {debug_duration_sec:.1f}s, record_count={_debug_exit_record_count}")
    _f7_sent_for_rosbot = False
    return _rosbot_exit_reason


def get_rosbot_exit_reason() -> Optional[str]:
    """Return last set exit reason: normal_pause | test_debug_exit, or None."""
    return _rosbot_exit_reason


def clear_rosbot_exit_reason() -> None:
    """Clear stored reason (e.g. when ROSBOT is started again)."""
    global _rosbot_exit_reason
    _rosbot_exit_reason = None


def get_recorded_debug_duration_sec() -> Optional[float]:
    """Return recorded DEBUG duration (seconds) from last test_debug_exit, or None."""
    return _recorded_debug_duration_sec


def get_debug_exit_record_count() -> int:
    """Return number of times DEBUG duration was recorded (1 = first record, 2+ = has record)."""
    return _debug_exit_record_count


def set_test_wait_50_percent_until(until_ts: float) -> None:
    """Set state: waiting until until_ts then run E2 and continue test (test mode, not first record)."""
    global _test_wait_50_percent_until
    _test_wait_50_percent_until = until_ts


def get_test_wait_50_percent_until() -> float:
    """Return until timestamp when in wait-50%-then-E2 state; 0 = not in state."""
    return _test_wait_50_percent_until


def clear_test_wait_50_percent() -> None:
    """Clear wait-50%-then-E2 state."""
    global _test_wait_50_percent_until
    _test_wait_50_percent_until = 0.0
