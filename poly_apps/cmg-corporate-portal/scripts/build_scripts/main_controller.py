#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Main Controller for Build System
Handles all logic and prepares commands for shell execution
Does NOT execute any shell commands directly
"""

import os
import sys
import json
from pathlib import Path

# Add build_scripts to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from file_var_system_new import FileVarSystem
from init_build_config import (
    generate_app_name,
    generate_package_id,
    generate_display_name,
    create_default_config,
    read_config,
    extract_config_info
)
from resource_scanner import ResourceScanner
from web_preview_server import show_preview
from resource_replacer import ResourceReplacer
from capacitor_resource_manager import CapacitorResourceManager


class BuildController:
    """Main controller for build system"""

    def __init__(self, project_root: str):
        """
        Initialize build controller

        Args:
            project_root: Root directory of the project
        """
        self.project_root = Path(project_root)
        self.folder_name = self.project_root.name

        # Generate app prefix from folder name
        self.app_prefix = self._generate_prefix(self.folder_name)

        # Initialize file variable system
        self.var_system = FileVarSystem(self.app_prefix, str(self.project_root))

        # Paths
        self.build_config_path = self.project_root / "build_config.ini"
        self.package_json_path = self.project_root / "package.json"
        self.android_path = self.project_root / "android"
        self.assets_path = self.project_root / "assets"

    def _generate_prefix(self, folder_name: str) -> str:
        """
        Generate app prefix from folder name

        Args:
            folder_name: Project folder name

        Returns:
            Prefix string (e.g., 'CMG_PORTAL')
        """
        # Convert to uppercase and replace special chars
        prefix = folder_name.upper()
        prefix = prefix.replace('-', '_').replace(' ', '_')
        # Remove non-alphanumeric except underscore
        prefix = ''.join(c for c in prefix if c.isalnum() or c == '_')
        return prefix

    def initialize_build_config(self) -> dict:
        """
        Initialize or load build configuration

        Returns:
            Configuration dictionary
        """
        if self.build_config_path.exists():
            print(f"[Python] Loading existing build_config.ini")
            config = read_config(str(self.build_config_path))
        else:
            print(f"[Python] Creating new build_config.ini")
            config = create_default_config(str(self.project_root), self.folder_name)

        config_info = extract_config_info(config)
        return config_info

    def update_package_json_with_capacitor(self) -> dict:
        """
        Update package.json with missing Capacitor packages
        Returns dict with added/existing package counts
        """
        print("[Python] Updating package.json with Capacitor packages...")

        # Prepare all Capacitor packages
        all_packages = {
            "@capacitor/core": "latest",
            "@capacitor/cli": "latest",
            "@capacitor/assets": "latest",
            "@capacitor/android": "latest",
            "@capacitor/ios": "latest",
            "@capacitor/camera": "latest",
            "@capacitor/geolocation": "latest",
            "@capacitor/filesystem": "latest",
            "@capacitor/app": "latest",
            "@capacitor/haptics": "latest",
            "@capacitor/keyboard": "latest",
            "@capacitor/status-bar": "latest",
            "@capacitor/splash-screen": "latest",
            "@capacitor/device": "latest",
            "@capacitor/network": "latest",
            "@capacitor/preferences": "latest",
            "@capacitor/action-sheet": "latest",
            "@capacitor/local-notifications": "latest",
            "@capacitor/app-launcher": "latest",
            "@capacitor/share": "latest",
            "@capacitor/toast": "latest",
            "@capacitor/dialog": "latest",
            "@capacitor/browser": "latest",
            "@capacitor/clipboard": "latest"
        }

        # Read existing package.json
        if not self.package_json_path.exists():
            print(f"[ERROR] package.json not found: {self.package_json_path}")
            return {"added": 0, "existing": 0, "total": len(all_packages)}

        with open(self.package_json_path, 'r', encoding='utf-8') as f:
            package_data = json.load(f)

        # Ensure dependencies section exists
        if "dependencies" not in package_data:
            package_data["dependencies"] = {}

        # Check which packages are missing
        existing_packages = []
        missing_packages = []

        for pkg_name, pkg_version in all_packages.items():
            if pkg_name in package_data["dependencies"]:
                existing_packages.append(pkg_name)
            else:
                missing_packages.append(pkg_name)
                package_data["dependencies"][pkg_name] = pkg_version

        # Report results
        print(f"[Python] Found {len(existing_packages)} existing Capacitor packages")
        print(f"[Python] Adding {len(missing_packages)} new packages to package.json")

        if missing_packages:
            for pkg in missing_packages[:5]:  # Show first 5
                print(f"  + {pkg}")
            if len(missing_packages) > 5:
                print(f"  ... and {len(missing_packages) - 5} more")

        # Write back to package.json only if there are changes
        if missing_packages:
            # Backup first
            backup_path = str(self.package_json_path) + ".backup"
            if not os.path.exists(backup_path):
                with open(self.package_json_path, 'r', encoding='utf-8') as f:
                    original_content = f.read()
                with open(backup_path, 'w', encoding='utf-8') as f:
                    f.write(original_content)
                print(f"[Python] Created backup: {backup_path}")

            # Write updated package.json
            with open(self.package_json_path, 'w', encoding='utf-8') as f:
                json.dump(package_data, f, indent=2, ensure_ascii=False)
            print(f"[Python] Updated package.json with {len(missing_packages)} new packages")
        else:
            print("[Python] All Capacitor packages already in package.json")

        return {
            "added": len(missing_packages),
            "existing": len(existing_packages),
            "total": len(all_packages)
        }

    def prepare_capacitor_install(self) -> None:
        """
        Prepare Capacitor installation
        Updates package.json and prepares commands for shell execution
        """
        print("[Python] Preparing Capacitor installation...")

        # Initialize build config
        config_info = self.initialize_build_config()

        # Update package.json with Capacitor packages
        package_stats = self.update_package_json_with_capacitor()

        # Set configuration variables
        self.var_system.set_vars({
            "ACTION": "install_capacitor",
            "APP_NAME": config_info.get("app_name", ""),
            "DISPLAY_NAME_EN": config_info.get("display_name_english", ""),
            "DISPLAY_NAME_CN": config_info.get("display_name_chinese", ""),
            "PACKAGE_ID": config_info.get("package_id", ""),
            "DESCRIPTION": config_info.get("description", ""),
            "BUILD_PLATFORMS": config_info.get("build_platforms", "android"),
            "PROJECT_ROOT": str(self.project_root),
            "PACKAGE_JSON_PATH": str(self.package_json_path),
            "PACKAGE_JSON_BACKUP_PATH": str(self.package_json_path) + ".backup",
            "PACKAGES_ADDED": str(package_stats["added"]),
            "PACKAGES_EXISTING": str(package_stats["existing"])
        })

        # Add commands for shell execution
        self.var_system.clear_commands()

        # Command 1: Run pnpm install (only if packages were added)
        if package_stats["added"] > 0:
            self.var_system.add_command(
                "pnpm_install",
                f"Install {package_stats['added']} new Capacitor packages",
                str(self.project_root)
            )
        else:
            print("[Python] Skipping pnpm install - no new packages added")

        # Command 2: Initialize Capacitor
        app_name = config_info.get("app_name", "")  # Technical name (e.g., cmg_club)
        package_id = config_info.get("package_id", "")
        self.var_system.add_command(
            f'init_capacitor|{app_name}|{package_id}',
            f"Initialize Capacitor with app name and package ID",
            str(self.project_root)
        )

        # Command 3: Prepare Capacitor resources (icon, splash)
        print("\n[Python] Preparing resources for Capacitor...")
        cap_manager = CapacitorResourceManager(str(self.project_root), str(self.assets_path))
        cap_results = cap_manager.prepare_for_capacitor_assets(
            app_name=config_info.get("app_name", ""),
            display_name_en=config_info.get("display_name_english", ""),
            display_name_cn=config_info.get("display_name_chinese", ""),
            package_id=config_info.get("package_id", "")
        )

        # Set flag for shell to run capacitor-assets
        self.var_system.set_var("RUN_CAPACITOR_ASSETS", "true" if cap_results["icon"].get("success") else "false")

        # Command 4: Add Android platform
        self.var_system.add_command(
            "add_android_platform",
            "Add Android platform to Capacitor",
            str(self.project_root)
        )

        # Command 5: Generate Capacitor assets (if icon was prepared)
        if cap_results["icon"].get("success"):
            self.var_system.add_command(
                "capacitor_assets_generate",
                "Generate Android resources using Capacitor official tool",
                str(self.project_root)
            )

        print("\n[Python] Capacitor installation prepared")
        print(f"[Python] App Name: {config_info.get('app_name', '')}")
        print(f"[Python] Display Name (EN): {config_info.get('display_name_english', '')}")
        print(f"[Python] Display Name (CN): {config_info.get('display_name_chinese', '')}")
        print(f"[Python] Package ID: {config_info.get('package_id', '')}")
        print(f"[Python] Description: {config_info.get('description', '')}")
        print(f"[Python] Build Platforms: {config_info.get('build_platforms', '')}")
        print(f"[Python] Variables saved to: {self.var_system.var_dir}")
        print(f"[Python] Commands saved to: {self.var_system.cmd_dir}")

    def prepare_dev_server(self) -> None:
        """Prepare development server startup"""
        print("[Python] Preparing development server...")

        self.var_system.set_vars({
            "ACTION": "dev_server",
            "PROJECT_ROOT": str(self.project_root)
        })

        self.var_system.clear_commands()
        self.var_system.add_command(
            "start_dev_server",
            "Start development server",
            str(self.project_root)
        )

        print("[Python] Development server prepared")

    def prepare_web_build(self) -> None:
        """Prepare web build"""
        print("[Python] Preparing web build...")

        self.var_system.set_vars({
            "ACTION": "build_web",
            "PROJECT_ROOT": str(self.project_root)
        })

        self.var_system.clear_commands()
        self.var_system.add_command(
            "build_web",
            "Build for web",
            str(self.project_root)
        )

        print("[Python] Web build prepared")

    def prepare_android_build(self) -> None:
        """Prepare Android build"""
        print("[Python] Preparing Android build...")

        # Check if Android platform exists
        if not self.android_path.exists():
            print("[Python] ERROR: Android platform not found")
            print("[Python] Please install Capacitor first (Option 1)")
            self.var_system.set_var("ERROR", "android_platform_not_found")
            return

        # Load build config
        config_info = self.initialize_build_config()

        # Set configuration variables
        self.var_system.set_vars({
            "ACTION": "build_android",
            "APP_NAME": config_info.get("app_name", ""),
            "DISPLAY_NAME_EN": config_info.get("display_name_english", ""),
            "PACKAGE_ID": config_info.get("package_id", ""),
            "PROJECT_ROOT": str(self.project_root),
            "ANDROID_PATH": str(self.android_path),
            "ASSETS_PATH": str(self.assets_path)
        })

        # Find icon and splash resources
        icon_path = None
        splash_path = None

        # Check build_config.ini for resource paths
        if self.build_config_path.exists():
            config = read_config(str(self.build_config_path))
            if "resources" in config:
                if config["resources"].get("icon_file"):
                    icon_path = self.project_root / config["resources"]["icon_file"]
                if config["resources"].get("splash_screen_file"):
                    splash_path = self.project_root / config["resources"]["splash_screen_file"]

        # Fallback to assets directory
        if not icon_path or not icon_path.exists():
            fallback_icon = self.assets_path / "logo.png"
            if fallback_icon.exists():
                icon_path = fallback_icon

        if not splash_path or not splash_path.exists():
            fallback_splash = self.assets_path / "splash.png"
            if fallback_splash.exists():
                splash_path = fallback_splash

        self.var_system.set_var("ICON_PATH", str(icon_path) if icon_path else "")
        self.var_system.set_var("SPLASH_PATH", str(splash_path) if splash_path else "")

        # Step 1: Prepare resources for Capacitor's official tool
        print("\n[Python] Preparing resources for Capacitor...")
        cap_manager = CapacitorResourceManager(str(self.project_root), str(self.assets_path))
        cap_results = cap_manager.prepare_for_capacitor_assets(
            app_name=config_info.get("app_name", ""),
            display_name_en=config_info.get("display_name_english", ""),
            display_name_cn=config_info.get("display_name_chinese", ""),
            package_id=config_info.get("package_id", "")
        )

        # Set flag for shell to run capacitor-assets
        self.var_system.set_var("RUN_CAPACITOR_ASSETS", "true" if cap_results["icon"].get("success") else "false")

        # Step 2: Scan Android resources (before custom replacement)
        print("\n[Python] Scanning Android resources...")
        scanner = ResourceScanner(str(self.android_path))

        # Step 3: Custom replacement (additional optimization)
        print("\n[Python] Applying custom resource replacements...")
        replacer = ResourceReplacer(str(self.android_path), str(self.assets_path))
        replace_stats = replacer.replace_resources()

        # Step 4: Re-scan after replacement to show updated resources
        print("\n[Python] Re-scanning resources after replacement...")
        scanner = ResourceScanner(str(self.android_path))
        resource_data = scanner.get_full_report()

        # Show web preview and wait for user confirmation
        print("\n" + "=" * 60)
        print("[Python] Launching resource preview...")
        print("=" * 60)

        user_continues = show_preview(resource_data, port=8899)

        if not user_continues:
            print("[Python] Build cancelled by user")
            self.var_system.set_var("ERROR", "user_cancelled")
            return

        print("\n[Python] User confirmed, continuing with build...")

        # Prepare commands
        self.var_system.clear_commands()

        # Command 1: Build web assets
        self.var_system.add_command(
            "build_web",
            "Build web assets",
            str(self.project_root)
        )

        # Command 2: Sync Capacitor
        self.var_system.add_command(
            "sync_capacitor_android",
            "Sync Capacitor with Android",
            str(self.project_root)
        )

        # Command 3: Build Android APK
        self.var_system.add_command(
            "build_android_apk",
            "Build Android APK",
            str(self.android_path)
        )

        print("[Python] Android build prepared")

    def show_menu(self) -> str:
        """
        Show interactive menu and return selected action

        Returns:
            Selected action code
        """
        print("\n" + "=" * 60)
        print("Main Menu")
        print("=" * 60)
        print("1. Install Capacitor (with automatic backup)")
        print("2. Development Server (Debug)")
        print("3. Build for Web")
        print("4. Build for Android")
        print("Q. Quit")
        print("")

        choice = input("Select an option: ").strip().upper()

        action_map = {
            "1": "install_capacitor",
            "2": "dev_server",
            "3": "build_web",
            "4": "build_android",
            "Q": "quit"
        }

        return action_map.get(choice, "invalid")


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Error: Project root path required", file=sys.stderr)
        sys.exit(1)

    project_root = sys.argv[1]
    action = sys.argv[2] if len(sys.argv) > 2 else None

    controller = BuildController(project_root)

    # If no action specified, show menu
    if not action:
        action = controller.show_menu()

    # Process action
    if action == "install_capacitor":
        controller.prepare_capacitor_install()
    elif action == "dev_server":
        controller.prepare_dev_server()
    elif action == "build_web":
        controller.prepare_web_build()
    elif action == "build_android":
        controller.prepare_android_build()
    elif action == "quit":
        print("Exiting...")
        sys.exit(0)
    else:
        print(f"Invalid action: {action}", file=sys.stderr)
        sys.exit(1)

    # Write success marker
    controller.var_system.set_var("PYTHON_SUCCESS", "true")
    print("\n[Python] Preparation complete. Shell can now execute commands.")


if __name__ == '__main__':
    main()
