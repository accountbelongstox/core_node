#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Resource Scanner
Scans Android directory for images, package names, and app names
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Set
from collections import defaultdict


class ResourceScanner:
    """Scanner for Android resources"""

    def __init__(self, android_path: str):
        """
        Initialize resource scanner

        Args:
            android_path: Path to Android directory
        """
        self.android_path = Path(android_path)

        # Image extensions
        self.image_extensions = {'.png', '.jpg', '.jpeg', '.webp', '.xml'}

        # File extensions to scan for package names and app names
        self.text_extensions = {
            '.xml', '.gradle', '.kt', '.java', '.json', '.properties'
        }

    def scan_images(self) -> Dict[str, List[Dict]]:
        """
        Scan for all images in Android directory

        Returns:
            Dictionary grouped by category (e.g., 'mipmap-hdpi', 'drawable')
        """
        images = defaultdict(list)

        for root, dirs, files in os.walk(self.android_path):
            root_path = Path(root)

            for file in files:
                file_path = root_path / file
                ext = file_path.suffix.lower()

                if ext in self.image_extensions:
                    # Get relative path from android directory
                    rel_path = file_path.relative_to(self.android_path)

                    # Determine category (parent directory name)
                    category = rel_path.parent.name

                    # Get file size
                    try:
                        file_size = file_path.stat().st_size
                    except:
                        file_size = 0

                    # Get image dimensions if possible
                    width, height = self._get_image_dimensions(file_path)

                    images[category].append({
                        'filename': file_path.name,
                        'full_path': str(file_path),
                        'relative_path': str(rel_path),
                        'category': category,
                        'size_bytes': file_size,
                        'size_kb': round(file_size / 1024, 2),
                        'width': width,
                        'height': height,
                        'extension': ext
                    })

        return dict(images)

    def scan_package_names(self) -> Set[str]:
        """
        Scan for package names in Android files

        Returns:
            Set of found package names
        """
        package_names = set()

        # Package name patterns
        patterns = [
            r'package\s*=\s*["\']([a-z0-9_.]+)["\']',  # XML manifest
            r'package\s+([a-z0-9_.]+)',                # Kotlin/Java
            r'applicationId\s*["\']([a-z0-9_.]+)["\']', # Gradle
            r'namespace\s*["\']([a-z0-9_.]+)["\']',    # Gradle namespace
        ]

        for root, dirs, files in os.walk(self.android_path):
            root_path = Path(root)

            for file in files:
                file_path = root_path / file
                ext = file_path.suffix.lower()

                if ext in self.text_extensions:
                    try:
                        content = file_path.read_text(encoding='utf-8', errors='ignore')

                        for pattern in patterns:
                            matches = re.findall(pattern, content, re.MULTILINE)
                            for match in matches:
                                if '.' in match and len(match) > 5:
                                    package_names.add(match)
                    except:
                        continue

        return package_names

    def scan_app_names(self) -> Set[str]:
        """
        Scan for app names in Android files

        Returns:
            Set of found app names
        """
        app_names = set()

        # App name patterns
        patterns = [
            r'android:label\s*=\s*"([^"@]+)"',  # XML label (not @string/...)
            r'<string\s+name\s*=\s*"app_name"\s*>([^<]+)</string>',  # strings.xml
            r'APP_NAME\s*=\s*["\']([^"\']+)["\']',  # Properties
        ]

        for root, dirs, files in os.walk(self.android_path):
            root_path = Path(root)

            for file in files:
                file_path = root_path / file
                ext = file_path.suffix.lower()

                if ext in self.text_extensions:
                    try:
                        content = file_path.read_text(encoding='utf-8', errors='ignore')

                        for pattern in patterns:
                            matches = re.findall(pattern, content, re.MULTILINE)
                            for match in matches:
                                match = match.strip()
                                if match and len(match) > 2:
                                    app_names.add(match)
                    except:
                        continue

        return app_names

    def _get_image_dimensions(self, image_path: Path) -> tuple:
        """
        Get image dimensions using PIL if available

        Args:
            image_path: Path to image file

        Returns:
            Tuple of (width, height) or (None, None)
        """
        try:
            from PIL import Image
            with Image.open(image_path) as img:
                return img.size
        except:
            return (None, None)

    def get_full_report(self) -> Dict:
        """
        Get full resource report

        Returns:
            Dictionary with images, package names, and app names
        """
        print("[Scanner] Scanning Android resources...")

        images = self.scan_images()
        package_names = self.scan_package_names()
        app_names = self.scan_app_names()

        # Count total images
        total_images = sum(len(imgs) for imgs in images.values())

        print(f"[Scanner] Found {total_images} images in {len(images)} categories")
        print(f"[Scanner] Found {len(package_names)} package names")
        print(f"[Scanner] Found {len(app_names)} app names")

        return {
            'images': images,
            'package_names': sorted(package_names),
            'app_names': sorted(app_names),
            'statistics': {
                'total_images': total_images,
                'categories': len(images),
                'package_names_count': len(package_names),
                'app_names_count': len(app_names)
            }
        }


def test_scanner(android_path: str):
    """Test the resource scanner"""
    scanner = ResourceScanner(android_path)
    report = scanner.get_full_report()

    print("\n" + "=" * 60)
    print("Resource Scan Report")
    print("=" * 60)

    print(f"\nTotal Images: {report['statistics']['total_images']}")
    print(f"Categories: {report['statistics']['categories']}")

    print("\nImage Categories:")
    for category, images in report['images'].items():
        print(f"  {category}: {len(images)} images")

    print(f"\nPackage Names ({len(report['package_names'])}):")
    for pkg in report['package_names']:
        print(f"  - {pkg}")

    print(f"\nApp Names ({len(report['app_names'])}):")
    for name in report['app_names']:
        print(f"  - {name}")


if __name__ == '__main__':
    import sys
    if len(sys.argv) < 2:
        print("Usage: python resource_scanner.py <android_path>")
        sys.exit(1)

    test_scanner(sys.argv[1])
