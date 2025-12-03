#!/usr/bin/env python3
"""
App Switcher for React Native Multi-App System
Switches active app by updating configuration files based on selected app's build_config.ini
Handles: app.json, index.js, Android manifest, and calls android_prebuild.py with correct paths
"""

import os
import sys
import json
import re
from pathlib import Path
from typing import Dict, Any, Optional

# Add script directory to path for imports
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

from default_config import get_default_app_config, merge_ini_config
from file_var_system import FileVarSystem
from factory_manager import FactoryManager
from key_center import KEY_FACTORY_BUILD_PATH, KEY_FACTORY_BUILD_ENABLED, KEY_APP_SWITCH_STATUS, KEY_METRO_PORT
from port_manager import get_metro_port
from project_locator import get_project_root
from config_keys import (
    KEY_APP_NAME, KEY_DISPLAY_NAME_ENGLISH, KEY_DISPLAY_NAME_CHINESE,
    KEY_DEFAULT_PACKAGE_ID, KEY_USE_EXTERNAL_SAFE_BUILD,
    FALLBACK_NAMESPACE, FALLBACK_DISPLAY_NAME_EN, FALLBACK_PACKAGE_ID
)


def update_app_json(project_root: Path, app_config: Dict[str, Any]):
    """Update app.json with app-specific configuration"""
    app_json_path = project_root / "app.json"

    # Read existing app.json (handle UTF-8 BOM)
    if app_json_path.exists():
        with open(app_json_path, 'r', encoding='utf-8-sig') as f:
            app_json = json.load(f)
    else:
        app_json = {}

    # Update with app-specific values (use build_config.ini keys with fallback)
    app_name = app_config.get(KEY_APP_NAME) or app_config.get(FALLBACK_NAMESPACE, "react_init")
    display_name = app_config.get(KEY_DISPLAY_NAME_ENGLISH) or app_config.get(FALLBACK_DISPLAY_NAME_EN, app_name)

    app_json["name"] = app_name
    app_json["displayName"] = display_name

    # Write updated app.json
    with open(app_json_path, 'w', encoding='utf-8') as f:
        json.dump(app_json, f, indent=4, ensure_ascii=False)

    print(f"[OK] Updated app.json: {app_name} / {display_name}")


def update_index_js(project_root: Path, app_namespace: str, app_config: Dict[str, Any]):
    """Update index.js to directly import the selected app entry point"""
    index_js_path = project_root / "index.js"

    new_content = f"""/**
 * @format
 */

// Import gesture handler at the top (required for React Navigation)
import 'react-native-gesture-handler';

import {{ AppRegistry }} from 'react-native';
import {{ name as appName }} from './app.json';

// Direct app import - no hardcoding, dynamically set by app_switcher.py
import App from './src/apps/{app_namespace}/App';

AppRegistry.registerComponent(appName, () => App);
"""

    with open(index_js_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"[OK] Updated index.js: './src/apps/{app_namespace}/App'")


def update_android_manifest(project_root: Path, app_config: Dict[str, Any]):
    """Update Android manifest with app-specific configuration"""
    manifest_path = project_root / "android" / "app" / "src" / "main" / "AndroidManifest.xml"

    with open(manifest_path, 'r', encoding='utf-8') as f:
        content = f.read()

    modified = False

    # Update package name (use build_config.ini keys with fallback)
    package_id = app_config.get(KEY_DEFAULT_PACKAGE_ID) or app_config.get(FALLBACK_PACKAGE_ID)
    if package_id:
        # Check if package attribute exists
        if 'package=' in content:
            # Update existing package
            pattern = r'package="[^"]*"'
            replacement = f'package="{package_id}"'
            new_content = re.sub(pattern, replacement, content)
        else:
            # Add package attribute to manifest tag
            pattern = r'<manifest([^>]*?)>'
            replacement = f'<manifest\\1 package="{package_id}">'
            new_content = re.sub(pattern, replacement, content)

        if new_content != content:
            content = new_content
            modified = True
            print(f"[OK] Set package: {package_id}")

    # Update android:label if display name is specified
    display_name = app_config.get(KEY_DISPLAY_NAME_ENGLISH) or app_config.get(FALLBACK_DISPLAY_NAME_EN)
    if display_name:
        pattern = r'android:label="[^"]*"'
        replacement = f'android:label="{display_name}"'
        new_content = re.sub(pattern, replacement, content)

        if new_content != content:
            content = new_content
            modified = True
            print(f"[OK] Set label: {display_name}")

    if modified:
        with open(manifest_path, 'w', encoding='utf-8') as f:
            f.write(content)


