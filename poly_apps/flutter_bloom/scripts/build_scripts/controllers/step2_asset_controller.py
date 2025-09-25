#!/usr/bin/env python3
"""
Step 2 Asset Controller
Orchestrates asset image selection and processing
"""

from pathlib import Path
from typing import Dict, List, Optional, Any
import sys

# Import using relative path from build_scripts root
from core.gvar.flutter_global_var import flutter_gvar
from utils.asset_scanner import AssetScanner
from utils.smart_image_selector import SmartImageSelector

class Step2AssetController:
    """Controller for Step 2: Asset Image Selection and Processing"""

    def __init__(self):
        """Initialize Step 2 Controller"""
        self.asset_scanner = AssetScanner()
        self.smart_selector = SmartImageSelector(self.asset_scanner)

    def execute_step2(self, temp_build_root: Path, app_name: str, menu_helper: Any) -> Dict[str, Any]:
        """
        Execute complete Step 2 process

        Args:
            temp_build_root: Path to temporary build directory
            app_name: Application name
            menu_helper: Menu helper instance for user interaction

        Returns:
            Dictionary containing selected images and processing results
        """
        print()
        print("=" * 80)
        print("[STEP-2] STARTING IMAGE RESOURCE COLLECTION")
        print("=" * 80)

        try:
            # Step 2-1: Collect resource directories
            print("\n[STEP-2] [STEP-2-1] Collecting resource directories...")
            resource_dirs = self._collect_resource_directories(temp_build_root, app_name)

            # Step 2-2: Smart image selection with directory priority
            print("\n[STEP-2] [STEP-2-2] Smart image selection with paired search logic...")
            selected_images = self._select_images(menu_helper, resource_dirs, temp_build_root, app_name)

            # Step 2-3: Apply fallback rules
            print("\n[STEP-2] [STEP-2-3] Applying fallback rules...")
            selected_images = self._apply_fallback_rules(selected_images)

            # Step 2-4: Show final summary and process images
            print("\n[STEP-2] [STEP-2-4] Final summary and image processing...")
            selected_images = self._process_final_images(selected_images, menu_helper)

            print(f"\n[STEP-2] [STEP-2-COMPLETE] Asset image selection and processing completed")

            return {
                'success': True,
                'selected_images': selected_images,
                'resource_dirs': resource_dirs,
                'processed_count': len([img for img in selected_images.values() if img])
            }

        except Exception as e:
            print(f"[STEP-2] [ERROR] Step 2 execution failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'selected_images': {},
                'resource_dirs': [],
                'processed_count': 0
            }

    def _collect_resource_directories(self, temp_build_root: Path, app_name: str) -> List[Path]:
        """Collect resource directories using AssetScanner"""
        try:
            resource_dirs = self.asset_scanner.collect_resource_directories(temp_build_root, app_name)
            return resource_dirs
        except Exception as e:
            print(f"[STEP-2] [ERROR] Failed to collect resource directories: {e}")
            return []

    def _select_images(self, menu_helper: Any, resource_dirs: List[Path], temp_build_root: Path, app_name: str) -> Dict[str, Any]:
        """Select images using SmartImageSelector"""
        try:
            selected_images = self.smart_selector.select_all_images(menu_helper, resource_dirs, temp_build_root, app_name)
            return selected_images
        except Exception as e:
            print(f"[STEP-2] [ERROR] Failed to select images: {e}")
            return {}

    def _apply_fallback_rules(self, selected_images: Dict[str, Any]) -> Dict[str, Any]:
        """Apply fallback rules using AssetScanner"""
        try:
            selected_images = self.asset_scanner.apply_fallback_rules(selected_images, {})
            return selected_images
        except Exception as e:
            print(f"[STEP-2] [ERROR] Failed to apply fallback rules: {e}")
            return selected_images

    def _process_final_images(self, selected_images: Dict[str, Any], menu_helper: Any) -> Dict[str, Any]:
        """Process final images using SmartImageSelector"""
        try:
            selected_images = self.smart_selector.show_final_summary_and_process(selected_images, menu_helper)
            return selected_images
        except Exception as e:
            print(f"[STEP-2] [ERROR] Failed to process final images: {e}")
            return selected_images

    def get_step_info(self) -> Dict[str, Any]:
        """Get information about Step 2"""
        return {
            'step_number': 2,
            'step_name': 'Asset Image Selection and Processing',
            'description': 'Collects resource directories, selects images with smart logic, applies fallback rules, and processes selected images',
            'sub_steps': [
                'Collect resource directories',
                'Smart image selection with paired search logic',
                'Apply fallback rules',
                'Final summary and image processing'
            ],
            'dependencies': ['AssetScanner', 'SmartImageSelector'],
            'outputs': ['selected_images', 'resource_dirs', 'processed_count']
        }

    def validate_inputs(self, temp_build_root: Path, app_name: str, menu_helper: Any) -> Dict[str, Any]:
        """Validate inputs for Step 2 execution"""
        validation_results = {
            'valid': True,
            'errors': [],
            'warnings': []
        }

        # Check temp_build_root
        if not temp_build_root or not temp_build_root.exists():
            validation_results['valid'] = False
            validation_results['errors'].append(f"Temporary build directory does not exist: {temp_build_root}")

        # Check app_name
        if not app_name or not app_name.strip():
            validation_results['valid'] = False
            validation_results['errors'].append("App name is empty or invalid")

        # Check menu_helper
        if not menu_helper:
            validation_results['valid'] = False
            validation_results['errors'].append("Menu helper is not provided")

        # Check if temp directory is writable
        if temp_build_root and temp_build_root.exists():
            try:
                test_file = temp_build_root / ".write_test"
                test_file.touch()
                test_file.unlink()
            except Exception as e:
                validation_results['valid'] = False
                validation_results['errors'].append(f"Temporary directory is not writable: {e}")

        return validation_results