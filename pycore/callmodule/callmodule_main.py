#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pycore Callmodule - Native UI Integration

Unified startup entry using NativeUIConfig pattern (same as Matrix).

Architecture:
- native_ui: Handles everything (frontend, RPC v2, PySide6 UI, tray, callbacks)
- Callmodule: Only provides configuration and event handlers

Platform-specific behavior:
- Windows: PySide6 UI window + system tray + frontend
- Linux: Background mode (frontend only, no UI window)

Usage:
    # Via pycore_module_caller.py (recommended)
    python pycore_module_caller.py

    # Direct
    python -m pycore.callmodule.callmodule_main
"""

import sys
import os
import platform
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app, get_platform_adapter
from pycore.pyutils.native_ui.step2_port_url import register_port_range
from pycore.callmodule.callmodule_config import Config

# Import all routers
# Management Layer (9 routers)
from pycore.callmodule.routers.management import (
    status_router,
    config_router,
    control_router,
    logs_router,
    capabilities_router,
    local_config_router,
    local_stats_router,
    local_test_router,
    heartbeat_router,
)

# Local Processing Layer (5 routers)
from pycore.callmodule.routers.local import (
    screenshot_router,
    image_router,
    audio_router,
    file_router,
    video_router,
    ai_probe_router,
    ai_chat_router,
    ai_image_router,
    ai_keys_router,
    translation_queue_router,
    task_center_router,
    assist_router,
)

# Upload Layer (1 router)
from pycore.callmodule.routers.upload import router as upload_router

# Client Layer (1 router)
from pycore.callmodule.routers.client import router as client_router

# Legacy Routers (4 routers)
from pycore.callmodule.routers.mcp_router import mcp_router
from pycore.callmodule.routers.code_sync_router import router as code_sync_router
from pycore.callmodule.routers.module_call_router import module_call_router
from pycore.callmodule.routers.notebooklm_stt_router import router as notebooklm_stt_router


def callmodule_main_entry():
    """
    Callmodule main entry point (called after native_ui initialization)

    Used to register event handlers and perform application-specific initialization.

    Idempotent: This function can be called multiple times safely.
    All operations within are designed to be idempotent.
    """
    ColorPrint.green("[Callmodule] Main entry initialized")

    # Register event handlers (from existing event_handlers.py)
    # Note: Event handlers will be registered via on_ready_callbacks instead

    # Ensure PyHeartbeat system is running (idempotent)
    _ensure_heartbeat_running()

    # Register TTS queue poller callback (idempotent)
    _register_tts_queue_poller()

    # Register translation worker callback (idempotent)
    _register_translation_worker()

    # Register translation queue monitor callback (idempotent)
    _register_queue_monitor()

    # Register translation Reverb WS client callback (idempotent) — Phase C
    _register_translation_ws_client()

    # Wire + (when enabled) start the Assist-Laravel worker (idempotent)
    _register_assist_worker()

    # Register AI rate-budget auto-reset callback (idempotent)
    _register_ai_rate_reset()


def _ensure_heartbeat_running():
    """
    Ensure PyHeartbeat system is running (Idempotent)

    This function checks if PyHeartbeat is running and starts it if needed.
    Can be called multiple times safely - will not restart if already running.
    """
    from pycore.pyheartbeat import get_heartbeat_system

    heartbeat = get_heartbeat_system()

    if not heartbeat.is_running():
        ColorPrint.blue("[Callmodule] Starting PyHeartbeat system...")
        heartbeat.start()
        ColorPrint.green("[Callmodule] PyHeartbeat started")
    else:
        ColorPrint.blue("[Callmodule] PyHeartbeat already running")


def _register_tts_queue_poller():
    """
    Register the TTS queue WORKER callback to PyHeartbeat (Idempotent)

    The worker claims pending word-generation TTS tasks from laravel_main,
    synthesizes MP3s via the pyutils TTS orchestrator and reports validated
    results back. Can be called multiple times safely - will overwrite the
    existing callback with the same name.

    Architecture:
    - Callback name: 'tts_queue_poller'
    - Interval: Config.TTS_WORKER_INTERVAL (60 seconds)
    - Initial state: ENABLED by default (Config.TTS_WORKER_ENABLED_ON_START,
                     env PYCORE_TTS_WORKER=0 to disable)
    - Laravel base URL: resolved by the stored-first LaravelEndpointManager
      (same resolution the media-sync service uses)
    - Control: POST /api/heartbeat/enable|disable/tts_queue_poller
    """
    from pycore.pyheartbeat import get_heartbeat_system
    from pycore.callmodule.services import get_tts_queue_poller_service
    from pycore.callmodule.callmodule_config import Config

    # Get PyHeartbeat system
    heartbeat = get_heartbeat_system()

    # Get TTS worker service singleton (idempotent initialization). No explicit
    # base URL: it resolves via the LaravelEndpointManager per batch.
    poller = get_tts_queue_poller_service()

    # Register callback (idempotent - overwrites if already registered)
    heartbeat.register_callback(
        name='tts_queue_poller',
        callback=poller.poll_and_process,
        interval=Config.TTS_WORKER_INTERVAL,
        enabled=Config.TTS_WORKER_ENABLED_ON_START,
    )

    ColorPrint.green("[Callmodule] Registered TTS queue worker callback")
    ColorPrint.blue("  - Callback name: tts_queue_poller")
    ColorPrint.blue(f"  - Interval: {Config.TTS_WORKER_INTERVAL} seconds")
    ColorPrint.blue(f"  - Initial state: "
                    f"{'enabled' if Config.TTS_WORKER_ENABLED_ON_START else 'disabled'}")
    ColorPrint.blue(f"  - Batch size: {Config.TTS_WORKER_BATCH}")
    ColorPrint.blue("  - Control: POST /api/heartbeat/disable/tts_queue_poller")


def _register_translation_worker():
    """
    Register the translation worker callback to PyHeartbeat (Idempotent).

    Mirrors _register_tts_queue_poller(): a singleton service whose light poll
    callback is registered with PyHeartbeat and toggled via the heartbeat
    management router.

    Architecture:
    - Callback name: 'translation_worker'
    - Interval: Config.TRANSLATION_WORKER_INTERVAL (~12s)
    - Initial state: ENABLED by default (Config.TRANSLATION_WORKER_ENABLED_ON_START)
                     so the Laravel translation pipeline runs out of the box.
    - Laravel base URL: Config.LARAVEL_WORKER_API_URL (env LARAVEL_WORKER_API_URL)
    - Control: POST /api/heartbeat/enable|disable/translation_worker

    The callback only ensures registration, sends a heartbeat, pulls tasks and
    dispatches each to a background TaskManager thread — it never blocks the
    heartbeat loop with translation/network latency.
    """
    from pycore.pyheartbeat import get_heartbeat_system
    from pycore.callmodule.services import get_translation_worker_service
    from pycore.callmodule.callmodule_config import Config
    from pycore.pyctl.assist import translation_worker_enabled_on_start

    heartbeat = get_heartbeat_system()

    worker = get_translation_worker_service(laravel_api_url=Config.LARAVEL_WORKER_API_URL)

    # Master-toggle gate (assist_laravel): while the assist_laravel section is
    # absent from user_data.json the legacy Config default applies unchanged;
    # once it exists, enabled && capabilities.translation rules. Runtime
    # changes are applied live by POST /api/local/assist/config.
    enabled_on_start = translation_worker_enabled_on_start(
        Config.TRANSLATION_WORKER_ENABLED_ON_START)

    heartbeat.register_callback(
        name='translation_worker',
        callback=worker.poll_once,
        interval=Config.TRANSLATION_WORKER_INTERVAL,
        enabled=enabled_on_start,
    )

    ColorPrint.green("[Callmodule] Registered translation worker callback")
    ColorPrint.blue("  - Callback name: translation_worker")
    ColorPrint.blue(f"  - Interval: {Config.TRANSLATION_WORKER_INTERVAL} seconds")
    ColorPrint.blue(f"  - Initial state: {'enabled' if enabled_on_start else 'disabled'} "
                    f"(assist_laravel gate)")
    ColorPrint.blue(f"  - Laravel API: {Config.LARAVEL_WORKER_API_URL}")
    ColorPrint.blue("  - Control: POST /api/heartbeat/disable/translation_worker")


def _register_assist_worker():
    """
    Wire + (when enabled) start the Assist-Laravel worker (Idempotent).

    Registered alongside the translation worker so the assist pipeline starts
    at sys-init. The app-layer wiring injects the LaravelEndpointManager
    resolver (SELECTED endpoint) and pyctl.ai.generate_image into the pyctl
    AssistWorker; the worker's own daemon loop only runs while the persisted
    ``assist_laravel.enabled`` toggle is on (default off).

    Control: GET/POST /api/local/assist/{status,config,cycle}.
    """
    from pycore.callmodule.services.assist_wiring import register_assist_worker_start

    register_assist_worker_start()


def _register_ai_rate_reset():
    """
    Register the AI rate-budget auto-reset callback to PyHeartbeat (Idempotent).

    Demonstrates the heartbeat-as-trigger pattern: pyheartbeat stays generic and
    AI-agnostic; this wiring INJECTS a light tick callback that frees AI rate
    budget by the AI's own rate windows (ai_rate_limits.prune_expired) and clears
    elapsed 429 cooldowns (ai_gateway.clear_expired_cooldowns). The UI reads the
    refreshed rate snapshot, so budgets visibly reset on screen.

    Architecture:
    - Callback name: 'ai_rate_reset'
    - Interval: PYCORE_AI_RATE_RESET_INTERVAL seconds (default 30; the per-minute
      window is 60s, so a 30s prune keeps minute budgets fresh)
    - Initial state: ENABLED (env PYCORE_AI_RATE_RESET=0 to disable)
    - Control: POST /api/heartbeat/enable|disable/ai_rate_reset
    """
    import os
    from pycore.pyheartbeat import get_heartbeat_system
    from pycore.callmodule.services import get_ai_rate_reset_service

    heartbeat = get_heartbeat_system()
    service = get_ai_rate_reset_service()

    interval = 30
    raw = os.environ.get('PYCORE_AI_RATE_RESET_INTERVAL', '').strip()
    if raw.isdigit() and int(raw) > 0:
        interval = int(raw)
    enabled = os.environ.get('PYCORE_AI_RATE_RESET', '1').strip().lower() not in ('0', 'false', 'no')

    heartbeat.register_callback(
        name='ai_rate_reset',
        callback=service.tick,
        interval=interval,
        enabled=enabled,
    )

    ColorPrint.green("[Callmodule] Registered AI rate-budget reset callback")
    ColorPrint.blue("  - Callback name: ai_rate_reset")
    ColorPrint.blue(f"  - Interval: {interval} seconds")
    ColorPrint.blue(f"  - Initial state: {'enabled' if enabled else 'disabled'}")
    ColorPrint.blue("  - Control: POST /api/heartbeat/disable/ai_rate_reset")


def _register_queue_monitor():
    """
    Register the translation QUEUE MONITOR callback to PyHeartbeat (Idempotent).

    Mirrors _register_translation_worker(): a singleton service whose light,
    exception-safe poll callback is registered with PyHeartbeat and toggled via
    the heartbeat management router.

    Architecture:
    - Callback name: 'translation_queue_monitor'
    - Interval: Config.TRANSLATION_QUEUE_MONITOR_INTERVAL (~5s)
    - Initial state: ENABLED by default (Config.TRANSLATION_QUEUE_MONITOR_ENABLED_ON_START)
                     so the UI sees the live queue out of the box.
    - Laravel base URL: SHARED with the worker via Config.LARAVEL_WORKER_API_URL
                        (the monitor reuses the worker's candidate discovery).
    - Control: POST /api/heartbeat/enable|disable/translation_queue_monitor

    The callback GETs the queue list, caches the snapshot, and detects priority
    bumps (flagging tasks `recently_bumped`) — it never blocks the heartbeat loop.
    """
    from pycore.pyheartbeat import get_heartbeat_system
    from pycore.callmodule.services import get_queue_monitor_service
    from pycore.callmodule.callmodule_config import Config

    heartbeat = get_heartbeat_system()

    monitor = get_queue_monitor_service(
        laravel_api_url=Config.LARAVEL_WORKER_API_URL,
        bump_ttl_seconds=Config.TRANSLATION_QUEUE_BUMP_TTL_SECONDS,
    )

    heartbeat.register_callback(
        name='translation_queue_monitor',
        callback=monitor.poll_once,
        interval=Config.TRANSLATION_QUEUE_MONITOR_INTERVAL,
        enabled=Config.TRANSLATION_QUEUE_MONITOR_ENABLED_ON_START,
    )

    ColorPrint.green("[Callmodule] Registered translation queue monitor callback")
    ColorPrint.blue("  - Callback name: translation_queue_monitor")
    ColorPrint.blue(f"  - Interval: {Config.TRANSLATION_QUEUE_MONITOR_INTERVAL} seconds")
    ColorPrint.blue(f"  - Initial state: {'enabled' if Config.TRANSLATION_QUEUE_MONITOR_ENABLED_ON_START else 'disabled'}")
    ColorPrint.blue(f"  - Bump TTL: {Config.TRANSLATION_QUEUE_BUMP_TTL_SECONDS} seconds")
    ColorPrint.blue("  - Control: POST /api/heartbeat/disable/translation_queue_monitor")


def _register_translation_ws_client():
    """
    Register the translation Reverb WS CLIENT supervisor to PyHeartbeat (Idempotent).

    Phase C: a WebSocket client connects to Laravel's Reverb server (Pusher
    protocol) and receives translation-queue events in REAL TIME, replacing the
    queue monitor's 5s HTTP poll as the primary signal (the poll stays as the
    slower fallback/reconciler). The client REUSES rpc_v2's WS library (the
    third-party ``websockets`` package, via get_third_package_websockets()) as the
    CLIENT transport, running its recv loop on a dedicated background thread.

    The heartbeat callback here is ``supervise`` — a LIGHT tick that only ensures
    the background WS thread is alive (it does NO network I/O on the heartbeat
    thread). Disabling the callback stops the supervisor ticking; the thread is
    daemon and also stoppable via the client's stop().

    Architecture:
    - Callback name: 'translation_ws_client'
    - Interval: Config.TRANSLATION_WS_SUPERVISOR_INTERVAL (~5s)
    - Initial state: ENABLED by default (Config.TRANSLATION_WS_ENABLED_ON_START)
    - Reverb conn: Config.TRANSLATION_REVERB_{HOST,PORT,SCHEME,APP_KEY,CHANNEL}
                   (env-overridable; REVERB_* derived). NOTE: REVERB_APP_KEY rotates
                   on reverb restart — keep TRANSLATION_REVERB_APP_KEY in sync.
    - Control: POST /api/heartbeat/enable|disable/translation_ws_client
    """
    from pycore.pyheartbeat import get_heartbeat_system
    from pycore.callmodule.services import get_translation_ws_client
    from pycore.callmodule.callmodule_config import Config

    heartbeat = get_heartbeat_system()

    ws_client = get_translation_ws_client(
        host=Config.TRANSLATION_REVERB_HOST,
        port=Config.TRANSLATION_REVERB_PORT,
        scheme=Config.TRANSLATION_REVERB_SCHEME,
        app_key=Config.TRANSLATION_REVERB_APP_KEY,
        channel=Config.TRANSLATION_REVERB_CHANNEL,
        word_ttl_seconds=Config.TRANSLATION_WS_WORD_TTL_SECONDS,
    )

    heartbeat.register_callback(
        name='translation_ws_client',
        callback=ws_client.supervise,
        interval=Config.TRANSLATION_WS_SUPERVISOR_INTERVAL,
        enabled=Config.TRANSLATION_WS_ENABLED_ON_START,
    )

    ColorPrint.green("[Callmodule] Registered translation Reverb WS client callback")
    ColorPrint.blue("  - Callback name: translation_ws_client")
    ColorPrint.blue(f"  - Interval: {Config.TRANSLATION_WS_SUPERVISOR_INTERVAL} seconds (supervisor tick)")
    ColorPrint.blue(f"  - Initial state: {'enabled' if Config.TRANSLATION_WS_ENABLED_ON_START else 'disabled'}")
    ColorPrint.blue(
        f"  - Reverb: {Config.TRANSLATION_REVERB_SCHEME}://{Config.TRANSLATION_REVERB_HOST}:"
        f"{Config.TRANSLATION_REVERB_PORT} channel={Config.TRANSLATION_REVERB_CHANNEL}"
    )
    ColorPrint.blue("  - WS library: websockets (rpc_v2's WS lib; sync client)")
    ColorPrint.blue("  - Control: POST /api/heartbeat/disable/translation_ws_client")


def start(host='0.0.0.0', port=59000, debug=False):
    """
    Unified startup entry point

    Args:
        host: RPC v2 server host
        port: RPC v2 server port
        debug: Debug mode
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" PYCORE CALLMODULE - Native UI Integrated")
    ColorPrint.blue("=" * 70)

    # Update config with runtime parameters
    Config.RPC_HOST = host
    Config.RPC_PORT = port

    ColorPrint.green("[Callmodule] 20 routers available")

    # Register singleton port range (callmodule_config/config.py)
    # Same as pylauncher so only one instance runs via pycore_module_caller.py or callmodule_main.
    register_port_range(Config.APP_ID, Config.SINGLETON_PORT_START, Config.SINGLETON_PORT_RANGE)
    ColorPrint.blue(f"[Callmodule] Registered singleton port range: {Config.SINGLETON_PORT_START}-{Config.SINGLETON_PORT_START + Config.SINGLETON_PORT_RANGE - 1} (shared with pylauncher)")

    # Singleton: callmodule_main uses launch_native_app which runs SingletonDetector
    # with Config.APP_ID and port range 59100-59199 (see register_port_range below).
    # That matches pylauncher (root pycore_module_caller.py) so only one instance runs
    # regardless of entry (root script vs python -m pycore.callmodule.callmodule_main).
    # Get platform adapter for cross-platform configuration
    adapter = get_platform_adapter()
    adapter.print_platform_info()

    # Resource paths
    resources_dir = Path(__file__).parent / "resources"
    icon_path = resources_dir / "icon.ico"
    logo_path = resources_dir / "logo.png"

    # Fallback icon if not found
    if not icon_path.exists():
        fallback_icon = PROJECT_ROOT / "pycore" / "pyutils" / "native_ui" / "step1_config" / "app_icon.png"
        if fallback_icon.exists():
            icon_path = fallback_icon
            ColorPrint.yellow(f"[Callmodule] Using fallback icon: {icon_path}")

    # Frontend project path
    frontend_app_dir = PROJECT_ROOT / "poly_apps" / "pycore-management"

    # Platform-specific configuration (using adapter)
    IS_WINDOWS = adapter.is_windows
    IS_LINUX = adapter.is_linux
    HAS_X11_DISPLAY = adapter.has_x11  # True if X11 display available (desktop mode)

    # Desktop vs Server mode detection
    # Desktop mode: Has GUI (X11 on Linux, always on Windows)
    # Server mode: No GUI (Linux without X11 display)
    IS_DESKTOP_MODE = adapter.has_gui
    IS_SERVER_MODE = not adapter.has_gui

    ColorPrint.blue(f"[Callmodule] Platform: {adapter.platform.value}")
    ColorPrint.blue(f"[Callmodule] Mode: {'DESKTOP' if IS_DESKTOP_MODE else 'SERVER (Background Only)'}")
    if IS_LINUX:
        ColorPrint.blue(f"[Callmodule] X11 Display: {HAS_X11_DISPLAY}")
        ColorPrint.yellow(f"[Callmodule] Linux: Running in BACKGROUND-ONLY mode (no GUI, no tray)")
    ColorPrint.blue(f"[Callmodule] Frontend: {frontend_app_dir}")
    ColorPrint.blue(f"[Callmodule] Frontend mode: {Config.FRONTEND_MODE}")
    ColorPrint.blue(f"[Callmodule] Show UI window: {IS_WINDOWS and IS_DESKTOP_MODE}")

    # Get platform-specific QtWebEngine flags (handles root/sandbox automatically)
    qtwebengine_flags = adapter.get_qtwebengine_flags(
        enable_webcodecs=True,
        enable_hardware_acceleration=True
    )
    ColorPrint.blue(f"[Callmodule] QtWebEngine flags configured (sandbox: {'disabled' if adapter.needs_sandbox_disable() else 'enabled'})")

    # Create Native UI configuration
    config = NativeUIConfig(
        # ========== Basic Configuration ==========
        app_id=Config.APP_ID,
        app_name=Config.APP_DISPLAY_NAME,
        main_entry=callmodule_main_entry,
        project_root=PROJECT_ROOT,
        debug=debug,

        # ========== Frontend Configuration ==========
        frontend_enabled=True,
        frontend_framework="vite",  # Vite + React project
        frontend_app_dir=frontend_app_dir,
        frontend_mode=Config.FRONTEND_MODE,  # 'production' or 'dev'
        frontend_port=Config.FRONTEND_PORT,
        frontend_auto_install=True,
        frontend_skip_build=Config.FRONTEND_SKIP_BUILD,
        frontend_block_until_ready=(Config.FRONTEND_MODE == "dev"),  # Block in dev mode

        # ========== RPC v2 Configuration ==========
        rpc_enabled=True,
        rpc_port=port,
        rpc_host=host,
        rpc_debug=debug,
        rpc_routers=[
            # === Management Layer (9 routers) ===
            status_router,
            config_router,
            control_router,
            logs_router,
            capabilities_router,
            local_config_router,
            local_stats_router,
            local_test_router,
            heartbeat_router,
            # === Local Processing Layer (5 routers) ===
            screenshot_router,
            image_router,
            audio_router,
            file_router,
            video_router,
            ai_probe_router,         # AI provider probe (/api/local/ai/probe)
            ai_chat_router,          # AI chat confirm (/api/local/ai/chat)
            ai_image_router,         # AI image generation (/api/local/ai/image)
            ai_keys_router,          # AI provider key management (/api/local/ai/keys)
            translation_queue_router,# Translation queue monitor + control (/api/local/translation/queue)
            task_center_router,      # Unified task-center aggregate (/api/local/task-center)
            assist_router,           # Assist-Laravel worker control (/api/local/assist)
            # === Upload Layer (1 router) ===
            upload_router,
            # === Client Layer (1 router) ===
            client_router,
            # === Legacy Routers (4 routers) ===
            mcp_router,
            code_sync_router,
            module_call_router,
            notebooklm_stt_router,
        ],
        rpc_allow_origins=Config.CORS_ALLOW_ORIGINS,
        rpc_auto_mount_frontend=True,  # Auto-coordinate static file mounting

        # ========== UI Configuration (Platform-specific) ==========
        # Windows: Show window (desktop mode)
        # Linux: No window (background/server mode only)
        window_size=(Config.WINDOW_WIDTH, Config.WINDOW_HEIGHT) if IS_DESKTOP_MODE else (1280, 800),
        show_on_start=IS_WINDOWS and IS_DESKTOP_MODE,  # Only show window on Windows
        frameless=Config.FRAMELESS if (IS_WINDOWS and IS_DESKTOP_MODE) else False,
        icon_path=str(icon_path) if icon_path.exists() else None,
        logo_path=str(logo_path) if logo_path.exists() else None,

        # ========== Tray Configuration (Auto-detect based on platform and mode) ==========
        # Windows: Enable tray (desktop mode)
        # Linux: Disable tray (background/server mode only, no GUI)
        # Note: Linux runs in pure backend mode - no tray, no desktop window
        enable_tray=IS_WINDOWS,  # Only enable on Windows
        tray_type="pyside6",  # Use PySide6 backend (Windows only)

        # ========== Debug Window Configuration (from settings.yaml) ==========
        show_debug_window=IS_WINDOWS and IS_DESKTOP_MODE,
        debug_window_width=Config.DEBUG_WINDOW_WIDTH,
        debug_window_height=Config.DEBUG_WINDOW_HEIGHT,
        min_display_time=Config.MIN_DISPLAY_TIME,
        enable_language_selector=Config.ENABLE_LANGUAGE_SELECTOR,

        # ========== Advanced Options ==========
        force=False,
    )

    ColorPrint.green(f"[Callmodule] Configuration created")
    ColorPrint.blue(f"  - Platform: {'Windows' if IS_WINDOWS else 'Linux'}")
    ColorPrint.blue(f"  - Mode: {'DESKTOP' if IS_DESKTOP_MODE else 'SERVER (Background Only)'}")
    ColorPrint.blue(f"  - Frontend mode: {Config.FRONTEND_MODE}")
    ColorPrint.blue(f"  - Frontend port: {Config.FRONTEND_PORT}")
    ColorPrint.blue(f"  - Backend port: {port}")
    ColorPrint.blue(f"  - Backend host: {host}")
    ColorPrint.blue(f"  - Frontend dir: {frontend_app_dir}")
    ColorPrint.blue(f"  - Frontend framework: vite (React)")
    ColorPrint.blue(f"  - Show UI window: {IS_WINDOWS and IS_DESKTOP_MODE}")
    ColorPrint.blue(f"  - Show debug window: {IS_WINDOWS and IS_DESKTOP_MODE}")
    ColorPrint.blue(f"  - Enable tray: {IS_WINDOWS}")
    if IS_WINDOWS:
        native_tray_type = "tk" if adapter.get_recommended_tray_backend().value == "pystray" else "pyside6"
        ColorPrint.blue(f"  - Tray backend: {native_tray_type} (recommended: {adapter.get_recommended_tray_backend().value})")
    ColorPrint.blue(f"  - Total routers: 20")

    # One-click launch (native_ui handles everything)
    ColorPrint.green("[Callmodule] Launching application...")
    launch_native_app(config)

    ColorPrint.green("[Callmodule] Application exited")


def main():
    """Alias for start() with defaults"""
    start()


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description="Pycore Callmodule with Native UI")
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind (default: 0.0.0.0)')
    parser.add_argument('--port', type=int, default=59000, help='Port to bind (default: 59000)')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')

    args = parser.parse_args()
    start(host=args.host, port=args.port, debug=args.debug)
