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

# MCP Mode Detection - MUST BE FIRST (before any imports)
# Check if running in MCP mode and set environment variable
# This allows ColorPrint to auto-detect MCP mode when it's imported
import sys
import os

IS_MCP_MODE = False
for arg in sys.argv[1:]:
    # Match app=mcp (case-insensitive, exact match)
    arg_lower = arg.lower()
    if arg_lower == 'app=mcp' or arg_lower == '--app=mcp' or arg_lower.startswith('app=mcp ') or arg_lower.startswith('--app=mcp '):
        # Set environment variable to signal MCP mode
        # ColorPrint will auto-detect this on import
        os.environ['PYCORE_MCP_MODE'] = '1'
        IS_MCP_MODE = True
        break

# Usage documentation notice (suppressed in MCP mode for clean STDIO)
OUTPUT_STREAM = sys.stderr

if not IS_MCP_MODE:
    print('\n' + '=' * 70, file=OUTPUT_STREAM)
    print('Usage Documentation: development-guides\\PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md', file=OUTPUT_STREAM)
    print('=' * 70, file=OUTPUT_STREAM)
    print('The following output is debug/test information:', file=OUTPUT_STREAM)
    print('=' * 70 + '\n', file=OUTPUT_STREAM)

from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.app_launcher import AppLauncher


if __name__ == '__main__':

    # Print startup banner (suppressed in MCP mode for clean STDIO)
    if not IS_MCP_MODE:
        print('\n' + '=' * 70, file=OUTPUT_STREAM)
        print('Python Application Launcher - Starting...', file=OUTPUT_STREAM)
        print('=' * 70, file=OUTPUT_STREAM)
        print(f'Working Directory: {Path.cwd()}', file=OUTPUT_STREAM)
        print(f'Project Root: {PROJECT_ROOT}', file=OUTPUT_STREAM)
        print(f'Command Line Args: {sys.argv}', file=OUTPUT_STREAM)
        print('=' * 70 + '\n', file=OUTPUT_STREAM)

    launcher = AppLauncher()

    try:
        success = launcher.start()

        if not IS_MCP_MODE:
            # Only show status banners for non-MCP applications
            if success:
                print('\n' + '=' * 70, file=OUTPUT_STREAM)
                print('Application started successfully', file=OUTPUT_STREAM)
                print('=' * 70 + '\n', file=OUTPUT_STREAM)
            else:
                print('\n' + '=' * 70, file=OUTPUT_STREAM)
                print('Application failed to start', file=OUTPUT_STREAM)
                print('=' * 70 + '\n', file=OUTPUT_STREAM)

        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        if not IS_MCP_MODE:
            print('\n' + '=' * 70, file=OUTPUT_STREAM)
            print('Interrupted by user', file=OUTPUT_STREAM)
            print('=' * 70, file=OUTPUT_STREAM)
        launcher.stop()
        sys.exit(0)

    except Exception as error:
        # Always show critical errors, even in MCP mode
        print('\n' + '=' * 70, file=OUTPUT_STREAM)
        print(f'Unexpected error: {error}', file=OUTPUT_STREAM)
        print('=' * 70, file=OUTPUT_STREAM)
        import traceback
        traceback.print_exc()
        sys.exit(1)
