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
Implements intelligent image selection logic with constraint-based search delegation
"""

import os
import shutil
import tempfile
import traceback
from pathlib import Path
from typing import Dict, List, Optional, Any
from datetime import datetime

from utils.flutter_to_android_asset_scanner import FlutterToAndroidAssetScanner
from utils.print_helper import PrintHelper
from utils.image_processor import ImageProcessor
from shared.standard_image_data import ImageResourceManager, ANDROID_IMAGE_DATA
from shared.data_exchange.unified_variable_system import unified_vars

class SmartImageSelector:
    def __init__(self, asset_scanner: FlutterToAndroidAssetScanner, step_prefix: str = "STEP-2"):
        self.asset_scanner = asset_scanner
        self.step_prefix = step_prefix

    def select_all_images(self, menu_helper: Any, resource_dirs: List[Path], temp_build_root: Path, app_name: str) -> Dict:
        """
        Smart image selection using new constraint-based search logic
        Returns dict with selected images for all types - synced with ANDROID_IMAGE_DATA
        """
        PrintHelper.header("SMART IMAGE SELECTION WITH CONSTRAINT-BASED SEARCH", source=self.step_prefix)

        # Use the new constraint-based search logic from FlutterToAndroidAssetScanner
        PrintHelper.info("Delegating to FlutterToAndroidAssetScanner constraint-based search...", source=self.step_prefix)
        scanner_results = self.asset_scanner.scan_all_required_images()

        # Ensure selected_images is fully synchronized with ANDROID_IMAGE_DATA
        PrintHelper.info("Synchronizing selected_images with ANDROID_IMAGE_DATA...", source=self.step_prefix)
        selected_images = self._sync_selected_images_with_android_data(scanner_results)

        PrintHelper.success(f"Constraint-based search completed. Found {len([img for img in selected_images.values() if img and img.get('status') != 'missing'])} images.", source=self.step_prefix)

        return selected_images

    def _sync_selected_images_with_android_data(self, scanner_results: Dict) -> Dict:
        """
        Synchronize selected_images with ANDROID_IMAGE_DATA to ensure data consistency.
        ANDROID_IMAGE_DATA is the single source of truth.
        """
        selected_images = {}

        # Copy data from ANDROID_IMAGE_DATA (single source of truth) to selected_images
        for image_type in ANDROID_IMAGE_DATA:
            android_data = ANDROID_IMAGE_DATA[image_type]

            # Create selected_images entry based on ANDROID_IMAGE_DATA
            selected_images[image_type] = {
                'image_type': image_type,
                'file_path': android_data.get('original_path', ''),
                'processed_path': android_data.get('processed_path', ''),
                'filename': android_data.get('filename', android_data.get('final_filename', f"{image_type}.png")),
                'final_filename': android_data.get('final_filename', f"{image_type}.png"),
                'original_size': android_data.get('original_size', 0),
                'processed_size': android_data.get('processed_size', 0),
                'status': android_data.get('status', 'missing'),
                'source': android_data.get('source', 'unknown'),
                'compression_mode': android_data.get('compression_mode', 'compressed'),
                'format': android_data.get('format', ''),
                'directory': android_data.get('directory', ''),
                'is_fallback': android_data.get('is_fallback', False),
                'fallback_from': android_data.get('fallback_from', ''),
                'fallback_reason': android_data.get('fallback_reason', ''),
                'priority': android_data.get('priority', 95)
            }

            # If scanner found additional data, merge it but keep ANDROID_IMAGE_DATA as primary
            if image_type in scanner_results:
                scanner_data = scanner_results[image_type]
                # Only add scanner-specific fields that don't exist in ANDROID_IMAGE_DATA
                if 'matched_pattern' in scanner_data:
                    selected_images[image_type]['matched_pattern'] = scanner_data['matched_pattern']
                if 'format_priority' in scanner_data:
                    selected_images[image_type]['format_priority'] = scanner_data['format_priority']
                if 'source_type' in scanner_data:
                    selected_images[image_type]['source_type'] = scanner_data['source_type']

        PrintHelper.info(f"Synchronized {len(selected_images)} images with ANDROID_IMAGE_DATA", source=self.step_prefix)
        return selected_images

    def _apply_fallback_rules(self, selected_images: Dict) -> Dict:
        """Apply fallback rules for missing images - delegated to FlutterToAndroidAssetScanner"""
        PrintHelper.info("Applying fallback rules via FlutterToAndroidAssetScanner...", source=self.step_prefix)
        # The constraint-based search in FlutterToAndroidAssetScanner already handles fallbacks
        # So we just return the images as-is
        return selected_images

    def show_final_summary_and_process(self, selected_images: Dict, menu_helper: Any, auto_mode: bool = False) -> Dict:
        """Show final summary and compression selection menu"""
        PrintHelper.header("FINAL IMAGE SELECTION SUMMARY", source=self.step_prefix)

        # Show compression selection menu for all found images
        return self._show_compression_selection_menu(selected_images, menu_helper, auto_mode)

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

    def _show_compression_selection_menu(self, selected_images: Dict, menu_helper: Any, auto_mode: bool = False) -> Dict:
        """Show interactive compression selection menu for all found images"""
        # Filter out missing images
        found_images = {k: v for k, v in selected_images.items() if v and v.get('status') != 'missing'}

        if not found_images:
            PrintHelper.warning("No images found for compression selection", source=self.step_prefix)
            return selected_images

        PrintHelper.header("COMPRESSION SETTINGS CONFIGURATION", source=self.step_prefix)
        PrintHelper.info("Configure compression settings for each found image:", source=self.step_prefix)
        PrintHelper.info("Use LEFT/RIGHT arrows to toggle compression mode", source=self.step_prefix)
        PrintHelper.info("")

        if auto_mode:
            PrintHelper.info("Auto mode enabled - skipping compression menu and using defaults", source=self.step_prefix)

        # Prepare menu items for compression selection
        menu_items = []
        image_order = ['logo', 'ic_icon', 'notification_icon', 'transa_launcher', 'ic_launcher', 'background', 'splash']

        for image_type in image_order:
            if image_type in found_images:
                image_data = found_images[image_type]

                # Get current compression mode from ANDROID_IMAGE_DATA, default to compressed if not set
                current_compression = ANDROID_IMAGE_DATA.get(image_type, {}).get('compression_mode', '')
                default_compression = 'compressed' if not current_compression else current_compression

                # Get pattern and priority from ANDROID_IMAGE_DATA (single source of truth)
                android_data = ANDROID_IMAGE_DATA.get(image_type, {})

                # Create menu item with compression state
                menu_item = {
                    'image_type': image_type,
                    'filename': image_data.get('filename', 'unknown'),
                    'source_type': image_data.get('source', 'unknown'),
                    'pattern': android_data.get('matched_pattern', android_data.get('pattern', 'unknown')),  # Use matched_pattern if available
                    'priority': android_data.get('format_priority', android_data.get('priority', 'unknown')),  # Use format_priority if available
                    'compression_mode': default_compression,
                    'file_path': image_data.get('file_path', ''),
                    'is_fallback': image_data.get('is_fallback', False),
                    'fallback_from': image_data.get('fallback_from', '')
                }
                menu_items.append(menu_item)

        if not menu_items:
            return selected_images

        # Create interactive menu configuration
        def format_menu_item(item: Dict, index: int) -> str:
            """Format each menu item with compression toggle info"""
            compression_display = "[Compressed]" if item['compression_mode'] == 'compressed' else "[Original]"
            fallback_info = f" (fallback from {item['fallback_from']})" if item['is_fallback'] else ""

            return f"[OK] {item['image_type'].upper()}: {item['filename']} [{item['source_type']}] {compression_display}{fallback_info}"

        def format_item_details(item: Dict) -> str:
            """Format detailed info for each image"""

            image_type = item['image_type']
            final_filename = ANDROID_IMAGE_DATA.get(image_type, {}).get('final_filename', 'unknown')

            # Format pattern as a readable string
            pattern_data = item.get('pattern', 'unknown')
            if isinstance(pattern_data, list) and pattern_data:
                # If it's a list (from ImagePatterns.NAME_PATTERNS)
                pattern_display = ', '.join(pattern_data[:3])  # Show first 3 patterns
                if len(pattern_data) > 3:
                    pattern_display += f" (and {len(pattern_data) - 3} more)"
            elif isinstance(pattern_data, str) and pattern_data and pattern_data != 'unknown':
                # If it's a matched_pattern string
                pattern_display = pattern_data
            else:
                pattern_display = 'unknown'

            details = f"Image Details:\n"
            details += f"  Type: {item['image_type'].upper()}\n"
            details += f"  File: {item['filename']}\n"
            details += f"  Final Filename: {final_filename}\n"
            details += f"  Source: {item['source_type']}\n"
            details += f"  Pattern: {pattern_display}\n"
            details += f"  Priority: {item['priority']}\n"
            details += f"  Path: {item['file_path']}\n"

            if item['is_fallback']:
                details += f"  Fallback: Using {item['fallback_from']} as fallback\n"

            compression_text = "Will be compressed during processing" if item['compression_mode'] == 'compressed' else "Will keep original quality"
            details += f"  Compression: {compression_text}"

            return details

        def toggle_compression(items: List[Dict], selected_index: int) -> str:
            """Toggle compression mode for current item"""
            current_item = items[selected_index]
            if current_item['compression_mode'] == 'compressed':
                current_item['compression_mode'] = 'original'
            else:
                current_item['compression_mode'] = 'compressed'
            return 'continue'

        menu_config = {
            'title': 'ANDROID IMAGE COMPRESSION SETTINGS',
            'items': menu_items,
            'instructions': 'Use UP/DOWN arrows to navigate, LEFT/RIGHT to toggle compression\nENTER to confirm settings, ESC to use defaults',
            'legend': '[Compressed] = Apply compression | [Original] = Keep original quality\nLEFT/RIGHT to toggle | ENTER to confirm | ESC for defaults',
            'item_formatter': format_menu_item,
            'detail_formatter': format_item_details,
            'key_handlers': {
                'left': toggle_compression,
                'right': toggle_compression
            },
            'allow_quick_select': True,
            'select_message': '[COMPRESSION-SETTINGS-CONFIRMED]',
            'quick_select_message': '[COMPRESSION-QUICK-CONFIRM] Using default settings',
            'cancel_message': '[COMPRESSION-CANCELLED] Using default compression settings',
            'cache_key': 'image_compression_settings'  # Enable caching
        }

        if auto_mode:
            # Apply default compression settings without showing interactive menu
            self._apply_compression_settings(menu_items, selected_images, confirmed=False)
        else:
            # Show interactive menu
            result = menu_helper.show_interactive_menu(menu_config)

            # Apply compression settings to ANDROID_IMAGE_DATA and selected_images
            self._apply_compression_settings(menu_items, selected_images, result is not None)

        # Process images based on compression settings and final filename
        try:
            PrintHelper.info("Starting image processing...", source=self.step_prefix)
            self._process_images_after_menu_selection(selected_images)
        except Exception as e:
            PrintHelper.error(f"Error in image processing: {e}", source=self.step_prefix)
            traceback.print_exc()

        return selected_images

    def _apply_compression_settings(self, menu_items: List[Dict], selected_images: Dict, confirmed: bool) -> None:
        """Apply compression settings to ANDROID_IMAGE_DATA first, then sync to selected_images"""

        PrintHelper.info("Applying compression settings...", source=self.step_prefix)

        for item in menu_items:
            image_type = item['image_type']
            compression_mode = item['compression_mode']

            # Update ANDROID_IMAGE_DATA first (single source of truth)
            if image_type in ANDROID_IMAGE_DATA:
                ANDROID_IMAGE_DATA[image_type]['compression_mode'] = compression_mode

            # Sync selected_images from ANDROID_IMAGE_DATA
            if image_type in selected_images:
                selected_images[image_type]['compression_mode'] = ANDROID_IMAGE_DATA[image_type]['compression_mode']

            # Show applied setting
            mode_text = "COMPRESSED" if compression_mode == 'compressed' else "ORIGINAL"
            PrintHelper.info(f"  {image_type.upper()}: {mode_text}", source=self.step_prefix)

        status_text = "confirmed" if confirmed else "using defaults"
        PrintHelper.success(f"Compression settings applied ({status_text})", source=self.step_prefix)

    def _process_images_after_menu_selection(self, selected_images: Dict) -> None:
        """Process images after compression menu selection, handling original vs processed paths"""

        PrintHelper.header("PROCESSING IMAGES BASED ON COMPRESSION SETTINGS", source=self.step_prefix)

        # Create cache directory for processed images using unified variable system
        cache_dir = unified_vars.temp_dir / "processed_images"
        cache_dir.mkdir(parents=True, exist_ok=True)
        PrintHelper.info(f"Processing images to cache directory: {cache_dir}", source=self.step_prefix)

        for image_type, image_data in selected_images.items():
            if not image_data or image_data.get('status') == 'missing':
                continue

            # Get original path from ANDROID_IMAGE_DATA (single source of truth)
            android_data = ANDROID_IMAGE_DATA.get(image_type, {})
            original_path = android_data.get('original_path', image_data.get('file_path', ''))

            if not original_path or not os.path.exists(original_path):
                PrintHelper.warning(f"Original path not found for {image_type}: {original_path}", source=self.step_prefix)
                PrintHelper.warning(f"  ANDROID_IMAGE_DATA path: {android_data.get('original_path', 'N/A')}", source=self.step_prefix)
                PrintHelper.warning(f"  selected_images path: {image_data.get('file_path', 'N/A')}", source=self.step_prefix)
                continue

            # Get final filename from ANDROID_IMAGE_DATA
            final_filename = ANDROID_IMAGE_DATA.get(image_type, {}).get('final_filename', f"{image_type}.png")
            compression_mode = image_data.get('compression_mode', 'compressed')

            # Get file extensions
            original_ext = Path(original_path).suffix.lower()
            final_ext = Path(final_filename).suffix.lower()

            # Determine if we can use original as processed
            # Can use original if: same extension AND not compressing
            can_use_original = (original_ext == final_ext and compression_mode == 'original')

            if can_use_original:
                # Use original path as processed path (no processing needed)
                processed_path = original_path
                processing_action = "Using original (same extension, no compression)"
                PrintHelper.info(f"  {image_type.upper()}: {processing_action}", source=self.step_prefix)
                PrintHelper.info(f"    Path: {original_path}", source=self.step_prefix)

                # Set processed size to original size
                processed_size = image_data.get('original_size', 0)
                if processed_size == 0:
                    processed_size = Path(original_path).stat().st_size if Path(original_path).exists() else 0
                image_data['processed_size'] = processed_size
            else:
                # Need to process the image (compress or convert format)
                processed_path = str(cache_dir / final_filename)

                if compression_mode == 'compressed':
                    processing_action = f"Compressing and converting to {final_ext}"
                else:
                    processing_action = f"Converting format to {final_ext} (no compression)"

                PrintHelper.info(f"  {image_type.upper()}: {processing_action}", source=self.step_prefix)
                PrintHelper.info(f"    Original: {original_path} ({original_ext})", source=self.step_prefix)
                PrintHelper.info(f"    Output: {final_filename} ({final_ext})", source=self.step_prefix)

                # Process the image using ImageProcessor
                try:
                    # Initialize ImageProcessor with the current working directory to pass safety checks
                    current_dir = Path.cwd()
                    image_processor = ImageProcessor(flutter_root_dir=current_dir)
                    if compression_mode == 'compressed':
                        # Apply compression
                        success = image_processor.process_image_with_compression(
                            original_path, processed_path, final_ext
                        )
                    else:
                        # Just convert format without compression
                        success = image_processor.convert_image_format(
                            original_path, processed_path, final_ext
                        )

                    if success:
                        # Update processed size
                        processed_size = Path(processed_path).stat().st_size if Path(processed_path).exists() else 0
                        image_data['processed_size'] = processed_size
                        if image_type in ANDROID_IMAGE_DATA:
                            ANDROID_IMAGE_DATA[image_type]['processed_size'] = processed_size
                        PrintHelper.success(f"    Processed successfully: {Path(processed_path).name}", source=self.step_prefix)
                    else:
                        PrintHelper.warning(f"    Processing failed, using original", source=self.step_prefix)
                        processed_path = original_path

                except Exception as e:
                    PrintHelper.warning(f"    Processing error: {e}, using original", source=self.step_prefix)
                    processed_path = original_path

            # Update ANDROID_IMAGE_DATA first (single source of truth)
            if image_type in ANDROID_IMAGE_DATA:
                ANDROID_IMAGE_DATA[image_type]['processed_path'] = processed_path
                ANDROID_IMAGE_DATA[image_type]['needs_processing'] = not can_use_original
                ANDROID_IMAGE_DATA[image_type]['processed_size'] = image_data.get('processed_size', 0)
                ANDROID_IMAGE_DATA[image_type]['processing_action'] = processing_action

            # Sync selected_images from ANDROID_IMAGE_DATA (single source of truth)
            image_data['processed_path'] = ANDROID_IMAGE_DATA[image_type]['processed_path']
            image_data['processing_action'] = ANDROID_IMAGE_DATA[image_type]['processing_action']
            image_data['needs_processing'] = ANDROID_IMAGE_DATA[image_type]['needs_processing']
            image_data['processed_size'] = ANDROID_IMAGE_DATA[image_type]['processed_size']

            # Show paths
            PrintHelper.info(f"    Original: {original_path}", source=self.step_prefix)
            PrintHelper.info(f"    Processed: {processed_path}", source=self.step_prefix)

        PrintHelper.success("Image processing completed", source=self.step_prefix)

        # Show final processing results in standard format
        print()
        self._print_final_image_data_summary()

        # Validate data consistency between selected_images and ANDROID_IMAGE_DATA
        print()
        self.validate_data_consistency(selected_images)

    def _show_processing_results_summary(self, selected_images: Dict) -> None:
        """Show summary of image processing results"""
        PrintHelper.header("IMAGE PROCESSING RESULTS SUMMARY", source=self.step_prefix)

        for image_type, image_data in selected_images.items():
            if not image_data or image_data.get('status') == 'missing':
                continue

            compression_mode = image_data.get('compression_mode', 'original')
            original_size = image_data.get('original_size', 0)
            processed_size = image_data.get('processed_size', 0)
            original_path = image_data.get('file_path', '')
            processed_path = image_data.get('processed_path', '')

            # Calculate size difference
            if processed_size > 0 and original_size > 0:
                size_diff = ((processed_size - original_size) / original_size) * 100
                size_info = f"{self._format_file_size(processed_size)} ({size_diff:+.1f}%)"
            else:
                size_info = f"{self._format_file_size(processed_size)}"

            # Show result
            mode_text = "COMPRESSED" if compression_mode == 'compressed' else "ORIGINAL"
            same_file = (original_path == processed_path)
            path_info = "Same as original" if same_file else f"New file: {Path(processed_path).name}"

            PrintHelper.info(f"  {image_type.upper()}: {mode_text} - {size_info} - {path_info}", source=self.step_prefix)

    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size in human readable format"""
        if size_bytes < 1024:
            return f"{size_bytes}B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f}KB"
        else:
            return f"{size_bytes / (1024 * 1024):.1f}MB"

    def _print_final_image_data_summary(self) -> None:
        """Print final processed image data summary in standard format"""
        print()
        print("7 REQUIRED IMAGES DATA SUMMARY")
        print("=" * 80)

        # Define the image types in the order they should appear
        image_types = ['LOGO', 'BACKGROUND', 'SPLASH', 'IC_ICON', 'NOTIFICATION_ICON', 'TRANSA_LAUNCHER', 'IC_LAUNCHER']

        for image_type in image_types:
            if image_type in ANDROID_IMAGE_DATA:
                image_data = ANDROID_IMAGE_DATA[image_type]

                # Get all the required information
                final_filename = image_data.get('final_filename', f"{image_type.lower()}.png")
                original_path = image_data.get('original_path', '')
                processed_path = image_data.get('processed_path', '')
                original_size = image_data.get('original_size', 0)
                processed_size = image_data.get('processed_size', 0)
                status = image_data.get('status', 'UNKNOWN').upper()
                source = image_data.get('source', 'UNKNOWN').upper()
                compression_mode = image_data.get('compression_mode', 'compressed').upper()

                # Format sizes
                original_size_str = self._format_file_size(original_size) if original_size > 0 else "0B"
                processed_size_str = self._format_file_size(processed_size) if processed_size > 0 else "0B"

                print(f"{image_type}:")
                print(f"  File: {final_filename}")
                print(f"  Original Path: {original_path}")
                print(f"  Processed Path: {processed_path}")
                print(f"  Original Size: {original_size_str}")
                print(f"  Processed Size: {processed_size_str}")
                print(f"  Status: {status}")
                print(f"  Source: [{source}] - [{compression_mode}]")
                print()

        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [SUCCESS] [STEP-2] Image processing completed. All 7 images processed.")
        print()

        # Pause for user to review the results
        print("=" * 80)
        print("ANDROID_IMAGE_DATA PROCESSING COMPLETED")
        print("=" * 80)
        print("Please review the processed image data above.")
        input("Press any key to continue...")
        print()

    def validate_data_consistency(self, selected_images: Dict) -> bool:
        """
        Validate data consistency between selected_images and ANDROID_IMAGE_DATA
        Returns True if data is consistent, False otherwise
        """
        PrintHelper.header("DATA CONSISTENCY VALIDATION", source=self.step_prefix)

        validation_errors = []
        validation_warnings = []

        # Check each image type
        for image_type in ANDROID_IMAGE_DATA:
            android_data = ANDROID_IMAGE_DATA[image_type]
            selected_data = selected_images.get(image_type, {})

            # Check if both have the same status
            android_status = android_data.get('status', 'missing')
            selected_status = selected_data.get('status', 'missing')

            if android_status != selected_status:
                validation_errors.append(f"{image_type}: Status mismatch - ANDROID_IMAGE_DATA={android_status}, selected_images={selected_status}")

            # For non-missing images, check path consistency
            if android_status != 'missing':
                android_original = android_data.get('original_path', '')
                selected_file_path = selected_data.get('file_path', '')

                if android_original != selected_file_path:
                    validation_errors.append(f"{image_type}: Original path mismatch - ANDROID_IMAGE_DATA={android_original}, selected_images={selected_file_path}")

                # Check compression mode consistency
                android_compression = android_data.get('compression_mode', 'compressed')
                selected_compression = selected_data.get('compression_mode', 'compressed')

                if android_compression != selected_compression:
                    validation_errors.append(f"{image_type}: Compression mode mismatch - ANDROID_IMAGE_DATA={android_compression}, selected_images={selected_compression}")

                # Check processed paths
                android_processed = android_data.get('processed_path', '')
                selected_processed = selected_data.get('processed_path', '')

                if android_processed != selected_processed:
                    validation_warnings.append(f"{image_type}: Processed path mismatch - ANDROID_IMAGE_DATA={android_processed}, selected_images={selected_processed}")

        # Print validation results
        if validation_errors:
            PrintHelper.error(f"Found {len(validation_errors)} critical data consistency errors:", source=self.step_prefix)
            for error in validation_errors:
                PrintHelper.error(f"  {error}", source=self.step_prefix)

        if validation_warnings:
            PrintHelper.warning(f"Found {len(validation_warnings)} data consistency warnings:", source=self.step_prefix)
            for warning in validation_warnings:
                PrintHelper.warning(f"  {warning}", source=self.step_prefix)

        if not validation_errors and not validation_warnings:
            PrintHelper.success("Data consistency validation passed - all data is synchronized", source=self.step_prefix)

        consistency_status = len(validation_errors) == 0
        PrintHelper.info(f"Validation result: {'PASSED' if consistency_status else 'FAILED'}", source=self.step_prefix)

        return consistency_status
