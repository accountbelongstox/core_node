# -*- coding: utf-8 -*-
"""
Windows Tray Mode Launcher

Runs RPC v2 server with system tray icon and singleton detection.
"""

import sys
import webbrowser
from pathlib import Path

from pycore import ColorPrint, THREAD_BUS
from .server_setup import start_rpc_server_background

try:
    from pycore.pyutils.native_ui.step6_tray.tkinter_system_tray import (
        TkinterSystemTray,
        TrayMenuItem,
        PYSTRAY_AVAILABLE
    )
    from .windows_startup_manager import WindowsStartupManager
except ImportError:
    PYSTRAY_AVAILABLE = False
    WindowsStartupManager = None


def launch_windows_tray(host='0.0.0.0', port=59000, debug=False, launcher=None, singleton_port=None):
    """
    Launch RPC v2 server with Windows system tray.

    IMPORTANT: This function does NOT perform singleton detection.
    Singleton detection is handled by ServiceLauncher in launch_platform_aware().

    Features:
    - System tray icon with menu
    - Background RPC v2 server
    - Web interface access from tray
    - Voice subtitle UI auto-starts when enabled

    Args:
        host: Host to bind to
        port: Port to bind to
        debug: Enable debug mode
        launcher: ServiceLauncher instance (for singleton detector and lifecycle management)
        singleton_port: Singleton port (passed from launcher)
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("Pycore Module Caller - Windows Tray Mode (RPC v2)")
    ColorPrint.blue("=" * 70)

    if not PYSTRAY_AVAILABLE:
        ColorPrint.red("[ERROR] pystray library not available!")
        ColorPrint.yellow("[Fallback] Running in console mode...")
        from .linux_service import launch_linux_service
        launch_linux_service(host, port, debug, launcher, singleton_port)
        return

    PYCORE_ROOT = Path(__file__).parent.parent.parent

    # Start RPC v2 server in background
    ColorPrint.blue(f"[Windows] Starting RPC v2 server on {host}:{port}...")
    start_rpc_server_background(host=host, port=port, debug=debug)

    # Tray instance holder (will be set after creation)
    tray_instance = None

    # Startup manager
    startup_manager = WindowsStartupManager() if WindowsStartupManager else None

    def handle_tray_open(event_data):
        """Open web interface in browser"""
        ColorPrint.blue("[Tray] Opening web interface...")
        webbrowser.open(f"http://localhost:{port}/")

    def handle_tray_restart(event_data):
        """Restart application"""
        ColorPrint.yellow("[Tray] Restarting application...")
        if launcher:
            launcher.stop()
        if tray_instance:
            tray_instance.stop()  # Stop tray before restart
        ColorPrint.blue("[Tray] Restarting process...")

        # Restart current process
        import os
        python = sys.executable
        os.execv(python, [python] + sys.argv)

    def handle_tray_exit(event_data):
        """Exit application"""
        ColorPrint.yellow("[Tray] Shutting down...")
        if launcher:
            launcher.stop()
        if tray_instance:
            tray_instance.stop()  # Stop tray gracefully
        ColorPrint.blue("[Tray] Shutdown complete")

    def handle_tray_toggle_startup(event_data):
        """Toggle auto-start on Windows boot"""
        if not startup_manager:
            ColorPrint.red("[Tray] Startup manager not available")
            return

        ColorPrint.blue("[Tray] Toggling auto-start...")
        result = startup_manager.toggle()

        if result['success']:
            status = "enabled" if result['enabled'] else "disabled"
            ColorPrint.green(f"[Tray] Auto-start {status}")
            ColorPrint.blue(f"[Tray] {result['message']}")

            # Update menu to reflect new state
            update_tray_menu()
        else:
            ColorPrint.red(f"[Tray] Failed: {result['message']}")

    def handle_tray_toggle_voice_subtitle(event_data):
        """Toggle voice subtitle window visibility via THREAD_BUS"""
        ColorPrint.blue("[Tray] Toggling voice subtitle window...")

        # Send THREAD_BUS event to toggle window
        THREAD_BUS.trigger_event('voice_subtitle_ui.toggle', {})

        # Update menu to reflect new state (async, so we just update text)
        update_tray_menu()

        ColorPrint.green("[Tray] Voice subtitle window toggle event sent")

    def handle_tray_toggle_code_sync(event_data):
        """Toggle code sync mode (disabled -> server -> client -> disabled)"""
        ColorPrint.blue("[Tray] Toggling code sync mode...")

        try:
            from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager

            manager = get_code_sync_manager()
            manager.toggle_mode()

            mode = manager.get_mode()
            ColorPrint.green(f"[Tray] Code sync mode: {mode}")

            # Update menu
            update_tray_menu()

        except Exception as e:
            ColorPrint.red(f"[Tray] Error toggling code sync: {e}")

    def update_tray_menu():
        """Update tray menu with current startup state"""
        if not tray_instance or not startup_manager:
            return

        startup_enabled = startup_manager.is_enabled()
        startup_text = "✓ Auto-Start on Boot" if startup_enabled else "Auto-Start on Boot"

        # Get code sync mode
        code_sync_text = "Code Sync: Disabled"
        try:
            from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager
            manager = get_code_sync_manager()
            mode = manager.get_mode()

            if mode == "server":
                code_sync_text = "✓ Code Sync: Server"
            elif mode == "client":
                code_sync_text = "✓ Code Sync: Client"
            else:
                code_sync_text = "Code Sync: Disabled"
        except Exception:
            pass

        menu_items = [
            TrayMenuItem(
                text="Open Web Interface",
                action_signal="tray_action_open",
                default=True
            ),
            TrayMenuItem.SEPARATOR,
            TrayMenuItem(
                text=f"RPC v2 Server: {port}",
                action_signal="",
                enabled=False
            ),
        ]

        # Add singleton port info if available
        if singleton_port is not None:
            menu_items.append(
                TrayMenuItem(
                    text=f"Singleton Port: {singleton_port}",
                    action_signal="",
                    enabled=False
                )
            )

        menu_items.extend([
            TrayMenuItem.SEPARATOR,
            TrayMenuItem(
                text=code_sync_text,
                action_signal="tray_action_toggle_code_sync"
            ),
            TrayMenuItem(
                text="Toggle Voice Subtitle Window",
                action_signal="tray_action_toggle_voice_subtitle"
            ),
            TrayMenuItem(
                text=startup_text,
                action_signal="tray_action_toggle_startup"
            ),
            TrayMenuItem.SEPARATOR,
            TrayMenuItem(
                text="Restart",
                action_signal="tray_action_restart"
            ),
            TrayMenuItem(
                text="Exit",
                action_signal="tray_action_exit"
            )
        ])

        tray_instance.update_menu(menu_items)
        ColorPrint.blue(f"[Tray] Menu updated (Auto-start: {startup_enabled})")

    # Register event handlers
    THREAD_BUS.register_event_handler('tray_action_open', handle_tray_open)
    THREAD_BUS.register_event_handler('tray_action_restart', handle_tray_restart)
    THREAD_BUS.register_event_handler('tray_action_exit', handle_tray_exit)
    THREAD_BUS.register_event_handler('tray_action_toggle_startup', handle_tray_toggle_startup)
    THREAD_BUS.register_event_handler('tray_action_toggle_voice_subtitle', handle_tray_toggle_voice_subtitle)
    THREAD_BUS.register_event_handler('tray_action_toggle_code_sync', handle_tray_toggle_code_sync)

    icon_path = PYCORE_ROOT / "pyutils" / "native_ui" / "step1_config" / "app_icon.png"
    if not icon_path.exists():
        icon_path = None

    # Build initial menu with startup state
    startup_enabled = startup_manager.is_enabled() if startup_manager else False
    startup_text = "✓ Auto-Start on Boot" if startup_enabled else "Auto-Start on Boot"

    # Get code sync mode
    code_sync_text = "Code Sync: Disabled"
    try:
        from pycore.pyutils.device_sync.code_sync_manager import get_code_sync_manager
        manager = get_code_sync_manager()
        mode = manager.get_mode()

        if mode == "server":
            code_sync_text = "✓ Code Sync: Server"
        elif mode == "client":
            code_sync_text = "✓ Code Sync: Client"
        else:
            code_sync_text = "Code Sync: Disabled"
    except Exception:
        pass

    menu_items = [
        TrayMenuItem(
            text="Open Web Interface",
            action_signal="tray_action_open",
            default=True
        ),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text=f"RPC v2 Server: {port}",
            action_signal="",
            enabled=False
        ),
    ]

    # Add singleton port info if available
    if singleton_port is not None:
        menu_items.append(
            TrayMenuItem(
                text=f"Singleton Port: {singleton_port}",
                action_signal="",
                enabled=False
            )
        )

    menu_items.extend([
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text="Toggle Voice Subtitle Window",
            action_signal="tray_action_toggle_voice_subtitle"
        ),
        TrayMenuItem(
            text=startup_text,
            action_signal="tray_action_toggle_startup"
        ),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text="Restart",
            action_signal="tray_action_restart"
        ),
        TrayMenuItem(
            text="Exit",
            action_signal="tray_action_exit"
        )
    ])

    ColorPrint.green("=" * 70)
    ColorPrint.green("[Windows] System tray ready")
    ColorPrint.green(f"[Windows] RPC v2: http://localhost:{port}/")
    if singleton_port is not None:
        ColorPrint.green(f"[Windows] Singleton: {singleton_port}")
    ColorPrint.green("=" * 70)

    tray = TkinterSystemTray(
        app_name="Pycore RPC Server",
        icon_path=str(icon_path) if icon_path else None,
        menu_items=menu_items
    )

    # Set tray instance for exit handler
    tray_instance = tray

    # Register tray shutdown handler to THREAD_BUS
    def shutdown_tray_handler(event_data=None):
        """Shutdown tray (registered with THREAD_BUS)"""
        ColorPrint.yellow("[Windows] Shutting down system tray...")
        if tray_instance:
            tray_instance.stop()
        ColorPrint.green("[Windows] System tray shutdown signal sent")

    THREAD_BUS.register_shutdown_handler(shutdown_tray_handler, priority=80, name='system_tray')
    ColorPrint.blue("[Windows] System tray shutdown handler registered")

    try:
        tray.run()
    except KeyboardInterrupt:
        ColorPrint.yellow("\n[Windows] Keyboard interrupt...")
    finally:
        if launcher:
            launcher.stop()
        ColorPrint.blue("[Windows] Shutdown complete")
