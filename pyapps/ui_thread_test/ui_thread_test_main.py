#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI Thread Test Application - Entry Point

This is the entry point file for AppLauncher.
AppLauncher expects: {app_name}/{app_name}_main.py

Usage:
    python pymain.py app=ui_thread_test
    python pymain.py app=ui_thread
    python pymain.py app=ui
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# Import and delegate to main.py
from pyapps.ui_thread_test.main import start


def main():
    """Entry point for AppLauncher"""
    start()


if __name__ == '__main__':
    main()
