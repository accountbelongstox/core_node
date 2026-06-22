#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3Check - Diablo III Bot Auto Control System
Main entry point for the application

Usage:
    python main.py                    # Start TK GUI + HTTP bridge (default)
    python main.py --http-bridge-only # Start only HTTP bridge (no GUI), for DOT client
    python main.py --http-bridge-only --port 8766  # Custom port

When imported as a library, nothing runs automatically; use HTTPBridgeController
or d3utils.yolo_record functions directly.
"""

import argparse
import ctypes
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
from pycore.pyfoundations.color_print import ColorPrint


def _parse_args():
    parser = argparse.ArgumentParser(
        description="D3Check - GUI or HTTP bridge only. Use --http-bridge-only for DOT client."
    )
    parser.add_argument(
        "--http-bridge-only",
        action="store_true",
        help="Start only HTTP bridge (no TK GUI). DOT app connects to this for YOLO record/export.",
    )
    parser.add_argument("--host", default="127.0.0.1", help="HTTP bridge host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765, help="HTTP bridge port (default: 8765)")
    return parser.parse_args()


def _run_gui_and_bridge():
    """Original behavior: TK GUI + HTTP bridge. No CLI args required."""
    if sys.platform == "win32":
        try:
            kernel32 = ctypes.windll.kernel32
            user32 = ctypes.windll.user32
            hwnd = kernel32.GetConsoleWindow()
            if hwnd:
                user32.ShowWindow(hwnd, 0)  # SW_HIDE
        except Exception:
            pass

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
        bridge_controller = HTTPBridgeController(host="127.0.0.1", port=8765, macro_controller=controller)
        bridge_controller.start()
        ColorPrint.green("[MAIN] HTTP bridge started on http://127.0.0.1:8765")

        controller.run()
        return 0

    except KeyboardInterrupt:
        ColorPrint.yellow("\n[MAIN] Keyboard interrupt received, shutting down...")
        if "bridge_controller" in locals():
            bridge_controller.stop()
        return 0
    except Exception as e:
        ColorPrint.red(f"[ERROR] Fatal error in main: {e}")
        if "bridge_controller" in locals():
            bridge_controller.stop()
        return 1


def _run_bridge_only(host: str, port: int):
    """Start only HTTP bridge; no TK GUI. For DOT calibration panel (Record/Export)."""
    ColorPrint.blue("\n" + "=" * 80)
    ColorPrint.blue("D3Check - HTTP Bridge Only (no GUI)")
    ColorPrint.blue("=" * 80)

    sys_init = get_system_initializer()
    if not sys_init.initialize_system(gui_mode=False):
        ColorPrint.red("[MAIN] System initialization failed, exiting...")
        return 1

    controller = D3MacroController()
    bridge_controller = HTTPBridgeController(host=host, port=port, macro_controller=controller)
    bridge_controller.start()
    ColorPrint.green(f"[MAIN] HTTP bridge started on http://{host}:{port} (DOT client can connect)")

    try:
        import time
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        ColorPrint.yellow("\n[MAIN] Shutting down bridge...")
    finally:
        bridge_controller.stop()
    return 0


def main():
    """Entry point. Parses CLI; runs GUI+bridge or bridge-only. When imported as library, main() is not called."""
    args = _parse_args()

    if args.http_bridge_only:
        return _run_bridge_only(args.host, args.port)

    return _run_gui_and_bridge()


if __name__ == "__main__":
    sys.exit(main())
