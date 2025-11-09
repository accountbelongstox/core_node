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
    # Usage documentation notice
    print('\n' + '=' * 70)
    print('Usage Documentation: development-guides\\PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md')
    print('=' * 70)
    print('The following output is debug/test information:')
    print('=' * 70 + '\n')
    
    # Print startup banner immediately
    print('\n' + '=' * 70)
    print('Python Application Launcher - Starting...')
    print('=' * 70)
    print(f'Working Directory: {Path.cwd()}')
    print(f'Project Root: {PROJECT_ROOT}')
    print(f'Command Line Args: {sys.argv}')
    print('=' * 70 + '\n')

    launcher = AppLauncher()

    try:
        success = launcher.start()

        if success:
            print('\n' + '=' * 70)
            print('Application started successfully')
            print('=' * 70 + '\n')
        else:
            print('\n' + '=' * 70)
            print('Application failed to start')
            print('=' * 70 + '\n')

        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        print('\n' + '=' * 70)
        print('Interrupted by user')
        print('=' * 70)
        launcher.stop()
        sys.exit(0)

    except Exception as error:
        print('\n' + '=' * 70)
        print(f'Unexpected error: {error}')
        print('=' * 70)
        import traceback
        traceback.print_exc()
        sys.exit(1)
