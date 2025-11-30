#!/usr/bin/env python3
"""
Flutter to Android Asset Scanner
Handles intelligent asset directory scanning and image discovery for Android platform from Flutter resources

Constraint-based Search Logic:
1. Icon Group (logo, ic_icon, ic_launcher, notification_icon, transa_launcher):
   - Search in External → Built-in → Common + icons/ subdirectory
   - Directory constraint: If first image found, subsequent searches limited to same directory
2. Background Group (background, splash):
   - Search in External → Built-in → Common + launch/ subdirectory
   - Directory constraint: If first image found, subsequent searches limited to same directory
3. Update ANDROID_IMAGE_DATA with search results
4. Apply fallback mechanisms and processing
5. Make scan results shareable between steps (Step2/3 update, Step4 read)

Note: This scanner is specifically for Android platform.
Separate scanners will be created for Windows/iOS/macOS/Web platforms.
"""

import os
import re
import glob
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import fnmatch

# Import shared configurations and data structures
from shared.image_patterns import image_patterns
from shared.standard_image_data import (
    ANDROID_IMAGE_DATA, ANDROID_REQUIRED_IMAGES, format_file_size,
    ImageResourceManager, FlutterStaticResourceProvider, flutter_static_provider,
    ANDROID_ICON_GROUP, ANDROID_BACKGROUND_GROUP,
    # Legacy aliases for backward compatibility
    STANDARD_IMAGE_DATA, REQUIRED_IMAGES
)
from shared.resource_directory_collector import resource_collector
from utils.print_helper import PrintHelper

