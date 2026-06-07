# -*- coding: utf-8 -*-
"""
Event Handlers for Pycore Module Caller

Registers THREAD_BUS event handlers for tray actions.
This module only registers event handlers, does not start any threads.
"""

import webbrowser

from pycore import ColorPrint, THREAD_BUS
from pycore.pylauncher import ServiceLauncher
from pycore.callmodule.platform.windows_startup_manager import WindowsStartupManager
from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager


def register_event_handlers(launcher: ServiceLauncher, port: int, singleton_port: int = None):
    """
    Register THREAD_BUS event handlers for tray actions

    Args:
        launcher: ServiceLauncher instance
        port: RPC v2 server port
        singleton_port: Singleton port (included in the pystray fallback menu)
    """
    ColorPrint.blue("[EventHandlers] Registering tray event handlers...")

    # Guard so the pystray fallback is started at most once
    fallback_started = {'value': False}

    def handle_native_tray_unavailable(event_data):
        """Start the pystray tray as a fallback when no native system tray exists."""
        if fallback_started['value']:
            return
        fallback_started['value'] = True
        ColorPrint.yellow("[Tray] Native tray unavailable, starting pystray fallback...")
        try:
            from pycore.callmodule.config import build_tray_service_config
            from pycore.pythreadpool.starters import start_tray
            cfg = build_tray_service_config(port=port, singleton_port=singleton_port)
            start_tray(cfg)
        except Exception as e:
            ColorPrint.red(f"[Tray] Failed to start pystray fallback: {e}")

    def handle_tray_open(event_data):
        """Open web interface in browser"""
        ColorPrint.blue("[Tray] Opening web interface...")
        webbrowser.open(f"http://localhost:{port}/")

    def handle_tray_restart(event_data):
        """
        Trigger restart via THREAD_BUS (built-in method)

        Restart is a built-in method handled by pythreadpool.
        We just need to trigger the event.
        """
        ColorPrint.blue("[Tray] Triggering built-in restart...")
        THREAD_BUS.trigger_event('app.restart', {'reason': 'Tray menu request'})

    def handle_tray_exit(event_data):
        """
        Exit application

        Note: TkinterSystemTray already has trigger_shutdown_on_exit=True,
        so when tray.stop() is called, it will trigger THREAD_BUS shutdown.
        This handler is just for the tray_action_exit signal.
        """
        ColorPrint.yellow("[Tray] Exit requested via tray...")

        # Trigger global shutdown via THREAD_BUS
        if not THREAD_BUS.is_shutdown_requested():
            THREAD_BUS.request_shutdown(reason="Tray exit requested", execute_handlers=True)

    def handle_tray_toggle_startup(event_data):
        """Toggle auto-start on Windows boot"""
        startup_manager = WindowsStartupManager()
        result = startup_manager.toggle()

        if result['success']:
            status = "enabled" if result['enabled'] else "disabled"
            ColorPrint.green(f"[Tray] Auto-start {status}")
        else:
            ColorPrint.red(f"[Tray] Failed: {result['message']}")

    def handle_tray_toggle_voice_subtitle(event_data):
        """Toggle voice subtitle window visibility via THREAD_BUS"""
        ColorPrint.blue("[Tray] Toggling voice subtitle window...")
        THREAD_BUS.trigger_event('voice_subtitle_ui.toggle', {})
        ColorPrint.green("[Tray] Voice subtitle window toggle event sent")

    def handle_tray_toggle_code_sync(event_data):
        """Toggle code sync mode (disabled -> server -> client -> disabled)"""
        ColorPrint.blue("[Tray] Toggling code sync mode...")
        manager = get_code_sync_manager()
        manager.toggle_mode()
        mode = manager.get_mode()
        ColorPrint.green(f"[Tray] Code sync mode: {mode}")

    # Register all event handlers
    THREAD_BUS.register_event_handler('tray_action_open', handle_tray_open)
    THREAD_BUS.register_event_handler('tray_action_restart', handle_tray_restart)
    THREAD_BUS.register_event_handler('tray_action_exit', handle_tray_exit)
    THREAD_BUS.register_event_handler('tray_action_toggle_startup', handle_tray_toggle_startup)
    THREAD_BUS.register_event_handler('tray_action_toggle_voice_subtitle', handle_tray_toggle_voice_subtitle)
    THREAD_BUS.register_event_handler('tray_action_toggle_code_sync', handle_tray_toggle_code_sync)
    # Fallback: only fires when the PySide6 backend is selected but no system tray exists
    THREAD_BUS.register_event_handler('tray.native_unavailable', handle_native_tray_unavailable)

    ColorPrint.green("[EventHandlers] Tray event handlers registered")
