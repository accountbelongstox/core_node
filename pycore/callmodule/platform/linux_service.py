# -*- coding: utf-8 -*-
"""
Linux Service Mode Launcher

Runs RPC v2 server directly (systemd compatible).
"""

from pathlib import Path


def launch_linux_service(host='0.0.0.0', port=59000, debug=False, launcher=None, singleton_port=None):
    """
    Launch RPC v2 server in Linux service mode.

    IMPORTANT: This function does NOT perform singleton detection.
    Singleton detection is handled by ServiceLauncher in launch_platform_aware().

    Args:
        host: Host to bind to
        port: Port to bind to
        debug: Enable debug mode
        launcher: ServiceLauncher instance (for singleton detector and lifecycle management)
        singleton_port: Singleton port (passed from launcher, for logging)
    """
    from pycore import ColorPrint, THREAD_BUS
    from pycore.pyfoundations.third_party import get_third_package_uvicorn
    from pycore.pyutils.rpc_v2.server.fastapi_server import FastAPIRPCServer
    from pycore.pyutils.rpc_v2.modules import register_module_routes, register_homepage_routes

    ColorPrint.blue("=" * 70)
    ColorPrint.blue("Pycore Module Caller - Linux Service Mode (RPC v2)")
    ColorPrint.blue("=" * 70)

    if singleton_port is not None:
        ColorPrint.green(f"[Linux] Singleton port: {singleton_port}")

    # Create RPC v2 server
    server = FastAPIRPCServer(options={
        "host": host,
        "port": port,
        "debug": debug
    })

    # Register module routes (auto-register all modules from registry)
    ColorPrint.blue("[Linux] Registering module routes...")
    register_module_routes(server, debug=debug)

    # Register homepage routes
    ColorPrint.blue("[Linux] Registering homepage routes...")
    register_homepage_routes(server.app)

    # Register MCP routes (unified backend)
    ColorPrint.blue("[Linux] Registering MCP backend routes...")
    from pycore.callmodule.routers.mcp_router import mcp_router
    server.app.include_router(mcp_router)
    ColorPrint.green("[Linux] MCP backend routes registered at /mcp/*")

    # Register singleton control routes
    ColorPrint.blue("[Linux] Registering singleton control routes...")
    from pycore.callmodule.routers.singleton_router import singleton_router
    server.app.include_router(singleton_router)
    ColorPrint.green("[Linux] Singleton control routes registered at /singleton/*")

    # Get uvicorn module
    uvicorn = get_third_package_uvicorn()

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
        ColorPrint.yellow("[Linux] Shutting down RPC v2 server...")
        uvicorn_server.should_exit = True
        # Force shutdown
        if hasattr(uvicorn_server, 'force_exit'):
            uvicorn_server.force_exit = True
        ColorPrint.green("[Linux] RPC v2 server shutdown signal sent")

    THREAD_BUS.register_shutdown_handler(shutdown_rpc_server, priority=90, name='rpc_v2_server')
    ColorPrint.blue("[Linux] RPC v2 server shutdown handler registered")

    # Start server (blocking)
    ColorPrint.green(f"[Linux] Starting RPC v2 server on {host}:{port}")
    ColorPrint.blue(f"[Linux] Homepage: http://{host}:{port}/")
    ColorPrint.blue(f"[Linux] RPC: POST http://{host}:{port}/rpc/{{route}}")

    try:
        uvicorn_server.run()
    except Exception:
        # Suppress expected errors during shutdown (CancelledError, etc.)
        pass
