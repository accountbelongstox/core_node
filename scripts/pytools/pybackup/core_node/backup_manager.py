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
from pathlib import Path
from typing import List, Dict, Set

# Add pycore to path for imports
script_dir = Path(__file__).parent  # scripts/pytools/pybackup/core_node
project_root = script_dir.parent.parent.parent.parent  # core_node root

# Ensure both the project root (for the pycore package) and the pycore
# directory itself are on sys.path so imports resolve correctly when run
# from PowerShell/Windows entrypoints.
sys.path.insert(0, str(project_root))
pycore_path = project_root / "pycore"
sys.path.insert(0, str(pycore_path))

from pyfoundations.color_print import ColorPrint

class BackupManager:
    def __init__(self):
        # Get the script directory and project root
        self.script_dir = Path(__file__).parent
        self.project_root = self.script_dir.parent.parent.parent.parent  # Go up to core_node
        self.backup_parent_dir = self.project_root.parent
        
        # Backup configuration
        self.backup_name_prefix = "core_node_bak"
        self.timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.backup_name = f"{self.backup_name_prefix}_{self.timestamp}"
        self.backup_path = self.backup_parent_dir / self.backup_name
        
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
        
        # Compilation directories to skip
        self.compilation_dirs = {
            'dart', 'flutter', 'nuxt', 'vue', 'laravel',
            'angular', 'react', 'svelte', 'next',
            'build', 'dist', 'out', 'target', 'bin'
        }

    def show_main_menu(self):
        """Display the main backup menu"""
        while True:
            print("\n" + "="*50)
            print("Core Node Backup Manager")
            print("="*50)
            print("1. Start Backup")
            print("2. Restore Backup")
            print("3. List Available Backups")
            print("4. Exit")
            print("="*50)
            
            choice = input("Please select an option (1-4): ").strip()
            
            if choice == '1':
                self.start_backup()
            elif choice == '2':
                self.restore_backup()
            elif choice == '3':
                self.list_backups()
            elif choice == '4':
                print("Exiting...")
                break
            else:
                print("Invalid option. Please try again.")

    def start_backup(self):
        """Start the backup process"""
        ColorPrint.blue(f"\nStarting backup of {self.project_root}")
        ColorPrint.blue(f"Backup will be saved to: {self.backup_path}")
        
        # Print skip information
        ColorPrint.yellow("\nSkipping the following directories and files:")
        ColorPrint.gray("Directories: " + ", ".join(sorted(self.skip_dirs)))
        ColorPrint.gray("File extensions: " + ", ".join(sorted(self.skip_extensions)))
        ColorPrint.gray("Compilation directories: " + ", ".join(sorted(self.compilation_dirs)))
        ColorPrint.gray("Note: .git directory will be included")
        
        # Confirm backup
        confirm = input("\nDo you want to proceed? (y/n): ").strip().lower()
        if confirm != 'y':
            ColorPrint.red("Backup cancelled.")
            return
        
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
            ColorPrint.blue("Scanning files for backup...")
            total_files = 0
            for root, dirs, files in os.walk(self.project_root):
                dirs[:] = [d for d in dirs if not self.should_skip_directory(d)]
                for file in files:
                    if not self.should_skip_file(file):
                        total_files += 1
            
            ColorPrint.green(f"Found {total_files} files to backup")
            
            # Start backup process
            files_copied = 0
            dirs_created = 0
            
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
                            shutil.copy2(src_file, dst_file)
                            files_copied += 1
                            
                            # Real-time progress with file path
                            progress = f"[{files_copied}/{total_files}]"
                            file_path = str(src_file.relative_to(self.project_root))
                            ColorPrint.print_progress(files_copied, total_files, f"Copying: {file_path}")
                            
                        except Exception as e:
                            ColorPrint.red(f"Warning: Could not copy {src_file}: {e}")
            
            # Update metadata
            metadata['files_count'] = files_copied
            metadata['directories_count'] = dirs_created
            
            # Save metadata
            metadata_file = self.backup_path / 'backup_metadata.json'
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            ColorPrint.green(f"\nBackup completed successfully!")
            ColorPrint.green(f"Files copied: {files_copied}")
            ColorPrint.green(f"Directories created: {dirs_created}")
            ColorPrint.green(f"Backup location: {self.backup_path}")
            
        except Exception as e:
            ColorPrint.red(f"Error during backup: {e}")
            # Clean up failed backup
            if self.backup_path.exists():
                shutil.rmtree(self.backup_path)
                ColorPrint.yellow("Cleaned up failed backup directory.")

    def should_skip_directory(self, dir_name: str) -> bool:
        """Check if directory should be skipped"""
        return (dir_name in self.skip_dirs or 
                dir_name in self.compilation_dirs or
                dir_name.startswith('.') and dir_name != '.git')

    def should_skip_file(self, file_name: str) -> bool:
        """Check if file should be skipped"""
        file_path = Path(file_name)
        return (file_path.suffix.lower() in self.skip_extensions or
                file_name.startswith('.') and file_name not in ['.gitignore', '.gitattributes'])

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
    try:
        manager = BackupManager()
        manager.show_main_menu()
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user.")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
