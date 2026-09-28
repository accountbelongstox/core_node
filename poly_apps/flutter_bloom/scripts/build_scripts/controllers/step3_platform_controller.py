#!/usr/bin/env python3
"""
Step 3 Platform Controller
Orchestrates platform-specific image scanning and analysis
"""

import sys
from pathlib import Path
from typing import Dict, Optional, Any

# Import using relative path from build_scripts root
from shared.data_exchange.unified_variable_system import unified_vars, PlatformTargetInfo
from shared.standard_image_data import platform_image_manager
from utils.image_classifier import ImageClassifier
from utils.platform_image_scanner import PlatformImageScanner
from utils.platform_specs.platform_specs_manager import PlatformSpecsManager
from utils.print_helper import PrintHelper

# Use PlatformSpecsManager as the unified platform specifications manager


class Step3PlatformController:
    """
    Step 3 Controller: Platform Images Scanning
    Manages the orchestration of platform-specific image scanning and analysis
    """

    def __init__(self):
        self.step_name = "STEP-3"
        self.step_description = "Platform Images Scanning"
        self.platform_scanner = PlatformImageScanner()
        self.platform_specs = PlatformSpecsManager()
        self.image_classifier = ImageClassifier()
        self.results = {}
        self.target_platform = None
        self.data_exchange = None

    def initialize(self, temp_build_root: Path, app_name: str) -> bool:
        """
        Initialize Step 3 controller with build parameters

        Args:
            temp_build_root: Path to temporary build directory
            app_name: Name of the application being built

        Returns:
            bool: True if initialization successful, False otherwise
        """
        try:
            PrintHelper.info(f"Initializing {self.step_description}", source=self.step_name)
            PrintHelper.info(f"Build Root: {temp_build_root}", source=self.step_name)
            PrintHelper.info(f"App Name: {app_name}", source=self.step_name)

            self.temp_build_root = temp_build_root
            self.app_name = app_name

            # Initialize unified data exchange system
            self.data_exchange = unified_vars
            PrintHelper.info(f"Data exchange system initialized", source=self.step_name)

            # Get target platform from build configuration (direct file variable access)
            self.target_platform = unified_vars.get_file_variable(unified_vars.KEY_BUILD_PLATFORM, "").lower()
            PrintHelper.info(f"Target Platform: {self.target_platform or 'Not specified'}", source=self.step_name)

            # Validate build root exists
            if not temp_build_root.exists():
                PrintHelper.error(f"Build root directory does not exist: {temp_build_root}", source=self.step_name)
                return False

            # Check for platform directories
            platform_dirs = ['android', 'macos', 'windows', 'web']
            existing_platforms = []

            for platform in platform_dirs:
                platform_path = temp_build_root / platform
                if platform_path.exists():
                    existing_platforms.append(platform)

            PrintHelper.info(f"Found {len(existing_platforms)} platform directories: {', '.join(existing_platforms)}", source=self.step_name)

            if not existing_platforms:
                PrintHelper.warning(f"No platform directories found, but continuing...", source=self.step_name)

            PrintHelper.info(f"Step 3 controller initialized successfully", source=self.step_name)
            return True

        except Exception as e:
            PrintHelper.error(f"Failed to initialize Step 3 controller: {e}", source=self.step_name)
            return False

    def execute_step3_scanning(self) -> Dict[str, Any]:
        """
        Execute Step 3: Platform Images Scanning

        Returns:
            Dict containing scan results and metadata
        """
        try:
            PrintHelper.info("\n" + "=" * 80, source=self.step_name)
            PrintHelper.info(f" {self.step_description.upper()}")
            PrintHelper.info(f" {'=' * 80}")

            PrintHelper.info(f" [EXECUTE] Starting platform-specific images analysis...")

            # Execute platform scanning
            PrintHelper.info(f" [STEP-3-1] Scanning platform directories for images...")
            platform_results = self.platform_scanner.scan_all_platforms(self.temp_build_root)

            # Enhanced platform display with target highlighting
            PrintHelper.info(f"\n[STEP-3-2] Enhanced platform analysis with target highlighting...", source=self.step_name)
            self._enhance_platform_display(platform_results)

            # Store results
            self.results = {
                'step': 3,
                'step_name': self.step_name,
                'step_description': self.step_description,
                'success': True,
                'temp_build_root': str(self.temp_build_root),
                'app_name': self.app_name,
                'target_platform': self.target_platform,
                'platform_results': platform_results,
                'summary': self._generate_summary(platform_results)
            }

            # Save results to unified data exchange
            if self.save_results_to_unified_data():
                PrintHelper.success(f"Results saved to unified data exchange", source=self.step_name)
            else:
                PrintHelper.error(f"Failed to save results to unified data exchange", source=self.step_name)

            PrintHelper.info(f" [COMPLETE] Platform images scanning completed successfully")

            return self.results

        except Exception as e:
            error_message = f"Step 3 execution failed: {e}"
            PrintHelper.error(f"{error_message}", source=self.step_name)

            self.results = {
                'step': 3,
                'step_name': self.step_name,
                'step_description': self.step_description,
                'success': False,
                'error': error_message,
                'temp_build_root': str(getattr(self, 'temp_build_root', '')),
                'app_name': getattr(self, 'app_name', ''),
                'platform_results': {},
                'summary': {}
            }

            return self.results

    def _enhance_platform_display(self, platform_results: Dict) -> None:
        """
        Enhanced platform display with target platform highlighting and specifications
        """
        try:
            # Clear platform image manager before collecting new data
            for platform in platform_image_manager.get_all_platforms():
                platform_image_manager.clear_platform(platform)

            PrintHelper.info(f"\n[PLATFORM-ANALYSIS] ENHANCED PLATFORM DISPLAY", source=self.step_name)
            PrintHelper.info(f" {'=' * 80}")

            if 'platforms' not in platform_results:
                PrintHelper.error(f"No platform data available", source=self.step_name)
                return

            platforms = platform_results['platforms']

            # Platform display order and info
            platform_info = {
                'android': {'name': 'ANDROID PLATFORM IMAGES', 'available': False},
                'ios': {'name': 'IOS PLATFORM IMAGES', 'available': False},
                'web': {'name': 'WEB PLATFORM IMAGES', 'available': False},
                'windows': {'name': 'WINDOWS PLATFORM IMAGES', 'available': False},
                'macos': {'name': 'MACOS PLATFORM IMAGES', 'available': False}
            }

            # Check platform availability
            for platform_name, platform_data in platforms.items():
                if platform_name in platform_info:
                    platform_info[platform_name]['available'] = platform_data.get('exists', False)

            # Display platforms with target highlighting
            for platform_name, info in platform_info.items():
                is_target = platform_name == self.target_platform
                is_available = info['available']

                if is_target and is_available:
                    # Highlight target platform - focused attention
                    PrintHelper.info(f" [PLATFORM-TREE] >>> {info['name']} <<< (TARGET PLATFORM)")
                    PrintHelper.info(f" {'*' * 60}")
                    self._display_platform_details(platform_name, platforms.get(platform_name, {}), True)
                    PrintHelper.info(f" {'*' * 60}")
                elif is_available:
                    # Available but not target - reduced emphasis
                    PrintHelper.info(f" [PLATFORM-TREE] {info['name']} (Available)")
                    PrintHelper.info(f" {'-' * 40}")
                    self._display_platform_details(platform_name, platforms.get(platform_name, {}), False)
                else:
                    # Not available - grayed out effect with ASCII
                    PrintHelper.info(f" [PLATFORM-TREE] {info['name']} (Not Available)")

                PrintHelper.info("")

            # Show platform image manager summary and verify data binding
            self._show_platform_manager_summary()
            self._verify_data_binding(platform_results)

        except Exception as e:
            PrintHelper.error(f"Failed to display enhanced platform info: {e}", source=self.step_name)

    def _display_platform_details(self, platform_name: str, platform_data: Dict, is_target: bool) -> None:
        """
        Display detailed platform information with classification and specifications
        """
        try:
            images = platform_data.get('images', [])
            total_size = platform_data.get('total_size', 0)

            if not images:
                PrintHelper.info(f"   No images found")
                return

            PrintHelper.info(f"   Images Found: {len(images)} | Total Size: {total_size / 1024:.1f}KB")

            # Get platform specifications
            platform_specs = self.platform_specs.get_platform_specs(platform_name)

            # Classify and display images with enhanced information
            for i, image in enumerate(images):  # Show all images
                file_path = image.get('path', '')
                width = image.get('width', 0)
                height = image.get('height', 0)
                size_bytes = image.get('size_bytes', 0)
                name = image.get('name', '')

                # Classify image
                classification = self.image_classifier.classify_image(file_path, width, height)

                # Format size info
                size_kb = size_bytes / 1024 if size_bytes > 0 else 0
                dimensions = f"{width}x{height}" if width > 0 and height > 0 else "dimensions unavailable"

                # Enhanced display format
                image_type = classification.get('primary_type', 'unknown')
                subtype = classification.get('subtype', '')

                # Determine size status and recommendations
                size_status = 'unknown'
                size_difference = {}
                recommended_size = (0, 0)

                # Prefix for target platform emphasis
                prefix = "   >>>" if is_target else "      "

                PrintHelper.info(f"{prefix} {name}")
                PrintHelper.info(f"{prefix}     Type: {image_type.title()}")
                if subtype and subtype != image_type:
                    PrintHelper.info(f"{prefix}     Subtype: {subtype.replace('_', ' ').title()}")
                # Show platform-specific size recommendations for all platforms
                if platform_specs and image_type in ['icon', 'background', 'splash'] and width > 0 and height > 0:
                    # Use path-based recommendation for better accuracy
                    spec_size = self.platform_specs.get_recommended_size_for_path(
                        platform_name, file_path, image_type
                    )
                    if spec_size:
                        if spec_size != (0, 0):
                            # Calculate size difference
                            width_diff = width - spec_size[0]
                            height_diff = height - spec_size[1]

                            # Determine status based on difference percentage
                            width_pct = (width_diff / spec_size[0]) * 100 if spec_size[0] > 0 else 0
                            height_pct = (height_diff / spec_size[1]) * 100 if spec_size[1] > 0 else 0
                            max_diff_pct = max(abs(width_pct), abs(height_pct))

                            if max_diff_pct == 0:
                                status_indicator = "[OK] PERFECT"
                                size_status = "PERFECT"
                                diff_text = ""
                            elif max_diff_pct <= 5:
                                status_indicator = "[OK] GOOD"
                                size_status = "GOOD"
                                diff_text = f" (diff: {width_diff:+}w, {height_diff:+}h)"
                            elif max_diff_pct <= 20:
                                status_indicator = "[WARN] WARNING"
                                size_status = "WARNING"
                                diff_text = f" (diff: {width_diff:+}w, {height_diff:+}h, {width_pct:+.1f}%w, {height_pct:+.1f}%h)"
                            else:
                                status_indicator = "[ERR] ERROR"
                                size_status = "ERROR"
                                diff_text = f" (diff: {width_diff:+}w, {height_diff:+}h, {width_pct:+.1f}%w, {height_pct:+.1f}%h)"

                            # Store size difference information
                            recommended_size = spec_size
                            size_difference = {
                                'width_diff': width_diff,
                                'height_diff': height_diff,
                                'width_pct': width_pct,
                                'height_pct': height_pct,
                                'max_diff_pct': max_diff_pct
                            }

                            # Display size and recommendation on adjacent lines
                            PrintHelper.info(f"{prefix}     Size: {dimensions} ({size_kb:.1f}KB)")
                            PrintHelper.info(f"{prefix} Recommended: {spec_size[0]}x{spec_size[1]} {status_indicator}{diff_text}")
                        else:
                            # Standard display without recommendations
                            PrintHelper.info(f"{prefix}     Size: {dimensions} ({size_kb:.1f}KB)")
                            PrintHelper.info(f"{prefix} Recommended: No standard spec found")
                    else:
                        # Standard display without recommendations
                        PrintHelper.info(f"{prefix}     Size: {dimensions} ({size_kb:.1f}KB)")
                        PrintHelper.info(f"{prefix} Recommended: No standard spec found")
                elif width <= 0 or height <= 0:
                    # Dimensions not available (e.g., for ICO files)
                    PrintHelper.info(f"{prefix}     Size: {dimensions} ({size_kb:.1f}KB)")
                    PrintHelper.info(f"{prefix} Recommended: Dimensions unavailable for this file type")
                else:
                    # Standard display for non-supported image types
                    PrintHelper.info(f"{prefix}     Size: {dimensions} ({size_kb:.1f}KB)")

                PrintHelper.info(f"{prefix}     Path: {file_path}")

                # Show recommendations for target platform
                if is_target and classification.get('recommendations'):
                    recommendations = classification.get('recommendations', [])[:2]  # Limit recommendations
                    for rec in recommendations:
                        PrintHelper.info(f"{prefix}     Recommendation: {rec}")

                # Add image data to platform image manager
                from datetime import datetime
                image_data_for_manager = {
                    'name': name,
                    'path': file_path,
                    'width': width,
                    'height': height,
                    'size_bytes': size_bytes,
                    'format': image.get('format', ''),
                    'classification': classification,
                    'recommended_size': recommended_size,
                    'size_status': size_status,
                    'size_difference': size_difference,
                    'scan_timestamp': datetime.now().isoformat(),
                    'relative_path': image.get('relative_path', '')
                }

                platform_image_manager.add_scanned_image(platform_name, image_data_for_manager)

                PrintHelper.info("")

            # Show missing expected files for Android platform
            if platform_name == 'android' and self.platform_specs:
                self._show_missing_expected_files(platform_name, platform_data, is_target)

        except Exception as e:
            PrintHelper.error(f"Failed to display platform details: {e}", source=self.step_name)

    def _show_platform_manager_summary(self) -> None:
        """Show summary of data collected in platform image manager"""
        try:
            PrintHelper.info("\n[PLATFORM-IMAGE-MANAGER] COLLECTED DATA SUMMARY", source=self.step_name)
            PrintHelper.info("=" * 80)

            for platform in platform_image_manager.get_all_platforms():
                summary = platform_image_manager.get_platform_summary(platform)

                if summary['total_images'] > 0:
                    PrintHelper.info(f"Platform: {platform.upper()}")
                    PrintHelper.info(f"  Total Images: {summary['total_images']}")
                    PrintHelper.info(f"  Total Size: {summary['total_size'] / 1024:.1f}KB")
                    PrintHelper.info(f"  Types: {dict(summary['types'])}")
                    PrintHelper.info(f"  Size Analysis: {summary['perfect_sizes']} Perfect, {summary['error_sizes']} Errors, {summary['warning_sizes']} Warnings")

                    # Show some sample images
                    sample_images = platform_image_manager.get_platform_images(platform)[:3]
                    for img in sample_images:
                        PrintHelper.info(f"    Sample: {img['filename']} ({img['image_type']}) - {img['size_status']}")

                    PrintHelper.info("")

        except Exception as e:
            PrintHelper.error(f"Failed to show platform manager summary: {e}", source=self.step_name)

    def _verify_data_binding(self, platform_results: Dict) -> None:
        """Verify data binding between scanning results and platform image manager"""
        try:
            PrintHelper.info("\n[DATA-BINDING] VERIFICATION ANALYSIS", source=self.step_name)
            PrintHelper.info("=" * 80)

            platforms = platform_results.get('platforms', {})

            for platform_name, platform_data in platforms.items():
                if not platform_data.get('exists', False):
                    continue

                # Count images from original scan
                original_count = len(platform_data.get('images', []))

                # Count images in platform manager
                manager_summary = platform_image_manager.get_platform_summary(platform_name)
                manager_count = manager_summary['total_images']

                # Verify data consistency
                status = "✓ SYNCED" if original_count == manager_count else "✗ MISMATCH"

                PrintHelper.info(f"Platform: {platform_name.upper()}")
                PrintHelper.info(f"  Original Scan: {original_count} images")
                PrintHelper.info(f"  Manager Store: {manager_count} images")
                PrintHelper.info(f"  Status: {status}")

                if original_count != manager_count:
                    PrintHelper.warning(f"  ⚠ Data binding issue detected for {platform_name}", source=self.step_name)
                else:
                    PrintHelper.success(f"  ✓ Data successfully bound to standard_image_data.py", source=self.step_name)

                PrintHelper.info("")

            PrintHelper.info("Data binding verification complete", source=self.step_name)

        except Exception as e:
            PrintHelper.error(f"Failed to verify data binding: {e}", source=self.step_name)

    def _show_missing_expected_files(self, platform_name: str, platform_data: Dict, is_target: bool) -> None:
        """Show missing expected files based on platform specifications"""
        try:
            if platform_name != 'android':
                return

            # Get existing files
            existing_files = set()
            for image in platform_data.get('images', []):
                file_path = image.get('path', '')
                if 'background.png' in file_path:
                    # Extract directory pattern (e.g., drawable-hdpi, drawable-night-v21)
                    if 'res/' in file_path:
                        res_part = file_path.split('res/')[1]
                        dir_name = res_part.split('/')[0]
                        existing_files.add(dir_name)

            # Expected Android directories for background images
            expected_directories = {
                'drawable-mdpi': 'Medium density (160 dpi)',
                'drawable-hdpi': 'High density (240 dpi)',
                'drawable-xhdpi': 'Extra high density (320 dpi)',
                'drawable-xxhdpi': 'Extra extra high density (480 dpi)',
                'drawable-xxxhdpi': 'Extra extra extra high density (640 dpi)',
                'drawable-night': 'Night mode',
                'drawable-night-hdpi': 'Night mode high density',
                'drawable-night-xhdpi': 'Night mode extra high density',
                'drawable-night-xxhdpi': 'Night mode extra extra high density',
                'drawable-v21': 'API level 21+',
                'drawable-night-v21': 'Night mode API level 21+'
            }

            # Find missing directories
            missing_directories = []
            for expected_dir, description in expected_directories.items():
                if expected_dir not in existing_files:
                    missing_directories.append({'dir': expected_dir, 'desc': description})

            # Display missing expected files
            if missing_directories:
                prefix = "   >>>" if is_target else "      "
                PrintHelper.info(f"{prefix} MISSING EXPECTED FILES:")
                for missing in missing_directories:
                    expected_path = f"android/app/src/main/res/{missing['dir']}/background.png"
                    PrintHelper.info(f"{prefix}     Expected: {expected_path}")
                    PrintHelper.info(f"{prefix}     Purpose: {missing['desc']}")
                PrintHelper.info("")

        except Exception as e:
            PrintHelper.error(f"Failed to show missing expected files: {e}", source=self.step_name)

    def _generate_summary(self, platform_results: Dict) -> Dict[str, Any]:
        """
        Generate summary of platform scanning results

        Args:
            platform_results: Results from platform scanner

        Returns:
            Dict containing summary information
        """
        try:
            summary = {
                'total_platforms_found': 0,
                'total_images_found': platform_results.get('total_images_found', 0),
                'total_size_bytes': platform_results.get('total_size', 0),
                'platform_breakdown': {},
                'image_categories': {
                    'app_icons': 0,
                    'launchers': 0,
                    'backgrounds': 0,
                    'splash_screens': 0,
                    'notifications': 0,
                    'others': 0
                }
            }

            if 'platforms' in platform_results:
                platforms = platform_results['platforms']

                for platform_name, platform_info in platforms.items():
                    if platform_info.get('exists', False):
                        summary['total_platforms_found'] += 1

                    summary['platform_breakdown'][platform_name] = {
                        'exists': platform_info.get('exists', False),
                        'image_count': platform_info.get('total_images', 0),
                        'total_size': platform_info.get('total_size', 0)
                    }

                    # Categorize images
                    for image in platform_info.get('images', []):
                        filename = image.get('name', '').lower()

                        if 'icon' in filename:
                            if 'launcher' in filename:
                                summary['image_categories']['launchers'] += 1
                            elif 'notification' in filename:
                                summary['image_categories']['notifications'] += 1
                            else:
                                summary['image_categories']['app_icons'] += 1
                        elif 'background' in filename:
                            summary['image_categories']['backgrounds'] += 1
                        elif 'splash' in filename:
                            summary['image_categories']['splash_screens'] += 1
                        else:
                            summary['image_categories']['others'] += 1

            return summary

        except Exception as e:
            PrintHelper.warning(f"Failed to generate summary: {e}", source=self.step_name)
            return {'error': str(e)}

    def get_results(self) -> Dict[str, Any]:
        """
        Get the results of Step 3 execution

        Returns:
            Dict containing all results from Step 3
        """
        return self.results

    def print_step3_summary(self) -> None:
        """Print a concise summary of Step 3 results"""
        try:
            if not self.results:
                PrintHelper.info(f" [SUMMARY] No results available")
                return

            PrintHelper.info(f"\n[SUMMARY] STEP 3 COMPLETION SUMMARY", source=self.step_name)
            PrintHelper.info(f" {'-' * 60}")

            if self.results.get('success', False):
                summary = self.results.get('summary', {})
                platform_results = self.results.get('platform_results', {})

                PrintHelper.info(f" Status: SUCCESS")
                PrintHelper.info(f" Platforms Found: {summary.get('total_platforms_found', 0)}/4")
                PrintHelper.info(f" Total Images: {summary.get('total_images_found', 0)}")

                if summary.get('total_size_bytes', 0) > 0:
                    size_mb = summary['total_size_bytes'] / (1024 * 1024)
                    PrintHelper.info(f" Total Size: {size_mb:.2f}MB")

                # Platform breakdown with ASCII-only display
                breakdown = summary.get('platform_breakdown', {})

                for platform, info in breakdown.items():
                    status = "YES" if info['exists'] else "NO"
                    is_target = platform == self.target_platform

                    if is_target:
                        PrintHelper.info(f" >>> {platform.upper()}: {status} ({info['image_count']} images) <<< TARGET")
                    else:
                        PrintHelper.info(f"     {platform.upper()}: {status} ({info['image_count']} images)")

                # Image categories
                categories = summary.get('image_categories', {})
                total_categorized = sum(categories.values())
                if total_categorized > 0:
                    PrintHelper.info(f" Image Types: Icons({categories.get('app_icons', 0)}), Launchers({categories.get('launchers', 0)}), Backgrounds({categories.get('backgrounds', 0)}), Others({categories.get('others', 0)})")

            else:
                PrintHelper.info(f" Status: FAILED")
                PrintHelper.info(f" Error: {self.results.get('error', 'Unknown error')}")

            PrintHelper.info(f" {'-' * 60}")

        except Exception as e:
            PrintHelper.error(f"Failed to print summary: {e}", source=self.step_name)

    def save_results_to_unified_data(self) -> bool:
        """
        Save Step 3 results to unified data exchange for use by subsequent steps

        Returns:
            bool: True if saved successfully, False otherwise
        """
        try:
            if not self.data_exchange:
                PrintHelper.error("Data exchange not initialized", source=self.step_name)
                return False

            if not self.results or not self.results.get('success'):
                PrintHelper.error("No successful results to save", source=self.step_name)
                return False

            platform_results = self.results.get('platform_results', {})
            if 'platforms' not in platform_results:
                PrintHelper.error("No platform data to save", source=self.step_name)
                return False

            # Convert results to PlatformTargetInfo format
            platform_targets = []

            for platform_name, platform_info in platform_results['platforms'].items():
                for image in platform_info.get('images', []):
                    target_info = PlatformTargetInfo(
                        platform=platform_name,
                        image_type=self._classify_image_type(image.get('name', '')),
                        target_path=image.get('path', ''),
                        target_filename=image.get('name', ''),
                        file_size_bytes=image.get('size_bytes', 0),
                        format=image.get('format', ''),
                        dimensions=(image.get('width', 0), image.get('height', 0)),
                        classification_score=1.0,  # Default high confidence
                        file_hash=image.get('hash', ''),
                        last_modified=image.get('last_modified', ''),
                        permissions=image.get('permissions', '')
                    )
                    platform_targets.append(target_info)

            # Save to unified data exchange (direct file variable access)
            try:
                import json
                from datetime import datetime
                from dataclasses import asdict

                # Group by platform
                platforms_data = {}
                for target in platform_targets:
                    platform = target.platform
                    if platform not in platforms_data:
                        platforms_data[platform] = []
                    platforms_data[platform].append(asdict(target))

                # Create JSON data structure
                data = {
                    "timestamp": datetime.now().isoformat(),
                    "step": 3,
                    "platform_targets": platforms_data
                }

                # Save JSON data as string to file variable
                json_str = json.dumps(data, indent=2, ensure_ascii=False)
                success = self.data_exchange.set_file_variable(self.data_exchange.KEY_PLATFORM_TARGETS_JSON, json_str)

                if success:
                    PrintHelper.info(f"Platform results saved to file variable: {len(platform_targets)} targets across {len(platform_results['platforms'])} platforms", source=self.step_name)
                    return True
                else:
                    PrintHelper.error(f"Failed to save platform results to file variable", source=self.step_name)
                    return False
            except Exception as e:
                PrintHelper.error(f"Failed to save platform results: {e}", source=self.step_name)
                return False

        except Exception as e:
            PrintHelper.error(f"Failed to save results to unified data exchange: {e}", source=self.step_name)
            return False

    def _classify_image_type(self, filename: str) -> str:
        """Classify image type based on filename"""
        filename_lower = filename.lower()

        if 'icon' in filename_lower:
            if 'launcher' in filename_lower:
                return 'ic_launcher'
            elif 'notification' in filename_lower:
                return 'notification_icon'
            else:
                return 'ic_icon'
        elif 'background' in filename_lower:
            return 'background'
        elif 'splash' in filename_lower:
            return 'splash'
        elif 'logo' in filename_lower:
            return 'logo'
        else:
            return 'unknown'

    def save_results_to_cache(self, cache_dir: Path) -> bool:
        """
        Save Step 3 results to cache directory for use by subsequent steps

        Args:
            cache_dir: Path to cache directory

        Returns:
            bool: True if saved successfully, False otherwise
        """
        try:
            cache_dir.mkdir(exist_ok=True)

            # Save platform results
            platform_results_file = cache_dir / "step3_platform_results.txt"
            with open(platform_results_file, "w", encoding="utf-8") as f:
                f.write("# Step 3 Platform Images Results\n")
                f.write(f"# Generated for app: {self.app_name}\n")
                f.write(f"# Build root: {self.temp_build_root}\n")
                f.write("# Format: platform|image_path|image_name|size_bytes|format\n")

                platform_results = self.results.get('platform_results', {})
                if 'platforms' in platform_results:
                    for platform_name, platform_info in platform_results['platforms'].items():
                        for image in platform_info.get('images', []):
                            f.write(f"{platform_name}|{image['path']}|{image['name']}|{image['size_bytes']}|{image['format']}\n")

            PrintHelper.info(f" [CACHE] Platform results saved to: {platform_results_file}")
            return True

        except Exception as e:
            PrintHelper.error(f"Failed to save results to cache: {e}", source=self.step_name)
            return False


def main():
    """Main function for testing Step 3 controller"""
    PrintHelper.info("[TEST] Step 3 Platform Controller - Standalone Test", source="STEP-3")

    # Test with current directory
    current_dir = Path.cwd()
    controller = Step3PlatformController()

    if controller.initialize(current_dir, "app_bank"):
        results = controller.execute_step3_scanning()
        controller.print_step3_summary()

        # Test cache saving
        cache_dir = current_dir / ".cache"
        controller.save_results_to_cache(cache_dir)
    else:
        PrintHelper.info("[TEST] Initialization failed", source="STEP-3")


if __name__ == "__main__":
    main()