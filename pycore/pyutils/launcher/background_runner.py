# -*- coding: utf-8 -*-
"""
Background process runner for the window launcher.

launch_pycore_module starts pycore_module_caller.py as a detached subprocess
(pythonw.exe on Windows for no console window). The process is detached so it
continues after the launcher exits; RPC becomes available after startup
(default port 59000).
"""

import os
import platform
import sys
from pathlib import Path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import run_background
from pycore.pyfoundations.pygvar import PROJECT_ROOT, TMP_DIR
from pycore.pyutils.launcher.launch_guard import is_pycore_module_running

CALLER_SCRIPT = Path(PROJECT_ROOT) / 'pycore' / 'pycore_module_caller.py'
LOG_DIR = TMP_DIR / 'pycore_module'
LOG_FILE = LOG_DIR / 'pycore_module_launcher.log'
PYTHONW_EXE = 'pythonw.exe'


def _python_executable() -> str:
    """pythonw.exe beside the running interpreter on Windows (no console window)."""
    if platform.system() != 'Windows':
        return sys.executable
    pythonw_exe = Path(sys.executable).parent / PYTHONW_EXE
    if pythonw_exe.exists():
        ColorPrint.plain("[Launcher] Using pythonw.exe for no console window")
        return str(pythonw_exe)
    ColorPrint.yellow("[Launcher] WARNING: pythonw.exe not found, using python.exe")
    return sys.executable


def launch_pycore_module():
    """Launch pycore_module_caller.py detached in the background (skipped when already running)."""
    if is_pycore_module_running():
        ColorPrint.plain("[Launcher] Skipping Pycore Module (already running).")
        return

    ColorPrint.plain("[Launcher] Starting Pycore Module in background...")
    if not CALLER_SCRIPT.exists():
        ColorPrint.red(f"[Launcher] Failed: pycore_module_caller.py not found at {CALLER_SCRIPT}")
        return

    cmd = [_python_executable(), str(CALLER_SCRIPT)]
    env = os.environ.copy()
    env['PYTHONPATH'] = os.pathsep.join(filter(None, [str(PROJECT_ROOT), env.get('PYTHONPATH')]))
    ColorPrint.plain(f"[Launcher] Pycore Module log dir: {LOG_DIR}")
    ColorPrint.plain(f"[Launcher] Command: {' '.join(cmd)}")
    try:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        proc = run_background(cmd, cwd=str(PROJECT_ROOT), env=env, log_file=str(LOG_FILE), detached=True)
    except OSError as exc:
        ColorPrint.red(f"[Launcher] Failed to start Pycore Module ({' '.join(cmd)}): {exc}")
        ColorPrint.plain("[Launcher] You can start manually: python pycore_module_caller.py")
        return
    ColorPrint.plain(f"[Launcher] Pycore Module started with PID: {proc.pid}")
    ColorPrint.plain("[Launcher] RPC will be available after startup (default port 59000)")
