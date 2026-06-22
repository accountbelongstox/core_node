# -*- coding: utf-8 -*-
"""
Read RoS-BoT history.txt: parse last N lines for Session stats.
Boting duration and all /h rates use time since app start.
App start: default = first log line timestamp; or --start for comparison with other tools.
Refresh 0.5s. All code and comments in English.
"""
import re
import os
import sys
import time
from datetime import datetime

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
repo_root = os.path.dirname(os.path.dirname(project_root))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

try:
    from d3utils.rosbot_history_parser import (
        parse_history_lines,
        session_blocks_with_ts,
        baseline_rifkeys_sum,
        current_session_earned,
    )
    _PARSER_AVAILABLE = True
except ImportError:
    try:
        from rosbot_history_parser import (
            parse_history_lines,
            session_blocks_with_ts,
            baseline_rifkeys_sum,
            current_session_earned,
        )
        _PARSER_AVAILABLE = True
    except ImportError:
        _PARSER_AVAILABLE = False

HISTORY_PATH = r"C:\Users\accou\Documents\RoS-BoT\Logs\history.txt"
REFRESH_INTERVAL = 0.5
# Read from end of file until we have all data at and after app_start. Chunk size from end.
TAIL_CHUNK_MAX_BYTES = 30 * 1024 * 1024

_TS_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})(?:,(\d{3}))?")


def _indent(line):
    """Number of leading tabs (block hierarchy: 0=root Session, 1=child Rift, etc.)."""
    n = 0
    for c in line:
        if c != "\t":
            break
        n += 1
    return n


def _parse_log_timestamp(line):
    """Parse '2026-02-08 22:38:33,204' or '2026-02-08 22:38:33' -> datetime or None."""
    s = line.strip()
    mo = _TS_RE.match(s)
    if mo:
        try:
            if mo.group(2) is not None:
                return datetime.strptime(mo.group(1) + "." + mo.group(2), "%Y-%m-%d %H:%M:%S.%f")
            return datetime.strptime(mo.group(1), "%Y-%m-%d %H:%M:%S")
        except Exception:
            pass
    return None


def read_tail_bytes(path, max_bytes, encoding="utf-8", errors="replace"):
    """Read last max_bytes from file, return list of lines (last line may be partial)."""
    size = os.path.getsize(path)
    chunk = min(size, max_bytes)
    with open(path, "r", encoding=encoding, errors=errors) as f:
        if size <= chunk:
            return f.readlines()
        f.seek(size - chunk)
        f.readline()
        return f.readlines()


def read_head_bytes(path, max_bytes, encoding="utf-8", errors="replace"):
    """Read first max_bytes from file, return list of lines (last line may be partial)."""
    with open(path, "r", encoding=encoding, errors=errors) as f:
        raw = f.read(max_bytes)
    return raw.splitlines(keepends=True) if raw else []


def find_first_index_at_or_after(lines, app_start_dt):
    """First line index where timestamp >= app_start_dt. Scan from start of list."""
    for i in range(len(lines)):
        ts = _parse_log_timestamp(lines[i])
        if ts is not None and ts >= app_start_dt:
            return i
    return len(lines)


def _session_starts_with_ts(lines):
    """Return list of (index, datetime) for each line that starts a Session block (timestamp + INFO - Session)."""
    out = []
    for i in range(len(lines)):
        line = lines[i]
        if not re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", line.strip()):
            continue
        if "INFO -" not in line or "Session" not in line:
            continue
        ts = _parse_log_timestamp(line)
        if ts is not None:
            out.append((i, ts))
    return out


def read_lines_from_app_start(path, app_start_dt, encoding="utf-8", errors="replace"):
    """
    One read from end of file. Data range = from the Session block that was active at app_start
    (last Session with timestamp <= app_start_dt) to EOF, so we include that Session's full Earned block.
    Returns (data_lines, baseline_rifkeys). baseline_rifkeys = Rift keys from last Session
    with timestamp < that current-run Session (so Keys Total = baseline + current Session delta).
    No state: each call reads file once and computes from that snapshot only.
    """
    lines = read_tail_bytes(path, TAIL_CHUNK_MAX_BYTES, encoding, errors)
    session_starts = _session_starts_with_ts(lines)
    data_start = None
    current_run_ts = None
    for idx in range(len(session_starts) - 1, -1, -1):
        i, ts = session_starts[idx]
        if ts <= app_start_dt:
            data_start = i
            current_run_ts = ts
            break
    if data_start is None:
        i0 = find_first_index_at_or_after(lines, app_start_dt)
        data_start = i0
        current_run_ts = app_start_dt
    data_lines = lines[data_start:]
    baseline_rifkeys = get_baseline_rifkeys_from_lines(lines, current_run_ts)
    return data_lines, baseline_rifkeys


