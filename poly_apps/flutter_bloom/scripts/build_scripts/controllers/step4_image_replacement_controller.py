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
from core.gvar.flutter_global_var import flutter_gvar
from utils.smart_image_resizer import SmartImageResizer


class Step4ImageReplacementController:
    """
    Step 4 Controller: Platform Image Replacement
    Manages intelligent replacement of platform-specific images with processed assets
    """

    def __init__(self):
        self.step_name = "STEP-4"
        self.step_description = "Platform Image Replacement"
        self.smart_resizer = SmartImageResizer()
        self.results = {}
        self.temp_build_root = None
        self.app_name = None

        # Platform-specific target definitions
        self.android_targets = {
            'ic_launcher': {
                'mipmap-mdpi': (48, 48),        # 160 dpi
                'mipmap-hdpi': (72, 72),        # 240 dpi
                'mipmap-xhdpi': (96, 96),       # 320 dpi
                'mipmap-xxhdpi': (144, 144),    # 480 dpi
                'mipmap-xxxhdpi': (192, 192),   # 640 dpi
                'mipmap': (48, 48)              # default/fallback
            },
            'notification_icon': {
                'mipmap-mdpi': (24, 24),        # 160 dpi
                'mipmap-hdpi': (36, 36),        # 240 dpi
                'mipmap-xhdpi': (48, 48),       # 320 dpi
                'mipmap-xxhdpi': (72, 72),      # 480 dpi
                'mipmap-xxxhdpi': (96, 96),     # 640 dpi
                'mipmap': (24, 24)              # default/fallback
            },
            'transa_launcher': {
                'mipmap-mdpi': (48, 48),        # 160 dpi
                'mipmap-hdpi': (72, 72),        # 240 dpi
                'mipmap-xhdpi': (96, 96),       # 320 dpi
                'mipmap-xxhdpi': (144, 144),    # 480 dpi
                'mipmap-xxxhdpi': (192, 192),   # 640 dpi
                'mipmap': (48, 48)              # default/fallback
            },
            'background': {
                'drawable-mdpi': (320, 480),    # 160 dpi
                'drawable-hdpi': (480, 800),    # 240 dpi
                'drawable-xhdpi': (720, 1280),  # 320 dpi
                'drawable-xxhdpi': (1080, 1920), # 480 dpi
                'drawable-xxxhdpi': (1440, 2560), # 640 dpi
                'drawable': (320, 480)          # default/fallback
            }
        }

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
        """Load processed images information from Step 2 cache"""
        try:
            # Look for processed images in the cache directory
            processed_images = {}

            # Try to find processed images by examining the cache structure
            if self.processed_images_dir.exists():
                for image_file in self.processed_images_dir.rglob("*.png"):
                    # Extract image type from path structure
                    relative_path = image_file.relative_to(self.processed_images_dir)
                    path_parts = relative_path.parts

                    # Try to determine image type from filename or path
                    filename = image_file.stem.lower()

                    # Map common image types
                    image_type = None
                    if 'logo' in filename:
                        # This could be used for ic_launcher, notification_icon, transa_launcher
                        image_type = 'IC_LAUNCHER'  # Primary mapping
                    elif 'background' in filename:
                        image_type = 'BACKGROUND'
                    elif 'icon' in filename:
                        image_type = 'IC_ICON'

                    if image_type:
                        processed_images[image_type] = {
                            'processed_path': str(image_file),
                            'filename': image_file.name,
                            'size_bytes': image_file.stat().st_size
                        }
                        print(f"[{self.step_name}] [CACHE] Found processed image: {image_type} -> {image_file}")

            # Alternative: try to parse from build logs if available
            if not processed_images:
                # Look for task.txt or similar log files
                task_file = self.temp_build_root.parent / "task.txt"
                if task_file.exists():
                    processed_images = self._parse_processed_images_from_log(task_file)

            return processed_images

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to load processed images info: {e}")
            return {}

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

            # TODO: Add other image types (notification_icon, transa_launcher, background)
            # This provides a framework for future expansion

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

            source_image_path = Path(ic_launcher_info['processed_path'])
            if not source_image_path.exists():
                return {'success': False, 'error': f'Source image not found: {source_image_path}'}

            print(f"[{self.step_name}] [IC_LAUNCHER] Source image: {source_image_path}")

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

                print(f"[{self.step_name}] [IC_LAUNCHER] Processing {density_dir}: {target_size[0]}x{target_size[1]}")

                if not target_file.exists():
                    print(f"[{self.step_name}] [IC_LAUNCHER] [SKIP] Target file not found: {target_file}")
                    results['skipped_count'] += 1
                    continue

                # Create backup of original
                backup_file = target_file.with_suffix('.png.backup')
                if not backup_file.exists():
                    shutil.copy2(target_file, backup_file)
                    print(f"[{self.step_name}] [IC_LAUNCHER] Created backup: {backup_file.name}")

                # Use smart resizer to create appropriately sized image
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
                        'resize_result': resize_result
                    }
                    print(f"[{self.step_name}] [IC_LAUNCHER] ✓ Replaced: {target_file}")
                else:
                    results['skipped_count'] += 1
                    print(f"[{self.step_name}] [IC_LAUNCHER] ✗ Failed: {resize_result.get('error', 'Unknown error')}")

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