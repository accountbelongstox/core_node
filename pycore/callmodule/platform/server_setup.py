# -*- coding: utf-8 -*-
"""
RPC Server Setup (Shared Logic)

Common server creation and route registration logic shared by all platforms.
Platform-specific code (tray, service) only handles UI differences.
"""

import logging
import threading
from pathlib import Path
from typing import Optional

from fastapi.staticfiles import StaticFiles

from pycore import ColorPrint, THREAD_BUS
from pycore.pyfoundations.third_party import get_third_package_uvicorn
from pycore.pyutils.rpc_v2.server.fastapi_server import FastAPIRPCServer
from pycore.pyutils.rpc_v2.modules import register_module_routes, register_homepage_routes
from pycore.callmodule.routers.mcp_router import mcp_router
from pycore.callmodule.routers.singleton_router import singleton_router
from pycore.callmodule.routers.voice_subtitle_router import router as voice_subtitle_router
from pycore.callmodule.routers.web_router import router as web_router


class SuppressCancelledErrorFilter(logging.Filter):
    """Filter to suppress asyncio.CancelledError logs during shutdown"""

    def filter(self, record):
        # Suppress CancelledError from starlette/uvicorn during shutdown
        if "CancelledError" in str(record.msg):
            return False
        if hasattr(record, 'exc_info') and record.exc_info:
            exc_type = record.exc_info[0]
            if exc_type and exc_type.__name__ == 'CancelledError':
                return False
        return True


def create_rpc_server(host='0.0.0.0', port=59000, debug=False):
    """
    Create and configure RPC v2 server with all routes.

    This is the ONLY place where routes are registered.

    Args:
        host: Host to bind to
        port: Port to bind to
        debug: Enable debug mode

    Returns:
        FastAPIRPCServer: Configured server instance
    """
    ColorPrint.blue("[Server] Creating RPC v2 server...")

    # Create RPC v2 server
    server = FastAPIRPCServer(options={
        "host": host,
        "port": port,
        "debug": debug
    })

    # Register module routes (auto-register all modules from registry)
    ColorPrint.blue("[Server] Registering module routes...")
    register_module_routes(server, debug=debug)

    # Register homepage routes
    ColorPrint.blue("[Server] Registering homepage routes...")
    register_homepage_routes(server.app)

    # Register MCP routes (unified backend)
    ColorPrint.blue("[Server] Registering MCP backend routes...")
    server.app.include_router(mcp_router)
    ColorPrint.green("[Server] MCP backend routes registered at /mcp/*")

    # Register singleton control routes
    ColorPrint.blue("[Server] Registering singleton control routes...")
    server.app.include_router(singleton_router)
    ColorPrint.green("[Server] Singleton control routes registered at /singleton/*")

    # Register voice subtitle routes
    ColorPrint.blue("[Server] Registering voice subtitle routes...")
    server.app.include_router(voice_subtitle_router)
    ColorPrint.green("[Server] Voice subtitle routes registered at /voice-subtitle/*")

    # Register web UI routes
    ColorPrint.blue("[Server] Registering web UI routes...")
    server.app.include_router(web_router)
    ColorPrint.green("[Server] Web UI routes registered at /web/*")

    # Mount static directory for subtitle UI assets
    subtitle_ui_dir = Path(__file__).parent.parent.parent / "pyctl" / "voice_subtitle" / "ui"
    if subtitle_ui_dir.exists():
        server.app.mount(
            "/voice-subtitle",
            StaticFiles(directory=str(subtitle_ui_dir), html=True),
            name="subtitle_ui_static"
        )
        ColorPrint.green(f"[Server] Static files mounted at /voice-subtitle/* from {subtitle_ui_dir}")

    # Note: RPC JavaScript client is served at /js/rpc/* by FastAPIRPCServer (built-in)

    # Register THREAD_BUS event listeners for WebSocket broadcast
    ColorPrint.blue("[Server] Registering THREAD_BUS event listeners...")
    server.register_thread_bus_listener('voice_subtitle_update')
    server.register_thread_bus_listener('voice_subtitle_ui_show')
    server.register_thread_bus_listener('voice_subtitle_ui_hide')
    ColorPrint.green("[Server] THREAD_BUS listeners registered")

    # Initialize voice subtitle window manager (for subtitle mode window adjustments)
    try:
        from pycore.pyctl.voice_subtitle.window_manager import get_window_manager
        window_manager = get_window_manager()
        ColorPrint.green("[Server] Voice subtitle window manager initialized")
    except ImportError as e:
        ColorPrint.yellow(f"[Server] Voice subtitle window manager not available: {e}")
    except Exception as e:
        ColorPrint.yellow(f"[Server] Error initializing voice subtitle window manager: {e}")

    return server