def update_metro_config(project_root: Path, app_directory: Path, app_config: Dict[str, Any]):
    """Update metro.config.js to watch app-specific source directories for hot reload"""
    metro_config_path = project_root / "metro.config.js"

    # Read current metro config
    with open(metro_config_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Check if using external safe build (use build_config.ini key)
    use_external_build = app_config.get(KEY_USE_EXTERNAL_SAFE_BUILD, False)

    if use_external_build:
        # Add app source directory to watchFolders for hot reload
        app_src_path = str(app_directory).replace('\\', '/')

        # Check if app path already in watchFolders
        if app_src_path in content:
            return

        pattern = r"watchFolders:\s*\[([^\]]*)\]"
        replacement = f"watchFolders: [\n    path.resolve(__dirname, '{app_src_path}'),\n  ]"
        new_content = re.sub(pattern, replacement, content)

        with open(metro_config_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        print(f"[OK] Updated metro.config.js: {app_src_path}")


def run_android_prebuild(project_root: Path, app_directory: Path):
    """
    Skip android_prebuild - it uses argparse for CLI arguments
    Icon processing can be done manually if needed
    """
    print("[SKIP] Android prebuild (icon processing) - can be done manually if needed")


def switch_app(project_root: str, app_namespace: str):
    """Switch active app by updating all necessary configuration files"""
    initial_directory = Path.cwd()

    project_root_path = Path(project_root).resolve()
    app_directory = project_root_path / "src" / "apps" / app_namespace

    print("=" * 60)
    print("App Switcher")
    print("=" * 60)
    print(f"Project Root: {project_root_path}")
    print(f"Target App:   {app_namespace}")
    print("=" * 60)
    print()

    # Load app configuration
    print("[STEP 1/6] Loading app configuration...")
    app_config = get_default_app_config(app_namespace)

    build_config_path = app_directory / "build_config.ini"
    if build_config_path.exists():
        app_config = merge_ini_config(app_config, str(build_config_path))

    # Display key configuration (use build_config.ini key)
    use_external = app_config.get(KEY_USE_EXTERNAL_SAFE_BUILD, False)
    print()

    # Setup factory directory if enabled
    working_directory = project_root_path
    factory_manager = None

    if use_external:
        print("[STEP 2/6] Setting up factory directory...")
        factory_manager = FactoryManager(project_root_path, app_namespace)

        # Show directory selection menu
        selected_path = factory_manager.show_factory_directory_menu()
        factory_manager.set_factory_path(selected_path)

        # Determine if incremental copy (existing directory) or full copy (new directory)
        is_existing = selected_path.exists()

        # Copy project to factory
        factory_manager.copy_project(incremental=is_existing)
        # pnpm will install dependencies in factory directory (Shell executes)

        working_directory = selected_path
        print(f"[OK] Factory directory: {working_directory}")
    else:
        print("[STEP 2/6] Using source directory")

    print()

    # Update app.json
    print("[STEP 3/6] Updating app.json...")
    update_app_json(working_directory, app_config)
    print()

    # Update index.js
    print("[STEP 4/6] Updating index.js...")
    update_index_js(working_directory, app_namespace, app_config)
    print()

    # Update Android manifest
    print("[STEP 5/6] Updating Android manifest...")
    update_android_manifest(working_directory, app_config)
    print()

    # Update Metro config and run prebuild
    print("[STEP 6/6] Configuring Metro and running prebuild...")
    if use_external:
        factory_manager.update_metro_config()
    else:
        update_metro_config(working_directory, app_directory, app_config)

    run_android_prebuild(working_directory, app_directory)
    print()

    # Store configuration for PowerShell
    from global_var_manager import GlobalVarManager
    gvm_global = GlobalVarManager(namespace=None)

    if use_external:
        gvm_global.set(KEY_FACTORY_BUILD_PATH, str(factory_manager.get_factory_path()))
        gvm_global.set(KEY_FACTORY_BUILD_ENABLED, "true")
    else:
        gvm_global.set(KEY_FACTORY_BUILD_ENABLED, "false")

    metro_port = get_metro_port(project_root_path, app_namespace)
    gvm_global.set(KEY_METRO_PORT, str(metro_port))

    gvm_global.set(KEY_APP_SWITCH_STATUS, "SUCCESS")

    print("=" * 60)
    print(f"App switch completed: {app_namespace}")
    print("=" * 60)
    print()

    os.chdir(str(initial_directory))


def main():
    """Main entry point for debug/testing"""
    # For debug testing: python app_switcher.py [project_root] <app_namespace>
    if len(sys.argv) >= 3:
        # Test mode: explicit parameters
        project_root = sys.argv[1]
        app_namespace = sys.argv[2]
    elif len(sys.argv) >= 2:
        # Test mode: auto-detect project root, explicit app
        project_root = str(get_project_root())
        app_namespace = sys.argv[1]
    else:
        print("[ERROR] Usage: python app_switcher.py [project_root] <app_namespace>")
        return

    fvs = FileVarSystem()
    fvs.clear_error()

    switch_app(project_root, app_namespace)


if __name__ == '__main__':
    main()
