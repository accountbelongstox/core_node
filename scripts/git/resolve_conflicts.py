#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Git Conflict Intelligent Resolver
Automatically scan and resolve Git merge conflicts with smart local/remote version retention
"""

import os
import re
import shutil
import datetime
from pathlib import Path
from typing import List, Tuple, Dict, Optional
import argparse

class GitConflictResolver:
    def __init__(self, base_path: str = "../../", backup_dir: str = "../../tmp/git_merge"):
        self.base_path = Path(base_path).resolve()
        self.backup_dir = Path(backup_dir).resolve()
        self.script_path = Path(__file__).resolve()
        
        # Supported code file extensions
        self.code_extensions = {
            '.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c', '.h', '.hpp',
            '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.sh',
            '.bat', '.ps1', '.sql', '.html', '.css', '.scss', '.less', '.vue',
            '.json', '.xml', '.yaml', '.yml', '.md', '.txt', '.cfg', '.ini',
            '.toml', '.lock', '.gitignore', '.env'
        }
        
        # Directories to skip
        self.skip_dirs = {
            'node_modules', '.git', '__pycache__', '.vscode', '.idea', 
            'dist', 'build', 'target', 'bin', 'obj', '.next', 
            'coverage', '.nyc_output', 'logs', 'tmp', 'temp'
        }
        
        # Git conflict markers
        self.conflict_start = re.compile(r'^<{7}\s+(.*)$', re.MULTILINE)
        self.conflict_separator = re.compile(r'^={7}$', re.MULTILINE)
        self.conflict_end = re.compile(r'^>{7}\s+(.*)$', re.MULTILINE)
        
        # Statistics
        self.stats = {
            'scanned_files': 0,
            'conflict_files': 0,
            'resolved_files': 0,
            'backup_files': 0,
            'errors': 0
        }

    def ensure_backup_dir(self):
        """Ensure backup directory exists"""
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        
        # Create backup log file
        backup_log = self.backup_dir / "backup_log.txt"
        if not backup_log.exists():
            backup_log.write_text(f"Git Conflict Resolution Backup Log\nCreated: {datetime.datetime.now()}\n\n")

    def is_code_file(self, file_path: Path) -> bool:
        """Check if file is a code file"""
        return file_path.suffix.lower() in self.code_extensions

    def should_skip_dir(self, dir_path: Path) -> bool:
        """Check if directory should be skipped"""
        return dir_path.name in self.skip_dirs

    def should_skip_file(self, file_path: Path) -> bool:
        """Check if file should be skipped"""
        # Skip script itself
        if file_path.resolve() == self.script_path:
            return True
        
        # Skip files in backup directory
        try:
            file_path.resolve().relative_to(self.backup_dir)
            return True
        except ValueError:
            pass
        
        return False

    def scan_files(self) -> List[Path]:
        """Scan all code files"""
        files = []
        
        def scan_directory(directory: Path):
            try:
                for item in directory.iterdir():
                    if item.is_dir():
                        if not self.should_skip_dir(item):
                            scan_directory(item)
                    elif item.is_file():
                        if (self.is_code_file(item) and 
                            not self.should_skip_file(item)):
                            files.append(item)
                            self.stats['scanned_files'] += 1
            except (PermissionError, OSError) as e:
                print(f"Warning: Skipping directory {directory}: {e}")
                self.stats['errors'] += 1
        
        print(f"Scanning path: {self.base_path}")
        scan_directory(self.base_path)
        print(f"Scan complete, found {len(files)} code files")
        
        return files

    def detect_conflicts(self, file_path: Path) -> List[Dict]:
        """Detect Git conflicts in file"""
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
        except Exception as e:
            print(f"Warning: Failed to read file {file_path}: {e}")
            self.stats['errors'] += 1
            return []
        
        conflicts = []
        lines = content.split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i]
            
            # Detect conflict start marker
            start_match = self.conflict_start.match(line)
            if start_match:
                conflict_start_line = i
                local_branch = start_match.group(1).strip()
                
                # Find separator
                separator_line = None
                for j in range(i + 1, len(lines)):
                    if self.conflict_separator.match(lines[j]):
                        separator_line = j
                        break
                
                if separator_line is None:
                    i += 1
                    continue
                
                # Find conflict end marker
                end_line = None
                remote_branch = ""
                for j in range(separator_line + 1, len(lines)):
                    end_match = self.conflict_end.match(lines[j])
                    if end_match:
                        end_line = j
                        remote_branch = end_match.group(1).strip()
                        break
                
                if end_line is None:
                    i += 1
                    continue
                
                # Extract local and remote content
                local_content = '\n'.join(lines[conflict_start_line + 1:separator_line])
                remote_content = '\n'.join(lines[separator_line + 1:end_line])
                
                conflicts.append({
                    'start_line': conflict_start_line,
                    'separator_line': separator_line,
                    'end_line': end_line,
                    'local_branch': local_branch,
                    'remote_branch': remote_branch,
                    'local_content': local_content,
                    'remote_content': remote_content,
                    'full_conflict': '\n'.join(lines[conflict_start_line:end_line + 1])
                })
                
                i = end_line + 1
            else:
                i += 1
        
        return conflicts

    def resolve_conflict(self, conflict: Dict, prefer_local: bool = True) -> str:
        """Resolve single conflict, return resolved content"""
        if prefer_local:
            return conflict['local_content']
        else:
            return conflict['remote_content']

    def backup_file(self, file_path: Path) -> Path:
        """Backup file"""
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{file_path.name}.{timestamp}.backup"
        backup_path = self.backup_dir / backup_name
        
        shutil.copy2(file_path, backup_path)
        
        # Log to backup file
        backup_log = self.backup_dir / "backup_log.txt"
        with backup_log.open('a', encoding='utf-8') as f:
            f.write(f"{datetime.datetime.now()}: {file_path} -> {backup_path}\n")
        
        self.stats['backup_files'] += 1
        return backup_path

    def preview_resolution(self, file_path: Path, conflicts: List[Dict], prefer_local: bool = True) -> str:
        """Preview conflict resolution effect"""
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
        except Exception as e:
            return f"Failed to read file: {e}"
        
        lines = content.split('\n')
        resolved_lines = lines.copy()
        
        # Process conflicts from end to start to avoid line number changes
        for conflict in reversed(conflicts):
            resolved_content = self.resolve_conflict(conflict, prefer_local)
            
            # Replace conflict region
            resolved_lines[conflict['start_line']:conflict['end_line'] + 1] = resolved_content.split('\n')
        
        return '\n'.join(resolved_lines)

    def resolve_file_conflicts(self, file_path: Path, prefer_local: bool = True) -> bool:
        """Resolve all conflicts in file"""
        conflicts = self.detect_conflicts(file_path)
        
        if not conflicts:
            return False
        
        print(f"\nConflict file found: {file_path}")
        print(f"Number of conflicts: {len(conflicts)}")
        
        # Show conflict details
        for i, conflict in enumerate(conflicts, 1):
            print(f"\n--- Conflict {i} ---")
            print(f"Local branch ({conflict['local_branch']}):")
            print(f"  {conflict['local_content'][:100]}{'...' if len(conflict['local_content']) > 100 else ''}")
            print(f"Remote branch ({conflict['remote_branch']}):")
            print(f"  {conflict['remote_content'][:100]}{'...' if len(conflict['remote_content']) > 100 else ''}")
        
        # Preview resolution effect
        resolved_content = self.preview_resolution(file_path, conflicts, prefer_local)
        
        print(f"\nPreview resolution (keeping {'local' if prefer_local else 'remote'} version):")
        print("=" * 50)
        
        # Show partial preview content
        preview_lines = resolved_content.split('\n')
        for i, line in enumerate(preview_lines[:20]):  # Show first 20 lines
            print(f"{i+1:3d}: {line}")
        
        if len(preview_lines) > 20:
            print("    ... (more content)")
        
        print("=" * 50)
        
        # Ask user for confirmation
        while True:
            choice = input(f"\nApply this resolution? (Y/y=Yes, N/n=No, S/s=Switch to {'remote' if prefer_local else 'local'}): ").strip().lower()
            
            if choice in ['y', 'yes']:
                # Backup original file
                backup_path = self.backup_file(file_path)
                print(f"Backed up original file to: {backup_path}")
                
                # Write resolved content
                try:
                    file_path.write_text(resolved_content, encoding='utf-8')
                    print(f"Resolved conflicts: {file_path}")
                    self.stats['resolved_files'] += 1
                    return True
                except Exception as e:
                    print(f"Failed to write file: {e}")
                    self.stats['errors'] += 1
                    return False
                    
            elif choice in ['n', 'no']:
                print("Skipping this file")
                return False
                
            elif choice in ['s', 'switch']:
                # Switch retention strategy and re-preview
                prefer_local = not prefer_local
                resolved_content = self.preview_resolution(file_path, conflicts, prefer_local)
                
                print(f"\nSwitched preview (keeping {'local' if prefer_local else 'remote'} version):")
                print("=" * 50)
                
                preview_lines = resolved_content.split('\n')
                for i, line in enumerate(preview_lines[:20]):
                    print(f"{i+1:3d}: {line}")
                
                if len(preview_lines) > 20:
                    print("    ... (more content)")
                print("=" * 50)
                
            else:
                print("Invalid choice, please enter Y/N/S")

    def run(self, prefer_local: bool = True, auto_resolve: bool = False):
        """Run conflict resolver"""
        print("Git Conflict Intelligent Resolver Started")
        print(f"Scan path: {self.base_path}")
        print(f"Backup directory: {self.backup_dir}")
        print(f"Default strategy: Keep {'local' if prefer_local else 'remote'} version")
        
        # Ensure backup directory exists
        self.ensure_backup_dir()
        
        # Scan files
        files = self.scan_files()
        
        if not files:
            print("No code files found")
            return
        
        # Detect conflict files
        conflict_files = []
        for file_path in files:
            conflicts = self.detect_conflicts(file_path)
            if conflicts:
                conflict_files.append((file_path, conflicts))
                self.stats['conflict_files'] += 1
        
        if not conflict_files:
            print("No Git conflicts found")
            return
        
        print(f"\nFound {len(conflict_files)} conflict files:")
        for file_path, conflicts in conflict_files:
            print(f"  {file_path} ({len(conflicts)} conflicts)")
        
        if not auto_resolve:
            print(f"\nStarting to process conflict files...")
            
            for file_path, conflicts in conflict_files:
                try:
                    self.resolve_file_conflicts(file_path, prefer_local)
                except KeyboardInterrupt:
                    print("\nOperation interrupted by user")
                    break
                except Exception as e:
                    print(f"Error processing file {file_path}: {e}")
                    self.stats['errors'] += 1
        
        # Show statistics
        print(f"\nProcessing Complete Statistics:")
        print(f"  Scanned files: {self.stats['scanned_files']}")
        print(f"  Conflict files: {self.stats['conflict_files']}")
        print(f"  Resolved: {self.stats['resolved_files']}")
        print(f"  Backup files: {self.stats['backup_files']}")
        print(f"  Errors: {self.stats['errors']}")


def main():
    parser = argparse.ArgumentParser(description='Git Conflict Intelligent Resolver')
    parser.add_argument('--path', '-p', default='../../', 
                       help='Scan path (default: ../../)')
    parser.add_argument('--backup-dir', '-b', default='../../tmp/git_merge',
                       help='Backup directory (default: ../../tmp/git_merge)')
    parser.add_argument('--prefer-remote', '-r', action='store_true',
                       help='Default keep remote version (default keep local version)')
    parser.add_argument('--auto', '-a', action='store_true',
                       help='Auto resolve mode (no confirmation)')
    
    args = parser.parse_args()
    
    try:
        resolver = GitConflictResolver(
            base_path=args.path,
            backup_dir=args.backup_dir
        )
        
        resolver.run(
            prefer_local=not args.prefer_remote,
            auto_resolve=args.auto
        )
        
    except KeyboardInterrupt:
        print("\nProgram interrupted by user")
    except Exception as e:
        print(f"Program error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()