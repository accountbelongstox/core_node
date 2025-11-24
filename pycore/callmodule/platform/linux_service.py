# -*- coding: utf-8 -*-
"""
Linux Service Mode Launcher

Runs RPC v2 server directly (systemd compatible).
"""

from pathlib import Path


def launch_linux_service(host='0.0.0.0', port=59000, debug=False):
    """
    Launch RPC v2 server in Linux service mode.

    Args:
        host: Host to bind to
        port: Port to bind to
        debug: Enable debug mode
    """
    from pycore import ColorPrint
    from pycore.pyfoundations.third_party import get_third_package_uvicorn
    from pycore.pyutils.rpc_v2.server.fastapi_server import FastAPIRPCServer
    from pycore.pyutils.rpc_v2.modules import register_module_routes, register_homepage_routes

    ColorPrint.blue("=" * 70)
    ColorPrint.blue("Pycore Module Caller - Linux Service Mode (RPC v2)")
    ColorPrint.blue("=" * 70)

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

    # Start server
    uvicorn = get_third_package_uvicorn()
    ColorPrint.green(f"[Linux] Starting RPC v2 server on {host}:{port}")
    ColorPrint.blue(f"[Linux] Homepage: http://{host}:{port}/")
    ColorPrint.blue(f"[Linux] RPC: POST http://{host}:{port}/rpc/{{route}}")

    uvicorn.run(
        server.app,
        host=host,
        port=port,
        log_level="debug" if debug else "info"
    )
