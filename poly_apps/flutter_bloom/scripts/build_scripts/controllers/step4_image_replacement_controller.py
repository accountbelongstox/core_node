#!/usr/bin/env python3
"""
Step 4 Image Replacement Controller
Handles intelligent image replacement for platform-specific targets
"""

import os
import shutil
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import json

# Import using relative path from build_scripts root
from shared.data_exchange.unified_variable_system import unified_vars
from shared.standard_image_data import ANDROID_IMAGE_DATA, platform_image_manager
from shared.image_patterns import ImagePatterns
from utils.smart_image_resizer import SmartImageResizer
from utils.menu_helper import MenuHelper
from utils.print_helper import PrintHelper
from utils.backup_manager import BackupManager
# Import AndroidSpecs for unified target definitions
import sys
from pathlib import Path
build_debug_scripts_path = Path(__file__).parent.parent.parent / "build_debug_scripts"
sys.path.insert(0, str(build_debug_scripts_path))
from utils.platform_specs.android_specs import AndroidSpecs


class Step4ImageReplacementController:
    """
    Step 4 Controller: Platform Image Replacement
    Manages intelligent replacement of platform-specific images with processed assets
    """

    def __init__(self):
        self.step_name = "STEP-4"
        self.step_description = "Platform Image Replacement"
        self.smart_resizer = SmartImageResizer()
        self.menu_helper = MenuHelper()
        self.results = {}
        self.temp_build_root = None
        self.app_name = None
        self.backup_manager = None

        # Initialize AndroidSpecs for unified target definitions
        self.android_specs = AndroidSpecs()
        # Build android_targets from AndroidSpecs for backward compatibility
        self.android_targets = self._build_android_targets_from_specs()

    def _build_android_targets_from_specs(self) -> Dict[str, Dict[str, Tuple[int, int]]]:
        """Build android_targets structure from AndroidSpecs for backward compatibility"""
        targets = {}

        # Get all recommendations from AndroidSpecs
        all_recommendations = self.android_specs.get_all_recommendations()

        # Build ic_launcher targets from icons recommendations
        targets['ic_launcher'] = {}
        for icon_rec in all_recommendations['icons']:
            density = icon_rec['density']
            size = icon_rec['size']
            targets['ic_launcher'][f'mipmap-{density}'] = size
        targets['ic_launcher']['mipmap'] = (48, 48)  # Default fallback

        # Build notification_icon targets
        targets['notification_icon'] = {}
        for notif_rec in all_recommendations['notifications']:
            density = notif_rec['density']
            size = notif_rec['size']
            targets['notification_icon'][f'mipmap-{density}'] = size
        targets['notification_icon']['mipmap'] = (24, 24)  # Default fallback

        # transa_launcher uses same as ic_launcher
        targets['transa_launcher'] = targets['ic_launcher'].copy()

        # Build background targets
        targets['background'] = {}
        for bg_rec in all_recommendations['backgrounds']:
            density = bg_rec['density']
            size = bg_rec['size']
            targets['background'][f'drawable-{density}'] = size
        targets['background']['drawable'] = (320, 480)  # Default fallback

        # splash uses same as background
        targets['splash'] = targets['background'].copy()

        return targets

    def initialize(self, temp_build_root: Path, app_name: str) -> bool:
        """
        Initialize Step 4 controller with build parameters

        Args:
            temp_build_root: Path to temporary build directory
            app_name: Name of the application being built

        Returns:
            bool: True if initialization successful, False otherwise
        """
        try:
            print(f"[{self.step_name}] [INIT] Initializing {self.step_description}")
            print(f"[{self.step_name}] [INIT] Build Root: {temp_build_root}")
            print(f"[{self.step_name}] [INIT] App Name: {app_name}")

            self.temp_build_root = temp_build_root
            self.app_name = app_name

            # Initialize backup manager
            self.backup_manager = BackupManager(temp_build_root)
            print(f"[{self.step_name}] [INIT] Backup manager initialized: {self.backup_manager.android_backup_dir}")

            # Validate build root exists
            if not temp_build_root.exists():
                print(f"[{self.step_name}] [ERROR] Build root directory does not exist: {temp_build_root}")
                return False

            # Check for processed images directory
            self.processed_images_dir = temp_build_root / ".cache" / "processed_images"
            if not self.processed_images_dir.exists():
                print(f"[{self.step_name}] [WARNING] Processed images directory not found: {self.processed_images_dir}")
                print(f"[{self.step_name}] [INFO] Will look for processed images in cache...")

            # Check for Step 2 results (compression settings)
            self.compression_settings_file = temp_build_root / ".cache" / "image_compression_settings.txt"
            if not self.compression_settings_file.exists():
                print(f"[{self.step_name}] [WARNING] Compression settings not found: {self.compression_settings_file}")

            # Check for Step 3 results (platform scanning)
            self.platform_results_file = temp_build_root / ".cache" / "step3_platform_results.txt"
            if not self.platform_results_file.exists():
                print(f"[{self.step_name}] [WARNING] Platform results not found: {self.platform_results_file}")

            print(f"[{self.step_name}] [INIT] Step 4 controller initialized successfully")
            return True

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to initialize Step 4 controller: {e}")
            return False

    def execute_step4_replacement(self) -> Dict[str, Any]:
        """
        Execute Step 4: Platform Image Replacement

        Returns:
            Dict containing replacement results and metadata
        """
        try:
            print(f"\n[{self.step_name}] {'=' * 80}")
            print(f"[{self.step_name}] {self.step_description.upper()}")
            print(f"[{self.step_name}] {'=' * 80}")

            print(f"[{self.step_name}] [EXECUTE] Starting intelligent image replacement...")

            # Show smart resize configuration menu before proceeding
            self._show_smart_resize_menu()

            # Load Step 2 processed images information
            processed_images = self._load_processed_images_info()
            if not processed_images:
                return {'success': False, 'error': 'No processed images found from Step 2'}

            # Load Step 3 platform scanning results
            platform_targets = self._load_platform_targets()
            if not platform_targets:
                print(f"[{self.step_name}] [WARNING] No platform targets loaded, using defaults")

            # Execute replacement for Android platform (starting with ic_launcher)
            print(f"[{self.step_name}] [PHASE-1] Processing Android platform images...")
            android_results = self._process_android_images(processed_images, platform_targets)

            # Store results
            self.results = {
                'step': 4,
                'step_name': self.step_name,
                'step_description': self.step_description,
                'success': True,
                'temp_build_root': str(self.temp_build_root),
                'app_name': self.app_name,
                'processed_images_count': len(processed_images),
                'android_results': android_results,
                'summary': self._generate_summary(android_results)
            }

            # Show backup summary
            self._show_backup_summary()

            print(f"[{self.step_name}] [COMPLETE] Platform image replacement completed successfully")
            return self.results

        except Exception as e:
            error_message = f"Step 4 execution failed: {e}"
            print(f"[{self.step_name}] [ERROR] {error_message}")

            self.results = {
                'step': 4,
                'step_name': self.step_name,
                'step_description': self.step_description,
                'success': False,
                'error': error_message,
                'temp_build_root': str(getattr(self, 'temp_build_root', '')),
                'app_name': getattr(self, 'app_name', ''),
                'android_results': {},
                'summary': {}
            }

            return self.results

    def _load_processed_images_info(self) -> Dict[str, Dict[str, Any]]:
        """Load processed images information from ANDROID_IMAGE_DATA (single source of truth)"""
        try:
            # Import ANDROID_IMAGE_DATA from the standard location
            from shared.standard_image_data import ANDROID_IMAGE_DATA

            print(f"[{self.step_name}] [INFO] Loading processed images from ANDROID_IMAGE_DATA...")

            processed_images = {}

            # Use ANDROID_IMAGE_DATA as the single source of truth for processed images
            for image_type, image_data in ANDROID_IMAGE_DATA.items():
                # Only include images that have been processed and have paths
                processed_path = image_data.get('processed_path', '')
                original_path = image_data.get('original_path', '')
                status = image_data.get('status', 'missing')

                if status != 'missing' and (processed_path or original_path):
                    # Determine the actual file path to use
                    actual_path = processed_path if processed_path and os.path.exists(processed_path) else original_path

                    if actual_path and os.path.exists(actual_path):
                        # Map image types to Step4 format
                        step4_image_type = self._map_android_to_step4_type(image_type)

                        processed_images[step4_image_type] = {
                            'source_path': actual_path,
                            'original_path': original_path,
                            'processed_path': processed_path,
                            'final_filename': image_data.get('final_filename', f"{image_type.lower()}.png"),
                            'compression_mode': image_data.get('compression_mode', 'compressed'),
                            'android_image_type': image_type,  # Store original android type for matching
                            'original_size': image_data.get('original_size', 0),
                            'processed_size': image_data.get('processed_size', 0),
                            'format': image_data.get('format', '.png'),
                            'is_processed': bool(processed_path and processed_path != original_path)
                        }

                        print(f"[{self.step_name}] [INFO] Loaded {step4_image_type}: {Path(actual_path).name}")
                    else:
                        print(f"[{self.step_name}] [WARNING] File not found for {image_type}: {actual_path}")
                else:
                    print(f"[{self.step_name}] [INFO] Skipping {image_type}: status={status}, no valid path")

            print(f"[{self.step_name}] [INFO] Loaded {len(processed_images)} processed images from ANDROID_IMAGE_DATA")
            return processed_images

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to load processed images from ANDROID_IMAGE_DATA: {e}")
            return {}

    def _map_android_to_step4_type(self, android_type: str) -> str:
        """Map ANDROID_IMAGE_DATA types to Step4 processing types"""
        mapping = {
            'logo': 'IC_LAUNCHER',  # Primary mapping for logos
            'ic_icon': 'IC_LAUNCHER',
            'ic_launcher': 'IC_LAUNCHER',
            'notification_icon': 'NOTIFICATION_ICON',
            'transa_launcher': 'TRANSA_LAUNCHER',
            'background': 'BACKGROUND',
            'splash': 'SPLASH'  # Splash is separate from background
        }
        return mapping.get(android_type.lower(), android_type.upper())

    def _parse_processed_images_from_log(self, log_file: Path) -> Dict[str, Dict[str, Any]]:
        """Parse processed images information from log file"""
        try:
            processed_images = {}

            with open(log_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Parse processing results from log
            lines = content.split('\n')
            current_image_type = None

            for line in lines:
                line = line.strip()

                # Look for processing headers
                if line.startswith('[PROCESSING]') and ':' in line:
                    # Example: [PROCESSING] IC_LAUNCHER: logo.webp - Mode: COMPRESSED
                    parts = line.split(':')
                    if len(parts) >= 2:
                        image_type = parts[0].replace('[PROCESSING]', '').strip()
                        current_image_type = image_type

                # Look for processed path
                elif line.startswith('Processed Path:') and current_image_type:
                    processed_path = line.replace('Processed Path:', '').strip()
                    if processed_path and Path(processed_path).exists():
                        processed_images[current_image_type] = {
                            'processed_path': processed_path,
                            'filename': Path(processed_path).name,
                            'size_bytes': Path(processed_path).stat().st_size
                        }
                        print(f"[{self.step_name}] [LOG-PARSE] Found: {current_image_type} -> {processed_path}")
                    current_image_type = None  # Reset after processing

            return processed_images

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to parse processed images from log: {e}")
            return {}

    def _load_platform_targets(self) -> Dict[str, List[Dict[str, Any]]]:
        """Load platform targets from Step 3 results"""
        try:
            platform_targets = {'android': []}

            if not self.platform_results_file.exists():
                return platform_targets

            with open(self.platform_results_file, 'r', encoding='utf-8') as f:
                lines = f.readlines()

            for line in lines:
                line = line.strip()
                if line.startswith('#') or not line:
                    continue

                # Parse format: platform|image_path|image_name|size_bytes|format
                parts = line.split('|')
                if len(parts) >= 5:
                    platform, image_path, image_name, size_bytes, image_format = parts[:5]

                    if platform == 'android':
                        platform_targets['android'].append({
                            'path': image_path,
                            'name': image_name,
                            'size_bytes': int(size_bytes),
                            'format': image_format
                        })

            print(f"[{self.step_name}] [TARGETS] Loaded {len(platform_targets.get('android', []))} Android targets")
            return platform_targets

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to load platform targets: {e}")
            return {'android': []}

    def _process_android_images(
        self,
        processed_images: Dict[str, Dict[str, Any]],
        platform_targets: Dict[str, List[Dict[str, Any]]]
    ) -> Dict[str, Any]:
        """Process Android platform images with intelligent replacement"""
        try:
            print(f"[{self.step_name}] [ANDROID] Starting Android image processing...")

            android_results = {
                'processed_count': 0,
                'skipped_count': 0,
                'error_count': 0,
                'replacements': {}
            }

            # Focus on ic_launcher first
            if 'IC_LAUNCHER' in processed_images:
                print(f"[{self.step_name}] [ANDROID] Processing IC_LAUNCHER images...")
                ic_launcher_result = self._process_ic_launcher_images(processed_images['IC_LAUNCHER'])
                android_results['replacements']['ic_launcher'] = ic_launcher_result

                if ic_launcher_result.get('success', False):
                    android_results['processed_count'] += ic_launcher_result.get('replaced_count', 0)
                else:
                    android_results['error_count'] += 1
            else:
                print(f"[{self.step_name}] [ANDROID] [WARNING] IC_LAUNCHER not found in processed images")
                android_results['skipped_count'] += 1

            # Process all other image types
            for image_type, image_info in processed_images.items():
                if image_type != 'IC_LAUNCHER':  # Already processed above
                    print(f"[{self.step_name}] [ANDROID] Processing {image_type} images...")
                    result = self._process_generic_android_images(image_type, image_info)
                    android_results['replacements'][image_type.lower()] = result

                    if result.get('success', False):
                        android_results['processed_count'] += result.get('replaced_count', 0)
                    else:
                        android_results['error_count'] += 1

            return android_results

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to process Android images: {e}")
            return {
                'processed_count': 0,
                'skipped_count': 0,
                'error_count': 1,
                'error': str(e),
                'replacements': {}
            }

    def _process_ic_launcher_images(self, ic_launcher_info: Dict[str, Any]) -> Dict[str, Any]:
        """Process ic_launcher images for all Android density directories"""
        try:
            print(f"[{self.step_name}] [IC_LAUNCHER] Processing ic_launcher images...")

            # Use source_path which contains the actual path to use (processed or original)
            source_image_path = Path(ic_launcher_info['source_path'])
            if not source_image_path.exists():
                return {'success': False, 'error': f'Source image not found: {source_image_path}'}

            # Get smart resize setting from ANDROID_IMAGE_DATA
            android_image_type = ic_launcher_info.get('android_image_type', 'ic_launcher')
            smart_resize_enabled = ANDROID_IMAGE_DATA.get(android_image_type, {}).get('smart_resize', True)

            print(f"[{self.step_name}] [IC_LAUNCHER] Source image: {source_image_path}")
            print(f"[{self.step_name}] [IC_LAUNCHER] Smart Resize: {'ENABLED' if smart_resize_enabled else 'DISABLED'}")
            if ic_launcher_info.get('is_processed', False):
                print(f"[{self.step_name}] [IC_LAUNCHER] Using processed image (compression: {ic_launcher_info.get('compression_mode', 'unknown')})")
            else:
                print(f"[{self.step_name}] [IC_LAUNCHER] Using original image")

            results = {
                'success': True,
                'source_image': str(source_image_path),
                'replaced_count': 0,
                'skipped_count': 0,
                'replacements': {}
            }

            # Get Android ic_launcher targets
            targets = self.android_targets.get('ic_launcher', {})
            android_base_path = self.temp_build_root / "android" / "app" / "src" / "main" / "res"

            for density_dir, target_size in targets.items():
                target_dir = android_base_path / density_dir
                target_file = target_dir / "ic_launcher.png"

                # Enhance target_size with AndroidSpecs if available
                android_specs_size = self.android_specs.get_recommended_size_for_path(str(target_file), 'icon')
                if android_specs_size and android_specs_size != (0, 0):
                    target_size = android_specs_size
                    print(f"[{self.step_name}] [IC_LAUNCHER] Processing {density_dir}: {target_size[0]}x{target_size[1]} (AndroidSpecs enhanced)")
                else:
                    print(f"[{self.step_name}] [IC_LAUNCHER] Processing {density_dir}: {target_size[0]}x{target_size[1]}")

                if not target_file.exists():
                    print(f"[{self.step_name}] [IC_LAUNCHER] [SKIP] Target file not found: {target_file}")
                    results['skipped_count'] += 1
                    continue

                # Create backup using backup manager
                backup_path = self.backup_manager.backup_android_file(target_file)
                if backup_path:
                    print(f"[{self.step_name}] [IC_LAUNCHER] Created backup: {backup_path.relative_to(self.backup_manager.android_backup_dir)}")
                else:
                    print(f"[{self.step_name}] [IC_LAUNCHER] [WARNING] Failed to create backup for: {target_file.name}")

                # Choose processing method based on smart_resize setting
                if smart_resize_enabled:
                    # Use smart resizer to create appropriately sized image
                    print(f"[{self.step_name}] [IC_LAUNCHER] Using Smart Resize for {target_size[0]}x{target_size[1]}")
                    resize_result = self.smart_resizer.resize_and_crop_to_target(
                        source_image_path=source_image_path,
                        target_size=target_size,
                        output_path=target_file,
                        quality=95
                    )

                    if resize_result.get('success', False):
                        results['replaced_count'] += 1
                        results['replacements'][density_dir] = {
                            'target_file': str(target_file),
                            'target_size': target_size,
                            'resize_result': resize_result,
                            'method': 'smart_resize'
                        }
                        print(f"[{self.step_name}] [IC_LAUNCHER] ✓ Smart Resized: {target_file}")
                    else:
                        results['skipped_count'] += 1
                        print(f"[{self.step_name}] [IC_LAUNCHER] ✗ Smart Resize Failed: {resize_result.get('error', 'Unknown error')}")
                else:
                    # Direct copy without resizing
                    try:
                        print(f"[{self.step_name}] [IC_LAUNCHER] Direct copy (no resize) to {target_file.name}")
                        shutil.copy2(source_image_path, target_file)
                        results['replaced_count'] += 1
                        results['replacements'][density_dir] = {
                            'target_file': str(target_file),
                            'target_size': target_size,
                            'resize_result': {'success': True, 'method': 'direct_copy'},
                            'method': 'direct_copy'
                        }
                        print(f"[{self.step_name}] [IC_LAUNCHER] ✓ Direct Copy: {target_file}")
                    except Exception as copy_error:
                        results['skipped_count'] += 1
                        print(f"[{self.step_name}] [IC_LAUNCHER] ✗ Copy Failed: {copy_error}")

            print(f"[{self.step_name}] [IC_LAUNCHER] Completed: {results['replaced_count']} replaced, {results['skipped_count']} skipped")
            return results

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to process ic_launcher images: {e}")
            return {'success': False, 'error': str(e), 'replaced_count': 0}

    def _generate_summary(self, android_results: Dict[str, Any]) -> Dict[str, Any]:
        """Generate summary of Step 4 processing results"""
        try:
            summary = {
                'total_processed': android_results.get('processed_count', 0),
                'total_skipped': android_results.get('skipped_count', 0),
                'total_errors': android_results.get('error_count', 0),
                'platforms_processed': ['android'] if android_results.get('processed_count', 0) > 0 else [],
                'image_types_processed': []
            }

            # Analyze processed image types
            replacements = android_results.get('replacements', {})
            if 'ic_launcher' in replacements and replacements['ic_launcher'].get('success', False):
                summary['image_types_processed'].append('ic_launcher')

            return summary

        except Exception as e:
            print(f"[{self.step_name}] [WARNING] Failed to generate summary: {e}")
            return {'error': str(e)}

    def get_results(self) -> Dict[str, Any]:
        """Get the results of Step 4 execution"""
        return self.results

    def _process_generic_android_images(self, step4_image_type: str, image_info: Dict[str, Any]) -> Dict[str, Any]:
        """Process generic Android images with Smart Resize support"""
        try:
            print(f"[{self.step_name}] [{step4_image_type}] Processing {step4_image_type.lower()} images...")

            # Use source_path which contains the actual path to use (processed or original)
            source_image_path = Path(image_info['source_path'])
            if not source_image_path.exists():
                return {'success': False, 'error': f'Source image not found: {source_image_path}'}

            # Get smart resize setting from ANDROID_IMAGE_DATA using the android_image_type
            android_image_type = image_info.get('android_image_type', step4_image_type.lower())
            smart_resize_enabled = ANDROID_IMAGE_DATA.get(android_image_type, {}).get('smart_resize', True)

            print(f"[{self.step_name}] [{step4_image_type}] Source image: {source_image_path}")
            print(f"[{self.step_name}] [{step4_image_type}] Smart Resize: {'ENABLED' if smart_resize_enabled else 'DISABLED'}")

            # Find matching platform targets
            android_platform_images = platform_image_manager.get_platform_images('android')
            matching_targets = self._find_matching_platform_targets(android_image_type, image_info.get('final_filename', ''), android_platform_images)

            results = {
                'success': True,
                'source_image': str(source_image_path),
                'replaced_count': 0,
                'skipped_count': 0,
                'replacements': {}
            }

            if not matching_targets:
                print(f"[{self.step_name}] [{step4_image_type}] No matching platform targets found")
                return results

            for target in matching_targets:
                target_path = Path(target.get('target_path', ''))
                if not target_path.exists():
                    print(f"[{self.step_name}] [{step4_image_type}] [SKIP] Target file not found: {target_path}")
                    results['skipped_count'] += 1
                    continue

                # Create backup using backup manager
                backup_path = self.backup_manager.backup_android_file(target_path)
                if backup_path:
                    print(f"[{self.step_name}] [{step4_image_type}] Created backup: {backup_path.relative_to(self.backup_manager.android_backup_dir)}")
                else:
                    print(f"[{self.step_name}] [{step4_image_type}] [WARNING] Failed to create backup for: {target_path.name}")

                # Get recommended size, use AndroidSpecs for better accuracy
                recommended_size = target.get('recommended_size', (0, 0))

                # If AndroidSpecs can provide better size recommendation, use it
                target_path_str = str(target_path)
                android_specs_size = self.android_specs.get_recommended_size_for_path(target_path_str, 'icon' if 'icon' in android_image_type or 'launcher' in android_image_type else android_image_type)
                if android_specs_size and android_specs_size != (0, 0):
                    recommended_size = android_specs_size
                    print(f"[{self.step_name}] [{step4_image_type}] AndroidSpecs recommended size: {recommended_size[0]}x{recommended_size[1]}")

                # Choose processing method based on smart_resize setting
                if smart_resize_enabled and recommended_size[0] > 0 and recommended_size[1] > 0:
                    # Use smart resizer
                    print(f"[{self.step_name}] [{step4_image_type}] Using Smart Resize for {recommended_size[0]}x{recommended_size[1]}")
                    resize_result = self.smart_resizer.resize_and_crop_to_target(
                        source_image_path=source_image_path,
                        target_size=recommended_size,
                        output_path=target_path,
                        quality=95
                    )

                    if resize_result.get('success', False):
                        results['replaced_count'] += 1
                        results['replacements'][str(target_path)] = {
                            'target_file': str(target_path),
                            'target_size': recommended_size,
                            'resize_result': resize_result,
                            'method': 'smart_resize'
                        }
                        print(f"[{self.step_name}] [{step4_image_type}] ✓ Smart Resized: {target_path.name}")
                    else:
                        results['skipped_count'] += 1
                        print(f"[{self.step_name}] [{step4_image_type}] ✗ Smart Resize Failed: {resize_result.get('error', 'Unknown error')}")
                else:
                    # Direct copy without resizing
                    try:
                        print(f"[{self.step_name}] [{step4_image_type}] Direct copy (no resize) to {target_path.name}")
                        shutil.copy2(source_image_path, target_path)
                        results['replaced_count'] += 1
                        results['replacements'][str(target_path)] = {
                            'target_file': str(target_path),
                            'target_size': recommended_size,
                            'resize_result': {'success': True, 'method': 'direct_copy'},
                            'method': 'direct_copy'
                        }
                        print(f"[{self.step_name}] [{step4_image_type}] ✓ Direct Copy: {target_path.name}")
                    except Exception as copy_error:
                        results['skipped_count'] += 1
                        print(f"[{self.step_name}] [{step4_image_type}] ✗ Copy Failed: {copy_error}")

            print(f"[{self.step_name}] [{step4_image_type}] Completed: {results['replaced_count']} replaced, {results['skipped_count']} skipped")
            return results

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to process {step4_image_type} images: {e}")
            return {'success': False, 'error': str(e)}

    def print_step4_summary(self) -> None:
        """Print a concise summary of Step 4 results"""
        try:
            if not self.results:
                print(f"[{self.step_name}] [SUMMARY] No results available")
                return

            print(f"\n[{self.step_name}] [SUMMARY] STEP 4 COMPLETION SUMMARY")
            print(f"[{self.step_name}] {'-' * 60}")

            if self.results.get('success', False):
                summary = self.results.get('summary', {})
                android_results = self.results.get('android_results', {})

                print(f"[{self.step_name}] Status: SUCCESS")
                print(f"[{self.step_name}] Images Processed: {summary.get('total_processed', 0)}")
                print(f"[{self.step_name}] Images Skipped: {summary.get('total_skipped', 0)}")
                print(f"[{self.step_name}] Errors: {summary.get('total_errors', 0)}")

                # Platform breakdown
                platforms = summary.get('platforms_processed', [])
                if platforms:
                    print(f"[{self.step_name}] Platforms: {', '.join(platforms)}")

                # Image types breakdown
                image_types = summary.get('image_types_processed', [])
                if image_types:
                    print(f"[{self.step_name}] Image Types: {', '.join(image_types)}")

                # Detailed results
                replacements = android_results.get('replacements', {})
                for image_type, replacement_info in replacements.items():
                    if replacement_info.get('success', False):
                        replaced_count = replacement_info.get('replaced_count', 0)
                        print(f"[{self.step_name}]   {image_type.upper()}: {replaced_count} densities replaced")

            else:
                print(f"[{self.step_name}] Status: FAILED")
                print(f"[{self.step_name}] Error: {self.results.get('error', 'Unknown error')}")

            print(f"[{self.step_name}] {'-' * 60}")

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to print summary: {e}")

    def _show_smart_resize_menu(self) -> None:
        """Show smart resize configuration menu for ANDROID_IMAGE_DATA items"""
        try:
            # Show smart resize configuration menu FIRST
            print()
            print("=" * 80)
            print("SMART RESIZE CONFIGURATION")
            print("=" * 80)
            print("Configure smart resize settings for each processed image.")
            print("Smart resize will create multiple sizes for different density targets.")
            print()
            input("Press any key to continue to smart resize configuration...")
            print()

            # Create menu items for each ANDROID_IMAGE_DATA entry
            menu_items = []
            image_order = ['logo', 'ic_icon', 'notification_icon', 'transa_launcher', 'ic_launcher', 'background', 'splash']

            for image_type in image_order:
                if image_type in ANDROID_IMAGE_DATA:
                    android_data = ANDROID_IMAGE_DATA[image_type]
                    if android_data.get('status') == 'found':
                        menu_item = {
                            'image_type': image_type,
                            'smart_resize': android_data.get('smart_resize', True),
                            'processed_path': android_data.get('processed_path', ''),
                            'final_filename': android_data.get('final_filename', ''),
                            'compression_mode': android_data.get('compression_mode', 'compressed')
                        }
                        menu_items.append(menu_item)

            if not menu_items:
                PrintHelper.warning("No processed images found for smart resize configuration", source=self.step_name)
                return

            # Format menu item display
            def format_menu_item(item: Dict, index: int) -> str:
                resize_display = "[Smart Resize ON]" if item['smart_resize'] else "[Smart Resize OFF]"
                compression_display = f"[{item['compression_mode'].upper()}]"

                # Count targets for this image type
                android_platform_images = platform_image_manager.get_platform_images('android')
                matching_targets = self._find_matching_platform_targets(item['image_type'], item['final_filename'], android_platform_images)
                target_count = len(matching_targets)
                target_info = f"({target_count} targets)" if target_count > 0 else "(no targets)"

                return f"✓ {item['image_type'].upper()}: {item['final_filename']} {compression_display} {resize_display} {target_info}"

            def format_item_details(item: Dict) -> str:
                # Get target information for details
                android_platform_images = platform_image_manager.get_platform_images('android')
                matching_targets = self._find_matching_platform_targets(item['image_type'], item['final_filename'], android_platform_images)

                details = f"Smart Resize Configuration for {item['image_type'].upper()}:\n"
                details += f"  Source File: {item['final_filename']}\n"
                details += f"  Processed Path: {item['processed_path']}\n"
                details += f"  Compression: {item['compression_mode'].upper()}\n"
                details += f"  Replacement Targets: {len(matching_targets)} found\n"

                if item['smart_resize']:
                    details += f"  Smart Resize: ON - Will create optimized sizes for each target\n"
                    if matching_targets:
                        details += f"  Target sizes will be: "
                        sizes = [f"{t.get('recommended_size', (0,0))[0]}x{t.get('recommended_size', (0,0))[1]}" for t in matching_targets]
                        details += ", ".join(set(sizes))  # Remove duplicates
                else:
                    details += f"  Smart Resize: OFF - Will use original size for all targets"

                return details

            def toggle_smart_resize(items: List[Dict], selected_index: int) -> str:
                current_item = items[selected_index]
                current_item['smart_resize'] = not current_item['smart_resize']
                return 'continue'

            # Create interactive menu configuration
            menu_config = {
                'title': 'SMART RESIZE CONFIGURATION MENU',
                'items': menu_items,
                'instructions': 'Configure smart resize for each processed image\\nUse UP/DOWN arrows to navigate, LEFT/RIGHT to toggle smart resize\\nENTER to confirm settings, ESC to use defaults',
                'legend': '[Smart Resize ON] = Create optimized sizes for each target | [Smart Resize OFF] = Use original size\\n(#targets) shows how many platform targets will be replaced\\nLEFT/RIGHT to toggle | ENTER to confirm | ESC for defaults',
                'item_formatter': format_menu_item,
                'detail_formatter': format_item_details,
                'key_handlers': {
                    'left': toggle_smart_resize,
                    'right': toggle_smart_resize
                },
                'allow_quick_select': True,
                'select_message': '[SMART-RESIZE-CONFIRMED] Smart resize configuration applied',
                'quick_select_message': '[SMART-RESIZE-QUICK-CONFIRM] Using default smart resize settings',
                'cancel_message': '[SMART-RESIZE-CANCELLED] Using default smart resize settings',
                'cache_key': 'smart_resize_settings'  # Enable caching
            }

            # Show interactive menu
            result = self.menu_helper.show_interactive_menu(menu_config)

            # Apply smart resize settings to ANDROID_IMAGE_DATA
            self._apply_smart_resize_settings(menu_items, result is not None)

            # AFTER menu is complete, show replacement targets analysis
            self._show_replacement_targets_analysis()

        except Exception as e:
            PrintHelper.error(f"Failed to show smart resize menu: {e}", source=self.step_name)

    def _apply_smart_resize_settings(self, menu_items: List[Dict], confirmed: bool) -> None:
        """Apply smart resize settings to ANDROID_IMAGE_DATA"""
        try:
            PrintHelper.info("Applying smart resize settings...", source=self.step_name)

            for item in menu_items:
                image_type = item['image_type']
                smart_resize = item['smart_resize']

                # Update ANDROID_IMAGE_DATA
                if image_type in ANDROID_IMAGE_DATA:
                    ANDROID_IMAGE_DATA[image_type]['smart_resize'] = smart_resize

                # Show applied setting
                resize_text = "ENABLED" if smart_resize else "DISABLED"
                PrintHelper.info(f"  {image_type.upper()}: Smart Resize {resize_text}", source=self.step_name)

            status_text = "confirmed" if confirmed else "using defaults"
            PrintHelper.success(f"Smart resize settings applied ({status_text})", source=self.step_name)

        except Exception as e:
            PrintHelper.error(f"Failed to apply smart resize settings: {e}", source=self.step_name)

    def _show_replacement_targets_analysis(self) -> None:
        """Show analysis of replacement targets using ANDROID_IMAGE_DATA and PlatformImageManager"""
        try:
            PrintHelper.header("REPLACEMENT TARGETS ANALYSIS", source=self.step_name)
            print("Analyzing which platform targets will be replaced by your processed images...")
            print("This analysis shows the actual replacement that will occur based on your smart resize settings.")
            print()

            # Get Android platform images from PlatformImageManager
            android_platform_images = platform_image_manager.get_platform_images('android')

            if not android_platform_images:
                PrintHelper.warning("No Android platform images found in PlatformImageManager", source=self.step_name)
                return

            PrintHelper.info("Analyzing ANDROID_IMAGE_DATA against PlatformImageManager targets...", source=self.step_name)
            print()

            # Process each ANDROID_IMAGE_DATA item
            for image_type, android_data in ANDROID_IMAGE_DATA.items():
                if android_data.get('status') != 'found':
                    continue

                processed_path = android_data.get('processed_path', '')
                final_filename = android_data.get('final_filename', '')
                smart_resize = android_data.get('smart_resize', True)

                if not processed_path:
                    continue

                PrintHelper.info(f"SOURCE: {image_type.upper()}")
                PrintHelper.info(f"  Processed Path: {processed_path}")
                PrintHelper.info(f"  Type: {image_type}")
                PrintHelper.info(f"  Smart Resize: {'YES' if smart_resize else 'NO'}")

                # Find matching targets in PlatformImageManager
                matching_targets = self._find_matching_platform_targets(image_type, final_filename, android_platform_images)

                if matching_targets:
                    PrintHelper.info(f"  REPLACEMENT TARGETS ({len(matching_targets)} found):")
                    for i, target in enumerate(matching_targets, 1):
                        target_path = target.get('target_path', '')
                        recommended_size = target.get('recommended_size', (0, 0))
                        subtype = target.get('image_subtype', '')
                        current_size = target.get('current_size', (0, 0))

                        PrintHelper.info(f"    {i}. Target Path: {target_path}")
                        PrintHelper.info(f"       Recommended: {recommended_size[0]}x{recommended_size[1]}")
                        PrintHelper.info(f"       Subtype: {subtype}")
                        PrintHelper.info(f"       Current Size: {current_size[0]}x{current_size[1]}")
                else:
                    PrintHelper.warning(f"  ⚠ No matching platform targets found", source=self.step_name)

                print()

        except Exception as e:
            PrintHelper.error(f"Failed to show replacement targets analysis: {e}", source=self.step_name)

    def _find_matching_platform_targets(self, image_type: str, final_filename: str, android_platform_images: List[Dict]) -> List[Dict]:
        """Find matching platform targets based on image type and filename patterns with precise matching"""
        matching_targets = []

        try:
            # Define precise matching rules for each image type to avoid conflicts
            matching_rules = {
                'logo': {
                    'exact_filenames': ['logo.png', 'app_logo.png', 'brand.png', 'company.png'],
                    'filename_patterns': [r'^logo', r'^app_logo', r'^brand', r'^company'],
                    'platform_types': ['logo', 'brand']
                },
                'ic_icon': {
                    'exact_filenames': ['ic_icon.png', 'app_icon.png', 'main_icon.png'],
                    'filename_patterns': [r'^ic_icon$', r'^app_icon$', r'^main_icon$'],  # Strict: exact match only
                    'platform_types': ['ic_icon', 'app_icon'],
                    'exclude_patterns': [r'ic_launcher', r'launcher', r'notification']  # Exclude these patterns
                },
                'ic_launcher': {
                    'exact_filenames': ['ic_launcher.png', 'launcher.png', 'app_launcher.png', 'android_launcher.png'],
                    'filename_patterns': [r'^ic_launcher(?!_)', r'^launcher(?!_)', r'^app_launcher(?!_)', r'^android_launcher(?!_)'],
                    'platform_types': ['ic_launcher', 'launcher'],
                    'directory_patterns': ['mipmap-']  # ic_launcher is typically in mipmap directories
                },
                'notification_icon': {
                    'exact_filenames': ['notification_icon.png', 'notification.png', 'notify_icon.png', 'notify.png', 'status_icon.png'],
                    'filename_patterns': [r'^notification_icon', r'^notification(?!_icon)', r'^notify_icon', r'^notify(?!_)', r'^status_icon'],
                    'platform_types': ['notification_icon', 'notification', 'status_icon']
                },
                'transa_launcher': {
                    'exact_filenames': ['transa_launcher.png', 'transa.png', 'launcher_transa.png', 'trans_launcher.png'],
                    'filename_patterns': [r'^transa_launcher', r'^transa(?!_)', r'^launcher_transa', r'^trans_launcher'],
                    'platform_types': ['transa_launcher', 'transa']
                },
                'background': {
                    'exact_filenames': ['background.png', 'launch_background.png', 'bg.png', 'launch_bg.png', 'app_background.png'],
                    'filename_patterns': [r'^background', r'^launch_background', r'^bg(?!_)', r'^launch_bg', r'^app_background'],
                    'platform_types': ['background', 'launch_background'],
                    'directory_patterns': ['drawable-']  # background is typically in drawable directories
                },
                'splash': {
                    'exact_filenames': ['splash.png', 'launch_image.png', 'startup.png', 'launch_screen.png', 'boot_screen.png'],
                    'filename_patterns': [r'^splash', r'^launch_image', r'^startup', r'^launch_screen', r'^boot_screen'],
                    'platform_types': ['splash', 'launch_image', 'startup']
                }
            }

            rules = matching_rules.get(image_type, {})
            if not rules:
                PrintHelper.warning(f"No matching rules defined for image type: {image_type}", source=self.step_name)
                return matching_targets

            import re

            for platform_image in android_platform_images:
                platform_filename = platform_image.get('filename', '').lower()
                platform_type = platform_image.get('image_type', '').lower()
                target_path = platform_image.get('target_path', '').lower()

                # Remove file extension for pattern matching
                platform_filename_stem = platform_filename.replace('.png', '').replace('.jpg', '').replace('.jpeg', '').replace('.webp', '')

                is_match = False
                match_reason = ""

                # 0. First check exclude patterns - if matched, skip this target
                exclude_patterns = rules.get('exclude_patterns', [])
                is_excluded = False
                for exclude_pattern in exclude_patterns:
                    if re.search(exclude_pattern, platform_filename_stem, re.IGNORECASE):
                        is_excluded = True
                        break

                if is_excluded:
                    continue  # Skip this target

                # 1. Check exact filename matches (highest priority)
                exact_filenames = rules.get('exact_filenames', [])
                for exact_name in exact_filenames:
                    exact_stem = exact_name.replace('.png', '').replace('.jpg', '').replace('.jpeg', '').replace('.webp', '')
                    if platform_filename_stem == exact_stem:
                        is_match = True
                        match_reason = f"exact_filename:{exact_name}"
                        break

                # 2. Check filename patterns (medium priority)
                if not is_match:
                    filename_patterns = rules.get('filename_patterns', [])
                    for pattern in filename_patterns:
                        if re.match(pattern, platform_filename_stem, re.IGNORECASE):
                            is_match = True
                            match_reason = f"filename_pattern:{pattern}"
                            break

                # 3. Check platform type matches (lower priority)
                if not is_match:
                    platform_types = rules.get('platform_types', [])
                    if platform_type in platform_types:
                        is_match = True
                        match_reason = f"platform_type:{platform_type}"

                # 4. Check directory patterns (for ic_launcher and background specificity)
                if not is_match:
                    directory_patterns = rules.get('directory_patterns', [])
                    for dir_pattern in directory_patterns:
                        if dir_pattern in target_path:
                            # Additional check: ensure this is actually the right file type in the right directory
                            if ((image_type == 'ic_launcher' and 'ic_launcher' in platform_filename_stem) or
                                (image_type == 'background' and 'background' in platform_filename_stem)):
                                is_match = True
                                match_reason = f"directory_pattern:{dir_pattern}"
                                break

                if is_match:
                    matching_targets.append(platform_image)
                    PrintHelper.info(f"  Match: {image_type} -> {platform_filename} (reason: {match_reason})", source=self.step_name)

        except Exception as e:
            PrintHelper.error(f"Error finding matching targets: {e}", source=self.step_name)

        return matching_targets

    def _show_backup_summary(self) -> None:
        """Show summary of backup operations"""
        try:
            if not self.backup_manager:
                return

            PrintHelper.info(f"\\n[BACKUP-SUMMARY] BACKUP OPERATION SUMMARY", source=self.step_name)
            PrintHelper.info(f"{'=' * 80}")

            backup_summary = self.backup_manager.get_backup_summary()

            if 'error' in backup_summary:
                PrintHelper.error(f"Failed to get backup summary: {backup_summary['error']}", source=self.step_name)
                return

            backup_count = backup_summary['backup_count']
            total_size_mb = backup_summary['total_size_mb']
            backup_dir = backup_summary['backup_directory']

            PrintHelper.info(f"Backup Directory: {backup_dir}")
            PrintHelper.info(f"Files Backed Up: {backup_count}")
            PrintHelper.info(f"Total Backup Size: {total_size_mb}MB")

            if backup_count > 0:
                PrintHelper.info(f"\\nBacked Up Files:")
                for i, backup_file in enumerate(backup_summary['files'][:10], 1):  # Show first 10 files
                    PrintHelper.info(f"  {i}. {backup_file}")

                if backup_count > 10:
                    PrintHelper.info(f"  ... and {backup_count - 10} more files")

                PrintHelper.success(f"✓ All original files have been safely backed up", source=self.step_name)
            else:
                PrintHelper.info("No files were backed up during this operation")

            PrintHelper.info(f"{'=' * 80}")

        except Exception as e:
            PrintHelper.error(f"Failed to show backup summary: {e}", source=self.step_name)


def main():
    """Main function for testing Step 4 controller"""
    print("[STEP-4] [TEST] Step 4 Image Replacement Controller - Standalone Test")

    # Test with current directory
    current_dir = Path.cwd()
    controller = Step4ImageReplacementController()

    if controller.initialize(current_dir, "app_bank"):
        results = controller.execute_step4_replacement()
        controller.print_step4_summary()
    else:
        print("[STEP-4] [TEST] Initialization failed")


if __name__ == "__main__":
    main()