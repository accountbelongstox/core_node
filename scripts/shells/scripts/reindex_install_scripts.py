# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

#!/usr/bin/env python3
"""
Installation Scripts Reindexing Tool

This script automatically manages the index numbering of installation scripts
in the install_shells directory, allowing you to insert spacing for new scripts.

Usage:
    python reindex_install_scripts.py <target_index> [spacing]

Examples:
    python reindex_install_scripts.py 21        # Add 1 space after index 21
    python reindex_install_scripts.py 21 2      # Add 2 spaces after index 21
    python reindex_install_scripts.py 15 5      # Add 5 spaces after index 15
"""

import os
import sys
import re
import shutil
import argparse
from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Optional


class Colors:
    """ANSI color codes for terminal output"""
    RED = '\033[0;31m'
    GREEN = '\033[0;32m'
    YELLOW = '\033[1;33m'
    BLUE = '\033[0;34m'
    NC = '\033[0m'  # No Color


class ScriptReindexer:
    def __init__(self):
        self.script_dir = Path(__file__).parent
        self.install_shells_dir = self.script_dir.parent / "debian" / "install_shells"
        self.default_spacing = 1
        
    def print_colored(self, message: str, color: str = Colors.NC):
        """Print colored message to console"""
        print(f"{color}{message}{Colors.NC}")
        
    def extract_index(self, filename: str) -> Optional[str]:
        """Extract numeric index from filename"""
        match = re.match(r'^([0-9]+(?:_[0-9]+)?)_', filename)
        return match.group(1) if match else None
        
    def index_to_numeric(self, index: str) -> float:
        """Convert index format to numeric for comparison (e.g., '20_5' -> 20.5)"""
        return float(index.replace('_', '.'))
        
    def numeric_to_index(self, numeric: float) -> str:
        """Convert numeric back to index format (e.g., 20.5 -> '20_5')"""
        if numeric == int(numeric):
            return str(int(numeric))
        else:
            return str(numeric).replace('.', '_')
            
    def get_scripts_with_indices(self) -> List[Tuple[float, str, Path]]:
        """Get all installation scripts with their indices"""
        scripts = []
        
        if not self.install_shells_dir.exists():
            self.print_colored(f"Error: Directory {self.install_shells_dir} does not exist", Colors.RED)
            return scripts
            
        for file_path in self.install_shells_dir.glob("*.sh"):
            index = self.extract_index(file_path.name)
            if index:
                numeric_index = self.index_to_numeric(index)
                scripts.append((numeric_index, index, file_path))
                
        # Sort by numeric index
        scripts.sort(key=lambda x: x[0])
        return scripts
        
    def update_script_index(self, file_path: Path, old_index: str, new_index: str) -> bool:
        """Update SCRIPT_INDEX in file content"""
        self.print_colored(f"[UPDATE] Updating SCRIPT_INDEX in {file_path.name}", Colors.BLUE)
        self.print_colored(f"         {old_index} -> {new_index}", Colors.BLUE)
        
        try:
            # Read file content
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # Update SCRIPT_INDEX variable
            content = re.sub(
                f'SCRIPT_INDEX="{re.escape(old_index)}"',
                f'SCRIPT_INDEX="{new_index}"',
                content
            )
            
            # Also update any echo statements that might reference the index
            content = re.sub(
                f'\\[{re.escape(old_index)}\\]',
                f'[{new_index}]',
                content
            )
            
            # Write updated content
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
                
            self.print_colored(f"[SUCCESS] Updated SCRIPT_INDEX in {file_path.name}", Colors.GREEN)
            return True
            
        except Exception as e:
            self.print_colored(f"[ERROR] Failed to update {file_path.name}: {e}", Colors.RED)
            return False
            
    def rename_script_file(self, old_path: Path, old_index: str, new_index: str) -> Optional[Path]:
        """Rename script file with new index"""
        old_filename = old_path.name
        new_filename = re.sub(f'^{re.escape(old_index)}_', f'{new_index}_', old_filename)
        new_path = old_path.parent / new_filename
        
        self.print_colored(f"[RENAME] {old_filename} -> {new_filename}", Colors.BLUE)
        
        try:
            old_path.rename(new_path)
            self.print_colored("[SUCCESS] Renamed file successfully", Colors.GREEN)
            return new_path
        except Exception as e:
            self.print_colored(f"[ERROR] Failed to rename file: {e}", Colors.RED)
            return None
            
    def perform_reindex(self, target_index: str, spacing: int) -> bool:
        """Perform the reindexing operation"""
        target_numeric = self.index_to_numeric(target_index)
        scripts_info = self.get_scripts_with_indices()
        
        if not scripts_info:
            self.print_colored("[WARNING] No installation scripts found", Colors.YELLOW)
            return True
            
        self.print_colored(f"[INFO] Found {len(scripts_info)} installation scripts", Colors.BLUE)
        self.print_colored(f"[INFO] Target index: {target_index} (numeric: {target_numeric})", Colors.BLUE)
        self.print_colored(f"[INFO] Spacing: {spacing}", Colors.BLUE)
        print()
        
        # Display current scripts
        self.print_colored("[CURRENT] Current scripts:", Colors.BLUE)
        for numeric_index, index, file_path in scripts_info:
            self.print_colored(f"  {index} - {file_path.name}", Colors.BLUE)
        print()
        
        # Find scripts that need to be reindexed
        scripts_to_update = [
            (numeric_index, index, file_path)
            for numeric_index, index, file_path in scripts_info
            if numeric_index > target_numeric
        ]
        
        if not scripts_to_update:
            self.print_colored("[INFO] No scripts need to be reindexed", Colors.YELLOW)
            return True
            
        self.print_colored("[PLAN] Scripts to be reindexed:", Colors.YELLOW)
        for numeric_index, index, file_path in scripts_to_update:
            new_numeric = numeric_index + spacing
            new_index = self.numeric_to_index(new_numeric)
            self.print_colored(f"  {index} -> {new_index} ({file_path.name})", Colors.YELLOW)
        print()
        
        # Confirm with user
        try:
            response = input("Proceed with reindexing? (y/N): ").strip().lower()
            if response not in ['y', 'yes']:
                self.print_colored("[CANCELLED] Reindexing cancelled by user", Colors.YELLOW)
                return False
        except KeyboardInterrupt:
            self.print_colored("\n[CANCELLED] Reindexing cancelled by user", Colors.YELLOW)
            return False
            
        # Perform the reindexing (in reverse order to avoid conflicts)
        self.print_colored("[START] Starting reindexing process...", Colors.GREEN)
        updated_count = 0
        
        # Sort in reverse order to avoid naming conflicts
        scripts_to_update.sort(key=lambda x: x[0], reverse=True)
        
        for numeric_index, index, file_path in scripts_to_update:
            new_numeric = numeric_index + spacing
            new_index = self.numeric_to_index(new_numeric)
            
            self.print_colored(f"[PROCESSING] {file_path.name}", Colors.BLUE)
            
            # Update file content first
            if self.update_script_index(file_path, index, new_index):
                # Then rename the file
                new_path = self.rename_script_file(file_path, index, new_index)
                if new_path:
                    updated_count += 1
                    self.print_colored(f"[COMPLETE] Successfully updated {new_path.name}", Colors.GREEN)
                else:
                    self.print_colored(f"[ERROR] Failed to rename file for index {index}", Colors.RED)
            else:
                self.print_colored(f"[ERROR] Failed to update content for index {index}", Colors.RED)
            print()
            
        self.print_colored("[FINISHED] Reindexing completed!", Colors.GREEN)
        self.print_colored(f"[SUMMARY] Updated {updated_count} scripts", Colors.GREEN)
        
        return updated_count > 0
        
    def find_backup_files(self) -> List[Path]:
        """Find all backup files in the install_shells directory"""
        backup_files = []
        
        if not self.install_shells_dir.exists():
            return backup_files
            
        # Find files matching backup pattern: *.backup.YYYYMMDD_HHMMSS.sh
        backup_pattern = re.compile(r'.*\.backup\.\d{8}_\d{6}\.sh$')
        
        for file_path in self.install_shells_dir.iterdir():
            if file_path.is_file() and backup_pattern.match(file_path.name):
                backup_files.append(file_path)
                
        # Sort by modification time (newest first)
        backup_files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
        return backup_files
        
    def clean_backup_files(self) -> bool:
        """Clean up backup files with user confirmation"""
        backup_files = self.find_backup_files()
        
        if not backup_files:
            self.print_colored("[INFO] No backup files found to clean", Colors.YELLOW)
            return True
            
        self.print_colored(f"[FOUND] Found {len(backup_files)} backup files:", Colors.BLUE)
        
        # Group backups by original filename
        backup_groups = {}
        for backup_file in backup_files:
            # Extract original filename from backup name
            # Format: original_name.backup.YYYYMMDD_HHMMSS.sh
            match = re.match(r'(.+)\.backup\.\d{8}_\d{6}\.sh$', backup_file.name)
            if match:
                original_name = match.group(1) + '.sh'
                if original_name not in backup_groups:
                    backup_groups[original_name] = []
                backup_groups[original_name].append(backup_file)
        
        # Display backup files grouped by original
        for original_name, backups in backup_groups.items():
            self.print_colored(f"  {original_name}:", Colors.BLUE)
            for backup in sorted(backups, key=lambda x: x.stat().st_mtime, reverse=True):
                # Get file modification time
                mtime = datetime.fromtimestamp(backup.stat().st_mtime)
                size = backup.stat().st_size
                self.print_colored(f"    - {backup.name} ({size} bytes, {mtime.strftime('%Y-%m-%d %H:%M:%S')})", Colors.BLUE)
        
        print()
        
        # Confirm with user
        try:
            response = input("Do you want to delete all these backup files? (y/N): ").strip().lower()
            if response not in ['y', 'yes']:
                self.print_colored("[CANCELLED] Backup cleanup cancelled by user", Colors.YELLOW)
                return False
        except KeyboardInterrupt:
            self.print_colored("\n[CANCELLED] Backup cleanup cancelled by user", Colors.YELLOW)
            return False
            
        # Delete backup files
        self.print_colored("[START] Starting backup cleanup...", Colors.GREEN)
        deleted_count = 0
        failed_count = 0
        
        for backup_file in backup_files:
            try:
                backup_file.unlink()
                self.print_colored(f"[DELETED] {backup_file.name}", Colors.GREEN)
                deleted_count += 1
            except Exception as e:
                self.print_colored(f"[ERROR] Failed to delete {backup_file.name}: {e}", Colors.RED)
                failed_count += 1
                
        self.print_colored(f"[FINISHED] Backup cleanup completed!", Colors.GREEN)
        self.print_colored(f"[SUMMARY] Deleted: {deleted_count}, Failed: {failed_count}", Colors.GREEN)
        
        return failed_count == 0
        
    def show_usage(self):
        """Display usage information"""
        print("Usage: python reindex_install_scripts.py [target_index] [spacing]")
        print("       python reindex_install_scripts.py --clean-backups")
        print()
        print("Parameters:")
        print(f"  target_index     - Index after which to add spacing (required for reindexing)")
        print(f"  spacing          - Number of index positions to add (default: {self.default_spacing})")
        print(f"  --clean-backups  - Clean up backup files from previous runs")
        print()
        print("Examples:")
        print("  python reindex_install_scripts.py 21         - Add 1 space after index 21")
        print("  python reindex_install_scripts.py 21 2       - Add 2 spaces after index 21")
        print("  python reindex_install_scripts.py 15 5       - Add 5 spaces after index 15")
        print("  python reindex_install_scripts.py --clean-backups  - Clean up backup files")
        print()
        print("Reindexing will:")
        print(f"  1. Find all scripts in {self.install_shells_dir}")
        print("  2. Identify scripts with index > target_index")
        print("  3. Rename files and update SCRIPT_INDEX variables")
        print()
        print("Backup cleanup will:")
        print("  1. Find all backup files (*.backup.YYYYMMDD_HHMMSS.sh)")
        print("  2. Display them grouped by original filename")
        print("  3. Ask for confirmation before deletion")


