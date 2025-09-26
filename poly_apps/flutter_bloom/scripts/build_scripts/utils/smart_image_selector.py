# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

#!/usr/bin/env python3
"""
Smart Image Selector
Implements intelligent image selection logic with directory priority
"""

from pathlib import Path
from typing import Dict, List, Optional, Any

from utils.asset_scanner import AssetScanner
from utils.print_helper import PrintHelper

class SmartImageSelector:
    def __init__(self, asset_scanner: AssetScanner, step_prefix: str = "STEP-2"):
        self.asset_scanner = asset_scanner
        self.step_prefix = step_prefix

    def select_all_images(self, menu_helper: Any, resource_dirs: List[Path], temp_build_root: Path, app_name: str) -> Dict:
        """
        Smart image selection with paired search logic
        Returns dict with selected images for all types
        """
        PrintHelper.header("SMART IMAGE SELECTION WITH PAIRED SEARCH", source=self.step_prefix)

        selected_images = {}

        # Process paired image types: logo->ic_icon, background->splash
        paired_searches = [
            (('logo', 'icons', 'logo'), ('ic_icon', 'icons', 'ic_')),
            (('background', 'launch', 'background'), ('splash', 'launch', 'splash'))
        ]

        for primary_info, secondary_info in paired_searches:
            primary_type, primary_subdir, primary_prefix = primary_info
            secondary_type, secondary_subdir, secondary_prefix = secondary_info

            PrintHelper.info(f"[PAIRED SEARCH] {primary_type.upper()} -> {secondary_type.upper()}", source=self.step_prefix)
            PrintHelper.info("-" * 60, source=self.step_prefix)

            primary_selected = None
            primary_found_dir = None
            secondary_selected = None

            # Search for primary image
            PrintHelper.info(f"[SEARCH] Looking for {primary_type.upper()} images (prefix: '{primary_prefix}')...", source=self.step_prefix)
            for resource_dir in resource_dirs:
                dir_type = self.asset_scanner._get_directory_type(resource_dir, temp_build_root, app_name)
                search_dir = resource_dir / primary_subdir

                if not search_dir.exists():
                    PrintHelper.warning(f"[{dir_type}] MISSING: {search_dir}", source=self.step_prefix)
                    continue

                # Find primary images in this directory
                images_in_dir = []
                for file_path in search_dir.rglob(f"{primary_prefix}*"):
                    if file_path.is_file() and file_path.suffix.lower() in self.asset_scanner.supported_image_formats:
                        images_in_dir.append({
                            'name': file_path.name,
                            'path': str(file_path),
                            'format': file_path.suffix.lower(),
                            'size_bytes': file_path.stat().st_size,
                            'source': dir_type
                        })

                if images_in_dir:
                    PrintHelper.info(f"[{dir_type}] FOUND {len(images_in_dir)} {primary_type} image(s) in: {search_dir}", source=self.step_prefix)

                    if len(images_in_dir) == 1:
                        primary_selected = images_in_dir[0]
                        primary_selected['compression_mode'] = 'compressed'
                        PrintHelper.success(f"AUTO-SELECTED: {primary_selected['name']}", source=self.step_prefix)
                    else:
                        PrintHelper.info(f"Multiple {primary_type} images found, showing selection menu...", source=self.step_prefix)
                        primary_selected = self.asset_scanner.show_image_selection_menu(menu_helper, images_in_dir, primary_type)

                    if primary_selected:
                        primary_found_dir = resource_dir
                        break
                else:
                    PrintHelper.warning(f"[{dir_type}] NO {primary_type} images found in: {search_dir}", source=self.step_prefix)

            # Search for secondary image
            PrintHelper.info(f"[SEARCH] Looking for {secondary_type.upper()} images (prefix: '{secondary_prefix}')...", source=self.step_prefix)

            if primary_found_dir:
                # Primary found, search secondary only in same directory
                PrintHelper.info(f"Primary {primary_type} found in directory, searching {secondary_type} in same directory only...", source=self.step_prefix)
                search_dir = primary_found_dir / secondary_subdir
                dir_type = self.asset_scanner._get_directory_type(primary_found_dir, temp_build_root, app_name)

                if search_dir.exists():
                    images_in_dir = []
                    for file_path in search_dir.rglob(f"{secondary_prefix}*"):
                        if file_path.is_file() and file_path.suffix.lower() in self.asset_scanner.supported_image_formats:
                            images_in_dir.append({
                                'name': file_path.name,
                                'path': str(file_path),
                                'format': file_path.suffix.lower(),
                                'size_bytes': file_path.stat().st_size,
                                'source': dir_type
                            })

                    if images_in_dir:
                        PrintHelper.info(f"[{dir_type}] FOUND {len(images_in_dir)} {secondary_type} image(s) in: {search_dir}", source=self.step_prefix)

                        if len(images_in_dir) == 1:
                            secondary_selected = images_in_dir[0]
                            secondary_selected['compression_mode'] = 'compressed'
                            PrintHelper.success(f"AUTO-SELECTED: {secondary_selected['name']}", source=self.step_prefix)
                        else:
                            PrintHelper.info(f"Multiple {secondary_type} images found, showing selection menu...", source=self.step_prefix)
                            secondary_selected = self.asset_scanner.show_image_selection_menu(menu_helper, images_in_dir, secondary_type)
                    else:
                        PrintHelper.warning(f"[{dir_type}] NO {secondary_type} images found in same directory", source=self.step_prefix)
                else:
                    PrintHelper.warning(f"[{dir_type}] MISSING: {search_dir}", source=self.step_prefix)
            else:
                # Primary not found, search secondary in all directories
                PrintHelper.info(f"Primary {primary_type} not found, searching {secondary_type} in all directories...", source=self.step_prefix)
                for resource_dir in resource_dirs:
                    dir_type = self.asset_scanner._get_directory_type(resource_dir, temp_build_root, app_name)
                    search_dir = resource_dir / secondary_subdir

                    if not search_dir.exists():
                        PrintHelper.warning(f"[{dir_type}] MISSING: {search_dir}", source=self.step_prefix)
                        continue

                    images_in_dir = []
                    for file_path in search_dir.rglob(f"{secondary_prefix}*"):
                        if file_path.is_file() and file_path.suffix.lower() in self.asset_scanner.supported_image_formats:
                            images_in_dir.append({
                                'name': file_path.name,
                                'path': str(file_path),
                                'format': file_path.suffix.lower(),
                                'size_bytes': file_path.stat().st_size,
                                'source': dir_type
                            })

                    if images_in_dir:
                        PrintHelper.info(f"[{dir_type}] FOUND {len(images_in_dir)} {secondary_type} image(s) in: {search_dir}", source=self.step_prefix)

                        if len(images_in_dir) == 1:
                            secondary_selected = images_in_dir[0]
                            secondary_selected['compression_mode'] = 'compressed'
                            PrintHelper.success(f"AUTO-SELECTED: {secondary_selected['name']}", source=self.step_prefix)
                        else:
                            PrintHelper.info(f"Multiple {secondary_type} images found, showing selection menu...", source=self.step_prefix)
                            secondary_selected = self.asset_scanner.show_image_selection_menu(menu_helper, images_in_dir, secondary_type)

                        if secondary_selected:
                            break
                    else:
                        PrintHelper.warning(f"[{dir_type}] NO {secondary_type} images found in: {search_dir}", source=self.step_prefix)

            # Store results for this pair
            if primary_selected:
                selected_images[primary_type] = primary_selected
                PrintHelper.success(f"[SELECTED] {primary_type}: {primary_selected['name']} from {primary_selected['source']}", source=self.step_prefix)
            else:
                PrintHelper.warning(f"[NOT FOUND] No {primary_type} images found", source=self.step_prefix)

            if secondary_selected:
                selected_images[secondary_type] = secondary_selected
                PrintHelper.success(f"[SELECTED] {secondary_type}: {secondary_selected['name']} from {secondary_selected['source']}", source=self.step_prefix)
            else:
                PrintHelper.warning(f"[NOT FOUND] No {secondary_type} images found", source=self.step_prefix)

        return selected_images

    def show_final_summary_and_process(self, selected_images: Dict, menu_helper: Any) -> Dict:
        """Show final summary with fallback rules and comprehensive compression menu"""

        # Apply fallback rules first
        selected_images = self._apply_fallback_rules(selected_images)

        # Apply intelligent icon finding logic
        selected_images = self._apply_intelligent_icon_finding(selected_images)

        PrintHelper.header("FINAL IMAGE SELECTION SUMMARY")

        # Show summary of all found and missing images
        # Icon group: ic_icon, notification_icon, transa_launcher, ic_launcher
        all_image_types = ['logo', 'background', 'splash', 'ic_icon', 'notification_icon', 'transa_launcher', 'ic_launcher']
        icon_types = ['ic_icon', 'notification_icon', 'transa_launcher', 'ic_launcher']
        found_images = {}
        missing_images = []

        for image_type in all_image_types:
            image_data = selected_images.get(image_type)
            if image_data:
                found_images[image_type] = image_data
                compression_text = "COMPRESSED" if image_data.get('compression_mode') == 'compressed' else "ORIGINAL"
                fallback_text = f" (fallback from {image_data.get('fallback_from', '')})" if image_data.get('is_fallback') else ""
                final_filename = self._get_final_filename(image_type)
                PrintHelper.info(f"  {image_type.upper()}({final_filename}): {image_data['name']} [{image_data['source']}] - {compression_text}{fallback_text}")
                PrintHelper.info(f"    Path: {image_data['path']}")
            else:
                missing_images.append(image_type)
                final_filename = self._get_final_filename(image_type)
                PrintHelper.info(f"  {image_type.upper()}({final_filename}): [NOT FOUND]")

        # Show comprehensive compression selection menu for ALL image types
        PrintHelper.header("COMPRESSION SETTINGS CONFIGURATION")
        PrintHelper.info("Configure compression settings for each image type:")
        PrintHelper.info("Found images can be compressed or kept original.")
        PrintHelper.info("Missing images will be noted but not processed.")
        PrintHelper.info("")

        # Create comprehensive menu with all image types (both found and missing)
        menu_items = []

        for image_type in all_image_types:
            if image_type in found_images:
                image_data = found_images[image_type]
                # Create menu item for found image
                item = image_data.copy()
                item['image_type'] = image_type
                item['usage_description'] = self._get_usage_description(image_type)
                item['fallback_info'] = self._get_fallback_info(image_data)
                item['final_filename'] = self._get_final_filename(image_type)
                item['is_missing'] = False

                # Ensure compression mode is set
                if 'compression_mode' not in item:
                    item['compression_mode'] = 'compressed'

                menu_items.append(item)
            else:
                # Create placeholder for missing image
                final_filename = self._get_final_filename(image_type)
                missing_item = {
                    'name': f'[MISSING {image_type.upper()}]',
                    'path': 'Not found',
                    'format': 'N/A',
                    'size_bytes': 0,
                    'source': 'MISSING',
                    'image_type': image_type,
                    'usage_description': self._get_usage_description(image_type),
                    'fallback_info': f'No {image_type} files found in any directory',
                    'final_filename': final_filename,
                    'is_missing': True,
                    'compression_mode': 'compressed'  # Default for display, but won't be processed
                }
                menu_items.append(missing_item)

        # Show the comprehensive toggle menu using universal menu system
        try:
            if menu_items:
                def format_compression_item(item: Dict, index: int) -> str:
                    """Format each menu item with compression toggle info"""
                    final_filename = item.get('final_filename', self._get_final_filename(item['image_type']))

                    if item['is_missing']:
                        status = "[MISSING]"
                        compression_display = ""
                    else:
                        status = f"[{item['source']}]"
                        compression_display = " - [Compressed]" if item['compression_mode'] == 'compressed' else " - [Original]"

                    fallback_info = ""
                    if item.get('is_fallback'):
                        fallback_info = f" (fallback from {item.get('fallback_from', '')})"

                    return f"{item['image_type'].upper()}({final_filename}): {item['name']} {status}{compression_display}{fallback_info}"

                def format_compression_details(item: Dict) -> str:
                    """Format detailed info for each image type"""
                    final_filename = item.get('final_filename', self._get_final_filename(item['image_type']))
                    details = f"Image Type Details:\n"
                    details += f"  Usage: {item['usage_description']}\n"
                    details += f"  Final output: {final_filename}\n"

                    if item['is_missing']:
                        details += f"  Status: {item['fallback_info']}\n"
                        details += f"  Action: Will be skipped during processing"
                    else:
                        details += f"  File: {item['name']}\n"
                        details += f"  Path: {item['path']}\n"
                        details += f"  Format: {item['format']}\n"
                        details += f"  Size: {self._format_file_size(item['size_bytes'])}\n"
                        details += f"  Source: {item['source']}\n"
                        details += f"  Info: {item['fallback_info']}\n"
                        compression_text = "Compressed (will be compressed)" if item['compression_mode'] == 'compressed' else "Original (keep original format)"
                        details += f"  Mode: {compression_text}"

                    return details

                def toggle_compression_mode(items: List[Dict], selected_index: int) -> str:
                    """Toggle compression mode for current item (only for found images)"""
                    current_item = items[selected_index]
                    if not current_item['is_missing']:
                        if current_item['compression_mode'] == 'compressed':
                            current_item['compression_mode'] = 'original'
                        else:
                            current_item['compression_mode'] = 'compressed'
                    return 'continue'

                compression_config = {
                    'title': 'COMPRESSION SETTINGS FOR ALL IMAGE TYPES',
                    'items': menu_items,
                    'instructions': 'Use UP/DOWN arrows to navigate, LEFT/RIGHT to toggle compression for found images\nENTER to confirm all settings, ESC to use defaults',
                    'legend': 'Found images: Toggle LEFT/RIGHT to change compression mode\nMissing images: Will be skipped during processing\n[Compressed] = Will compress | [Original] = Keep original',
                    'item_formatter': format_compression_item,
                    'detail_formatter': format_compression_details,
                    'key_handlers': {
                        'left': toggle_compression_mode,
                        'right': toggle_compression_mode
                    },
                    'allow_quick_select': True,
                    'select_message': '[COMPRESSION-SETTINGS-CONFIRMED]',
                    'quick_select_message': '[COMPRESSION-QUICK-CONFIRM] Using default settings',
                    'cancel_message': '[COMPRESSION-CANCELLED] Using default compression settings'
                }

                PrintHelper.header("INTERACTIVE COMPRESSION SELECTION MENU")

                # Pause before showing the menu
                print()
                input("Press any key to continue...")
                print()

                # Use the universal menu system from menu_helper
                result = menu_helper.show_interactive_menu(compression_config)

                if result:
                    # Apply the compression settings back to the selected_images
                    for item in menu_items:
                        image_type = item['image_type']
                        if not item['is_missing'] and image_type in selected_images:
                            selected_images[image_type]['compression_mode'] = item['compression_mode']

                    PrintHelper.info("\n[COMPRESSION SETTINGS APPLIED] Final settings:")
                    for image_type in all_image_types:
                        if image_type in selected_images:
                            mode = selected_images[image_type]['compression_mode']
                            mode_text = "COMPRESSED" if mode == 'compressed' else "ORIGINAL"
                            PrintHelper.info(f"  {image_type.upper()}: {mode_text}")
                        else:
                            PrintHelper.info(f"  {image_type.upper()}: MISSING - Will be skipped")
                else:
                    PrintHelper.info("\n[DEFAULT SETTINGS] Using default compression settings (all compressed)")
                    # Apply default compression to all found images
                    for image_type in all_image_types:
                        if image_type in selected_images:
                            selected_images[image_type]['compression_mode'] = 'compressed'

        except Exception as e:
            PrintHelper.info(f"[WARNING] Could not show compression menu: {e}")
            PrintHelper.info("[DEFAULT] Using compressed mode for all found images")
            # Apply default compression
            for image_type in all_image_types:
                if image_type in selected_images:
                    selected_images[image_type]['compression_mode'] = 'compressed'

        PrintHelper.header("IMAGE PROCESSING PHASE")

        # Process each found image with final compression settings
        processed_count = 0
        for image_type in all_image_types:
            if image_type in selected_images:
                image_data = selected_images[image_type]
                compression_mode = image_data.get('compression_mode', 'compressed')
                compression_text = "COMPRESSED" if compression_mode == 'compressed' else "ORIGINAL"
                PrintHelper.info(f"\n[PROCESSING] {image_type.upper()}: {image_data['name']} - Mode: {compression_text}")

                # Process the image (including non-compressed ones for PNG conversion)
                try:
                    if hasattr(menu_helper, '_process_selected_image'):
                        menu_helper._process_selected_image(image_data)
                    elif hasattr(menu_helper, 'image_processor'):
                        # Process with explicit settings
                        compress = image_data.get('compression_mode') == 'compressed'
                        from pathlib import Path
                        input_path = Path(image_data['path'])
                        result = menu_helper.image_processor.process_image(
                            input_path=input_path,
                            output_format='.png',  # Always convert to PNG
                            compress=compress
                        )
                        if result['success']:
                            image_data['processed_path'] = result['processed_path']
                            image_data['processed_size'] = result['processed_size']
                            image_data['compression_ratio'] = result['compression_ratio']
                            PrintHelper.success(f"  Status: SUCCESS - Converted to PNG")
                            if compress:
                                PrintHelper.info(f"  Compression: Applied (ratio: {result.get('compression_ratio', 'N/A')})")
                            else:
                                PrintHelper.info(f"  Compression: Skipped (original quality preserved)")
                            PrintHelper.info(f"  Output: {result['processed_path']}")
                        else:
                            image_data['processing_error'] = result['error']
                            PrintHelper.error(f"  Status: FAILED - {result['error']}")
                    else:
                        PrintHelper.warning(f"  Status: SKIPPED - Image processor not available")

                    processed_count += 1

                except Exception as e:
                    PrintHelper.error(f"  Status: ERROR - {e}")
                    image_data['processing_error'] = str(e)
            else:
                PrintHelper.info(f"\n[SKIPPED] {image_type.upper()}: Not found - Missing from all directories")

        PrintHelper.info(f"\n[PROCESSING SUMMARY] Successfully processed {processed_count} out of {len(selected_images)} found images")
        PrintHelper.info(f"[PROCESSING SUMMARY] All processed images converted to PNG format in temporary directories")

        return selected_images

    def _get_usage_description(self, image_type: str) -> str:
        """Get usage description for an image type"""
        descriptions = {
            'logo': 'Application logo and branding',
            'background': 'Launch screen background image',
            'splash': 'Splash screen image',
            'ic_icon': 'Main application icon for Android',
            'notification_icon': 'Notification icon for Android system notifications',
            'transa_launcher': 'Transaction launcher icon for financial operations',
            'ic_launcher': 'Alternative launcher icon for Android'
        }
        return descriptions.get(image_type, f'{image_type} image')

    def _get_fallback_info(self, image_data: Dict) -> str:
        """Get fallback information for an image"""
        if image_data.get('is_fallback'):
            fallback_from = image_data.get('fallback_from', '')
            return f"Using {fallback_from} as fallback"
        return "Dedicated image found"

    def _apply_fallback_rules(self, selected_images: Dict) -> Dict:
        """Apply fallback rules for missing images with detailed logging"""
        PrintHelper.header("APPLYING FALLBACK RULES")

        # Show what we found initially
        found_images = []
        missing_images = []
        all_types = ['logo', 'background', 'splash', 'ic_icon', 'notification_icon', 'transa_launcher', 'ic_launcher']
        for image_type in all_types:
            if selected_images.get(image_type):
                found_images.append(image_type)
            else:
                missing_images.append(image_type)

        PrintHelper.info(f"Found images: {', '.join(found_images) if found_images else 'None'}")
        PrintHelper.info(f"Missing images: {', '.join(missing_images) if missing_images else 'None'}")
        PrintHelper.info("")

        # Apply ic_icon fallback to logo
        if not selected_images.get('ic_icon') and selected_images.get('logo'):
            logo_data = selected_images['logo'].copy()
            logo_data['is_fallback'] = True
            logo_data['fallback_from'] = 'logo'
            selected_images['ic_icon'] = logo_data
            PrintHelper.info(f"[FALLBACK] IC_ICON ← LOGO")
            PrintHelper.info(f"  Using: {logo_data['name']} from [{logo_data['source']}]")
            PrintHelper.info(f"  Reason: No dedicated ic_*.png files found, using logo as Android app icon")
            PrintHelper.info("")

        # Apply splash fallback to background
        if not selected_images.get('splash') and selected_images.get('background'):
            background_data = selected_images['background'].copy()
            background_data['is_fallback'] = True
            background_data['fallback_from'] = 'background'
            selected_images['splash'] = background_data
            PrintHelper.info(f"[FALLBACK] SPLASH ← BACKGROUND")
            PrintHelper.info(f"  Using: {background_data['name']} from [{background_data['source']}]")
            PrintHelper.info(f"  Reason: No dedicated splash*.png files found, using background as splash screen")
            PrintHelper.info("")

        # Show final status
        final_found = []
        still_missing = []
        for image_type in all_types:
            if selected_images.get(image_type):
                final_found.append(image_type)
            else:
                still_missing.append(image_type)

        PrintHelper.info("FALLBACK RESULTS:")
        PrintHelper.info(f"  Available after fallback: {', '.join(final_found) if final_found else 'None'}")
        if still_missing:
            PrintHelper.info(f"  Still missing: {', '.join(still_missing)}")
            PrintHelper.info("\n[SUGGESTIONS] To add missing images:")
            for missing_type in still_missing:
                if missing_type in ['logo', 'ic_icon', 'notification_icon', 'transa_launcher', 'ic_launcher']:
                    PrintHelper.info(f"  • {missing_type.upper()}: Add {missing_type}*.png/jpg/webp to icons/ directories")
                else:  # background, splash
                    PrintHelper.info(f"  • {missing_type.upper()}: Add {missing_type}*.png/jpg/webp to launch/ directories")

        return selected_images

    def _apply_intelligent_icon_finding(self, selected_images: Dict) -> Dict:
        """Apply intelligent icon finding logic with logo-based directory prioritization"""
        PrintHelper.header("APPLYING INTELLIGENT ICON FINDING")

        icon_types = ['ic_icon', 'notification_icon', 'transa_launcher', 'ic_launcher']
        logo_data = selected_images.get('logo')

        PrintHelper.info(f"Logo found: {'Yes' if logo_data else 'No'}")
        if logo_data:
            logo_dir = Path(logo_data['path']).parent
            PrintHelper.info(f"Logo directory: {logo_dir}")
            PrintHelper.info("Strategy: Search for icons in logo's directory first, then fallback to logo")
        else:
            PrintHelper.info("Strategy: Search for each icon from extended to common directories")
        PrintHelper.info("")

        for icon_type in icon_types:
            if selected_images.get(icon_type):
                PrintHelper.info(f"[SKIP] {icon_type.upper()}: Already found")
                continue

            PrintHelper.info(f"[SEARCH] {icon_type.upper()}:")

            if logo_data:
                # Strategy 1: Logo found - search only in logo's directory
                logo_dir = Path(logo_data['path']).parent
                found_icon = self._search_icon_in_directory(icon_type, logo_dir)

                if found_icon:
                    selected_images[icon_type] = found_icon
                    PrintHelper.info(f"  ✓ Found {icon_type}: {found_icon['name']} in logo's directory")
                else:
                    # Use logo as fallback
                    logo_fallback = logo_data.copy()
                    logo_fallback['is_fallback'] = True
                    logo_fallback['fallback_from'] = 'logo'
                    logo_fallback['fallback_reason'] = f'No {icon_type} found in logo directory'
                    selected_images[icon_type] = logo_fallback
                    PrintHelper.info(f"  → Fallback: Using logo as {icon_type}")
            else:
                # Strategy 2: No logo - search from extended to common directories
                found_icon = self._search_icon_comprehensive(icon_type)

                if found_icon:
                    selected_images[icon_type] = found_icon
                    PrintHelper.info(f"  ✓ Found {icon_type}: {found_icon['name']} in {found_icon['source']} directory")
                else:
                    PrintHelper.info(f"  ✗ Not found: {icon_type}")

        PrintHelper.info("\nICON FINDING RESULTS:")
        for icon_type in icon_types:
            icon_data = selected_images.get(icon_type)
            if icon_data:
                fallback_info = f" (fallback from {icon_data.get('fallback_from')})" if icon_data.get('is_fallback') else ""
                PrintHelper.info(f"  {icon_type.upper()}: {icon_data['name']}{fallback_info}")
            else:
                PrintHelper.info(f"  {icon_type.upper()}: [NOT FOUND]")

        return selected_images

    def _search_icon_in_directory(self, icon_type: str, directory: Path) -> Optional[Dict]:
        """Search for a specific icon type in a specific directory"""
        icon_patterns = self._get_icon_search_patterns(icon_type)

        for pattern in icon_patterns:
            for ext in ['.png', '.jpg', '.jpeg', '.webp']:
                icon_path = directory / f"{pattern}{ext}"
                if icon_path.exists():
                    return self._create_image_data(icon_path, 'CUSTOM')
        return None

    def _search_icon_comprehensive(self, icon_type: str) -> Optional[Dict]:
        """Search for icon comprehensively from extended to common directories"""
        icon_patterns = self._get_icon_search_patterns(icon_type)

        # Get all resource directories from asset scanner
        # We'll search through common directory structure
        search_dirs = [
            Path.cwd() / 'lib' / 'apps',  # Current app specific
            Path.cwd() / 'lib' / 'common',  # Common resources
            Path.cwd() / 'lib' / 'shared',  # Shared resources
            Path.cwd() / 'assets',  # Root assets
            Path.cwd() / 'assets' / 'icons',  # Root icons
        ]

        # Search in order of priority: extended -> common
        for search_dir in search_dirs:
            if not search_dir.exists():
                continue

            # Search recursively in this directory
            for pattern in icon_patterns:
                for ext in ['.png', '.jpg', '.jpeg', '.webp']:
                    # Search for direct matches
                    icon_files = list(search_dir.rglob(f"{pattern}{ext}"))
                    if icon_files:
                        # Use the first match found
                        icon_path = icon_files[0]
                        source_type = self._determine_source_type(icon_path, search_dir)
                        return self._create_image_data(icon_path, source_type)

        return None

    def _determine_source_type(self, icon_path: Path, base_dir: Path) -> str:
        """Determine the source type based on the directory structure"""
        relative_path = str(icon_path.relative_to(Path.cwd())).lower()

        if 'common' in relative_path:
            return 'COMMON'
        elif 'shared' in relative_path:
            return 'SHARED'
        elif 'apps' in relative_path:
            return 'BUILTIN'
        else:
            return 'CUSTOM'

    def _get_icon_search_patterns(self, icon_type: str) -> List[str]:
        """Get search patterns for different icon types"""
        patterns = {
            'ic_icon': ['ic_icon', 'ic_launcher', 'icon'],
            'notification_icon': ['notification_icon', 'notification', 'notify_icon', 'notify'],
            'transa_launcher': ['transa_launcher', 'transa', 'launcher_transa'],
            'ic_launcher': ['ic_launcher', 'launcher', 'app_launcher']
        }
        return patterns.get(icon_type, [icon_type])

    def _create_image_data(self, image_path: Path, source: str) -> Dict:
        """Create image data dictionary from path"""
        return {
            'name': image_path.name,
            'path': str(image_path),
            'format': image_path.suffix.upper()[1:],  # Remove dot and uppercase
            'size_bytes': image_path.stat().st_size,
            'source': source
        }

    def _get_final_filename(self, image_type: str) -> str:
        """Get the final converted filename for each image type"""
        final_filenames = {
            'logo': 'logo.png',
            'background': 'background.png',
            'splash': 'splash.png',
            'ic_icon': 'ic_icon.png',
            'notification_icon': 'notification_icon.png',
            'transa_launcher': 'transa_launcher.png',
            'ic_launcher': 'ic_launcher.png'
        }
        return final_filenames.get(image_type, f'{image_type}.png')

    def _show_compression_menu(self, selected_images: Dict, menu_helper: Any) -> Dict:
        """Show compression options menu for all selected images with individual usage labels"""
        available_images = {k: v for k, v in selected_images.items() if v}

        if not available_images:
            PrintHelper.info("\n[SKIP] No images available for compression selection")
            return selected_images

        PrintHelper.header("INDIVIDUAL IMAGE COMPRESSION SELECTION")
        PrintHelper.info("Each image usage has independent compression settings:")
        PrintHelper.info("Use UP/DOWN arrows to navigate, LEFT/RIGHT to toggle compression, ENTER to confirm selection")
        PrintHelper.info("")

        # Process each image type individually with clear usage labels
        processed_images = {}
        all_image_types = ['logo', 'background', 'splash', 'ic_icon', 'notification_icon', 'transa_launcher', 'ic_launcher']
        for image_type in all_image_types:
            if image_type in available_images:
                image_data = available_images[image_type]

                # Create a copy with usage-specific information
                item = image_data.copy()

                # Add usage-specific labels and descriptions
                usage_info = self._get_usage_info(image_type, image_data)
                item['usage_type'] = image_type
                item['usage_description'] = usage_info['description']
                item['fallback_info'] = usage_info['fallback_info']
                item['final_filename'] = usage_info['final_filename']

                PrintHelper.info("=" * 60)
                PrintHelper.info(f"CONFIGURING {image_type.upper()}({usage_info['final_filename']}) IMAGE")
                PrintHelper.info("=" * 60)
                PrintHelper.info(f"Usage: {usage_info['description']}")
                if usage_info['fallback_info']:
                    PrintHelper.info(f"Source: {usage_info['fallback_info']}")
                PrintHelper.info(f"File: {image_data['name']} ({image_data.get('format', '').upper()}, {self._format_file_size(image_data.get('size_bytes', 0))})")
                PrintHelper.info(f"Final output: {usage_info['final_filename']}")
                PrintHelper.info(f"Path: {image_data['path']}")
                PrintHelper.info("")

                # Show individual compression menu for this usage
                try:
                    if hasattr(self.asset_scanner, 'show_image_selection_menu'):
                        # Create single-item list for individual selection
                        single_item_list = [item]
                        selected_item = self.asset_scanner.show_image_selection_menu(
                            menu_helper, single_item_list, f"{image_type} usage"
                        )

                        if selected_item and 'compression_mode' in selected_item:
                            # Store the individually selected compression mode
                            processed_images[image_type] = selected_item
                            mode_text = "COMPRESSED" if selected_item['compression_mode'] == 'compressed' else "ORIGINAL"
                            PrintHelper.info(f"[SELECTED] {image_type.upper()} compression: {mode_text}")
                        else:
                            # User cancelled or no selection, keep original with default compression
                            item['compression_mode'] = 'compressed'
                            processed_images[image_type] = item
                            PrintHelper.info(f"[DEFAULT] {image_type.upper()} compression: COMPRESSED (default)")
                    else:
                        # Fallback: use default compression
                        item['compression_mode'] = 'compressed'
                        processed_images[image_type] = item
                        PrintHelper.info(f"[DEFAULT] {image_type.upper()} compression: COMPRESSED (fallback)")

                except Exception as e:
                    PrintHelper.info(f"[ERROR] Could not configure {image_type}: {e}")
                    # Use default compression on error
                    item['compression_mode'] = 'compressed'
                    processed_images[image_type] = item

                PrintHelper.info("")

        # Return the processed images with individual compression settings
        return processed_images

    def _get_usage_info(self, image_type: str, image_data: Dict) -> Dict:
        """Get usage information and fallback details for an image type"""
        is_fallback = image_data.get('is_fallback', False)
        fallback_from = image_data.get('fallback_from', '')

        usage_descriptions = {
            'logo': 'Application logo and branding',
            'background': 'Launch screen background image',
            'splash': 'Splash screen image',
            'ic_icon': 'Main application icon for Android',
            'notification_icon': 'Notification icon for Android system notifications',
            'transa_launcher': 'Transaction launcher icon for financial operations',
            'ic_launcher': 'Alternative launcher icon for Android'
        }

        description = usage_descriptions.get(image_type, f'{image_type} image')
        final_filename = self._get_final_filename(image_type)

        fallback_info = ""
        if is_fallback and fallback_from:
            fallback_info = f"Using {fallback_from} image as fallback (no dedicated {image_type} found)"
        elif not is_fallback:
            fallback_info = f"Dedicated {image_type} image found"

        return {
            'description': description,
            'fallback_info': fallback_info,
            'final_filename': final_filename
        }

    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size in human readable format"""
        if size_bytes < 1024:
            return f"{size_bytes}B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f}KB"
        else:
            return f"{size_bytes / (1024 * 1024):.1f}MB"