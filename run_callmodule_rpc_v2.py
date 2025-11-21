#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pycore Module Caller Service - RPC v2 Architecture

Uses RPC v2 server with module system for:
- Hardcoded module registry
- Preloaded module instances
- Automatic route registration
- Homepage documentation
"""

import sys
from pathlib import Path

CORE_NODE_ROOT = Path(__file__).parent
sys.path.insert(0, str(CORE_NODE_ROOT))

from pycore.pyutils.rpc_v2.server.fastapi_server import FastAPIRPCServer
from pycore.pyutils.rpc_v2.modules import register_module_routes, register_homepage_routes


def main():
    """Run RPC v2 server with module system"""
    
    # Create RPC v2 server
    options = {
        "host": "0.0.0.0",
        "port": 59000,
        "debug": False
    }
    
    server = FastAPIRPCServer(options)
    
    # Register module routes (auto-register translator and future modules)
    register_module_routes(server, debug=False)
    
    # Register homepage routes
    register_homepage_routes(server.app)
    
    # Print startup info
    print("=" * 70)
    print("Pycore Module Caller - RPC v2 Architecture")
    print("=" * 70)
    print(f"Homepage:     http://0.0.0.0:{options['port']}/")
    print(f"API Modules:  http://0.0.0.0:{options['port']}/api/modules")
    print(f"Health:       http://0.0.0.0:{options['port']}/rpc/status")
    print(f"RPC Endpoint: POST http://0.0.0.0:{options['port']}/rpc/{{route}}")
    print("=" * 70)
    
    # Start server
    import uvicorn
    uvicorn.run(
        server.app,
        host=options["host"],
        port=options["port"],
        log_level="warning"
    )


if __name__ == '__main__':
    main()
