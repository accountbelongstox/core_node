# -*- coding: utf-8 -*-
"""
Windows Tray Mode Launcher

Runs RPC v2 server with system tray icon and singleton detection.
"""

import sys
import threading
from pathlib import Path


def launch_windows_tray(host='0.0.0.0', port=59000, debug=False, launcher=None, singleton_port=None):
    """
    Launch RPC v2 server with Windows system tray.

    IMPORTANT: This function does NOT perform singleton detection.
    Singleton detection is handled by ServiceLauncher in launch_platform_aware().

    Features:
    - System tray icon with menu
    - Background RPC v2 server
    - Web interface access from tray

    Args:
        host: Host to bind to
        port: Port to bind to
        debug: Enable debug mode
        launcher: ServiceLauncher instance (for singleton detector and lifecycle management)
        singleton_port: Singleton port (passed from launcher)
    """
    from pycore import ColorPrint, THREAD_BUS
    from pycore.pyfoundations.third_party import get_third_package_uvicorn
    from pycore.pyutils.rpc_v2.server.fastapi_server import FastAPIRPCServer
    from pycore.pyutils.rpc_v2.modules import register_module_routes, register_homepage_routes

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
    server_running = threading.Event()
    uvicorn_server = None  # Hold uvicorn server instance for shutdown

    def start_rpc_server():
        """Start RPC v2 server in background thread"""
        nonlocal uvicorn_server

        ColorPrint.blue(f"[Windows] Starting RPC v2 server on {host}:{port}...")

        # Create RPC v2 server
        server = FastAPIRPCServer(options={
            "host": host,
            "port": port,
            "debug": debug
        })

        # Register module routes (auto-register all modules from registry)
        ColorPrint.blue("[Windows] Registering module routes...")
        register_module_routes(server, debug=debug)

        # Register homepage routes
        ColorPrint.blue("[Windows] Registering homepage routes...")
        register_homepage_routes(server.app)

        # Register MCP routes (unified backend)
        ColorPrint.blue("[Windows] Registering MCP backend routes...")
        from pycore.callmodule.routers.mcp_router import mcp_router
        server.app.include_router(mcp_router)
        ColorPrint.green("[Windows] MCP backend routes registered at /mcp/*")

        # Register singleton control routes
        ColorPrint.blue("[Windows] Registering singleton control routes...")
        from pycore.callmodule.routers.singleton_router import singleton_router
        server.app.include_router(singleton_router)
        ColorPrint.green("[Windows] Singleton control routes registered at /singleton/*")

        uvicorn = get_third_package_uvicorn()

        def run_uvicorn():
            nonlocal uvicorn_server

            # Create uvicorn Server instance (for shutdown control)
            config = uvicorn.Config(
                server.app,
                host=host,
                port=port,
                log_level="debug" if debug else "info"
            )
            uvicorn_server = uvicorn.Server(config)

            server_running.set()
            ColorPrint.green(f"[Windows] RPC v2 started: http://{host}:{port}")
            ColorPrint.blue(f"[Windows] Homepage: http://{host}:{port}/")
            ColorPrint.blue(f"[Windows] RPC: POST http://{host}:{port}/rpc/{{route}}")

            # Run server (blocking)
            try:
                uvicorn_server.run()
            except Exception:
                # Suppress expected errors during shutdown (CancelledError, etc.)
                pass

        server_thread = threading.Thread(
            target=run_uvicorn,
            daemon=True,
            name="RPC-v2-Server"
        )
        server_thread.start()
        server_running.wait(timeout=5)

        # Register shutdown handler AFTER server is created
        def shutdown_handler(event_data=None):
            """Shutdown RPC v2 server (registered with THREAD_BUS)"""
            nonlocal uvicorn_server
            if uvicorn_server:
                ColorPrint.yellow("[Windows] Shutting down RPC v2 server...")
                uvicorn_server.should_exit = True
                # Force shutdown
                if hasattr(uvicorn_server, 'force_exit'):
                    uvicorn_server.force_exit = True
                ColorPrint.green("[Windows] RPC v2 server shutdown signal sent")

        THREAD_BUS.register_shutdown_handler(shutdown_handler, priority=90, name='rpc_v2_server')
        ColorPrint.blue("[Windows] RPC v2 server shutdown handler registered")

    # Tray instance holder (will be set after creation)
    tray_instance = None

    # Startup manager
    startup_manager = WindowsStartupManager() if WindowsStartupManager else None

    def handle_tray_open(event_data):
        """Open web interface in browser"""
        ColorPrint.blue("[Tray] Opening web interface...")
        import webbrowser
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

    def update_tray_menu():
        """Update tray menu with current startup state"""
        if not tray_instance or not startup_manager:
            return

        startup_enabled = startup_manager.is_enabled()
        startup_text = "✓ Auto-Start on Boot" if startup_enabled else "Auto-Start on Boot"

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

    THREAD_BUS.register_event_handler('tray_action_open', handle_tray_open)
    THREAD_BUS.register_event_handler('tray_action_restart', handle_tray_restart)
    THREAD_BUS.register_event_handler('tray_action_exit', handle_tray_exit)
    THREAD_BUS.register_event_handler('tray_action_toggle_startup', handle_tray_toggle_startup)

    # Start RPC v2 server (registers shutdown handler internally)
    start_rpc_server()

    icon_path = PYCORE_ROOT / "pyutils" / "native_ui" / "step1_config" / "app_icon.png"
    if not icon_path.exists():
        icon_path = None

    # Build initial menu with startup state
    startup_enabled = startup_manager.is_enabled() if startup_manager else False
    startup_text = "✓ Auto-Start on Boot" if startup_enabled else "Auto-Start on Boot"

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

    try:
        tray.run()
    except KeyboardInterrupt:
        ColorPrint.yellow("\n[Windows] Keyboard interrupt...")
    finally:
        if launcher:
            launcher.stop()
        ColorPrint.blue("[Windows] Shutdown complete")
