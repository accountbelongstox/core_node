#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pycore Module Caller Service - RPC v2 Architecture

HTTP API service using RPC v2 framework with:
- Hardcoded translator module (no dynamic imports)
- Singleton instance (prevents repeated initialization)
- Network accessible (0.0.0.0:59000)
- Fast startup (PYCORE_SKIP_DEP_CHECK environment variable)
"""

import sys
import os
from pathlib import Path

# Setup path - go up two levels from scripts/pycore/ to reach the repo root
CORE_NODE_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(CORE_NODE_ROOT))

# Set environment variable to skip dependency check (must be before imports)
os.environ.setdefault('PYCORE_SKIP_DEP_CHECK', '1')

from pycore.pyutils.rpc_v2.server.fastapi_server import FastAPIRPCServer
from pycore.pyutils.rpc_v2.modules.auto_register import register_module_routes
from pycore.pyutils.rpc_v2.modules.homepage_routes import register_homepage_routes


def main():
    """Start RPC v2 server with translator module"""
    
    # Create RPC v2 server
    options = {
        "host": "0.0.0.0",  # Network accessible
        "port": 59000,
        "debug": False
    }
    
    server = FastAPIRPCServer(options)
    
    # Register module routes (translator with translate_single, translate_batch, detect_language)
    register_module_routes(server, debug=False)
    
    # Register homepage routes (shows all available routes)
    register_homepage_routes(server.app)
    
    # Print startup info
    print("=" * 70)
    print("Pycore Module Caller - RPC v2 Architecture")
    print("=" * 70)
    print(f"Homepage:     http://0.0.0.0:{options['port']}/")
    print(f"API Modules:  http://0.0.0.0:{options['port']}/api/modules")
    print(f"Health:       http://0.0.0.0:{options['port']}/rpc/status")
    print(f"Routes:       http://0.0.0.0:{options['port']}/rpc/routes")
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
    
    # Start server
    import uvicorn
    uvicorn.run(
        server.app,
        host=options["host"],
        port=options["port"],
        log_level="warning"
    )


if __name__ == "__main__":
    main()
