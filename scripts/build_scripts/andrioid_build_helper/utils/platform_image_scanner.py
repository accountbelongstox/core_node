#!/usr/bin/env python3
"""
Platform Image Scanner
Scans and displays platform-specific images in tree format
"""

import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from third_party import Image

class PlatformImageScanner:
    """Scanner for platform-specific images (Android, macOS, Windows, Web)"""

    def __init__(self):
        self.supported_formats = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.ico']
        self.platform_dirs = ['android', 'macos', 'windows', 'web']

    def format_file_size(self, size_bytes: int) -> str:
        """Format file size in human readable format"""
        if size_bytes < 1024:
            return f"{size_bytes}B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f}KB"
        else:
            return f"{size_bytes / (1024 * 1024):.1f}MB"

    def get_image_info(self, file_path: Path) -> Dict:
        """Get detailed information about an image file including dimensions"""
        try:
            stat = file_path.stat()

            # Get image dimensions using PIL if available
            width, height = 0, 0
            if file_path.suffix.lower() in ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']:
                try:
                    with Image.open(file_path) as img:
                        width, height = img.size
                except Exception as e:
                    print(f"[WARNING] Failed to read image dimensions for {file_path}: {e}")

            return {
                'name': file_path.name,
                'path': str(file_path.absolute()),  # Use absolute path
                'relative_path': str(file_path.relative_to(file_path.parents[len(file_path.parents)-1])),
                'format': file_path.suffix.lower(),
                'size_bytes': stat.st_size,
                'size_formatted': self.format_file_size(stat.st_size),
                'width': width,
                'height': height,
                'modified_time': time.ctime(stat.st_mtime),
                'exists': True
            }
        except Exception as e:
            return {
                'name': file_path.name,
                'path': str(file_path.absolute()),  # Use absolute path even for errors
                'relative_path': str(file_path),
                'format': file_path.suffix.lower(),
                'size_bytes': 0,
                'size_formatted': '0B',
                'width': 0,
                'height': 0,
                'modified_time': 'Unknown',
                'exists': False,
                'error': str(e)
            }

    def scan_platform_directory(self, root_dir: Path, platform: str) -> Dict:
        """Scan a specific platform directory for images"""
        platform_path = root_dir / platform
        platform_info = {
            'platform': platform,
            'path': str(platform_path),
            'exists': platform_path.exists(),
            'images': [],
            'total_images': 0,
            'total_size': 0,
            'subdirectories': {}
        }

        if not platform_path.exists():
            print(f"[PLATFORM-SCAN] {platform.upper()}: Directory not found at {platform_path}")
            return platform_info

        print(f"[PLATFORM-SCAN] Scanning {platform.upper()} platform directory...")

        try:
            # Recursively find all image files (case-insensitive using set to avoid duplicates)
            image_files_set = set()
            for ext in self.supported_formats:
                image_files_set.update(platform_path.rglob(f"*{ext}"))
                image_files_set.update(platform_path.rglob(f"*{ext.upper()}"))

            # Convert to sorted list for consistent output
            image_files = sorted(list(image_files_set), key=lambda x: str(x))

            # Process each image file
            for image_file in image_files:
                image_info = self.get_image_info(image_file)
                platform_info['images'].append(image_info)
                platform_info['total_size'] += image_info['size_bytes']

                # Organize by subdirectory
                relative_parent = image_file.parent.relative_to(platform_path)
                subdir_key = str(relative_parent) if str(relative_parent) != '.' else 'root'

                if subdir_key not in platform_info['subdirectories']:
                    platform_info['subdirectories'][subdir_key] = []

                platform_info['subdirectories'][subdir_key].append(image_info)

            platform_info['total_images'] = len(platform_info['images'])

        except Exception as e:
            print(f"[PLATFORM-ERROR] Failed to scan {platform}: {e}")

        return platform_info

    def print_platform_tree(self, platform_info: Dict) -> None:
        """Print platform images in tree format"""
        try:
            platform = platform_info['platform']

            print(f"\n[PLATFORM-TREE] {platform.upper()} PLATFORM IMAGES")
            print(f"{'=' * 60}")

            if not platform_info['exists']:
                print(f"+-- [X] Platform directory not found")
                return

            if platform_info['total_images'] == 0:
                print(f"+-- [DIR] {platform}/ (No images found)")
                return

            print(f"[DIR] {platform}/ ({platform_info['total_images']} images, {self.format_file_size(platform_info['total_size'])} total)")

            # Sort subdirectories for consistent output
            sorted_subdirs = sorted(platform_info['subdirectories'].items())

            for i, (subdir, images) in enumerate(sorted_subdirs):
                is_last_subdir = (i == len(sorted_subdirs) - 1)

                if subdir == 'root':
                    subdir_display = f"{platform}/"
                    branch_char = "+--" if is_last_subdir else "|--"
                else:
                    subdir_display = f"{subdir}/"
                    branch_char = "+--" if is_last_subdir else "|--"

                subdir_size = sum(img['size_bytes'] for img in images)
                print(f"{branch_char} [DIR] {subdir_display} ({len(images)} images, {self.format_file_size(subdir_size)})")

                # Print images in this subdirectory
                for j, image in enumerate(images):
                    is_last_image = (j == len(images) - 1)

                    if is_last_subdir:
                        image_prefix = "    +--" if is_last_image else "    |--"
                    else:
                        image_prefix = "|   +--" if is_last_image else "|   |--"

                    # Determine file type indicator
                    if image['format'] in ['.ico']:
                        type_indicator = "[ICO]"
                    elif 'icon' in image['name'].lower() or 'launcher' in image['name'].lower():
                        type_indicator = "[ICON]"
                    elif 'background' in image['name'].lower() or 'splash' in image['name'].lower():
                        type_indicator = "[BG]"
                    else:
                        type_indicator = "[IMG]"

                    print(f"{image_prefix} {type_indicator} {image['name']} ({image['size_formatted']}) - {image['format'].upper()}")

                    # Show path details for debugging
                    if len(str(image['relative_path'])) > 50:
                        path_display = "..." + str(image['relative_path'])[-47:]
                    else:
                        path_display = str(image['relative_path'])

                    if is_last_subdir:
                        detail_prefix = "        -> Path: "
                    else:
                        detail_prefix = "|       -> Path: "

                    print(f"{detail_prefix}{path_display}")
        except UnicodeEncodeError as e:
            print(f"[PLATFORM-TREE] Skipping detailed tree due to encoding issue: {e}")

    def scan_all_platforms(self, root_dir: Path) -> Dict:
        """Scan all platform directories and display comprehensive tree"""
        print(f"\n[PLATFORM-SCANNER] FLUTTER PLATFORM IMAGES ANALYSIS")
        print(f"{'=' * 80}")
        print(f"Root Directory: {root_dir}")
        print(f"Scanning platforms: {', '.join(self.platform_dirs)}")

        all_platforms_info = {
            'root_dir': str(root_dir),
            'platforms': {},
            'total_platforms_scanned': 0,
            'total_images_found': 0,
            'total_size': 0,
            'scan_summary': {}
        }

        # Scan each platform
        for platform in self.platform_dirs:
            print(f"\n[SCANNING] {platform.upper()} platform...")
            platform_info = self.scan_platform_directory(root_dir, platform)
            all_platforms_info['platforms'][platform] = platform_info

            if platform_info['exists']:
                all_platforms_info['total_platforms_scanned'] += 1
                all_platforms_info['total_images_found'] += platform_info['total_images']
                all_platforms_info['total_size'] += platform_info['total_size']

        # Generate scan summary
        all_platforms_info['scan_summary'] = {
            'android_images': all_platforms_info['platforms']['android']['total_images'],
            'macos_images': all_platforms_info['platforms']['macos']['total_images'],
            'windows_images': all_platforms_info['platforms']['windows']['total_images'],
            'web_images': all_platforms_info['platforms']['web']['total_images']
        }

        # Print detailed tree for each platform
        print(f"\n[PLATFORM-TREES] DETAILED PLATFORM IMAGE TREES")
        print(f"{'=' * 80}")

        for platform in self.platform_dirs:
            platform_info = all_platforms_info['platforms'][platform]
            self.print_platform_tree(platform_info)

        # Print overall summary
        self.print_scan_summary(all_platforms_info)

        return all_platforms_info

    def print_scan_summary(self, scan_info: Dict) -> None:
        """Print comprehensive scan summary"""
        print(f"\n[SCAN-SUMMARY] PLATFORM IMAGES SUMMARY")
        print(f"{'=' * 60}")
        print(f"Total Platforms Scanned: {scan_info['total_platforms_scanned']}/4")
        print(f"Total Images Found: {scan_info['total_images_found']}")
        print(f"Total Size: {self.format_file_size(scan_info['total_size'])}")
        print(f"")
        print(f"Platform Breakdown:")

        summary = scan_info['scan_summary']
        platforms_data = [
            ('Android', 'android', summary['android_images'], '[ANDROID]'),
            ('macOS', 'macos', summary['macos_images'], '[MACOS]'),
            ('Windows', 'windows', summary['windows_images'], '[WINDOWS]'),
            ('Web', 'web', summary['web_images'], '[WEB]')
        ]

        for platform_name, platform_key, image_count, platform_tag in platforms_data:
            platform_info = scan_info['platforms'][platform_key]
            if platform_info['exists']:
                size_text = self.format_file_size(platform_info['total_size'])
                print(f"{platform_tag} {platform_name:8} : {image_count:3} images ({size_text})")
            else:
                print(f"{platform_tag} {platform_name:8} : Directory not found")

        print(f"")

        # Show image type analysis
        self.print_image_type_analysis(scan_info)

    def print_image_type_analysis(self, scan_info: Dict) -> None:
        """Analyze and print image types found across platforms"""
        print(f"[TYPE-ANALYSIS] IMAGE TYPE ANALYSIS")
        print(f"{'-' * 40}")

        type_counts = {}
        total_by_category = {
            'app_icons': 0,
            'launchers': 0,
            'backgrounds': 0,
            'splash_screens': 0,
            'notifications': 0,
            'others': 0
        }

        # Analyze all images across platforms
        for platform_key, platform_info in scan_info['platforms'].items():
            for image in platform_info['images']:
                filename = image['name'].lower()

                # Categorize images
                if 'icon' in filename:
                    if 'launcher' in filename:
                        total_by_category['launchers'] += 1
                        category = 'launcher_icon'
                    elif 'notification' in filename:
                        total_by_category['notifications'] += 1
                        category = 'notification_icon'
                    else:
                        total_by_category['app_icons'] += 1
                        category = 'app_icon'
                elif 'background' in filename:
                    total_by_category['backgrounds'] += 1
                    category = 'background'
                elif 'splash' in filename:
                    total_by_category['splash_screens'] += 1
                    category = 'splash'
                elif 'favicon' in filename:
                    total_by_category['app_icons'] += 1
                    category = 'favicon'
                else:
                    total_by_category['others'] += 1
                    category = 'other'

                if category not in type_counts:
                    type_counts[category] = 0
                type_counts[category] += 1

        # Print categorized summary
        categories = [
            ('App Icons', total_by_category['app_icons'], '[ICON]'),
            ('Launcher Icons', total_by_category['launchers'], '[LAUNCHER]'),
            ('Background Images', total_by_category['backgrounds'], '[BG]'),
            ('Splash Screens', total_by_category['splash_screens'], '[SPLASH]'),
            ('Notification Icons', total_by_category['notifications'], '[NOTIFY]'),
            ('Other Images', total_by_category['others'], '[OTHER]')
        ]

        for category_name, count, category_tag in categories:
            if count > 0:
                print(f"{category_tag} {category_name:16} : {count:3} files")

        print(f"")
        print(f"[PLATFORM-SCAN-COMPLETE] Platform image scanning completed successfully")


def main():
    """Main function for testing the scanner"""
    print("[PLATFORM-SCANNER] Platform Image Scanner - Standalone Test")

    # Determine current directory (should be in temp compile directory)
    current_dir = Path.cwd()
    print(f"Current directory: {current_dir}")

    # Initialize scanner
    scanner = PlatformImageScanner()

    # Scan all platforms
    results = scanner.scan_all_platforms(current_dir)

    return results


if __name__ == "__main__":
    main()
