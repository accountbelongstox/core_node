# -*- coding: utf-8 -*-
"""
[F3] ROSBOT timeout? (ROSBOT_FLOW_MERMAID.md F block). For flow/history timeout only; not for log.txt file monitoring (log_monitor_thread does that).
Flow layer: called by flow_master on 2s tick; reads last_modified (get_last_log_modified_time) for history baseline.
Node logic:
- F3_Baseline: baseline = last_log_ts when log from current run; else started_at when just started (no current-run log yet); else f4 only when no started_at. Chosen inside run_f3_log_timeout().
- F3_LogTimeout: this function; not timed out -> f3_stay (stay in F3), timed out -> F3_ProcessGone or F4a.
- F3_ProcessGone: when process gone, mark (F7 sent=normal_pause else=test_debug_exit). On timeout and !is_running() call mark_rosbot_exit_reason_when_process_gone (rosbot_flow_rosbot_exit_state).
- F3_Test: count=1 and 50%% -> F4a; count>=2 and elapsed>=recorded -> F7, then 50%% -> [E2] 1s. test_mode branch in this file.
Tied to UI 'timeout restart': if unchecked do not judge timeout (f3_stay); if checked use rosbot.timeout_minutes (get_rosbot_log_timeout_config).

Test mode logic (rosbot.test_mode=True, state in rosbot_flow_rosbot_exit_state):
- record_count / recorded: set only when F3 times out and process is already gone (timed_out and not is_running());
  mark_rosbot_exit_reason_when_process_gone(debug_duration_sec=elapsed) then sets recorded=elapsed, record_count+=1.
  status_provider on run->not_found calls mark without duration, so it does not set recorded/count.
- Branch 1 (earliest): wait_until > 0 and now >= wait_until -> clear wait, run E2 1s, set_f3_rosbot_started_at(), f3_stay.
  Used after "count>=2" path: we sent F7 and set wait_until = now + 0.5*recorded; when that time is reached we continue test.
- Branch 2 (only when not timed_out): record_count==1 and elapsed >= 0.5*recorded -> F4a (close D3). First recorded session
  already happened in a previous run; this run we stop at 50%% of that duration.
- Branch 3 (only when not timed_out): record_count>=2 and elapsed >= recorded and wait_until<=0 -> send F7, set wait_until
  = now+0.5*recorded, f3_stay. Simulates full run then pause; after 50%% we hit Branch 1 and E2 1s.
  If ROSBOT exits after F7 before wait_until, next F3-only refresh may see not_found and leave F3-only, so E2 1s may not run (by design).
- Timeout branch (timed_out): if not is_running() call mark(debug_duration_sec=elapsed) so next run has updated record.
"""
import time
from typing import Literal, Optional, Tuple

from providor.providor_index import get_config_value_safe
from providor.constants.d3 import ROSBOT_LOG_TIMEOUT_MINUTES_DEFAULT
from d3utils.key_send import send_f7_to_system
from d3utils.log_monitor_api import get_last_log_modified_time
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
from d3utils.rosbot_flow_f3_baseline import get_f3_rosbot_started_at, set_f3_rosbot_started_at
from d3utils.rosbot_flow.flow_e_rosbot_run import run_e2_sleep
from pycore.pyfoundations.color_print import ColorPrint

_last_f3_short_status: str = ""


def get_last_f3_short_status() -> str:
    """One-line F3 status for same-line refresh (e.g. 'F3: 30min elapsed=164s ok'). Set by run_f3_log_timeout()."""
    return _last_f3_short_status


def get_rosbot_log_timeout_config() -> Tuple[bool, int]:
    """
    Single source for F3 log timeout: read from UI-backed CONFIG (battlenet.timeout_restart, rosbot.timeout_minutes or rosbot.test_timeout_minutes when test_mode).
    Returns (enabled, timeout_sec). Reuse this wherever ROSBOT log timeout is needed.
    When rosbot.test_mode is True, use rosbot.test_timeout_minutes (default 30min) instead of rosbot.timeout_minutes (default 8min).
    """
    enabled = bool(get_config_value_safe("battlenet.timeout_restart", True))
    test_mode = bool(get_config_value_safe("rosbot.test_mode", False))
    if test_mode:
        # TEST mode: use rosbot.test_timeout_minutes (default 30min)
        timeout_minutes = int(get_config_value_safe("rosbot.test_timeout_minutes", 30))
    else:
        # Normal mode: use rosbot.timeout_minutes (default 8min)
        timeout_minutes = int(get_config_value_safe("rosbot.timeout_minutes", ROSBOT_LOG_TIMEOUT_MINUTES_DEFAULT))
    timeout_sec = max(1, timeout_minutes) * 60
    return (enabled, timeout_sec)


def _fmt_ts(ts: float) -> str:
    if ts <= 0:
        return "-"
    try:
        return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(ts))
    except Exception:
        return str(ts)


