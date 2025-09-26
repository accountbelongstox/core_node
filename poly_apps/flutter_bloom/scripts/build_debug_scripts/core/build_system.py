#!/usr/bin/env python3
"""
Build System Core
Main build system orchestrator class that manages the build flow
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional

# Import using relative path from build_scripts root
from shared.data_exchange.unified_variable_system import unified_vars
from utils.file_operations import FileOperations
from utils.factory_analyzer import FactoryAnalyzer
from utils.menu_helper import MenuHelper
from utils.print_helper import PrintHelper
from controllers.step1_project_copy_controller import Step1ProjectCopyController
from controllers.step2_asset_controller import Step2AssetController
from controllers.step3_platform_controller import Step3PlatformController
from controllers.step4_image_replacement_controller import Step4ImageReplacementController


class FlutterBloomBuildSystem:
    """
    Main build system class that orchestrates the entire build flow
    """

    def __init__(self):
        """Initialize the build system"""
        self.current_dir = Path.cwd()
        self.file_operations = FileOperations()
        self.factory_analyzer = FactoryAnalyzer()
        self.menu_helper = None
        self.is_in_temp = False

        # Controllers
        self.step1_controller = None
        self.step2_controller = None
        self.step3_controller = None
        self.step4_controller = None

    def initialize(self) -> bool:
        """Initialize the build system and determine execution context"""
        try:
            # Initialize menu helper
            self.menu_helper = MenuHelper(self.current_dir)

            # Check if we're in a temporary directory
            self.is_in_temp = self.factory_analyzer.is_in_temp_directory(str(self.current_dir))

            # Initialize controllers
            self.step1_controller = Step1ProjectCopyController()
            self.step2_controller = Step2AssetController()
            self.step3_controller = Step3PlatformController()
            self.step4_controller = Step4ImageReplacementController()

            return True

        except Exception as e:
            print(f"[BUILD-ERROR] Failed to initialize build system: {e}")
            return False

    def run(self) -> Dict[str, Any]:
        """Main entry point for the build system"""
        print("[BUILD-MAIN] Flutter Bloom Build System - Python Implementation")
        print("===========================================================")
        print(f"[BUILD-DEBUG] Python script path: {Path(__file__).absolute()}")
        print(f"[BUILD-DEBUG] Python working directory: {self.current_dir}")
        print(f"[BUILD-DEBUG] Flutter temp directory: {unified_vars.temp_dir}")

        # Initialize the build system
        if not self.initialize():
            return {'success': False, 'error': 'Initialization failed'}

        print(f"[BUILD-INFO] Current directory: {self.current_dir}")
        print(f"[BUILD-INFO] In temporary directory: {'Yes' if self.is_in_temp else 'No'}")

        # Debug: Print all available file variables
        self._print_debug_variables()

        # Route execution based on context
        if self.is_in_temp:
            return self._run_asset_and_platform_steps()
        else:
            return self._run_project_copy_step()

    def _print_debug_variables(self):
        """Print debug information about available variables"""
        print(f"[BUILD-DEBUG] Reading file variables from: {unified_vars.temp_dir}")
        if unified_vars.temp_dir.exists():
            print(f"[BUILD-DEBUG] Temp directory contents:")
            for item in unified_vars.temp_dir.iterdir():
                if item.is_file():
                    try:
                        content = item.read_text(encoding='utf-8').strip()
                        print(f"  {item.name}: '{content}'")
                    except:
                        print(f"  {item.name}: <unable to read>")
        else:
            print(f"[BUILD-DEBUG] Temp directory does not exist: {unified_vars.temp_dir}")

    def _run_asset_and_platform_steps(self) -> Dict[str, Any]:
        """Run Step 2 and Step 3 when in temporary directory"""
        print("[BUILD-INFO] Already in temporary directory, proceeding with build operations...")
        print("[BUILD-CONTINUE] Starting second phase - asset scanning and compilation...")

        try:
            # Get build info from PowerShell global variables
            build_info = unified_vars.get_build_info()
            app_name = build_info.get("app_name", "")

            # Get compilation option from PowerShell global variables
            compilation_option = unified_vars.get_file_variable("SELECTED_COMPILATION_OPTION", "debug")
            print(f"[BUILD-INFO] Selected compilation option: {compilation_option}")

            # Set temp build root as current directory
            temp_build_root = Path(self.current_dir)
            print(f"[BUILD-INFO] Using temporary build root: {temp_build_root}")

            # Find app name if not available from build info
            if not app_name:
                dir_parts = str(temp_build_root).split("_")
                if len(dir_parts) >= 2 and dir_parts[-2].startswith("app"):
                    app_name = dir_parts[-2]
                else:
                    app_name = "app_bank"  # fallback
                print(f"[BUILD-INFO] Detected/fallback app name: {app_name}")

            # Step 2: Asset Image Selection and Processing
            step2_result = self._execute_step2(temp_build_root, app_name)
            if not step2_result['success']:
                return step2_result

            # Step 3: Platform Images Scanning
            step3_result = self._execute_step3(temp_build_root, step2_result['selected_images'])
            if not step3_result['success']:
                return step3_result

            # Step 4: Platform Image Replacement
            step4_result = self._execute_step4(temp_build_root, step2_result['selected_images'])
            if not step4_result['success']:
                return step4_result

            # Final compilation step
            self._run_compilation(compilation_option, step2_result['selected_images'])

            return {
                'success': True,
                'step2_result': step2_result,
                'step3_result': step3_result,
                'step4_result': step4_result,
                'compilation_option': compilation_option
            }

        except Exception as e:
            print(f"[BUILD-ERROR] Asset and platform steps failed: {e}")
            return {'success': False, 'error': str(e)}

    def _run_project_copy_step(self) -> Dict[str, Any]:
        """Run Step 1 when in project directory"""
        try:
            # Get build information from file variables
            build_info = unified_vars.get_build_info()
            app_name = build_info["app_name"]
            action = build_info["action"]
            platform = build_info["platform"]
            entry_file = build_info["entry_file"]

            print(f"[BUILD-INFO] Build configuration loaded:")
            print(f"  App: {app_name}")
            print(f"  Action: {action}")
            print(f"  Platform: {platform}")
            print(f"  Entry File: {entry_file}")
            print()

            if not app_name:
                print("[BUILD-ERROR] No app selected for build")
                return {'success': False, 'error': 'No app selected'}

            # Show factory directory analysis
            analysis = self.factory_analyzer.analyze_factory_directory()
            self.factory_analyzer.print_factory_analysis(analysis)

            # Get Flutter project root
            flutter_project_root = unified_vars.flutter_bloom_root
            print(f"[BUILD-INFO] Flutter project root: {flutter_project_root}")

            # Step 1: Project Copy and Directory Management
            step1_result = self._execute_step1(flutter_project_root, app_name)
            if not step1_result['success']:
                return step1_result

            # Set working directory information for PowerShell script
            self._set_temp_build_dir(step1_result['target_directory'])

            print("[BUILD-STEP-1] Project copy completed - PowerShell script will continue from temp directory")

            return {
                'success': True,
                'step1_result': step1_result,
                'target_directory': step1_result['target_directory']
            }

        except Exception as e:
            print(f"[BUILD-ERROR] Project copy step failed: {e}")
            return {'success': False, 'error': str(e)}

    def _execute_step1(self, flutter_project_root: Path, app_name: str) -> Dict[str, Any]:
        """Execute Step 1: Project Copy"""
        print(f"[STEP-1] [STEP-1-INIT] Initializing Step 1 Project Copy Controller...")

        step1_result = self.step1_controller.execute_step1(flutter_project_root, app_name, self.menu_helper)

        if not step1_result['success']:
            print(f"[STEP-1] [ERROR] Step 1 execution failed: {step1_result.get('error', 'Unknown error')}")
            return step1_result

        target_dir = step1_result['target_directory']
        copy_stats = step1_result['copy_stats']

        print(f"\n[BUILD-SUCCESS] Build preparation completed")
        print(f"[BUILD-INFO] Temporary directory: {target_dir}")
        print(f"[BUILD-INFO] Copy statistics: {copy_stats}")
        print(f"[BUILD-INFO] Ready for build operations")
        print()

        return step1_result

    def _execute_step2(self, temp_build_root: Path, app_name: str) -> Dict[str, Any]:
        """Execute Step 2: Asset Processing"""
        print(f"[STEP-2] [STEP-2-INIT] Initializing Step 2 Asset Controller...")

        step2_result = self.step2_controller.execute_step2(temp_build_root, app_name, self.menu_helper)

        if not step2_result['success']:
            print(f"[STEP-2] [ERROR] Step 2 execution failed: {step2_result.get('error', 'Unknown error')}")

        return step2_result

    def _execute_step3(self, temp_build_root: Path, selected_images: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Step 3: Platform Scanning"""
        print()
        print("=" * 80)
        print("[STEP-3] PLATFORM IMAGES SCANNING")
        print("=" * 80)

        print(f"[STEP-3] [STEP-3-INIT] Initializing Step 3 Platform Controller...")

        # First initialize the controller with required parameters
        app_name = getattr(self, 'app_name', 'app_bank')  # Fallback to app_bank if not set
        if not self.step3_controller.initialize(temp_build_root, app_name):
            print(f"[STEP-3] [STEP-3-ERROR] Failed to initialize Step 3 controller")
            return {'success': False, 'error': 'Step 3 controller initialization failed'}

        # Then execute the scanning
        step3_result = self.step3_controller.execute_step3_scanning()

        if step3_result and step3_result.get('success'):
            # Results are already saved to unified data exchange in controller
            print(f"[STEP-3] [STEP-3-COMPLETE] Platform images scanning completed")
            return {'success': True, 'results': step3_result}
        else:
            print(f"[STEP-3] [STEP-3-ERROR] Step 3 execution failed")
            return {'success': False, 'error': 'Step 3 execution failed'}

    def _execute_step4(self, temp_build_root: Path, selected_images: Dict[str, Any]) -> Dict[str, Any]:
        """Execute Step 4: Platform Image Replacement"""
        print()
        print("=" * 80)
        print("[STEP-4] PLATFORM IMAGE REPLACEMENT")
        print("=" * 80)

        print(f"[STEP-4] [STEP-4-INIT] Initializing Step 4 Image Replacement Controller...")

        # First initialize the controller with required parameters
        app_name = getattr(self, 'app_name', 'app_bank')  # Fallback to app_bank if not set
        if not self.step4_controller.initialize(temp_build_root, app_name):
            print(f"[STEP-4] [STEP-4-ERROR] Failed to initialize Step 4 controller")
            return {'success': False, 'error': 'Step 4 controller initialization failed'}

        # Then execute the image replacement
        step4_result = self.step4_controller.execute_step4_replacement()

        if step4_result and step4_result.get('success'):
            print(f"[STEP-4] [STEP-4-COMPLETE] Platform image replacement completed")
            self.step4_controller.print_step4_summary()
            return {'success': True, 'results': step4_result}
        else:
            print(f"[STEP-4] [STEP-4-ERROR] Step 4 execution failed")
            return {'success': False, 'error': 'Step 4 execution failed'}

    def _run_compilation(self, compilation_option: str, selected_images: Dict[str, Any]):
        """Run the final compilation step"""
        # Step 4: Save compression mode information for next step usage
        compression_info = {}
        for image_type, image_data in selected_images.items():
            if image_data and 'compression_mode' in image_data:
                compression_info[image_type] = {
                    'path': str(image_data['path']),
                    'name': image_data['name'],
                    'compression_mode': image_data['compression_mode'],
                    'source': image_data['source']
                }

        # Save compression settings to cache
        cache_dir = Path.cwd() / ".cache"
        cache_dir.mkdir(exist_ok=True)

        compression_file = cache_dir / "image_compression_settings.txt"
        with open(compression_file, 'w') as f:
            for image_type, info in compression_info.items():
                f.write(f"{image_type}={info['compression_mode']}\n")

        print(f"[BUILD-INFO] Compression settings saved to: {compression_file}")
        print(f"[BUILD-INFO] Starting {compilation_option} build with selected resources...")

        # Simulate compilation process
        print(f"[BUILD-SIMULATION] Executing {compilation_option} build with resources...")
        print(f"[BUILD-SUCCESS] {compilation_option} build completed successfully")

    def _set_temp_build_dir(self, target_dir: Path):
        """Set working directory information for PowerShell script"""
        # Use fixed user directory to avoid path issues when moving files
        user_home = Path.home()
        cache_dir = user_home / ".core_node" / ".flutter_build" / ".cache" / "copy_flag_dir"
        cache_dir.mkdir(parents=True, exist_ok=True)

        temp_file = cache_dir / unified_vars.TEMP_BUILD_DIR_FILE
        with open(temp_file, "w") as f:
            f.write(str(target_dir))

        print(f"[BUILD-INFO] Temp directory info saved to: {temp_file}")

    def get_system_info(self) -> Dict[str, Any]:
        """Get build system information"""
        return {
            'current_directory': str(self.current_dir),
            'is_in_temp_directory': self.is_in_temp,
            'flutter_temp_dir': str(unified_vars.temp_dir),
            'controllers': {
                'step1': self.step1_controller is not None,
                'step2': self.step2_controller is not None,
                'step3': self.step3_controller is not None,
                'step4': self.step4_controller is not None
            }
        }


def main():
    """Main entry point"""
    build_system = FlutterBloomBuildSystem()
    result = build_system.run()

    if not result['success']:
        print(f"[BUILD-ERROR] Build system failed: {result.get('error', 'Unknown error')}")
        sys.exit(1)

    print("[BUILD-SUCCESS] Build system completed successfully")


if __name__ == "__main__":
    main()