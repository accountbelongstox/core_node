#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3Check - Diablo III Bot Auto Control System
Main entry point for the application

Usage:
    python main.py   # Start TK GUI + HTTP bridge (no CLI args, no Ctrl+C handler, exit via UI only)
"""

import os
import signal
import sys

# Ignore Ctrl+C: set SIGINT/SIGBREAK before importing Fortran/numpy to avoid forrtl control-C abort
try:
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    if hasattr(signal, "SIGBREAK"):
        signal.signal(signal.SIGBREAK, signal.SIG_IGN)
except OSError:
    pass

# Add repo root and app root to path so pycore and d3-check imports resolve
_project_dir = os.path.dirname(os.path.abspath(__file__))
_repo_root = os.path.dirname(os.path.dirname(_project_dir))
sys.path.insert(0, _project_dir)
sys.path.insert(0, _repo_root)

# Lifecycle: registers thread-shutdown runner with shutdown_manager. Only main (and event bus) may import lifecycle.
import lifecycle  # noqa: E402

from controller.d3_macro_controller import D3MacroController
from controller.http_bridge_controller import HTTPBridgeController
from runtime import get_system_initializer
from providor.i18n_manager import i18n_manager
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


def main():
    """Main application entry point. No args; starts TK GUI + HTTP bridge. No Ctrl+C exit; hotkeys/UI handle exit."""
    ColorPrint.blue("\n" + "=" * 80)
    ColorPrint.blue("D3Check - GUI Mode (TK + HTTP Bridge)")
    ColorPrint.blue("=" * 80)

    try:
        sys_init = get_system_initializer()
        if not sys_init.initialize_system(gui_mode=True):
            ColorPrint.red("[MAIN] System initialization failed, exiting...")
            return 1

        i18n_manager.load_language_from_config()

        controller = D3MacroController()
        bridge_controller = HTTPBridgeController(host='127.0.0.1', port=8765, macro_controller=controller)
        bridge_controller.start()
        ColorPrint.green("[MAIN] HTTP bridge started on http://127.0.0.1:8765")

        controller.run()
        return 0

    except KeyboardInterrupt:
        ColorPrint.yellow("\n[MAIN] Keyboard interrupt received, shutting down...")
        if 'bridge_controller' in locals():
            bridge_controller.stop()
        return 0
    except Exception as e:
        ColorPrint.red(f"[ERROR] Fatal error in main: {e}")
        if 'bridge_controller' in locals():
            bridge_controller.stop()
        return 1


if __name__ == "__main__":
    sys.exit(main())
