#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Claude and @anthropic-ai Backup Manager

Backup and restore Claude CLI binary files and @anthropic-ai npm packages
with platform-aware handling.
"""

import os
import sys
import shutil
import platform
import subprocess
import json
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict

# Add pycore to Python path for imports
SCRIPT_DIR = Path(__file__).resolve().parent
CORE_NODE_DIR = SCRIPT_DIR.parent.parent.parent.parent
PYCORE_DIR = CORE_NODE_DIR / 'pycore'
sys.path.insert(0, str(PYCORE_DIR))

from pyfoundations.system_paths import map_web_path


def get_npm_global_root() -> Optional[Path]:
    """Get npm global node_modules directory"""
    try:
        result = subprocess.run(
            ['npm', 'root', '-g'],
            capture_output=True,
            text=True,
            check=True
        )
        npm_root = result.stdout.strip()
        return Path(npm_root) if npm_root else None
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("[!] Warning: npm not found or failed to get global root")
        return None


def get_claude_binary_paths() -> List[Path]:
    """Get Claude binary file paths based on platform"""
    claude_paths = []

    if platform.system() == 'Windows':
        # Windows: npm directory
        npm_dir = Path.home() / 'AppData' / 'Roaming' / 'npm'
        if npm_dir.exists():
            claude_paths.extend([
                npm_dir / 'claude',
                npm_dir / 'claude.cmd'
            ])
    else:
        # Linux/Mac: Find using 'which' command
        try:
            result = subprocess.run(
                ['which', 'claude'],
                capture_output=True,
                text=True,
                check=True
            )
            claude_path = result.stdout.strip()
            if claude_path:
                claude_paths.append(Path(claude_path))
        except (subprocess.CalledProcessError, FileNotFoundError):
            print("[!] Warning: claude command not found in PATH")

    # Filter to only existing files
    return [p for p in claude_paths if p.exists() and p.is_file()]


def get_anthropic_package_paths() -> List[Path]:
    """Get @anthropic-ai package directories from global node_modules"""
    npm_root = get_npm_global_root()
    if not npm_root or not npm_root.exists():
        return []

    anthropic_dir = npm_root / '@anthropic-ai'
    if not anthropic_dir.exists() or not anthropic_dir.is_dir():
        return []

    # Return all subdirectories in @anthropic-ai
    return [p for p in anthropic_dir.iterdir() if p.is_dir()]


def create_backup_dir() -> Path:
    """Create backup directory using map_web_path"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_namespace = f'claude_anthropic_{timestamp}'
    backup_dir = map_web_path('www', f'backups/{backup_namespace}')
    backup_dir.mkdir(parents=True, exist_ok=True)
    return backup_dir


def backup_files(source_paths: List[Path], backup_dir: Path, subdir: str) -> Dict[str, any]:
    """
    Backup files/directories to backup directory

    Args:
        source_paths: List of source file/directory paths
        backup_dir: Backup root directory
        subdir: Subdirectory name in backup (e.g., 'claude_binary', 'anthropic_packages')

    Returns:
        Dict with backup status
    """
    target_dir = backup_dir / subdir
    target_dir.mkdir(parents=True, exist_ok=True)

    backed_up = []
    failed = []

    for source in source_paths:
        try:
            if source.is_file():
                # Copy file
                target_file = target_dir / source.name
                shutil.copy2(str(source), str(target_file))
                backed_up.append(str(source))
                print(f"[+] Backed up: {source}")
            elif source.is_dir():
                # Copy directory recursively
                target_subdir = target_dir / source.name
                shutil.copytree(str(source), str(target_subdir), dirs_exist_ok=True)
                backed_up.append(str(source))
                print(f"[+] Backed up: {source}")
        except Exception as e:
            failed.append({'path': str(source), 'error': str(e)})
            print(f"[X] Failed to backup {source}: {e}")

    return {
        'backed_up': backed_up,
        'failed': failed
    }


def create_backup_archive(backup_dir: Path) -> Optional[Path]:
    """Create zip archive of backup directory"""
    archive_name = f'{backup_dir.name}.zip'
    archive_path = backup_dir.parent / archive_name

    try:
        shutil.make_archive(
            str(backup_dir),
            'zip',
            root_dir=str(backup_dir.parent),
            base_dir=backup_dir.name
        )
        print(f"[+] Created archive: {archive_path}")
        return archive_path
    except Exception as e:
        print(f"[X] Failed to create archive: {e}")
        return None


def save_backup_manifest(backup_dir: Path, manifest_data: Dict):
    """Save backup manifest JSON file"""
    manifest_file = backup_dir / 'backup_manifest.json'

    try:
        with open(manifest_file, 'w', encoding='utf-8') as f:
            json.dump(manifest_data, f, indent=2, ensure_ascii=False)
        print(f"[+] Saved manifest: {manifest_file}")
    except Exception as e:
        print(f"[X] Failed to save manifest: {e}")


