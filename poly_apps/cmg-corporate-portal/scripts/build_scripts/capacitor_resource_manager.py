#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Capacitor Resource Manager
Prepare resources for Capacitor's official @capacitor/assets tool
"""

import os
import json
import shutil
from pathlib import Path
from typing import Dict, Optional, Tuple
from PIL import Image


class CapacitorResourceManager:
    """Manage Capacitor resources according to official guidelines"""

    # Capacitor official recommended sizes
    RECOMMENDED_ICON_SIZE = (1024, 1024)
    RECOMMENDED_SPLASH_SIZE = (2732, 2732)

    # Minimum acceptable sizes
    MIN_ICON_SIZE = (512, 512)
    MIN_SPLASH_SIZE = (1080, 1920)

    def __init__(self, project_root: str, assets_path: str):
        """
        Initialize Capacitor resource manager

        Args:
            project_root: Project root directory
            assets_path: Assets directory containing source images
        """
        self.project_root = Path(project_root)
        self.assets_path = Path(assets_path)
        self.resources_path = self.project_root / "resources"
        self.capacitor_config_path = self.project_root / "capacitor.config.ts"

    def check_image_size(self, image_path: Path, recommended_size: Tuple[int, int],
                        min_size: Tuple[int, int], image_type: str) -> Dict[str, any]:
        """
        Check if image size meets requirements

        Args:
            image_path: Path to image file
            recommended_size: Recommended (width, height)
            min_size: Minimum acceptable (width, height)
            image_type: Type of image (e.g., "Icon", "Splash")

        Returns:
            Dictionary with check results
        """
        if not image_path.exists():
            return {
                "exists": False,
                "valid": False,
                "message": f"File not found: {image_path}"
            }

        try:
            img = Image.open(image_path)
            actual_size = img.size
            img.close()

            result = {
                "exists": True,
                "actual_size": actual_size,
                "recommended_size": recommended_size,
                "min_size": min_size,
                "is_recommended": actual_size == recommended_size,
                "is_acceptable": actual_size[0] >= min_size[0] and actual_size[1] >= min_size[1],
                "warnings": []
            }

            # Check if meets recommendations
            if actual_size == recommended_size:
                result["valid"] = True
                result["status"] = "perfect"
                result["message"] = f"✓ {image_type} size is perfect: {actual_size[0]}x{actual_size[1]}"
            elif actual_size[0] >= min_size[0] and actual_size[1] >= min_size[1]:
                result["valid"] = True
                result["status"] = "acceptable"
                result["message"] = f"⚠ {image_type} size is acceptable: {actual_size[0]}x{actual_size[1]}"
                result["warnings"].append(
                    f"Recommended size is {recommended_size[0]}x{recommended_size[1]}, "
                    f"but {actual_size[0]}x{actual_size[1]} will work"
                )
            else:
                result["valid"] = False
                result["status"] = "too_small"
                result["message"] = f"✗ {image_type} size too small: {actual_size[0]}x{actual_size[1]}"
                result["warnings"].append(
                    f"Minimum size is {min_size[0]}x{min_size[1]}, "
                    f"current size {actual_size[0]}x{actual_size[1]} is too small"
                )

            # Check aspect ratio for icon (should be square)
            if image_type == "Icon" and actual_size[0] != actual_size[1]:
                result["warnings"].append(
                    f"Icon should be square (1:1), current is {actual_size[0]}x{actual_size[1]}"
                )

            return result

        except Exception as e:
            return {
                "exists": True,
                "valid": False,
                "message": f"Error reading image: {e}"
            }

    def prepare_resources_directory(self) -> bool:
        """
        Create resources directory if not exists

        Returns:
            True if successful
        """
        try:
            self.resources_path.mkdir(exist_ok=True)
            print(f"[Resources] Directory ready: {self.resources_path}")
            return True
        except Exception as e:
            print(f"[ERROR] Failed to create resources directory: {e}")
            return False

    def copy_icon(self, source_filename: str = "logo.png") -> Dict[str, any]:
        """
        Copy icon to Capacitor resources directory

        Args:
            source_filename: Source icon filename in assets

        Returns:
            Dictionary with operation results
        """
        source_path = self.assets_path / source_filename
        target_path = self.resources_path / "icon.png"

        result = {
            "success": False,
            "source": str(source_path),
            "target": str(target_path)
        }

        # Check source file
        if not source_path.exists():
            result["message"] = f"Source icon not found: {source_filename}"
            return result

        # Check size
        size_check = self.check_image_size(
            source_path,
            self.RECOMMENDED_ICON_SIZE,
            self.MIN_ICON_SIZE,
            "Icon"
        )

        result["size_check"] = size_check

        if not size_check["valid"]:
            result["message"] = size_check["message"]
            result["copied"] = False
            return result

        # Copy file
        try:
            shutil.copy2(source_path, target_path)
            result["success"] = True
            result["copied"] = True
            result["message"] = f"Icon copied successfully"
            print(f"\n[Icon] Source: {source_path}")
            print(f"[Icon] {size_check['message']}")

            if size_check["warnings"]:
                for warning in size_check["warnings"]:
                    print(f"\033[93m[Warning] {warning}\033[0m")  # Yellow text

            print(f"[Icon] Copied to: resources/icon.png")

            return result

        except Exception as e:
            result["message"] = f"Failed to copy icon: {e}"
            return result

    def copy_splash(self, source_filename: str = "splash.png") -> Dict[str, any]:
        """
        Copy splash screen to Capacitor resources directory

        Args:
            source_filename: Source splash filename in assets

        Returns:
            Dictionary with operation results
        """
        source_path = self.assets_path / source_filename
        target_path = self.resources_path / "splash.png"

        result = {
            "success": False,
            "source": str(source_path),
            "target": str(target_path)
        }

        # Check source file
        if not source_path.exists():
            result["message"] = f"Source splash not found: {source_filename}"
            result["skipped"] = True
            print(f"\n[Splash] Source not found: {source_filename} (optional)")
            return result

        # Check size
        size_check = self.check_image_size(
            source_path,
            self.RECOMMENDED_SPLASH_SIZE,
            self.MIN_SPLASH_SIZE,
            "Splash"
        )

        result["size_check"] = size_check

        if not size_check["valid"]:
            result["message"] = size_check["message"]
            result["copied"] = False
            print(f"\n[Splash] {size_check['message']}")
            for warning in size_check.get("warnings", []):
                print(f"\033[93m[Warning] {warning}\033[0m")  # Yellow text
            return result

        # Copy file
        try:
            shutil.copy2(source_path, target_path)
            result["success"] = True
            result["copied"] = True
            result["message"] = f"Splash screen copied successfully"
            print(f"\n[Splash] Source: {source_path}")
            print(f"[Splash] {size_check['message']}")

            if size_check["warnings"]:
                for warning in size_check["warnings"]:
                    print(f"\033[93m[Warning] {warning}\033[0m")  # Yellow text

            print(f"[Splash] Copied to: resources/splash.png")

            return result

        except Exception as e:
            result["message"] = f"Failed to copy splash: {e}"
            return result

    def update_capacitor_config(self, app_name: str, display_name_en: str,
                               display_name_cn: str, package_id: str) -> bool:
        """
        Update capacitor.config.ts with app information

        Args:
            app_name: Technical app name (e.g., "cmg_club")
            display_name_en: English display name
            display_name_cn: Chinese display name
            package_id: Package ID (e.g., "com.ddsj.cmg.club")

        Returns:
            True if successful
        """
        if not self.capacitor_config_path.exists():
            print(f"[Config] capacitor.config.ts not found, skipping update")
            return False

        try:
            # Read existing config
            with open(self.capacitor_config_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Check if already has appName
            if 'appName:' in content:
                print(f"[Config] capacitor.config.ts already configured")
                return True

            # Insert appName configuration
            # Look for "appId:" line and insert before it
            lines = content.split('\n')
            new_lines = []
            inserted = False

            for line in lines:
                if not inserted and 'appId:' in line:
                    # Insert appName before appId
                    indent = len(line) - len(line.lstrip())
                    new_lines.append(f"{' ' * indent}appName: '{display_name_en}',")
                    inserted = True
                new_lines.append(line)

            if inserted:
                new_content = '\n'.join(new_lines)

                # Backup original
                backup_path = str(self.capacitor_config_path) + ".backup"
                if not Path(backup_path).exists():
                    shutil.copy2(self.capacitor_config_path, backup_path)
                    print(f"[Config] Created backup: capacitor.config.ts.backup")

                # Write updated config
                with open(self.capacitor_config_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)

                print(f"[Config] Updated capacitor.config.ts:")
                print(f"  - appName: {display_name_en}")
                print(f"  - appId: {package_id}")

                return True
            else:
                print(f"[Config] Could not find appId in capacitor.config.ts")
                return False

        except Exception as e:
            print(f"[ERROR] Failed to update capacitor.config.ts: {e}")
            return False

    def prepare_for_capacitor_assets(self, app_name: str, display_name_en: str,
                                    display_name_cn: str, package_id: str) -> Dict[str, any]:
        """
        Prepare all resources for Capacitor's @capacitor/assets tool

        Args:
            app_name: Technical app name
            display_name_en: English display name
            display_name_cn: Chinese display name
            package_id: Package ID

        Returns:
            Dictionary with preparation results
        """
        print("\n" + "=" * 60)
        print("Preparing Resources for Capacitor")
        print("=" * 60)
        print(f"\nCapacitor official tool: @capacitor/assets")
        print(f"Resources directory: resources/")
        print(f"\nRecommended sizes:")
        print(f"  - Icon:   {self.RECOMMENDED_ICON_SIZE[0]}x{self.RECOMMENDED_ICON_SIZE[1]} (minimum: {self.MIN_ICON_SIZE[0]}x{self.MIN_ICON_SIZE[1]})")
        print(f"  - Splash: {self.RECOMMENDED_SPLASH_SIZE[0]}x{self.RECOMMENDED_SPLASH_SIZE[1]} (minimum: {self.MIN_SPLASH_SIZE[0]}x{self.MIN_SPLASH_SIZE[1]})")

        results = {
            "resources_dir": False,
            "icon": {},
            "splash": {},
            "config": False
        }

        # Step 1: Create resources directory
        results["resources_dir"] = self.prepare_resources_directory()
        if not results["resources_dir"]:
            return results

        # Step 2: Copy icon
        print("\n" + "-" * 60)
        print("Copying Icon")
        print("-" * 60)
        results["icon"] = self.copy_icon()

        # Step 3: Copy splash
        print("\n" + "-" * 60)
        print("Copying Splash Screen")
        print("-" * 60)
        results["splash"] = self.copy_splash()

        # Step 4: Update capacitor config
        print("\n" + "-" * 60)
        print("Updating Capacitor Config")
        print("-" * 60)
        results["config"] = self.update_capacitor_config(
            app_name, display_name_en, display_name_cn, package_id
        )

        # Summary
        print("\n" + "=" * 60)
        print("Capacitor Resources Summary")
        print("=" * 60)

        print(f"\n✓ Resources directory: {'Ready' if results['resources_dir'] else 'Failed'}")
        print(f"{'✓' if results['icon'].get('success') else '✗'} Icon: {results['icon'].get('message', 'Not processed')}")
        print(f"{'✓' if results['splash'].get('success') else '⚠'} Splash: {results['splash'].get('message', 'Not processed')}")
        print(f"{'✓' if results['config'] else '⚠'} Config: {'Updated' if results['config'] else 'Skipped'}")

        print(f"\n[Next] Run Capacitor assets tool:")
        print(f"  npx @capacitor/assets generate --android")
        print(f"  (This will generate all Android resources automatically)")

        return results


def main():
    """Main entry point for testing"""
    import sys

    if len(sys.argv) < 3:
        print("Usage: python capacitor_resource_manager.py <project_root> <assets_path>")
        sys.exit(1)

    project_root = sys.argv[1]
    assets_path = sys.argv[2]

    manager = CapacitorResourceManager(project_root, assets_path)

    # Test with dummy data
    results = manager.prepare_for_capacitor_assets(
        app_name="test_app",
        display_name_en="Test App",
        display_name_cn="测试应用",
        package_id="com.test.app"
    )

    # Exit with appropriate code
    if results["icon"].get("success"):
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == '__main__':
    main()
