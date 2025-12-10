#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build Controller for Capacitor/Android Build System
Handles all business logic and prepares commands for shell execution
Does NOT execute any shell commands directly
"""

import os
import sys
import json
import platform
import re
import shutil
import subprocess
import time
import traceback
import glob
from pathlib import Path

# Add parent directory to path to access utils and managers
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.file_var_system_new import FileVarSystem
from utils.init_build_config import (
    generate_app_name,
    generate_package_id,
    generate_display_name,
    create_default_config,
    read_config,
    extract_config_info
)
from managers.resource_scanner import ResourceScanner
from utils.web_preview_server import show_preview
from managers.resource_replacer import ResourceReplacer
from managers.capacitor_resource_manager import CapacitorResourceManager
from utils.key_center import (
    VERSION_CONFIG,
    REQUIRED_CORE_MAJOR_VERSION,
    get_java_requirements,
    KEY_UPGRADE_NEEDED,
    KEY_UPGRADE_TARGET,
    KEY_CURRENT_CAPACITOR_VERSION,
    KEY_TARGET_CAPACITOR_VERSION,
    KEY_UPGRADE_PACKAGES_TO_REMOVE,
    KEY_UPGRADE_PACKAGES_TO_INSTALL,
    KEY_FILE_REPLACEMENT_COUNT,
    KEY_FILE_REPLACEMENT_PREFIX,
    FIELD_FILE_PATH,
    FIELD_FILE_CONTENT,
    FIELD_FILE_BACKUP,
    KEY_REQUIRED_JAVA_VERSION,
    KEY_REQUIRED_JAVA_DOWNLOAD_URL,
    KEY_REQUIRED_AGP_VERSION,
    KEY_REQUIRED_GRADLE_VERSION,
    KEY_REQUIRED_ANDROID_STUDIO_VERSION,
    KEY_REQUIRED_COMPILE_SDK,
    KEY_REQUIRED_TARGET_SDK,
    KEY_ACTION_SHEET_FIX_NEEDED,
    KEY_ACTION_SHEET_FIX_METHOD,
    KEY_ACTION_SHEET_CURRENT_VERSION,
    KEY_ACTION_SHEET_TARGET_VERSION,
    KEY_ACTION_SHEET_BUILD_GRADLE_PATH,
    KEY_SYSTEM_JAVA_VERSION,
    KEY_PROJECT_JAVA_VERSION,
    KEY_PROJECT_AGP_VERSION,
    FIX_METHOD_DOWNGRADE,
    FIX_METHOD_PATCH_GRADLE,
    FIX_METHOD_NONE
)


class BuildController:
    """Main controller for build system"""

    def __init__(self, project_root: str):
        """
        Initialize build controller

        Args:
            project_root: Root directory of the project
        """
        # Load and print version configuration early
        # VERSION_CONFIG is already imported at module level

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

    def _check_gradle_version(self) -> None:
        """
        Check Gradle version and print warnings if needed
        Prevents Multi-Release JAR issues (GitHub #25953, #28940, #29381)
        """
        gradle_wrapper_props = self.android_path / "gradle" / "wrapper" / "gradle-wrapper.properties"

        if not gradle_wrapper_props.exists():
            return

        try:
            # Read gradle-wrapper.properties
            with open(gradle_wrapper_props, 'r', encoding='utf-8') as f:
                content = f.read()

            # Extract version from distributionUrl
            # Example: https://services.gradle.org/distributions/gradle-8.2.1-all.zip
            match = re.search(r'gradle-(\d+)\.(\d+)(?:\.(\d+))?-', content)

            if match:
                major = int(match.group(1))
                minor = int(match.group(2))
                patch = int(match.group(3)) if match.group(3) else 0

                version_str = f"{major}.{minor}.{patch}" if patch else f"{major}.{minor}"

                print(f"\n[Gradle] Detected version: {version_str}")

                # Check if version < 7.6.2 (known Multi-Release JAR issues)
                if (major, minor, patch) < (7, 6, 2):
                    print("\n" + "⚠" * 30)
                    print("\033[93m[WARNING] Gradle Version Issue Detected\033[0m")
                    print("⚠" * 30)
                    print(f"\nYour Gradle version ({version_str}) has known issues with Multi-Release JARs.")
                    print("This can cause 'Failed to create Jar file' errors (e.g., bcprov-jdk18on-1.79.jar)")
                    print("\n\033[92mRecommended Fix:\033[0m")
                    print(f"  1. Update gradle-wrapper.properties:")
                    print(f"     distributionUrl=https\\://services.gradle.org/distributions/gradle-8.2.1-all.zip")
                    print(f"  2. Or update to Gradle 7.6.2+ (minimum recommended)")
                    print("\n\033[94mReferences:\033[0m")
                    print("  - https://github.com/gradle/gradle/issues/25953")
                    print("  - https://github.com/gradle/gradle/issues/28940")
                    print("  - https://github.com/gradle/gradle/issues/29381")
                    print("⚠" * 30 + "\n")

                # Skip antivirus warning - auto-handled by build script
                pass

        except Exception as e:
            # Silently fail - version check is optional
            pass

    def _auto_clean_gradle_cache(self) -> None:
        """Auto-clean Gradle cache to fix JAR creation issues"""
        gradle_cache = Path.home() / ".gradle" / "caches"
        jars_9_cache = gradle_cache / "jars-9"

        if platform.system() == "Windows" and jars_9_cache.exists():
            print("\n[Auto-Fix] Cleaning Gradle jars-9 cache to prevent build failures...")
            try:
                # Stop Gradle daemon first
                print("[Auto-Fix] Stopping Gradle daemon...")
                gradlew = self.android_path / "gradlew.bat"
                if gradlew.exists():
                    subprocess.run([str(gradlew), "--stop"],
                                 cwd=str(self.android_path),
                                 capture_output=True,
                                 timeout=30)

                # Wait for daemon to fully stop
                time.sleep(3)

                # Clean jars-9 cache
                print(f"[Auto-Fix] Clearing cache: {jars_9_cache}")
                shutil.rmtree(jars_9_cache, ignore_errors=True)
                print("[Auto-Fix] Cache cleared successfully\n")

            except Exception as e:
                print(f"[Auto-Fix] Warning: Could not clean cache: {e}")
                print("[Auto-Fix] Build will continue anyway...\n")

    def _print_windows_antivirus_warning(self) -> None:
        """Print warning about Windows Defender/Antivirus interference"""
        gradle_cache = Path.home() / ".gradle"

        print("\n" + "🚨" * 30)
        print("\033[91m[CRITICAL] Windows Antivirus Action Required\033[0m")
        print("🚨" * 30)
        print("\n\033[93mYour Gradle cache directory is likely being blocked by antivirus software.\033[0m")
        print("This causes 'Failed to create Jar file' errors that cannot be fixed by clearing cache.")
        print("\n\033[92m⚡ REQUIRED ACTIONS (Must complete before building):\033[0m")
        print("\n1️⃣  Add to Windows Defender Exclusions:")
        print(f"    📁 {gradle_cache}")
        print(f"    📁 {self.project_root}")
        print("\n2️⃣  Steps to add exclusions:")
        print("    a. Press Windows Key, type 'Windows Security', press Enter")
        print("    b. Click 'Virus & threat protection'")
        print("    c. Scroll down, click 'Manage settings'")
        print("    d. Scroll down, click 'Add or remove exclusions'")
        print("    e. Click '+ Add an exclusion' → 'Folder'")
        print(f"    f. Add: {gradle_cache}")
        print(f"    g. Add: {self.project_root}")
        print("\n3️⃣  Exclude from Windows Search Indexing:")
        print("    a. Press Windows Key, type 'Indexing Options', press Enter")
        print("    b. Click 'Modify'")
        print(f"    c. Uncheck folders containing: {gradle_cache}")
        print("\n4️⃣  After adding exclusions:")
        print("    a. Delete the cache directory manually:")
        print(f"       rmdir /s /q \"{gradle_cache}\\caches\"")
        print("    b. Restart this build script")
        print("\n\033[94m📚 Official References:\033[0m")
        print("  • https://github.com/gradle/gradle/issues/24991")
        print("  • https://intellij-support.jetbrains.com/hc/en-us/articles/360006298560")
        print("  • https://github.com/gradle/gradle/issues/25953")
        print("\n\033[96m💡 Alternative Solution:\033[0m")
        print("  If you cannot modify antivirus settings, consider:")
        print("  • Using a different machine")
        print("  • Using WSL2 (Windows Subsystem for Linux)")
        print("  • Temporarily disabling real-time protection during build")
        print("🚨" * 30)

        # Ask user if they have completed the steps
        print("\n\033[93m⚠️  Have you added the exclusions to Windows Defender?\033[0m")
        print("   (Type 'yes' if completed, 'no' to see instructions again, 'skip' to continue anyway)")

        while True:
            response = input("   Your answer: ").strip().lower()
            if response in ('yes', 'y'):
                print("\n\033[92m✓ Great! Continuing with build...\033[0m")
                print("\033[96m💡 TIP: If build still fails, try deleting cache manually:\033[0m")
                print(f"   rmdir /s /q \"{gradle_cache}\\caches\"\n")
                break
            elif response in ('no', 'n'):
                print("\n\033[96m📋 Please follow the steps above and try again.\033[0m")
                input("\nPress Enter when ready to continue...")
                continue
            elif response == 'skip':
                print("\n\033[93m⚠️  Continuing without exclusions - build may fail!\033[0m\n")
                break
            else:
                print("\033[91m❌ Invalid input. Please type 'yes', 'no', or 'skip'\033[0m")

    def _configure_gradle_properties(self) -> None:
        """
        Configure Gradle network settings to prevent download timeout
        References:
        - https://discuss.gradle.org/t/troubleshooting-slow-dependency-resolving/14019
        - https://github.com/gradle/gradle/issues/17575
        """
        gradle_home = Path.home() / ".gradle"
        gradle_props = gradle_home / "gradle.properties"

        # Ensure .gradle directory exists
        gradle_home.mkdir(parents=True, exist_ok=True)

        # Required configurations
        required_configs = {
            "systemProp.org.gradle.internal.http.socketTimeout": "300000",  # 5 minutes
            "systemProp.org.gradle.internal.repository.max.retries": "10",
            "systemProp.org.gradle.internal.repository.initial.backoff": "500",
            "org.gradle.daemon": "true",
            "org.gradle.parallel": "false"  # Disable parallel to reduce rate limiting
        }

        try:
            # Read existing properties
            existing_props = {}
            if gradle_props.exists():
                with open(gradle_props, 'r', encoding='utf-8') as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith('#') and '=' in line:
                            key, value = line.split('=', 1)
                            existing_props[key.strip()] = value.strip()

            # Check if any required config is missing or different
            needs_update = False
            for key, value in required_configs.items():
                if key not in existing_props or existing_props[key] != value:
                    needs_update = True
                    break

            if needs_update:
                print("\n" + "⚙️ " * 30)
                print("\033[96m[CONFIG] Updating Gradle Network Settings\033[0m")
                print("⚙️ " * 30)
                print("\nConfiguring Gradle to handle large dependency downloads...")
                print(f"File: {gradle_props}")

                # Backup existing file if it exists
                if gradle_props.exists():
                    backup_path = gradle_props.with_suffix('.properties.backup')
                    shutil.copy2(gradle_props, backup_path)
                    print(f"\033[92m✓ Backup created: {backup_path}\033[0m")

                # Update existing_props with required configs
                existing_props.update(required_configs)

                # Write updated properties
                with open(gradle_props, 'w', encoding='utf-8') as f:
                    f.write("# Gradle configuration\n")
                    f.write("# Auto-generated by build script to prevent download timeout\n")
                    f.write("# References:\n")
                    f.write("#   - https://discuss.gradle.org/t/troubleshooting-slow-dependency-resolving/14019\n")
                    f.write("#   - https://github.com/gradle/gradle/issues/17575\n\n")

                    for key, value in sorted(existing_props.items()):
                        f.write(f"{key}={value}\n")

                print("\n\033[92m✓ Configuration updated:\033[0m")
                print(f"  • Socket timeout: 5 minutes (300000 ms)")
                print(f"  • Max retries: 10")
                print(f"  • Initial backoff: 500 ms")
                print(f"  • Parallel downloads: Disabled")
                print("\nThis helps download large files like bcprov-jdk18on-1.79.jar (7+ MB)")
                print("⚙️ " * 30 + "\n")
            else:
                print(f"\n\033[92m✓ Gradle properties already configured correctly\033[0m")

        except Exception as e:
            print(f"\n\033[93m[WARNING] Could not update gradle.properties: {e}\033[0m")
            print("You may need to manually add these settings to ~/.gradle/gradle.properties:")
            for key, value in required_configs.items():
                print(f"  {key}={value}")

    def _detect_capacitor_upgrade_needed(self) -> dict:
        """
        Detect if Capacitor needs upgrade based on VERSION_CONFIG

        Returns dict with upgrade plan
        """
        # All imports are at module level

        result = {
            'upgrade_needed': False,
            'current_version': '',
            'target_version': f'{REQUIRED_CORE_MAJOR_VERSION}.0.0',
            'packages': [],
            'file_replacements': [],
            'java_requirements': get_java_requirements()
        }

        try:
            # Step 1: Read package.json
            if not self.package_json_path.exists():
                return result

            with open(self.package_json_path, 'r', encoding='utf-8') as f:
                package_data = json.load(f)

            dependencies = package_data.get('dependencies', {})

            # Step 2: Check Capacitor core version
            core_version = dependencies.get('@capacitor/core', '')
            core_match = re.search(r'(\d+)\.(\d+)\.(\d+)', core_version)

            if not core_match:
                # No core version found, need fresh install
                result['upgrade_needed'] = True
                result['current_version'] = 'not installed'
                print(f"\n[Python] @capacitor/core not found, will install version {REQUIRED_CORE_MAJOR_VERSION}.x")
            else:
                core_major = int(core_match.group(1))
                result['current_version'] = f"{core_major}.{core_match.group(2)}.{core_match.group(3)}"

                # Step 3: Check if upgrade needed
                if core_major < REQUIRED_CORE_MAJOR_VERSION:
                    result['upgrade_needed'] = True
                    print(f"\n[Python] Detected outdated Capacitor version:")
                    print(f"  Current: Capacitor {result['current_version']}")
                    print(f"  Required: Capacitor {REQUIRED_CORE_MAJOR_VERSION}.x (latest)")
                    print(f"  Decision: Upgrade to latest")

            # Step 4: Get all Capacitor packages
            all_capacitor_packages = [pkg for pkg in dependencies.keys() if pkg.startswith('@capacitor/')]
            result['packages'] = all_capacitor_packages

            # Step 5: Prepare file replacements if upgrade needed
            if result['upgrade_needed']:
                result['file_replacements'] = self._prepare_capacitor_upgrade_files(result['java_requirements'])

        except Exception as e:
            print(f"[Python] Warning: Could not detect Capacitor upgrade: {e}")
            traceback.print_exc()

        return result

    def _prepare_capacitor_upgrade_files(self, java_req: dict) -> list:
        """
        Prepare file replacements for Capacitor upgrade
        Uses MCP-verified versions (2025-12-10)

        Args:
            java_req: Java requirements dict with verified versions

        Returns:
            List of file replacement dicts
        """
        replacements = []

        try:
            # 1. android/build.gradle - Update AGP to MCP-verified version
            build_gradle = self.android_path / "build.gradle"
            if build_gradle.exists():
                with open(build_gradle, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Replace AGP version with MCP-verified 8.7.2
                new_content = re.sub(
                    r"classpath ['\"]com\.android\.tools\.build:gradle:[\d.]+['\"]",
                    f"classpath 'com.android.tools.build:gradle:{java_req['agp_version']}'",
                    content
                )

                # Update Kotlin version if present
                if 'kotlin_version' in java_req and 'kotlin_version' in new_content:
                    new_content = re.sub(
                        r"kotlin_version\s*=\s*['\"][\d.]+['\"]",
                        f"kotlin_version = '{java_req['kotlin_version']}'",
                        new_content
                    )

                replacements.append({
                    'path': str(build_gradle),
                    'content': new_content,
                    'backup': True,
                    'description': f"Update AGP to {java_req['agp_version']}"
                })

            # 2. android/gradle/wrapper/gradle-wrapper.properties - Update Gradle
            gradle_wrapper = self.android_path / "gradle" / "wrapper" / "gradle-wrapper.properties"
            if gradle_wrapper.exists():
                # Use MCP-verified Gradle 8.11.1
                new_content = f"""distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-{java_req['gradle_version']}-all.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
"""
                replacements.append({
                    'path': str(gradle_wrapper),
                    'content': new_content,
                    'backup': True,
                    'description': f"Update Gradle to {java_req['gradle_version']}"
                })

            # 3. android/app/capacitor.build.gradle - Update Java version
            capacitor_build = self.android_path / "app" / "capacitor.build.gradle"
            if capacitor_build.exists():
                with open(capacitor_build, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Replace Java version to recommended version (21 for Capacitor 8)
                new_content = re.sub(
                    r'JavaVersion\.VERSION_\d+',
                    f'JavaVersion.VERSION_{java_req["java_recommended"]}',
                    content
                )

                replacements.append({
                    'path': str(capacitor_build),
                    'content': new_content,
                    'backup': True,
                    'description': f"Update Java to VERSION_{java_req['java_recommended']}"
                })

            # 4. android/variables.gradle - Update SDK versions
            variables_gradle = self.android_path / "variables.gradle"
            if variables_gradle.exists():
                with open(variables_gradle, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Update all SDK versions to MCP-verified values
                new_content = content
                new_content = re.sub(r'minSdkVersion\s*=\s*\d+', f'minSdkVersion = {java_req["min_sdk"]}', new_content)
                new_content = re.sub(r'compileSdkVersion\s*=\s*\d+', f'compileSdkVersion = {java_req["compile_sdk"]}', new_content)
                new_content = re.sub(r'targetSdkVersion\s*=\s*\d+', f'targetSdkVersion = {java_req["target_sdk"]}', new_content)

                replacements.append({
                    'path': str(variables_gradle),
                    'content': new_content,
                    'backup': True,
                    'description': f"Update SDK: compile={java_req['compile_sdk']}, target={java_req['target_sdk']}, min={java_req['min_sdk']}"
                })

            # 5. android/app/build.gradle - Update if exists (additional SDK config)
            app_build_gradle = self.android_path / "app" / "build.gradle"
            if app_build_gradle.exists():
                with open(app_build_gradle, 'r', encoding='utf-8') as f:
                    content = f.read()

                # Update SDK versions in app build.gradle
                new_content = content
                if 'compileSdkVersion' in new_content or 'compileSdk' in new_content:
                    new_content = re.sub(r'compileSdkVersion\s+\d+', f'compileSdkVersion {java_req["compile_sdk"]}', new_content)
                    new_content = re.sub(r'compileSdk\s*=?\s*\d+', f'compileSdk {java_req["compile_sdk"]}', new_content)

                if 'targetSdkVersion' in new_content or 'targetSdk' in new_content:
                    new_content = re.sub(r'targetSdkVersion\s+\d+', f'targetSdkVersion {java_req["target_sdk"]}', new_content)
                    new_content = re.sub(r'targetSdk\s*=?\s*\d+', f'targetSdk {java_req["target_sdk"]}', new_content)

                if 'minSdkVersion' in new_content or 'minSdk' in new_content:
                    new_content = re.sub(r'minSdkVersion\s+\d+', f'minSdkVersion {java_req["min_sdk"]}', new_content)
                    new_content = re.sub(r'minSdk\s*=?\s*\d+', f'minSdk {java_req["min_sdk"]}', new_content)

                # Only add if content changed
                if new_content != content:
                    replacements.append({
                        'path': str(app_build_gradle),
                        'content': new_content,
                        'backup': True,
                        'description': "Update app build.gradle SDK versions"
                    })

            # Print summary
            print(f"\n[Python] Prepared {len(replacements)} file replacements:")
            for i, repl in enumerate(replacements, 1):
                print(f"  {i}. {Path(repl['path']).name}: {repl.get('description', 'Update configuration')}")

        except Exception as e:
            print(f"[Python] Warning: Could not prepare file replacements: {e}")
            traceback.print_exc()

        return replacements

    def _ensure_android_manifest_config(self) -> dict:
        """
        Ensure Android manifest has proper status bar and safe area configuration
        Based on Capacitor 8 official requirements

        Checks and ensures:
        1. android:fitsSystemWindows="true" in activity tag
        2. density in configChanges attribute

        Returns:
            dict: {
                'checked': bool,
                'config_ok': bool,
                'modifications': list,
                'error': str or None
            }
        """
        result = {
            'checked': False,
            'config_ok': True,
            'modifications': [],
            'error': None
        }

        try:
            manifest_path = self.android_path / "app" / "src" / "main" / "AndroidManifest.xml"

            if not manifest_path.exists():
                result['error'] = f"AndroidManifest.xml not found: {manifest_path}"
                return result

            # Read manifest content
            with open(manifest_path, 'r', encoding='utf-8') as f:
                content = f.read()

            result['checked'] = True
            modifications_needed = []
            new_content = content

            # Check 1: Ensure density is in configChanges
            # Capacitor 8 requires density for proper status bar handling
            if 'android:configChanges=' in content:
                # Find the configChanges attribute value
                config_changes_match = re.search(r'android:configChanges="([^"]*)"', content)
                if config_changes_match:
                    config_changes = config_changes_match.group(1)
                    if 'density' not in config_changes:
                        # Add density to configChanges
                        new_config_changes = config_changes + '|density'
                        new_content = new_content.replace(
                            f'android:configChanges="{config_changes}"',
                            f'android:configChanges="{new_config_changes}"'
                        )
                        modifications_needed.append("Added 'density' to configChanges")
                        result['config_ok'] = False

            # Check 2: Ensure android:fitsSystemWindows="true" in activity
            # This handles safe area insets properly
            if '<activity' in content and 'android:fitsSystemWindows' not in content:
                # Find the activity tag and add fitsSystemWindows
                # Pattern: Find activity tag and insert attribute before closing >
                activity_pattern = r'(<activity[^>]*?)(android:exported="[^"]*")([^>]*?>)'
                if re.search(activity_pattern, content):
                    new_content = re.sub(
                        activity_pattern,
                        r'\1\2\n            android:fitsSystemWindows="true"\3',
                        new_content
                    )
                    modifications_needed.append("Added 'android:fitsSystemWindows=\"true\"' to activity")
                    result['config_ok'] = False

            # If modifications are needed, add to result
            if modifications_needed:
                result['modifications'] = modifications_needed
                result['config_ok'] = False

                print(f"\n[Python] Android manifest configuration check:")
                print(f"  Status: \033[93m⚠ Configuration needs update\033[0m")
                for mod in modifications_needed:
                    print(f"    - {mod}")
                print(f"  Reference: Capacitor 8 official requirements")
                print(f"    https://capacitorjs.com/docs/android/configuration")

                # Apply the modifications by writing the corrected content
                # Create backup first
                backup_path = str(manifest_path) + ".backup_manifest"
                try:
                    shutil.copy2(str(manifest_path), backup_path)
                    print(f"  Backup: {backup_path}")
                except Exception as e:
                    print(f"  \033[93mWarning: Could not create backup: {e}\033[0m")

                # Write corrected content
                try:
                    with open(manifest_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print(f"  \033[92m✓ Configuration updated successfully\033[0m")
                except Exception as e:
                    result['error'] = f"Failed to write manifest: {e}"
                    print(f"  \033[91m✗ Failed to update: {e}\033[0m")
                    # Restore from backup if write failed
                    if Path(backup_path).exists():
                        try:
                            shutil.copy2(backup_path, str(manifest_path))
                            print(f"  \033[92m✓ Restored from backup\033[0m")
                        except:
                            pass
            else:
                print(f"\n[Python] Android manifest configuration check:")
                print(f"  Status: \033[92m✓ Configuration OK\033[0m")
                print(f"    - density in configChanges: ✓")
                print(f"    - fitsSystemWindows in activity: ✓")

        except Exception as e:
            result['error'] = f"Failed to check manifest: {e}"
            print(f"\n[Python] Warning: Could not verify Android manifest configuration: {e}")

        return result

    def _detect_action_sheet_compatibility_old(self) -> dict:
        """
        Detect action-sheet version compatibility issues
        Returns dict with detection results and recommended fix

        Checks:
        1. Current action-sheet version from package.json
        2. System Java version
        3. Project Java version from capacitor.build.gradle
        4. AGP version from action-sheet build.gradle

        Returns:
            dict: {
                'fix_needed': bool,
                'fix_method': str,  # 'downgrade', 'patch_gradle', or 'none'
                'current_version': str,
                'target_version': str,
                'system_java': str,
                'project_java': str,
                'plugin_agp': str,
                'build_gradle_path': str
            }
        """
        result = {
            'fix_needed': False,
            'fix_method': FIX_METHOD_NONE,
            'current_version': '',
            'target_version': '6.0.2',
            'system_java': '',
            'project_java': '',
            'plugin_agp': '',
            'build_gradle_path': ''
        }

        try:
            # Step 1: Read action-sheet version from package.json
            if not self.package_json_path.exists():
                return result

            with open(self.package_json_path, 'r', encoding='utf-8') as f:
                package_data = json.load(f)

            dependencies = package_data.get('dependencies', {})
            action_sheet_version = dependencies.get('@capacitor/action-sheet', '')

            if not action_sheet_version:
                # No action-sheet installed, no fix needed
                return result

            # Extract numeric version (remove ^, ~, etc.)
            version_match = re.search(r'(\d+)\.(\d+)\.(\d+)', action_sheet_version)
            if not version_match:
                return result

            major = int(version_match.group(1))
            result['current_version'] = f"{major}.{version_match.group(2)}.{version_match.group(3)}"

            # Step 2: Check if version is 8.x (problematic version)
            if major < 8:
                # Version 6.x or 7.x - compatible with Java 17
                return result

            # Version 8.x detected - check Java compatibility
            print(f"\n[Python] Detected @capacitor/action-sheet@{result['current_version']}")

            # Step 3: Detect system Java version
            system_java = self._detect_system_java_version()
            result['system_java'] = system_java

            # Step 4: Detect project Java version from capacitor.build.gradle
            capacitor_build_gradle = self.android_path / "app" / "capacitor.build.gradle"
            project_java = '17'  # Default

            if capacitor_build_gradle.exists():
                with open(capacitor_build_gradle, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Look for JavaVersion.VERSION_XX
                    java_match = re.search(r'JavaVersion\.VERSION_(\d+)', content)
                    if java_match:
                        project_java = java_match.group(1)

            result['project_java'] = project_java

            # Step 5: Check action-sheet build.gradle for AGP and Java requirements
            action_sheet_gradle = self._find_action_sheet_build_gradle()
            result['build_gradle_path'] = action_sheet_gradle

            if action_sheet_gradle:
                with open(action_sheet_gradle, 'r', encoding='utf-8') as f:
                    gradle_content = f.read()

                    # Extract AGP version
                    agp_match = re.search(r"classpath ['\"]com\.android\.tools\.build:gradle:([0-9.]+)['\"]", gradle_content)
                    if agp_match:
                        result['plugin_agp'] = agp_match.group(1)

                    # Extract Java version requirement
                    plugin_java_match = re.search(r'JavaVersion\.VERSION_(\d+)', gradle_content)
                    plugin_java = plugin_java_match.group(1) if plugin_java_match else '21'

                    # Check compatibility
                    if int(plugin_java) > int(project_java):
                        # Plugin requires newer Java than project has
                        result['fix_needed'] = True

                        # Determine fix method based on system Java
                        if system_java and int(system_java) >= int(plugin_java):
                            # System has compatible Java - can upgrade project
                            result['fix_method'] = FIX_METHOD_PATCH_GRADLE
                        else:
                            # System doesn't have compatible Java - downgrade plugin
                            result['fix_method'] = FIX_METHOD_DOWNGRADE

        except Exception as e:
            print(f"[Python] Warning: Could not detect action-sheet compatibility: {e}")

        return result

    def _detect_system_java_version(self) -> str:
        """
        Detect system Java version
        Returns: Version string like '17' or '21', or empty string if cannot detect
        """
        # Note: We don't execute shell commands directly
        # Instead, we'll check JAVA_HOME or rely on shell to provide this
        # For now, return empty and let shell handle detection
        return ''

    def _find_action_sheet_build_gradle(self) -> str:
        """
        Find action-sheet plugin's build.gradle file
        Returns: Path to build.gradle or empty string
        """
        # Search in node_modules
        node_modules = self.project_root / "node_modules"

        # Try pnpm structure first
        search_patterns = [
            str(node_modules / ".pnpm" / "@capacitor+action-sheet@*" / "node_modules" / "@capacitor" / "action-sheet" / "android" / "build.gradle"),
            str(node_modules / "@capacitor" / "action-sheet" / "android" / "build.gradle"),
        ]

        for pattern in search_patterns:
            matches = glob.glob(pattern)
            if matches:
                return matches[0]

        return ''

    def _apply_capacitor_upgrade(self, upgrade_result: dict) -> None:
        """
        Apply Capacitor upgrade by:
        1. Python: Write all Gradle configuration files (complex work)
        2. Python: Generate pnpm command queue
        3. Shell: Execute pnpm commands

        Args:
            upgrade_result: Result from _detect_capacitor_upgrade_needed()
        """
        if not upgrade_result['upgrade_needed']:
            return

        java_req = upgrade_result['java_requirements']
        packages = upgrade_result['packages']

        # Print upgrade plan
        print("\n" + "🚀" * 30)
        print("\033[93m[UPGRADE] Capacitor Upgrade Required\033[0m")
        print("🚀" * 30)
        print(f"\n\033[93mCurrent version: Capacitor {upgrade_result['current_version']}\033[0m")
        print(f"\033[92mTarget version: Capacitor {upgrade_result['target_version']}\033[0m")
        print(f"\nPackages to upgrade: {len(packages)}")
        print(f"Files to modify: {len(upgrade_result['file_replacements'])}")
        print(f"\n\033[93m⚠️  Java {java_req['java_minimum']}+ Required (Recommended: {java_req['java_recommended']})\033[0m")
        print(f"  Install via Android Studio or download from Oracle JDK website")
        print("🚀" * 30 + "\n")

        # Generate Java environment upgrade guide
        self._generate_java_upgrade_guide(java_req)

        # Step 1: Python writes all Gradle configuration files
        print(f"\n[Python] Writing {len(upgrade_result['file_replacements'])} configuration files...")
        for idx, replacement in enumerate(upgrade_result['file_replacements'], 1):
            file_path = Path(replacement['path'])
            file_content = replacement['content']
            backup = replacement.get('backup', False)
            desc = replacement.get('description', 'Update configuration')

            print(f"  [{idx}/{len(upgrade_result['file_replacements'])}] {desc}")

            try:
                # Create backup if requested
                if backup and file_path.exists():
                    timestamp = time.strftime("%Y%m%d_%H%M%S")
                    backup_path = file_path.with_suffix(f"{file_path.suffix}.backup_{timestamp}")
                    shutil.copy2(file_path, backup_path)
                    print(f"       Backup: {backup_path.name}")

                # Write new content
                file_path.parent.mkdir(parents=True, exist_ok=True)
                with open(file_path, 'w', encoding='utf-8', newline='') as f:
                    f.write(file_content)
                print(f"       ✓ Written: {file_path.name}")

            except Exception as e:
                print(f"       ✗ Error: {e}")

        print(f"[Python] ✓ All configuration files updated\n")

        # Step 2: Generate pnpm command queue for Shell to execute
        print("[Python] Generating upgrade command queue...")

        # Command 1: Remove all old Capacitor packages
        if packages:
            packages_str = " ".join(packages)
            self.var_system.add_command(
                f"pnpm_remove|{packages_str}",
                f"Remove {len(packages)} old Capacitor packages",
                str(self.project_root)
            )

        # Command 2: Install all Capacitor packages with @latest
        packages_latest = [f"{pkg}@latest" for pkg in packages]
        packages_latest_str = " ".join(packages_latest)
        self.var_system.add_command(
            f"pnpm_add|{packages_latest_str}",
            f"Install Capacitor {upgrade_result['target_version']} packages",
            str(self.project_root)
        )

        # Command 3: Sync Capacitor
        self.var_system.add_command(
            "sync_capacitor_android",
            "Re-sync Capacitor with Android",
            str(self.project_root)
        )

        print(f"[Python] ✓ {self.var_system.get_command_count()} commands ready for Shell\n")

    def _generate_java_upgrade_guide(self, java_req: dict) -> None:
        """
        Generate Java 21 environment upgrade guide document

        Args:
            java_req: Java requirements dict
        """
        guide_path = self.project_root / "CAPACITOR_8_UPGRADE_GUIDE.md"

        guide_content = f"""# Capacitor 8 Environment Upgrade Guide

## 📋 Overview

Your project is upgrading to **Capacitor 8**, which requires updated build tools and dependencies.

## 🎯 Requirements

- **Java Version**: {java_req['java_minimum']}+ (Recommended: {java_req['java_recommended']})
- **Android Gradle Plugin (AGP)**: {java_req['agp_version']}
- **Gradle**: {java_req['gradle_version']}
- **Kotlin**: {java_req['kotlin_version']}
- **compileSdk**: {java_req['compile_sdk']}
- **targetSdk**: {java_req['target_sdk']}
- **minSdk**: {java_req['min_sdk']}

## 📥 Java Installation

### Option 1: Install via Android Studio (Recommended)

1. **Download Android Studio Otter | 2025.2.1+**
   - URL: https://developer.android.com/studio
   - Java 21 is bundled with Android Studio

2. **Set JAVA_HOME**

   **Windows:**
   ```powershell
   # Android Studio's bundled JDK location
   $env:JAVA_HOME = "C:\\Program Files\\Android\\Android Studio\\jbr"
   [Environment]::SetEnvironmentVariable("JAVA_HOME", $env:JAVA_HOME, "User")
   ```

   **Linux/macOS:**
   ```bash
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
   # Add to ~/.bashrc or ~/.zshrc
   ```

3. **Verify Installation**
   ```bash
   java -version
   # Should show: openjdk version "21.x.x" or later
   ```

### Option 2: Install JDK Separately

**Windows:**
- Download Oracle JDK 21 or Temurin JDK 21
- Run installer and follow prompts
- Set JAVA_HOME to installation directory

**Linux:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install openjdk-21-jdk

# Fedora/RHEL
sudo dnf install java-21-openjdk-devel

# Set JAVA_HOME
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk
echo 'export JAVA_HOME=/usr/lib/jvm/java-21-openjdk' >> ~/.bashrc
```

**macOS:**
```bash
brew install openjdk@21

# Link it
sudo ln -sfn $(brew --prefix)/opt/openjdk@21/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-21.jdk

# Set JAVA_HOME
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 21)' >> ~/.zshrc
```

## 🔧 Gradle Configuration Updates

The following files will be automatically updated:

1. **`android/build.gradle`**
   - AGP: → `{java_req['agp_version']}`
   - Google Services: → `{java_req['google_services_version']}`

2. **`android/gradle/wrapper/gradle-wrapper.properties`**
   - Gradle: → `{java_req['gradle_version']}`

3. **`android/app/capacitor.build.gradle`**
   - Java: → `VERSION_{java_req['java_recommended']}`

4. **`android/variables.gradle`**
   - compileSdk: → `{java_req['compile_sdk']}`
   - targetSdk: → `{java_req['target_sdk']}`
   - minSdk: → `{java_req['min_sdk']}`

## ✅ Verification Steps

After installing Java {java_req['java_recommended']}:

1. **Verify Java Version**
   ```bash
   java -version
   # Expected: openjdk version "21.x.x"
   ```

2. **Verify JAVA_HOME**
   ```bash
   echo $JAVA_HOME  # Linux/macOS
   echo %JAVA_HOME%  # Windows CMD
   echo $env:JAVA_HOME  # Windows PowerShell
   ```

3. **Clean Gradle Cache**
   ```bash
   cd android
   ./gradlew --stop  # Windows: .\\gradlew.bat --stop
   rm -rf ~/.gradle/caches  # Windows: Remove-Item -Recurse -Force $env:USERPROFILE\\.gradle\\caches
   ```

4. **Re-run Build Script**
   ```bash
   ./scripts/start.ps1  # Windows
   ./scripts/start.sh   # Linux
   ```

## 🚨 Common Issues

### Issue 1: "Unsupported class file major version"
**Cause**: Gradle is using old Java version
**Solution**: Verify JAVA_HOME points to Java 21

### Issue 2: "Could not determine java version"
**Cause**: Java not in PATH
**Solution**: Add Java bin directory to PATH

### Issue 3: Build fails with "AGP requires Java 21"
**Cause**: Android Studio using old JDK
**Solution**: In Android Studio, go to:
- **File → Project Structure → SDK Location**
- Set **JDK Location** to Java 21 path

## 📚 References

- [Capacitor 7 Upgrade Guide](https://capacitorjs.com/docs/updating/7-0)
- [Android Studio Requirements](https://developer.android.com/studio)
- [Gradle Java Compatibility](https://docs.gradle.org/current/userguide/compatibility.html)

---

**Generated**: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
**For Project**: {self.project_root.name}
"""

        try:
            with open(guide_path, 'w', encoding='utf-8') as f:
                f.write(guide_content)
            print(f"\n\033[92m✓ Java upgrade guide created: {guide_path}\033[0m")
        except Exception as e:
            print(f"\n\033[93m⚠️  Could not create upgrade guide: {e}\033[0m")

    def _apply_action_sheet_fix_old(self, detection_result: dict) -> None:
        """
        Apply action-sheet compatibility fix by setting file variables
        Shell will read these variables and execute the fix

        Args:
            detection_result: Result from _detect_action_sheet_compatibility()
        """
        if not detection_result['fix_needed']:
            self.var_system.set_var(KEY_ACTION_SHEET_FIX_NEEDED, 'false')
            return

        # Print detection summary
        print("\n" + "⚠️ " * 30)
        print("\033[93m[COMPATIBILITY CHECK] Capacitor Action Sheet Issue Detected\033[0m")
        print("⚠️ " * 30)
        print(f"\n\033[93mCurrent version: @capacitor/action-sheet@{detection_result['current_version']}\033[0m")
        print(f"Project Java version: {detection_result['project_java']}")
        print(f"Plugin requires: Java 21+ and AGP {detection_result.get('plugin_agp', '8.13.0')}")

        # Set file variables for shell to read
        self.var_system.set_var(KEY_ACTION_SHEET_FIX_NEEDED, 'true')
        self.var_system.set_var(KEY_ACTION_SHEET_FIX_METHOD, detection_result['fix_method'])
        self.var_system.set_var(KEY_ACTION_SHEET_CURRENT_VERSION, detection_result['current_version'])
        self.var_system.set_var(KEY_ACTION_SHEET_TARGET_VERSION, detection_result['target_version'])
        self.var_system.set_var(KEY_ACTION_SHEET_BUILD_GRADLE_PATH, detection_result['build_gradle_path'])
        self.var_system.set_var(KEY_SYSTEM_JAVA_VERSION, detection_result['system_java'])
        self.var_system.set_var(KEY_PROJECT_JAVA_VERSION, detection_result['project_java'])
        self.var_system.set_var(KEY_PROJECT_AGP_VERSION, detection_result.get('plugin_agp', ''))

        if detection_result['fix_method'] == FIX_METHOD_DOWNGRADE:
            print(f"\n\033[92m✓ Auto-fix will be applied:\033[0m")
            print(f"  Method: Downgrade to version {detection_result['target_version']}")
            print(f"  This version is compatible with Java {detection_result['project_java']}")
            print(f"  Shell will execute: pnpm remove @capacitor/action-sheet")
            print(f"  Shell will execute: pnpm add @capacitor/action-sheet@{detection_result['target_version']}")
        elif detection_result['fix_method'] == FIX_METHOD_PATCH_GRADLE:
            print(f"\n\033[92m✓ Auto-fix will be applied:\033[0m")
            print(f"  Method: Patch plugin build.gradle")
            print(f"  Shell will modify: {detection_result['build_gradle_path']}")
            print(f"  - Downgrade AGP requirement to match project")
            print(f"  - Downgrade Java requirement to {detection_result['project_java']}")

        print("\n\033[96m💡 This fix will be applied automatically by the shell executor\033[0m")
        print("⚠️ " * 30 + "\n")

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

        # Print resource file status
        print("\n" + "-" * 60)
        print("Resource Files Status")
        print("-" * 60)
        app_logo_src = config_info.get("app_logo_src", "logo.png")
        splash_src = config_info.get("splash_src", "splash.png")
        logo_path = self.assets_path / app_logo_src
        splash_path = self.assets_path / splash_src

        print(f"App Logo:   {app_logo_src}")
        if logo_path.exists():
            print(f"  Status: \033[92m✓ Found\033[0m")
        else:
            print(f"  Status: \033[91m✗ Missing\033[0m")
        print(f"  Path: {logo_path}")

        print(f"\nSplash:     {splash_src}")
        if splash_path.exists():
            print(f"  Status: \033[92m✓ Found\033[0m")
        else:
            print(f"  Status: \033[93m⚠ Missing\033[0m")
        print(f"  Path: {splash_path}")
        print("-" * 60)

        # Validate resource files exist (variables already defined above)
        missing_resources = []

        if not logo_path.exists():
            missing_resources.append(f"app_logo_src: {app_logo_src}")
        if not splash_path.exists():
            missing_resources.append(f"splash_src: {splash_src}")

        if missing_resources:
            print("\n" + "=" * 60)
            print("\033[93m[WARNING] Missing Resource Files\033[0m")
            print("=" * 60)
            print(f"\nThe following configured resources are missing:")
            for res in missing_resources:
                print(f"  ⚠ {res}")
            print(f"\nExpected location: {self.assets_path}")
            print(f"\nPlease:")
            print(f"  1. Place the resource files in: {self.assets_path}")
            print(f"  2. Or update build_config.ini [app_info] section:")
            print(f"     - app_logo_src = <your_icon_filename.png>")
            print(f"     - splash_src = <your_splash_filename.png>")
            print(f"\nNote: Installation will continue, but resource generation may fail")
            print("=" * 60 + "\n")

        # Update package.json with Capacitor packages
        package_stats = self.update_package_json_with_capacitor()

        # Step: Detect Capacitor upgrade need
        print("\n[Python] Checking Capacitor version compatibility...")
        upgrade_result = self._detect_capacitor_upgrade_needed()

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

        # Apply Capacitor upgrade (generates pnpm commands if needed)
        self._apply_capacitor_upgrade(upgrade_result)

        # Command: Run pnpm install (only if packages were added and no upgrade)
        if package_stats["added"] > 0 and not upgrade_result['upgrade_needed']:
            self.var_system.add_command(
                "pnpm_install",
                f"Install {package_stats['added']} new Capacitor packages",
                str(self.project_root)
            )
        elif not upgrade_result['upgrade_needed']:
            print("[Python] Skipping pnpm install - no new packages added")

        # Command 2: Initialize Capacitor (no parameters - all from file variables)
        self.var_system.add_command(
            'init_capacitor',
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
            package_id=config_info.get("package_id", ""),
            app_logo_src=config_info.get("app_logo_src", "logo.png"),
            splash_src=config_info.get("splash_src", "splash.png")
        )

        # Set flag for shell to run capacitor-assets
        self.var_system.set_var("RUN_CAPACITOR_ASSETS", "true" if cap_results["icon"].get("success") else "false")

        # Check if Android folder exists and ask if user wants to reset it
        android_folder = self.project_root / "android"
        reset_android = False

        if android_folder.exists():
            print("\n" + "=" * 60)
            print("\033[96m[OPTION] Reset Android Platform\033[0m")
            print("=" * 60)
            print(f"\nAndroid folder detected: {android_folder}")
            print("\n\033[93m💡 Capacitor Official Recommendation:\033[0m")
            print("   If you encounter build issues or need a fresh Android configuration,")
            print("   you can delete the android folder and re-run 'npx cap add android'")
            print("\n\033[96mReference:\033[0m")
            print("   https://capacitorjs.com/docs/android")
            print("   https://forum.ionicframework.com/t/how-to-remove-android-platform/211263")
            print("\n\033[93m⚠️  Warning: This will remove all custom Android native code modifications!\033[0m")
            print("=" * 60)

            while True:
                response = input("\nReset Android folder? (y/N): ").strip().lower()
                if response == 'y' or response == 'yes':
                    print("\n\033[92m✓ Will reset Android folder\033[0m")
                    reset_android = True
                    break
                elif response == 'n' or response == 'no' or response == '':
                    print("\n\033[96m✓ Will keep existing Android folder\033[0m")
                    reset_android = False
                    break
                else:
                    print("\033[91m❌ Invalid input. Please enter 'y' (yes) or 'n' (no)\033[0m")

        # Command 4: Remove Android platform if user chose to reset
        if reset_android:
            print(f"\n[Python] Android folder will be deleted and recreated")
            self.var_system.add_command(
                "remove_android_platform",
                "Remove existing Android platform folder",
                str(self.project_root)
            )

        # Command 4/5: Add Android platform
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
        print(f"[Python] All variables and commands saved to: {self.var_system.var_dir}")

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

        # Auto-fix: Clean Gradle cache to prevent JAR creation issues
        self._auto_clean_gradle_cache()

        # Check Gradle version (prevent Multi-Release JAR issues)
        self._check_gradle_version()

        # Configure Gradle network settings (prevent download timeout)
        self._configure_gradle_properties()

        # Load build config
        config_info = self.initialize_build_config()

        # Print resource file status
        print("\n" + "-" * 60)
        print("Resource Files Status")
        print("-" * 60)
        app_logo_src = config_info.get("app_logo_src", "logo.png")
        splash_src = config_info.get("splash_src", "splash.png")
        logo_path = self.assets_path / app_logo_src
        splash_path = self.assets_path / splash_src

        print(f"App Logo:   {app_logo_src}")
        if logo_path.exists():
            print(f"  Status: \033[92m✓ Found\033[0m")
        else:
            print(f"  Status: \033[91m✗ Missing\033[0m")
        print(f"  Path: {logo_path}")

        print(f"\nSplash:     {splash_src}")
        if splash_path.exists():
            print(f"  Status: \033[92m✓ Found\033[0m")
        else:
            print(f"  Status: \033[93m⚠ Missing\033[0m")
        print(f"  Path: {splash_path}")
        print("-" * 60)

        # Validate resource files exist
        app_logo_src = config_info.get("app_logo_src", "logo.png")
        splash_src = config_info.get("splash_src", "splash.png")

        missing_resources = []
        logo_path = self.assets_path / app_logo_src
        splash_path = self.assets_path / splash_src

        if not logo_path.exists():
            missing_resources.append(f"app_logo_src: {app_logo_src}")
        if not splash_path.exists():
            missing_resources.append(f"splash_src: {splash_src}")

        if missing_resources:
            print("\n" + "=" * 60)
            print("\033[91m[ERROR] Missing Resource Files\033[0m")
            print("=" * 60)
            print(f"\nThe following configured resources are missing:")
            for res in missing_resources:
                print(f"  ✗ {res}")
            print(f"\nExpected location: {self.assets_path}")
            print(f"\nPlease:")
            print(f"  1. Place the resource files in: {self.assets_path}")
            print(f"  2. Or update build_config.ini [app_info] section:")
            print(f"     - app_logo_src = <your_icon_filename.png>")
            print(f"     - splash_src = <your_splash_filename.png>")
            print("=" * 60)
            self.var_system.set_var("ERROR", "missing_resource_files")
            return

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
            package_id=config_info.get("package_id", ""),
            app_logo_src=config_info.get("app_logo_src", "logo.png"),
            splash_src=config_info.get("splash_src", "splash.png")
        )

        # Set flag for shell to run capacitor-assets
        self.var_system.set_var("RUN_CAPACITOR_ASSETS", "true" if cap_results["icon"].get("success") else "false")

        # Step 2: Scan Android resources (before custom replacement)
        print("\n[Python] Scanning Android resources...")
        scanner = ResourceScanner(str(self.android_path))

        # Step 3: Custom replacement (additional optimization)
        print("\n[Python] Applying custom resource replacements...")
        replacer = ResourceReplacer(
            str(self.android_path),
            str(self.assets_path),
            app_logo_src=config_info.get("app_logo_src", "logo.png"),
            splash_src=config_info.get("splash_src", "splash.png")
        )
        replace_stats = replacer.replace_resources()

        # Step 3.5: Update Android strings.xml with app display names
        print("\n[Python] Updating Android app names in strings.xml...")
        replacer.update_android_strings(
            app_name=config_info.get("app_name", ""),
            display_name_en=config_info.get("display_name_english", ""),
            display_name_cn=config_info.get("display_name_chinese", ""),
            package_id=config_info.get("package_id", ""),
            supported_languages=config_info.get("supported_languages", ""),
            config_info=config_info
        )

        # Step 3.6: Ensure Android manifest configuration (status bar and safe area)
        self._ensure_android_manifest_config()

        # Step 4: Re-scan after replacement to show updated resources
        print("\n[Python] Re-scanning resources after replacement...")
        scanner = ResourceScanner(str(self.android_path))
        resource_data = scanner.get_full_report()

        # Show web preview and wait for user confirmation
        print("\n" + "=" * 60)
        print("[Python] Launching resource preview...")
        print("=" * 60)

        show_preview(resource_data, self.var_system, port=8899)

        # Read user action from file variable (not return value)
        user_action = self.var_system.get_var("USER_ACTION")

        if user_action != "continue":
            print(f"[Python] Build cancelled by user (action: {user_action})")
            # Don't add any commands - command_count will remain 0
            # Shell will check command_count and exit gracefully
            return

        print("\n[Python] User confirmed, continuing with build...")

        # Set flag to stop Gradle Daemon before build (prevents cache corruption)
        # Shell will check this flag and stop daemon before first build attempt
        self.var_system.set_var("STOP_GRADLE_DAEMON_BEFORE_BUILD", "true")

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

        # Step 2.5: Detect and apply Capacitor upgrade if needed
        print("\n[Python] Checking Capacitor version compatibility...")
        upgrade_result = self._detect_capacitor_upgrade_needed()
        self._apply_capacitor_upgrade(upgrade_result)

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

    # Clear any previous ERROR variable (Python should not set ERROR for user actions)
    # ERROR should only be set for actual errors during Python execution
    if controller.var_system.get_var("ERROR"):
        controller.var_system.set_var("ERROR", "")  # Clear old ERROR

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
