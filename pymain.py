#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Python Main Entry Point (core_node root)

Delegates to pycore.pyfoundations.app_launcher.

Usage:
    python pymain.py app=claude_host
    python pymain.py app=mcpserver
    python pymain.py app=mcp
    python pymain.py
"""

import sys
import os

# MCP Mode Detection - MUST BE FIRST (before any imports)
IS_MCP_MODE = False
for arg in sys.argv[1:]:
    arg_lower = arg.lower()
    if arg_lower == 'app=mcp' or arg_lower == '--app=mcp':
        os.environ['PYCORE_MCP_MODE'] = '1'
        IS_MCP_MODE = True
        break

OUTPUT_STREAM = sys.stderr

if not IS_MCP_MODE:
    print('\n' + '=' * 70, file=OUTPUT_STREAM)
    print('Usage Documentation: development-guides\\PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md', file=OUTPUT_STREAM)
    print('=' * 70, file=OUTPUT_STREAM)
    print('The following output is debug/test information:', file=OUTPUT_STREAM)
    print('=' * 70 + '\n', file=OUTPUT_STREAM)

from pathlib import Path

# __file__ is core_node/pymain.py => parent is core_node root
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore.pyfoundations.app_launcher import AppLauncher

if __name__ == '__main__':
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
    except KeyboardInterrupt:
        print('\nInterrupted by user', file=OUTPUT_STREAM)
        sys.exit(0)
    except Exception as e:
        print(f'\n{"=" * 70}', file=OUTPUT_STREAM)
        print(f'Unexpected error: {e}', file=OUTPUT_STREAM)
        print('=' * 70, file=OUTPUT_STREAM)

        import traceback
        traceback.print_exc(file=OUTPUT_STREAM)