def main():
    """Main function"""
    reindexer = ScriptReindexer()
    
    # Parse command line arguments
    parser = argparse.ArgumentParser(
        description="Reindex installation scripts with configurable spacing",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python reindex_install_scripts.py 21        # Add 1 space after index 21
  python reindex_install_scripts.py 21 2      # Add 2 spaces after index 21
  python reindex_install_scripts.py 15 5      # Add 5 spaces after index 15
        """
    )
    
    parser.add_argument(
        'target_index',
        nargs='?',
        help='Index after which to add spacing'
    )
    
    parser.add_argument(
        'spacing',
        type=int,
        nargs='?',
        default=reindexer.default_spacing,
        help=f'Number of index positions to add (default: {reindexer.default_spacing})'
    )
    
    parser.add_argument(
        '--clean-backups',
        action='store_true',
        help='Clean up backup files created by previous runs'
    )
    
    # Handle case where no arguments are provided
    if len(sys.argv) == 1:
        reindexer.show_usage()
        sys.exit(1)
        
    try:
        args = parser.parse_args()
    except SystemExit:
        sys.exit(1)
        
    # Display header
    reindexer.print_colored("=== Installation Scripts Reindexing Tool ===", Colors.BLUE)
    print()
    
    reindexer.print_colored(f"[CONFIG] Target directory: {reindexer.install_shells_dir}", Colors.BLUE)
    
    # Handle backup cleanup
    if args.clean_backups:
        print()
        try:
            success = reindexer.clean_backup_files()
            sys.exit(0 if success else 1)
        except KeyboardInterrupt:
            reindexer.print_colored("\n[CANCELLED] Operation cancelled by user", Colors.YELLOW)
            sys.exit(1)
        except Exception as e:
            reindexer.print_colored(f"[ERROR] Unexpected error: {e}", Colors.RED)
            sys.exit(1)
    
    # Validate arguments for reindexing
    if not args.target_index:
        reindexer.print_colored("[ERROR] Target index is required for reindexing", Colors.RED)
        reindexer.print_colored("[INFO] Use --clean-backups to clean up backup files", Colors.BLUE)
        sys.exit(1)
        
    if args.spacing < 1:
        reindexer.print_colored("[ERROR] Spacing must be a positive integer", Colors.RED)
        sys.exit(1)
    
    reindexer.print_colored(f"[CONFIG] Target index: {args.target_index}", Colors.BLUE)
    reindexer.print_colored(f"[CONFIG] Spacing: {args.spacing}", Colors.BLUE)
    print()
    
    # Perform reindexing
    try:
        success = reindexer.perform_reindex(args.target_index, args.spacing)
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        reindexer.print_colored("\n[CANCELLED] Operation cancelled by user", Colors.YELLOW)
        sys.exit(1)
    except Exception as e:
        reindexer.print_colored(f"[ERROR] Unexpected error: {e}", Colors.RED)
        sys.exit(1)


if __name__ == "__main__":
    main()