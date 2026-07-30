# -*- coding: utf-8 -*-
"""
Background process runner for the window launcher.

Extracted from launcher.py (modular split per AGENTS.md 800-line rule).
launch_pycore_module starts pycore_module_caller.py as a detached subprocess
(pythonw.exe on Windows for no console window). The process is detached so it
continues after the launcher exits; RPC v2 becomes available after startup
(default port 59000).
"""

import sys
from pathlib import Path

import time


# Add project root to Python path to enable pycore imports. Same bootstrap as
# launcher.py so this module is importable standalone.
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import platform
import os
import tempfile

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.commander import run_background
from pycore.pyutils.launcher.launch_guard import is_pycore_module_running


def launch_pycore_module():
    """
    Launch Pycore Module Caller in background (subprocess).

    Runs pycore_module_caller.py with pythonw on Windows for no console window.
    Process is detached so it continues after launcher exits.
    """
    if is_pycore_module_running():
        ColorPrint.plain("[Launcher] Skipping Pycore Module (already running).")
        return

    ColorPrint.plain("[Launcher] Starting Pycore Module in background...")

    project_root = Path(__file__).parent.parent.parent.parent
    caller_script = project_root / 'pycore' / 'pycore_module_caller.py'

    if not caller_script.exists():
        ColorPrint.plain(f"[Launcher] Failed: pycore_module_caller.py not found at {caller_script}")
        return

    try:
        log_dir = Path(tempfile.gettempdir()) / 'pycore_module'
        log_dir.mkdir(exist_ok=True)
        log_file = log_dir / 'pycore_module_launcher.log'
        ColorPrint.plain(f"[Launcher] Pycore Module log dir: {log_dir}")

        python_exe = sys.executable
        if platform.system() == 'Windows':
            python_dir = Path(sys.executable).parent
            pythonw_exe = python_dir / 'pythonw.exe'
            if pythonw_exe.exists():
                python_exe = str(pythonw_exe)
                ColorPrint.plain("[Launcher] Using pythonw.exe for no console window")
            else:
                ColorPrint.plain("[Launcher] WARNING: pythonw.exe not found, using python.exe")

        cmd = [python_exe, str(caller_script)]
        env = os.environ.copy()
        pythonpath = str(project_root)
        if 'PYTHONPATH' in env:
            sep = ';' if platform.system() == 'Windows' else ':'
            pythonpath = f"{pythonpath}{sep}{env['PYTHONPATH']}"
        env['PYTHONPATH'] = pythonpath

        ColorPrint.plain(f"[Launcher] Command: {' '.join(cmd)}")

        proc = run_background(
            cmd,
            cwd=str(project_root),
            env=env,
            log_file=str(log_file),
            detached=True
        )

        ColorPrint.plain(f"[Launcher] Pycore Module started with PID: {proc.pid}")
        ColorPrint.plain("[Launcher] RPC v2 will be available after startup (default port 59000)")

        time.sleep(0.5)
    except Exception as e:
        ColorPrint.plain(f"[Launcher] Failed to start Pycore Module: {e}")
        ColorPrint.plain("[Launcher] You can start manually: python pycore_module_caller.py")
