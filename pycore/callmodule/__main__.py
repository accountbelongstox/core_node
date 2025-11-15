# -*- coding: utf-8 -*-
"""
Pycore Module Caller - Main Entry Point

Run as module:
    python -m pycore.callmodule

Or with custom settings:
    python -m pycore.callmodule --host 0.0.0.0 --port 8000 --debug
"""

import argparse
import sys
from pathlib import Path

# Add pycore to path
PYCORE_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PYCORE_ROOT))


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Pycore Module Caller FastAPI Service")
    parser.add_argument(
        '--host',
        default='127.0.0.1',
        help='Host to bind to (default: 127.0.0.1, use 0.0.0.0 for all interfaces)'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=59000,
        help='Port to bind to (default: 59000)'
    )
    parser.add_argument(
        '--debug',
        action='store_true',
        help='Enable debug mode'
    )
    parser.add_argument(
        '--reload',
        action='store_true',
        help='Enable auto-reload (development mode)'
    )

    args = parser.parse_args()

    # Initialize global config
    from .global_config import init_global_config
    init_global_config(
        pycore_root=str(PYCORE_ROOT),
        http_port=args.port,
        host=args.host,
        debug=args.debug
    )

    # Run server
    from pycore.pyfoundations.third_party import uvicorn
    uvicorn.run(
        "pycore.callmodule.app:create_app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        factory=True
    )


if __name__ == '__main__':
    main()
