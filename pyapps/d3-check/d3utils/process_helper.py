#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Process helper: kill by exe name or by PID (from actual found window).
Used by BattleNetManager (exe name) and D3Manager (PID from found window).
Uses win32api (Windows) or psutil for terminate; no subprocess.
"""

import os
from typing import Optional

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import (
    get_third_package_psutil,
    get_third_package_win32api,
    get_third_package_win32process,
)

win32api = get_third_package_win32api()
win32process = get_third_package_win32process()
psutil = get_third_package_psutil()

PROCESS_TERMINATE = 0x0001


def get_pid_from_hwnd(hwnd: int) -> Optional[int]:
    """Get process ID of the process that owns the window. Returns None if unavailable."""
    if win32process is None or not hwnd:
        return None
    _, pid = win32process.GetWindowThreadProcessId(hwnd)
    return pid or None


def kill_process_by_pid(
    pid: int,
    timeout: int = 15,
    log_prefix: str = "[ProcessHelper]",
) -> bool:
    """
    Kill process by PID using win32api (Windows) or psutil. Returns True if killed or not found; False on error.
    """
    if win32api is not None and os.name == "nt":
        try:
            handle = win32api.OpenProcess(PROCESS_TERMINATE, False, pid)
            win32api.TerminateProcess(handle, 0)
            win32api.CloseHandle(handle)
            ColorPrint.green(f"{log_prefix} Process PID {pid} killed")
            return True
        except OSError as e:
            err = getattr(e, "winerror", None)
            if err in (87, 5):
                ColorPrint.yellow(f"{log_prefix} Process PID {pid} was not running (already exited)")
                return True
            ColorPrint.red(f"{log_prefix} Kill PID {pid} error: {e}")
            return False
    if psutil is not None:
        try:
            p = psutil.Process(pid)
            p.terminate()
            p.wait(timeout=timeout)
            ColorPrint.green(f"{log_prefix} Process PID {pid} killed")
            return True
        except psutil.NoSuchProcess:
            ColorPrint.yellow(f"{log_prefix} Process PID {pid} was not running")
            return True
        except (psutil.AccessDenied, psutil.TimeoutExpired) as e:
            ColorPrint.red(f"{log_prefix} Kill PID {pid} error: {e}")
            return False
    ColorPrint.red(f"{log_prefix} No win32api/psutil for kill by PID")
    return False


def kill_process_by_exe(
    exe_name: str,
    timeout: int = 15,
    log_prefix: str = "[ProcessHelper]",
) -> bool:
    """
    Kill process by image name using psutil. Returns True if killed or not found; False on error.
    """
    if psutil is None:
        ColorPrint.red(f"{log_prefix} psutil not available for kill by exe")
        return False
    found = False
    for p in psutil.process_iter(["pid", "name"]):
        try:
            if (p.info.get("name") or "").lower() == exe_name.lower():
                p.terminate()
                p.wait(timeout=timeout)
                found = True
                ColorPrint.green(f"{log_prefix} {exe_name} killed (PID {p.pid})")
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.TimeoutExpired):
            pass
    if not found:
        ColorPrint.yellow(f"{log_prefix} {exe_name} was not running")
    return True
