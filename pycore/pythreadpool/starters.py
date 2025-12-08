#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Service Starter Functions

All service starter functions are defined here.
Each starter function:
1. Creates service instance from original class
2. Starts the service
3. Registers shutdown handler in THREAD_BUS
4. Returns service instance
"""

import os
import sys
import time
import threading
import traceback
from typing import Dict, Any, Optional

from pycore import ColorPrint, THREAD_BUS
from .registry import SERVICE_STARTERS, THREAD_REGISTRY
from pycore.pyutils.native_ui.step6_tray.tkinter_system_tray import (
    TrayMenuItem,
    PYSTRAY_AVAILABLE
)
from pycore.pyutils.native_ui.step6_tray.tray_thread import TkinterSystemTrayThread


# ============================================================
# Global Built-in Event Handlers
# ============================================================

_restart_handlers_registered = False


def _register_builtin_handlers():
    """
    Register built-in event handlers for app.restart, app.close, etc.

    This is called once when the first service is started.
    These are built-in methods that should be handled in pythreadpool,
    not in sub-applications (callmodule).
    """
    global _restart_handlers_registered
    if _restart_handlers_registered:
        return

    ColorPrint.blue("[BuiltInHandlers] Registering built-in event handlers...")

    def handle_app_restart(event_data):
        """
        Handle app.restart event (built-in method)

        This triggers a full shutdown followed by process restart.
        Restart happens in the main thread after shutdown completes.
        """
        reason = event_data.get('reason', 'Restart requested')
        ColorPrint.yellow(f"[BuiltInHandlers] Restart requested: {reason}")

        # Mark that we want to restart after shutdown
        THREAD_BUS._restart_requested = True

        # Trigger shutdown (this will execute all shutdown handlers)
        if not THREAD_BUS.is_shutdown_requested():
            ColorPrint.blue("[BuiltInHandlers] Initiating shutdown for restart...")
            THREAD_BUS.request_shutdown(reason=f"Restart: {reason}", execute_handlers=True)

    # Register restart handler with high priority
    THREAD_BUS.register_event_handler('app.restart', handle_app_restart, priority=1)

    _restart_handlers_registered = True
    ColorPrint.green("[BuiltInHandlers] Built-in event handlers registered")


# ============================================================
# Heartbeat Service
# ============================================================

def start_heartbeat(config: Dict[str, Any]) -> Any:
    """Start heartbeat service (original class)"""
    # Register built-in handlers on first service start
    _register_builtin_handlers()

    ColorPrint.blue("[heartbeat] Starting Heartbeat System...")
    from pycore.pyheartbeat import initialize_heartbeat_system

    instance = initialize_heartbeat_system()
    instance.start()

    # Register shutdown handler
    def stop_heartbeat():
        ColorPrint.blue("[heartbeat] Stopping Heartbeat System...")
        if hasattr(instance, 'stop'):
            instance.stop()
        ColorPrint.green("[heartbeat] Heartbeat System stopped")

    priority = THREAD_REGISTRY['heartbeat']['shutdown_priority']
    THREAD_BUS.register_shutdown_handler(
        handler=stop_heartbeat,
        priority=priority,
        name="heartbeat"
    )

    ColorPrint.green("[heartbeat] Heartbeat System started")
    return instance


# ============================================================
# RPC v2 Service
# ============================================================

def start_rpc_v2(config: Dict[str, Any]) -> Any:
    """Start RPC v2 service (original class)"""
    port = config.get('port', 58100)
    host = config.get('host', '0.0.0.0')
    debug = config.get('debug', False)

    # Extract router and static mount configurations
    fastapi_routers = config.get('fastapi_routers', [])
    static_mounts = config.get('static_mounts', [])
    init_callback = config.get('init_callback')  # Optional callback to register routes

    ColorPrint.blue(f"[rpc_v2] Starting RPC v2 Server on {host}:{port}...")
    if fastapi_routers:
        ColorPrint.blue(f"[rpc_v2] Will register {len(fastapi_routers)} FastAPI router(s)")
    if static_mounts:
        ColorPrint.blue(f"[rpc_v2] Will mount {len(static_mounts)} static directory(ies)")

    from pycore.pyutils.rpc_v2 import FastAPIRPCServerRunner

    instance = FastAPIRPCServerRunner(
        host=host,
        port=port,
        debug=debug,
        fastapi_routers=fastapi_routers,
        static_mounts=static_mounts
    )
    instance.start()

    # Call init callback if provided (for registering RPC v2 routes)
    if init_callback and callable(init_callback):
        ColorPrint.blue(f"[rpc_v2] Calling initialization callback...")
        init_callback(instance.server)
        ColorPrint.green(f"[rpc_v2] Initialization callback completed")

    # Register shutdown handler
    def stop_rpc_v2():
        ColorPrint.blue("[rpc_v2] Stopping RPC v2 Server...")
        if hasattr(instance, 'stop'):
            instance.stop()
        ColorPrint.green("[rpc_v2] RPC v2 Server stopped")

    priority = THREAD_REGISTRY['rpc_v2']['shutdown_priority']
    THREAD_BUS.register_shutdown_handler(
        handler=stop_rpc_v2,
        priority=priority,
        name="rpc_v2"
    )

    ColorPrint.green(f"[rpc_v2] RPC v2 Server started on {host}:{port}")
    ColorPrint.blue(f"[rpc_v2] HTTP: http://{host}:{port}/rpc/<route>")
    ColorPrint.blue(f"[rpc_v2] WebSocket: ws://{host}:{port}/rpc/ws")

    return instance


# ============================================================
# Speech Service
# ============================================================

def start_speech(config: Dict[str, Any]) -> Any:
    """Start speech service (original class)"""
    mode = config.get('mode', 'single')
    mic_language = config.get('mic_language', 'zh-CN')
    system_language = config.get('system_language', 'en-US')
    daemon = config.get('daemon', True)

    ColorPrint.blue(f"[speech] Starting Speech Service (mode: {mode})...")
    from pycore.pyctl.speech.speech_thread import SpeechTranscriptionThread

    instance = SpeechTranscriptionThread(
        mode=mode,
        mic_language=mic_language,
        system_language=system_language,
        daemon=daemon
    )
    instance.start()

    # Register shutdown handler
    def stop_speech():
        ColorPrint.blue("[speech] Stopping Speech Service...")
        if hasattr(instance, 'stop'):
            instance.stop()
        ColorPrint.green("[speech] Speech Service stopped")

    priority = THREAD_REGISTRY['speech']['shutdown_priority']
    THREAD_BUS.register_shutdown_handler(
        handler=stop_speech,
        priority=priority,
        name="speech"
    )

    ColorPrint.green(f"[speech] Speech Service started (mode: {mode})")
    return instance


# ============================================================
# UI Service
# ============================================================

def start_ui(config: Dict[str, Any]) -> Any:
    """
    Start UI service using PySide6 framework

    Args:
        config: UI configuration
            - app_name: str - Application name
            - app_id: str - Unique app identifier
            - window_size: tuple - Window size (width, height)
            - webview_url: str - URL to load in webview
            - show_on_start: bool - Show window on start (default: True)
            - frameless: bool - Frameless window (default: False)
            - enable_tray: bool - Enable system tray (default: False)
            - enable_webview: bool - Enable webview (default: True)
            - enable_dev_tools: bool - Enable dev tools (default: False)
            - debug: bool - Debug mode (default: False)

    Returns:
        PySide6Framework instance
    """
    ColorPrint.blue("[ui] ========== STARTING PYSIDE6 UI SERVICE ==========")
    ColorPrint.blue(f"[ui] Received config keys: {list(config.keys())}")

    # Ensure PySide6 is installed
    from pycore.pyfoundations.third_party import get_third_package_pyside6
    ColorPrint.blue("[ui] Checking PySide6 installation...")
    get_third_package_pyside6()
    ColorPrint.green("[ui] PySide6 is available")

    from pycore.pyutils.native_ui.step5_main_ui.pyside6 import (
        PySide6UIThread,
        PySide6UIConfig,
        StartupWindowConfig
    )

    # Get configuration with defaults
    app_name = config.get('app_name', 'Pycore Application')
    app_id = config.get('app_id', 'pycore_ui')
    app_user_model_id = config.get('app_user_model_id')  # Optional custom AppUserModelID
    window_size = config.get('window_size', (1000, 180))
    webview_url = config.get('webview_url', 'http://localhost:59000')
    show_on_start = config.get('show_on_start', True)
    frameless = config.get('frameless', False)
    icon_path = config.get('icon_path')
    logo_path = config.get('logo_path')
    menu_icon_path = config.get('menu_icon_path')
    enable_tray = config.get('enable_tray', False)
    enable_webview = config.get('enable_webview', True)
    enable_dev_tools = config.get('enable_dev_tools', False)
    debug = config.get('debug', False)

    # Startup window configuration (tk debug window)
    show_startup = config.get('show_startup', True)
    auto_close_startup = config.get('auto_close_startup', True)

    ColorPrint.blue("[ui] Configuration parsed:")
    ColorPrint.blue(f"[ui]   - app_name: {app_name}")
    ColorPrint.blue(f"[ui]   - app_id: {app_id}")
    ColorPrint.blue(f"[ui]   - app_user_model_id: {app_user_model_id}")
    ColorPrint.blue(f"[ui]   - window_size: {window_size}")
    ColorPrint.blue(f"[ui]   - webview_url: {webview_url}")
    ColorPrint.blue(f"[ui]   - show_on_start: {show_on_start}")
    ColorPrint.blue(f"[ui]   - frameless: {frameless}")
    ColorPrint.blue(f"[ui]   - icon_path: {icon_path}")
    ColorPrint.blue(f"[ui]   - logo_path: {logo_path}")
    ColorPrint.blue(f"[ui]   - menu_icon_path: {menu_icon_path}")
    ColorPrint.blue(f"[ui]   - enable_tray: {enable_tray}")
    ColorPrint.blue(f"[ui]   - enable_webview: {enable_webview}")
    ColorPrint.blue(f"[ui]   - enable_dev_tools: {enable_dev_tools}")
    ColorPrint.blue(f"[ui]   - debug: {debug}")
    ColorPrint.blue(f"[ui]   - show_startup: {show_startup}")
    ColorPrint.blue(f"[ui]   - auto_close_startup: {auto_close_startup}")

    # Create PySide6 UI config
    ColorPrint.blue("[ui] Creating PySide6UIConfig...")
    ui_config = PySide6UIConfig(
        app_name=app_name,
        app_id=app_id,
        app_user_model_id=app_user_model_id,
        window_size=window_size,
        show_on_start=show_on_start,
        frameless=frameless,
        icon_path=icon_path,
        logo_path=logo_path,
        menu_icon_path=menu_icon_path,
        enable_tray=enable_tray,
        enable_webview=enable_webview,
        webview_url=webview_url,
        enable_dev_tools=enable_dev_tools,
        debug=debug
    )
    ColorPrint.green("[ui] PySide6UIConfig created")

    # Create startup window config (tk debug window)
    ColorPrint.blue("[ui] Creating StartupWindowConfig...")
    startup_config = StartupWindowConfig(
        app_name=app_name,
        icon_path=icon_path,
        show_startup=show_startup,
        auto_close=auto_close_startup,
        daemon=True
    )
    ColorPrint.green(f"[ui] StartupWindowConfig created (show={show_startup}, auto_close={auto_close_startup})")

    # Create and start UI thread (inherits from threading.Thread)
    ColorPrint.blue("[ui] Creating PySide6UIThread...")
    ui_thread = PySide6UIThread(
        ui_config=ui_config,
        startup_config=startup_config,
        daemon=True
    )
    ColorPrint.green("[ui] PySide6UIThread created, starting thread...")
    ui_thread.start()
    ColorPrint.green("[ui] PySide6UIThread.start() called (thread is now running)")

    # Register shutdown handler (use THREAD_BUS event)
    def stop_ui():
        ColorPrint.blue("[ui] Stopping PySide6 UI...")
        # Use app_id for event namespace (framework listens to {app_id}.close)
        app_id = ui_config.app_id or ui_config.app_name.lower().replace(' ', '_')
        THREAD_BUS.trigger_event(f'{app_id}.close', {})
        ColorPrint.green(f"[ui] PySide6 UI stop signal sent ({app_id}.close)")

    priority = THREAD_REGISTRY['ui']['shutdown_priority']
    THREAD_BUS.register_shutdown_handler(
        handler=stop_ui,
        priority=priority,
        name="ui"
    )
    ColorPrint.blue(f"[ui] Registered shutdown handler (priority={priority})")

    ColorPrint.green(f"[ui] ========== PYSIDE6 UI SERVICE STARTED ==========")
    ColorPrint.green(f"[ui] App: {app_name}")
    ColorPrint.green(f"[ui] WebView URL: {webview_url}")
    ColorPrint.yellow(f"[ui] Window will {'show automatically' if show_on_start else 'NOT show automatically (use tray to toggle)'}")
    return ui_thread


# ============================================================
# System Tray Service
# ============================================================

def start_tray(config: Dict[str, Any]) -> Any:
    """
    Start system tray service

    Args:
        config: Tray configuration
            - app_name: str - Application name
            - icon_path: str - Path to tray icon
            - menu_items: List[TrayMenuItem] - Menu items
            - trigger_shutdown_on_exit: bool - Trigger global shutdown on exit (default: True)

    Returns:
        TkinterSystemTrayThread instance or None if unavailable
    """
    ColorPrint.blue("[tray] Starting System Tray...")

    # Check if pystray is available
    if not PYSTRAY_AVAILABLE:
        ColorPrint.red("[tray] pystray not available, tray service disabled")
        return None

    # Get configuration
    app_name = config.get('app_name', 'Application')
    icon_path = config.get('icon_path')
    menu_items = config.get('menu_items', [])
    trigger_shutdown = config.get('trigger_shutdown_on_exit', True)

    # Create and start tray thread (inherits from threading.Thread)
    tray_thread = TkinterSystemTrayThread(
        app_name=app_name,
        icon_path=icon_path,
        menu_items=menu_items,
        trigger_shutdown_on_exit=trigger_shutdown,
        daemon=True
    )
    tray_thread.start()

    # Register shutdown handler (use THREAD_BUS event)
    def stop_tray():
        ColorPrint.blue("[tray] Stopping System Tray...")
        THREAD_BUS.trigger_event('tray.request_stop', {})
        ColorPrint.green("[tray] System Tray stop signal sent")

    priority = THREAD_REGISTRY['tray']['shutdown_priority']
    THREAD_BUS.register_shutdown_handler(
        handler=stop_tray,
        priority=priority,
        name="tray"
    )

    ColorPrint.green(f"[tray] System Tray started: {app_name}")
    return tray_thread


# ============================================================
# Auto-register all starters
# ============================================================

SERVICE_STARTERS['heartbeat'] = start_heartbeat
SERVICE_STARTERS['rpc_v2'] = start_rpc_v2
SERVICE_STARTERS['speech'] = start_speech
SERVICE_STARTERS['ui'] = start_ui
SERVICE_STARTERS['tray'] = start_tray
