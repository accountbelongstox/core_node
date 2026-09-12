# -*- coding: utf-8 -*-
"""Cross-platform process-image restart handoff."""

from __future__ import annotations

import ctypes
import os
import subprocess
import sys
from pathlib import Path
from typing import Optional, Sequence


_RESTART_PARENT_PID_ENV = "PYCORE_RESTART_PARENT_PID"
_WINDOWS_RESTART_WAIT_MS = 30_000
_WINDOWS_SYNCHRONIZE = 0x00100000
_WINDOWS_DETACHED_PROCESS = 0x00000008
_WINDOWS_CREATE_NEW_PROCESS_GROUP = 0x00000200


def _windows_has_console() -> bool:
    """True when this process is attached to a console window.

    Canonical Win32 probe (GetConsoleWindow): terminal-started processes
    (pyservice.ps1 runs python as a direct console child) return a non-NULL
    handle; tray / launcher / autostart / pythonw contexts return NULL.
    """
    kernel32 = ctypes.windll.kernel32
    kernel32.GetConsoleWindow.restype = ctypes.c_void_p
    return bool(kernel32.GetConsoleWindow())


def wait_for_restart_parent() -> None:
    """Wait for the previous Windows process before singleton initialization."""
    parent_pid_text = os.environ.pop(_RESTART_PARENT_PID_ENV, "").strip()
    parent_pid = 0
    kernel32 = None
    process_handle = None

    if os.name != "nt" or not parent_pid_text:
        return
    try:
        parent_pid = int(parent_pid_text)
    except ValueError:
        return
    if parent_pid <= 0 or parent_pid == os.getpid():
        return

    kernel32 = ctypes.windll.kernel32
    kernel32.OpenProcess.argtypes = [ctypes.c_uint32, ctypes.c_int, ctypes.c_uint32]
    kernel32.OpenProcess.restype = ctypes.c_void_p
    kernel32.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_uint32]
    kernel32.WaitForSingleObject.restype = ctypes.c_uint32
    kernel32.CloseHandle.argtypes = [ctypes.c_void_p]
    kernel32.CloseHandle.restype = ctypes.c_int
    process_handle = kernel32.OpenProcess(_WINDOWS_SYNCHRONIZE, False, parent_pid)
    if not process_handle:
        return
    try:
        kernel32.WaitForSingleObject(process_handle, _WINDOWS_RESTART_WAIT_MS)
    finally:
        kernel32.CloseHandle(process_handle)


def restart_current_process(
    script_argv: Sequence[str],
    cwd: Optional[Path] = None,
) -> None:
    """Replace the process on POSIX or hand off after parent exit on Windows.

    Windows console contract (Microsoft Learn, Process Creation Flags):
    inheriting the parent's console is the DEFAULT - DETACHED_PROCESS is
    what severs it. A terminal-attached parent therefore hands off WITHOUT
    console flags and with inherited standard streams so the terminal keeps
    showing pyservice output across restarts; a console-less parent (tray /
    launcher / autostart) keeps the fully detached handoff so the successor
    survives terminal closure and never allocates a window.
    """
    executable = str(Path(sys.executable).resolve())
    command = [executable, *[str(item) for item in script_argv]]
    restart_cwd = str((cwd or Path.cwd()).resolve())
    restart_env = os.environ.copy()

    if os.name != "nt":
        os.execv(executable, command)
        return

    restart_env[_RESTART_PARENT_PID_ENV] = str(os.getpid())
    if _windows_has_console():
        # No CREATE_NEW_PROCESS_GROUP either: staying in the console's
        # process group keeps Ctrl+C delivery identical to pre-restart.
        subprocess.Popen(command, cwd=restart_cwd, env=restart_env)
    else:
        subprocess.Popen(
            command,
            cwd=restart_cwd,
            env=restart_env,
            creationflags=(
                _WINDOWS_DETACHED_PROCESS
                | _WINDOWS_CREATE_NEW_PROCESS_GROUP
            ),
            close_fds=True,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    os._exit(3)


wait_for_restart_parent()


__all__ = ["restart_current_process", "wait_for_restart_parent"]
