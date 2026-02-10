# -*- coding: utf-8 -*-
"""
[F3] ROSBOT log timeout? (ROSBOT_FLOW_MERMAID.md F block).
Tied to UI 'timeout restart': if unchecked do not judge timeout (f3_stay); if checked use rosbot.timeout_minutes.
Timeout baseline: if D3+ROSBOT already present at start -> use log last modified time; if ROSBOT just started this run -> use start time (else fresh start with no log update would timeout immediately).
"""
import time
from typing import Literal

from providor.providor_index import CONFIG
from d3utils.log_monitor import get_last_log_modified_time
from pycore.pyfoundations.color_print import ColorPrint

_f3_rosbot_started_at: float = 0.0


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
    """[F3] ROSBOT log timeout? Only when UI has 'timeout restart' checked; timeout minutes from rosbot.timeout_minutes."""
    enabled = bool(CONFIG.get("battlenet", {}).get("timeout_restart", True))
    timeout_minutes = CONFIG.get("rosbot", {}).get("timeout_minutes", 8)
    timeout_sec = max(1, int(timeout_minutes)) * 60
    now = time.time()
    last_log_ts = get_last_log_modified_time()
    started_at = _f3_rosbot_started_at

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
    if timed_out:
        return "f4"
    return "f3_stay"
