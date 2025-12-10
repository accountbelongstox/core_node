#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Android Resource Replacer
Intelligently replace Android app icons and splash screens with custom images
"""

import os
import sys
from pathlib import Path
from typing import List, Dict, Tuple, Optional
from PIL import Image
import xml.etree.ElementTree as ET


class ResourceReplacer:
    """Replace Android resources with intelligent scaling and cropping"""

    def __init__(self, android_path: str, assets_path: str, app_logo_src: str = "logo.png", splash_src: str = "splash.png"):
        """
        Initialize resource replacer

        Args:
            android_path: Path to android directory
            assets_path: Path to assets directory containing source images
            app_logo_src: Source filename for app logo (default: "logo.png")
            splash_src: Source filename for splash screen (default: "splash.png")
        """
        self.android_path = Path(android_path)
        self.assets_path = Path(assets_path)
        self.res_path = self.android_path / "app" / "src" / "main" / "res"

        # Source to target mapping (using configurable source filenames)
        self.mappings = {
            app_logo_src: ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png", "ic_launcher_background.png"],
            splash_src: ["splash.png"]
        }

        self.replaced_files = []

    def scan_target_files(self, filename_pattern: str) -> List[Path]:
        """
        Scan for all target files matching the pattern using recursive search

        Args:
            filename_pattern: File name to search for (e.g., "ic_launcher.png")

        Returns:
            List of matching file paths
        """
        target_files = []

        if not self.res_path.exists():
            return target_files

        # Use os.walk for full recursive search
        for root, dirs, files in os.walk(self.res_path):
            root_path = Path(root)
            # Check if this is a resource directory (mipmap-* or drawable-*)
            dir_name = root_path.name
            if dir_name.startswith("mipmap-") or dir_name.startswith("drawable"):
                if filename_pattern in files:
                    target_file = root_path / filename_pattern
                    target_files.append(target_file)

        return target_files

    def smart_resize_and_crop(self, source_img: Image.Image, target_size: Tuple[int, int]) -> Image.Image:
        """
        Smart resize and crop to fit target size

        Algorithm:
        1. Calculate aspect ratios
        2. Scale to cover the target size (fit shortest edge)
        3. Center crop to exact target size

        Args:
            source_img: Source PIL Image
            target_size: (width, height) tuple

        Returns:
            Resized and cropped PIL Image
        """
        src_width, src_height = source_img.size
        target_width, target_height = target_size

        # Calculate aspect ratios
        src_ratio = src_width / src_height
        target_ratio = target_width / target_height

        # Calculate scaling factor (fit shortest edge, cover the target)
        if src_ratio > target_ratio:
            # Source is wider - fit height
            scale_factor = target_height / src_height
        else:
            # Source is taller or same - fit width
            scale_factor = target_width / src_width

        # Calculate new dimensions after scaling
        new_width = int(src_width * scale_factor)
        new_height = int(src_height * scale_factor)

        # Resize using high-quality Lanczos filter
        resized_img = source_img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Center crop to exact target size
        left = (new_width - target_width) // 2
        top = (new_height - target_height) // 2
        right = left + target_width
        bottom = top + target_height

        cropped_img = resized_img.crop((left, top, right, bottom))

        return cropped_img

    def replace_file(self, source_path: Path, target_path: Path) -> bool:
        """
        Replace single target file with source image

        Args:
            source_path: Source image path
            target_path: Target image path to replace

        Returns:
            True if successful, False otherwise
        """
        try:
            # Open source image
            source_img = Image.open(source_path)

            # Open target to get size
            target_img = Image.open(target_path)
            target_size = target_img.size
            target_img.close()

            # Smart resize and crop
            result_img = self.smart_resize_and_crop(source_img, target_size)

            # Convert to RGB if necessary (remove alpha for JPEG compatibility)
            if result_img.mode == 'RGBA' and target_path.suffix.lower() in ['.jpg', '.jpeg']:
                # Create white background
                background = Image.new('RGB', result_img.size, (255, 255, 255))
                background.paste(result_img, mask=result_img.split()[3])  # Use alpha as mask
                result_img = background

            # Save to target path
            result_img.save(target_path, quality=95)

            source_img.close()
            result_img.close()

            print(f"  ✓ Replaced: {target_path.relative_to(self.android_path)}")
            print(f"    Size: {target_size[0]}x{target_size[1]}")

            self.replaced_files.append(str(target_path.relative_to(self.android_path)))

            return True

        except Exception as e:
            print(f"  ✗ Failed: {target_path.relative_to(self.android_path)}")
            print(f"    Error: {e}")
            return False

    def replace_resources(self) -> Dict[str, int]:
        """
        Replace all resources based on mappings

        Returns:
            Dictionary with statistics
        """
        stats = {
            "total_replaced": 0,
            "total_failed": 0,
            "by_source": {}
        }

        print("\n" + "=" * 60)
        print("Android Resource Replacement")
        print("=" * 60)

        for source_filename, target_patterns in self.mappings.items():
            source_path = self.assets_path / source_filename

            # Check if source exists
            if not source_path.exists():
                print(f"\n[Skip] Source not found: {source_filename}")
                print(f"  Expected location: {source_path}")
                print(f"  \033[93m[Warning] Configured resource file does not exist\033[0m")
                print(f"  \033[93m[Hint] Please check 'app_logo_src' or 'splash_src' in build_config.ini\033[0m")
                print(f"  \033[93m[Hint] Or place the file in: {self.assets_path}\033[0m")
                stats["by_source"][source_filename] = {"replaced": 0, "failed": 0}
                continue

            print(f"\n[Source] {source_filename}")
            print(f"  Path: {source_path}")

            source_img = Image.open(source_path)
            print(f"  Size: {source_img.size[0]}x{source_img.size[1]}")
            source_img.close()

            replaced_count = 0
            failed_count = 0

            # Process each target pattern
            for pattern in target_patterns:
                print(f"\n[Target Pattern] {pattern}")

                # Find all matching target files
                target_files = self.scan_target_files(pattern)

                if not target_files:
                    print(f"  No files found matching: {pattern}")
                    continue

                print(f"  Found {len(target_files)} files to replace:")

                # Replace each target file
                for target_file in target_files:
                    if self.replace_file(source_path, target_file):
                        replaced_count += 1
                    else:
                        failed_count += 1

            stats["by_source"][source_filename] = {
                "replaced": replaced_count,
                "failed": failed_count
            }
            stats["total_replaced"] += replaced_count
            stats["total_failed"] += failed_count

        # Print summary
        print("\n" + "=" * 60)
        print("Replacement Summary")
        print("=" * 60)

        for source_filename, source_stats in stats["by_source"].items():
            replaced = source_stats["replaced"]
            failed = source_stats["failed"]
            total = replaced + failed

            if total > 0:
                print(f"\n{source_filename}:")
                print(f"  ✓ Replaced: {replaced}/{total}")
                if failed > 0:
                    print(f"  ✗ Failed: {failed}/{total}")
            else:
                print(f"\n{source_filename}: No files processed")

        print(f"\nTotal Replaced: {stats['total_replaced']}")
        if stats['total_failed'] > 0:
            print(f"Total Failed: {stats['total_failed']}")

        return stats

    def get_replaced_files(self) -> List[str]:
        """
        Get list of replaced file paths

        Returns:
            List of relative file paths that were replaced
        """
        return self.replaced_files

    def update_android_strings(self, app_name: str, display_name_en: str,
                              display_name_cn: str, package_id: str,
                              supported_languages: str = '', config_info: dict = None) -> bool:
        """
        Update Android strings.xml with app display names and create localized versions

        Args:
            app_name: Technical app name (e.g., "cmg_club")
            display_name_en: English display name (e.g., "CMG-Shooting&Hotel")
            display_name_cn: Chinese display name (e.g., "CMG靶场&酒店")
            package_id: Package ID (e.g., "com.ddsj.cmg.club")
            supported_languages: Comma-separated language config (e.g., "zh:display_name_chinese")
            config_info: Full config dictionary for accessing custom display names

        Returns:
            True if successful, False otherwise
        """
        print("\n" + "=" * 60)
        print("Updating Android App Names (Multi-Language)")
        print("=" * 60)

        # Parse language configuration
        language_map = self._parse_language_config(supported_languages, config_info or {})

        # Update default strings.xml (English)
        self._update_or_create_strings_xml('values', display_name_en, package_id)

        # Create/update localized strings.xml for each supported language
        for lang_code, display_name in language_map.items():
            values_dir = f'values-{lang_code}'
            self._update_or_create_strings_xml(values_dir, display_name, package_id)

        print("\n" + "=" * 60)
        print(f"Updated strings.xml for {1 + len(language_map)} language(s)")
        print("=" * 60)

        return True

    def _parse_language_config(self, supported_languages: str, config_info: dict) -> dict:
        """
        Parse language configuration string

        Args:
            supported_languages: String like "zh:display_name_chinese,es:display_name_spanish"
            config_info: Full config dictionary

        Returns:
            Dictionary mapping language codes to display names
        """
        language_map = {}

        if not supported_languages or not supported_languages.strip():
            return language_map

        for lang_config in supported_languages.split(','):
            lang_config = lang_config.strip()
            if ':' not in lang_config:
                continue

            lang_code, field_name = lang_config.split(':', 1)
            lang_code = lang_code.strip()
            field_name = field_name.strip()

            # Get display name from config
            display_name = config_info.get(field_name, '')
            if display_name:
                language_map[lang_code] = display_name

        return language_map

    def _update_or_create_strings_xml(self, values_dir: str, display_name: str, package_id: str) -> bool:
        """
        Update or create strings.xml in a specific values directory

        Args:
            values_dir: Directory name (e.g., 'values', 'values-zh')
            display_name: Display name for this locale
            package_id: Package ID

        Returns:
            True if successful
        """
        values_path = self.res_path / values_dir
        strings_file = values_path / 'strings.xml'

        # Create directory if it doesn't exist
        if not values_path.exists():
            values_path.mkdir(parents=True, exist_ok=True)
            print(f"\n[Created] {values_dir}/ directory")

        # If strings.xml exists, update it; otherwise create new one
        if strings_file.exists():
            try:
                # Parse and update existing XML
                tree = ET.parse(strings_file)
                root = tree.getroot()

                # Update app_name
                app_name_elem = root.find(".//string[@name='app_name']")
                if app_name_elem is not None:
                    old_value = app_name_elem.text
                    app_name_elem.text = display_name
                    print(f"\n[{values_dir}/strings.xml]")
                    print(f"  app_name: '{old_value}' → '{display_name}'")
                else:
                    # Create app_name element
                    new_elem = ET.SubElement(root, 'string', name='app_name')
                    new_elem.text = display_name
                    print(f"\n[{values_dir}/strings.xml]")
                    print(f"  app_name: (new) → '{display_name}'")

                # Update title_activity_main if exists
                title_elem = root.find(".//string[@name='title_activity_main']")
                if title_elem is not None:
                    old_value = title_elem.text
                    title_elem.text = display_name
                    print(f"  title_activity_main: '{old_value}' → '{display_name}'")

                # Update package_name if exists
                package_elem = root.find(".//string[@name='package_name']")
                if package_elem is not None:
                    old_value = package_elem.text
                    package_elem.text = package_id
                    print(f"  package_name: '{old_value}' → '{package_id}'")

                # Update custom_url_scheme if exists
                scheme_elem = root.find(".//string[@name='custom_url_scheme']")
                if scheme_elem is not None:
                    old_value = scheme_elem.text
                    scheme_elem.text = package_id
                    print(f"  custom_url_scheme: '{old_value}' → '{package_id}'")

                # Write back
                tree.write(strings_file, encoding='utf-8', xml_declaration=True)

                # Fix formatting
                with open(strings_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                content = content.replace('encoding="utf-8"', "encoding='utf-8'")
                content = content.replace('name="', "name='").replace('">', "'>")
                with open(strings_file, 'w', encoding='utf-8') as f:
                    f.write(content)

                return True

            except Exception as e:
                print(f"\n[ERROR] Failed to update {strings_file}: {e}")
                return False
        else:
            # Create new strings.xml file
            try:
                root = ET.Element('resources')

                # Add app_name
                app_name_elem = ET.SubElement(root, 'string', name='app_name')
                app_name_elem.text = display_name

                # Add title_activity_main
                title_elem = ET.SubElement(root, 'string', name='title_activity_main')
                title_elem.text = display_name

                # Add package_name
                package_elem = ET.SubElement(root, 'string', name='package_name')
                package_elem.text = package_id

                # Add custom_url_scheme
                scheme_elem = ET.SubElement(root, 'string', name='custom_url_scheme')
                scheme_elem.text = package_id

                # Write to file
                tree = ET.ElementTree(root)
                tree.write(strings_file, encoding='utf-8', xml_declaration=True)

                # Fix formatting
                with open(strings_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                content = content.replace('encoding="utf-8"', "encoding='utf-8'")
                content = content.replace('name="', "name='").replace('">', "'>")
                with open(strings_file, 'w', encoding='utf-8') as f:
                    f.write(content)

                print(f"\n[Created] {values_dir}/strings.xml")
                print(f"  app_name: '{display_name}'")
                print(f"  package_name: '{package_id}'")

                return True

            except Exception as e:
                print(f"\n[ERROR] Failed to create {strings_file}: {e}")
                return False


def main():
    """Main entry point for testing"""
    if len(sys.argv) < 3:
        print("Usage: python resource_replacer.py <android_path> <assets_path>")
        sys.exit(1)

    android_path = sys.argv[1]
    assets_path = sys.argv[2]

    replacer = ResourceReplacer(android_path, assets_path)
    stats = replacer.replace_resources()

    # Print replaced files
    print("\n" + "=" * 60)
    print("Replaced Files:")
    print("=" * 60)
    for file_path in replacer.get_replaced_files():
        print(f"  - {file_path}")

    sys.exit(0 if stats["total_failed"] == 0 else 1)


if __name__ == '__main__':
    main()
