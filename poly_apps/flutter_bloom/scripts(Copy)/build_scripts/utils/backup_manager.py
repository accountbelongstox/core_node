#!/usr/bin/env python3
"""
Backup Manager
Unified backup system for Flutter build system - manages file backups with proper directory structure
"""

import os
import shutil
from pathlib import Path
from typing import Optional, Union
from datetime import datetime

from utils.print_helper import PrintHelper


class BackupManager:
    """
    Unified backup manager for Flutter build system.
    Backs up files to /.backup/android directory while preserving subdirectory structure.
    """

    def __init__(self, temp_build_root: Path):
        self.temp_build_root = Path(temp_build_root)
        self.backup_root = self.temp_build_root / ".backup"
        self.android_backup_dir = self.backup_root / "android"

        # Ensure backup directories exist
        self.android_backup_dir.mkdir(parents=True, exist_ok=True)

        PrintHelper.info(f"Backup manager initialized: {self.android_backup_dir}", source="BACKUP")

    def backup_android_file(self, target_file_path: Union[str, Path]) -> Optional[Path]:
        """
        Backup an Android platform file to /.backup/android/ preserving subdirectory structure.

        Args:
            target_file_path: Path to the file to backup (absolute path)

        Returns:
            Path to backup file if successful, None if failed
        """
        try:
            target_file = Path(target_file_path)

            if not target_file.exists():
                PrintHelper.warning(f"Target file does not exist, cannot backup: {target_file}", source="BACKUP")
                return None

            # Extract the relative path from temp_build_root/android/
            android_platform_dir = self.temp_build_root / "android"

            if not str(target_file).startswith(str(android_platform_dir)):
                PrintHelper.warning(f"File is not in Android platform directory: {target_file}", source="BACKUP")
                return None

            # Get relative path from android platform directory
            try:
                relative_path = target_file.relative_to(android_platform_dir)
            except ValueError:
                PrintHelper.error(f"Cannot determine relative path for: {target_file}", source="BACKUP")
                return None

            # Create backup path preserving subdirectory structure
            backup_file = self.android_backup_dir / relative_path

            # Ensure backup parent directory exists
            backup_file.parent.mkdir(parents=True, exist_ok=True)

            # Only backup if backup doesn't already exist
            if backup_file.exists():
                PrintHelper.info(f"Backup already exists: {backup_file.name}", source="BACKUP")
                return backup_file

            # Perform backup
            shutil.copy2(target_file, backup_file)

            # Verify backup was created
            if backup_file.exists():
                original_size = target_file.stat().st_size
                backup_size = backup_file.stat().st_size

                if original_size == backup_size:
                    PrintHelper.success(f"Backup created: {relative_path}", source="BACKUP")
                    PrintHelper.info(f"  Original: {target_file}", source="BACKUP")
                    PrintHelper.info(f"  Backup: {backup_file}", source="BACKUP")
                    return backup_file
                else:
                    PrintHelper.error(f"Backup size mismatch: {original_size} vs {backup_size}", source="BACKUP")
                    return None
            else:
                PrintHelper.error(f"Backup file was not created: {backup_file}", source="BACKUP")
                return None

        except Exception as e:
            PrintHelper.error(f"Failed to backup file {target_file_path}: {e}", source="BACKUP")
            return None

    def restore_android_file(self, target_file_path: Union[str, Path]) -> bool:
        """
        Restore an Android platform file from backup.

        Args:
            target_file_path: Path to the file to restore (absolute path)

        Returns:
            True if restored successfully, False if failed
        """
        try:
            target_file = Path(target_file_path)

            # Extract the relative path from temp_build_root/android/
            android_platform_dir = self.temp_build_root / "android"

            if not str(target_file).startswith(str(android_platform_dir)):
                PrintHelper.warning(f"File is not in Android platform directory: {target_file}", source="BACKUP")
                return False

            # Get relative path from android platform directory
            try:
                relative_path = target_file.relative_to(android_platform_dir)
            except ValueError:
                PrintHelper.error(f"Cannot determine relative path for: {target_file}", source="BACKUP")
                return False

            # Find backup file
            backup_file = self.android_backup_dir / relative_path

            if not backup_file.exists():
                PrintHelper.warning(f"Backup file does not exist: {backup_file}", source="BACKUP")
                return False

            # Restore from backup
            shutil.copy2(backup_file, target_file)

            # Verify restoration
            if target_file.exists():
                PrintHelper.success(f"Restored from backup: {relative_path}", source="BACKUP")
                return True
            else:
                PrintHelper.error(f"Failed to restore file: {target_file}", source="BACKUP")
                return False

        except Exception as e:
            PrintHelper.error(f"Failed to restore file {target_file_path}: {e}", source="BACKUP")
            return False

    def list_android_backups(self) -> list:
        """
        List all Android platform backups.

        Returns:
            List of relative paths to backed up files
        """
        try:
            if not self.android_backup_dir.exists():
                return []

            backup_files = []
            for file_path in self.android_backup_dir.rglob("*"):
                if file_path.is_file():
                    relative_path = file_path.relative_to(self.android_backup_dir)
                    backup_files.append(str(relative_path))

            return sorted(backup_files)

        except Exception as e:
            PrintHelper.error(f"Failed to list backups: {e}", source="BACKUP")
            return []

    def cleanup_android_backups(self) -> bool:
        """
        Clean up all Android platform backups.

        Returns:
            True if cleanup successful, False if failed
        """
        try:
            if not self.android_backup_dir.exists():
                PrintHelper.info("No Android backups to clean up", source="BACKUP")
                return True

            backup_count = len(list(self.android_backup_dir.rglob("*")))

            shutil.rmtree(self.android_backup_dir)
            self.android_backup_dir.mkdir(parents=True, exist_ok=True)

            PrintHelper.success(f"Cleaned up {backup_count} Android backup files", source="BACKUP")
            return True

        except Exception as e:
            PrintHelper.error(f"Failed to cleanup backups: {e}", source="BACKUP")
            return False

    def get_backup_summary(self) -> dict:
        """
        Get summary of backup status.

        Returns:
            Dictionary containing backup statistics
        """
        try:
            backup_files = self.list_android_backups()
            total_size = 0

            for backup_file in backup_files:
                full_path = self.android_backup_dir / backup_file
                if full_path.exists():
                    total_size += full_path.stat().st_size

            return {
                'backup_count': len(backup_files),
                'total_size_bytes': total_size,
                'total_size_mb': round(total_size / (1024 * 1024), 2),
                'backup_directory': str(self.android_backup_dir),
                'files': backup_files
            }

        except Exception as e:
            PrintHelper.error(f"Failed to get backup summary: {e}", source="BACKUP")
            return {
                'backup_count': 0,
                'total_size_bytes': 0,
                'total_size_mb': 0,
                'backup_directory': str(self.android_backup_dir),
                'files': [],
                'error': str(e)
            }


def create_backup_manager(temp_build_root: Path) -> BackupManager:
    """
    Factory function to create a BackupManager instance.

    Args:
        temp_build_root: Path to temporary build directory

    Returns:
        BackupManager instance
    """
    return BackupManager(temp_build_root)