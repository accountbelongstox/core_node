#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Restart helper - shared os.execv restart logic.

Deduplicates the two verbatim restart blocks (server-mode + pyside6-mode)
that previously lived inline in launch_native_app / _create_pyside6_ui.
"""

import time

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

import os
import sys



def restart_process() -> None:
    """
    Restart the current process via os.execv if a restart was requested.

    Called after shutdown completes in both code paths:
    - Server mode (no GUI): after the shutdown wait-loop exits.
    - PySide6 mode: after framework.start() (event loop) returns.

    If THREAD_BUS.is_restart_requested() is True, replaces the current
    process with a fresh invocation (os.execv works in low privilege);
    otherwise logs a clean-shutdown message and returns.
    """

    if not THREAD_BUS.is_restart_requested():
        ColorPrint.blue("[NativeLauncher] Shutdown complete (no restart requested)")
        return

    ColorPrint.yellow("=" * 70)
    ColorPrint.yellow("[NativeLauncher] Restart requested, restarting process...")
    ColorPrint.yellow("=" * 70)

    # Small delay to ensure all resources are released
    time.sleep(0.5)

    # Restart process using os.execv()
    # This replaces the current process with a new one (works in low privilege)
    python = sys.executable
    args = [python] + sys.argv

    ColorPrint.green(f"[NativeLauncher] Restarting with: {' '.join(args)}")

    try:
        os.execv(python, args)
    except Exception as e:
        ColorPrint.print_error(f"[NativeLauncher] Failed to restart process: {e}")
        ColorPrint.yellow("[NativeLauncher] Please restart manually")
