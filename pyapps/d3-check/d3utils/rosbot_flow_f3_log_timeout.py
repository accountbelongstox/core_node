# -*- coding: utf-8 -*-
"""
[F3] ROSBOT log timeout? (ROSBOT_FLOW_MERMAID.md F block).
Tied to UI 'timeout restart': if unchecked do not judge timeout (f3_stay); if checked use rosbot.timeout_minutes (dynamic from UI).
Timeout baseline: if D3+ROSBOT already present at start -> use log last modified time; if ROSBOT just started this run -> use start time (else fresh start with no log update would timeout immediately).
All ROSBOT log timeout logic must use get_rosbot_log_timeout_config() so UI settings are the single source.
When UI test mode is on and timeout is detected, also check if ROSBOT process still exists; if not, print session duration from F3 baseline (minutes).
"""
import time
from typing import Literal, Tuple

from providor.providor_index import get_config_value_safe
from providor.constants.d3 import ROSBOT_LOG_TIMEOUT_MINUTES_DEFAULT
from d3utils.key_send import send_f7_to_system
from d3utils.log_monitor import get_last_log_modified_time
from d3utils.rosbot_manager import get_rosbot_manager
from d3utils.rosbot_flow_rosbot_exit_state import (
    clear_test_wait_50_percent,
    get_debug_exit_record_count,
    get_rosbot_exit_reason,
    get_recorded_debug_duration_sec,
    get_test_wait_50_percent_until,
    mark_rosbot_exit_reason_when_process_gone,
    set_f7_sent_for_rosbot,
    set_test_wait_50_percent_until,
)
from d3utils.rosbot_flow.flow_e_rosbot_run import run_e2_sleep
from pycore.pyfoundations.color_print import ColorPrint

_f3_rosbot_started_at: float = 0.0


def get_rosbot_log_timeout_config() -> Tuple[bool, int]:
    """
    Single source for F3 log timeout: read from UI-backed CONFIG (battlenet.timeout_restart, rosbot.timeout_minutes).
    Returns (enabled, timeout_sec). Reuse this wherever ROSBOT log timeout is needed.
    """
    enabled = bool(get_config_value_safe("battlenet.timeout_restart", True))
    timeout_minutes = int(get_config_value_safe("rosbot.timeout_minutes", ROSBOT_LOG_TIMEOUT_MINUTES_DEFAULT))
    timeout_sec = max(1, timeout_minutes) * 60
    return (enabled, timeout_sec)


def set_f3_rosbot_started_at() -> None:
    """Call when ROSBOT was just started this run; F3 uses this as timeout baseline (avoid timeout on fresh start before log update)."""
    global _f3_rosbot_started_at
    _f3_rosbot_started_at = time.time()
    ColorPrint.gray(f"[F3] set_f3_rosbot_started_at: started_at={_f3_rosbot_started_at:.3f}")


def _fmt_ts(ts: float) -> str:
    if ts <= 0:
        return "-"
    try:
        return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts))
    except Exception:
        return str(ts)


def run_f3_log_timeout() -> Literal["f3_stay", "f4"]:
    """[F3] ROSBOT log timeout? Uses get_rosbot_log_timeout_config(); when test mode and timeout, check if ROSBOT process still exists and print session duration (min) from F3 baseline. Test mode: first record -> tick simulates 50%% then F4a; has record -> tick at recorded duration sends F7, simulates 50%% then E2, continue."""
    enabled, timeout_sec = get_rosbot_log_timeout_config()
    timeout_minutes = timeout_sec // 60
    now = time.time()
    last_log_ts = get_last_log_modified_time()
    started_at = _f3_rosbot_started_at
    test_mode = bool(get_config_value_safe("rosbot.test_mode", False))

    # Test mode: in wait-50%-then-E2 state and time reached -> E2 1s, reset baseline, continue
    wait_until = get_test_wait_50_percent_until()
    if test_mode and wait_until > 0 and now >= wait_until:
        clear_test_wait_50_percent()
        ColorPrint.gray("[F3] Test mode: 50%% simulated duration reached, run [E2] wait 1s, continue test")
        run_e2_sleep(1.0)
        set_f3_rosbot_started_at()
        return "f3_stay"

    if not enabled:
        ColorPrint.gray(
            f"[F3] log-timeout disabled by UI: battlenet.timeout_restart={enabled} -> f3_stay"
        )
        return "f3_stay"

    # Fresh start: use start time as baseline, allow timeout_sec before judging timeout
    fresh_start_window = started_at > 0 and (now - started_at) < timeout_sec + 60
    if fresh_start_window:
        baseline = started_at
        baseline_src = "started_at(fresh_start)"
    else:
        if last_log_ts <= 0:
            ColorPrint.gray(
                f"[F3] timeout check: enabled={enabled} timeout={timeout_minutes}min({timeout_sec}s) "
                f"now={now:.3f}({_fmt_ts(now)}) started_at={started_at:.3f}({_fmt_ts(started_at)}) "
                f"last_log_ts={last_log_ts:.3f}({_fmt_ts(last_log_ts)}) -> no log mtime, f4"
            )
            return "f4"
        baseline = last_log_ts
        baseline_src = "log_mtime"
    elapsed = now - baseline
    timed_out = elapsed >= timeout_sec
    ColorPrint.gray(
        f"[F3] timeout check: enabled={enabled} timeout={timeout_minutes}min({timeout_sec}s) "
        f"now={now:.3f}({_fmt_ts(now)}) started_at={started_at:.3f}({_fmt_ts(started_at)}) "
        f"last_log_ts={last_log_ts:.3f}({_fmt_ts(last_log_ts)}) baseline={baseline:.3f}({_fmt_ts(baseline)}) "
        f"baseline_src={baseline_src} elapsed={elapsed:.1f}s timed_out={timed_out}"
    )

    # Test mode tick logic: first record -> at 50% of recorded duration go F4a; has record -> at recorded duration send F7, then wait 50% then E2
    if test_mode and not timed_out:
        recorded = get_recorded_debug_duration_sec()
        record_count = get_debug_exit_record_count()
        if record_count == 1 and recorded and recorded > 0 and elapsed >= 0.5 * recorded:
            ColorPrint.gray(f"[F3] Test mode: first record, 50%%({0.5 * recorded:.1f}s) reached -> [F4a] close D3")
            return "f4"
        if record_count >= 2 and recorded and recorded > 0 and get_test_wait_50_percent_until() <= 0 and elapsed >= recorded:
            if send_f7_to_system():
                set_f7_sent_for_rosbot()
                set_test_wait_50_percent_until(now + 0.5 * recorded)
                ColorPrint.gray(
                    f"[F3] Test mode: has recorded DEBUG duration {recorded:.1f}s, F7 sent; will simulate 50%% then [E2] continue test"
                )
            return "f3_stay"

    if timed_out:
        # Test mode: when timeout, check if ROSBOT process still exists; if not, mark exit reason and record DEBUG duration, print session duration (minutes)
        if not get_rosbot_manager().is_running():
            mark_rosbot_exit_reason_when_process_gone(debug_duration_sec=elapsed if test_mode else None)
            if test_mode:
                elapsed_min = elapsed / 60.0
                reason = get_rosbot_exit_reason()
                reason_desc = "normal_pause" if reason == "normal_pause" else "test_debug_exit"
                ColorPrint.gray(
                    f"[F3] Session {elapsed_min:.1f} min long (from F3 baseline, ROSBOT process gone, {reason_desc})"
                )
        return "f4"
    return "f3_stay"
