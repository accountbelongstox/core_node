#!/usr/bin/env python3
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

"""
AI Tools Backup and Restore Utility

This script provides backup and restore functionality for AI tools installed via npm.
Supports: Claude (@anthropic-ai/claude-code), Codex, and other npm-based AI tools.

Features:
- Backup npm global packages and binaries
- Automatic backup detection and smart prompts
- Restore from backups with error skipping
- Time-stamped backup management
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# Tool configuration mapping
TOOL_CONFIG = {
    'claude': {
        'npm_package': '@anthropic-ai/claude-code',
        'binary_name': 'claude',
        'display_name': 'Claude AI'
    },
    'codex': {
        'npm_package': '@openai/codex',  # Placeholder
        'binary_name': 'codex',
        'display_name': 'Codex AI'
    },
    'droid': {
        'npm_package': '@factory/droid',  # Placeholder
        'binary_name': 'droid',
        'display_name': 'Factory AI Droid'
    }
}


class AIToolBackupRestore:
    """Backup and restore manager for AI tools"""

    def __init__(self, tool_name: str, backup_root: Optional[Path] = None):
        self.tool_name = tool_name.lower()
        self.config = TOOL_CONFIG.get(self.tool_name)

        if not self.config:
            raise ValueError(f"Unknown tool: {tool_name}")

        # Setup paths
        script_dir = Path(__file__).parent.resolve()
        self.backup_root = backup_root or (script_dir / f'backups_{self.tool_name}')
        self.backup_root.mkdir(parents=True, exist_ok=True)

        # Get npm paths
        self.npm_global_prefix = self._get_npm_global_prefix()
        self.npm_global_modules = self._get_npm_global_modules()

    def _run_command(self, cmd: List[str], capture: bool = True) -> Tuple[int, str, str]:
        """Run a command and return exit code, stdout, stderr"""
        try:
            if capture:
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                return result.returncode, result.stdout, result.stderr
            else:
                result = subprocess.run(cmd, timeout=30)
                return result.returncode, "", ""
        except subprocess.TimeoutExpired:
            return 1, "", "Command timed out"
        except Exception as e:
            return 1, "", str(e)

    def _get_npm_global_prefix(self) -> Optional[Path]:
        """Get npm global prefix path"""
        code, stdout, _ = self._run_command(['npm', 'config', 'get', 'prefix'])
        if code == 0 and stdout.strip():
            return Path(stdout.strip())
        return None

    def _get_npm_global_modules(self) -> Optional[Path]:
        """Get npm global node_modules path"""
        if not self.npm_global_prefix:
            return None

        # Try different locations
        candidates = [
            self.npm_global_prefix / 'lib' / 'node_modules',  # Unix
            self.npm_global_prefix / 'node_modules',          # Windows
        ]

        for path in candidates:
            if path.exists():
                return path

        return None

    def _get_binary_path(self) -> Optional[Path]:
        """Get the binary path for the tool"""
        code, stdout, _ = self._run_command(['which', self.config['binary_name']])
        if code == 0 and stdout.strip():
            binary_path = Path(stdout.strip())
            if binary_path.exists():
                return binary_path.resolve()

        # Windows fallback
        code, stdout, _ = self._run_command(['where', self.config['binary_name']])
        if code == 0 and stdout.strip():
            binary_path = Path(stdout.strip().split('\n')[0])
            if binary_path.exists():
                return binary_path.resolve()

        return None

    def _get_package_path(self) -> Optional[Path]:
        """Get the npm package path"""
        if not self.npm_global_modules:
            return None

        package_path = self.npm_global_modules / self.config['npm_package']
        return package_path if package_path.exists() else None

    def _list_backups(self) -> List[Path]:
        """List all backups sorted by time (newest first)"""
        backups = []
        if self.backup_root.exists():
            for item in self.backup_root.iterdir():
                if item.is_dir() and item.name.startswith('backup_'):
                    backups.append(item)
        return sorted(backups, key=lambda x: x.name, reverse=True)

    def _copy_recursive(self, src: Path, dst: Path, skip_errors: bool = True) -> Tuple[int, int]:
        """
        Recursively copy files, skipping errors
        Returns: (success_count, error_count)
        """
        success_count = 0
        error_count = 0

        try:
            if src.is_file():
                dst.parent.mkdir(parents=True, exist_ok=True)
                try:
                    shutil.copy2(src, dst)
                    success_count += 1
                except Exception as e:
                    if not skip_errors:
                        raise
                    print(f"[WARNING] Failed to copy {src}: {e}")
                    error_count += 1
            elif src.is_dir():
                for item in src.rglob('*'):
                    if item.is_file():
                        rel_path = item.relative_to(src)
                        dst_file = dst / rel_path
                        dst_file.parent.mkdir(parents=True, exist_ok=True)
                        try:
                            shutil.copy2(item, dst_file)
                            success_count += 1
                        except Exception as e:
                            if not skip_errors:
                                raise
                            print(f"[WARNING] Failed to copy {item}: {e}")
                            error_count += 1
        except Exception as e:
            if not skip_errors:
                raise
            print(f"[ERROR] Copy operation failed: {e}")
            error_count += 1

        return success_count, error_count

    def backup(self, force: bool = False) -> bool:
        """
        Backup the tool
        force: If True, always backup. If False, prompt based on existing backups
        """
        print("=" * 80)
        print(f"[BACKUP] {self.config['display_name']}")
        print("=" * 80)
        print()

        # Check what exists
        binary_path = self._get_binary_path()
        package_path = self._get_package_path()

        if not binary_path and not package_path:
            print(f"[INFO] {self.config['display_name']} is not installed")
            return False

        # Check existing backups
        existing_backups = self._list_backups()
        existing_count = len(existing_backups)

        print(f"[INFO] Binary path: {binary_path or 'Not found'}")
        print(f"[INFO] Package path: {package_path or 'Not found'}")
        print(f"[INFO] Existing backups: {existing_count}")
        print()

        # Prompt for backup
        if not force:
            if existing_count == 0:
                # No backups yet - default to Yes
                response = input("No backups found. Create backup? (Y/n): ").strip().lower()
                should_backup = response != 'n'
            else:
                # Has backups - default to No
                print(f"[INFO] Latest backup: {existing_backups[0].name}")
                response = input("Backup already exists. Create new backup? (n/Y): ").strip().lower()
                should_backup = response == 'y'

            if not should_backup:
                print("[INFO] Backup skipped")
                return False

        # Create backup
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_dir = self.backup_root / f"backup_{timestamp}"
        backup_dir.mkdir(parents=True, exist_ok=True)

        print(f"[INFO] Creating backup at: {backup_dir}")
        print()

        total_success = 0
        total_errors = 0

        # Backup binary
        if binary_path:
            print(f"[INFO] Backing up binary: {binary_path}")
            binary_backup = backup_dir / 'bin' / binary_path.name
            success, errors = self._copy_recursive(binary_path, binary_backup)
            total_success += success
            total_errors += errors
            print(f"[SUCCESS] Binary backed up")

        # Backup package
        if package_path:
            print(f"[INFO] Backing up package: {package_path}")
            package_backup = backup_dir / 'node_modules' / self.config['npm_package']
            success, errors = self._copy_recursive(package_path, package_backup)
            total_success += success
            total_errors += errors
            print(f"[SUCCESS] Package backed up ({success} files)")

        # Save metadata
        metadata = {
            'tool': self.tool_name,
            'timestamp': timestamp,
            'binary_path': str(binary_path) if binary_path else None,
            'package_path': str(package_path) if package_path else None,
            'npm_global_prefix': str(self.npm_global_prefix) if self.npm_global_prefix else None,
            'npm_global_modules': str(self.npm_global_modules) if self.npm_global_modules else None,
            'files_backed_up': total_success,
            'errors': total_errors
        }

        metadata_file = backup_dir / 'metadata.json'
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)

        print()
        print("=" * 80)
        print(f"[SUCCESS] Backup completed")
        print(f"  Files backed up: {total_success}")
        print(f"  Errors: {total_errors}")
        print(f"  Location: {backup_dir}")
        print("=" * 80)

        return True

    def restore(self, backup_name: Optional[str] = None, force: bool = False) -> bool:
        """
        Restore from backup
        backup_name: Specific backup to restore, or None for latest
        force: If True, restore without prompt
        """
        print("=" * 80)
        print(f"[RESTORE] {self.config['display_name']}")
        print("=" * 80)
        print()

        # Find backup
        backups = self._list_backups()
        if not backups:
            print("[ERROR] No backups found")
            return False

        if backup_name:
            backup_dir = self.backup_root / backup_name
            if not backup_dir.exists():
                print(f"[ERROR] Backup not found: {backup_name}")
                return False
        else:
            backup_dir = backups[0]
            print(f"[INFO] Using latest backup: {backup_dir.name}")

        # Load metadata
        metadata_file = backup_dir / 'metadata.json'
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
            print(f"[INFO] Backup from: {metadata.get('timestamp')}")
            print(f"[INFO] Files: {metadata.get('files_backed_up', 0)}")
        else:
            metadata = {}

        print()

        # Prompt for restore
        if not force:
            response = input("Restore from this backup? (Y/n): ").strip().lower()
            if response == 'n':
                print("[INFO] Restore cancelled")
                return False

        print()
        print("[INFO] Starting restore...")
        print()

        total_success = 0
        total_errors = 0

        # Restore binary
        binary_backup = backup_dir / 'bin'
        if binary_backup.exists():
            original_binary_path = metadata.get('binary_path')
            if original_binary_path:
                print(f"[INFO] Restoring binary to: {original_binary_path}")
                for bin_file in binary_backup.iterdir():
                    if bin_file.is_file():
                        dst = Path(original_binary_path)
                        dst.parent.mkdir(parents=True, exist_ok=True)
                        success, errors = self._copy_recursive(bin_file, dst)
                        total_success += success
                        total_errors += errors
                        # Make executable
                        try:
                            dst.chmod(0o755)
                        except:
                            pass
                print(f"[SUCCESS] Binary restored")

        # Restore package
        package_backup = backup_dir / 'node_modules'
        if package_backup.exists() and self.npm_global_modules:
            print(f"[INFO] Restoring package to: {self.npm_global_modules}")
            for package in package_backup.iterdir():
                dst = self.npm_global_modules / package.name
                print(f"[INFO] Restoring {package.name}...")
                success, errors = self._copy_recursive(package, dst)
                total_success += success
                total_errors += errors
            print(f"[SUCCESS] Package restored ({total_success} files)")

        print()
        print("=" * 80)
        print(f"[SUCCESS] Restore completed")
        print(f"  Files restored: {total_success}")
        print(f"  Errors: {total_errors}")
        print("=" * 80)

        return True

    def list_backups(self):
        """List all available backups"""
        backups = self._list_backups()

        if not backups:
            print(f"[INFO] No backups found for {self.config['display_name']}")
            return

        print("=" * 80)
        print(f"[BACKUPS] {self.config['display_name']}")
        print("=" * 80)
        print()

        for i, backup in enumerate(backups, 1):
            metadata_file = backup / 'metadata.json'
            if metadata_file.exists():
                with open(metadata_file, 'r') as f:
                    metadata = json.load(f)
                files = metadata.get('files_backed_up', '?')
                timestamp = metadata.get('timestamp', backup.name)
            else:
                files = '?'
                timestamp = backup.name

            print(f"{i}. {backup.name}")
            print(f"   Timestamp: {timestamp}")
            print(f"   Files: {files}")
            print()


def check_tool_exists(tool_name: str) -> bool:
    """Check if a tool command exists"""
    config = TOOL_CONFIG.get(tool_name.lower())
    if not config:
        return False

    binary_name = config['binary_name']

    # Try which (Unix)
    code, _, _ = subprocess.run(
        ['which', binary_name],
        capture_output=True,
        timeout=5
    ).returncode, "", ""

    if code == 0:
        return True

    # Try where (Windows)
    try:
        code = subprocess.run(
            ['where', binary_name],
            capture_output=True,
            timeout=5
        ).returncode
        return code == 0
    except:
        return False


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="AI Tools Backup and Restore Utility"
    )
    parser.add_argument(
        'tool',
        choices=['claude', 'codex', 'droid'],
        help="Tool to backup/restore"
    )
    parser.add_argument(
        'action',
        choices=['backup', 'restore', 'list', 'check'],
        help="Action to perform"
    )
    parser.add_argument(
        '--backup-name',
        help="Specific backup to restore (for restore action)"
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help="Force action without prompts"
    )

    args = parser.parse_args()

    if args.action == 'check':
        exists = check_tool_exists(args.tool)
        print(f"[{'OK' if exists else 'NOT FOUND'}] {args.tool}")
        return 0 if exists else 1

    try:
        manager = AIToolBackupRestore(args.tool)

        if args.action == 'backup':
            success = manager.backup(force=args.force)
            return 0 if success else 1

        elif args.action == 'restore':
            success = manager.restore(
                backup_name=args.backup_name,
                force=args.force
            )
            return 0 if success else 1

        elif args.action == 'list':
            manager.list_backups()
            return 0

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
