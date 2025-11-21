#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pycore Module Caller Service

HTTP API service for calling pycore modules dynamically.
Accessible from network via 0.0.0.0:59000.
"""

import sys
from pathlib import Path

# Setup path
CORE_NODE_ROOT = Path(__file__).parent
sys.path.insert(0, str(CORE_NODE_ROOT))

from pycore.callmodule.app import create_app
import uvicorn


def main():
    """Start the FastAPI HTTP service"""
    
    # Create FastAPI app
    app = create_app()
    
    # Start server on 0.0.0.0:59000 (network accessible)
    uvicorn.run(
        app,
        host="0.0.0.0",  # Listen on all network interfaces
        port=59000,
        log_level="warning"
    )


if __name__ == "__main__":
    main()
