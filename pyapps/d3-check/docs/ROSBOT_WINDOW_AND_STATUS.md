# ROSBOT Window Detection and Extended Status

This document describes the current flow for finding the ROSBOT window and the extended status (not_found / running / paused). Implementation: `d3utils/rosbot_manager.py`, `d3utils/rosbot_status_provider.py`.

---

## Overview

- **Same-dir** = exe **file list** from `find_other_exe_files()` (not “all PIDs under ros_directory”). We resolve process by **exe name** (`find_process_by_exe_name`), then get window by PID (`find_window_by_pid`).
- **Extended status**:
  - **not_found**: No ROSBOT process.
  - **running**: Process exists but **no visible window** (minimized, hidden, or no window).
  - **paused**: Process has a **visible** window (`IsWindowVisible(hwnd)`).

Only a **visible** window counts as “paused”; minimized/hidden windows are treated as “running”.

---

## Config: ros_directory

- **Source**: `CONFIG["ros_settings"]["ros_directory"]` (directory or main exe path).
- **Internal** (`ROSBOTManager`):
  - `_ros_directory`: raw config string.
  - `_ros_dir_norm`: `normpath(abspath(_ros_directory)).lower()` for path matching.
- **get_ros_directory()**: Returns the directory to use (if config is a file path, returns its parent dir). Used by `find_rosbot_exe()`, `find_other_exe_files()`, `start()`, etc.

---

## Same-dir exe list

- **find_other_exe_files()**: Returns full paths of exe files in `ros_directory` under `search_patterns` (e.g. `*.exe`), excluding `exclude_patterns` (e.g. main launcher, Uninstall, setup).
- **find_same_dir_exe_names()**: Basenames only of the above (for callers that only need names).
- Same-dir is defined by **file list**, not by “exe path under directory” PID filter.

---

## Resolving process by exe name

- **find_process_by_exe_name(exe_name)**:
  - Iterates processes (psutil) and matches by:
    - `proc.info["name"].lower() == exe_name.lower()`, or
    - `basename(proc.info["exe"]).lower() == exe_name.lower()` and exe path under `_ros_dir_norm` (so we do not match same-named exe from another folder).
  - For the matched process: gets PID, then **find_window_by_pid(pid, visible_only=False)** and attaches hwnd/title to the result (for F7, kill, etc. we may use non-visible window).
- **check_process_running(exe_name)**: Same as above; for main `rosbot_exe_name` only, falls back to **window title** match (legacy) if no process match.

---

## Finding window by PID

- **find_window_by_pid(pid, visible_only=False)**:
  - Enumerates top-level windows (`EnumWindows`), collects windows for this PID.
  - Splits into: **visible** (IsWindowVisible) and **any** (all for this PID).
  - **visible_only=False** (default): Prefer visible list; if empty, use any (e.g. minimized). Used for F7, kill, get_running_rosbot_processes.
  - **visible_only=True**: Return only from the visible list; if empty, return None. Used **only** by `get_rosbot_window()` so that “paused” means “has visible window”.

---

## get_rosbot_window()

- Returns a window **only when it is visible**.
- Steps (with Step 1/2 logs):
  1. **Step 1**: Log same-dir exe list: `ros_directory`, count, basenames.
  2. **Main exe**: `check_process_running(rosbot_exe_name)` → if process exists, **find_window_by_pid(pid, visible_only=True)**. If that returns a window, return it; else log “process but no visible window”.
  3. **Same-dir other exe**: For each path from `find_other_exe_files()`, `find_process_by_exe_name(basename)` → if process exists, **find_window_by_pid(pid, visible_only=True)**. If that returns a window, return it; else log “process but no visible window”.
  4. If any process was found but no visible window: log “process(es) found but no visible window”. Else: log “no process/window for main or same-dir exe”. Return None.

So: **paused** = we returned a window (visible); **running** = we did not return a window but `is_running()` is true (process exists, no visible window).

---

## Extended status: get_rosbot_detection()

- **get_rosbot_detection()** returns:
  - `{"status": "paused", "window_info": <dict>}` when `get_rosbot_window()` returns a window (visible).
  - `{"status": "running", "window_info": None}` when `get_rosbot_window()` is None but `is_running()` is True (process, no visible window).
  - `{"status": "not_found", "window_info": None}` when no process.

Used by `rosbot_status_provider.refresh_rosbot_status()` to set `game_interface_data.rosbot_extended_status` and `rosbot_window_found` (true only when status is paused).

---

## UI and callers

- **Panel status**: not_found → “Not found”; running → “Running” (e.g. 运行中); paused → “Paused” (e.g. 暂停中). See i18n keys `rosbot.extended_running`, `rosbot.extended_paused`, `rosbot.not_found`.
- **Debug ROSBOT button**: If paused → run window UI analysis (screenshot, JSON, copy to docs). If running → send F7 to process (using **find_window_by_pid(pid, visible_only=False)** so minimized window can receive F7).
- **run_after_rosbot_start()** (rosbot_ui_automation): Polls `get_rosbot_window()` until a window is found (visible) or timeout; then activates and runs UI automation.

---

## Flow summary

| Step | What | Notes |
|------|------|--------|
| 1 | Same-dir exe list | `find_other_exe_files()` → file paths in ros_directory |
| 2 | Process by exe name | Main exe then each same-dir exe → `find_process_by_exe_name` → pid |
| 3 | Window for status | **find_window_by_pid(pid, visible_only=True)** → only visible counts as “paused” |
| 4 | Extended status | get_rosbot_window() non-None → paused; else is_running() → running; else not_found |

---

## Other uses of find_window_by_pid

- **get_running_rosbot_processes()**: Uses `find_window_by_pid(pid, visible_only=False)` so we still get window info for minimized/hidden (e.g. for F7).
- **send_f7_to_process(process_info)**: Needs hwnd; when status is “running”, Debug ROSBOT tries again with `visible_only=False` to get a window to send F7 to (e.g. minimized).
