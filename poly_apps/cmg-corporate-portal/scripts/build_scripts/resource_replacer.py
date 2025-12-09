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


class ResourceReplacer:
    """Replace Android resources with intelligent scaling and cropping"""

    def __init__(self, android_path: str, assets_path: str):
        """
        Initialize resource replacer

        Args:
            android_path: Path to android directory
            assets_path: Path to assets directory containing source images
        """
        self.android_path = Path(android_path)
        self.assets_path = Path(assets_path)
        self.res_path = self.android_path / "app" / "src" / "main" / "res"

        # Source to target mapping
        self.mappings = {
            "logo.png": ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"],
            "splash.png": ["splash.png"]
        }

        self.replaced_files = []

    def scan_target_files(self, filename_pattern: str) -> List[Path]:
        """
        Scan for all target files matching the pattern

        Args:
            filename_pattern: File name to search for (e.g., "ic_launcher.png")

        Returns:
            List of matching file paths
        """
        target_files = []

        if not self.res_path.exists():
            return target_files

        # Search in all mipmap-* and drawable-* directories
        for subdir in self.res_path.iterdir():
            if not subdir.is_dir():
                continue

            # Only search in resource directories
            if not (subdir.name.startswith("mipmap-") or subdir.name.startswith("drawable")):
                continue

            target_file = subdir / filename_pattern
            if target_file.exists():
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
