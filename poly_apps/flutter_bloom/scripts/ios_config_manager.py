#!/usr/bin/env python3
"""
iOS Configuration Manager
Scans iOS directory, backs up configs, and manages iOS permissions/capabilities
"""

import os
import sys
import shutil
import getpass
import plistlib
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple


class IOSConfigManager:
    """
    Manages iOS configuration files and permissions
    """

    IOS_DIR = None
    BACKUP_DIR = None

    # iOS Info.plist permissions
    PERMISSIONS = {
        'CAMERA': {
            'key': 'NSCameraUsageDescription',
            'description': 'This app needs camera access to take photos'
        },
        'PHOTO_LIBRARY': {
            'key': 'NSPhotoLibraryUsageDescription',
            'description': 'This app needs access to your photo library'
        },
        'PHOTO_LIBRARY_ADD': {
            'key': 'NSPhotoLibraryAddUsageDescription',
            'description': 'This app needs to save photos to your library'
        },
        'MICROPHONE': {
            'key': 'NSMicrophoneUsageDescription',
            'description': 'This app needs microphone access to record audio'
        },
        'LOCATION_WHEN_IN_USE': {
            'key': 'NSLocationWhenInUseUsageDescription',
            'description': 'This app needs your location while using the app'
        },
        'LOCATION_ALWAYS': {
            'key': 'NSLocationAlwaysUsageDescription',
            'description': 'This app needs your location even when not in use'
        },
        'LOCATION_ALWAYS_AND_WHEN_IN_USE': {
            'key': 'NSLocationAlwaysAndWhenInUseUsageDescription',
            'description': 'This app needs your location always and when in use'
        },
        'CONTACTS': {
            'key': 'NSContactsUsageDescription',
            'description': 'This app needs access to your contacts'
        },
        'CALENDARS': {
            'key': 'NSCalendarsUsageDescription',
            'description': 'This app needs access to your calendar'
        },
        'REMINDERS': {
            'key': 'NSRemindersUsageDescription',
            'description': 'This app needs access to your reminders'
        },
        'MOTION': {
            'key': 'NSMotionUsageDescription',
            'description': 'This app needs access to motion and fitness data'
        },
        'SPEECH_RECOGNITION': {
            'key': 'NSSpeechRecognitionUsageDescription',
            'description': 'This app needs speech recognition'
        },
        'BLUETOOTH_ALWAYS': {
            'key': 'NSBluetoothAlwaysUsageDescription',
            'description': 'This app needs Bluetooth access'
        },
        'BLUETOOTH_PERIPHERAL': {
            'key': 'NSBluetoothPeripheralUsageDescription',
            'description': 'This app needs to connect to Bluetooth devices'
        },
        'MEDIA_LIBRARY': {
            'key': 'NSAppleMusicUsageDescription',
            'description': 'This app needs access to your media library'
        },
        'FACE_ID': {
            'key': 'NSFaceIDUsageDescription',
            'description': 'This app needs Face ID for authentication'
        },
        'SIRI': {
            'key': 'NSSiriUsageDescription',
            'description': 'This app needs Siri integration'
        },
        'LOCAL_NETWORK': {
            'key': 'NSLocalNetworkUsageDescription',
            'description': 'This app needs local network access'
        },
        'TRACKING': {
            'key': 'NSUserTrackingUsageDescription',
            'description': 'This app needs to track your activity'
        },
    }

    # Background modes
    BACKGROUND_MODES = [
        'audio',
        'location',
        'voip',
        'external-accessory',
        'bluetooth-central',
        'bluetooth-peripheral',
        'fetch',
        'remote-notification',
        'processing',
    ]

    CONFIG_FILES = [
        'Runner/Info.plist',
        'Podfile',
        'Podfile.lock',
        'Runner.xcodeproj/project.pbxproj',
        'Runner.xcworkspace/contents.xcworkspacedata',
    ]

    def __init__(self, ios_dir: str, password: str = "secure123"):
        self.IOS_DIR = Path(ios_dir)
        self.BACKUP_DIR = self.IOS_DIR / '.backup' / datetime.now().strftime('%Y%m%d_%H%M%S')
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

    def scan_ios_directory(self) -> Dict:
        """
        Scan iOS directory and collect information about structure and files
        """
        print("=" * 80)
        print("SCANNING IOS DIRECTORY")
        print("=" * 80)
        print(f"Directory: {self.IOS_DIR}")
        print()

        if not self.IOS_DIR.exists():
            print(f"ERROR: iOS directory does not exist: {self.IOS_DIR}")
            return {'success': False, 'error': 'Directory not found'}

        scan_results = {
            'directory': str(self.IOS_DIR),
            'exists': True,
            'config_files': {},
            'info_plist_info': {},
            'podfile_exists': False,
            'xcodeproj_files': [],
            'source_files': [],
            'all_files': [],
        }

        # Walk through iOS directory
        for root, dirs, files in os.walk(self.IOS_DIR):
            # Skip Pods directory
            if 'Pods' in root:
                continue

            root_path = Path(root)
            for file in files:
                file_path = root_path / file
                relative_path = file_path.relative_to(self.IOS_DIR)
                scan_results['all_files'].append(str(relative_path))

                if file.endswith('.xcodeproj'):
                    scan_results['xcodeproj_files'].append(str(relative_path))
                elif file.endswith(('.swift', '.m', '.h')):
                    scan_results['source_files'].append(str(relative_path))

        # Check config files
        for config_file in self.CONFIG_FILES:
            file_path = self.IOS_DIR / config_file
            scan_results['config_files'][config_file] = {
                'path': str(file_path),
                'exists': file_path.exists(),
                'size': file_path.stat().st_size if file_path.exists() else 0
            }

        # Analyze Info.plist
        info_plist_path = self.IOS_DIR / 'Runner' / 'Info.plist'
        if info_plist_path.exists():
            info_plist_info = self._analyze_info_plist(info_plist_path)
            scan_results['info_plist_info'] = info_plist_info

        # Check for Podfile
        podfile_path = self.IOS_DIR / 'Podfile'
        scan_results['podfile_exists'] = podfile_path.exists()

        self._print_scan_results(scan_results)
        self.scan_results = scan_results
        return scan_results

    def _analyze_info_plist(self, plist_path: Path) -> Dict:
        """
        Analyze Info.plist and extract permission information
        """
        print(f"\nAnalyzing Info.plist: {plist_path}")

        try:
            with open(plist_path, 'rb') as f:
                plist_data = plistlib.load(f)

            permissions = {}
            for perm_key, perm_info in self.PERMISSIONS.items():
                key = perm_info['key']
                if key in plist_data:
                    permissions[key] = plist_data[key]

            background_modes = plist_data.get('UIBackgroundModes', [])

            bundle_id = plist_data.get('CFBundleIdentifier', 'UNKNOWN')
            bundle_name = plist_data.get('CFBundleName', 'UNKNOWN')
            bundle_version = plist_data.get('CFBundleShortVersionString', 'UNKNOWN')

            info_plist_info = {
                'path': str(plist_path),
                'bundle_id': bundle_id,
                'bundle_name': bundle_name,
                'bundle_version': bundle_version,
                'permissions': permissions,
                'background_modes': background_modes,
                'permission_count': len(permissions),
                'background_mode_count': len(background_modes)
            }

            return info_plist_info

        except Exception as e:
            print(f"ERROR analyzing Info.plist: {e}")
            return {'error': str(e)}

    def backup_configs(self) -> Dict:
        """
        Backup iOS configuration files
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
            source_path = self.IOS_DIR / config_file

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
            permissions_to_add: List of permission keys to add (e.g., ['CAMERA', 'LOCATION_WHEN_IN_USE'])
                               If None, adds common permissions
            auto_confirm: If True, skip confirmation (for testing/automation)
        """
        print("\n" + "=" * 80)
        print("SCANNING AND DETECTING PERMISSIONS")
        print("=" * 80)

        info_plist_path = self.IOS_DIR / 'Runner' / 'Info.plist'

        if not info_plist_path.exists():
            print(f"ERROR: Info.plist not found at {info_plist_path}")
            return {'success': False, 'error': 'Info.plist not found'}

        try:
            with open(info_plist_path, 'rb') as f:
                plist_data = plistlib.load(f)

            # Get current permissions
            current_permissions = {}
            for perm_key, perm_info in self.PERMISSIONS.items():
                key = perm_info['key']
                if key in plist_data:
                    current_permissions[key] = plist_data[key]

            print(f"\n📋 DETECTED - Current Permissions ({len(current_permissions)}):")
            for key, value in sorted(current_permissions.items()):
                print(f"  ✓ {key}: {value}")

            # Default permissions to add
            if permissions_to_add is None:
                permissions_to_add = ['CAMERA', 'PHOTO_LIBRARY', 'MICROPHONE',
                                     'LOCATION_WHEN_IN_USE', 'CONTACTS']

            # Calculate what will be added
            permissions_to_be_added = []
            for perm_key in permissions_to_add:
                perm_info = self.PERMISSIONS.get(perm_key)
                if not perm_info:
                    continue

                key = perm_info['key']
                if key not in plist_data:
                    permissions_to_be_added.append({
                        'perm_key': perm_key,
                        'key': key,
                        'description': perm_info['description']
                    })

            # Display what will be added
            print(f"\n➕ WILL BE ADDED - Permissions ({len(permissions_to_be_added)}):")
            if permissions_to_be_added:
                for perm in permissions_to_be_added:
                    print(f"  + {perm['perm_key']}: {perm['key']}")
                    print(f"    Description: {perm['description']}")
            else:
                print("  (none - all permissions already present)")

            # Check if any changes needed
            if not permissions_to_be_added:
                print(f"\n✅ No changes needed - all permissions already present")
                return {
                    'success': True,
                    'info_plist_path': str(info_plist_path),
                    'current_permissions': list(current_permissions.keys()),
                    'permissions_added': [],
                    'total_permissions': len(current_permissions),
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

            # Add missing permissions
            for perm in permissions_to_be_added:
                plist_data[perm['key']] = perm['description']
                permissions_added.append({
                    'key': perm['key'],
                    'description': perm['description']
                })
                print(f"  ✓ ADDED permission: {perm['key']}")

            # Write back to file
            with open(info_plist_path, 'wb') as f:
                plistlib.dump(plist_data, f)

            print(f"\n✅ Info.plist updated successfully!")
            print(f"   Permissions added: {len(permissions_added)}")

            modification_results = {
                'success': True,
                'info_plist_path': str(info_plist_path),
                'current_permissions': list(current_permissions.keys()),
                'permissions_added': permissions_added,
                'total_permissions': len(current_permissions) + len(permissions_added),
                'modified': True
            }

            self.modification_results = modification_results
            return modification_results

        except Exception as e:
            print(f"ERROR modifying Info.plist: {e}")
            return {'success': False, 'error': str(e), 'modified': False}

    def add_background_modes(self, modes_to_add: Optional[List[str]] = None, auto_confirm: bool = False) -> Dict:
        """
        Add background modes to Info.plist (with confirmation)

        Args:
            modes_to_add: List of background modes to add
            auto_confirm: If True, skip confirmation (for testing/automation)
        """
        print("\n" + "=" * 80)
        print("SCANNING AND DETECTING BACKGROUND MODES")
        print("=" * 80)

        info_plist_path = self.IOS_DIR / 'Runner' / 'Info.plist'

        if not info_plist_path.exists():
            print(f"ERROR: Info.plist not found at {info_plist_path}")
            return {'success': False, 'error': 'Info.plist not found'}

        try:
            with open(info_plist_path, 'rb') as f:
                plist_data = plistlib.load(f)

            current_modes = plist_data.get('UIBackgroundModes', [])
            print(f"\n📋 DETECTED - Current Background Modes ({len(current_modes)}):")
            for mode in current_modes:
                print(f"  ✓ {mode}")

            if modes_to_add is None:
                modes_to_add = ['audio', 'location', 'fetch', 'remote-notification']

            # Calculate what will be added
            modes_to_be_added = []
            for mode in modes_to_add:
                if mode in self.BACKGROUND_MODES and mode not in current_modes:
                    modes_to_be_added.append(mode)

            # Display what will be added
            print(f"\n➕ WILL BE ADDED - Background Modes ({len(modes_to_be_added)}):")
            if modes_to_be_added:
                for mode in modes_to_be_added:
                    print(f"  + {mode}")
            else:
                print("  (none - all modes already present)")

            # Check if any changes needed
            if not modes_to_be_added:
                print(f"\n✅ No changes needed - all modes already present")
                return {
                    'success': True,
                    'modes_added': [],
                    'total_modes': len(current_modes),
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

            modes_added = []
            for mode in modes_to_be_added:
                current_modes.append(mode)
                modes_added.append(mode)
                print(f"  ✓ ADDED mode: {mode}")

            plist_data['UIBackgroundModes'] = current_modes
            with open(info_plist_path, 'wb') as f:
                plistlib.dump(plist_data, f)

            print(f"\n✅ Background modes updated successfully!")
            print(f"   Modes added: {len(modes_added)}")

            return {
                'success': True,
                'modes_added': modes_added,
                'total_modes': len(current_modes),
                'modified': True
            }

        except Exception as e:
            print(f"ERROR adding background modes: {e}")
            return {'success': False, 'error': str(e), 'modified': False}

    def _print_scan_results(self, results: Dict):
        """
        Print formatted scan results
        """
        print(f"\nScan Results:")
        print(f"  Total files: {len(results['all_files'])}")
        print(f"  Xcode project files: {len(results['xcodeproj_files'])}")
        print(f"  Source files: {len(results['source_files'])}")
        print(f"  Podfile exists: {results['podfile_exists']}")

        print(f"\nConfiguration Files:")
        for config_file, info in results['config_files'].items():
            status = "EXISTS" if info['exists'] else "MISSING"
            size = f"({info['size']} bytes)" if info['exists'] else ""
            print(f"  - {config_file}: {status} {size}")

        if 'info_plist_info' in results and results['info_plist_info']:
            info_plist_info = results['info_plist_info']
            if 'error' not in info_plist_info:
                print(f"\nInfo.plist Info:")
                print(f"  Bundle ID: {info_plist_info.get('bundle_id', 'UNKNOWN')}")
                print(f"  Bundle Name: {info_plist_info.get('bundle_name', 'UNKNOWN')}")
                print(f"  Version: {info_plist_info.get('bundle_version', 'UNKNOWN')}")
                print(f"  Permissions: {info_plist_info.get('permission_count', 0)}")
                print(f"  Background Modes: {info_plist_info.get('background_mode_count', 0)}")

                if info_plist_info.get('permissions'):
                    print(f"\n  Current Permissions:")
                    for key, value in info_plist_info['permissions'].items():
                        print(f"    - {key}: {value}")

                if info_plist_info.get('background_modes'):
                    print(f"\n  Current Background Modes:")
                    for mode in info_plist_info['background_modes']:
                        print(f"    - {mode}")

    def run_full_scan_and_backup(self, modify_permissions: bool = False,
                                  permissions_to_add: Optional[List[str]] = None,
                                  add_background_modes: bool = False,
                                  background_modes: Optional[List[str]] = None):
        """
        Run complete workflow: scan, backup, and optionally modify permissions

        Args:
            modify_permissions: Whether to add missing permissions
            permissions_to_add: List of permission keys to add (if None, adds common ones)
            add_background_modes: Whether to add background modes
            background_modes: List of background modes to add
        """
        print("\n" + "=" * 80)
        print("IOS CONFIGURATION MANAGER")
        print("=" * 80)
        print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print()

        # Scan directory
        scan_results = self.scan_ios_directory()

        if not scan_results.get('exists'):
            print("\nERROR: iOS directory does not exist. Aborting.")
            return

        # Backup configs
        backup_results = self.backup_configs()

        if not backup_results.get('success'):
            print("\nWARNING: Some files failed to backup")

        # Modify permissions if requested
        if modify_permissions:
            modification_results = self.detect_and_modify_permissions(permissions_to_add)
        else:
            print("\nSKIPPING permission modifications (modify_permissions=False)")
            modification_results = None

        # Add background modes if requested
        if add_background_modes:
            bg_mode_results = self.add_background_modes(background_modes)
        else:
            print("\nSKIPPING background mode additions (add_background_modes=False)")
            bg_mode_results = None

        # Print summary
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Scan completed: {scan_results.get('exists', False)}")
        print(f"Files scanned: {len(scan_results.get('all_files', []))}")
        print(f"Backup completed: {backup_results.get('success', False)}")
        print(f"Files backed up: {len(backup_results.get('files_backed_up', []))}")

        if modification_results:
            print(f"Permissions added: {len(modification_results.get('permissions_added', []))}")

        if bg_mode_results:
            print(f"Background modes added: {len(bg_mode_results.get('modes_added', []))}")

        print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 80)


def main():
    """
    Main entry point
    """
    ios_dir = r"D:\programing\core_node\poly_apps\flutter_bloom\ios"

    manager = IOSConfigManager(ios_dir)

    manager.run_full_scan_and_backup(
        modify_permissions=True,
        permissions_to_add=[
            'CAMERA',
            'PHOTO_LIBRARY',
            'PHOTO_LIBRARY_ADD',
            'MICROPHONE',
            'LOCATION_WHEN_IN_USE',
            'LOCATION_ALWAYS_AND_WHEN_IN_USE',
            'CONTACTS',
            'CALENDARS',
            'BLUETOOTH_ALWAYS',
            'LOCAL_NETWORK',
        ],
        add_background_modes=True,
        background_modes=[
            'audio',
            'location',
            'fetch',
            'remote-notification',
        ]
    )


if __name__ == '__main__':
    main()
