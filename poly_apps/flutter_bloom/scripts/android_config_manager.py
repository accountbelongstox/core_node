#!/usr/bin/env python3
"""
Android Configuration Manager
Scans Android directory, backs up configs, and manages Android permissions
"""

import os
import sys
import shutil
import getpass
import xml.etree.ElementTree as ET
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple


class AndroidConfigManager:
    """
    Manages Android configuration files and permissions
    """

    ANDROID_DIR = None
    BACKUP_DIR = None
    PERMISSIONS = {
        'INTERNET': 'android.permission.INTERNET',
        'ACCESS_FINE_LOCATION': 'android.permission.ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION': 'android.permission.ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION': 'android.permission.ACCESS_BACKGROUND_LOCATION',
        'CAMERA': 'android.permission.CAMERA',
        'RECORD_AUDIO': 'android.permission.RECORD_AUDIO',
        'READ_EXTERNAL_STORAGE': 'android.permission.READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE': 'android.permission.WRITE_EXTERNAL_STORAGE',
        'MANAGE_EXTERNAL_STORAGE': 'android.permission.MANAGE_EXTERNAL_STORAGE',
        'READ_PHONE_STATE': 'android.permission.READ_PHONE_STATE',
        'READ_PHONE_NUMBERS': 'android.permission.READ_PHONE_NUMBERS',
        'ACCESS_NETWORK_STATE': 'android.permission.ACCESS_NETWORK_STATE',
        'ACCESS_WIFI_STATE': 'android.permission.ACCESS_WIFI_STATE',
        'BLUETOOTH': 'android.permission.BLUETOOTH',
        'BLUETOOTH_ADMIN': 'android.permission.BLUETOOTH_ADMIN',
        'BLUETOOTH_CONNECT': 'android.permission.BLUETOOTH_CONNECT',
        'BLUETOOTH_SCAN': 'android.permission.BLUETOOTH_SCAN',
        'READ_CONTACTS': 'android.permission.READ_CONTACTS',
        'WRITE_CONTACTS': 'android.permission.WRITE_CONTACTS',
        'READ_CALENDAR': 'android.permission.READ_CALENDAR',
        'WRITE_CALENDAR': 'android.permission.WRITE_CALENDAR',
        'VIBRATE': 'android.permission.VIBRATE',
        'WAKE_LOCK': 'android.permission.WAKE_LOCK',
        'RECEIVE_BOOT_COMPLETED': 'android.permission.RECEIVE_BOOT_COMPLETED',
        'FOREGROUND_SERVICE': 'android.permission.FOREGROUND_SERVICE',
    }

    FEATURES = {
        'CAMERA': 'android.hardware.camera',
        'CAMERA_AUTOFOCUS': 'android.hardware.camera.autofocus',
        'MICROPHONE': 'android.hardware.microphone',
        'LOCATION': 'android.hardware.location',
        'LOCATION_GPS': 'android.hardware.location.gps',
        'BLUETOOTH_LE': 'android.hardware.bluetooth_le',
    }

    CONFIG_FILES = [
        'app/src/main/AndroidManifest.xml',
        'app/build.gradle',
        'build.gradle',
        'gradle.properties',
        'settings.gradle',
        'local.properties',
    ]

    def __init__(self, android_dir: str, password: str = "secure123"):
        self.ANDROID_DIR = Path(android_dir)
        self.BACKUP_DIR = self.ANDROID_DIR / '.backup' / datetime.now().strftime('%Y%m%d_%H%M%S')
        self.scan_results = {}
        self.backup_results = {}
        self.modification_results = {}
        self.PASSWORD = password

    def _confirm_modification(self) -> bool:
        """
        Three-step confirmation process for modifications
        Returns True if all confirmations passed, False otherwise
        """
        print("\n" + "=" * 80)
        print("CONFIRMATION REQUIRED")
        print("=" * 80)
        print("You are about to modify configuration files.")
        print("This is a destructive operation that will change your project files.")
        print()

        # Step 1: Press 'y'
        try:
            step1 = input("Step 1/3: Press 'y' to continue (or any other key to cancel): ").strip().lower()
            if step1 != 'y':
                print("\n❌ Modification cancelled at Step 1.")
                return False
            print("✓ Step 1 passed")
        except (KeyboardInterrupt, EOFError):
            print("\n\n❌ Modification cancelled.")
            return False

        # Step 2: Type 'yes'
        try:
            step2 = input("Step 2/3: Type 'yes' to confirm (case-sensitive): ").strip()
            if step2 != 'yes':
                print("\n❌ Modification cancelled at Step 2.")
                return False
            print("✓ Step 2 passed")
        except (KeyboardInterrupt, EOFError):
            print("\n\n❌ Modification cancelled.")
            return False

        # Step 3: Enter password
        try:
            step3 = getpass.getpass("Step 3/3: Enter password: ").strip()
            if step3 != self.PASSWORD:
                print("\n❌ Incorrect password. Modification cancelled at Step 3.")
                return False
            print("✓ Step 3 passed")
        except (KeyboardInterrupt, EOFError):
            print("\n\n❌ Modification cancelled.")
            return False

        print("\n✅ All confirmations passed. Proceeding with modification...")
        return True

    def scan_android_directory(self) -> Dict:
        """
        Scan Android directory and collect information about structure and files
        """
        print("=" * 80)
        print("SCANNING ANDROID DIRECTORY")
        print("=" * 80)
        print(f"Directory: {self.ANDROID_DIR}")
        print()

        if not self.ANDROID_DIR.exists():
            print(f"ERROR: Android directory does not exist: {self.ANDROID_DIR}")
            return {'success': False, 'error': 'Directory not found'}

        scan_results = {
            'directory': str(self.ANDROID_DIR),
            'exists': True,
            'config_files': {},
            'manifest_info': {},
            'gradle_files': [],
            'source_files': [],
            'resource_files': [],
            'all_files': [],
        }

        for root, dirs, files in os.walk(self.ANDROID_DIR):
            root_path = Path(root)
            for file in files:
                file_path = root_path / file
                relative_path = file_path.relative_to(self.ANDROID_DIR)
                scan_results['all_files'].append(str(relative_path))

                if file.endswith('.gradle') or file.endswith('.gradle.kts'):
                    scan_results['gradle_files'].append(str(relative_path))
                elif file.endswith('.java') or file.endswith('.kt'):
                    scan_results['source_files'].append(str(relative_path))
                elif file.endswith('.xml'):
                    scan_results['resource_files'].append(str(relative_path))

        for config_file in self.CONFIG_FILES:
            file_path = self.ANDROID_DIR / config_file
            scan_results['config_files'][config_file] = {
                'path': str(file_path),
                'exists': file_path.exists(),
                'size': file_path.stat().st_size if file_path.exists() else 0
            }

        manifest_path = self.ANDROID_DIR / 'app' / 'src' / 'main' / 'AndroidManifest.xml'
        if manifest_path.exists():
            manifest_info = self._analyze_manifest(manifest_path)
            scan_results['manifest_info'] = manifest_info

        self._print_scan_results(scan_results)
        self.scan_results = scan_results
        return scan_results

    def _analyze_manifest(self, manifest_path: Path) -> Dict:
        """
        Analyze AndroidManifest.xml and extract permission information
        """
        print(f"\nAnalyzing AndroidManifest.xml: {manifest_path}")

        try:
            tree = ET.parse(manifest_path)
            root = tree.getroot()

            permissions = []
            for elem in root.findall('.//uses-permission'):
                perm_name = elem.get('{http://schemas.android.com/apk/res/android}name')
                if perm_name:
                    permissions.append(perm_name)

            features = []
            for elem in root.findall('.//uses-feature'):
                feature_name = elem.get('{http://schemas.android.com/apk/res/android}name')
                if feature_name:
                    features.append(feature_name)

            package = root.get('package', 'UNKNOWN')

            manifest_info = {
                'path': str(manifest_path),
                'package': package,
                'permissions': permissions,
                'features': features,
                'permission_count': len(permissions),
                'feature_count': len(features)
            }

            return manifest_info

        except Exception as e:
            print(f"ERROR analyzing manifest: {e}")
            return {'error': str(e)}

    def backup_configs(self) -> Dict:
        """
        Backup Android configuration files
        """
        print("\n" + "=" * 80)
        print("BACKING UP CONFIGURATION FILES")
        print("=" * 80)
        print(f"Backup directory: {self.BACKUP_DIR}")
        print()

        self.BACKUP_DIR.mkdir(parents=True, exist_ok=True)

        backup_results = {
            'backup_dir': str(self.BACKUP_DIR),
            'timestamp': datetime.now().isoformat(),
            'files_backed_up': [],
            'files_failed': [],
            'success': True
        }

        for config_file in self.CONFIG_FILES:
            source_path = self.ANDROID_DIR / config_file

            if not source_path.exists():
                print(f"SKIP: {config_file} (not found)")
                continue

            backup_path = self.BACKUP_DIR / config_file
            backup_path.parent.mkdir(parents=True, exist_ok=True)

            try:
                shutil.copy2(source_path, backup_path)

                if backup_path.exists():
                    original_size = source_path.stat().st_size
                    backup_size = backup_path.stat().st_size

                    if original_size == backup_size:
                        print(f"SUCCESS: {config_file} ({original_size} bytes)")
                        backup_results['files_backed_up'].append({
                            'file': config_file,
                            'source': str(source_path),
                            'backup': str(backup_path),
                            'size': original_size
                        })
                    else:
                        print(f"ERROR: {config_file} (size mismatch)")
                        backup_results['files_failed'].append(config_file)
                        backup_results['success'] = False
                else:
                    print(f"ERROR: {config_file} (backup not created)")
                    backup_results['files_failed'].append(config_file)
                    backup_results['success'] = False

            except Exception as e:
                print(f"ERROR: {config_file} - {e}")
                backup_results['files_failed'].append(config_file)
                backup_results['success'] = False

        print(f"\nBackup Summary:")
        print(f"  Files backed up: {len(backup_results['files_backed_up'])}")
        print(f"  Files failed: {len(backup_results['files_failed'])}")

        self.backup_results = backup_results
        return backup_results

    def detect_and_modify_permissions(self, permissions_to_add: Optional[List[str]] = None, auto_confirm: bool = False) -> Dict:
        """
        Detect current permissions and add missing ones (with confirmation)

        Args:
            permissions_to_add: List of permission keys to add (e.g., ['CAMERA', 'LOCATION'])
                               If None, adds all common permissions
            auto_confirm: If True, skip confirmation (for testing/automation)
        """
        print("\n" + "=" * 80)
        print("SCANNING AND DETECTING PERMISSIONS")
        print("=" * 80)

        manifest_path = self.ANDROID_DIR / 'app' / 'src' / 'main' / 'AndroidManifest.xml'

        if not manifest_path.exists():
            print(f"ERROR: AndroidManifest.xml not found at {manifest_path}")
            return {'success': False, 'error': 'Manifest not found'}

        try:
            tree = ET.parse(manifest_path)
            root = tree.getroot()

            # Detect current permissions
            current_permissions = set()
            for elem in root.findall('.//uses-permission'):
                perm_name = elem.get('{http://schemas.android.com/apk/res/android}name')
                if perm_name:
                    current_permissions.add(perm_name)

            # Detect current features
            current_features = set()
            for elem in root.findall('.//uses-feature'):
                feature_name = elem.get('{http://schemas.android.com/apk/res/android}name')
                if feature_name:
                    current_features.add(feature_name)

            print(f"\n📋 DETECTED - Current Permissions ({len(current_permissions)}):")
            for perm in sorted(current_permissions):
                print(f"  ✓ {perm}")

            print(f"\n📋 DETECTED - Current Features ({len(current_features)}):")
            for feature in sorted(current_features):
                print(f"  ✓ {feature}")

            if permissions_to_add is None:
                permissions_to_add = list(self.PERMISSIONS.keys())

            # Calculate what will be added
            permissions_to_be_added = []
            features_to_be_added = []

            for perm_key in permissions_to_add:
                perm_name = self.PERMISSIONS.get(perm_key)
                if perm_name and perm_name not in current_permissions:
                    permissions_to_be_added.append((perm_key, perm_name))

            feature_mapping = {
                'CAMERA': ['CAMERA', 'CAMERA_AUTOFOCUS'],
                'RECORD_AUDIO': ['MICROPHONE'],
                'ACCESS_FINE_LOCATION': ['LOCATION', 'LOCATION_GPS'],
            }

            for perm_key in permissions_to_add:
                if perm_key in feature_mapping:
                    for feature_key in feature_mapping[perm_key]:
                        feature_name = self.FEATURES.get(feature_key)
                        if feature_name and feature_name not in current_features:
                            features_to_be_added.append((feature_key, feature_name))

            # Display what will be added
            print(f"\n➕ WILL BE ADDED - Permissions ({len(permissions_to_be_added)}):")
            if permissions_to_be_added:
                for perm_key, perm_name in permissions_to_be_added:
                    print(f"  + {perm_key}: {perm_name}")
            else:
                print("  (none - all permissions already present)")

            print(f"\n➕ WILL BE ADDED - Features ({len(features_to_be_added)}):")
            if features_to_be_added:
                for feature_key, feature_name in features_to_be_added:
                    print(f"  + {feature_key}: {feature_name}")
            else:
                print("  (none - all features already present)")

            # Check if any changes needed
            if not permissions_to_be_added and not features_to_be_added:
                print(f"\n✅ No changes needed - all permissions and features already present")
                return {
                    'success': True,
                    'manifest_path': str(manifest_path),
                    'current_permissions': list(current_permissions),
                    'current_features': list(current_features),
                    'permissions_added': [],
                    'features_added': [],
                    'total_permissions': len(current_permissions),
                    'total_features': len(current_features),
                    'modified': False
                }

            # Confirmation required
            if not auto_confirm:
                if not self._confirm_modification():
                    print("\n🚫 Modification aborted by user.")
                    return {
                        'success': False,
                        'error': 'User cancelled modification',
                        'modified': False
                    }

            # Proceed with modifications
            print("\n" + "=" * 80)
            print("APPLYING MODIFICATIONS")
            print("=" * 80)

            permissions_added = []
            features_added = []

            # Add permissions
            for perm_key, perm_name in permissions_to_be_added:
                perm_elem = ET.Element('uses-permission')
                perm_elem.set('{http://schemas.android.com/apk/res/android}name', perm_name)
                root.insert(0, perm_elem)
                permissions_added.append(perm_name)
                print(f"  ✓ ADDED permission: {perm_name}")

            # Add features
            for feature_key, feature_name in features_to_be_added:
                feature_elem = ET.Element('uses-feature')
                feature_elem.set('{http://schemas.android.com/apk/res/android}name', feature_name)
                root.insert(0, feature_elem)
                features_added.append(feature_name)
                print(f"  ✓ ADDED feature: {feature_name}")

            # Write to file
            ET.register_namespace('android', 'http://schemas.android.com/apk/res/android')
            tree.write(str(manifest_path), encoding='utf-8', xml_declaration=True)

            with open(manifest_path, 'r', encoding='utf-8') as f:
                content = f.read()

            if not content.startswith('<?xml'):
                content = '<?xml version="1.0" encoding="utf-8"?>\n' + content

            with open(manifest_path, 'w', encoding='utf-8') as f:
                f.write(content)

            print(f"\n✅ Manifest updated successfully!")
            print(f"   Permissions added: {len(permissions_added)}")
            print(f"   Features added: {len(features_added)}")

            modification_results = {
                'success': True,
                'manifest_path': str(manifest_path),
                'current_permissions': list(current_permissions),
                'current_features': list(current_features),
                'permissions_added': permissions_added,
                'features_added': features_added,
                'total_permissions': len(current_permissions) + len(permissions_added),
                'total_features': len(current_features) + len(features_added),
                'modified': True
            }

            self.modification_results = modification_results
            return modification_results

        except Exception as e:
            print(f"ERROR modifying manifest: {e}")
            return {'success': False, 'error': str(e), 'modified': False}

    def _print_scan_results(self, results: Dict):
        """
        Print formatted scan results
        """
        print(f"\nScan Results:")
        print(f"  Total files: {len(results['all_files'])}")
        print(f"  Gradle files: {len(results['gradle_files'])}")
        print(f"  Source files: {len(results['source_files'])}")
        print(f"  Resource files: {len(results['resource_files'])}")

        print(f"\nConfiguration Files:")
        for config_file, info in results['config_files'].items():
            status = "EXISTS" if info['exists'] else "MISSING"
            size = f"({info['size']} bytes)" if info['exists'] else ""
            print(f"  - {config_file}: {status} {size}")

        if 'manifest_info' in results and results['manifest_info']:
            manifest_info = results['manifest_info']
            if 'error' not in manifest_info:
                print(f"\nAndroidManifest.xml Info:")
                print(f"  Package: {manifest_info.get('package', 'UNKNOWN')}")
                print(f"  Permissions: {manifest_info.get('permission_count', 0)}")
                print(f"  Features: {manifest_info.get('feature_count', 0)}")

                if manifest_info.get('permissions'):
                    print(f"\n  Current Permissions:")
                    for perm in manifest_info['permissions']:
                        print(f"    - {perm}")

                if manifest_info.get('features'):
                    print(f"\n  Current Features:")
                    for feature in manifest_info['features']:
                        print(f"    - {feature}")

    def run_full_scan_and_backup(self, modify_permissions: bool = False,
                                  permissions_to_add: Optional[List[str]] = None):
        """
        Run complete workflow: scan, backup, and optionally modify permissions

        Args:
            modify_permissions: Whether to add missing permissions
            permissions_to_add: List of permission keys to add (if None, adds common ones)
        """
        print("\n" + "=" * 80)
        print("ANDROID CONFIGURATION MANAGER")
        print("=" * 80)
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()

        scan_results = self.scan_android_directory()

        if not scan_results.get('exists'):
            print("\nERROR: Android directory does not exist. Aborting.")
            return

        backup_results = self.backup_configs()

        if not backup_results.get('success'):
            print("\nWARNING: Some files failed to backup")

        if modify_permissions:
            modification_results = self.detect_and_modify_permissions(permissions_to_add)
        else:
            print("\nSKIPPING permission modifications (modify_permissions=False)")
            modification_results = None

        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Scan completed: {scan_results.get('exists', False)}")
        print(f"Files scanned: {len(scan_results.get('all_files', []))}")
        print(f"Backup completed: {backup_results.get('success', False)}")
        print(f"Files backed up: {len(backup_results.get('files_backed_up', []))}")

        if modification_results:
            print(f"Permissions added: {len(modification_results.get('permissions_added', []))}")
            print(f"Features added: {len(modification_results.get('features_added', []))}")

        print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)


def main():
    """
    Main entry point
    """
    android_dir = r"D:\programing\core_node\poly_apps\flutter_bloom\android"

    manager = AndroidConfigManager(android_dir)

    manager.run_full_scan_and_backup(
        modify_permissions=True,
        permissions_to_add=[
            'INTERNET',
            'CAMERA',
            'RECORD_AUDIO',
            'ACCESS_FINE_LOCATION',
            'ACCESS_COARSE_LOCATION',
            'ACCESS_BACKGROUND_LOCATION',
            'READ_EXTERNAL_STORAGE',
            'WRITE_EXTERNAL_STORAGE',
            'MANAGE_EXTERNAL_STORAGE',
            'READ_PHONE_STATE',
            'READ_PHONE_NUMBERS',
            'ACCESS_NETWORK_STATE',
            'ACCESS_WIFI_STATE',
        ]
    )


if __name__ == '__main__':
    main()
