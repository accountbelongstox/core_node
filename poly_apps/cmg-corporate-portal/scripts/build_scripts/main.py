#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Main Entry Point for Capacitor/Android Build System

This is the main entry point that should be called by external scripts.
It delegates all work to the BuildController class.

Directory Structure:
    build_scripts/
    ├── main.py                     # This file - Entry point
    ├── build_versions_config.json  # Build configuration
    ├── core/                       # Core business logic
    │   ├── __init__.py
    │   └── build_controller.py     # Main controller
    ├── managers/                   # Resource managers
    │   ├── __init__.py
    │   ├── capacitor_resource_manager.py
    │   ├── resource_replacer.py
    │   └── resource_scanner.py
    ├── utils/                      # Utility modules
    │   ├── __init__.py
    │   ├── file_var_system_new.py
    │   ├── init_build_config.py
    │   ├── key_center.py
    │   └── web_preview_server.py
    ├── shell/                      # Shell execution scripts
    │   ├── execute_commands_windows_new.ps1
    │   └── execute_commands_linux_new.sh
    └── docs/                       # Documentation
        ├── PRE_BUILD_CHECKLIST.md
        └── ... (other docs)

Usage:
    python main.py <project_root_path>

Example:
    python main.py D:/programming/core_node/poly_apps/cmg-corporate-portal
"""

import sys
import os
from pathlib import Path

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.build_controller import BuildController


def main():
    """Main entry point"""
    # Check arguments
    if len(sys.argv) < 2:
        print("=" * 60)
        print("Capacitor/Android Build System")
        print("=" * 60)
        print("\nError: Project root path required")
        print("\nUsage:")
        print(f"  python {sys.argv[0]} <project_root_path>")
        print("\nExample:")
        print(f"  python {sys.argv[0]} D:/projects/my-app")
        print("=" * 60)
        sys.exit(1)

    project_root = sys.argv[1]

    # Validate project root exists
    project_path = Path(project_root)
    if not project_path.exists():
        print(f"\nError: Project root does not exist: {project_root}")
        sys.exit(1)

    if not project_path.is_dir():
        print(f"\nError: Project root is not a directory: {project_root}")
        sys.exit(1)

    try:
        # Create controller and run
        print("\n" + "=" * 60)
        print("Capacitor/Android Build System")
        print("=" * 60)
        print(f"\nProject Root: {project_root}")
        print("")

        controller = BuildController(project_root)

        # Show menu and get user action
        action = controller.show_menu()

        if action == "quit":
            print("\nExiting...")
            sys.exit(0)

        if action == "invalid":
            print("\nInvalid option selected")
            sys.exit(1)

        # Execute action based on user selection
        if action == "install_capacitor":
            controller.prepare_capacitor_install()
        elif action == "dev_server":
            controller.prepare_dev_server()
        elif action == "build_web":
            controller.prepare_web_build()
        elif action == "build_android":
            controller.prepare_android_build()
        else:
            print(f"\nUnknown action: {action}")
            sys.exit(1)

        print("\n" + "=" * 60)
        print("Python preprocessing completed successfully")
        print("=" * 60)

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
