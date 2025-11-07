#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Python Main Entry Point

Simple entry point that delegates to pycore.pyfoundations.app_launcher

Usage:
    python pymain.py app=mcpserver
    python pymain.py app=mcp
    python pymain.py --app=mcpserver
    python pymain.py
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.app_launcher import AppLauncher


if __name__ == '__main__':
    launcher = AppLauncher()

    try:
        success = launcher.start()
        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        print('\nInterrupted by user')
        launcher.stop()
        sys.exit(0)

    except Exception as error:
        print(f'Unexpected error: {error}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
