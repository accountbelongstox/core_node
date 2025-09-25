#!/usr/bin/env python3
"""
Step 3 Platform Controller
Orchestrates platform-specific image scanning and analysis
"""

from pathlib import Path
from typing import Dict, Optional, Any
import sys

# Import using relative path from build_scripts root
from core.gvar.flutter_global_var import flutter_gvar
from utils.platform_image_scanner import PlatformImageScanner
from utils.image_classifier import ImageClassifier

try:
    from utils.platform_specs.platform_specs_manager import PlatformSpecsManager
    PlatformSpecsMap = PlatformSpecsManager  # Compatibility alias
except ImportError as e:
    print(f"[STEP-3] [ERROR] Failed to import PlatformSpecsManager: {e}")
    # Try fallback to old system
    try:
        from utils.platform_specs_map import PlatformSpecsMap
    except ImportError as e2:
        print(f"[STEP-3] [ERROR] Failed to import legacy PlatformSpecsMap: {e2}")
        # Create fallback class
        class PlatformSpecsMap:
            def get_platform_specs(self, platform):
                return {}

            def get_recommended_size(self, platform, file_path, filename):
                return None

            def get_best_size_recommendation(self, platform, image_type, current_size):
                return None

            def calculate_size_difference(self, actual_size, recommended_size):
                return {'status': 'unknown', 'message': 'PlatformSpecsMap not available'}


