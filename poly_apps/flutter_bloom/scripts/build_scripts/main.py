#!/usr/bin/env python3
"""
Flutter Bloom Build & Debug System - Main Entry Point
Handles both debug routing and build system execution
"""

import sys
import traceback
from core.flutter_launcher import FlutterBloomLauncher
from core.modern_build_system import ModernFlutterBuildSystem
from shared.directory_manager import DirectoryManager


def main():
    """Main entry point - handles both debug and build modes"""
    # Switch to origin directory first
    dir_manager = DirectoryManager()
    dir_manager.switch_to_origin_dir()

    launcher = FlutterBloomLauncher()
    result = launcher.run()

    exit_code = result["exit_code"]
    mode = result["mode"]
    selection_data = result["selection_data"]

    # If exit code is not 0, exit immediately
    if exit_code != 0:
        sys.exit(exit_code)

    # If mode is design_tool, exit and let PowerShell handle it
    if mode == "design_tool":
        print("[INFO] Design tool mode - passing control to PowerShell")
        sys.exit(0)

    # If mode is build, execute build system
    # Build system will prepare everything and generate PowerShell scripts
    # PowerShell will execute the actual Flutter compilation commands
    if mode == "build":
        try:
            print("\n[BUILD] Starting Flutter Bloom Build System...")
            print("=" * 50)

            # Run build system from new architecture
            # This will:
            # 1. Copy project to temp directory
            # 2. Process assets and configurations
            # 3. Generate compilation scripts for PowerShell to execute
            build_system = ModernFlutterBuildSystem()
            build_result = build_system.run()

            if not build_result['success']:
                print(f"[BUILD-ERROR] Build system failed: {build_result.get('error', 'Unknown error')}")
                sys.exit(1)

            print("[BUILD-SUCCESS] Build system preparation completed")
            print("[BUILD-SUCCESS] PowerShell will now execute the compilation scripts")
            sys.exit(0)

        except Exception as e:
            print(f"[BUILD-ERROR] Build system execution failed: {e}")
            traceback.print_exc()
            sys.exit(1)

    # For debug mode or other modes, just exit with the code
    sys.exit(exit_code)


if __name__ == "__main__":
    main()