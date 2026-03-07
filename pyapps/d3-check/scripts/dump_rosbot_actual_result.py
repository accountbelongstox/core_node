#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Dump actual ROSBOT lookup result to file (all values, including title). Run from pyapps/d3-check."""
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

from d3utils.rosbot_manager import get_rosbot_manager

def main():
    mgr = get_rosbot_manager()
    ros_dir = mgr.get_ros_directory()
    other_files = mgr.find_other_exe_files()
    main_exe_path = mgr.find_rosbot_exe()
    winfo = mgr.get_rosbot_window()
    det = mgr.get_rosbot_detection()
    procs = mgr.get_running_rosbot_processes()
    running = mgr.is_running()

    lines = []
    def w(s):
        lines.append(s)

    w("========== Actual result (full dump) ==========")
    w("")
    w("ros_directory = %s" % repr(ros_dir))
    w("rosbot_exe_name = %s" % repr(mgr.rosbot_exe_name))
    w("")
    w("find_other_exe_files() count = %d" % len(other_files))
    for i, p in enumerate(other_files):
        w("  [%d] path = %s" % (i, repr(p)))
        w("  [%d] basename = %s" % (i, repr(os.path.basename(p))))
    w("")
    w("find_rosbot_exe() = %s" % repr(main_exe_path))
    w("")
    w("get_rosbot_window() = %s" % repr(winfo))
    if winfo:
        w("  hwnd = %s" % repr(winfo.get("hwnd")))
        w("  pid = %s" % repr(winfo.get("pid")))
        w("  title = %s" % repr(winfo.get("title")))
    w("")
    w("get_rosbot_detection()")
    w("  status = %s" % repr(det.get("status")))
    w("  window_info = %s" % repr(det.get("window_info")))
    if det.get("window_info"):
        wi = det["window_info"]
        w("    window_info.hwnd = %s" % repr(wi.get("hwnd")))
        w("    window_info.pid = %s" % repr(wi.get("pid")))
        w("    window_info.title = %s" % repr(wi.get("title")))
    w("")
    w("get_running_rosbot_processes() count = %d" % len(procs))
    for i, r in enumerate(procs):
        w("  [%d] pid = %s" % (i, repr(r.get("pid"))))
        w("  [%d] exe_name = %s" % (i, repr(r.get("exe_name"))))
        w("  [%d] exe_path = %s" % (i, repr(r.get("exe_path"))))
        ww = r.get("window_info")
        w("  [%d] window_info = %s" % (i, repr(ww)))
        if ww:
            w("  [%d] window_info.hwnd = %s" % (i, repr(ww.get("hwnd"))))
            w("  [%d] window_info.pid = %s" % (i, repr(ww.get("pid"))))
            w("  [%d] window_info.title = %s" % (i, repr(ww.get("title"))))
    w("")
    w("is_running() = %s" % repr(running))
    w("")
    w("========== Title summary (all title values) ==========")
    if winfo and winfo.get("title") is not None:
        w("get_rosbot_window().title = %s" % repr(winfo.get("title")))
    for i, r in enumerate(procs):
        ww = r.get("window_info")
        if ww and ww.get("title") is not None:
            w("get_running_rosbot_processes()[%d].window_info.title = %s" % (i, repr(ww.get("title"))))
    w("")
    w("========== End of actual result ==========")

    out_path = os.path.join(project_root, "scripts", "test_rosbot_actual_result.txt")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print("Written: %s" % out_path)
    for line in lines:
        print(line)

if __name__ == "__main__":
    main()
