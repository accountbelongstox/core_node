#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ROSBOT manager: single lookup flow for process/window. See docs/ROSBOT_LOOKUP_FLOW.md.

Flow: same-dir exe list (other exes first, then main) -> find_process_by_exe_name (psutil only) -> find_window_by_pid(pid, visible_only=...). Exe from find_other_exe_files is unique; no title filtering. All ROSBOT window/status must go through get_rosbot_window() or get_rosbot_detection().
"""

import os
import glob
import time
import subprocess
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple, Callable

from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import CONFIG

from providor.constants.d3 import ROSBOT_EXE_PATTERNS
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

# docs/rosbot_ui_elements.json: No items popup window title. Exclude when resolving main window (judge by title).
_POPUP_NO_ITEMS_TITLE = "The Vault"

# When result is (None, process_found=True) (process but no main window), reuse for this many seconds to avoid repeated lookup and log spam. Module-level so all callers share.
_ROSBOT_LOOKUP_CACHE_TTL_SEC = 15.0
_rosbot_lookup_cache: Tuple[Optional[Dict[str, Any]], bool] = (None, False)
_rosbot_lookup_cache_at: float = 0.0


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
        if self._ros_directory:
            self._ros_dir_norm = _normpath(self._ros_directory)
        self.rosbot_exe_name = ros_settings.get("rosbot_exe_name", "RoS-BoT.exe")
        self.search_patterns = ros_settings.get("other_exe_search_patterns", ["*.exe"])
        self.exclude_patterns = ros_settings.get(
            "other_exe_exclude_patterns",
            ["RoS-BoT.exe", "Uninstall*.exe", "setup*.exe"],
        )
        self.startup_delay = ros_settings.get("startup_delay_seconds", 3)
        self.detection_timeout = ros_settings.get("process_detection_timeout", 30)
        self._main_window_content_validator: Optional[Callable[[int], bool]] = None

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

    def set_main_window_content_validator(self, validator: Optional[Callable[[int], bool]]) -> None:
        """Set optional validator(hwnd) -> bool to identify main window by UI content (e.g. profileTab, btnStart). When set, get_rosbot_window uses content, not title."""
        self._main_window_content_validator = validator

    def find_windows_by_pid(
        self,
        pid: int,
        visible_only: bool = True,
    ) -> List[Dict[str, Any]]:
        """Return all windows belonging to the given PID. Each item: {hwnd, title, pid}. No title filtering."""
        if not win32gui or not win32process or not pid:
            return []
        visible_list: List[Dict[str, Any]] = []
        any_for_pid: List[Dict[str, Any]] = []

        def _callback(hwnd, _):
            try:
                _, wpid = win32process.GetWindowThreadProcessId(hwnd)
                if wpid != pid:
                    return True
                title = win32gui.GetWindowText(hwnd)
                w = {"hwnd": hwnd, "title": title or "", "pid": wpid}
                any_for_pid.append(w)
                if win32gui.IsWindowVisible(hwnd):
                    visible_list.append(w)
            except Exception:
                pass
            return True

        try:
            win32gui.EnumWindows(_callback, None)
            return visible_list if visible_only and visible_list else (visible_list or any_for_pid)
        except Exception:
            pass
        return []

    def find_window_by_pid(
        self,
        pid: int,
        visible_only: bool = False,
        exclude_title_containing: Optional[List[str]] = None,
        prefer_title_starting_with: Optional[List[str]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Find window by process ID (hwnd, title, pid). Requires win32gui/win32process.
        If visible_only=True, return only when IsWindowVisible(hwnd).
        exclude_title_containing: skip windows whose title contains any of these (e.g. " - Notepad++").
        prefer_title_starting_with: prefer window whose title starts with one of these (app name, not document path).
        Note: get_rosbot_window() uses content validator when set (main window by UI content, not title).
        """
        if not win32gui or not win32process or not pid:
            return None
        visible_list: List[Dict[str, Any]] = []
        any_for_pid: List[Dict[str, Any]] = []

        def _callback(hwnd, _):
            try:
                _, wpid = win32process.GetWindowThreadProcessId(hwnd)
                if wpid != pid:
                    return True
                title = win32gui.GetWindowText(hwnd)
                w = {"hwnd": hwnd, "title": title or "", "pid": wpid}
                any_for_pid.append(w)
                if win32gui.IsWindowVisible(hwnd):
                    visible_list.append(w)
            except Exception:
                pass
            return True

        try:
            win32gui.EnumWindows(_callback, None)
            if visible_only:
                lst = visible_list
            else:
                lst = visible_list if visible_list else any_for_pid
            if not lst:
                return None
            if exclude_title_containing or prefer_title_starting_with:
                def _reject(w: Dict[str, Any]) -> bool:
                    t = (w.get("title") or "").strip()
                    if exclude_title_containing:
                        for sub in exclude_title_containing:
                            if sub in t:
                                return True
                    return False
                def _score(w: Dict[str, Any]) -> int:
                    t = (w.get("title") or "").strip()
                    if prefer_title_starting_with:
                        for start in prefer_title_starting_with:
                            if t.startswith(start) or t == start:
                                return 1
                    return 0
                lst = [w for w in lst if not _reject(w)]
                if not lst:
                    return None
                lst.sort(key=lambda w: (-_score(w), -len((w.get("title") or "").strip())))
            for w in lst:
                if (w.get("title") or "").strip():
                    return w
            return lst[0]
        except Exception:
            pass
        return None

    def find_process_by_exe_name(self, exe_name: str) -> Optional[Dict[str, Any]]:
        """Find process by exe file name (psutil); attach window info via find_window_by_pid. Same as original.
        Match by proc.info['name'] or by basename(proc.info['exe']) so Windows quirks (name vs exe path) are covered.
        """
        if not psutil or not exe_name:
            return None
        exe_lower = exe_name.lower()
        try:
            for proc in psutil.process_iter(["pid", "name", "exe"]):
                try:
                    info = proc.info
                    name_match = info.get("name") and info["name"].lower() == exe_lower
                    exe_path = info.get("exe") or ""
                    path_basename_ok = bool(exe_path and os.path.basename(exe_path).lower() == exe_lower)
                    path_under_ros = bool(self._ros_dir_norm and exe_path and _normpath(exe_path).startswith(self._ros_dir_norm))
                    path_match = path_basename_ok and (path_under_ros or not self._ros_dir_norm)
                    if not name_match and not path_match:
                        continue
                    pid = info["pid"]
                    winfo = self.find_window_by_pid(pid)
                    result = {
                        "pid": pid,
                        "exe_name": info.get("name") or os.path.basename(exe_path) or exe_name,
                        "exe_path": exe_path,
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
        """Check if process is running by exe name only (same-dir exe logic; no title fallback)."""
        return self.find_process_by_exe_name(exe_name)

    def _check_process_running_by_title(self, exe_name: str) -> Optional[Dict[str, Any]]:
        """Deprecated: title-based match (e.g. any window with 'RoS-BoT' in title). Do not use for ROSBOT; all lookup must go through same-dir exe logic (get_rosbot_window / get_rosbot_detection)."""
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

    def _get_rosbot_window_and_process(self) -> Tuple[Optional[Dict[str, Any]], bool]:
        """
        Single ROSBOT lookup: same-dir exe list only (other exes first, then main exe). Process by find_process_by_exe_name.
        Window: when content validator is set, pick the visible window that has main UI content (profileTab/btnStart); otherwise find_window_by_pid (one window by PID). No title filtering; exe is unique.
        When result is (None, True) (process found but no main window), result is cached at module level for _ROSBOT_LOOKUP_CACHE_TTL_SEC to skip repeated lookup and log spam.
        """
        global _rosbot_lookup_cache, _rosbot_lookup_cache_at
        now = time.time()
        if _rosbot_lookup_cache[0] is None and _rosbot_lookup_cache[1] is True and (now - _rosbot_lookup_cache_at) <= _ROSBOT_LOOKUP_CACHE_TTL_SEC:
            ColorPrint.gray("[ROSBOTManager] get_rosbot_window cache hit (no main window), skip lookup")
            return _rosbot_lookup_cache
        ros_dir = self.get_ros_directory()
        other_files = self.find_other_exe_files()
        ColorPrint.gray(
            f"[ROSBOTManager] get_rosbot_window Step 1: same-dir exe list -> ros_directory={ros_dir!r}, count={len(other_files)}, list={[os.path.basename(p) for p in other_files]}"
        )
        any_process_found = False
        validator = self._main_window_content_validator

        def _resolve_window(pid: int, exe_name: str) -> Tuple[Optional[Dict[str, Any]], int]:
            """Return (main window or None, visible_window_count). When validator set: get visible list, exclude by title (popup = The Vault per JSON), then pick by content."""
            if validator:
                candidates = self.find_windows_by_pid(pid, visible_only=True)
                n = len(candidates)
                # Exclude popup window: title "The Vault" = No items dialog (docs/rosbot_ui_elements.json)
                main_candidates = [w for w in candidates if (w.get("title") or "").strip() != _POPUP_NO_ITEMS_TITLE]
                for w in main_candidates:
                    try:
                        if validator(int(w["hwnd"])):
                            return (w, n)
                    except Exception:
                        continue
                return (None, n)
            w = self.find_window_by_pid(pid, visible_only=True)
            return (w, 1 if w else 0)

        for exe_path in other_files:
            exe_name = os.path.basename(exe_path)
            proc_info = self.find_process_by_exe_name(exe_name)
            if not proc_info or not proc_info.get("pid"):
                continue
            any_process_found = True
            winfo, visible_count = _resolve_window(proc_info["pid"], exe_name)
            if winfo:
                if validator:
                    ColorPrint.gray(
                        f"[ROSBOTManager] get_rosbot_window Step 2: same-dir {exe_name!r} {visible_count} visible window(s), content-matched main window"
                    )
                else:
                    ColorPrint.gray(
                        f"[ROSBOTManager] get_rosbot_window Step 2: same-dir {exe_name!r} visible window, title={winfo.get('title')!r}"
                    )
                _rosbot_lookup_cache = (winfo, True)
                _rosbot_lookup_cache_at = time.time()
                return (winfo, True)
            if validator and visible_count > 0:
                ColorPrint.gray(
                    f"[ROSBOTManager] get_rosbot_window Step 2: same-dir {exe_name!r} {visible_count} visible window(s) but none with main UI content (e.g. only popup)"
                )
            else:
                ColorPrint.gray(
                    f"[ROSBOTManager] get_rosbot_window Step 2: same-dir {exe_name!r} process (PID={proc_info.get('pid')}) 0 visible windows"
                )
        proc_info = self.find_process_by_exe_name(self.rosbot_exe_name)
        if proc_info and proc_info.get("pid"):
            any_process_found = True
            winfo, visible_count = _resolve_window(proc_info["pid"], self.rosbot_exe_name)
            if winfo:
                if validator:
                    ColorPrint.gray(
                        f"[ROSBOTManager] get_rosbot_window Step 2: main exe {self.rosbot_exe_name!r} {visible_count} visible window(s), content-matched main window"
                    )
                else:
                    ColorPrint.gray(
                        f"[ROSBOTManager] get_rosbot_window Step 2: main exe {self.rosbot_exe_name!r} visible window, title={winfo.get('title')!r}"
                    )
                _rosbot_lookup_cache = (winfo, True)
                _rosbot_lookup_cache_at = time.time()
                return (winfo, True)
            if validator and visible_count > 0:
                ColorPrint.gray(
                    f"[ROSBOTManager] get_rosbot_window Step 2: main exe {self.rosbot_exe_name!r} {visible_count} visible window(s) but none with main UI content (e.g. only popup)"
                )
            else:
                ColorPrint.gray(
                    f"[ROSBOTManager] get_rosbot_window Step 2: main exe {self.rosbot_exe_name!r} process (PID={proc_info.get('pid')}) 0 visible windows"
                )
        if any_process_found:
            ColorPrint.gray("[ROSBOTManager] get_rosbot_window Step 2: process(es) found but no visible main window")
            _rosbot_lookup_cache = (None, True)
            _rosbot_lookup_cache_at = time.time()
        else:
            ColorPrint.gray("[ROSBOTManager] get_rosbot_window Step 2: no process/window for same-dir exe")
            _rosbot_lookup_cache = (None, False)
            _rosbot_lookup_cache_at = time.time()
        return (None, any_process_found)

    def get_rosbot_window(self) -> Optional[Dict[str, Any]]:
        """Return ROSBOT window only when visible (paused). Delegates to _get_rosbot_window_and_process()."""
        winfo, _ = self._get_rosbot_window_and_process()
        return winfo

    def get_any_visible_rosbot_window(self) -> Optional[Dict[str, Any]]:
        """Return any visible window of the same-dir ROSBOT process (by PID). No content validator, no cache. For UI debug/export only."""
        return self._get_any_rosbot_window_impl(visible_only=True)

    def get_any_rosbot_window_for_debug(self) -> Optional[Dict[str, Any]]:
        """Return any window of the same-dir ROSBOT process (by PID), including minimized. No cache. For debug/export only; does not affect get_rosbot_window/get_rosbot_detection."""
        return self._get_any_rosbot_window_impl(visible_only=False)

    def _get_any_rosbot_window_impl(self, visible_only: bool) -> Optional[Dict[str, Any]]:
        """Same-dir exe order; exclude popup title; optional visible_only."""
        for exe_path in self.find_other_exe_files():
            exe_name = os.path.basename(exe_path)
            proc_info = self.find_process_by_exe_name(exe_name)
            if not proc_info or not proc_info.get("pid"):
                continue
            candidates = self.find_windows_by_pid(proc_info["pid"], visible_only=visible_only)
            for w in candidates:
                if (w.get("title") or "").strip() == _POPUP_NO_ITEMS_TITLE:
                    continue
                return w
        proc_info = self.find_process_by_exe_name(self.rosbot_exe_name)
        if proc_info and proc_info.get("pid"):
            candidates = self.find_windows_by_pid(proc_info["pid"], visible_only=visible_only)
            for w in candidates:
                if (w.get("title") or "").strip() == _POPUP_NO_ITEMS_TITLE:
                    continue
                return w
        return None

    def get_rosbot_detection(self) -> Dict[str, Any]:
        """
        Extended status: not_found (no process), running (process, no visible window), paused (has visible window).
        Single pass via _get_rosbot_window_and_process(); no redundant is_running() call.
        """
        winfo, process_found = self._get_rosbot_window_and_process()
        if winfo:
            return {"status": "paused", "window_info": winfo}
        if process_found:
            return {"status": "running", "window_info": None}
        return {"status": "not_found", "window_info": None}

    def get_running_rosbot_processes(self) -> List[Dict[str, Any]]:
        """Same-dir exe only: other exes first then main; find_process_by_exe_name + find_window_by_pid(pid). No title filter."""
        out: List[Dict[str, Any]] = []
        for exe_path in self.find_other_exe_files():
            exe_name = os.path.basename(exe_path)
            proc_info = self.find_process_by_exe_name(exe_name)
            if not proc_info:
                continue
            pid = proc_info.get("pid")
            winfo = self.find_window_by_pid(pid, visible_only=False) if pid else None
            out.append({"pid": pid, "exe_path": proc_info.get("exe_path", ""), "exe_name": proc_info.get("exe_name", ""), "window_info": winfo})
        proc_info = self.find_process_by_exe_name(self.rosbot_exe_name)
        if proc_info:
            pid = proc_info.get("pid")
            winfo = self.find_window_by_pid(pid, visible_only=False) if pid else None
            out.append({"pid": pid, "exe_path": proc_info.get("exe_path", ""), "exe_name": proc_info.get("exe_name", ""), "window_info": winfo})
        return out

    def is_running(self) -> bool:
        """True if ROSBOT online (running or paused). Single source: get_rosbot_detection(); no redundant process-only check."""
        return self.get_rosbot_detection()["status"] in ("running", "paused")

    def kill_if_running(self) -> bool:
        """Kill main exe and each same-dir exe process (find_process_by_exe_name -> pid -> kill)."""
        ok = True
        proc_info = self.find_process_by_exe_name(self.rosbot_exe_name)
        if proc_info and proc_info.get("pid"):
            ColorPrint.blue(f"[ROSBOTManager] Killing main exe {self.rosbot_exe_name} (PID: {proc_info['pid']})...")
            if not kill_process_by_pid(proc_info["pid"], log_prefix="[ROSBOTManager]"):
                ok = False
        for exe_path in self.find_other_exe_files():
            exe_name = os.path.basename(exe_path)
            proc_info = self.find_process_by_exe_name(exe_name)
            if proc_info and proc_info.get("pid"):
                ColorPrint.blue(f"[ROSBOTManager] Killing same-dir {exe_name} (PID: {proc_info['pid']})...")
                if not kill_process_by_pid(proc_info["pid"], log_prefix="[ROSBOTManager]"):
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
        """Kill all running same-dir other exe processes; optionally send F7 before kill (window by find_window_by_pid(pid))."""
        other_exe_files = self.find_other_exe_files()
        if not other_exe_files:
            return True
        cleanup_count = 0
        for exe_path in other_exe_files:
            exe_name = os.path.basename(exe_path)
            process_info = self.find_process_by_exe_name(exe_name)
            if not process_info:
                continue
            pid = process_info.get("pid")
            if send_f7_before_kill and pid:
                winfo = self.find_window_by_pid(pid, visible_only=False)
                if winfo and winfo.get("hwnd"):
                    self.send_f7_to_process(winfo)
                time.sleep(1)
            if pid and kill_process_by_pid(pid, log_prefix="[ROSBOTManager]"):
                cleanup_count += 1
            time.sleep(0.5)
        if cleanup_count > 0:
            time.sleep(2)
        return True

    def wait_for_new_other_exe(self, timeout_seconds: int = 60) -> Optional[Dict[str, Any]]:
        """Wait for a same-dir other exe process to appear (find_other_exe_files + find_process_by_exe_name)."""
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
