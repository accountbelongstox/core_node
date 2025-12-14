#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Core Node Backup Manager
Provides backup and restore functionality for the core_node project
"""

import os
import sys
import shutil
import datetime
import json
import glob
import argparse
import time
from pathlib import Path
from typing import List, Dict, Set

# Simple color printing without external dependencies
class SimpleColors:
    """Lightweight color printing for terminal"""
    BLUE = '\033[94m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    GRAY = '\033[90m'
    RESET = '\033[0m'

    @staticmethod
    def print_color(message: str, color: str = ''):
        """Print colored message"""
        print(f"{color}{message}{SimpleColors.RESET}", flush=True)

    @staticmethod
    def blue(message: str):
        SimpleColors.print_color(message, SimpleColors.BLUE)

    @staticmethod
    def green(message: str):
        SimpleColors.print_color(message, SimpleColors.GREEN)

    @staticmethod
    def yellow(message: str):
        SimpleColors.print_color(message, SimpleColors.YELLOW)

    @staticmethod
    def red(message: str):
        SimpleColors.print_color(message, SimpleColors.RED)

    @staticmethod
    def gray(message: str):
        SimpleColors.print_color(message, SimpleColors.GRAY)

class BackupManager:
    def __init__(self):
        # Get the script directory and project root
        self.script_dir = Path(__file__).parent
        self.project_root = self.script_dir.parent.parent.parent.parent  # Go up to core_node
        self.backup_parent_dir = self.project_root.parent
        
        # Backup configuration
        self.backup_name_prefix = "core_node_bak"
        self.timestamp = ""
        self.backup_name = ""
        self.backup_path = None
        
        # Directories to skip during backup
        self.skip_dirs = {
            'node_modules', 'vendor', '__pycache__', '.pytest_cache',
            'build', 'dist', 'target', 'bin', 'obj', 'out',
            '.dart_tool', '.flutter-plugins', '.flutter-plugins-dependencies',
            '.nuxt', '.next', 'node_modules', 'vendor',
            'tmp', 'temp', 'cache', '.cache', '.tmp',
            'coverage', '.coverage', 'htmlcov',
            'logs', '.logs', 'log',
            '.idea', '.vscode', '.vs',
            'venv', 'env', '.venv', '.env',
            'site-packages', '.site-packages'
        }
        
        # File extensions to skip
        self.skip_extensions = {
            '.pyc', '.pyo', '.pyd', '.so', '.dll', '.exe',
            '.log', '.tmp', '.temp', '.cache', '.bak',
            '.swp', '.swo', '.swn', '.DS_Store', 'Thumbs.db',
            '.class', '.jar', '.war', '.ear',
            '.o', '.obj', '.a', '.lib', '.dylib',
            '.map', '.min.js', '.min.css',
            '.lock', '.pid'
        }
        
        # Windows reserved device names that cannot be created/copied on Windows
        self.windows_reserved_names = {
            'con', 'prn', 'aux', 'nul',
            'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
            'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'
        }
        
        # Compilation directories to skip
        self.compilation_dirs = {
            'dart', 'flutter', 'nuxt', 'vue', 'laravel',
            'angular', 'react', 'svelte', 'next',
            'build', 'dist', 'out', 'target', 'bin'
        }

    def show_main_menu(self):
        """Display the main backup menu (deprecated - use command line args)"""
        SimpleColors.yellow("Interactive menu mode is deprecated.")
        SimpleColors.yellow("Please use command line arguments:")
        SimpleColors.yellow("  --action backup    : Start backup")
        SimpleColors.yellow("  --action restore   : Restore backup")
        SimpleColors.yellow("  --action list      : List available backups")
        sys.exit(1)

    def refresh_backup_destination(self) -> None:
        """Generate a new timestamped backup path each time backup starts"""
        self.timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.backup_name = f"{self.backup_name_prefix}_{self.timestamp}"
        self.backup_path = self.backup_parent_dir / self.backup_name

    def start_backup(self):
        """Start the backup process (no user confirmation - handled by shell)"""
        self._perform_backup()

    def start_backup_auto(self):
        """Start the backup process (alias for compatibility)"""
        self._perform_backup()

    def _perform_backup(self):
        """Internal method to perform backup"""
        SimpleColors.blue(f"\nStarting backup of {self.project_root}")

        # Generate a fresh backup path
        self.refresh_backup_destination()
        SimpleColors.blue(f"Backup destination: {self.backup_path}")
        SimpleColors.blue(f"Timestamp: {self.timestamp}\n")
        
        try:
            # Create backup directory
            self.backup_path.mkdir(parents=True, exist_ok=True)
            
            # Create backup metadata
            metadata = {
                'backup_name': self.backup_name,
                'timestamp': self.timestamp,
                'source_path': str(self.project_root),
                'backup_path': str(self.backup_path),
                'created_at': datetime.datetime.now().isoformat(),
                'files_count': 0,
                'directories_count': 0
            }
            
            # Count total files first for progress display
            SimpleColors.blue("Scanning files for backup...")
            start_scan_time = time.time()
            total_files = 0
            total_size = 0
            for root, dirs, files in os.walk(self.project_root):
                dirs[:] = [d for d in dirs if not self.should_skip_directory(d)]
                for file in files:
                    if not self.should_skip_file(file):
                        total_files += 1
                        try:
                            file_path = Path(root) / file
                            total_size += file_path.stat().st_size
                        except:
                            pass

            scan_time = time.time() - start_scan_time
            total_size_mb = total_size / (1024 * 1024)
            SimpleColors.green(f"Scan completed in {scan_time:.2f}s")
            SimpleColors.green(f"Found {total_files} files ({total_size_mb:.2f} MB) to backup\n")

            # Start backup process
            SimpleColors.blue("=" * 60)
            SimpleColors.blue("Starting backup process...")
            SimpleColors.blue("=" * 60)

            start_backup_time = time.time()
            files_copied = 0
            dirs_created = 0
            bytes_copied = 0
            last_update_time = start_backup_time

            for root, dirs, files in os.walk(self.project_root):
                # Skip directories
                dirs[:] = [d for d in dirs if not self.should_skip_directory(d)]

                # Create relative path
                rel_path = Path(root).relative_to(self.project_root)
                if rel_path == Path('.'):
                    backup_dir = self.backup_path
                else:
                    backup_dir = self.backup_path / rel_path

                # Create directory if it doesn't exist
                if not backup_dir.exists():
                    backup_dir.mkdir(parents=True, exist_ok=True)
                    dirs_created += 1

                # Copy files
                for file in files:
                    if not self.should_skip_file(file):
                        src_file = Path(root) / file
                        dst_file = backup_dir / file

                        try:
                            file_size = src_file.stat().st_size
                            shutil.copy2(src_file, dst_file)
                            files_copied += 1
                            bytes_copied += file_size

                            # Update progress (every file or every 0.5 seconds)
                            current_time = time.time()
                            if current_time - last_update_time >= 0.5 or files_copied == total_files:
                                last_update_time = current_time

                                # Calculate progress
                                percentage = (files_copied / total_files * 100) if total_files > 0 else 0
                                elapsed_time = current_time - start_backup_time
                                speed = files_copied / elapsed_time if elapsed_time > 0 else 0
                                eta = (total_files - files_copied) / speed if speed > 0 else 0

                                # Format file path (truncate if too long)
                                file_rel_path = str(src_file.relative_to(self.project_root))
                                max_path_len = 50
                                if len(file_rel_path) > max_path_len:
                                    file_rel_path = "..." + file_rel_path[-(max_path_len-3):]

                                # Print progress line
                                progress_msg = f"Progress: [{files_copied}/{total_files}] {percentage:.1f}% | {file_rel_path}"
                                if eta < 3600:
                                    progress_msg += f" | ETA: {int(eta)}s"

                                # Use print with carriage return for updating same line
                                print(f"\r{progress_msg}".ljust(100), end='', flush=True)

                        except Exception as e:
                            print()  # New line before error
                            SimpleColors.red(f"Warning: Could not copy {src_file}: {e}")

            # Print final newline
            print()
            SimpleColors.blue("=" * 60)
            
            # Update metadata
            total_backup_time = time.time() - start_backup_time
            metadata['files_count'] = files_copied
            metadata['directories_count'] = dirs_created
            metadata['backup_duration_seconds'] = total_backup_time
            metadata['bytes_copied'] = bytes_copied

            # Save metadata
            metadata_file = self.backup_path / 'backup_metadata.json'
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)

            # Display summary
            SimpleColors.green(f"\nBackup completed successfully!")
            SimpleColors.blue("=" * 60)
            SimpleColors.green(f"Files copied:       {files_copied}")
            SimpleColors.green(f"Directories:        {dirs_created}")
            SimpleColors.green(f"Total size:         {bytes_copied / (1024 * 1024):.2f} MB")
            SimpleColors.green(f"Duration:           {total_backup_time:.2f}s")
            SimpleColors.green(f"Speed:              {files_copied / total_backup_time:.1f} files/s")
            SimpleColors.blue("=" * 60)
            SimpleColors.blue(f"Backup location:    {self.backup_path}")
            SimpleColors.blue("=" * 60)
            
        except Exception as e:
            SimpleColors.red(f"Error during backup: {e}")
            # Clean up failed backup
            if self.backup_path.exists():
                shutil.rmtree(self.backup_path)
                SimpleColors.yellow("Cleaned up failed backup directory.")

    def should_skip_directory(self, dir_name: str) -> bool:
        """Check if directory should be skipped"""
        name_lower = dir_name.lower()
        return (
            dir_name in self.skip_dirs or 
            dir_name in self.compilation_dirs or
            name_lower in self.windows_reserved_names or
            dir_name.startswith('.') and dir_name != '.git'
        )
    
    def should_skip_file(self, file_name: str) -> bool:
        """Check if file should be skipped"""
        file_path = Path(file_name)
        name_lower = file_path.name.lower()
        return (
            file_path.suffix.lower() in self.skip_extensions or
            name_lower in self.windows_reserved_names or
            file_name.startswith('.') and file_name not in ['.gitignore', '.gitattributes']
        )

    def list_backups(self):
        """List all available backups"""
        print("\nAvailable Backups:")
        print("-" * 50)
        
        backup_dirs = []
        for item in self.backup_parent_dir.iterdir():
            if item.is_dir() and item.name.startswith(self.backup_name_prefix):
                backup_dirs.append(item)
        
        if not backup_dirs:
            print("No backups found.")
            return
        
        # Sort by modification time (newest first)
        backup_dirs.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        
        for i, backup_dir in enumerate(backup_dirs, 1):
            # Try to get metadata
            metadata_file = backup_dir / 'backup_metadata.json'
            if metadata_file.exists():
                try:
                    with open(metadata_file, 'r', encoding='utf-8') as f:
                        metadata = json.load(f)
                    created_at = metadata.get('created_at', 'Unknown')
                    files_count = metadata.get('files_count', 'Unknown')
                    print(f"{i}. {backup_dir.name}")
                    print(f"   Created: {created_at}")
                    print(f"   Files: {files_count}")
                except:
                    print(f"{i}. {backup_dir.name} (metadata unavailable)")
            else:
                print(f"{i}. {backup_dir.name} (no metadata)")
            print()

    def restore_backup(self):
        """Restore from a backup"""
        print("\nAvailable Backups for Restoration:")
        print("-" * 50)
        
        backup_dirs = []
        for item in self.backup_parent_dir.iterdir():
            if item.is_dir() and item.name.startswith(self.backup_name_prefix):
                backup_dirs.append(item)
        
        if not backup_dirs:
            print("No backups found.")
            return
        
        # Sort by modification time (newest first)
        backup_dirs.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        
        for i, backup_dir in enumerate(backup_dirs, 1):
            print(f"{i}. {backup_dir.name}")
        
        print("0. Cancel")
        
        try:
            choice = int(input("\nSelect backup to restore (0 to cancel): "))
            if choice == 0:
                print("Restore cancelled.")
                return
            
            if 1 <= choice <= len(backup_dirs):
                selected_backup = backup_dirs[choice - 1]
                self.perform_restore(selected_backup)
            else:
                print("Invalid selection.")
        except ValueError:
            print("Invalid input. Please enter a number.")

    def perform_restore(self, backup_path: Path):
        """Perform the restore operation"""
        print(f"\nRestoring from: {backup_path}")
        
        # Load metadata if available
        metadata_file = backup_path / 'backup_metadata.json'
        metadata = {}
        if metadata_file.exists():
            try:
                with open(metadata_file, 'r', encoding='utf-8') as f:
                    metadata = json.load(f)
                print(f"Backup created: {metadata.get('created_at', 'Unknown')}")
                print(f"Files in backup: {metadata.get('files_count', 'Unknown')}")
            except:
                print("Could not read backup metadata.")
        
        # Confirm restore
        print(f"\nThis will restore files to: {self.project_root}")
        print("WARNING: This will only restore files that don't exist in the target directory.")
        print("Existing files will NOT be overwritten.")
        
        confirm = input("Do you want to proceed? (y/n): ").strip().lower()
        if confirm != 'y':
            print("Restore cancelled.")
            return
        
        try:
            files_restored = 0
            files_skipped = 0
            
            print("Scanning backup files...")
            for root, dirs, files in os.walk(backup_path):
                # Skip metadata file
                if 'backup_metadata.json' in files:
                    files.remove('backup_metadata.json')
                
                # Create relative path
                rel_path = Path(root).relative_to(backup_path)
                if rel_path == Path('.'):
                    target_dir = self.project_root
                else:
                    target_dir = self.project_root / rel_path
                
                # Create target directory if it doesn't exist
                if not target_dir.exists():
                    target_dir.mkdir(parents=True, exist_ok=True)
                
                # Restore files
                for file in files:
                    src_file = Path(root) / file
                    dst_file = target_dir / file
                    
                    # Only restore if target file doesn't exist
                    if not dst_file.exists():
                        try:
                            shutil.copy2(src_file, dst_file)
                            files_restored += 1
                            if files_restored % 50 == 0:
                                print(f"Restored {files_restored} files...")
                        except Exception as e:
                            print(f"Warning: Could not restore {src_file}: {e}")
                    else:
                        files_skipped += 1
                        # Comment: Cannot overwrite existing files for safety
                        # This ensures no data loss during restore operation
            
            print(f"\nRestore completed!")
            print(f"Files restored: {files_restored}")
            print(f"Files skipped (already exist): {files_skipped}")
            print("Note: Existing files were not overwritten for safety.")
            
        except Exception as e:
            print(f"Error during restore: {e}")

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Core Node Backup Manager')
    parser.add_argument('--action', choices=['backup', 'restore', 'list'],
                       required=True,
                       help='Action to perform: backup, restore, or list')

    args = parser.parse_args()

    try:
        manager = BackupManager()

        if args.action == 'backup':
            manager.start_backup()
        elif args.action == 'restore':
            manager.restore_backup()
        elif args.action == 'list':
            manager.list_backups()

    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user.")
        sys.exit(1)
    except Exception as e:
        SimpleColors.red(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
