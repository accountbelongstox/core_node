#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Run the callmodule translation routes on the shared RPC v2 server."""

import sys
import os
from pathlib import Path

# Setup path - go up two levels from scripts/pycore/ to reach the repo root
CORE_NODE_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(CORE_NODE_ROOT))

# Set environment variable to skip dependency check (must be before imports)
os.environ.setdefault('PYCORE_SKIP_DEP_CHECK', '1')

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_uvicorn
from pycore.callmodule.rpc_routes.local_translate_routes import register_local_translate_routes
from pycore.pyutils.rpc_v2.server import RpcServer


uvicorn = get_third_package_uvicorn()


def main():
    """Start RPC v2 with the current callmodule translation routes."""
    
    # Create RPC v2 server
    options = {
        "host": "0.0.0.0",  # Network accessible
        "port": 59000,
        "debug": False
    }
    
    server = RpcServer(options)
    
    register_local_translate_routes(server)
    
    # Print startup info
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("Pycore Translation RPC Service")
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(f"Health:       http://0.0.0.0:{options['port']}/rpc/status")
    ColorPrint.blue(f"Routes:       http://0.0.0.0:{options['port']}/rpc/routes")
    ColorPrint.blue(
        f"Controllers:  POST http://0.0.0.0:{options['port']}"
        "/api/controller/{route}"
    )
    ColorPrint.blue(f"Events:       GET  http://0.0.0.0:{options['port']}/api/events")
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(f"Controllers:  http://0.0.0.0:{options['port']}/api/controller/{{name}}")
    ColorPrint.blue("=" * 70)
    
    # Start server
    uvicorn.run(
        server.app,
        host=options["host"],
        port=options["port"],
        log_level="warning"
    )


if __name__ == "__main__":
    main()
