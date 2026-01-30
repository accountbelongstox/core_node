#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ROSBOT manager: directory from config, find main exe + same-dir generated temp exe, k/start by PID.
Implements details from original utils/_obsolete_rosbot_manager.py (RoSBotManager) where applicable.
Uses process_helper.kill_process_by_pid; detects running by process exe under ros_directory.

Limitations vs original RoSBotManager:
- No activate_and_analyze_window: original used WindowAnalyzer/IntegratedAutomationController; this class does not depend on obsolete modules.
- No full start_rosbot_sequence: original did cleanup -> start main exe -> wait_for_process -> wait_for_new_other_exe -> activate_and_analyze_window; this class only provides kill_if_running + start and optional cleanup_old_other_exe_processes, wait_for_new_other_exe; caller orchestrates.
- send_f7_before_kill optional: cleanup_old_other_exe_processes(send_f7_before_kill=True) requires win32api/win32gui; skipped if not installed.
"""

import os
import glob
import time
import subprocess
from pathlib import Path
from typing import List, Optional, Set, Dict, Any

from providor.common_imports import ColorPrint
from providor.providor_index import CONFIG

from config.constants import ROSBOT_EXE_PATTERNS
from d3utils.process_helper import kill_process_by_pid

try:
    import psutil
except ImportError:
    psutil = None
try:
    import win32gui
    import win32process
except ImportError:
    win32gui = None
    win32process = None
try:
    import win32api
    import win32con
except ImportError:
    win32api = None
    win32con = None

# Default exclude for same-dir other exe (main launcher + installers)
_DEFAULT_EXCLUDE = ("RoS-BoT.exe", "Uninstall", "setup", "install")


def _normpath(path: str) -> str:
    return os.path.normpath(os.path.abspath(path)).lower()


class ROSBOTManager:
    """
    ROSBOT process management. Config from ros_settings; find main exe (config name or pattern);
    find other exe (same-dir generated); is_running / kill_if_running by PID; start; cleanup with optional F7;
    wait_for_process / wait_for_new_other_exe for sequencing.
    """

    def __init__(self, ros_directory: Optional[str] = None):
        ros_settings = CONFIG.get("ros_settings", {})
        self._ros_directory = (ros_directory or ros_settings.get("ros_directory", "")).strip()
        self._ros_dir_norm: Optional[str] = None
        self._ros_dir_norm_for_pid: Optional[str] = None
        if self._ros_directory:
            self._ros_dir_norm = _normpath(self._ros_directory)
            base = self._ros_directory
            if os.path.isfile(base):
                base = os.path.dirname(base)
            if base:
                self._ros_dir_norm_for_pid = _normpath(base)
        self.rosbot_exe_name = ros_settings.get("rosbot_exe_name", "RoS-BoT.exe")
        self.search_patterns = ros_settings.get("other_exe_search_patterns", ["*.exe"])
        self.exclude_patterns = ros_settings.get(
            "other_exe_exclude_patterns",
            ["RoS-BoT.exe", "Uninstall*.exe", "setup*.exe"],
        )
        self.startup_delay = ros_settings.get("startup_delay_seconds", 3)
        self.detection_timeout = ros_settings.get("process_detection_timeout", 30)

    def get_ros_directory(self) -> Optional[str]:
        """Return configured ROS directory path (directory of exe if config is exe path), or None if empty."""
        if not self._ros_directory:
            return None
        if os.path.isdir(self._ros_directory):
            return self._ros_directory
        parent = os.path.dirname(self._ros_directory)
        return parent if parent and os.path.isdir(parent) else None

    def validate_ros_directory(self) -> bool:
        """Validate RoS directory exists; log and return bool."""
        if not self._ros_directory:
            ColorPrint.red("[ROSBOTManager] ROS directory not configured")
            return False
        if not os.path.exists(self._ros_directory):
            ColorPrint.red(f"[ROSBOTManager] ROS directory not found: {self._ros_directory}")
            return False
        ColorPrint.gray(f"[ROSBOTManager] ROS directory: {self._ros_directory}")
        return True

    def find_rosbot_exe(self) -> Optional[str]:
        """Find main ROSBOT exe: first try exact rosbot_exe_name in directory, then ROSBOT_EXE_PATTERNS."""
        base = self.get_ros_directory()
        if not base:
            return None
        exact = os.path.join(base, self.rosbot_exe_name)
        if os.path.isfile(exact):
            ColorPrint.gray(f"[ROSBOTManager] Found main exe: {exact}")
            return exact
        for pattern in ROSBOT_EXE_PATTERNS:
            search = os.path.join(base, pattern)
            for path in glob.glob(search):
                if os.path.isfile(path):
                    ColorPrint.gray(f"[ROSBOTManager] Found main exe: {path}")
                    return path
        return None

    def find_other_exe_files(self) -> List[str]:
        """Find other exe full paths in ros_directory (config search_patterns, exclude_patterns). Same logic as original RoSBotManager."""
        base = self.get_ros_directory()
        if not base:
            return []
        out: List[str] = []
        try:
            for pattern in self.search_patterns:
                search_path = os.path.join(base, pattern)
                for file_path in glob.glob(search_path):
                    if not os.path.isfile(file_path):
                        continue
                    file_name = os.path.basename(file_path)
                    should_exclude = False
                    for exclude_pattern in self.exclude_patterns:
                        stub = exclude_pattern.replace("*", "")
                        if stub and stub.lower() in file_name.lower():
                            should_exclude = True
                            break
                    if not should_exclude and file_path not in out:
                        out.append(file_path)
        except OSError:
            pass
        return out

    def find_same_dir_exe_names(self) -> List[str]:
        """List exe basenames in ros_directory excluding main (by pattern) and install/uninstall. Convenience for callers that only need names."""
        return [os.path.basename(p) for p in self.find_other_exe_files()]

    def find_window_by_pid(self, pid: int) -> Optional[Dict[str, Any]]:
        """Find window by process ID (hwnd, title, pid). Requires win32gui/win32process."""
        if not win32gui or not win32process or not pid:
            return None
        found: List[Dict[str, Any]] = []

        def _callback(hwnd, _):
            if win32gui.IsWindowVisible(hwnd):
                try:
                    _, wpid = win32process.GetWindowThreadProcessId(hwnd)
                    if wpid == pid:
                        title = win32gui.GetWindowText(hwnd)
                        found.append({"hwnd": hwnd, "title": title or "", "pid": wpid})
                except Exception:
                    pass
            return True

        try:
            win32gui.EnumWindows(_callback, None)
            if found:
                for w in found:
                    if (w.get("title") or "").strip():
                        return w
                return found[0]
        except Exception:
            pass
        return None

    def find_process_by_exe_name(self, exe_name: str) -> Optional[Dict[str, Any]]:
        """Find process by exe file name (psutil); attach window info via find_window_by_pid. Same as original."""
        if not psutil or not exe_name:
            return None
        try:
            for proc in psutil.process_iter(["pid", "name", "exe"]):
                try:
                    info = proc.info
                    if not info.get("name"):
                        continue
                    if info["name"].lower() != exe_name.lower():
                        continue
                    pid = info["pid"]
                    winfo = self.find_window_by_pid(pid)
                    result = {
                        "pid": pid,
                        "exe_name": info["name"],
                        "exe_path": info.get("exe") or "",
                        "hwnd": winfo["hwnd"] if winfo else 0,
                        "title": winfo["title"] if winfo else f"{exe_name} (No Window)",
                    }
                    return result
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception as e:
            ColorPrint.red(f"[ROSBOTManager] find_process_by_exe_name: {e}")
        return None

    def check_process_running(self, exe_name: str) -> Optional[Dict[str, Any]]:
        """Check if process is running by exe name; for main rosbot_exe_name fallback to window title match (original behavior)."""
        info = self.find_process_by_exe_name(exe_name)
        if info:
            return info
        if exe_name != self.rosbot_exe_name:
            return None
        return self._check_process_running_by_title(exe_name)

    def _check_process_running_by_title(self, exe_name: str) -> Optional[Dict[str, Any]]:
        """Legacy: find window whose title contains exe name without .exe."""
        if not win32gui or not win32process:
            return None
        base = exe_name.replace(".exe", "").lower()
        found_list: List[Dict[str, Any]] = []

        def _cb(hwnd, _):
            if win32gui.IsWindowVisible(hwnd):
                try:
                    title = win32gui.GetWindowText(hwnd)
                    if title and base in title.lower():
                        _, pid = win32process.GetWindowThreadProcessId(hwnd)
                        found_list.append({"hwnd": hwnd, "title": title, "pid": pid})
                except Exception:
                    pass
            return True

        try:
            win32gui.EnumWindows(_cb, None)
            if found_list:
                w = found_list[0]
                for x in found_list:
                    if (x.get("title") or "").strip():
                        w = x
                        break
                return {
                    "pid": w["pid"],
                    "exe_name": exe_name,
                    "exe_path": "",
                    "hwnd": w["hwnd"],
                    "title": w["title"],
                }
        except Exception:
            pass
        return None

    def _pids_with_exe_under_ros_dir(self) -> Set[int]:
        """Return set of PIDs whose process exe path is under ros_directory (dir of config path if config is exe)."""
        if not psutil or not self._ros_dir_norm_for_pid:
            return set()
        pids: Set[int] = set()
        sep = os.sep
        try:
            for proc in psutil.process_iter(["pid", "exe"]):
                try:
                    exe = proc.info.get("exe")
                    if not exe:
                        continue
                    exe_norm = _normpath(exe)
                    if exe_norm == self._ros_dir_norm_for_pid or exe_norm.startswith(
                        self._ros_dir_norm_for_pid + sep
                    ):
                        pids.add(proc.info["pid"])
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
        except Exception as e:
            ColorPrint.red(f"[ROSBOTManager] Error listing processes: {e}")
        return pids

    def get_rosbot_window(self) -> Optional[Dict[str, Any]]:
        """
        Find ROSBOT window by process: any process whose exe is under ros_directory (main exe or spawned other exe).
        ROS starts the main exe then spawns another exe in the same dir; the actual UI window may belong to that process,
        so we find by PID under ros_dir, not by fixed window title.
        Returns first window with non-empty title, or first window found.
        """
        pids = self._pids_with_exe_under_ros_dir()
        if not pids:
            return None
        with_title: Optional[Dict[str, Any]] = None
        for pid in pids:
            winfo = self.find_window_by_pid(pid)
            if not winfo:
                continue
            if (winfo.get("title") or "").strip():
                return winfo
            if with_title is None:
                with_title = winfo
        return with_title

    def is_running(self) -> bool:
        """True if any process with exe under ros_directory is running (main or same-dir temp exe)."""
        return len(self._pids_with_exe_under_ros_dir()) > 0

    def kill_if_running(self) -> bool:
        """Kill all processes whose exe is under ros_directory by PID. Returns True if all killed or none running."""
        pids = self._pids_with_exe_under_ros_dir()
        if not pids:
            return True
        ColorPrint.blue(f"[ROSBOTManager] ROSBOT process(es) found, k {len(pids)} by PID...")
        ok = True
        for pid in pids:
            if not kill_process_by_pid(pid, log_prefix="[ROSBOTManager]"):
                ok = False
        return ok

    def start_executable(self, exe_path: str) -> bool:
        """Start an executable (Popen, cwd=dir). Original _obsolete_rosbot_manager used Popen; Battle.net uses explorer."""
        if not exe_path or not os.path.isfile(exe_path):
            return False
        try:
            cwd = os.path.dirname(exe_path)
            subprocess.Popen(
                exe_path,
                cwd=cwd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
            )
            ColorPrint.green(f"[ROSBOTManager] Started: {exe_path}")
            return True
        except Exception as e:
            ColorPrint.red(f"[ROSBOTManager] Start error: {e}")
            return False

    def start(self) -> bool:
        """Start main ROSBOT exe (find_rosbot_exe + start_executable)."""
        exe_path = self.find_rosbot_exe()
        if not exe_path:
            ColorPrint.yellow("[ROSBOTManager] No ROSBOT exe found, skip start")
            return False
        return self.start_executable(exe_path)

    def wait_for_process(self, exe_name: str, timeout_seconds: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Wait for a process to appear by exe name. Uses detection_timeout if timeout_seconds is None."""
        timeout = timeout_seconds if timeout_seconds is not None else self.detection_timeout
        deadline = time.time() + timeout
        while time.time() < deadline:
            info = self.check_process_running(exe_name)
            if info:
                return info
            time.sleep(2)
        return None

    def send_f7_to_process(self, process_info: Dict[str, Any]) -> bool:
        """Send F7 key to process window (activate then keybd_event). Optional: requires win32gui/win32api/win32con."""
        if not win32gui or not win32api or not win32con:
            return False
        hwnd = process_info.get("hwnd", 0)
        if not hwnd:
            return False
        try:
            win32gui.SetForegroundWindow(hwnd)
            win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
            time.sleep(0.5)
            win32api.keybd_event(0x76, 0, 0, 0)
            time.sleep(0.1)
            win32api.keybd_event(0x76, 0, 2, 0)
            return True
        except Exception:
            return False

    def cleanup_old_other_exe_processes(self, send_f7_before_kill: bool = False) -> bool:
        """Clean all running 'other exe' processes in directory; optionally send F7 before kill (original behavior)."""
        other_exe_files = self.find_other_exe_files()
        if not other_exe_files:
            return True
        cleanup_count = 0
        for exe_path in other_exe_files:
            exe_name = os.path.basename(exe_path)
            process_info = self.find_process_by_exe_name(exe_name)
            if not process_info:
                continue
            if send_f7_before_kill:
                self.send_f7_to_process(process_info)
                time.sleep(1)
            pid = process_info.get("pid")
            if pid and kill_process_by_pid(pid, log_prefix="[ROSBOTManager]"):
                cleanup_count += 1
            time.sleep(0.5)
        if cleanup_count > 0:
            time.sleep(2)
        return True

    def wait_for_new_other_exe(self, timeout_seconds: int = 60) -> Optional[Dict[str, Any]]:
        """Wait for RoS-BoT to spawn a new 'other exe' process (find_other_exe_files + find_process_by_exe_name). Same as original."""
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            for exe_path in self.find_other_exe_files():
                exe_name = os.path.basename(exe_path)
                process_info = self.find_process_by_exe_name(exe_name)
                if process_info:
                    return {
                        "exe_name": exe_name,
                        "exe_path": exe_path,
                        "process_info": process_info,
                    }
            time.sleep(3)
        return None


_rosbot_manager: Optional[ROSBOTManager] = None


def get_rosbot_manager(ros_directory: Optional[str] = None) -> ROSBOTManager:
    """Global ROSBOTManager instance. ros_directory can override config."""
    global _rosbot_manager
    if _rosbot_manager is None:
        _rosbot_manager = ROSBOTManager(ros_directory=ros_directory)
    return _rosbot_manager
