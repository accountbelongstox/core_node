#!/usr/bin/env python3
"""
Modern Flutter Bloom Build System
A refactored, modern implementation of the Flutter build system that maintains all existing logic
while providing better organization, error handling, and maintainability.
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
from dataclasses import dataclass
from enum import Enum

# Import using relative path from build_scripts root
from shared.data_exchange.unified_variable_system import unified_vars
from shared.directory_manager import DirectoryManager
from utils.file_operations import FileOperations
from utils.factory_analyzer import FactoryAnalyzer
from utils.menu_helper import MenuHelper
from utils.print_helper import PrintHelper
from controllers.step1_project_copy_controller import Step1ProjectCopyController
from controllers.step2_asset_controller import Step2AssetController
from controllers.step3_platform_controller import Step3PlatformController
from controllers.step4_image_replacement_controller import Step4ImageReplacementController
from controllers.step5_multiplatform_controller import Step5MultiPlatformController
from controllers.step8_pubspec_controller import Step8PubspecController
from controllers.step19_view_effects_controller import Step19ViewEffectsController
from controllers.step7_android_config_controller import Step7AndroidConfigController
from controllers.step20_compilation_controller import Step20CompilationController


class BuildMode(Enum):
    """Build execution modes"""
    PROJECT_COPY = "project_copy"      # Running from project directory, need to copy first
    TEMP_BUILD = "temp_build"          # Running from temp directory, execute build steps
    UNKNOWN = "unknown"


class BuildPhase(Enum):
    """Build phases in execution order"""
    INITIALIZATION = "initialization"
    PROJECT_COPY = "project_copy"
    ASSET_PROCESSING = "asset_processing"
    PLATFORM_SCANNING = "platform_scanning"
    IMAGE_REPLACEMENT = "image_replacement"
    MULTIPLATFORM_REPLACEMENT = "multiplatform_replacement"
    VIEW_EFFECTS = "view_effects"
    ANDROID_CONFIG = "android_config"
    COMPILATION = "compilation"
    COMPLETION = "completion"


@dataclass
class BuildContext:
    """Build context containing all build-related information"""
    mode: BuildMode
    current_dir: Path
    temp_build_root: Optional[Path] = None
    app_name: Optional[str] = None
    flutter_project_root: Optional[Path] = None
    compilation_option: str = "debug"
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None


@dataclass
class StepResult:
    """Result of a build step execution"""
    step_name: str
    success: bool
    data: Dict[str, Any]
    error: Optional[str] = None
    execution_time: Optional[float] = None


class ModernFlutterBuildSystem:
    """
    Modern Flutter Bloom Build System

    This is a refactored version of the original FlutterBloomBuildSystem that:
    - Maintains all existing logic and functionality
    - Provides cleaner architecture with clear separation of concerns
    - Implements better error handling and logging
    - Uses modern Python patterns (dataclasses, enums, type hints)
    - Offers improved maintainability and extensibility
    """

    def __init__(self):
        """Initialize the modern build system"""
        # Core components
        self.dir_manager = DirectoryManager()
        self.file_operations = FileOperations()
        self.factory_analyzer = FactoryAnalyzer()
        self.menu_helper: Optional[MenuHelper] = None
        # Compilation menu is now handled by step1 and menu_helper

        # Build context
        self.context = BuildContext(
            mode=BuildMode.UNKNOWN,
            current_dir=Path.cwd()
        )

        # Step controllers
        self.controllers = {
            'step1': Step1ProjectCopyController(),
            'step2': Step2AssetController(),
            'step3': Step3PlatformController(),
            'step4': Step4ImageReplacementController(),
            'step5': Step5MultiPlatformController(),
            'step8': Step8PubspecController(),
            'step19': Step19ViewEffectsController(),
            'step7': Step7AndroidConfigController(),
            'step20': Step20CompilationController()
        }

        # Execution results
        self.step_results: Dict[str, StepResult] = {}
        self.build_successful = False

        # Setup factory analyzer
        self.dir_manager.set_factory_analyzer(self.factory_analyzer)

        PrintHelper.info("Modern Flutter Build System initialized", source="BUILD-SYSTEM")

    def initialize(self) -> bool:
        """Initialize the build system and determine execution mode"""
        self.context.start_time = datetime.now()

        # Initialize components
        self.menu_helper = MenuHelper(self.context.current_dir)
        # Compilation selection is now handled in step1 via menu_helper

        # Determine build mode
        self.context.mode = self._determine_build_mode()

        # Initialize unified variable system
        unified_vars.temp_dir = self.context.current_dir

        PrintHelper.info(f"Build mode determined: {self.context.mode.value}", source="BUILD-SYSTEM")
        PrintHelper.info(f"Current directory: {self.context.current_dir}", source="BUILD-SYSTEM")

        return True

    def run(self) -> Dict[str, Any]:
        """
        Main entry point for the build system
        Maintains compatibility with the original run() method
        """
        PrintHelper.info("Flutter Bloom Build System - Modern Implementation", source="BUILD-SYSTEM")
        PrintHelper.info("=" * 70, source="BUILD-SYSTEM")

        # Initialize system
        if not self.initialize():
            return self._create_error_result("Initialization failed")

        # Execute based on build mode
        if self.context.mode == BuildMode.PROJECT_COPY:
            result = self._execute_project_copy_mode()
        elif self.context.mode == BuildMode.TEMP_BUILD:
            result = self._execute_temp_build_mode()
        else:
            result = self._create_error_result("Unknown build mode")

        self.context.end_time = datetime.now()
        return result

    def _determine_build_mode(self) -> BuildMode:
        """Determine the build mode based on current directory context"""
        # Update directory manager status
        self.dir_manager.print_status()

        if self.dir_manager.is_in_temp:
            PrintHelper.info("Running in temporary directory - executing build steps", source="BUILD-SYSTEM")
            return BuildMode.TEMP_BUILD
        else:
            PrintHelper.info("Running in project directory - will copy to temp first", source="BUILD-SYSTEM")
            return BuildMode.PROJECT_COPY

    def _execute_project_copy_mode(self) -> Dict[str, Any]:
    
        PrintHelper.info("Executing project copy mode", source="BUILD-SYSTEM")

        # Phase 1: Project Copy
        copy_result = self._execute_phase_project_copy()
        if not copy_result.success:
            return self._create_error_result(copy_result.error)

        # Switch to temp directory
        target_dir = Path(copy_result.data.get('target_directory', ''))
        if not self._switch_to_temp_directory(target_dir):
            return self._create_error_result('Failed to switch to temp directory')

        # Update context
        self.context.temp_build_root = target_dir
        self.context.mode = BuildMode.TEMP_BUILD

        # Continue with temp build mode
        return self._execute_temp_build_mode()
    
    def _execute_temp_build_mode(self) -> Dict[str, Any]:
        """Execute build when running from temp directory (legacy _is_tmp_build logic)"""
        PrintHelper.info("Executing temp build mode", source="BUILD-SYSTEM")

        # Initialize if not already done
        if not self.context.temp_build_root:
            self.context.temp_build_root = self.context.current_dir

        # Phase 2-7: Asset and Platform Steps
        build_result = self._execute_asset_and_platform_phases()
        if not build_result['success']:
            return build_result

        # Mark build as successful
        self.build_successful = True

        # Create final result
        return self._create_success_result(build_result)

    def _execute_phase_project_copy(self) -> StepResult:
        """Execute Phase 1: Project Copy (legacy _run_project_copy_step logic)"""
        phase_start = datetime.now()

        PrintHelper.info("Phase 1: Project Copy", source="BUILD-SYSTEM")

        # Debug: Show all available variables first
        PrintHelper.info("[DEBUG] Checking unified_vars for app selection...", source="BUILD-SYSTEM")

        # Check gvar_exchange_dir path and contents
        PrintHelper.info(f"[DEBUG] gvar_exchange_dir = {unified_vars.gvar_exchange_dir}", source="BUILD-SYSTEM")
        PrintHelper.info(f"[DEBUG] gvar_exchange_dir exists? {unified_vars.gvar_exchange_dir.exists()}", source="BUILD-SYSTEM")

        if unified_vars.gvar_exchange_dir.exists():
            PrintHelper.info("[DEBUG] Files in gvar_exchange_dir:", source="BUILD-SYSTEM")
            for file_path in unified_vars.gvar_exchange_dir.iterdir():
                try:
                    content = file_path.read_text(encoding='utf-8').strip()
                    PrintHelper.info(f"[DEBUG]   {file_path.name} = '{content}'", source="BUILD-SYSTEM")
                except Exception as e:
                    PrintHelper.info(f"[DEBUG]   {file_path.name} = <error reading: {e}>", source="BUILD-SYSTEM")

        app_name_value = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_APP_NAME, "")
        compilation_option = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_COMPILATION_OPTION, "")

        # Also check for alternative variable names that might be used
        alt_app_name = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_APP, "")

        PrintHelper.info(f"[DEBUG] KEY_SELECTED_APP_NAME = '{app_name_value}'", source="BUILD-SYSTEM")
        PrintHelper.info(f"[DEBUG] KEY_SELECTED_APP = '{alt_app_name}'", source="BUILD-SYSTEM")
        PrintHelper.info(f"[DEBUG] KEY_SELECTED_COMPILATION_OPTION = '{compilation_option}'", source="BUILD-SYSTEM")

        # Get build information from unified variables
        # Try KEY_SELECTED_APP_NAME first (alias for KEY_APP_NAME), then fall back to alternatives
        self.context.app_name = app_name_value
        if not self.context.app_name:
            self.context.app_name = alt_app_name  # Try KEY_SELECTED_APP as fallback

        if not self.context.app_name:
            PrintHelper.error("[DEBUG] No app selected - All app name variables are empty!", source="BUILD-SYSTEM")
            PrintHelper.error(f"[DEBUG] Checked: KEY_SELECTED_APP_NAME='{app_name_value}', KEY_SELECTED_APP='{alt_app_name}'", source="BUILD-SYSTEM")
            return StepResult("project_copy", False, {}, "No app selected")

        # Determine Flutter project root
        self.context.flutter_project_root = self._determine_flutter_project_root()

        # Execute Step 1
        step1_result = self._execute_step('step1',
                                        self.context.flutter_project_root,
                                        self.context.app_name)

        if step1_result.success:
            execution_time = (datetime.now() - phase_start).total_seconds()
            return StepResult("project_copy", True, step1_result.data,
                            execution_time=execution_time)
        else:
            return step1_result

    def _execute_asset_and_platform_phases(self) -> Dict[str, Any]:
        """Execute Phases 2-8: All asset and platform processing (legacy _run_asset_and_platform_steps logic)"""
        PrintHelper.info("Executing asset and platform phases", source="BUILD-SYSTEM")

        # Get context information
        compilation_option = unified_vars.get_file_variable(unified_vars.KEY_SELECTED_COMPILATION_OPTION, "debug")
        self.context.compilation_option = compilation_option

        # Determine app name if not available
        if not self.context.app_name:
            self.context.app_name = self._determine_app_name_from_directory()

        PrintHelper.info(f"App name: {self.context.app_name}", source="BUILD-SYSTEM")
        PrintHelper.info(f"Compilation option: {compilation_option}", source="BUILD-SYSTEM")

        # Phase 2: Asset Processing
        step2_result = self._execute_step('step2', self.context.temp_build_root, self.context.app_name)
        if not step2_result.success:
            return self._create_error_result(step2_result.error)

        selected_images = step2_result.data.get('selected_images', {})

        # Phase 3: Platform Scanning
        step3_result = self._execute_step('step3', self.context.temp_build_root, selected_images)
        if not step3_result.success:
            return self._create_error_result(step3_result.error)

        # Phase 4: Image Replacement
        step4_result = self._execute_step('step4', self.context.temp_build_root, selected_images)
        if not step4_result.success:
            return self._create_error_result(step4_result.error)

        # Phase 5: Multi-Platform Replacement
        step5_result = self._execute_step('step5', self.context.temp_build_root, self.context.app_name)
        if not step5_result.success:
            return self._create_error_result(step5_result.error)

        # Phase 7: Android Configuration
        step7_result = self._execute_step('step7', self.context.temp_build_root, self.context.app_name)
        if not step7_result.success:
            return self._create_error_result(step7_result.error)

        # Phase 8: Pubspec Asset Management
        step8_result = self._execute_step('step8', self.context.temp_build_root, self.context.app_name)
        if not step8_result.success:
            return self._create_error_result(step8_result.error)

        # Phase 19: View Replacement Effects
        step19_result = self._execute_step('step19', self.context.temp_build_root, self.context.app_name)
        if not step19_result.success:
            return self._create_error_result(step19_result.error)

        # Phase 20: Final Compilation Preparation
        step20_result = self._execute_step('step20', self.context.temp_build_root, self.context.app_name)
        if not step20_result.success:
            return self._create_error_result(step20_result.error)

        # Transfer compilation control to external trigger
        print("\n" + "="*60)
        print("BUILD SYSTEM COMPLETED - TRANSFERRING TO COMPILATION TRIGGER")
        print("="*60)
        print("Build preparation completed successfully.")
        print("Compilation will be handled by external PowerShell trigger.")
        print("="*60)

        return {
            'success': True,
            'step2_result': step2_result.data,
            'step3_result': step3_result.data,
            'step4_result': step4_result.data,
            'step5_result': step5_result.data,
            'step8_result': step8_result.data,
            'step19_result': step19_result.data,
            'step7_result': step7_result.data,
            'compilation_option': compilation_option,
            'context': {
                'app_name': self.context.app_name,
                'temp_build_root': str(self.context.temp_build_root),
                'execution_time': self._get_total_execution_time()
            }
        }

    def _execute_step(self, step_key: str, *args) -> StepResult:
        """Execute a build step with standardized error handling and logging"""
        step_start = datetime.now()
        controller = self.controllers.get(step_key)

        if not controller:
            return StepResult(step_key, False, {}, f"Controller for {step_key} not found")

        try:
            step_name = step_key.upper()
            PrintHelper.info(f"Executing {step_name}", source="BUILD-SYSTEM")

            # Initialize controller if it has initialize method
            if hasattr(controller, 'initialize'):
                if len(args) >= 2:
                    if not controller.initialize(args[0], args[1]):
                        return StepResult(step_key, False, {}, f"{step_name} controller initialization failed")

            # Execute step based on type
            result = None
            if step_key == 'step1':
                # Step1 doesn't have initialize, pass params directly
                result = controller.execute_step1(args[0], args[1], self.menu_helper)
            elif step_key == 'step2':
                # Step2 doesn't have initialize, pass params directly
                result = controller.execute_step2(args[0], args[1], self.menu_helper)
            elif step_key == 'step3':
                # Step3 has initialize, call without additional params
                result = controller.execute_step3_scanning()
            elif step_key == 'step4':
                # Step4 has initialize, call without additional params
                result = controller.execute_step4_replacement()
            elif step_key == 'step5':
                # Step5 has initialize, call without additional params
                result = controller.execute_step5_multiplatform_replacement()
            elif step_key == 'step8':
                # Step8 has execute method, pass build parameters
                result = controller.execute(temp_build_root=args[0], app_name=args[1])
            elif step_key == 'step19':
                # Step19 has initialize, call without additional params
                result = controller.execute_step19_view_effects()
            elif step_key == 'step7':
                # Step7 has execute method, pass build parameters
                result = controller.execute(temp_build_root=args[0], app_name=args[1])
            elif step_key == 'step20':
                # Step20 has execute method, pass build parameters
                result = controller.execute(temp_build_root=args[0], app_name=args[1])

            # Calculate execution time
            execution_time = (datetime.now() - step_start).total_seconds()

            if result and result.get('success'):
                PrintHelper.success(f"{step_name} completed successfully", source="BUILD-SYSTEM")

                # Print step summary if available
                if hasattr(controller, f'print_{step_key}_summary'):
                    getattr(controller, f'print_{step_key}_summary')()

                step_result = StepResult(step_key, True, result, execution_time=execution_time)
                self.step_results[step_key] = step_result
                return step_result
            else:
                error = result.get('error', f'{step_name} execution failed') if result else f'{step_name} returned no result'
                PrintHelper.error(f"{step_name} failed: {error}", source="BUILD-SYSTEM")
                step_result = StepResult(step_key, False, result or {}, error, execution_time)
                self.step_results[step_key] = step_result
                return step_result

        except Exception as e:
            execution_time = (datetime.now() - step_start).total_seconds()
            error_msg = f"{step_key.upper()} execution exception: {e}"
            PrintHelper.error(error_msg, source="BUILD-SYSTEM")
            step_result = StepResult(step_key, False, {}, error_msg, execution_time)
            self.step_results[step_key] = step_result
            return step_result

    def _execute_compilation_phase(self, compilation_option: str, selected_images: Dict[str, Any]):
        """Execute Phase 7: Compilation (legacy _run_compilation logic)"""
        try:
            PrintHelper.info("Phase 7: Compilation", source="BUILD-SYSTEM")

            # Save compression mode information for next step usage
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
            cache_dir = self.context.temp_build_root / ".cache"
            cache_dir.mkdir(exist_ok=True)

            compression_file = cache_dir / "image_compression_settings.txt"
            with open(compression_file, 'w', encoding='utf-8') as f:
                for image_type, info in compression_info.items():
                    f.write(f"{image_type}|{info['path']}|{info['name']}|{info['compression_mode']}|{info['source']}\n")

            PrintHelper.success(f"Compression settings saved to: {compression_file}", source="BUILD-SYSTEM")

        except Exception as e:
            PrintHelper.error(f"Compilation phase failed: {e}", source="BUILD-SYSTEM")

    def _determine_flutter_project_root(self) -> Path:
        """Determine Flutter project root directory"""
        # Use existing logic from original implementation
        current_dir = Path.cwd()

        # Look for pubspec.yaml to confirm Flutter project
        if (current_dir / "pubspec.yaml").exists():
            return current_dir

        # If not found, use current directory as fallback
        PrintHelper.warning("pubspec.yaml not found, using current directory as Flutter root", source="BUILD-SYSTEM")
        return current_dir

    def _determine_app_name_from_directory(self) -> str:
        """Determine app name from directory structure"""
        dir_parts = str(self.context.temp_build_root).split("_")
        if len(dir_parts) >= 2 and dir_parts[-2].startswith("app"):
            return dir_parts[-2]
        return "app_bank"  # fallback

    def _switch_to_temp_directory(self, target_dir: Path) -> bool:
        """Switch to temporary directory"""
        return self.dir_manager.switch_to_temp_dir(target_dir)

    def _get_total_execution_time(self) -> Optional[float]:
        """Get total execution time in seconds"""
        if self.context.start_time and self.context.end_time:
            return (self.context.end_time - self.context.start_time).total_seconds()
        return None

    def _create_success_result(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a standardized success result"""
        return {
            'success': True,
            'build_mode': self.context.mode.value,
            'app_name': self.context.app_name,
            'temp_build_root': str(self.context.temp_build_root) if self.context.temp_build_root else '',
            'execution_time': self._get_total_execution_time(),
            'step_results': {k: {'success': v.success, 'execution_time': v.execution_time}
                           for k, v in self.step_results.items()},
            **data
        }

    def _create_error_result(self, error: str) -> Dict[str, Any]:
        """Create a standardized error result"""
        return {
            'success': False,
            'error': error,
            'build_mode': self.context.mode.value if self.context.mode != BuildMode.UNKNOWN else 'unknown',
            'app_name': self.context.app_name,
            'temp_build_root': str(self.context.temp_build_root) if self.context.temp_build_root else '',
            'execution_time': self._get_total_execution_time(),
            'step_results': {k: {'success': v.success, 'error': v.error, 'execution_time': v.execution_time}
                           for k, v in self.step_results.items()}
        }

    def get_build_context(self) -> BuildContext:
        """Get current build context"""
        return self.context

    def get_step_results(self) -> Dict[str, StepResult]:
        """Get all step execution results"""
        return self.step_results.copy()

    def print_build_summary(self):
        """Print comprehensive build summary"""
        try:
            PrintHelper.info("\n" + "=" * 70, source="BUILD-SYSTEM")
            PrintHelper.info("BUILD SUMMARY", source="BUILD-SYSTEM")
            PrintHelper.info("=" * 70, source="BUILD-SYSTEM")

            # Build status
            status = "SUCCESS" if self.build_successful else "FAILED"
            PrintHelper.info(f"Status: {status}", source="BUILD-SYSTEM")
            PrintHelper.info(f"Mode: {self.context.mode.value}", source="BUILD-SYSTEM")
            PrintHelper.info(f"App: {self.context.app_name}", source="BUILD-SYSTEM")

            # Timing
            if self.context.start_time:
                PrintHelper.info(f"Start Time: {self.context.start_time.strftime('%H:%M:%S')}", source="BUILD-SYSTEM")
            if self.context.end_time:
                PrintHelper.info(f"End Time: {self.context.end_time.strftime('%H:%M:%S')}", source="BUILD-SYSTEM")

            total_time = self._get_total_execution_time()
            if total_time:
                PrintHelper.info(f"Total Time: {total_time:.2f} seconds", source="BUILD-SYSTEM")

            # Step results
            PrintHelper.info(f"\nStep Results:", source="BUILD-SYSTEM")
            for step_key, result in self.step_results.items():
                status_icon = "✓" if result.success else "✗"
                time_info = f" ({result.execution_time:.2f}s)" if result.execution_time else ""
                PrintHelper.info(f"  {status_icon} {step_key.upper()}{time_info}", source="BUILD-SYSTEM")
                if not result.success and result.error:
                    PrintHelper.info(f"    Error: {result.error}", source="BUILD-SYSTEM")

            PrintHelper.info("=" * 70, source="BUILD-SYSTEM")

        except Exception as e:
            PrintHelper.error(f"Failed to print build summary: {e}", source="BUILD-SYSTEM")


# Compatibility alias - maintain backward compatibility
FlutterBloomBuildSystem = ModernFlutterBuildSystem


def main():
    """Main function for testing the modern build system"""
    build_system = ModernFlutterBuildSystem()
    result = build_system.run()
    build_system.print_build_summary()

    return result


if __name__ == "__main__":
    main()