def read_and_parse_with_parser(path, app_start_dt, encoding="utf-8", errors="replace"):
    """
    One read, then parse with rosbot_history_parser. Returns (data_lines, baseline_rifkeys, earned_dict).
    earned_dict is the current-run Session earned from parser; None if parser unavailable or no session.
    """
    lines = read_tail_bytes(path, TAIL_CHUNK_MAX_BYTES, encoding, errors)
    session_starts = _session_starts_with_ts(lines)
    data_start = None
    current_run_ts = None
    for idx in range(len(session_starts) - 1, -1, -1):
        i, ts = session_starts[idx]
        if ts <= app_start_dt:
            data_start = i
            current_run_ts = ts
            break
    if data_start is None:
        i0 = find_first_index_at_or_after(lines, app_start_dt)
        data_start = i0
        current_run_ts = app_start_dt
    data_lines = lines[data_start:]
    if not _PARSER_AVAILABLE:
        baseline = get_baseline_rifkeys_from_lines(lines, current_run_ts)
        return data_lines, baseline, None
    roots = parse_history_lines(lines)
    sessions = session_blocks_with_ts(roots)
    size = os.path.getsize(path)
    if size > TAIL_CHUNK_MAX_BYTES:
        head_lines = read_head_bytes(path, size - TAIL_CHUNK_MAX_BYTES, encoding, errors)
        if head_lines:
            head_roots = parse_history_lines(head_lines)
            head_sessions = session_blocks_with_ts(head_roots)
            merged = [(ts, b) for ts, b in sessions if ts < current_run_ts]
            seen = {ts for ts, _ in merged}
            for ts, b in head_sessions:
                if ts < current_run_ts and ts not in seen:
                    merged.append((ts, b))
                    seen.add(ts)
            sessions = merged
    baseline = baseline_rifkeys_sum(sessions, current_run_ts)
    cur = current_session_earned(roots, app_start_dt)
    earned = dict(cur[1]) if cur else {}
    delta_val, absolute_total = _last_rifkeys_in_data_lines(data_lines)
    if delta_val is not None:
        earned["Rift keys"] = delta_val
    if absolute_total is not None:
        earned["Keys_Total_absolute"] = absolute_total
    return data_lines, baseline, earned if earned else None


def read_tail_lines(path, n, encoding="utf-8", errors="replace"):
    """Read last n lines (used when app_start_dt is None)."""
    size = os.path.getsize(path)
    chunk = min(size, max(320 * 1024, min(n * 512, TAIL_CHUNK_MAX_BYTES)))
    with open(path, "r", encoding=encoding, errors=errors) as f:
        if size <= chunk:
            lines = f.readlines()
        else:
            f.seek(size - chunk)
            f.readline()
            lines = f.readlines()
    return lines[-n:] if len(lines) > n else lines


def _index_of_last_session_start(lines):
    """Index of last line that starts a Session block (timestamp + INFO - Session)."""
    last_i = None
    for i in range(len(lines)):
        line = lines[i]
        if not re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", line.strip()):
            continue
        if "INFO -" not in line or "Session" not in line:
            continue
        last_i = i
    return last_i


def _session_content_indents(block_indent, has_ts):
    """Allowed content indent levels for a Session block (general Earned lines)."""
    if block_indent == 0 and has_ts:
        return (0, 1)
    return (block_indent + 1,)


def _session_rifkeys_indent_only(block_indent, has_ts):
    """
    For 'Rift keys Earned' only: Session-level = indent 0 strictly.
    Indent 1 is inside child Rift block (\\tRift content at 2, but sibling lines at 1
    are still under Rift scope). So we only take indent 0 as Session summary.
    """
    if block_indent == 0 and has_ts:
        return (0,)
    return (block_indent + 1,)


