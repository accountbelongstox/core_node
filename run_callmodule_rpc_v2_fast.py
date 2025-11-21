#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pycore Module Caller Service - RPC v2 Architecture (Fast Start)

Fast startup version that skips automatic dependency checking.
Use this for production services where dependencies are already installed.
"""

import sys
import os
from pathlib import Path

# Setup path
CORE_NODE_ROOT = Path(__file__).parent
sys.path.insert(0, str(CORE_NODE_ROOT))

# CRITICAL: Skip dependency check by setting environment variable
# This prevents the slow pyaudio installation check
os.environ['PYCORE_SKIP_DEP_CHECK'] = '1'

# Set ENCYCLOPEDIA flag BEFORE importing pycore modules
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
ENCYCLOPEDIA.add("pycore_dependencies_checked", True)

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
    
    # Auto-register all modules from registry
    # Currently: Google Translator (translate_single, translate_batch, detect_language)
    register_module_routes(server, debug=False)
    
    # Register homepage and API documentation routes
    register_homepage_routes(server.app)
    
    # Print startup information
    print("=" * 70)
    print("Pycore Module Caller - RPC v2 Architecture")
    print("=" * 70)
    print(f"Homepage:     http://0.0.0.0:{options['port']}/")
    print(f"API Modules:  http://0.0.0.0:{options['port']}/api/modules")
    print(f"Health:       http://0.0.0.0:{options['port']}/rpc/status")
    print(f"RPC Routes:   http://0.0.0.0:{options['port']}/rpc/routes")
    print(f"RPC Endpoint: POST http://0.0.0.0:{options['port']}/rpc/{{route}}")
    print(f"WebSocket:    ws://0.0.0.0:{options['port']}/rpc/ws")
    print("=" * 70)
    print()
    print("Available modules:")
    print("  - translator (Google Translator)")
    print("    - translate_single: Translate single text")
    print("    - translate_batch:  Batch translation")
    print("    - detect_language:  Language detection")
    print()
    print("Example:")
    print("  curl -X POST http://localhost:59000/rpc/translator.translate_single \\")
    print("    -H 'Content-Type: application/json' \\")
    print("    -d '{\"params\": {\"text\": \"Hello\", \"src\": \"en\", \"dest\": \"ko\"}}'")
    print("=" * 70)
    
    # Start server using uvicorn
    import uvicorn
    uvicorn.run(
        server.app,
        host=options["host"],
        port=options["port"],
        log_level="warning"
    )


if __name__ == '__main__':
    main()
