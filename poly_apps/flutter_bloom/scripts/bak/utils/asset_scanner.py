#!/usr/bin/env python3
"""
Asset Scanner Utility Class
Handles intelligent asset directory scanning and specific image discovery for Flutter build system

Intelligent Scanning Logic:
1. Logo: Search in icons subdirectory first (External → Built-in → Common priority)
2. Icon Group (ic_icon, ic_launcher, notification_icon, transa_launcher):
   - If logo found, search in same directory as logo
   - Otherwise use same priority as logo
3. Background: Search in launch subdirectory (External → Built-in → Common priority)
4. Splash: If background found, search in same directory as background; otherwise use same priority as background
5. Implement fallback mechanisms: use logo as origin path for icon group, background as origin path for splash
6. Ensure all 7 required images are found: logo, ic_icon, ic_launcher, notification_icon, transa_launcher, background, splash
7. Make scan results shareable between steps (Step2/3 update, Step4 read)
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import fnmatch

# Import shared configurations and data structures
from shared.image_patterns import image_patterns
from shared.standard_image_data import REQUIRED_IMAGES, STANDARD_IMAGE_DATA, format_file_size
from utils.print_helper import PrintHelper

class AssetScanner:
    """Intelligent asset scanner with co-location logic and fallback mechanisms"""

    def __init__(self):
        self.resource_directories = []  # Global resource directories array
        self.scan_results = {}  # Store scan results for sharing between steps

    def collect_resource_directories(self, temp_build_root: Path, app_name: str) -> List[Path]:
        """
        Collect all resource directories in priority order:
        1. External static resources (highest priority)
        2. Built-in app directory (medium priority)
        3. Common directory (app_main) (lowest priority)
        """
        resource_dirs = []

        PrintHelper.print_step_header("COLLECTING RESOURCE DIRECTORIES")

        # 1. External static resource directory (highest priority)
        external_resource_dir = Path(f"D:/programing/.build_dir/build_apps_static_resources/{app_name}")
        if external_resource_dir.exists() and external_resource_dir.is_dir():
            resource_dirs.append(external_resource_dir)
            PrintHelper.print_success(f"[1] External static resource directory: {external_resource_dir}")
        else:
            PrintHelper.print_warning(f"[1] External static resource directory not found: {external_resource_dir}")

        # 2. Built-in app directory (medium priority)
        builtin_app_dir = temp_build_root / "assets" / "apps" / app_name
        if builtin_app_dir.exists() and builtin_app_dir.is_dir():
            resource_dirs.append(builtin_app_dir)
            PrintHelper.print_success(f"[2] Built-in app directory: {builtin_app_dir}")
        else:
            PrintHelper.print_warning(f"[2] Built-in app directory not found: {builtin_app_dir}")

        # 3. Common directory (app_main) (lowest priority)
        common_dir = temp_build_root / "assets" / "apps" / "app_main"
        if common_dir.exists() and common_dir.is_dir():
            resource_dirs.append(common_dir)
            PrintHelper.print_success(f"[3] Common directory (app_main): {common_dir}")
        else:
            PrintHelper.print_warning(f"[3] Common directory (app_main) not found: {common_dir}")

        # Store as global array
        self.resource_directories = resource_dirs

        # Show directory status summary
        self._print_directory_status_summary(temp_build_root, app_name)

        return resource_dirs

    def _print_directory_status_summary(self, temp_build_root: Path, app_name: str):
        """Print comprehensive directory status summary"""
        PrintHelper.print_section_header("RESOURCE DIRECTORIES STATUS")

        # Check all potential directories
        potential_dirs = [
            (Path(f"D:/programing/.build_dir/build_apps_static_resources/{app_name}"), "EXTERNAL"),
            (temp_build_root / "assets" / "apps" / app_name, "BUILTIN"),
            (temp_build_root / "assets" / "apps" / "app_main", "COMMON")
        ]

        for i, (directory, dir_type) in enumerate(potential_dirs, 1):
            exists_status = "EXISTS" if directory.exists() and directory.is_dir() else "MISSING"
            print(f"  {i}. [{dir_type}] {directory} - {exists_status}")

            # Show subdirectory status for existing directories
            if directory.exists() and directory.is_dir():
                icons_dir = directory / "icons"
                launch_dir = directory / "launch"
                icons_status = "YES" if icons_dir.exists() else "NO"
                launch_status = "YES" if launch_dir.exists() else "NO"
                print(f"      +-- icons/ {icons_status}  launch/ {launch_status}")

        print()

    def _get_directory_type(self, directory: Path, temp_build_root: Path, app_name: str) -> str:
        """Get directory type label"""
        dir_str = str(directory)
        if "build_apps_static_resources" in dir_str:
            return "EXTERNAL"
        elif dir_str.endswith("app_main"):
            return "COMMON"
        else:
            return "BUILTIN"

    def scan_all_required_images(self) -> Dict[str, Dict]:
        """
        Intelligent scanning for all 7 required images using standardized data structure:
        1. Logo: Search in icons subdirectory first (External → Built-in → Common priority)
        2. Icon Group: If logo found, search in same directory as logo
        3. Background: Search in launch subdirectory (External → Built-in → Common priority)
        4. Splash: If background found, search in same directory as background
        5. Apply fallback mechanisms: logo→icons, background→splash

        Returns: Dict[str, Dict] with all 7 required images
        """
        PrintHelper.print_step_header("INTELLIGENT IMAGE SCANNING FOR 7 REQUIRED IMAGES")

        # Initialize hardcoded data structure for all 7 required images
        import copy
        image_data = copy.deepcopy(STANDARD_IMAGE_DATA)

        # Step 1: Scan for logo in icons subdirectories (priority order)
        PrintHelper.print_info("[STEP 1] Scanning for LOGO in icons subdirectories...")
        logo_info = self._scan_and_create_image_info('logo')
        if logo_info:
            image_data['logo'] = logo_info
            PrintHelper.print_success(f"✓ LOGO found: {logo_info['final_filename']} [{logo_info.source}]")
        else:
            PrintHelper.print_warning("✗ LOGO not found")

        # Step 2: Scan for icon group (co-location with logo if found)
        PrintHelper.print_info("[STEP 2] Scanning for ICON GROUP (ic_icon, ic_launcher, notification_icon, transa_launcher)...")
        icon_types = ['ic_icon', 'ic_launcher', 'notification_icon', 'transa_launcher']

        for icon_type in icon_types:
            icon_info = self._scan_icon_group_type(icon_type, image_data.get('logo'))
            if icon_info:
                image_data[icon_type] = icon_info
                PrintHelper.print_success(f"✓ {icon_type.upper()} found: {icon_info['final_filename']} [{icon_info.source}]")
            else:
                PrintHelper.print_warning(f"✗ {icon_type.upper()} not found")

        # Step 3: Scan for background in launch subdirectories (priority order)
        PrintHelper.print_info("[STEP 3] Scanning for BACKGROUND in launch subdirectories...")
        background_info = self._scan_and_create_image_info('background')
        if background_info:
            image_data['background'] = background_info
            PrintHelper.print_success(f"✓ BACKGROUND found: {background_info['final_filename']} [{background_info.source}]")
        else:
            PrintHelper.print_warning("✗ BACKGROUND not found")

        # Step 4: Scan for splash (co-location with background if found)
        PrintHelper.print_info("[STEP 4] Scanning for SPLASH...")
        splash_info = self._scan_splash_type(image_data.get('background'))
        if splash_info:
            image_data['splash'] = splash_info
            PrintHelper.print_success(f"✓ SPLASH found: {splash_info['final_filename']} [{splash_info.source}]")
        else:
            PrintHelper.print_warning("✗ SPLASH not found")

        # Step 5: Apply intelligent fallback mechanisms
        PrintHelper.print_info("[STEP 5] Applying intelligent fallback mechanisms...")
        image_data = self._apply_intelligent_fallbacks_to_data(image_data)

        # Store results for sharing between steps
        self.scan_results = image_data

        # Print comprehensive scan summary
        self.print_final_selection_summary(image_data)

        return image_data

    def _scan_and_create_image_info(self, image_type: str) -> Optional[Dict]:
        """Scan for image type and create ProcessedImageInfo if found"""
        patterns = image_patterns.get_patterns_for_type(image_type)
        subdir_names = image_patterns.get_directory_paths_for_type(image_type)

        # Search in priority order: External → Built-in → Common
        for priority, resource_dir in enumerate(self.resource_directories):
            dir_type = self._get_directory_type(resource_dir, Path.cwd(), "")

            # Check each subdirectory type for this resource directory
            for subdir_name in subdir_names:
                subdir = resource_dir / subdir_name
                if not subdir.exists():
                    continue

                # Search for images matching patterns, prioritize PNG > JPG > WEBP
                best_match = None
                best_priority = 999

                for pattern in patterns:
                    for file_path in subdir.rglob("*"):
                        if (file_path.is_file() and
                            file_path.suffix.lower() in image_patterns.SUPPORTED_EXTENSIONS and
                            re.match(pattern, file_path.name, re.IGNORECASE)):

                            # Determine format priority: PNG=1, JPG=2, WEBP=3
                            format_priority = {'png': 1, 'jpg': 2, 'jpeg': 2, 'webp': 3}.get(
                                file_path.suffix.lower().lstrip('.'), 999)

                            if format_priority < best_priority:
                                best_priority = format_priority
                                best_match = {
                                    'file_path': file_path,
                                    'pattern': pattern,
                                    'subdir': subdir,
                                    'dir_type': dir_type,
                                    'priority': priority
                                }

                # If we found a match in this directory, update the template
                if best_match:
                    file_path = best_match['file_path']
                    # Use the hardcoded template and update with found data
                    result = STANDARD_IMAGE_DATA[image_type].copy()
                    result.update({
                        'original_path': str(file_path),
                        'processed_path': str(file_path),
                        'original_size': file_path.stat().st_size,
                        'processed_size': file_path.stat().st_size,
                        'status': 'found',
                        'source': best_match['dir_type'],
                        'format': file_path.suffix.lower(),
                        'directory': str(best_match['subdir']),
                        'priority': best_match['priority']
                    })
                    return result

        return None

    def _scan_icon_group_type(self, image_type: str, logo_info: Optional[Dict]) -> Optional[Dict]:
        """Scan for icon group type with co-location logic"""
        search_dirs = []

        # If logo found, search in same directory first
        if logo_info and logo_info.get('directory'):
            search_dirs.append(Path(logo_info['directory']))
            PrintHelper.print_info(f"  → Using logo directory for {image_type}: {logo_info['directory']}")

        # Add priority-based directories as fallback
        for resource_dir in self.resource_directories:
            for subdir_name in image_patterns.get_directory_paths_for_type(image_type):
                subdir = resource_dir / subdir_name
                if subdir not in search_dirs and subdir.exists():
                    search_dirs.append(subdir)

        return self._scan_in_specific_dirs(image_type, search_dirs)

    def _scan_splash_type(self, background_info: Optional[Dict]) -> Optional[Dict]:
        """Scan for splash type with co-location logic"""
        search_dirs = []

        # If background found, search in same directory first
        if background_info and background_info.get('directory'):
            search_dirs.append(Path(background_info['directory']))
            PrintHelper.print_info(f"  → Using background directory for splash: {background_info['directory']}")

        # Add priority-based directories as fallback
        for resource_dir in self.resource_directories:
            for subdir_name in image_patterns.get_directory_paths_for_type('splash'):
                subdir = resource_dir / subdir_name
                if subdir not in search_dirs and subdir.exists():
                    search_dirs.append(subdir)

        return self._scan_in_specific_dirs('splash', search_dirs)

    def _scan_in_specific_dirs(self, image_type: str, search_dirs: List[Path]) -> Optional[Dict]:
        """Scan for image type in specific directory list"""
        patterns = image_patterns.get_patterns_for_type(image_type)

        for search_dir in search_dirs:
            if not search_dir.exists():
                continue

            # Search for images matching patterns, prioritize PNG > JPG > WEBP
            best_match = None
            best_priority = 999

            for pattern in patterns:
                for file_path in search_dir.rglob("*"):
                    if (file_path.is_file() and
                        file_path.suffix.lower() in image_patterns.SUPPORTED_EXTENSIONS and
                        re.match(pattern, file_path.name, re.IGNORECASE)):

                        # Determine format priority: PNG=1, JPG=2, WEBP=3
                        format_priority = {'png': 1, 'jpg': 2, 'jpeg': 2, 'webp': 3}.get(
                            file_path.suffix.lower().lstrip('.'), 999)

                        if format_priority < best_priority:
                            best_priority = format_priority
                            best_match = {
                                'file_path': file_path,
                                'pattern': pattern,
                                'search_dir': search_dir
                            }

            # If we found a match in this directory, create image data dict
            if best_match:
                # Determine source type
                dir_type = self._get_directory_type(search_dir.parent, Path.cwd(), "")
                # Find priority based on resource_directories index
                priority = 0
                for i, resource_dir in enumerate(self.resource_directories):
                    if str(search_dir).startswith(str(resource_dir)):
                        priority = i
                        break

                file_path = best_match['file_path']
                # Use the hardcoded template and update with found data
                result = STANDARD_IMAGE_DATA[image_type].copy()
                result.update({
                    'original_path': str(file_path),
                    'processed_path': str(file_path),
                    'original_size': file_path.stat().st_size,
                    'processed_size': file_path.stat().st_size,
                    'status': 'found',
                    'source': dir_type,
                    'format': file_path.suffix.lower(),
                    'directory': str(best_match['search_dir']),
                    'priority': priority
                })
                return result

        return None

    def _apply_intelligent_fallbacks_to_data(self, image_data: Dict[str, Dict]) -> Dict[str, Dict]:
        """Apply intelligent fallback mechanisms using ProcessedImageInfo data structure"""
        fallbacks_applied = []

        # Logo → Icon Group fallbacks
        logo_info = image_data.get('logo')
        if logo_info and logo_info.get('status') != 'missing':
            icon_types = ['ic_icon', 'ic_launcher', 'notification_icon', 'transa_launcher']
            for icon_type in icon_types:
                current_info = image_data.get(icon_type)
                if not current_info or current_info.get('status') == 'missing':
                    # Create fallback from logo - simple dict copy and update
                    fallback_info = logo_info.copy()
                    fallback_info.update({
                        'image_type': icon_type.upper(),
                        'status': 'fallback',
                        'is_fallback': True,
                        'fallback_from': 'logo',
                        'fallback_reason': f"Logo used as fallback for {icon_type}"
                    })
                    image_data[icon_type] = fallback_info
                    fallbacks_applied.append(f"{icon_type} ← logo")

        # Background → Splash fallback
        background_info = image_data.get('background')
        splash_info = image_data.get('splash')
        if (background_info and background_info.get('status') != 'missing' and
            (not splash_info or splash_info.get('status') == 'missing')):
            # Create fallback from background - simple dict copy and update
            fallback_splash = background_info.copy()
            fallback_splash.update({
                'image_type': 'SPLASH',
                'status': 'fallback',
                'is_fallback': True,
                'fallback_from': 'background',
                'fallback_reason': "Background used as fallback for splash"
            })
            image_data['splash'] = fallback_splash
            fallbacks_applied.append("splash ← background")

        if fallbacks_applied:
            PrintHelper.print_info(f"  → Applied fallbacks: {', '.join(fallbacks_applied)}")
        else:
            PrintHelper.print_info("  → No fallbacks needed")

        return image_data

    def get_image_data_for_step2(self) -> Dict[str, Dict]:
        """Get scan results as dict for Step2 processing"""
        return self.scan_results if hasattr(self, 'scan_results') else {}

    def update_compression_settings(self, image_type: str, compress: bool, processed_path: Optional[str] = None, processed_size: Optional[int] = None):
        """Update compression settings based on menu selection"""
        if not hasattr(self, 'scan_results') or image_type not in self.scan_results:
            return

        image_info = self.scan_results[image_type]
        if compress:
            image_info['compression_mode'] = "compressed"
            if processed_path:
                image_info['processed_path'] = processed_path
            if processed_size is not None:
                image_info['processed_size'] = processed_size
            image_info['status'] = "processed"
        else:
            # If not compressing, processed equals original
            image_info['compression_mode'] = "original"
            image_info['processed_path'] = image_info['original_path']
            image_info['processed_size'] = image_info['original_size']
            if image_info.get('is_fallback'):
                image_info['status'] = "fallback"
            else:
                image_info['status'] = "found"

    def save_scan_results_to_unified_system(self):
        """Save scan results to unified variable system for cross-step sharing"""
        from shared.data_exchange.unified_variable_system import unified_vars

        if hasattr(self, 'scan_results'):
            result = unified_vars.save_processed_images(self.scan_results)
            if result.get('success'):
                PrintHelper.print_success(f"Scan results saved to: {result['file']}")
            else:
                PrintHelper.print_error(f"Failed to save scan results: {result.get('error')}")

    def print_compression_menu_data(self) -> Dict[str, Dict]:
        """Prepare data for compression menu display"""
        menu_data = {}

        if not hasattr(self, 'scan_results'):
            return menu_data

        for image_type in REQUIRED_IMAGES:
            info = self.scan_results.get(image_type)
            if info and info.get('status') != 'missing':
                fallback_info = f" (fallback from {info.get('fallback_from')})" if info.get('is_fallback') else ""
                menu_data[image_type.upper()] = {
                    'filename': info.get('final_filename', ''),
                    'source': info.get('source', ''),
                    'status': 'found',
                    'compression_mode': info.get('compression_mode', 'original'),
                    'fallback_info': fallback_info,
                    'display_name': f"{image_type}({info.get('final_filename', '')})",
                    'display_status': f"{info.get('final_filename', '')} [{info.get('source', '')}]{fallback_info}"
                }
            else:
                menu_data[image_type.upper()] = {
                    'final_filename': '',
                    'source': '',
                    'status': 'missing',
                    'compression_mode': 'original',
                    'fallback_info': '',
                    'display_name': f"{image_type}({image_type}.png)",
                    'display_status': f"[MISSING {image_type.upper()}] [MISSING]"
                }

        return menu_data

    def get_scan_results(self) -> Dict[str, Dict]:
        """Get stored scan results for sharing between build steps"""
        return getattr(self, 'scan_results', {})

    def update_scan_results(self, results: Dict[str, Dict]):
        """Update scan results (used by Step2/3 to update, Step4 to read)"""
        if not hasattr(self, 'scan_results'):
            self.scan_results = {}
        self.scan_results.update(results)
        PrintHelper.print_info(f"Scan results updated with {len(results)} entries")

    def create_legacy_image_dict(self, image_info: Dict) -> Dict:
        """Convert image dict to legacy dict format for compatibility"""
        return {
            'path': Path(image_info['original_path']),
            'name': image_info['final_filename'],
            'format': image_info['format'],
            'size_bytes': image_info['original_size'],
            'source': image_info['source'],
            'directory': Path(image_info['directory']) if image_info.get('directory') else None,
            'image_type': image_info['image_type'].lower(),
            'compression_mode': image_info['compression_mode']
        }

    def show_image_selection_menu(self, menu_helper, images: List[Dict], image_type: str) -> Optional[Dict]:
        """Show selection menu for images using MenuHelper (legacy compatibility)"""
        if not images:
            PrintHelper.print_warning(f"[MENU] No {image_type} images found to select from")
            return None

        # Use MenuHelper's image selection menu with compression toggle
        return menu_helper.show_image_selection_menu(
            title=f"{image_type} Image Selection",
            images=images,
            image_type=image_type
        )

    def print_final_selection_summary(self, image_data: Dict[str, Dict]):
        """Print final confirmed image paths and information"""
        print()
        print("=" * 80)
        print("7 REQUIRED IMAGES DATA SUMMARY")
        print("=" * 80)

        for image_type in REQUIRED_IMAGES:
            info = image_data.get(image_type)
            if info and info.get('status') != "missing":
                fallback_info = f" (fallback from {info.get('fallback_from')})" if info.get('is_fallback') else ""
                compression_info = f" - [{info.get('compression_mode', 'original').upper()}]"

                print(f"{info.get('image_type', image_type.upper())}:")
                print(f"  File: {info.get('final_filename', '')}")
                print(f"  Original Path: {info.get('original_path', '')}")
                print(f"  Processed Path: {info.get('processed_path', '')}")
                print(f"  Original Size: {format_file_size(info.get('original_size', 0))}")
                print(f"  Processed Size: {format_file_size(info.get('processed_size', 0))}")
                print(f"  Status: {info.get('status', '').upper()}")
                print(f"  Source: [{info.get('source', '')}]{fallback_info}{compression_info}")
                print()
            else:
                print(f"{image_type.upper()}: NOT FOUND")
                print()

    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size in human readable format"""
        if size_bytes < 1024:
            return f"{size_bytes}B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f}KB"
        else:
            return f"{size_bytes / (1024 * 1024):.1f}MB"