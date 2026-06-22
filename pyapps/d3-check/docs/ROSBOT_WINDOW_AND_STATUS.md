# ROSBOT Window and Extended Status

**Authoritative flow: [ROSBOT_LOOKUP_FLOW.md](./ROSBOT_LOOKUP_FLOW.md).**

- All ROSBOT window/process lookup: **same-dir exe only** (other exes first, then main exe); process by `find_process_by_exe_name` (psutil); window by `find_window_by_pid(pid, visible_only=...)`. **No title filtering**; exe from find_other_exe_files is unique.
- **Extended status**: not_found (no process), running (process, no visible window), paused (visible window).
- **Single entry points**: `get_rosbot_window()`, `get_rosbot_detection()`, `refresh_rosbot_status()`, `get_running_rosbot_processes()`. Implementation: `d3utils/rosbot_manager.py` (`_get_rosbot_window_and_process`), `d3utils/rosbot_status_provider.py`.

## Config and same-dir exe list

- **ros_directory**: `CONFIG["ros_settings"]["ros_directory"]`; **get_ros_directory()** used by `find_rosbot_exe()`, `find_other_exe_files()`, etc.
- **find_other_exe_files()**: Exe files in ros_directory (search_patterns, exclude_patterns). Lookup order: other exes first, then main exe.

## Process and window (exe → PID → window)

- **find_process_by_exe_name(exe_name)**: psutil only; match by process name or exe basename under ros_directory.
- **find_window_by_pid(pid, visible_only)**: For ROSBOT we pass only pid and visible_only; no title filter (exe is unique).
- **check_process_running(exe_name)**: Returns find_process_by_exe_name(exe_name) only.

## get_rosbot_window() / get_rosbot_detection()

- **\_get_rosbot_window_and_process()**: same-dir exe list → other first, then main → find_process_by_exe_name → find_window_by_pid(pid, visible_only=True). Returns (window_info or None, process_found).
- **get_rosbot_detection()**: window → paused; no window but process_found → running; else not_found.
- **refresh_rosbot_status()**: get_rosbot_detection() and write to game_interface_data.

## Other uses

- **get_running_rosbot_processes()**: Same order, find_window_by_pid(pid, visible_only=False), no title filter.
- **cleanup_old_other_exe_processes(send_f7_before_kill=True)**: find_window_by_pid(pid, visible_only=False) for F7 target.
