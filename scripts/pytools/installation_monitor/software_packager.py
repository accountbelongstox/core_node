"""
Software Packager
Exports monitored software files and registry to a package directory
"""

import os
import shutil
import subprocess
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime

from utils import load_json, save_json, format_size, create_timestamp_dir
from config import EXPORT_BASE_DIR, DEFAULT_SOFTWARE_NAME


class SoftwarePackager:
    """Package software files and registry from monitoring session"""

    def __init__(self, session_dir: Path):
        """
        Initialize software packager

        Args:
            session_dir: Directory containing monitoring session results
        """
        self.session_dir = Path(session_dir)
        self.session_info = None
        self.fs_changes = None
        self.reg_changes = None
        self.load_session_data()

    def load_session_data(self) -> None:
        """Load session data from files"""
        # Load session info
        session_info_file = self.session_dir / "session_info.json"
        if session_info_file.exists():
            self.session_info = load_json(session_info_file)

        # Load filesystem changes
        fs_file = self.session_dir / "filesystem_changes.json"
        if fs_file.exists():
            self.fs_changes = load_json(fs_file)

        # Load registry changes
        reg_file = self.session_dir / "registry_changes.json"
        if reg_file.exists():
            self.reg_changes = load_json(reg_file)

    def get_software_name(self) -> str:
        """Get software name from session info"""
        if self.session_info:
            return self.session_info.get('software_name', DEFAULT_SOFTWARE_NAME)
        return DEFAULT_SOFTWARE_NAME

    def create_export_directory(self) -> Path:
        """
        Create export directory

        Returns:
            Path to export directory
        """
        software_name = self.get_software_name()
        EXPORT_BASE_DIR.mkdir(parents=True, exist_ok=True)

        export_dir = create_timestamp_dir(EXPORT_BASE_DIR, software_name)

        return export_dir

    def export_files(self, export_dir: Path, max_file_size: int = 100 * 1024 * 1024) -> Dict[str, Any]:
        """
        Export files from monitoring session

        Args:
            export_dir: Export directory
            max_file_size: Maximum file size to copy (bytes)

        Returns:
            Export statistics
        """
        if not self.fs_changes:
            return {"status": "no_changes", "files_copied": 0}

        files_dir = export_dir / "files"
        files_dir.mkdir(exist_ok=True)

        stats = {
            "files_copied": 0,
            "files_skipped": 0,
            "total_size": 0,
            "errors": []
        }

        print("\nExporting files...")

        changes = self.fs_changes.get('changes', {})

        for directory, items in changes.items():
            for item in items:
                path_str = item.get('path')
                if not path_str:
                    continue

                src_path = Path(path_str)

                # Skip if doesn't exist
                if not src_path.exists():
                    stats['files_skipped'] += 1
                    continue

                # Skip directories (we'll create them as needed)
                if src_path.is_dir():
                    continue

                # Skip large files
                try:
                    file_size = src_path.stat().st_size
                    if file_size > max_file_size:
                        stats['files_skipped'] += 1
                        stats['errors'].append(f"Skipped (too large): {src_path}")
                        continue
                except Exception as e:
                    stats['errors'].append(f"Error checking {src_path}: {e}")
                    continue

                # Create destination path maintaining structure
                try:
                    # Create relative path from drive root
                    if src_path.is_absolute():
                        # Get drive letter and path
                        parts = src_path.parts
                        drive = parts[0].replace(':', '').replace('\\', '')
                        rel_parts = parts[1:]

                        dest_path = files_dir / drive
                        for part in rel_parts:
                            dest_path = dest_path / part

                        # Create parent directories
                        dest_path.parent.mkdir(parents=True, exist_ok=True)

                        # Copy file
                        shutil.copy2(src_path, dest_path)

                        stats['files_copied'] += 1
                        stats['total_size'] += file_size

                        if stats['files_copied'] % 10 == 0:
                            print(f"  Copied {stats['files_copied']} files...")

                except Exception as e:
                    stats['errors'].append(f"Error copying {src_path}: {e}")
                    stats['files_skipped'] += 1

        print(f"\nFiles copied: {stats['files_copied']}")
        print(f"Total size: {format_size(stats['total_size'])}")

        if stats['errors']:
            print(f"Errors: {len(stats['errors'])}")

        return stats

    def export_registry(self, export_dir: Path) -> Dict[str, Any]:
        """
        Export registry from monitoring session

        Args:
            export_dir: Export directory

        Returns:
            Export statistics
        """
        registry_exports_dir = self.session_dir / "registry_exports"

        if not registry_exports_dir.exists():
            return {"status": "no_registry_exports", "keys_exported": 0}

        dest_registry_dir = export_dir / "registry"
        dest_registry_dir.mkdir(exist_ok=True)

        stats = {
            "keys_exported": 0,
            "errors": []
        }

        print("\nExporting registry...")

        try:
            # Copy all registry export files
            for reg_file in registry_exports_dir.glob("*.reg"):
                try:
                    shutil.copy2(reg_file, dest_registry_dir / reg_file.name)
                    stats['keys_exported'] += 1
                except Exception as e:
                    stats['errors'].append(f"Error copying {reg_file.name}: {e}")

        except Exception as e:
            stats['errors'].append(f"Error accessing registry exports: {e}")

        print(f"Registry keys exported: {stats['keys_exported']}")

        return stats

    def export_session_data(self, export_dir: Path) -> None:
        """
        Export session metadata

        Args:
            export_dir: Export directory
        """
        # Copy all JSON files
        for json_file in self.session_dir.glob("*.json"):
            try:
                shutil.copy2(json_file, export_dir / json_file.name)
            except Exception as e:
                print(f"Warning: Could not copy {json_file.name}: {e}")

    def create_package(self) -> Path:
        """
        Create complete software package

        Returns:
            Path to created package directory
        """
        print("\n" + "=" * 80)
        print("CREATING SOFTWARE PACKAGE")
        print("=" * 80)

        # Create export directory
        export_dir = self.create_export_directory()
        print(f"\nPackage directory: {export_dir}")

        # Export files
        file_stats = self.export_files(export_dir)

        # Export registry
        reg_stats = self.export_registry(export_dir)

        # Export session data
        self.export_session_data(export_dir)

        # Create package summary
        package_info = {
            "software_name": self.get_software_name(),
            "package_created": datetime.now().isoformat(),
            "source_session": str(self.session_dir),
            "file_stats": file_stats,
            "registry_stats": reg_stats
        }

        save_json(package_info, export_dir / "package_info.json")

        print("\n" + "=" * 80)
        print("PACKAGE CREATED")
        print("=" * 80)
        print(f"\nLocation: {export_dir}")
        print(f"Files copied: {file_stats.get('files_copied', 0)}")
        print(f"Registry keys: {reg_stats.get('keys_exported', 0)}")
        print("\n")

        return export_dir


def package_software(session_dir: Path) -> Path:
    """
    Package software from monitoring session

    Args:
        session_dir: Directory containing monitoring session

    Returns:
        Path to package directory
    """
    packager = SoftwarePackager(session_dir)
    return packager.create_package()
