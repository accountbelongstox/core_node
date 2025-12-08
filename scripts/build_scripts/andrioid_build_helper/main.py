#!/usr/bin/env python3
"""
Flutter Bloom Build & Debug System - Main Entry Point
Handles both debug routing and build system execution
"""

import sys
import traceback
from pathlib import Path
from typing import Optional

from shared.directory_manager import DirectoryManager
from shared.data_exchange.unified_variable_system import unified_vars
from utils.menu_helper import MenuHelper
from utils.print_helper import PrintHelper
from controllers.step2_asset_controller import Step2AssetController
from controllers.step3_platform_controller import Step3PlatformController
from controllers.step4_image_replacement_controller import Step4ImageReplacementController
# from core.flutter_launcher import FlutterBloomLauncher
# from core.modern_build_system import ModernFlutterBuildSystem


def _infer_app_name(build_root: Path, explicit_name: Optional[str]) -> str:
    """Infer app name from CLI or directory name"""
    if explicit_name:
        return explicit_name

    dir_name = build_root.name
    parts = dir_name.split("_")
    for part in reversed(parts):
        if part.lower().startswith("app"):
            return part
    return dir_name or "app"


def run_image_replacement_only(build_root: Path, app_name: Optional[str] = None) -> int:
    """Execute only the image replacement pipeline for a given build directory"""
    build_root = build_root.resolve()
    if not build_root.exists():
        print(f"[ERROR] Build directory does not exist: {build_root}")
        return 1

    inferred_app_name = _infer_app_name(build_root, app_name)

    # Keep original directory switching behavior
    dir_manager = DirectoryManager()
    dir_manager.switch_to_origin_dir()

    # Set temp_dir so processors and caches write inside the build directory
    unified_vars.temp_dir = build_root

    PrintHelper.header("ANDROID IMAGE REPLACEMENT ONLY MODE", source="ASSET-ONLY")
    PrintHelper.info(f"Build directory: {build_root}", source="ASSET-ONLY")
    PrintHelper.info(f"App name: {inferred_app_name}", source="ASSET-ONLY")

    # Controllers needed for image replacement
    menu_helper = MenuHelper(build_root)
    step2 = Step2AssetController()
    step3 = Step3PlatformController()
    step4 = Step4ImageReplacementController()

    # Initialize Step 3 (scanning targets)
    if not step3.initialize(build_root, inferred_app_name):
        PrintHelper.error("Failed to initialize platform scanning", source="ASSET-ONLY")
        return 1

    # Execute Step 2 to collect and process assets (auto mode skips menus)
    step2_result = step2.execute_step2(build_root, inferred_app_name, menu_helper, auto_mode=True)
    if not step2_result.get("success"):
        PrintHelper.error(step2_result.get("error", "Step 2 failed"), source="ASSET-ONLY")
        return 1

    # Execute Step 3 scanning (reuse existing init)
    step3_result = step3.execute_step3_scanning()
    if not step3_result.get("success"):
        PrintHelper.error(step3_result.get("error", "Step 3 failed"), source="ASSET-ONLY")
        return 1

    # Initialize and execute Step 4 replacement
    if not step4.initialize(build_root, inferred_app_name, auto_mode=True):
        PrintHelper.error("Failed to initialize image replacement", source="ASSET-ONLY")
        return 1

    step4_result = step4.execute_step4_replacement()
    if not step4_result.get("success"):
        PrintHelper.error(step4_result.get("error", "Step 4 failed"), source="ASSET-ONLY")
        return 1

    PrintHelper.success("Image replacement completed", source="ASSET-ONLY")
    return 0


def main():
    """Entry point: run Android image replacement only"""
    if len(sys.argv) < 2:
        print("Usage: python main.py <build_directory> [app_name]")
        sys.exit(1)

    build_dir_arg = Path(sys.argv[1])
    app_name_arg = sys.argv[2] if len(sys.argv) > 2 else None

    exit_code = run_image_replacement_only(build_dir_arg, app_name_arg)
    sys.exit(exit_code)

# Legacy build system entry has been disabled for this helper-only mode
# def main():
#     """Main entry point - handles both debug and build modes"""
#     # Switch to origin directory first
#     dir_manager = DirectoryManager()
#     dir_manager.switch_to_origin_dir()
#
#     launcher = FlutterBloomLauncher()
#     result = launcher.run()
#
#     exit_code = result["exit_code"]
#     mode = result["mode"]
#     selection_data = result["selection_data"]
#
#     # If exit code is not 0, exit immediately
#     if exit_code != 0:
#         sys.exit(exit_code)
#
#     # If mode is design_tool, exit and let PowerShell handle it
#     if mode == "design_tool":
#         print("[INFO] Design tool mode - passing control to PowerShell")
#         sys.exit(0)
#
#     # If mode is build, execute build system
#     # Build system will prepare everything and generate PowerShell scripts
#     # PowerShell will execute the actual Flutter compilation commands
#     if mode == "build":
#         try:
#             print("\n[BUILD] Starting Flutter Bloom Build System...")
#             print("=" * 50)
# 
#             # Run build system from new architecture
#             # This will:
#             # 1. Copy project to temp directory
#             # 2. Process assets and configurations
#             # 3. Generate compilation scripts for PowerShell to execute
#             build_system = ModernFlutterBuildSystem()
#             build_result = build_system.run()
# 
#             if not build_result['success']:
#                 print(f"[BUILD-ERROR] Build system failed: {build_result.get('error', 'Unknown error')}")
#                 sys.exit(1)
# 
#             print("[BUILD-SUCCESS] Build system preparation completed")
#             print("[BUILD-SUCCESS] PowerShell will now execute the compilation scripts")
#             sys.exit(0)
# 
#         except Exception as e:
#             print(f"[BUILD-ERROR] Build system execution failed: {e}")
#             traceback.print_exc()
#             sys.exit(1)
# 
#     # For debug mode or other modes, just exit with the code
#     sys.exit(exit_code)


if __name__ == "__main__":
    main()
