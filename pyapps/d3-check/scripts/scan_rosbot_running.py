#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scan current Windows: find running ROSBOT (main exe + same-dir other exe).
Uses rosbot_manager: ros_directory, find_other_exe_files, get_running_rosbot_processes.
Run from pyapps/d3-check: python scripts/scan_rosbot_running.py
"""
import os
import sys

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
repo_root = os.path.dirname(os.path.dirname(project_root))
if repo_root not in sys.path:
    sys.path.insert(0, repo_root)

try:
    import providor.providor_index as providor_index
    if not providor_index.CONFIG.get("ros_settings", {}).get("ros_directory"):
        try:
            providor_index.initialize_config()
        except Exception:
            pass
except Exception:
    pass

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from d3utils.rosbot_manager import get_rosbot_manager


def main():
    mgr = get_rosbot_manager()
    ros_dir = mgr.get_ros_directory()
    ColorPrint.blue("[Scan] ROS directory (config): %s" % (ros_dir or "(not set)"))

    other_exe = mgr.find_other_exe_files()
    ColorPrint.blue("[Scan] Same-dir other exe (find_other_exe_files): %d files" % len(other_exe))
    for p in other_exe:
        ColorPrint.gray("  - %s" % p)

    running = mgr.get_running_rosbot_processes()
    ColorPrint.blue("[Scan] Running ROSBOT processes (exe under ros_directory): %d" % len(running))
    for r in running:
        pid = r.get("pid")
        exe_name = r.get("exe_name", "")
        exe_path = r.get("exe_path", "")
        winfo = r.get("window_info")
        hwnd = winfo.get("hwnd", 0) if winfo else 0
        title = (winfo.get("title") or "").strip() if winfo else ""
        ColorPrint.gray("  pid=%s exe_name=%s exe_path=%s hwnd=%s title=%s" % (pid, exe_name, exe_path, hwnd, repr(title)))

    winfo = mgr.get_rosbot_window()
    if winfo:
        ColorPrint.green("[Scan] get_rosbot_window() => hwnd=%s title=%s pid=%s" % (winfo.get("hwnd"), repr(winfo.get("title") or ""), winfo.get("pid")))
    else:
        ColorPrint.yellow("[Scan] get_rosbot_window() => None (no window under ros_directory)")


if __name__ == "__main__":
    main()
