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
    """Replace the process on POSIX or hand off after parent exit on Windows."""
    executable = str(Path(sys.executable).resolve())
    command = [executable, *[str(item) for item in script_argv]]
    restart_cwd = str((cwd or Path.cwd()).resolve())
    restart_env = os.environ.copy()

    if os.name != "nt":
        os.execv(executable, command)
        return

    restart_env[_RESTART_PARENT_PID_ENV] = str(os.getpid())
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
