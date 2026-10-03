#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pycore Module Caller - the one pycore service entry point.

Launches the pycore service with platform-aware configuration
(singleton app_id=pycore_module_caller, port range 59100-59199).

Architecture:
- pyctl/runtime/launcher_composition: builds the LauncherConfig
- callmodule/rpc_routes: the RPC route table wired onto the HTTP server
- pylauncher/: singleton detection and service launching
- pythreadpool/: service threads

This module now lives inside the ``pycore`` package directory (it used to sit at
the repository root). The preferred entry point is ``pyservice.ps1`` /
``pyservice.sh`` at the repo root, which installs the heavy ps1/sh-managed
prerequisites first and then launches this script. It can still be run directly.

Usage:
    # Preferred (handles prerequisites + launch):
    .\\pyservice.ps1                                     # Windows
    ./pyservice.sh                                       # Linux / macOS / Git-Bash

    # Direct (no prerequisite installation step):
    python pycore/pycore_module_caller.py                # Default (127.0.0.1:59000; LAN bind needs rpcLanBind)
    python pycore/pycore_module_caller.py --host 0.0.0.0 --port 8000
    python pycore/pycore_module_caller.py --debug
"""

import argparse
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

from pycore.pyfoundations.windowless_subprocess import windowless_subprocess

# Installed before anything can spawn: a console-less Windows run (tray /
# autostart / pythonw) would otherwise flash a focus-stealing console window
# for every ffmpeg, ffprobe, nvidia-smi, git or python child.
windowless_subprocess.install()

from pycore.pyfoundations.desktop_session import ensure_session_environment

# Desktop session variables (XAUTHORITY, DBus address, runtime dir) are resolved
# and the process-wide Xlib session-cookie hook is installed before any GUI
# library loads, so every Xlib user (pystray included) authenticates.
ensure_session_environment()
if sys.platform.startswith('linux'):
    import pycore.pyutils.common.x11_display  # noqa: F401 - installs the Xlib auth hook

from pycore.pylauncher.platform.startup_manager import ensure_startup_launcher
from pycore.pyutils.common.process_restart import restart_current_process

from pycore.pyfoundations.system_paths import apply_shared_cache_env

apply_shared_cache_env()

from pycore.pyfoundations.console_log_journal import console_log_journal

# Journal ALL console output (ColorPrint + raw stdout/stderr) before any
# further import can print, so the UI log panel replays the whole process
# output in every run mode (foreground, systemd/Windows auto-start, relay).
console_log_journal.install()

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.network_constants import HTTP_BIND_HOST, PYCORE_HTTP_PORT
from pycore.pyfoundations.notebook_policy import local_http_enabled, notebook_assist_node
import pycore.pylauncher.register_providers  # noqa: F401 — provider registration
from pycore.pylauncher.launcher import ServiceLauncher
from pycore.pyfoundations.singleton.detector import on_singleton_superseded
from pycore.callmodule.rpc_routes.register_http_routes import register_http_routes
from pycore.pyctl.runtime.launcher_composition import (
    build_launcher_config,
    build_tray_service_config,
    start_rpc_runtime,
)
from pycore.pylauncher.tray_menu import keep_agent_history_tray_state, update_tray_menu_with_singleton
from pycore.pyctl.agent_history.pipeline.config import get_config as get_agent_history_config
from pycore.pyctl.runtime.event_handlers import register_event_handlers
from pycore.pyctl.runtime.pyservice_mode_service import pyservice_mode_service
from pycore.pyctl.tts.batch_startup_selfcheck import run_selfcheck, selfcheck_enabled
from pycore.pyutils.tts import runtime_profile
from pycore.pyutils.tts.batch.batch_constants import TTS_STARTUP_SELFCHECK_ENV
from pycore.pyutils.common.service_config import NO_TRAY_ENV

# Set when a NEWER instance supersedes this (running PRIMARY) one via the
# singleton port protocol. It drives the PROCESS EXIT CODE: a superseded instance
# must exit 3 (same contract as the 'yielded_to_newer' path) so pyservice.ps1/.sh
# LEAVE the shared UI dev server (:13054) running for the new instance. Without
# this, a superseded PRIMARY returns from main() and exits 0, and its owning
# pyservice tears down the dev server the newer instance's webview is reusing
# -> the new webview shows "Load failed: http://localhost:13054/pycore-manager".
_SUPERSEDED = {'flag': False}
# Keeps the tray's agent-history flags ahead of the tray menu refresh handler
# (default priority 100) registered on the same event by event_handlers.
AGENT_HISTORY_TRAY_KEEP_PRIORITY = 10
STOP_SIGNAL_NAMES = ("SIGINT", "SIGTERM", "SIGBREAK")


def _ensure_autostart() -> None:
    outcome = ensure_startup_launcher()
    if outcome:
        ColorPrint.blue(f"[Main] Boot auto-start {outcome} (pyservice + UI, hot reload off)")


def init_rpc_routes(server) -> None:
    """RPC server init callback: wire the route table, then the RPC runtime."""
    register_http_routes(server)
    start_rpc_runtime()


def main(
    host: str = HTTP_BIND_HOST,
    port: int = PYCORE_HTTP_PORT,
    debug: bool = False,
    service_mode: "str | None" = None,
):
    """
    Main entry point

    Args:
        host: RPC server host
        port: RPC server port
        debug: Debug mode
        service_mode: Explicit startup mode; reconfigures and persists. None
            keeps the env/persisted-cache/default resolution untouched.
    """
    if service_mode is not None:
        pyservice_mode_service.configure(service_mode)
    console_log_journal.install()
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("Pycore Module Caller - Starting")
    ColorPrint.blue("=" * 70)

    # 0. Tray agent-history switches: pylauncher never imports pyctl, so the
    #    tray keeps every AGENT_HISTORY_CONFIG_CHANGED payload and gets the
    #    owner's config injected here, before the first tray menu is built.
    THREAD_BUS.register_event_handler(
        BusSignals.AGENT_HISTORY_CONFIG_CHANGED,
        keep_agent_history_tray_state,
        priority=AGENT_HISTORY_TRAY_KEEP_PRIORITY,
    )
    keep_agent_history_tray_state({"config": get_agent_history_config()})

    # 1. Build configuration (only config, no threads)
    config = build_launcher_config(
        init_rpc_routes,
        host=host,
        port=port,
        debug=debug,
        local_ui_enabled=pyservice_mode_service.local_ui_enabled(),
    )

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

    # 3. Register event handlers (THREAD_BUS)
    register_event_handlers(
        launcher,
        port,
        singleton_port,
        tray_config_builder=build_tray_service_config,
    )

    # 3c. The TTS batch self-check (--tts-selfcheck / TTS_STARTUP_SELFCHECK=1)
    #     already ran synchronously in __main__ BEFORE main(), so by this point
    #     the env flag is cleared and services own the machine alone.

    # 3a. Remember if a newer instance takes us over, so the exit code below tells
    #     pyservice to leave the shared UI dev server up (see _SUPERSEDED note).
    def _on_superseded(event_data):
        new_pid = event_data.get('new_pid') if isinstance(event_data, dict) else None
        ColorPrint.yellow(f"[Main] Superseded by newer instance (PID {new_pid}); "
                          "will exit 3 to keep the shared UI server running")
        _SUPERSEDED['flag'] = True
    on_singleton_superseded(_on_superseded)

    # 3b. Boot auto-start is on by default: register it when missing (unless the
    #     user turned it off) and refresh an existing launcher so the next boot
    #     runs the CURRENT entry point (pyservice + UI, hot reload off).
    if not notebook_assist_node():
        start_bus_task(_ensure_autostart, thread_name="AutostartEnsureThread")

    # 4. Update tray menu with singleton port.
    #    The tray runs in every service mode (relay reroutes UI content through
    #    Laravel; local desktop surfaces stay), so this signal is never mode-gated.
    if singleton_port and not notebook_assist_node():
        update_tray_menu_with_singleton(launcher, port, singleton_port)

    ColorPrint.green("=" * 70)
    if local_http_enabled():
        ColorPrint.green(f"[Main] RPC: http://localhost:{port}/")
    else:
        ColorPrint.green("[Main] RPC: relay-only (local HTTP listener disabled)")
    if singleton_port:
        ColorPrint.green(f"[Main] Singleton: {singleton_port}")
    ColorPrint.green("=" * 70)

    # 6. Setup signal handler for Ctrl+C and service stop (SIGTERM / SIGBREAK)
    def signal_handler(signum, frame):
        if not THREAD_BUS.is_shutdown_requested():
            ColorPrint.yellow(f"\n[Main] Stop signal {signal.Signals(signum).name}")
            THREAD_BUS.request_shutdown(reason=f"Signal {signal.Signals(signum).name}", execute_handlers=True)
        else:
            ColorPrint.yellow("\n[Main] Already shutting down, please wait...")

    for signal_name in STOP_SIGNAL_NAMES:
        if hasattr(signal, signal_name):
            signal.signal(getattr(signal, signal_name), signal_handler)

    # 7. No hot reload: long-running features (terminal auto-confirm, agent
    #    detection, schedulers) need an uninterrupted process. After code
    #    changes the AI restarts pycore itself (`systemctl restart pycore` /
    #    `pyservice restart`).

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
    parser.add_argument('--no-reload', action='store_true',
                        help='Accepted for existing callers; hot reload is off (restart pycore after code changes)')
    parser.add_argument(
        '--service-mode',
        choices=pyservice_mode_service.allowed_modes(),
        default=None,
        help='Explicit mode reconfigures and persists; omitted reuses the env/persisted/default resolution',
    )
    parser.add_argument('--no-tray', action='store_true',
                        help='Never start the tray icon (service mode); notifications keep working')
    parser.add_argument('--tts-selfcheck', action='store_true',
                        help='Run the TTS batch-model self-check synchronously BEFORE services start '
                             '(pyservice.ps1/.sh instead run pycore.pyctl.tts.batch_selfcheck_main as a '
                             'separate standalone step; this flag is the direct-invocation fallback)')

    args = parser.parse_args()
    if args.no_tray:
        os.environ[NO_TRAY_ENV] = '1'
    if args.tts_selfcheck:
        os.environ[TTS_STARTUP_SELFCHECK_ENV] = '1'
    if selfcheck_enabled():
        # Gate: sweep synchronously BEFORE any service starts (RPC :59000,
        # singleton, launcher threads), so the single-module test owns the
        # machine's RAM/VRAM; full startup continues only once it finishes.
        ColorPrint.blue("[Main] TTS self-check gate: running sweep before services start")
        run_selfcheck()
        os.environ.pop(TTS_STARTUP_SELFCHECK_ENV, None)
    # Pin the global TTS runtime profile (the configurator) after the
    # --tts-selfcheck sweep handed RAM/GPU back. GPU probing (nvidia-smi +
    # CUDA init) takes 30s+, so it runs in the background: every reader goes
    # through the locked, idempotent pin_runtime_profile() and waits for it,
    # while the RPC server and tray bind immediately.
    start_bus_task(runtime_profile.pin_runtime_profile, thread_name="TtsRuntimeProfilePinThread")
    main(
        host=args.host,
        port=args.port,
        debug=args.debug,
        service_mode=args.service_mode,
    )

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
            restart_current_process(
                [_script, *sys.argv[1:]],
                cwd=PROJECT_ROOT,
            )
        except Exception as e:  # noqa: BLE001 - fall back to a hard exit
            ColorPrint.yellow(f"[Main] process restart failed ({e}); exiting instead. Please restart manually.")
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
