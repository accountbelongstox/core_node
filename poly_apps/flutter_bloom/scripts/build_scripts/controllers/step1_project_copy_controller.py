#!/usr/bin/env python3
"""
Step 1 Project Copy Controller
Orchestrates Flutter project copying and temporary directory management
"""

import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import sys

# Import using relative path from build_scripts root
from shared.data_exchange.unified_variable_system import unified_vars
from utils.file_operations import FileOperations
from utils.factory_analyzer import FactoryAnalyzer

class Step1ProjectCopyController:
    """Controller for Step 1: Project Copy and Directory Management"""

    def __init__(self):
        """Initialize Step 1 Controller"""
        self.file_operations = FileOperations()
        self.factory_analyzer = FactoryAnalyzer()

    def execute_step1(self, flutter_project_root: Path, app_name: str, menu_helper: Any) -> Dict[str, Any]:
        """
        Execute complete Step 1 process - Project Copy

        Args:
            flutter_project_root: Root directory of Flutter project
            app_name: Application name
            menu_helper: Menu helper instance for user interaction

        Returns:
            Dictionary containing target directory and copy results
        """
        print()
        print("=" * 80)
        print("[STEP-1] STARTING PROJECT COPY AND DIRECTORY MANAGEMENT")
        print("=" * 80)

        try:
            # Step 1-1: Analyze existing temporary directories
            print("\n[STEP-1] [STEP-1-1] Analyzing existing temporary directories...")
            existing_dirs = self._find_existing_temp_dirs(app_name)

            # Step 1-2: Handle directory selection
            print("\n[STEP-1] [STEP-1-2] Handling directory selection...")
            target_dir, overwrite_mode = self._handle_directory_selection(existing_dirs, app_name, menu_helper)

            # Step 1-3: Prepare for copy operation
            print("\n[STEP-1] [STEP-1-3] Preparing for copy operation...")
            self._prepare_copy_operation(target_dir, overwrite_mode, flutter_project_root)

            # Step 1-4: Execute copy operation
            print("\n[STEP-1] [STEP-1-4] Executing copy operation...")
            copy_stats = self._execute_copy_operation(flutter_project_root, target_dir, overwrite_mode)

            # Step 1-5: Post-copy setup
            print("\n[STEP-1] [STEP-1-5] Post-copy setup...")
            self._post_copy_setup(target_dir, copy_stats)

            print(f"\n[STEP-1] [STEP-1-COMPLETE] Project copy and directory management completed")

            # Show compilation menu after successful project copy
            print(f"\n[STEP-1] [COMPILATION-MENU] Showing compilation options...")
            compilation_option = menu_helper.show_compilation_menu()
            print(f"\n[STEP-1] [COMPILATION-OPTION] Selected: {compilation_option}")

            return {
                'success': True,
                'target_directory': target_dir,
                'overwrite_mode': overwrite_mode,
                'copy_stats': copy_stats,
                'should_change_directory': True,
                'compilation_option': compilation_option
            }

        except Exception as e:
            print(f"[STEP-1] [ERROR] Step 1 execution failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'target_directory': None,
                'overwrite_mode': False,
                'copy_stats': None,
                'should_change_directory': False
            }

    def _find_existing_temp_dirs(self, app_name: str) -> List[Path]:
        """Find existing temporary directories for the app"""
        build_factory = Path("D:/programing/.build_dir/compile_factory")
        if not build_factory.exists():
            return []

        existing_dirs = []
        for item in build_factory.iterdir():
            if item.is_dir() and item.name.startswith(f"{app_name}_"):
                existing_dirs.append(item)

        return sorted(existing_dirs, key=lambda x: x.name, reverse=True)

    def _handle_directory_selection(self, existing_dirs: List[Path], app_name: str, menu_helper: Any) -> tuple[Path, bool]:
        """Handle directory selection logic"""
        target_dir = None
        overwrite_mode = False

        if existing_dirs:
            print(f"[STEP-1] Found {len(existing_dirs)} existing temporary directories for {app_name}")

            if menu_helper:
                # Use menu helper to let user choose
                while True:  # Loop to handle refresh action
                    result = menu_helper.show_directory_menu(existing_dirs, app_name, cache_key='project_directory_selection')

                    if result:
                        action = result.get('action')
                        directory = result.get('directory')

                        if action == 'continue' and directory:
                            target_dir = directory
                            overwrite_mode = True
                            print(f"[STEP-1] User selected existing directory: {target_dir}")
                            break
                        elif action == 'refresh':
                            # Refresh directory list and show menu again
                            print(f"[STEP-1] Refreshing directory list for {app_name}...")
                            existing_dirs = self._find_existing_temp_dirs(app_name)
                            # Always continue to show menu again, even if no directories found
                            # If no directories, menu will show "Create new directory" option
                            continue  # Show menu again with refreshed list
                        else:
                            # Create new directory
                            target_dir = None
                            break
                    else:
                        # User cancelled or error
                        target_dir = None
                        break
            else:
                # No menu helper, use first existing directory
                target_dir = existing_dirs[0]
                overwrite_mode = True

        if target_dir is None:
            # Create new temporary directory
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            temp_dir_name = f"{app_name}_{timestamp}"
            target_dir = Path("D:/programing/.build_dir/compile_factory") / temp_dir_name
            print(f"[STEP-1] Creating new temporary directory: {target_dir}")
        else:
            print(f"[STEP-1] Selected existing directory: {target_dir}")
            print(f"[STEP-1] Will use smart copy to update changed files")

        return target_dir, overwrite_mode

    def _prepare_copy_operation(self, target_dir: Path, overwrite_mode: bool, flutter_project_root: Path):
        """Prepare for copy operation"""
        # Check compilation flags if using existing directory
        if overwrite_mode:
            compilation_flags = self.file_operations.check_compilation_flag(target_dir)
            print(f"[STEP-1] Directory compilation status:")
            print(f"  Compiled: {'Yes' if compilation_flags['compiled'] else 'No'}")
            if compilation_flags['build_success']:
                print(f"  Build success: Yes")

        # Clean up empty directories before copying
        print(f"\n[STEP-1] [CLEANUP] Cleaning empty directories...")
        if overwrite_mode:
            self.file_operations.cleanup_empty_directories(target_dir)
        else:
            # For new directories, clean the source to avoid copying empty dirs
            self.file_operations.cleanup_empty_directories(flutter_project_root)

    def _execute_copy_operation(self, flutter_project_root: Path, target_dir: Path, overwrite_mode: bool) -> Dict[str, Any]:
        """Execute the copy operation"""
        print(f"\n[STEP-1] [COPY] Starting project copy operation...")

        if overwrite_mode:
            # Use smart copy for existing directories
            stats = self.file_operations.copy_with_smart_overwrite(flutter_project_root, target_dir)
            success = stats['total'] > 0
        else:
            # Use simple copy for new directories
            stats = self.file_operations.simple_copy(flutter_project_root, target_dir)
            success = stats['total'] > 0

        if success:
            print(f"[STEP-1] Project copied successfully")
            print(f"[STEP-1] Copy statistics: {stats}")
        else:
            print(f"[STEP-1] [ERROR] Failed to copy project files")

        return stats

    def _post_copy_setup(self, target_dir: Path, copy_stats: Dict[str, Any]):
        """Perform post-copy setup"""
        try:
            # Create cache directory if it doesn't exist
            cache_dir = target_dir / ".cache"
            cache_dir.mkdir(exist_ok=True)

            # Create build info
            build_info = {
                'step_completed': 'step1_project_copy',
                'copy_time': datetime.now().isoformat(),
                'files_copied': copy_stats.get('total', 0)
            }

            # Store build info in cache
            build_info_file = cache_dir / "step1_results.txt"
            with open(build_info_file, 'w') as f:
                for key, value in build_info.items():
                    f.write(f"{key}={value}\n")

            print(f"[STEP-1] Created build info: {build_info_file}")

        except Exception as e:
            print(f"[STEP-1] [WARNING] Failed to create post-copy setup: {e}")

    def get_step_info(self) -> Dict[str, Any]:
        """Get information about Step 1"""
        return {
            'step_number': 1,
            'step_name': 'Project Copy and Directory Management',
            'description': 'Copies Flutter project to temporary directory, manages existing directories, and sets up build environment',
            'sub_steps': [
                'Analyze existing temporary directories',
                'Handle directory selection',
                'Prepare for copy operation',
                'Execute copy operation',
                'Post-copy setup'
            ],
            'dependencies': ['FileOperations', 'FactoryAnalyzer'],
            'outputs': ['target_directory', 'copy_stats', 'should_change_directory']
        }

    def validate_inputs(self, flutter_project_root: Path, app_name: str) -> Dict[str, Any]:
        """Validate inputs for Step 1 execution"""
        validation_results = {
            'valid': True,
            'errors': [],
            'warnings': []
        }

        # Check flutter_project_root
        if not flutter_project_root or not flutter_project_root.exists():
            validation_results['valid'] = False
            validation_results['errors'].append(f"Flutter project root does not exist: {flutter_project_root}")

        if flutter_project_root and not flutter_project_root.is_dir():
            validation_results['valid'] = False
            validation_results['errors'].append(f"Flutter project root is not a directory: {flutter_project_root}")

        # Check if it's a Flutter project
        if flutter_project_root and flutter_project_root.exists():
            pubspec_file = flutter_project_root / "pubspec.yaml"
            if not pubspec_file.exists():
                validation_results['warnings'].append("pubspec.yaml not found - may not be a Flutter project")

        # Check app_name
        if not app_name or not app_name.strip():
            validation_results['valid'] = False
            validation_results['errors'].append("App name is empty or invalid")

        # Check build factory directory
        build_factory = Path("D:/programing/.build_dir/compile_factory")
        try:
            build_factory.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            validation_results['valid'] = False
            validation_results['errors'].append(f"Cannot create build factory directory: {e}")

        return validation_results