def start_rpc_server_blocking(host='0.0.0.0', port=59000, debug=False):
    """
    Start RPC v2 server in blocking mode (for Linux service).

    Args:
        host: Host to bind to
        port: Port to bind to
        debug: Enable debug mode
    """
    server = create_rpc_server(host, port, debug)
    uvicorn = get_third_package_uvicorn()

    # Configure logging to suppress CancelledError during shutdown
    uvicorn_error_logger = logging.getLogger("uvicorn.error")
    cancel_filter = SuppressCancelledErrorFilter()
    uvicorn_error_logger.addFilter(cancel_filter)

    # Create uvicorn Server instance (for shutdown control)
    config = uvicorn.Config(
        server.app,
        host=host,
        port=port,
        log_level="debug" if debug else "info"
    )
    uvicorn_server = uvicorn.Server(config)

    # Register shutdown handler to THREAD_BUS
    def shutdown_rpc_server(event_data=None):
        """Shutdown RPC v2 server (registered with THREAD_BUS)"""
        ColorPrint.yellow("[Server] Shutting down RPC v2 server...")
        uvicorn_server.should_exit = True
        # Force shutdown
        if hasattr(uvicorn_server, 'force_exit'):
            uvicorn_server.force_exit = True
        ColorPrint.green("[Server] RPC v2 server shutdown signal sent")

    THREAD_BUS.register_shutdown_handler(shutdown_rpc_server, priority=90, name='rpc_v2_server')
    ColorPrint.blue("[Server] RPC v2 server shutdown handler registered")

    # Start server (blocking)
    ColorPrint.green(f"[Server] Starting RPC v2 server on {host}:{port}")
    ColorPrint.blue(f"[Server] Homepage: http://{host}:{port}/")
    ColorPrint.blue(f"[Server] RPC: POST http://{host}:{port}/rpc/{{route}}")

    try:
        uvicorn_server.run()
    except Exception:
        # Suppress expected errors during shutdown (CancelledError, etc.)
        pass


def start_rpc_server_background(host='0.0.0.0', port=59000, debug=False):
    """
    Start RPC v2 server in background thread (for Windows tray).

    Args:
        host: Host to bind to
        port: Port to bind to
        debug: Enable debug mode

    Returns:
        threading.Event: Event that is set when server is ready
    """
    server = create_rpc_server(host, port, debug)
    uvicorn = get_third_package_uvicorn()

    server_running = threading.Event()
    uvicorn_server_holder = {'server': None}

    def run_uvicorn():
        """Run uvicorn server"""
        # Configure logging to suppress CancelledError during shutdown
        uvicorn_error_logger = logging.getLogger("uvicorn.error")
        cancel_filter = SuppressCancelledErrorFilter()
        uvicorn_error_logger.addFilter(cancel_filter)

        config = uvicorn.Config(
            server.app,
            host=host,
            port=port,
            log_level="debug" if debug else "info"
        )
        uvicorn_server = uvicorn.Server(config)
        uvicorn_server_holder['server'] = uvicorn_server

        server_running.set()
        ColorPrint.green(f"[Server] RPC v2 started: http://{host}:{port}")
        ColorPrint.blue(f"[Server] Homepage: http://{host}:{port}/")
        ColorPrint.blue(f"[Server] RPC: POST http://{host}:{port}/rpc/{{route}}")

        # Run server (blocking in this thread)
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
        uvicorn_server = uvicorn_server_holder.get('server')
        if uvicorn_server:
            ColorPrint.yellow("[Server] Shutting down RPC v2 server...")
            uvicorn_server.should_exit = True
            # Force shutdown
            if hasattr(uvicorn_server, 'force_exit'):
                uvicorn_server.force_exit = True
            ColorPrint.green("[Server] RPC v2 server shutdown signal sent")

    THREAD_BUS.register_shutdown_handler(shutdown_handler, priority=90, name='rpc_v2_server')
    ColorPrint.blue("[Server] RPC v2 server shutdown handler registered")

    return server_running
