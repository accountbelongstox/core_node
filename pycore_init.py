#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pycore Package Initialization Entry Point

This script initializes the pycore package and installs all required dependencies.
It is designed to be called by the ncore_pycore_installer scripts.
This is a wrapper that uses pycore_module_caller.py for actual module loading.

Usage:
    python pycore_init.py
    python pycore_init.py --enable-gpu
    python pycore_init.py --auto-install-gpu
"""

import sys
import argparse
import os
import importlib
import traceback
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

# Import pycore_module_caller infrastructure
import pycore_module_caller

def main():
    """Main entry point for pycore initialization"""

    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Initialize pycore package and dependencies')
    parser.add_argument('--enable-gpu', action='store_true', default=True,
                       help='Enable GPU detection and setup (default: True)')
    parser.add_argument('--auto-install-gpu', action='store_true', default=False,
                       help='Automatically install GPU packages if GPU detected (default: False)')
    parser.add_argument('--no-gpu', action='store_true', default=False,
                       help='Disable GPU detection and setup')
    parser.add_argument('--verbose', action='store_true', default=True,
                       help='Enable verbose output (default: True)')

    args = parser.parse_args()

    # Print initialization banner
    if args.verbose:
        print()
        print('=' * 70)
        print('Pycore Package Initialization')
        print('=' * 70)
        print(f'Project Root: {PROJECT_ROOT}')
        print(f'GPU Setup: {"Enabled" if (args.enable_gpu and not args.no_gpu) else "Disabled"}')
        print(f'Auto Install GPU: {"Yes" if args.auto_install_gpu else "No"}')
        print('=' * 70)
        print()

    try:
        # Import pycore package using pycore_module_caller infrastructure
        # The pycore_module_caller ensures proper path setup
        if args.verbose:
            print('[INFO] Importing pycore package via pycore_module_caller...')

        pycore = importlib.import_module('pycore')

        if args.verbose:
            print('[INFO] Pycore package imported successfully')
            print()

        # Manually call check_and_install_dependencies with parameters
        # This ensures we can control GPU settings via command line
        enable_gpu = args.enable_gpu and not args.no_gpu
        auto_install = args.auto_install_gpu

        if args.verbose:
            print('[INFO] Checking and installing dependencies...')
            print(f'[INFO] GPU Setup: {enable_gpu}')
            print(f'[INFO] Auto Install GPU: {auto_install}')
            print()

        # Call the dependency checker with our settings
        pycore.check_and_install_dependencies(
            enable_gpu_setup=enable_gpu,
            auto_install_gpu=auto_install
        )

        # Print success message
        if args.verbose:
            print()
            print('=' * 70)
            print('Pycore initialization completed successfully!')
            print('=' * 70)

            # Print installed packages info
            installed = pycore.ENCYCLOPEDIA.get("pycore_installed_packages")
            if installed:
                print(f'Installed packages: {len(installed)}')

            # Print GPU info if available
            gpu_info = pycore.get_gpu_info()
            if gpu_info:
                print(f'GPU Detected: {gpu_info.get("gpu_available", False)}')
                if gpu_info.get("gpu_available"):
                    print(f'GPU Name: {gpu_info.get("gpu_name", "Unknown")}')
                    print(f'CUDA Available: {gpu_info.get("cuda_available", False)}')

            print('=' * 70)
            print()

        return 0

    except ImportError as e:
        print()
        print('=' * 70)
        print('[ERROR] Failed to import pycore package')
        print('=' * 70)
        print(f'Error: {e}')
        print()
        print('Make sure pycore is in the correct location:')
        print(f'  Expected: {PROJECT_ROOT / "pycore"}')
        print('=' * 70)
        print()
        return 1

    except Exception as e:
        print()
        print('=' * 70)
        print('[ERROR] Pycore initialization failed')
        print('=' * 70)
        print(f'Error: {e}')
        print()
        traceback.print_exc()
        print('=' * 70)
        print()
        return 1


if __name__ == '__main__':
    sys.exit(main())