def restore_from_backup(backup_path: Path) -> bool:
    """
    Restore from backup (recursively copy, skip errors)

    Args:
        backup_path: Path to backup directory or zip file

    Returns:
        bool: True if restore successful
    """
    # Extract if it's a zip file
    if backup_path.suffix == '.zip':
        extract_dir = backup_path.parent / backup_path.stem
        try:
            shutil.unpack_archive(str(backup_path), str(extract_dir))
            backup_path = extract_dir
            print(f"[+] Extracted archive to: {extract_dir}")
        except Exception as e:
            print(f"[X] Failed to extract archive: {e}")
            return False

    if not backup_path.is_dir():
        print(f"[X] Invalid backup directory: {backup_path}")
        return False

    # Read manifest
    manifest_file = backup_path / 'backup_manifest.json'
    if not manifest_file.exists():
        print(f"[X] Manifest file not found: {manifest_file}")
        return False

    try:
        with open(manifest_file, 'r', encoding='utf-8') as f:
            manifest = json.load(f)
    except Exception as e:
        print(f"[X] Failed to read manifest: {e}")
        return False

    # Restore Claude binaries
    claude_backup_dir = backup_path / 'claude_binary'
    if claude_backup_dir.exists():
        print("[*] Restoring Claude binaries...")
        for item in claude_backup_dir.iterdir():
            if platform.system() == 'Windows':
                target_dir = Path.home() / 'AppData' / 'Roaming' / 'npm'
            else:
                # For Linux, restore to /usr/local/bin or user's bin
                target_dir = Path('/usr/local/bin')
                if not os.access(target_dir, os.W_OK):
                    target_dir = Path.home() / 'bin'

            target_dir.mkdir(parents=True, exist_ok=True)
            target_file = target_dir / item.name

            try:
                shutil.copy2(str(item), str(target_file))
                print(f"[+] Restored: {target_file}")
            except Exception as e:
                print(f"[!] Warning: Failed to restore {item.name}: {e}")

    # Restore @anthropic-ai packages
    anthropic_backup_dir = backup_path / 'anthropic_packages'
    if anthropic_backup_dir.exists():
        print("[*] Restoring @anthropic-ai packages...")
        npm_root = get_npm_global_root()
        if npm_root:
            target_anthropic_dir = npm_root / '@anthropic-ai'
            target_anthropic_dir.mkdir(parents=True, exist_ok=True)

            for package_dir in anthropic_backup_dir.iterdir():
                if package_dir.is_dir():
                    target_package_dir = target_anthropic_dir / package_dir.name
                    try:
                        if target_package_dir.exists():
                            shutil.rmtree(str(target_package_dir))
                        shutil.copytree(str(package_dir), str(target_package_dir))
                        print(f"[+] Restored: {target_package_dir}")
                    except Exception as e:
                        print(f"[!] Warning: Failed to restore {package_dir.name}: {e}")

    print("[+] Restore completed!")
    return True


def open_directory_in_explorer(directory: Path):
    """Open directory in file explorer (platform-aware)"""
    if not directory.exists():
        print(f"[X] Directory does not exist: {directory}")
        return

    try:
        if platform.system() == 'Windows':
            # Windows: use explorer
            os.startfile(str(directory))
        elif platform.system() == 'Darwin':
            # macOS: use open
            subprocess.run(['open', str(directory)])
        else:
            # Linux: try xdg-open, nautilus, dolphin
            for cmd in ['xdg-open', 'nautilus', 'dolphin', 'thunar']:
                if shutil.which(cmd):
                    subprocess.run([cmd, str(directory)])
                    break
        print(f"[+] Opened directory: {directory}")
    except Exception as e:
        print(f"[!] Warning: Failed to open directory: {e}")
        print(f"[*] Backup directory: {directory}")