class FlutterToAndroidAssetScanner:
    """Flutter to Android asset scanner with constraint-based search logic and fallback mechanisms"""

    def __init__(self):
        self.resource_directories = []  # Global resource directories array
        self.scan_results = {}  # Store scan results for sharing between steps

    def collect_resource_directories(self, temp_build_root: Path, app_name: str) -> List[Path]:
        """
        Collect resource directories using shared resource collector.
        This method delegates to the shared collector which handles all platform scanners.
        """
        PrintHelper.info("[ANDROID SCANNER] Using shared resource directory collector...")

        # Use shared resource collector
        resource_dirs = resource_collector.collect_resource_directories(temp_build_root, app_name)

        # Store locally for this scanner instance
        self.resource_directories = resource_dirs

        return resource_dirs

    def scan_all_required_images(self) -> Dict[str, Dict]:
        """
        Intelligent scanning for all 7 required images using constraint-based search logic:
        1. Icon Group (logo, ic_icon, ic_launcher, notification_icon, transa_launcher):
           Search in External → Built-in → Common + icons/, with directory constraint
        2. Background Group (background, splash):
           Search in External → Built-in → Common + launch/, with directory constraint
        3. Directory constraint: If first image in group found, subsequent searches limited to same directory
        4. Update ANDROID_IMAGE_DATA with search results

        Returns: Dict[str, Dict] with all 7 required images
        """
        PrintHelper.header("CONSTRAINT-BASED IMAGE SCANNING FOR ANDROID PLATFORM")

        # Execute constraint-based search for icon and background groups
        PrintHelper.info("[STEP 1] Executing constraint-based search for icon and background groups...")
        search_results = self._search_images_with_constraint(flutter_static_provider)

        # Update ANDROID_IMAGE_DATA with search results
        PrintHelper.info("[STEP 2] Updating ANDROID_IMAGE_DATA with search results...")
        self._update_android_image_data(search_results)

        # Print search results summary
        self._print_search_results_summary(search_results)

        # Copy updated ANDROID_IMAGE_DATA for return
        import copy
        image_data = copy.deepcopy(ANDROID_IMAGE_DATA)

        # Apply intelligent fallback mechanisms if needed
        PrintHelper.info("[STEP 3] Applying intelligent fallback mechanisms...")
        image_data = self._apply_intelligent_fallbacks_to_data(image_data)

        # Store results for sharing between steps
        self.scan_results = image_data

        # Print comprehensive scan summary
        self.print_final_selection_summary(image_data)

        return image_data

    def _search_images_with_constraint(self, flutter_provider: FlutterStaticResourceProvider) -> dict:
        """
        Search images with directory constraint logic:
        - Icon group: Search in extension -> builtin -> common + icons/
        - Background group: Search in extension -> builtin -> common + launch/
        - If first image found in a group, constraint subsequent searches to same directory
        - If constraint search fails, use first found image as fallback
        """
        results = {}

        # Search icon group with constraint and fallback logic
        PrintHelper.info("Searching icon group with constraint logic...")
        icon_results = self._search_group_with_constraint(
            ANDROID_ICON_GROUP, ImageResourceManager.ICON_SEARCH_SUBDIR, flutter_provider
        )
        results.update(icon_results)

        # Search background group with constraint and fallback logic
        PrintHelper.info("Searching background group with constraint logic...")
        bg_results = self._search_group_with_constraint(
            ANDROID_BACKGROUND_GROUP, ImageResourceManager.BACKGROUND_SEARCH_SUBDIR, flutter_provider
        )
        results.update(bg_results)

        return results

    def _search_group_with_constraint(self, image_group: List[str], subdir: str,
                                    flutter_provider: FlutterStaticResourceProvider) -> dict:
        """
        Search image group with constraint logic and fallback:
        1. Search first image in all directories (extension -> builtin -> common)
        2. If found, constraint subsequent searches to same directory
        3. If constraint search fails for subsequent images, use first found image as fallback
        """
        results = {}
        constraint_dir = None
        first_found_image = None

        for i, image_type in enumerate(image_group):
            if i == 0:
                # First image: search in all directories
                found_image = self._search_single_image(
                    image_type, subdir, flutter_provider, None
                )
                if found_image:
                    results[image_type] = found_image
                    constraint_dir = found_image['constraint_dir']
                    first_found_image = found_image
                    PrintHelper.success(f"  ✓ First image {image_type} found, constraining to: {constraint_dir}")
            else:
                # Subsequent images: search with constraint first
                found_image = None
                if constraint_dir:
                    found_image = self._search_single_image(
                        image_type, subdir, flutter_provider, constraint_dir
                    )

                if found_image:
                    results[image_type] = found_image
                    PrintHelper.success(f"  ✓ {image_type} found in constraint directory")
                elif first_found_image:
                    # Fallback: use first found image with modified metadata
                    fallback_image = first_found_image.copy()
                    fallback_image.update({
                        'image_type': image_type,
                        'is_fallback': True,
                        'fallback_from': image_group[0],  # First image in group
                        'fallback_reason': f'Not found in constraint directory, using {image_group[0]} as fallback'
                    })
                    results[image_type] = fallback_image
                    PrintHelper.warning(f"  ⚠ {image_type} not found in constraint directory, using {image_group[0]} as fallback")
                else:
                    PrintHelper.warning(f"  ✗ {image_type} not found and no fallback available")

        return results

    def _search_single_image(self, image_type: str, subdir: str,
                           flutter_provider: FlutterStaticResourceProvider,
                           constraint_dir: str = None) -> dict:
        """
        Search for single image with optional directory constraint using ANDROID_IMAGE_DATA patterns.
        Uses regex patterns from ANDROID_IMAGE_DATA and prioritizes formats: png > jpg > jpeg > webp
        """
        search_dirs = flutter_provider.get_all_directories() if not constraint_dir else [
            d for d in flutter_provider.get_all_directories() if d['path'] == constraint_dir
        ]

        # Get patterns from ANDROID_IMAGE_DATA
        if image_type not in ANDROID_IMAGE_DATA:
            return None

        patterns = ANDROID_IMAGE_DATA[image_type].get('pattern', [])
        if not patterns:
            return None

        # Format priority: png (1) > jpg (2) > jpeg (3) > webp (4)
        format_priority = {'.png': 1, '.jpg': 2, '.jpeg': 3, '.webp': 4}
        supported_formats = ['.png', '.jpg', '.jpeg', '.webp']

        # Search directories in order (external -> builtin -> common)
        for dir_info in search_dirs:
            search_path = Path(dir_info['path']) / subdir
            if not search_path.exists():
                continue

            # Find best match in current directory
            directory_best_match = None
            directory_best_priority = 999

            # Search all files in the current directory
            for file_path in search_path.iterdir():
                if not file_path.is_file():
                    continue

                file_extension = file_path.suffix.lower()
                if file_extension not in supported_formats:
                    continue

                # Check if filename matches any pattern
                filename = file_path.stem  # filename without extension
                for pattern in patterns:
                    if re.match(pattern, filename, re.IGNORECASE):
                        # Found a match, check priority
                        current_priority = format_priority.get(file_extension, 999)
                        if current_priority < directory_best_priority:
                            directory_best_priority = current_priority
                            directory_best_match = {
                                'image_type': image_type,
                                'file_path': str(file_path),
                                'filename': file_path.name,
                                'source_type': dir_info['type'],
                                'constraint_dir': dir_info['path'],
                                'subdir': subdir,
                                'matched_pattern': pattern,
                                'format_priority': current_priority
                            }

            # If we found a match in this directory, return it (respects directory priority)
            if directory_best_match:
                return directory_best_match

        return None

    def _update_android_image_data(self, search_results: dict):
        """Update ANDROID_IMAGE_DATA with search results (but keep compression_mode unchanged for menu)"""
        for image_type, result in search_results.items():
            if image_type in ANDROID_IMAGE_DATA:
                # Save current compression_mode to preserve it
                current_compression = ANDROID_IMAGE_DATA[image_type].get('compression_mode', 'compressed')

                ANDROID_IMAGE_DATA[image_type].update({
                    'original_path': result['file_path'],
                    'processed_path': '',  # Will be set after menu selection
                    'original_size': Path(result['file_path']).stat().st_size if Path(result['file_path']).exists() else 0,
                    'processed_size': 0,  # Will be set after processing
                    'status': 'found',
                    'source': result['source_type'],
                    'format': Path(result['file_path']).suffix,
                    'directory': str(Path(result['file_path']).parent),
                    'filename': result['filename'],
                    'matched_pattern': result.get('matched_pattern', ''),  # Preserve matched pattern
                    'format_priority': result.get('format_priority', 0)  # Preserve format priority
                })

                # Restore compression_mode (don't let search override menu settings)
                ANDROID_IMAGE_DATA[image_type]['compression_mode'] = current_compression

    def _print_search_results_summary(self, search_results: Dict):
        """Print summary of constraint-based search results"""
        PrintHelper.header("CONSTRAINT-BASED SEARCH RESULTS")

        if not search_results:
            PrintHelper.warning("No images found during constraint-based search")
            return

        # Group results by icon and background groups
        icon_results = {k: v for k, v in search_results.items() if k in ANDROID_ICON_GROUP}
        bg_results = {k: v for k, v in search_results.items() if k in ANDROID_BACKGROUND_GROUP}

        if icon_results:
            PrintHelper.info("ICON GROUP RESULTS:")
            constraint_dir = None
            for image_type, result in icon_results.items():
                if not constraint_dir:
                    constraint_dir = result['constraint_dir']
                matched_pattern = result.get('matched_pattern', 'N/A')
                format_priority = result.get('format_priority', 'N/A')
                PrintHelper.success(f"  ✓ {image_type.upper()}: {result['filename']} [{result['source_type']}] (pattern: {matched_pattern}, priority: {format_priority})")
            if constraint_dir:
                PrintHelper.info(f"  → Icon group constraint directory: {constraint_dir}")

        if bg_results:
            PrintHelper.info("BACKGROUND GROUP RESULTS:")
            constraint_dir = None
            for image_type, result in bg_results.items():
                if not constraint_dir:
                    constraint_dir = result['constraint_dir']
                matched_pattern = result.get('matched_pattern', 'N/A')
                format_priority = result.get('format_priority', 'N/A')
                PrintHelper.success(f"  ✓ {image_type.upper()}: {result['filename']} [{result['source_type']}] (pattern: {matched_pattern}, priority: {format_priority})")
            if constraint_dir:
                PrintHelper.info(f"  → Background group constraint directory: {constraint_dir}")

        missing_icons = [img for img in ANDROID_ICON_GROUP if img not in icon_results]
        missing_bgs = [img for img in ANDROID_BACKGROUND_GROUP if img not in bg_results]

        if missing_icons:
            PrintHelper.warning(f"Missing icon group images: {', '.join(missing_icons)}")
        if missing_bgs:
            PrintHelper.warning(f"Missing background group images: {', '.join(missing_bgs)}")

        print()

    def _apply_intelligent_fallbacks_to_data(self, image_data: Dict[str, Dict]) -> Dict[str, Dict]:
        """Apply intelligent fallback mechanisms using Android image data structure"""
        fallbacks_applied = []

        # Logo → Icon Group fallbacks
        logo_info = image_data.get('logo')
        if logo_info and logo_info.get('status') != 'missing':
            icon_types = ['ic_icon', 'ic_launcher', 'notification_icon', 'transa_launcher']
            for icon_type in icon_types:
                current_info = image_data.get(icon_type)
                if not current_info or current_info.get('status') == 'missing':
                    # Create fallback from logo
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
            # Create fallback from background
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
            PrintHelper.info(f"  → Applied fallbacks: {', '.join(fallbacks_applied)}")
        else:
            PrintHelper.info("  → No fallbacks needed")

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
        import json
        from datetime import datetime

        if hasattr(self, 'scan_results'):
            try:
                # Create JSON data structure
                data = {
                    "timestamp": datetime.now().isoformat(),
                    "step": 2,
                    "processed_images": self.scan_results
                }

                # Save JSON data as string to file variable
                json_str = json.dumps(data, indent=2, ensure_ascii=False)
                success = unified_vars.set_file_variable(unified_vars.KEY_PROCESSED_IMAGES_JSON, json_str)

                if success:
                    PrintHelper.success(f"Scan results saved to file variable: {unified_vars.KEY_PROCESSED_IMAGES_JSON}")
                else:
                    PrintHelper.error(f"Failed to save scan results to file variable")
            except Exception as e:
                PrintHelper.error(f"Failed to save scan results: {e}")

    def print_compression_menu_data(self) -> Dict[str, Dict]:
        """Prepare data for compression menu display"""
        menu_data = {}

        if not hasattr(self, 'scan_results'):
            return menu_data

        for image_type in ANDROID_REQUIRED_IMAGES:
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
                    'display_name': f"{image_type}(NOT FOUND)",
                    'display_status': "NOT FOUND"
                }

        return menu_data

    def print_final_selection_summary(self, image_data: Dict[str, Dict]):
        """Print final comprehensive summary of all 7 required images"""
        print()
        print("7 REQUIRED IMAGES DATA SUMMARY")
        print("=" * 80)

        for image_type in ANDROID_REQUIRED_IMAGES:
            info = image_data.get(image_type)
            if info and info.get('status') != "missing":
                fallback_info = f" (fallback from {info.get('fallback_from')})" if info.get('is_fallback') else ""
                compression_mode = info.get('compression_mode', '')
                compression_info = f" - [{compression_mode.upper()}]" if compression_mode else ""

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

# Legacy alias for backward compatibility
AssetScanner = FlutterToAndroidAssetScanner