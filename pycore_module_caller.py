#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pycore Module Caller - FastAPI Service (Legacy Entry Point)

This file now redirects to the new modular FastAPI implementation.
For direct usage, use: python -m pycore.callmodule

Legacy compatibility wrapper for systemd service and existing scripts.
"""

import sys
from pathlib import Path

# Add pycore to path
PYCORE_ROOT = Path(__file__).parent
sys.path.insert(0, str(PYCORE_ROOT))


def run_server(host='127.0.0.1', port=59000):
    """
    Run FastAPI server (legacy wrapper).

    Args:
        host: Host to bind to
        port: Port to bind to
    """
    # Initialize global config
    from pycore.callmodule.global_config import init_global_config
    init_global_config(
        pycore_root=str(PYCORE_ROOT),
        http_port=port,
        host=host,
        debug=False
    )

    # Run server using uvicorn
    import uvicorn
    uvicorn.run(
        "pycore.callmodule.app:create_app",
        host=host,
        port=port,
        factory=True
    )


if __name__ == '__main__':
    run_server()