def perform_backup():
    """Perform backup operation"""
    print("=" * 60)
    print("  Claude and @anthropic-ai Backup Manager")
    print("=" * 60)
    print()

    # Get paths to backup
    print("[*] Detecting Claude binary files...")
    claude_paths = get_claude_binary_paths()
    if claude_paths:
        print(f"[+] Found {len(claude_paths)} Claude binary file(s)")
        for p in claude_paths:
            print(f"    - {p}")
    else:
        print("[!] No Claude binary files found")

    print()
    print("[*] Detecting @anthropic-ai packages...")
    anthropic_paths = get_anthropic_package_paths()
    if anthropic_paths:
        print(f"[+] Found {len(anthropic_paths)} @anthropic-ai package(s)")
        for p in anthropic_paths:
            print(f"    - {p.name}")
    else:
        print("[!] No @anthropic-ai packages found")

    if not claude_paths and not anthropic_paths:
        print("[X] Nothing to backup!")
        return

    print()
    confirm = input("Proceed with backup? (yes/no): ").strip().lower()
    if confirm not in ['yes', 'y']:
        print("[*] Backup cancelled")
        return

    # Create backup directory
    print()
    print("[*] Creating backup directory...")
    backup_dir = create_backup_dir()
    print(f"[+] Backup directory: {backup_dir}")

    # Backup Claude binaries
    claude_result = {'backed_up': [], 'failed': []}
    if claude_paths:
        print()
        print("[*] Backing up Claude binaries...")
        claude_result = backup_files(claude_paths, backup_dir, 'claude_binary')

    # Backup @anthropic-ai packages
    anthropic_result = {'backed_up': [], 'failed': []}
    if anthropic_paths:
        print()
        print("[*] Backing up @anthropic-ai packages...")
        anthropic_result = backup_files(anthropic_paths, backup_dir, 'anthropic_packages')

    # Create manifest
    manifest = {
        'backup_time': datetime.now().isoformat(),
        'platform': platform.system(),
        'platform_version': platform.release(),
        'claude_binaries': {
            'backed_up': claude_result['backed_up'],
            'failed': claude_result['failed']
        },
        'anthropic_packages': {
            'backed_up': anthropic_result['backed_up'],
            'failed': anthropic_result['failed']
        }
    }
    save_backup_manifest(backup_dir, manifest)

    # Create archive
    print()
    print("[*] Creating backup archive...")
    archive_path = create_backup_archive(backup_dir)

    # Summary
    print()
    print("=" * 60)
    print("  Backup Summary")
    print("=" * 60)
    print(f"Claude binaries backed up: {len(claude_result['backed_up'])}")
    print(f"@anthropic-ai packages backed up: {len(anthropic_result['backed_up'])}")
    if claude_result['failed'] or anthropic_result['failed']:
        print(f"Failed items: {len(claude_result['failed']) + len(anthropic_result['failed'])}")
    print(f"Backup directory: {backup_dir}")
    if archive_path:
        print(f"Archive: {archive_path}")
    print("=" * 60)

    # Open backup directory
    print()
    open_dir = input("Open backup directory? (yes/no): ").strip().lower()
    if open_dir in ['yes', 'y']:
        open_directory_in_explorer(backup_dir.parent)


def perform_restore():
    """Perform restore operation"""
    print("=" * 60)
    print("  Claude and @anthropic-ai Restore Manager")
    print("=" * 60)
    print()

    # Get backup directory
    backup_root = map_web_path('www', 'backups')
    if not backup_root.exists():
        print(f"[X] Backup root directory not found: {backup_root}")
        return

    # List available backups
    backups = []
    for item in backup_root.iterdir():
        if item.is_dir() and item.name.startswith('claude_anthropic_'):
            backups.append(item)
        elif item.is_file() and item.suffix == '.zip' and item.stem.startswith('claude_anthropic_'):
            backups.append(item)

    if not backups:
        print(f"[X] No backups found in: {backup_root}")
        return

    backups.sort(reverse=True)

    print("Available backups:")
    for i, backup in enumerate(backups, 1):
        print(f"  {i}. {backup.name}")

    print()
    try:
        selection = int(input(f"Select backup to restore (1-{len(backups)}): "))
        if selection < 1 or selection > len(backups):
            print("[X] Invalid selection")
            return
    except ValueError:
        print("[X] Invalid input")
        return

    selected_backup = backups[selection - 1]

    print()
    print(f"[*] Selected backup: {selected_backup.name}")
    confirm = input("Proceed with restore? (yes/no): ").strip().lower()
    if confirm not in ['yes', 'y']:
        print("[*] Restore cancelled")
        return

    print()
    restore_from_backup(selected_backup)


def show_menu():
    """Show main menu"""
    while True:
        print()
        print("=" * 60)
        print("  Claude and @anthropic-ai Backup Manager")
        print("=" * 60)
        print("  1. Backup Claude and @anthropic-ai")
        print("  2. Restore from backup")
        print("  3. Exit")
        print("=" * 60)

        choice = input("Select option (1-3): ").strip()

        if choice == '1':
            perform_backup()
        elif choice == '2':
            perform_restore()
        elif choice == '3':
            print("[*] Exiting...")
            break
        else:
            print("[!] Invalid option")


if __name__ == '__main__':
    try:
        show_menu()
    except KeyboardInterrupt:
        print("\n[*] Interrupted by user")
    except Exception as e:
        print(f"[X] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