def _last_rifkeys_in_data_lines(data_lines):
    """
    Last 'Rift keys Earned' in the current Session block. Block nesting: only indent 0
    is Session-level (indent 1 is inside child Rift). Scan until next Session start.
    Returns (value_for_delta, absolute_total_or_none). Indent 0 = Session summary.
    """
    session_start_i = _index_of_last_session_start(data_lines)
    if session_start_i is None:
        return None, None
    line0 = data_lines[session_start_i]
    block_indent = _indent(line0)
    has_ts = bool(re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", line0.strip()))
    allowed = _session_rifkeys_indent_only(block_indent, has_ts)
    key_pattern = re.compile(r"^\s*Rift keys Earned:\s*(-?\d+)\s*$", re.IGNORECASE)
    last_val = None
    for i in range(session_start_i, len(data_lines)):
        line = data_lines[i]
        ind = _indent(line)
        if i > session_start_i and ind <= block_indent:
            if re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", line.strip()) and "INFO -" in line and "Session" in line:
                break
        if ind in allowed:
            mo = key_pattern.match(line)
            if mo:
                last_val = int(mo.group(1))
    if last_val is None:
        return None, None
    return last_val, last_val


def _rifkeys_from_session_block(lines, start_i):
    """
    Extract Session-level Rift keys Earned: only indent 0 (Session direct content).
    Indent 1 is inside child Rift block, do not count.
    """
    if start_i >= len(lines):
        return None
    line0 = lines[start_i]
    block_indent = _indent(line0)
    has_ts = bool(re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", line0.strip()))
    allowed = _session_rifkeys_indent_only(block_indent, has_ts)
    key_pattern = re.compile(r"^\s*Rift keys Earned:\s*(-?\d+)\s*$", re.IGNORECASE)
    last_val = None
    for i in range(start_i, min(start_i + 500, len(lines))):
        line = lines[i]
        ind = _indent(line)
        if i > start_i and ind <= block_indent:
            if re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", line.strip()) and "INFO -" in line and "Session" in line:
                break
        if ind in allowed:
            mo = key_pattern.match(line)
            if mo:
                last_val = int(mo.group(1))
    return last_val


def get_baseline_rifkeys_from_lines(lines, before_ts):
    """
    Sum of "Rift keys Earned" (delta per session) for all Session blocks with timestamp < before_ts.
    That sum = cumulative keys at start of the session at before_ts = baseline for Keys Total.
    """
    session_starts = []
    for i in range(len(lines)):
        line = lines[i]
        if not re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", line.strip()):
            continue
        if "INFO -" not in line or "Session" not in line:
            continue
        ts = _parse_log_timestamp(line)
        if ts is None:
            continue
        session_starts.append((i, ts))
    total = 0
    found_any_before = False
    for start_i, ts in session_starts:
        if ts >= before_ts:
            continue
        found_any_before = True
        rifkeys = _rifkeys_from_session_block(lines, start_i)
        if rifkeys is not None:
            total += rifkeys
    return total if found_any_before else None


def read_app_start_time(path, encoding="utf-8", errors="replace"):
    """Return app start time = datetime of first timestamp line in file."""
    try:
        with open(path, "r", encoding=encoding, errors=errors) as f:
            for _ in range(500):
                line = f.readline()
                if not line:
                    break
                dt = _parse_log_timestamp(line)
                if dt is not None:
                    return dt
    except Exception:
        pass
    return None


def parse_start_time_arg(s):
    """Parse --start argument. Formats: 2026-02-08 22:38:33, 22:38:33 (today), or with ,204 ms."""
    if not s or not s.strip():
        return None
    s = s.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%H:%M:%S"):
        try:
            dt = datetime.strptime(s, fmt)
            if fmt == "%H:%M:%S":
                dt = dt.replace(year=datetime.now().year, month=datetime.now().month, day=datetime.now().day)
            return dt
        except ValueError:
            continue
    if "," in s:
        s = s.replace(",", ".")
        try:
            return datetime.strptime(s, "%Y-%m-%d %H:%M:%S.%f")
        except ValueError:
            pass
    return None


def extract_duration(line):
    """Return (display_str, duration_seconds)."""
    m = re.search(r"Duration:\s*(\d{2}):(\d{2}):(\d{2})\.?\d*", line)
    if m:
        h, mnt, s = int(m.group(1)), int(m.group(2)), int(m.group(3))
        secs = h * 3600 + mnt * 60 + s
        return "00.%s:%s:%s" % (m.group(1), m.group(2), m.group(3)), secs
    m = re.search(r"Duration:\s*(\d+):(\d{2}):(\d{2})\.?\d*", line)
    if m:
        h, mnt, s = int(m.group(1)), int(m.group(2)), int(m.group(3))
        secs = h * 3600 + mnt * 60 + s
        return "%s.%s:%s" % (m.group(1).zfill(2), m.group(2), m.group(3)), secs
    return None, 0


def _seconds_to_dd_hh_mm_ss(secs):
    """Format as DD.HH:MM:SS e.g. 00.00:05:54 for 5m54s."""
    secs = max(0, int(secs))
    d, r = divmod(secs, 86400)
    h, r = divmod(r, 3600)
    m, s = divmod(r, 60)
    return "%02d.%02d:%02d:%02d" % (d, h, m, s)


def _parse_one_session_earned(lines, start_i):
    """
    Parse X Earned from one Session block only from lines at Session content indent.
    Scan until next Session start; do not stop at child Rift.
    """
    if start_i >= len(lines):
        return {}
    line0 = lines[start_i]
    block_indent = _indent(line0)
    has_ts = bool(re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", line0.strip()))
    allowed = _session_content_indents(block_indent, has_ts)
    earned = {}
    key_pattern = re.compile(r"^\s*([A-Za-z0-9\s]+)\s+Earned:\s*(-?\d+)\s*$")
    for i in range(start_i, len(lines)):
        line = lines[i]
        ind = _indent(line)
        if i > start_i and ind <= block_indent:
            if re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", line.strip()) and "INFO -" in line and "Session" in line:
                break
        if ind in allowed:
            m = key_pattern.match(line)
            if m:
                earned[m.group(1).strip().replace(" ", "")] = int(m.group(2))
    return earned


def parse_session_block(lines):
    """
    Find last two top-level Session blocks (line starts with timestamp + INFO - Session).
    Last block: current session earned (delta). Previous block: keys at end of previous session.
    Keys Total = prev_rifkeys + last_rifkeys_delta.
    Returns (duration_str, duration_secs, earned, prev_earned).
    """
    duration_str, duration_secs = None, 0
    session_starts = []
    for i in range(len(lines)):
        line = lines[i]
        if not re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", line.strip()):
            continue
        if "INFO -" not in line or "Session" not in line:
            continue
        session_starts.append(i)
    if not session_starts:
        return duration_str, duration_secs, {}, {}
    last_start = session_starts[-1]
    prev_start = session_starts[-2] if len(session_starts) >= 2 else -1
    for i in (last_start, last_start + 1):
        if i < len(lines) and "Duration:" in lines[i]:
            duration_str, duration_secs = extract_duration(lines[i])
            break
    earned = _parse_one_session_earned(lines, last_start)
    prev_earned = _parse_one_session_earned(lines, prev_start) if prev_start >= 0 else {}
    return duration_str, duration_secs, earned, prev_earned


def count_rifts_in_tail(lines):
    return sum(
        1
        for line in lines
        if "INFO -" in line and "Rift" in line and "Session" not in line
    )


def get_last_rift_start_and_step(lines, now_dt):
    """
    Find last top-level Rift block (timestamp + INFO - Rift). Return (start_dt, step_secs).
    start_dt = that line's timestamp (current game start). step_secs = last Duration in that block (seconds).
    """
    rift_starts = []
    for i in range(len(lines)):
        line = lines[i]
        if not re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", line.strip()):
            continue
        if "INFO -" not in line or "Rift" not in line or "Session" in line:
            continue
        ts = _parse_log_timestamp(line)
        if ts is None:
            continue
        rift_starts.append(i)
    if not rift_starts:
        return None, 0
    last_start = rift_starts[-1]
    start_dt = _parse_log_timestamp(lines[last_start])
    step_secs = 0
    dur_re = re.compile(r"Duration:\s*(\d{2}):(\d{2}):(\d{2})\.?\d*")
    for i in range(last_start, min(last_start + 200, len(lines))):
        if re.match(r"^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}", lines[i].strip()) and i > last_start + 2:
            break
        mo = dur_re.search(lines[i])
        if mo:
            step_secs = int(mo.group(1)) * 3600 + int(mo.group(2)) * 60 + int(mo.group(3))
    return start_dt, step_secs


def get_earned(earned, key, default=0):
    key_flat = key.replace(" ", "")
    for k, v in earned.items():
        if k.replace(" ", "") == key_flat:
            return v
    return default


def _fmt_xp(val):
    """XP: B (billions) if abs < 1e12, else T (trillions)."""
    if val == 0:
        return "0"
    abs_v = abs(val)
    if abs_v >= 1e12:
        t = abs_v / 1e12
        return "%.3f T" % t if val >= 0 else "-%.3f T" % t
    b = abs_v / 1e9
    return "%.3f B" % b if val >= 0 else "-%.3f B" % b


def _fmt_xp_per_h(val):
    if val == 0:
        return "0"
    abs_v = abs(val)
    if abs_v >= 1e12:
        t = abs_v / 1e12
        return "%.3f T" % t if val >= 0 else "-%.3f T" % t
    b = abs_v / 1e9
    return "%.3f B" % b if val >= 0 else "-%.3f B" % b


def _seconds_to_mm_ss(secs):
    secs = max(0, int(secs))
    m, s = divmod(secs, 60)
    return "%02d:%02d" % (m, s)


def _seconds_to_game_time(secs):
    """00:01:13 or 01:13:00 for Game # line."""
    secs = max(0, int(secs))
    h, r = divmod(secs, 3600)
    m, s = divmod(r, 60)
    if h > 0:
        return "%02d:%02d:%02d" % (h, m, s)
    return "00:%02d:%02d" % (m, s)


def format_display(earned, prev_earned, game_count, app_start_dt, baseline_rifkeys=None,
                  current_game_secs=None, step_secs=0):
    """
    Boting duration and all /h use boting_secs (time since app start).
    Keys Total = baseline_rifkeys + last "Rift keys Earned" in data_lines (current session delta).
    keys/h = (Keys Total - baseline_rifkeys) * 3600 / boting_secs = delta * 3600 / boting_secs.
    E.g. 1023/0 -15.74/h => baseline + delta = 1023, delta * 3600 / secs = -15.74.
    Game # time and Run use current_game_secs (time since last rift start) when available.
    """
    now = datetime.now()
    if app_start_dt is not None:
        boting_secs = (now - app_start_dt).total_seconds()
        boting_secs = max(0, boting_secs)
    else:
        boting_secs = 1
    boting_dur = _seconds_to_dd_hh_mm_ss(boting_secs)
    secs = max(1, boting_secs)
    games_per_h = game_count * 3600.0 / secs
    last_rifkeys_val = get_earned(earned, "Rift keys", 0)
    keys_total_absolute = earned.get("Keys_Total_absolute") if earned else None
    if keys_total_absolute is not None:
        keys_total = keys_total_absolute
        keys_per_h = (keys_total - (baseline_rifkeys or 0)) * 3600.0 / secs
    elif baseline_rifkeys is not None:
        keys_total = baseline_rifkeys + last_rifkeys_val
        keys_per_h = last_rifkeys_val * 3600.0 / secs
    elif prev_earned:
        prev_rifkeys = get_earned(prev_earned, "Rift keys", 0)
        keys_total = prev_rifkeys + last_rifkeys_val
        keys_per_h = last_rifkeys_val * 3600.0 / secs
    else:
        keys_total = last_rifkeys_val
        keys_per_h = last_rifkeys_val * 3600.0 / secs
    xp_val = get_earned(earned, "XP", 0)
    xp_str = _fmt_xp(xp_val)
    xp_per_h_str = _fmt_xp_per_h(int(xp_val * 3600.0 / secs))
    run_xp_val = get_earned(earned, "RunXP", 0)
    run_xp_str = _fmt_xp(run_xp_val)
    run_xp_per_h_str = _fmt_xp_per_h(int(run_xp_val * 3600.0 / secs))
    distance_y = get_earned(earned, "Distance", 0)
    y_per_h = distance_y * 3600.0 / secs
    mi_per_h = y_per_h / 1760 if y_per_h else 0
    keys_rate_str = "%.2f" % keys_per_h
    if current_game_secs is not None and current_game_secs >= 0:
        run_dur = _seconds_to_mm_ss(current_game_secs)
        game_time_str = _seconds_to_game_time(current_game_secs)
    else:
        run_dur = _seconds_to_mm_ss(boting_secs)
        game_time_str = _seconds_to_game_time(boting_secs)
    step_str = _seconds_to_mm_ss(step_secs) if step_secs else "00:00"
    gr = 1 if game_count else 0
    return "\n".join([
        "Boting duration : %s day(s)" % boting_dur,
        "Game # %s %s(%.2f/h)" % (game_count, game_time_str, games_per_h),
        "Run: %s - Step: %s" % (run_dur, step_str),
        "Failed runs: 0 - Deaths: 0",
        "Keys Total/Looted: %s/0 %s/h" % (keys_total, keys_rate_str),
        "Avg.Keys/Rift:0 - 0r %dgr" % gr,
        "Shards earned: %s" % get_earned(earned, "Shards", 0),
        "Earned Xp: %s (%s/h)" % (xp_str, xp_per_h_str),
        "Run Xp: %s (%s/h)" % (run_xp_str, run_xp_per_h_str),
        "Xp Pools: %s (0/h)" % get_earned(earned, "Xp Pools", 0),
        "Legendaries Kept/Looted: %s/%s" % (get_earned(earned, "KeptItems", 0), get_earned(earned, "DroppedItems", 0)),
        "Distance: %sy (%.2fmi/h)" % (distance_y, mi_per_h),
        "Performance: 498 /570",
    ])


def main():
    if not os.path.isfile(HISTORY_PATH):
        print("File not found: %s" % HISTORY_PATH)
        return
    app_start_dt = None
    start_src = "log"
    for i, arg in enumerate(sys.argv):
        if arg in ("--start", "-s") and i + 1 < len(sys.argv):
            app_start_dt = parse_start_time_arg(sys.argv[i + 1])
            if app_start_dt is not None:
                start_src = "arg"
            break
    if app_start_dt is None:
        app_start_dt = read_app_start_time(HISTORY_PATH)
    if app_start_dt is None:
        print("WARN: no timestamp at start of log and no --start given, Boting duration / rates may be wrong.")
    try:
        while True:
            # Each tick: one read, full recompute from that snapshot. No in-memory accumulation.
            if app_start_dt is not None and _PARSER_AVAILABLE:
                lines, baseline_rifkeys, parser_earned = read_and_parse_with_parser(HISTORY_PATH, app_start_dt)
                duration_str, duration_secs, fallback_earned, prev_earned = parse_session_block(lines)
                earned = parser_earned if parser_earned is not None else fallback_earned
            else:
                if app_start_dt is not None:
                    lines, baseline_rifkeys = read_lines_from_app_start(HISTORY_PATH, app_start_dt)
                else:
                    lines = read_tail_lines(HISTORY_PATH, 50000)
                    baseline_rifkeys = None
                duration_str, duration_secs, earned, prev_earned = parse_session_block(lines)
                delta_val, absolute_total = _last_rifkeys_in_data_lines(lines)
                if delta_val is not None and earned is not None:
                    earned["Rift keys"] = delta_val
                if absolute_total is not None and earned is not None:
                    earned["Keys_Total_absolute"] = absolute_total
                if app_start_dt is None:
                    baseline_rifkeys = None
            game_count = count_rifts_in_tail(lines)
            now_dt = datetime.now()
            last_rift_start, step_secs = get_last_rift_start_and_step(lines, now_dt)
            current_game_secs = (now_dt - last_rift_start).total_seconds() if last_rift_start else None
            our_text = format_display(
                earned, prev_earned, game_count, app_start_dt, baseline_rifkeys,
                current_game_secs=current_game_secs, step_secs=step_secs
            )
            if sys.platform == "win32":
                os.system("cls")
            else:
                os.system("clear")
            print("[RoS-BoT history] lines from app_start=%s (%s) | count=%d | refresh %.1fs" % (
                app_start_dt.strftime("%Y-%m-%d %H:%M:%S") if app_start_dt else "?",
                start_src,
                len(lines),
                REFRESH_INTERVAL,
            ))
            print(HISTORY_PATH)
            print("-" * 50)
            print(our_text)
            time.sleep(REFRESH_INTERVAL)
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