class Step3PlatformController:
    """
    Step 3 Controller: Platform Images Scanning
    Manages the orchestration of platform-specific image scanning and analysis
    """

    def __init__(self):
        self.step_name = "STEP-3"
        self.step_description = "Platform Images Scanning"
        self.platform_scanner = PlatformImageScanner()
        self.platform_specs = PlatformSpecsMap()
        self.image_classifier = ImageClassifier()
        self.results = {}
        self.target_platform = None

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
            print(f"[{self.step_name}] [INIT] Initializing {self.step_description}")
            print(f"[{self.step_name}] [INIT] Build Root: {temp_build_root}")
            print(f"[{self.step_name}] [INIT] App Name: {app_name}")

            self.temp_build_root = temp_build_root
            self.app_name = app_name

            # Get target platform from build configuration
            build_info = flutter_gvar.get_build_info()
            self.target_platform = build_info.get("platform", "").lower()
            print(f"[{self.step_name}] [INIT] Target Platform: {self.target_platform or 'Not specified'}")

            # Validate build root exists
            if not temp_build_root.exists():
                print(f"[{self.step_name}] [ERROR] Build root directory does not exist: {temp_build_root}")
                return False

            # Check for platform directories
            platform_dirs = ['android', 'macos', 'windows', 'web']
            existing_platforms = []

            for platform in platform_dirs:
                platform_path = temp_build_root / platform
                if platform_path.exists():
                    existing_platforms.append(platform)

            print(f"[{self.step_name}] [INIT] Found {len(existing_platforms)} platform directories: {', '.join(existing_platforms)}")

            if not existing_platforms:
                print(f"[{self.step_name}] [WARNING] No platform directories found, but continuing...")

            print(f"[{self.step_name}] [INIT] Step 3 controller initialized successfully")
            return True

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to initialize Step 3 controller: {e}")
            return False

    def execute_step3_scanning(self) -> Dict[str, Any]:
        """
        Execute Step 3: Platform Images Scanning

        Returns:
            Dict containing scan results and metadata
        """
        try:
            print(f"\n[{self.step_name}] {'=' * 80}")
            print(f"[{self.step_name}] {self.step_description.upper()}")
            print(f"[{self.step_name}] {'=' * 80}")

            print(f"[{self.step_name}] [EXECUTE] Starting platform-specific images analysis...")

            # Execute platform scanning
            print(f"[{self.step_name}] [STEP-3-1] Scanning platform directories for images...")
            platform_results = self.platform_scanner.scan_all_platforms(self.temp_build_root)

            # Enhanced platform display with target highlighting
            print(f"\n[{self.step_name}] [STEP-3-2] Enhanced platform analysis with target highlighting...")
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

            print(f"[{self.step_name}] [COMPLETE] Platform images scanning completed successfully")

            return self.results

        except Exception as e:
            error_message = f"Step 3 execution failed: {e}"
            print(f"[{self.step_name}] [ERROR] {error_message}")

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
            print(f"\n[{self.step_name}] [PLATFORM-ANALYSIS] ENHANCED PLATFORM DISPLAY")
            print(f"[{self.step_name}] {'=' * 80}")

            if 'platforms' not in platform_results:
                print(f"[{self.step_name}] [ERROR] No platform data available")
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
                    print(f"[{self.step_name}] [PLATFORM-TREE] >>> {info['name']} <<< (TARGET PLATFORM)")
                    print(f"[{self.step_name}] {'*' * 60}")
                    self._display_platform_details(platform_name, platforms.get(platform_name, {}), True)
                    print(f"[{self.step_name}] {'*' * 60}")
                elif is_available:
                    # Available but not target - reduced emphasis
                    print(f"[{self.step_name}] [PLATFORM-TREE] {info['name']} (Available)")
                    print(f"[{self.step_name}] {'-' * 40}")
                    self._display_platform_details(platform_name, platforms.get(platform_name, {}), False)
                else:
                    # Not available - grayed out effect with ASCII
                    print(f"[{self.step_name}] [PLATFORM-TREE] {info['name']} (Not Available)")

                print()

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to display enhanced platform info: {e}")

    def _display_platform_details(self, platform_name: str, platform_data: Dict, is_target: bool) -> None:
        """
        Display detailed platform information with classification and specifications
        """
        try:
            images = platform_data.get('images', [])
            total_size = platform_data.get('total_size', 0)

            if not images:
                print(f"[{self.step_name}]   No images found")
                return

            print(f"[{self.step_name}]   Images Found: {len(images)} | Total Size: {total_size / 1024:.1f}KB")

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

                # Prefix for target platform emphasis
                prefix = "   >>>" if is_target else "      "

                print(f"[{self.step_name}]{prefix} {name}")
                print(f"[{self.step_name}]{prefix}     Type: {image_type.title()}")
                if subtype and subtype != image_type:
                    print(f"[{self.step_name}]{prefix}     Subtype: {subtype.replace('_', ' ').title()}")
                # Show platform-specific size recommendations for all platforms
                if platform_specs and image_type in ['icon', 'background', 'splash'] and width > 0 and height > 0:
                    best_spec = self.platform_specs.get_best_size_recommendation(
                        platform_name, image_type, (width, height)
                    )
                    if best_spec:
                        spec_size = best_spec.get('size', (0, 0))
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
                                diff_text = ""
                            elif max_diff_pct <= 5:
                                status_indicator = "[OK] GOOD"
                                diff_text = f" (diff: {width_diff:+}w, {height_diff:+}h)"
                            elif max_diff_pct <= 20:
                                status_indicator = "[WARN] WARNING"
                                diff_text = f" (diff: {width_diff:+}w, {height_diff:+}h, {width_pct:+.1f}%w, {height_pct:+.1f}%h)"
                            else:
                                status_indicator = "[ERR] ERROR"
                                diff_text = f" (diff: {width_diff:+}w, {height_diff:+}h, {width_pct:+.1f}%w, {height_pct:+.1f}%h)"

                            # Display size and recommendation on adjacent lines
                            print(f"[{self.step_name}]{prefix}     Size: {dimensions} ({size_kb:.1f}KB)")
                            print(f"[{self.step_name}]{prefix} Recommended: {spec_size[0]}x{spec_size[1]} {status_indicator}{diff_text}")
                        else:
                            # Standard display without recommendations
                            print(f"[{self.step_name}]{prefix}     Size: {dimensions} ({size_kb:.1f}KB)")
                            print(f"[{self.step_name}]{prefix} Recommended: No standard spec found")
                    else:
                        # Standard display without recommendations
                        print(f"[{self.step_name}]{prefix}     Size: {dimensions} ({size_kb:.1f}KB)")
                        print(f"[{self.step_name}]{prefix} Recommended: No standard spec found")
                elif width <= 0 or height <= 0:
                    # Dimensions not available (e.g., for ICO files)
                    print(f"[{self.step_name}]{prefix}     Size: {dimensions} ({size_kb:.1f}KB)")
                    print(f"[{self.step_name}]{prefix} Recommended: Dimensions unavailable for this file type")
                else:
                    # Standard display for non-supported image types
                    print(f"[{self.step_name}]{prefix}     Size: {dimensions} ({size_kb:.1f}KB)")

                print(f"[{self.step_name}]{prefix}     Path: {file_path}")

                # Show recommendations for target platform
                if is_target and classification.get('recommendations'):
                    recommendations = classification.get('recommendations', [])[:2]  # Limit recommendations
                    for rec in recommendations:
                        print(f"[{self.step_name}]{prefix}     Recommendation: {rec}")

                print()

            # Show missing expected files for Android platform
            if platform_name == 'android' and self.platform_specs:
                self._show_missing_expected_files(platform_name, platform_data, is_target)

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to display platform details: {e}")

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
                print(f"[{self.step_name}]{prefix} MISSING EXPECTED FILES:")
                for missing in missing_directories:
                    expected_path = f"android/app/src/main/res/{missing['dir']}/background.png"
                    print(f"[{self.step_name}]{prefix}     Expected: {expected_path}")
                    print(f"[{self.step_name}]{prefix}     Purpose: {missing['desc']}")
                print()

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to show missing expected files: {e}")

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
            print(f"[{self.step_name}] [WARNING] Failed to generate summary: {e}")
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
                print(f"[{self.step_name}] [SUMMARY] No results available")
                return

            print(f"\n[{self.step_name}] [SUMMARY] STEP 3 COMPLETION SUMMARY")
            print(f"[{self.step_name}] {'-' * 60}")

            if self.results.get('success', False):
                summary = self.results.get('summary', {})
                platform_results = self.results.get('platform_results', {})

                print(f"[{self.step_name}] Status: SUCCESS")
                print(f"[{self.step_name}] Platforms Found: {summary.get('total_platforms_found', 0)}/4")
                print(f"[{self.step_name}] Total Images: {summary.get('total_images_found', 0)}")

                if summary.get('total_size_bytes', 0) > 0:
                    size_mb = summary['total_size_bytes'] / (1024 * 1024)
                    print(f"[{self.step_name}] Total Size: {size_mb:.2f}MB")

                # Platform breakdown with ASCII-only display
                breakdown = summary.get('platform_breakdown', {})

                for platform, info in breakdown.items():
                    status = "YES" if info['exists'] else "NO"
                    is_target = platform == self.target_platform

                    if is_target:
                        print(f"[{self.step_name}] >>> {platform.upper()}: {status} ({info['image_count']} images) <<< TARGET")
                    else:
                        print(f"[{self.step_name}]     {platform.upper()}: {status} ({info['image_count']} images)")

                # Image categories
                categories = summary.get('image_categories', {})
                total_categorized = sum(categories.values())
                if total_categorized > 0:
                    print(f"[{self.step_name}] Image Types: Icons({categories.get('app_icons', 0)}), Launchers({categories.get('launchers', 0)}), Backgrounds({categories.get('backgrounds', 0)}), Others({categories.get('others', 0)})")

            else:
                print(f"[{self.step_name}] Status: FAILED")
                print(f"[{self.step_name}] Error: {self.results.get('error', 'Unknown error')}")

            print(f"[{self.step_name}] {'-' * 60}")

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to print summary: {e}")

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

            print(f"[{self.step_name}] [CACHE] Platform results saved to: {platform_results_file}")
            return True

        except Exception as e:
            print(f"[{self.step_name}] [ERROR] Failed to save results to cache: {e}")
            return False


def main():
    """Main function for testing Step 3 controller"""
    print("[STEP-3] [TEST] Step 3 Platform Controller - Standalone Test")

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
        print("[STEP-3] [TEST] Initialization failed")


if __name__ == "__main__":
    main()