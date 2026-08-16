#!/usr/bin/env python3
# -*- coding: utf-8 -*-
from pycore.pyutils.native_ui.step5_main_ui.pyside6.ui_thread import PySide6UIThread
from pycore.pyutils.native_ui.step5_main_ui.pyside6.config import PySide6UIConfig, StartupWindowConfig
from pycore.pyutils.native_ui.platform_adapter import get_platform_adapter
from pycore.pyutils.native_ui.step6_tray.tkinter_system_tray import TrayMenuItem, PYSTRAY_AVAILABLE
from pycore.pyutils.native_ui.step6_tray.tray_thread import TkinterSystemTrayThread
from pycore.pyutils.native_ui.step6_tray.win32_system_tray import Win32SystemTrayThread, WIN32_AVAILABLE
from pycore.pyutils.native_ui.step6_tray.appindicator_thread import (
    AppIndicatorSystemTrayThread,
    APPINDICATOR_AVAILABLE,
)
from pycore.pyutils.native_ui.step6_tray._types import build_appindicator_menu_items
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

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import SerializedValue
from pycore.pythreadpool.registry import SERVICE_STARTERS, THREAD_REGISTRY
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyfoundations.network_constants import (
    PYCORE_HTTP_PORT,
    HTTP_API_PREFIX,
    HTTP_STATUS_PATH,
)

from pycore.pyheartbeat.heartbeat import initialize_heartbeat_system
from pycore.pyutils.rpc_v2.runner import HttpServerRunner




# ============================================================
# Global Built-in Event Handlers
# ============================================================

_RESTART_HANDLERS_REGISTERED = SerializedValue(
    False,
    "BuiltInHandlerRegistrationStateThread",
)


def _register_builtin_handlers():
    """
    Register built-in event handlers for app.restart, app.close, etc.

    This is called once when the first service is started.
    These are built-in methods that should be handled in pythreadpool,
    not in sub-applications (callmodule).
    """
    if not _RESTART_HANDLERS_REGISTERED.compare_and_set(False, True):
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

        if not THREAD_BUS.is_shutdown_requested():
            ColorPrint.blue("[BuiltInHandlers] Initiating shutdown for restart...")
            THREAD_BUS.request_restart(reason=f"Restart: {reason}", execute_handlers=True)

    # Register restart handler with high priority
    THREAD_BUS.register_event_handler('app.restart', handle_app_restart, priority=1)

    ColorPrint.green("[BuiltInHandlers] Built-in event handlers registered")


# ============================================================
# Heartbeat Service
# ============================================================

def start_heartbeat(config: Dict[str, Any]) -> Any:
    """Start heartbeat service (unified architecture)"""
    # Register built-in handlers on first service start
    _register_builtin_handlers()

    ColorPrint.blue("[heartbeat] Starting Unified Heartbeat System...")

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

    ColorPrint.green("[heartbeat] Unified Heartbeat System started")
    return instance


# ============================================================
# RPC v2 Service
# ============================================================

