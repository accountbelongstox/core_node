#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pycore Module Caller - Entry Point

Launches Pycore Module Caller with platform-aware configuration.
Singleton (app_id=pycore_module_caller, port 59100) is shared with
callmodule_main/launch_native_app so only one instance runs.

Architecture:
- callmodule/: Builds configuration and registers event handlers
- pylauncher/: Handles singleton detection and service launching
- pythreadpool/: Starts actual service threads

This module now lives inside the ``pycore`` package directory (it used to sit at
the repository root). The preferred entry point is ``pyservice.ps1`` /
``pyservice.sh`` at the repo root, which installs the heavy ps1/sh-managed
prerequisites first and then launches this script. It can still be run directly.

Usage:
    # Preferred (handles prerequisites + launch):
    .\\pyservice.ps1                                     # Windows
    ./pyservice.sh                                       # Linux / macOS / Git-Bash

    # Direct (no prerequisite installation step):
    python pycore/pycore_module_caller.py                # Default (0.0.0.0:59000)
    python pycore/pycore_module_caller.py --host 0.0.0.0 --port 8000
    python pycore/pycore_module_caller.py --debug
"""

import os
import sys
import signal
import time
from pathlib import Path

# This file lives at <project_root>/pycore/pycore_module_caller.py.
# `from pycore import ...` requires the PROJECT ROOT (the parent of the pycore
# package) to be importable.
PYCORE_ROOT = Path(__file__).resolve().parent          # .../core_node/pycore
PROJECT_ROOT = PYCORE_ROOT.parent                       # .../core_node

# When run as a script (`python pycore/pycore_module_caller.py`), Python auto-
# inserts THIS file's own directory — the pycore package dir — at sys.path[0].
# Leaving it there would let pycore submodules be imported both as `pycore.x`
# AND as bare `x`, producing DUPLICATE module objects (and thus duplicate
# THREAD_BUS / ENCYCLOPEDIA singletons). Drop any sys.path entry that points at
# the package dir, then put the PROJECT ROOT first instead.
sys.path[:] = [p for p in sys.path
               if not (p and Path(p).resolve() == PYCORE_ROOT)]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint, THREAD_BUS
from pycore.pylauncher import ServiceLauncher
from pycore.callmodule.config import build_launcher_config, update_tray_menu_with_singleton
from pycore.callmodule.event_handlers import register_event_handlers


def main(host='0.0.0.0', port=59000, debug=False, reload=False):
    """
    Main entry point

    Args:
        host: RPC v2 server host
        port: RPC v2 server port
        debug: Debug mode
        reload: Dev hot-reload. Watch the pycore package's .py files and restart
            (via the existing THREAD_BUS restart -> os.execv path) on any change.
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("Pycore Module Caller - Starting")
    ColorPrint.blue("=" * 70)

    # 1. Build configuration (callmodule layer - only config, no threads)
    config = build_launcher_config(host=host, port=port, debug=debug)

    # 2. Start services (pylauncher layer - singleton + service launching)
    launcher = ServiceLauncher(config)
    if not launcher.start():
        ColorPrint.yellow("[Main] Failed to start (singleton conflict or error)")
        detection = launcher.detection_result
        if detection is not None and getattr(detection, 'yielded_to_newer', False):
            # This (older) process yielded to a NEWER running instance. Exit
            # with code 3 so pyservice.ps1/.sh skip their UI-server teardown —
            # the surviving instance is (or may be) serving its webview from it.
            ColorPrint.yellow("[Main] Yielding to newer running instance (exit 3; UI server left running)")
            sys.stdout.flush()
            sys.stderr.flush()
            os._exit(3)
        return

    # Get singleton port
    singleton_port = launcher.detection_result.port if launcher.detection_result else None

    ColorPrint.green(f"[Main] Services started successfully")
    if singleton_port:
        ColorPrint.blue(f"[Main] Singleton Port: {singleton_port}")

    # 3. Register event handlers (callmodule layer - event handlers via THREAD_BUS)
    register_event_handlers(launcher, port, singleton_port)

    # 3b. Self-heal the boot auto-start launcher: if enabled, rewrite its fixed
    #     script so the next boot runs the CURRENT canonical entry point
    #     (pyservice.ps1/.sh = dashboard UI dev server + worker). Launchers
    #     written by older versions started the bare worker only, so the UI dev
    #     server never came up in boot mode (webview -> ERR_CONNECTION_REFUSED).
    from pycore.callmodule.platform.startup_manager import refresh_startup_launcher
    if refresh_startup_launcher():
        ColorPrint.blue("[Main] Auto-start launcher refreshed (next boot uses pyservice + UI)")

    # 4. Update tray menu with singleton port (callmodule layer - config update)
    if singleton_port:
        time.sleep(0.5)  # wait for tray to register tray.update_menu handler
        update_tray_menu_with_singleton(launcher, port, singleton_port)

    ColorPrint.green("=" * 70)
    ColorPrint.green(f"[Main] RPC v2: http://localhost:{port}/")
    if singleton_port:
        ColorPrint.green(f"[Main] Singleton: {singleton_port}")
    ColorPrint.green("=" * 70)

    # 6. Setup signal handler for Ctrl+C
    def signal_handler(signum, frame):
        if not THREAD_BUS.is_shutdown_requested():
            ColorPrint.yellow("\n[Main] Keyboard interrupt (Ctrl+C)")
            THREAD_BUS.request_shutdown(reason="Keyboard interrupt", execute_handlers=True)
        else:
            ColorPrint.yellow("\n[Main] Already shutting down, please wait...")

    signal.signal(signal.SIGINT, signal_handler)

    # 7. Dev hot-reload: watch .py files and restart the backend on change.
    #    Reuses the proven restart path (request_restart -> graceful stop ->
    #    os.execv re-exec, which re-reads ALL Python). Dev-only; off by default.
    if reload:
        from pycore.pyutils.common.dev_reload import start_reload_watcher
        start_reload_watcher()

    # 8. Wait for shutdown signal (THREAD_BUS is the event center)
    ColorPrint.blue("[Main] Running... (Press Ctrl+C or use tray to exit)")

    while not THREAD_BUS.is_shutdown_requested():
        time.sleep(0.5)

    ColorPrint.blue("[Main] Shutdown signal received")
    ColorPrint.blue("[Main] Shutting down all services...")
    launcher.stop()
    ColorPrint.green("[Main] Shutdown complete")


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description="Pycore Module Caller")
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=59000, help='Port to bind (default: 59000)')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    parser.add_argument('--reload', action='store_true',
                        help='Dev hot-reload: restart backend on .py changes '
                             '(also enabled by PYCORE_RELOAD=1)')

    args = parser.parse_args()
    # Env var is an alternative switch so a wrapper can enable reload without
    # editing the argv it forwards.
    reload_enabled = args.reload or os.environ.get('PYCORE_RELOAD', '') in ('1', 'true', 'True')
    main(host=args.host, port=args.port, debug=args.debug, reload=reload_enabled)

    # ---- Process-level exit / restart -------------------------------------
    # main() returns only AFTER a graceful shutdown (launcher.stop() done, ports
    # released). The Qt/QtWebEngine event loop and the Tk bootstrap run in WORKER
    # threads here, so letting the Python interpreter unwind would run Chromium's
    # and Tcl's C++ teardown on the wrong thread -> 'Tcl_AsyncDelete: ... wrong
    # thread' and a process-aborting 'FATAL: ... CalledOnValidBrowserThread ...
    # Must be called on Chrome_UIThread'.
    #
    # Both are avoided by NOT unwinding:
    #   * restart  -> os.execv() replaces the process image immediately
    #                 (this is what makes the tray "Restart" actually restart;
    #                  previously the flag was set but never acted on, so restart
    #                  only shut the app down).
    #   * normal   -> os._exit(0) skips interpreter/teardown entirely.
    sys.stdout.flush()
    sys.stderr.flush()

    if THREAD_BUS.is_restart_requested():
        ColorPrint.yellow("=" * 70)
        ColorPrint.yellow("[Main] Restart requested - re-executing process...")
        ColorPrint.yellow("=" * 70)
        time.sleep(0.5)  # let the OS release sockets/handles from stopped services
        _script = str(Path(__file__).resolve())          # cwd-independent
        try:
            os.execv(sys.executable, [sys.executable, _script] + sys.argv[1:])
        except Exception as e:  # noqa: BLE001 - fall back to a hard exit
            ColorPrint.yellow(f"[Main] os.execv failed ({e}); exiting instead. Please restart manually.")
            os._exit(1)
    else:
        os._exit(0)
