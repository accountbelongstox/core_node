# -*- coding: utf-8 -*-
"""
F3_ProcessGone: mark exit reason when process gone (ROSBOT_FLOW_MERMAID).
- set_f7_sent: called when F4b/panel/Debug sends F7; then process gone is recorded as normal_pause.
- mark_rosbot_exit_reason_when_process_gone: called from status_provider or F3 timeout; F7 sent -> normal_pause, else test_debug_exit.
- Test: record duration count++ on mark; F3_Test branches in rosbot_flow_f3_log_timeout.
- Test recorded/count persisted in CONFIG (rosbot.test_recorded_duration_sec, rosbot.test_record_count); loaded at startup.
"""
from typing import Optional

from pycore.pyfoundations.color_print import ColorPrint

from providor.providor_index import get_config_value_safe, set_config_value_async

# Config keys for test-mode recorded duration and count (persisted across restarts)
CONFIG_KEY_TEST_RECORDED_DURATION_SEC = "rosbot.test_recorded_duration_sec"
CONFIG_KEY_TEST_RECORD_COUNT = "rosbot.test_record_count"
# Config key for total restart count (all types: normal_pause, test_debug_exit, process gone, log disconnect)
CONFIG_KEY_TOTAL_RESTART_COUNT = "rosbot.total_restart_count"

# Exit reason values: normal_pause = F7 sent then ROSBOT exited; test_debug_exit = process disappeared without F7
ROSBOT_EXIT_NORMAL_PAUSE = "normal_pause"
ROSBOT_EXIT_TEST_DEBUG = "test_debug_exit"

_f7_sent_for_rosbot: bool = False
_rosbot_exit_reason: Optional[str] = None
_recorded_debug_duration_sec: Optional[float] = None
_debug_exit_record_count: int = 0
_test_wait_50_percent_until: float = 0.0
_test_record_loaded_from_config: bool = False
_total_restart_count: int = 0
_total_restart_count_loaded_from_config: bool = False


def _load_test_record_from_config() -> None:
    """Load test recorded duration and count from CONFIG once per process (so next startup uses persisted values)."""
    global _recorded_debug_duration_sec, _debug_exit_record_count, _test_record_loaded_from_config
    if _test_record_loaded_from_config:
        return
    _test_record_loaded_from_config = True
    try:
        v = get_config_value_safe(CONFIG_KEY_TEST_RECORDED_DURATION_SEC, None)
        if v is not None:
            f = float(v) if isinstance(v, (int, float)) else None
            if f is not None and f > 0:
                _recorded_debug_duration_sec = f
        c = get_config_value_safe(CONFIG_KEY_TEST_RECORD_COUNT, 0)
        if isinstance(c, int) and c >= 0:
            _debug_exit_record_count = c
        elif isinstance(c, (float, str)):
            try:
                _debug_exit_record_count = int(c)
                if _debug_exit_record_count < 0:
                    _debug_exit_record_count = 0
            except (ValueError, TypeError):
                pass
    except Exception:
        pass


def _load_total_restart_count_from_config() -> None:
    """Load total restart count from CONFIG once per process."""
    global _total_restart_count, _total_restart_count_loaded_from_config
    if _total_restart_count_loaded_from_config:
        return
    _total_restart_count_loaded_from_config = True
    try:
        c = get_config_value_safe(CONFIG_KEY_TOTAL_RESTART_COUNT, 0)
        if isinstance(c, int) and c >= 0:
            _total_restart_count = c
        elif isinstance(c, (float, str)):
            try:
                _total_restart_count = int(c)
                if _total_restart_count < 0:
                    _total_restart_count = 0
            except (ValueError, TypeError):
                pass
    except Exception:
        pass


def set_f7_sent_for_rosbot() -> None:
    """Call when F7 is sent to system to close/pause ROSBOT. Next time we detect process gone, mark as normal_pause."""
    global _f7_sent_for_rosbot
    _f7_sent_for_rosbot = True


def mark_rosbot_exit_reason_when_process_gone(debug_duration_sec: Optional[float] = None) -> str:
    """
    Call when ROSBOT process is detected gone. If F7 was sent recently -> normal_pause; else -> test_debug_exit.
    When test_debug_exit and debug_duration_sec is set, record DEBUG duration for test-mode tick logic.
    Increments total restart count for all exit types.
    Returns the reason set (for logging).
    """
    global _f7_sent_for_rosbot, _rosbot_exit_reason, _recorded_debug_duration_sec, _debug_exit_record_count, _total_restart_count
    _load_total_restart_count_from_config()
    if _f7_sent_for_rosbot:
        _rosbot_exit_reason = ROSBOT_EXIT_NORMAL_PAUSE
        ColorPrint.gray("[ROSBOT_EXIT] normal_pause (F7 sent to system, ROSBOT exited)")
    else:
        _rosbot_exit_reason = ROSBOT_EXIT_TEST_DEBUG
        ColorPrint.gray("[ROSBOT_EXIT] test_debug_exit (process gone without F7)")
        if debug_duration_sec is not None and debug_duration_sec > 0:
            _recorded_debug_duration_sec = debug_duration_sec
            _debug_exit_record_count += 1
            set_config_value_async(CONFIG_KEY_TEST_RECORDED_DURATION_SEC, _recorded_debug_duration_sec)
            set_config_value_async(CONFIG_KEY_TEST_RECORD_COUNT, _debug_exit_record_count)
            ColorPrint.gray(f"[ROSBOT_EXIT] Record DEBUG duration: {debug_duration_sec:.1f}s, record_count={_debug_exit_record_count}")
    # Increment total restart count for all exit types
    _total_restart_count += 1
    set_config_value_async(CONFIG_KEY_TOTAL_RESTART_COUNT, _total_restart_count)
    ColorPrint.gray(f"[ROSBOT_EXIT] Total restart count: {_total_restart_count}")
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
    """Return recorded DEBUG duration (seconds) from last test_debug_exit, or None. Loads from CONFIG on first call."""
    _load_test_record_from_config()
    return _recorded_debug_duration_sec


def get_debug_exit_record_count() -> int:
    """Return number of times DEBUG duration was recorded (1 = first record, 2+ = has record). Loads from CONFIG on first call."""
    _load_test_record_from_config()
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


def increment_total_restart_count() -> None:
    """Increment total restart count (for log disconnect or other restart triggers). Call when restart is triggered."""
    global _total_restart_count
    _load_total_restart_count_from_config()
    _total_restart_count += 1
    set_config_value_async(CONFIG_KEY_TOTAL_RESTART_COUNT, _total_restart_count)
    ColorPrint.gray(f"[ROSBOT_RESTART] Total restart count: {_total_restart_count}")


def get_total_restart_count() -> int:
    """Return total restart count (all types: normal_pause, test_debug_exit, process gone, log disconnect). Loads from CONFIG on first call."""
    _load_total_restart_count_from_config()
    return _total_restart_count