def start_rpc_v2(config: Dict[str, Any]) -> Any:
    """Start RPC v2 service (original class)"""
    port = config.get('port', PYCORE_HTTP_PORT)
    host = config.get('host', '0.0.0.0')
    debug = config.get('debug', False)

    # Extract router and static mount configurations
    fastapi_routers = config.get('fastapi_routers', [])
    static_mounts = config.get('static_mounts', [])
    init_callback = config.get('init_callback')  # Optional callback to register routes
    enable_http_events = config.get('enable_http_events', True)
    http_keep_alive_timeout = config.get('http_keep_alive_timeout', 120.0)

    ColorPrint.blue(f"[rpc_v2] Starting RPC v2 Server on {host}:{port}...")
    if fastapi_routers:
        ColorPrint.blue(f"[rpc_v2] Will register {len(fastapi_routers)} FastAPI router(s)")
    if static_mounts:
        ColorPrint.blue(f"[rpc_v2] Will mount {len(static_mounts)} static directory(ies)")


    instance = HttpServerRunner(
        host=host,
        port=port,
        debug=debug,
        fastapi_routers=fastapi_routers,
        static_mounts=static_mounts,
        enable_http_events=enable_http_events,
        http_keep_alive_timeout=http_keep_alive_timeout,
    )

    # Register every controller before uvicorn can accept requests.
    if init_callback and callable(init_callback):
        ColorPrint.blue(f"[rpc_v2] Calling initialization callback...")
        init_callback(instance.server)
        ColorPrint.green(f"[rpc_v2] Initialization callback completed")

    instance.start()

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
    ColorPrint.blue(f"[rpc_v2] HTTP controllers: http://{host}:{port}{HTTP_API_PREFIX}/<path>")
    ColorPrint.blue(f"[rpc_v2] HTTP events: {'enabled' if enable_http_events else 'disabled'}")

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
    # PySide6 is loaded inside UI thread after tk bootstrap window is shown (bootstrap order: tk first, then PySide6)


    # Get configuration with defaults
    app_name = config.get('app_name', 'Pycore Application')
    app_id = config.get('app_id', 'pycore_ui')
    app_user_model_id = config.get('app_user_model_id')  # Optional custom AppUserModelID
    window_size = config.get('window_size', (1000, 180))
    # Fallback when no UI URL is configured: load the RPC status route instead
    # of the bare root so the webview never issues anomalous `GET /` calls
    # against the RPC port (the server has no root handler).
    webview_url = config.get(
        'webview_url',
        f'http://localhost:{PYCORE_HTTP_PORT}{HTTP_STATUS_PATH}',
    )
    show_on_start = config.get('show_on_start', True)
    frameless = config.get('frameless', False)
    # When the embedded web draws its own (simulated) title bar, disable the Qt
    # one to avoid stacking duplicate title bars. Defaults True for back-compat.
    enable_title_bar = config.get('enable_title_bar', True)
    icon_path = config.get('icon_path')
    logo_path = config.get('logo_path')
    menu_icon_path = config.get('menu_icon_path')
    enable_tray = config.get('enable_tray', False)
    tray_icon_path = config.get('tray_icon_path')
    tray_menu_items = config.get('tray_menu_items', [])
    minimize_to_tray = config.get('minimize_to_tray', False)
    close_to_tray = config.get('close_to_tray', False)
    enable_webview = config.get('enable_webview', True)
    enable_dev_tools = config.get('enable_dev_tools', False)
    debug = config.get('debug', False)

    # Startup window configuration (tk debug window)
    show_startup = config.get('show_startup', True)
    auto_close_startup = config.get('auto_close_startup', True)
    cache_window_state = config.get('cache_window_state', True)

    ColorPrint.blue("[ui] Configuration parsed:")
    ColorPrint.blue(f"[ui]   - app_name: {app_name}")
    ColorPrint.blue(f"[ui]   - app_id: {app_id}")
    ColorPrint.blue(f"[ui]   - app_user_model_id: {app_user_model_id}")
    ColorPrint.blue(f"[ui]   - window_size: {window_size}")
    ColorPrint.blue(f"[ui]   - webview_url: {webview_url}")
    ColorPrint.blue(f"[ui]   - show_on_start: {show_on_start}")
    ColorPrint.blue(f"[ui]   - frameless: {frameless}")
    ColorPrint.blue(f"[ui]   - enable_title_bar: {enable_title_bar}")
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
        enable_title_bar=enable_title_bar,
        icon_path=icon_path,
        logo_path=logo_path,
        menu_icon_path=menu_icon_path,
        enable_tray=enable_tray,
        tray_icon_path=tray_icon_path,
        tray_menu_items=tray_menu_items,
        minimize_to_tray=minimize_to_tray,
        close_to_tray=close_to_tray,
        enable_webview=enable_webview,
        webview_url=webview_url,
        enable_dev_tools=enable_dev_tools,
        debug=debug,
        cache_window_state=cache_window_state,
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
        if ui_thread.is_alive() and threading.current_thread() is not ui_thread:
            ui_thread.join(timeout=5.0)
            if ui_thread.is_alive():
                ColorPrint.yellow("[ui] PySide6 UI thread did not stop within 5s; continuing shutdown")
            else:
                ColorPrint.green("[ui] PySide6 UI thread stopped")

    priority = THREAD_REGISTRY['ui']['shutdown_priority']
    THREAD_BUS.register_shutdown_handler(
        handler=stop_ui,
        priority=priority,
        name="ui"
    )
    ColorPrint.blue(f"[ui] Registered shutdown handler (priority={priority})")

    # When framework shows tk debug window (show_startup), ensure it closes on singleton/shutdown via THREAD_BUS
    if show_startup:
        def close_debug_window_via_bus():
            ColorPrint.blue("[ui] Shutdown: requesting tk debug window close via THREAD_BUS...")
            THREAD_BUS.trigger_event(BusSignals.STARTUP_REQUEST_CLOSE, {'source': 'shutdown'}, async_mode=False)

        THREAD_BUS.register_shutdown_handler(
            handler=close_debug_window_via_bus,
            priority=-1,
            name="debug_window_close"
        )
        ColorPrint.blue("[ui] Registered shutdown handler (priority=-1) for tk debug window close via THREAD_BUS")

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
    Start system tray service.

    On Ubuntu/GNOME desktop uses AppIndicator when available; otherwise pystray.
    Linux without X11 has no tray; Windows/macOS use pystray or Qt tray per config.

    Args:
        config: Tray configuration
            - app_name: str - Application name
            - icon_path: str - Path to tray icon
            - menu_items: List[TrayMenuItem] or list of dicts - Menu items
            - trigger_shutdown_on_exit: bool - Trigger global shutdown on exit (default: True)

    Returns:
        Tray thread instance (AppIndicatorSystemTrayThread or TkinterSystemTrayThread) or None if unavailable
    """
    ColorPrint.blue("[tray] Starting System Tray...")



    # Get configuration
    app_name = config.get('app_name', 'Application')
    icon_path = config.get('icon_path')
    menu_items = config.get('menu_items', [])
    trigger_shutdown = config.get('trigger_shutdown_on_exit', True)
    # Backend preference: "native" (platform-native: win32 on Windows,
    # AppIndicator on Ubuntu/GNOME), or "pystray" to force the cross-platform
    # third-party fallback. ("pyside" is handled by the UI framework, not here.)
    backend = (config.get('backend') or 'native').lower()
    adapter = get_platform_adapter()

    def _register_stop_handler(label: str):
        def stop_tray():
            ColorPrint.blue(f"[tray] Stopping System Tray ({label})...")
            THREAD_BUS.trigger_event('tray.request_stop', {})
            ColorPrint.green("[tray] System Tray stop signal sent")
        priority = THREAD_REGISTRY['tray']['shutdown_priority']
        THREAD_BUS.register_shutdown_handler(handler=stop_tray, priority=priority, name="tray")

    # ---- Windows native: Win32 Shell_NotifyIcon (pywin32, no third-party) ----
    if backend != 'pystray' and adapter.is_windows and WIN32_AVAILABLE:
        try:
            tray_thread = Win32SystemTrayThread(
                app_name=app_name,
                icon_path=icon_path,
                menu_items=menu_items,
                trigger_shutdown_on_exit=trigger_shutdown,
                daemon=True,
            )
            tray_thread.start()
            _register_stop_handler("Win32")
            ColorPrint.green(f"[tray] System Tray started (native Win32): {app_name}")
            return tray_thread
        except Exception as e:
            ColorPrint.yellow(f"[tray] Win32 native tray failed ({e}), falling back to pystray")

    # ---- Ubuntu/GNOME native: AppIndicator (Ayatana preferred) ----
    if backend != 'pystray' and adapter.is_linux and adapter.can_use_tray():
        try:
            if APPINDICATOR_AVAILABLE:
                appindicator_items = build_appindicator_menu_items(menu_items)
                app_id = config.get('app_id') or (app_name.lower().replace(' ', '_') + "-tray")
                tray_thread = AppIndicatorSystemTrayThread(
                    app_id=app_id,
                    app_name=app_name,
                    icon_path=icon_path,
                    menu_items=appindicator_items,
                    trigger_shutdown_on_exit=trigger_shutdown,
                    daemon=True
                )
                tray_thread.start()
                _register_stop_handler("AppIndicator")
                ColorPrint.green(f"[tray] System Tray started (native AppIndicator): {app_name}")
                return tray_thread
        except Exception as e:
            ColorPrint.yellow(f"[tray] AppIndicator unavailable ({e}), falling back to pystray")

    # ---- Fallback: pystray (cross-platform third-party) ----
    if not PYSTRAY_AVAILABLE:
        ColorPrint.red("[tray] pystray not available, tray service disabled")
        return None

    tray_thread = TkinterSystemTrayThread(
        app_name=app_name,
        icon_path=icon_path,
        menu_items=menu_items,
        trigger_shutdown_on_exit=trigger_shutdown,
        daemon=True
    )
    tray_thread.start()
    _register_stop_handler("pystray")
    ColorPrint.green(f"[tray] System Tray started (pystray fallback): {app_name}")
    return tray_thread


# ============================================================
# Auto-register all starters
# ============================================================

SERVICE_STARTERS['heartbeat'] = start_heartbeat
SERVICE_STARTERS['rpc_v2'] = start_rpc_v2
SERVICE_STARTERS['ui'] = start_ui
SERVICE_STARTERS['tray'] = start_tray
