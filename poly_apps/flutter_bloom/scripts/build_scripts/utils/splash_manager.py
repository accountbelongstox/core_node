#!/usr/bin/env python3
"""
Flutter Bloom - Splash Manager Library (Python)
This library provides functionality to update splash screen configuration for different apps

NOTE: This is a standalone library with no external dependencies on other Python files.
It only uses Python standard library modules (os, sys, pathlib, typing) and can be
imported and used independently without any additional setup.
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple


class SplashConfigManager:
    """Manages splash screen configuration for Flutter apps"""

    def __init__(self, project_root: Optional[str] = None):
        """
        Initialize the SplashConfigManager

        Args:
            project_root: Path to Flutter project root directory
        """
        if project_root is None:
            # Default to Flutter project root (3 levels up from utils directory)
            self.project_root = Path(__file__).parent.parent.parent.parent
        else:
            self.project_root = Path(project_root)

        self.assets_root = self.project_root / "assets"
        self.common_assets_root = self.assets_root / "common"
        self.common_launch_path = self.common_assets_root / "launch"
        self.splash_config_path = self.project_root / "flutter_native_splash.yaml"

        # Default splash file patterns
        self.background_patterns = ["background*", "*splash*", "*launch*"]
        self.supported_extensions = [".jpg", ".jpeg", ".png", ".webp"]

    def _get_app_launch_path(self, app_name: str) -> Path:
        """Get the launch directory path for a specific app"""
        return self.assets_root / "apps" / app_name / "launch"

    def _directory_exists(self, path: Path) -> bool:
        """Check if directory exists"""
        return path.exists() and path.is_dir()

    def _find_splash_files(self, launch_path: Path) -> List[Path]:
        """Find splash files in the given launch directory"""
        if not self._directory_exists(launch_path):
            return []

        splash_files = []
        try:
            for file_path in launch_path.iterdir():
                if file_path.is_file():
                    file_name_lower = file_path.name.lower()
                    # Check if file matches splash patterns
                    if (any(pattern.replace("*", "") in file_name_lower for pattern in self.background_patterns) and
                        file_path.suffix.lower() in self.supported_extensions):
                        splash_files.append(file_path)
        except Exception as e:
            print(f"Error scanning directory {launch_path}: {e}")

        return splash_files

    def find_best_splash_files(self, app_name: str) -> Dict[str, Path]:
        """
        Find the best splash files for the given app

        Args:
            app_name: Name of the Flutter app

        Returns:
            Dictionary mapping file names to their full paths
        """
        print(f"[INFO] Searching for splash files for app: {app_name}")

        selected_files = {}
        app_launch_path = self._get_app_launch_path(app_name)

        # Try app-specific launch directory first
        if self._directory_exists(app_launch_path):
            print(f"[INFO] Found app-specific launch directory: {app_launch_path}")
            app_splash_files = self._find_splash_files(app_launch_path)

            if app_splash_files:
                print(f"[INFO] Using app-specific splash files")
                for file_path in app_splash_files:
                    selected_files[file_path.name] = file_path
                return selected_files

        # Fallback to common launch directory
        if self._directory_exists(self.common_launch_path):
            print(f"[INFO] Using common splash files as fallback")
            common_splash_files = self._find_splash_files(self.common_launch_path)

            for file_path in common_splash_files:
                selected_files[file_path.name] = file_path

        return selected_files

    def _get_relative_path(self, full_path: Path) -> str:
        """Get relative path from project root"""
        try:
            return str(full_path.relative_to(self.project_root)).replace("\\", "/")
        except ValueError:
            return str(full_path).replace("\\", "/")

    def backup_current_config(self) -> bool:
        """Backup the current splash configuration"""
        if self.splash_config_path.exists():
            backup_path = self.splash_config_path.with_suffix(".yaml.backup")
            try:
                backup_path.write_text(self.splash_config_path.read_text(encoding='utf-8'), encoding='utf-8')
                print(f"[INFO] Backed up current splash config to: {backup_path}")
                return True
            except Exception as e:
                print(f"[ERROR] Failed to backup splash config: {e}")
                return False
        return True

    def update_splash_config(self, app_name: str, splash_files: Dict[str, Path]) -> bool:
        """
        Update splash configuration by replacing background_image and background_image_dark

        Args:
            app_name: Name of the app
            splash_files: Dictionary of splash files found

        Returns:
            True if successful, False otherwise
        """
        try:
            if not self.splash_config_path.exists():
                print(f"[ERROR] Splash config file not found: {self.splash_config_path}")
                return False

            # Read existing config
            config_lines = self.splash_config_path.read_text(encoding='utf-8').split('\n')

            # Find background and dark background files
            background_file = None
            background_dark_file = None

            for file_name in splash_files.keys():
                file_path = splash_files[file_name]
                relative_path = self._get_relative_path(file_path)
                lower_file_name = file_name.lower()

                if "dark" in lower_file_name and ("background" in lower_file_name or "launch" in lower_file_name):
                    background_dark_file = relative_path
                elif "background" in lower_file_name or "launch" in lower_file_name:
                    background_file = relative_path

            # Update config lines
            updated_lines = []
            background_updated = False
            background_dark_updated = False

            for line in config_lines:
                stripped_line = line.strip()

                if stripped_line.startswith("background_image:"):
                    if background_file:
                        updated_lines.append(f"  background_image: {background_file}")
                        background_updated = True
                        print(f"[INFO] Updated background_image: {background_file}")
                    else:
                        updated_lines.append(line)
                elif stripped_line.startswith("background_image_dark:"):
                    if background_dark_file:
                        updated_lines.append(f"  background_image_dark: {background_dark_file}")
                        background_dark_updated = True
                        print(f"[INFO] Updated background_image_dark: {background_dark_file}")
                    else:
                        updated_lines.append(line)
                else:
                    updated_lines.append(line)

            # Write updated config
            self.splash_config_path.write_text('\n'.join(updated_lines), encoding='utf-8')

            print(f"[SUCCESS] Splash configuration updated for app: {app_name}")
            return True

        except Exception as e:
            print(f"[ERROR] Failed to update splash config: {e}")
            return False

    def update_app_splash(self, app_name: str) -> bool:
        """
        Complete splash update process for an app

        Args:
            app_name: Name of the Flutter app

        Returns:
            True if successful, False otherwise
        """
        print("=" * 50)
        print(f"Splash Update Process for App: {app_name}")
        print("=" * 50)

        try:
            # Find splash files for the app
            splash_files = self.find_best_splash_files(app_name)

            if not splash_files:
                print(f"[WARNING] No splash files found for app: {app_name}")
                return False

            print(f"[INFO] Found {len(splash_files)} splash file(s):")
            for file_name, file_path in splash_files.items():
                print(f"  - {file_name} : {file_path}")

            # Backup current config
            if not self.backup_current_config():
                print("[ERROR] Failed to backup current configuration")
                return False

            # Update splash configuration
            if not self.update_splash_config(app_name, splash_files):
                print("[ERROR] Failed to update splash configuration")
                return False

            print(f"[SUCCESS] Splash configuration updated successfully for app: {app_name}")
            return True

        except Exception as e:
            print(f"[ERROR] Splash update failed: {e}")
            return False


def main():
    """Main function for command line usage"""
    if len(sys.argv) < 2:
        print("Usage: python splash_manager.py <app_name> [project_root]")
        sys.exit(1)

    app_name = sys.argv[1]
    project_root = sys.argv[2] if len(sys.argv) > 2 else None

    manager = SplashConfigManager(project_root)
    success = manager.update_app_splash(app_name)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()