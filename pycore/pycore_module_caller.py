#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import argparse
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
# Must happen BEFORE any `from pycore import ...` — otherwise, when CWD is not
# on sys.path (e.g. invoked via an absolute path from a different directory),
# the very first import fails with ModuleNotFoundError.
sys.path[:] = [p for p in sys.path
               if not (p and Path(p).resolve() == PYCORE_ROOT)]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pylauncher.platform.startup_manager import refresh_startup_launcher
from pycore.pyutils.common.dev_reload import start_reload_watcher

from pycore.pyfoundations.system_paths import apply_shared_cache_env

apply_shared_cache_env()

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.network_constants import HTTP_BIND_HOST, PYCORE_HTTP_PORT
import pycore.pylauncher.register_providers  # noqa: F401 — provider registration
from pycore.pylauncher.launcher import ServiceLauncher, on_singleton_superseded
from pycore.callmodule.config import build_launcher_config, build_tray_service_config
from pycore.pylauncher.tray_menu import update_tray_menu_with_singleton
from pycore.pyctl.runtime.event_handlers import register_event_handlers

# Set when a NEWER instance supersedes this (running PRIMARY) one via the
# singleton port protocol. It drives the PROCESS EXIT CODE: a superseded instance
# must exit 3 (same contract as the 'yielded_to_newer' path) so pyservice.ps1/.sh
# LEAVE the shared UI dev server (:13054) running for the new instance. Without
# this, a superseded PRIMARY returns from main() and exits 0, and its owning
# pyservice tears down the dev server the newer instance's webview is reusing
# -> the new webview shows "Load failed: http://localhost:13054/pycore-manager".
_SUPERSEDED = {'flag': False}


def main(
    host: str = HTTP_BIND_HOST,
    port: int = PYCORE_HTTP_PORT,
    debug: bool = False,
    reload: bool = True,
):
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
    register_event_handlers(
        launcher,
        port,
        singleton_port,
        tray_config_builder=build_tray_service_config,
    )

    # 3a. Remember if a newer instance takes us over, so the exit code below tells
    #     pyservice to leave the shared UI dev server up (see _SUPERSEDED note).
    def _on_superseded(event_data):
        new_pid = event_data.get('new_pid') if isinstance(event_data, dict) else None
        ColorPrint.yellow(f"[Main] Superseded by newer instance (PID {new_pid}); "
                          "will exit 3 to keep the shared UI server running")
        _SUPERSEDED['flag'] = True
    on_singleton_superseded(_on_superseded)

    # 3b. Self-heal the boot auto-start launcher: if enabled, rewrite its fixed
    #     script so the next boot runs the CURRENT canonical entry point
    #     (pyservice.ps1/.sh = dashboard UI dev server + worker). Launchers
    #     written by older versions started the bare worker only, so the UI dev
    #     server never came up in boot mode (webview -> ERR_CONNECTION_REFUSED).
    if refresh_startup_launcher():
        ColorPrint.blue("[Main] Auto-start launcher refreshed (next boot uses pyservice + UI)")

    # 4. Update tray menu with singleton port (callmodule layer - config update)
    if singleton_port:
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
    #    os.execv re-exec, which re-reads ALL Python). On by default; --no-reload to disable.
    if reload:
        start_reload_watcher()

    # 8. Wait for shutdown signal (THREAD_BUS is the event center)
    ColorPrint.blue("[Main] Running... (Press Ctrl+C or use tray to exit)")

    while not THREAD_BUS.is_shutdown_requested():
        time.sleep(0.5)

    shutdown_reason = THREAD_BUS.get_shutdown_reason() or "unknown"
    ColorPrint.blue(f"[Main] Shutdown signal received (reason={shutdown_reason})")
    ColorPrint.blue("[Main] Shutting down all services...")
    launcher.stop()
    ColorPrint.green("[Main] Shutdown complete")


if __name__ == '__main__':

    parser = argparse.ArgumentParser(description="Pycore Module Caller")
    parser.add_argument('--host', default=HTTP_BIND_HOST, help='Host to bind')
    parser.add_argument('--port', type=int, default=PYCORE_HTTP_PORT, help='Port to bind')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    parser.add_argument('--reload', action='store_true',
                        help='Hot-reload is ON by default; this flag is kept for compatibility')
    parser.add_argument('--no-reload', action='store_true',
                        help='Disable hot-reload: do not restart backend on .py changes')

    args = parser.parse_args()
    reload_enabled = True
    if args.no_reload or os.environ.get('PYCORE_NO_RELOAD', '') in ('1', 'true', 'True'):
        reload_enabled = False
    if os.environ.get('PYCORE_RELOAD', '') in ('0', 'false', 'False'):
        reload_enabled = False
    if args.reload:
        reload_enabled = True
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
        # Superseded by a newer instance (singleton takeover): exit 3 so
        # pyservice.ps1/.sh leave the SHARED UI dev server (:13054) running for
        # the newer instance — the same contract as the 'yielded_to_newer' path.
        # The event-driven flag is primary; the shutdown-reason string is a
        # belt-and-suspenders fallback in case the async event lagged.
        _reason = THREAD_BUS.get_shutdown_reason() or ''
        if _SUPERSEDED['flag'] or 'Superseded' in _reason:
            ColorPrint.yellow("[Main] Superseded by newer instance (exit 3; UI server left running)")
            os._exit(3)
        os._exit(0)