def get_test_mode_display_string() -> Optional[str]:
    """When rosbot.test_mode is True, return one-line summary for UI (elapsed, timeout, record_count, recorded, wait_until). Else None."""
    if not get_config_value_safe("rosbot.test_mode", False):
        return None
    now = time.time()
    last_log_ts = get_last_log_modified_time()
    started_at = get_f3_rosbot_started_at()
    log_is_current_run = last_log_ts > 0 and started_at > 0 and last_log_ts >= started_at
    if log_is_current_run:
        baseline = last_log_ts
    elif started_at > 0:
        baseline = started_at
    else:
        baseline = now
    elapsed = now - baseline
    _, timeout_sec = get_rosbot_log_timeout_config()
    timeout_min = timeout_sec // 60
    recorded = get_recorded_debug_duration_sec()
    record_count = get_debug_exit_record_count()
    wait_until = get_test_wait_50_percent_until()
    parts = [f"elapsed {elapsed:.0f}s", f"timeout {timeout_min}min"]
    if recorded and recorded > 0 and record_count >= 1:
        parts.append(f"record {record_count}x {recorded:.0f}s")
    if wait_until > 0:
        remain = max(0, wait_until - now)
        parts.append(f"50%% then E2 remain {remain:.0f}s")
    return " | ".join(parts)


def run_f3_log_timeout(verbose: bool = True) -> Literal["f3_stay", "f4"]:
    """[F3] ROSBOT log timeout? Baseline: log mtime when present (resets on new log); else started_at when fresh start. On timeout+process gone call mark (test passes duration). Test: count=1 and 50%% -> F4a; count>=2 and elapsed>=recorded -> F7 then 50%% -> [E2] 1s (no D3 close). ROSBOT_FLOW_MERMAID: F3_Baseline->F3_LogTimeout; timeout->F3_ProcessGone->F4a; F3_Test branches done in this function. verbose=False: do not print long line, only set get_last_f3_short_status()."""
    global _last_f3_short_status
    _last_f3_short_status = ""
    enabled, timeout_sec = get_rosbot_log_timeout_config()
    timeout_minutes = timeout_sec // 60
    now = time.time()
    last_log_ts = get_last_log_modified_time()
    started_at = get_f3_rosbot_started_at()
    test_mode = bool(get_config_value_safe("rosbot.test_mode", False))

    # [F3_Test] Test mode: when wait-50%-then-E2 reached -> run [E2] 1s, reset baseline, stay F3
    wait_until = get_test_wait_50_percent_until()
    if test_mode and wait_until > 0 and now >= wait_until:
        clear_test_wait_50_percent()
        ColorPrint.gray("[F3] Test mode: 50%% simulated duration reached, run [E2] wait 1s, continue test")
        run_e2_sleep(1.0)
        set_f3_rosbot_started_at()
        return "f3_stay"

    if not enabled:
        _last_f3_short_status = "F3: disabled"
        if verbose:
            ColorPrint.gray(
                f"[F3] log-timeout disabled by UI: battlenet.timeout_restart={enabled} -> f3_stay"
            )
        return "f3_stay"

    # [F3_Baseline] Per ROSBOT_FLOW_MERMAID: when log from current run -> baseline = log mtime; when just started (no current-run log yet) -> baseline = started_at. Only use log-based timeout after we have seen log from this run.
    log_is_current_run = last_log_ts > 0 and started_at > 0 and last_log_ts >= started_at
    if log_is_current_run:
        baseline = last_log_ts
        baseline_src = "log_mtime"
    elif started_at > 0:
        # No current-run log yet (just started or log mtime from previous run): use start time as baseline until we see log from this run. Do not treat as "stale log" and kill.
        baseline = started_at
        baseline_src = "started_at(no_log_yet)"
    elif last_log_ts > 0:
        # Stale log from previous run and we have no started_at -> no valid baseline, f4
        _last_f3_short_status = "F3: stale log -> f4"
        if verbose:
            ColorPrint.gray(
                f"[F3] timeout check: last_log_ts from previous run ({_fmt_ts(last_log_ts)}), no started_at -> f4"
            )
        return "f4"
    else:
        _last_f3_short_status = "F3: no log mtime -> f4"
        if verbose:
            ColorPrint.gray(
                f"[F3] timeout check: enabled={enabled} timeout={timeout_minutes}min({timeout_sec}s) "
                f"now={now:.3f}({_fmt_ts(now)}) started_at={started_at:.3f}({_fmt_ts(started_at)}) "
                f"last_log_ts={last_log_ts:.3f}({_fmt_ts(last_log_ts)}) -> no log mtime, f4"
            )
        return "f4"
    elapsed = now - baseline
    timed_out = elapsed >= timeout_sec
    _last_f3_short_status = f"F3: {timeout_minutes}min elapsed={elapsed:.0f}s {'timeout' if timed_out else 'ok'}"
    if verbose:
        ColorPrint.gray(
            f"[F3] timeout check: enabled={enabled} timeout={timeout_minutes}min({timeout_sec}s) "
            f"now={now:.3f}({_fmt_ts(now)}) started_at={started_at:.3f}({_fmt_ts(started_at)}) "
            f"last_log_ts={last_log_ts:.3f}({_fmt_ts(last_log_ts)}) baseline={baseline:.3f}({_fmt_ts(baseline)}) "
            f"baseline_src={baseline_src} elapsed={elapsed:.1f}s timed_out={timed_out}"
        )

    # [F3_Test] Test: count=1 and 50%% -> F4a; count>=2 and elapsed>=recorded -> F7, then 50%% -> [E2] 1s.
    # When both 50%% and timed_out hold, we skip this block (not timed_out false) and fall through to timeout branch -> mark(elapsed), f4; intent: prefer 50%% stop only before timeout.
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

    # [F3_LogTimeout] Timeout -> F3_ProcessGone (when process gone mark: F7 sent=normal_pause else=test_debug_exit) -> F4a
    if timed_out:
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
