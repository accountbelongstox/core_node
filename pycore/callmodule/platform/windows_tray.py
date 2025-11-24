# -*- coding: utf-8 -*-
"""
Windows Tray Mode Launcher

Runs RPC v2 server with system tray icon and singleton detection.
"""

import sys
import threading
from pathlib import Path


def launch_windows_tray(host='0.0.0.0', port=59000, debug=False):
    """
    Launch RPC v2 server with Windows system tray.

    Features:
    - Singleton detection (prevents multiple instances)
    - System tray icon with menu
    - Background RPC v2 server
    - Web interface access from tray

    Args:
        host: Host to bind to
        port: Port to bind to
        debug: Enable debug mode
    """
    from pycore import ColorPrint, THREAD_BUS
    from pycore.pylauncher import SingletonDetector
    from pycore.pyfoundations.third_party import get_third_package_uvicorn
    from pycore.pyutils.rpc_v2.server.fastapi_server import FastAPIRPCServer
    from pycore.pyutils.rpc_v2.modules import register_module_routes, register_homepage_routes

    try:
        from pycore.pyutils.native_ui.step6_tray.tkinter_system_tray import (
            TkinterSystemTray,
            TrayMenuItem,
            PYSTRAY_AVAILABLE
        )
    except ImportError:
        PYSTRAY_AVAILABLE = False

    ColorPrint.blue("=" * 70)
    ColorPrint.blue("Pycore Module Caller - Windows Tray Mode (RPC v2)")
    ColorPrint.blue("=" * 70)

    if not PYSTRAY_AVAILABLE:
        ColorPrint.red("[ERROR] pystray library not available!")
        ColorPrint.yellow("[Fallback] Running in console mode...")
        from .linux_service import launch_linux_service
        launch_linux_service(host, port, debug)
        return

    APP_ID = "pycore_module_caller"
    SINGLETON_PORT_START = 59100
    SINGLETON_PORT_RANGE = 100

    ColorPrint.blue(f"[Windows] Singleton detection (ports {SINGLETON_PORT_START}-{SINGLETON_PORT_START + SINGLETON_PORT_RANGE - 1})...")

    detector = SingletonDetector(
        app_id=APP_ID,
        port_start=SINGLETON_PORT_START,
        port_range=SINGLETON_PORT_RANGE,
        debug=debug
    )

    result = detector.detect_and_bind()

    if not result.is_primary:
        ColorPrint.yellow(f"[Windows] Instance already running on port {result.existing_port}")
        ColorPrint.yellow("[Windows] Exiting...")
        return

    ColorPrint.green(f"[Windows] Singleton port: {result.port}")

    PYCORE_ROOT = Path(__file__).parent.parent.parent
    server_running = threading.Event()

    def start_rpc_server():
        """Start RPC v2 server in background thread"""
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

        uvicorn = get_third_package_uvicorn()

        def run_uvicorn():
            server_running.set()
            ColorPrint.green(f"[Windows] RPC v2 started: http://{host}:{port}")
            ColorPrint.blue(f"[Windows] Homepage: http://{host}:{port}/")
            ColorPrint.blue(f"[Windows] RPC: POST http://{host}:{port}/rpc/{{route}}")
            uvicorn.run(
                server.app,
                host=host,
                port=port,
                log_level="debug" if debug else "info"
            )

        server_thread = threading.Thread(
            target=run_uvicorn,
            daemon=True,
            name="RPC-v2-Server"
        )
        server_thread.start()
        server_running.wait(timeout=5)

    def handle_tray_open(event_data):
        """Open web interface in browser"""
        ColorPrint.blue("[Tray] Opening web interface...")
        import webbrowser
        webbrowser.open(f"http://localhost:{port}/")

    def handle_tray_exit(event_data):
        """Exit application"""
        ColorPrint.yellow("[Tray] Shutting down...")
        detector.stop()
        ColorPrint.blue("[Tray] Shutdown complete")
        sys.exit(0)

    THREAD_BUS.register_event_handler('tray_action_open', handle_tray_open)
    THREAD_BUS.register_event_handler('tray_action_exit', handle_tray_exit)

    start_rpc_server()

    icon_path = PYCORE_ROOT / "pyutils" / "native_ui" / "step1_config" / "app_icon.png"
    if not icon_path.exists():
        icon_path = None

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
        TrayMenuItem(
            text=f"Singleton Port: {result.port}",
            action_signal="",
            enabled=False
        ),
        TrayMenuItem.SEPARATOR,
        TrayMenuItem(
            text="Exit",
            action_signal="tray_action_exit"
        )
    ]

    ColorPrint.green("=" * 70)
    ColorPrint.green("[Windows] System tray ready")
    ColorPrint.green(f"[Windows] RPC v2: http://localhost:{port}/")
    ColorPrint.green(f"[Windows] Singleton: {result.port}")
    ColorPrint.green("=" * 70)

    tray = TkinterSystemTray(
        app_name="Pycore RPC Server",
        icon_path=str(icon_path) if icon_path else None,
        menu_items=menu_items
    )

    try:
        tray.run()
    except KeyboardInterrupt:
        ColorPrint.yellow("\n[Windows] Keyboard interrupt...")
    finally:
        detector.stop()
        ColorPrint.blue("[Windows] Shutdown complete")
