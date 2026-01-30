#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Process helper: kill by exe name or by PID (from actual found window).
Used by BattleNetManager (exe name) and D3Manager (PID from found window).
"""

import os
import subprocess
from typing import Optional

from providor.common_imports import ColorPrint

try:
    import win32process
except ImportError:
    win32process = None


def get_pid_from_hwnd(hwnd: int) -> Optional[int]:
    """Get process ID of the process that owns the window. Returns None if unavailable."""
    if win32process is None or not hwnd:
        return None
    try:
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        return pid or None
    except Exception:
        return None


def kill_process_by_pid(
    pid: int,
    timeout: int = 15,
    log_prefix: str = "[ProcessHelper]",
) -> bool:
    """
    Kill process by PID using taskkill /F /PID.
    Returns True if killed or process was not found; False on error.
    """
    try:
        r = subprocess.run(
            ["taskkill", "/F", "/PID", str(pid)],
            capture_output=True,
            text=True,
            timeout=timeout,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        if r.returncode == 0:
            ColorPrint.green(f"{log_prefix} Process PID {pid} killed")
            return True
        err = (r.stderr or r.stdout or "").lower()
        if "not found" in err or "no running instance" in err:
            ColorPrint.yellow(f"{log_prefix} Process PID {pid} was not running (already exited)")
            return True
        ColorPrint.yellow(f"{log_prefix} taskkill PID {pid}: {r.stderr or r.stdout}")
        return False
    except Exception as e:
        ColorPrint.red(f"{log_prefix} Kill PID {pid} error: {e}")
        return False


def kill_process_by_exe(
    exe_name: str,
    timeout: int = 15,
    log_prefix: str = "[ProcessHelper]",
) -> bool:
    """
    Kill process by image name using taskkill /F /IM.
    Returns True if killed or process was not found; False on error.
    """
    try:
        r = subprocess.run(
            ["taskkill", "/F", "/IM", exe_name],
            capture_output=True,
            text=True,
            timeout=timeout,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        if r.returncode == 0:
            ColorPrint.green(f"{log_prefix} {exe_name} killed")
            return True
        if "not found" in (r.stderr or "").lower() or "not found" in (r.stdout or "").lower():
            ColorPrint.yellow(f"{log_prefix} {exe_name} was not running")
            return True
        ColorPrint.yellow(f"{log_prefix} taskkill: {r.stderr or r.stdout}")
        return False
    except Exception as e:
        ColorPrint.red(f"{log_prefix} Kill error: {e}")
        return False
