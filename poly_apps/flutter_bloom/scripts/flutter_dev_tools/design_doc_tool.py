#!/usr/bin/env python3
"""
Flutter design documentation inspection server.

This file serves as a compatibility wrapper.
All functionality has been moved to the modular architecture in main.py.
"""

import sys
from pathlib import Path

# Add project root to Python path for pycore imports
# Script location: poly_apps/flutter_bloom/scripts/flutter_dev_tools/design_doc_tool.py
# Project root: 4 levels up (flutter_dev_tools -> scripts -> flutter_bloom -> poly_apps -> core_node)
_script_dir = Path(__file__).resolve().parent
_project_root = _script_dir.parent.parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

if __name__ == "__main__":
    print("=" * 60)
    print("Flutter Design Documentation Tool")
    print("Using modular architecture (main.py)")
    print("=" * 60)
    print()

    # Import and run the new main server
    from main import run_server
    run_server()
