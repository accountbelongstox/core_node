#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pycore Module Caller Service - Standalone Entry Point

This script runs the FastAPI service without importing the main pycore package,
avoiding GUI dependencies (pystray, tkinter, etc.) that require X display.
"""

import sys
from pathlib import Path

# Setup path without importing pycore
CORE_NODE_ROOT = Path(__file__).parent
sys.path.insert(0, str(CORE_NODE_ROOT))

# Direct import - bypasses pycore/__init__.py
from pycore.callmodule.global_config import init_global_config
import uvicorn

def main():
    """Run the FastAPI service"""
    # Initialize config
    init_global_config(
        pycore_root=str(CORE_NODE_ROOT / "pycore"),
        http_port=59000,
        host="127.0.0.1",
        debug=False
    )

    # Run server
    uvicorn.run(
        "pycore.callmodule.app:create_app",
        host="127.0.0.1",
        port=59000,
        factory=True
    )

if __name__ == '__main__':
    main()
