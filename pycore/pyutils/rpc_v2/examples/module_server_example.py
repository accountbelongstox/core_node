#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Module Server Example - RPC v2 with Module System Integration

This example demonstrates:
1. Starting RPC v2 server with module system
2. Auto-registering module routes
3. Homepage displaying available routes
4. Using Google Translator via RPC

Usage:
    python -m pycore.pyutils.rpc_v2.examples.module_server_example
    
Then visit:
    http://localhost:58765/         - Homepage with route documentation
    http://localhost:58765/api/modules - List all modules (JSON API)
    
Call translator:
    POST http://localhost:58765/rpc/translator.translate_single
    {
        "params": {
            "text": "Hello world",
            "src": "en",
            "dest": "ko"
        }
    }
"""

import sys
from pathlib import Path

from pycore.pyfoundations.third_party import get_third_package_uvicorn


# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pyutils.rpc_v2.server.fastapi_server import FastAPIRPCServer
from pycore.pyutils.rpc_v2.modules import register_module_routes, register_homepage_routes


def main():
    """Start RPC v2 server with module system"""
    
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("RPC v2 Module Server Example")
    ColorPrint.blue("=" * 70)
    print()
    
    # Create RPC server
    options = {
        "host": "0.0.0.0",
        "port": 58765,
        "debug": True
    }
    
    server = FastAPIRPCServer(options)
    
    # Register module routes (auto-register all modules from registry)
    ColorPrint.blue("[Setup] Registering module routes...")
    register_module_routes(server, debug=True)
    
    # Register homepage routes
    ColorPrint.blue("[Setup] Registering homepage routes...")
    register_homepage_routes(server.app)
    
    # Print info
    print()
    ColorPrint.green("=" * 70)
    ColorPrint.green("Server Ready!")
    ColorPrint.green("=" * 70)
    print()
    ColorPrint.blue(f"Homepage:     http://localhost:{options['port']}/")
    ColorPrint.blue(f"API Modules:  http://localhost:{options['port']}/api/modules")
    ColorPrint.blue(f"RPC Endpoint: POST http://localhost:{options['port']}/rpc/{{route}}")
    ColorPrint.blue(f"RPC Query:    GET http://localhost:{options['port']}/rpc/query/{{request_id}}")
    ColorPrint.blue(f"WebSocket:    ws://localhost:{options['port']}/rpc/ws")
    print()
    ColorPrint.yellow("Example call:")
    ColorPrint.yellow("  POST http://localhost:58765/rpc/translator.translate_single")
    ColorPrint.yellow('  {"params": {"text": "Hello", "src": "en", "dest": "ko"}}')
    print()
    ColorPrint.green("=" * 70)
    print()
    
    # Start server
    ColorPrint.yellow("Starting server... (Press Ctrl+C to stop)")
    print()
    
    uvicorn = get_third_package_uvicorn()
    uvicorn.run(
        server.app,
        host=options["host"],
        port=options["port"],
        log_level="info"
    )


if __name__ == "__main__":
    main()
