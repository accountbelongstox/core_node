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
Secure Project Copier
Handles secure copying of Flutter project to build directory according to requirements
"""

import os
import shutil
import sys
from datetime import datetime
from typing import Optional

class SecureProjectCopier:
    """Handles secure project copying for build isolation"""
    
    def __init__(self, source_project_dir: str):
        self.source_project_dir = source_project_dir
        self.build_base_dir = r"D:\programing\.build_dir"
        self.compile_factory_dir = os.path.join(self.build_base_dir, "compile_factory")
        self.final_working_dir = None
        self.copy_stats = {
            'total_files': 0,
            'total_dirs': 0,
            'skipped_files': 0,
            'total_size': 0
        }
        
    def _should_skip_path(self, path: str) -> bool:
        """Check if a path should be skipped during copying"""
        skip_patterns = [
            '.dart_tool',
            'build',
            '.flutter-plugins',
            '.flutter-plugins-dependencies',
            '.packages',
            'pubspec.lock',
            '.metadata',
            '.cache',
            'node_modules',
            '.git',
            '.idea',
            '.vscode',
            '*.tmp',
            '*.temp'
        ]

        path_lower = path.lower()
        for pattern in skip_patterns:
            if pattern in path_lower or path_lower.endswith(pattern.replace('*', '')):
                return True
        return False

    def _print_progress(self, current_file: str, max_width: int = 80):
        """Print copy progress on the same line with width limit"""
        if len(current_file) > max_width - 20:
            # Truncate path to fit terminal width
            display_path = "..." + current_file[-(max_width - 23):]
        else:
            display_path = current_file

        # Print with carriage return to overwrite same line
        print(f"\r[COPY] {display_path}", end="", flush=True)

    def _copy_with_progress(self, src: str, dst: str):
        """Copy directory tree with progress display and statistics"""
        print(f"[INFO] Starting copy operation...")
        print(f"[INFO] Source: {src}")
        print(f"[INFO] Destination: {dst}")

        # Reset statistics
        self.copy_stats = {
            'total_files': 0,
            'total_dirs': 0,
            'skipped_files': 0,
            'total_size': 0
        }

        # Create destination directory
        os.makedirs(dst, exist_ok=True)

        # Walk through source directory
        for root, dirs, files in os.walk(src):
            # Filter out directories to skip
            dirs[:] = [d for d in dirs if not self._should_skip_path(os.path.join(root, d))]

            # Calculate relative path
            rel_path = os.path.relpath(root, src)
            if rel_path == '.':
                dst_dir = dst
            else:
                dst_dir = os.path.join(dst, rel_path)

            # Create directory if it doesn't exist
            if not os.path.exists(dst_dir):
                os.makedirs(dst_dir)
                self.copy_stats['total_dirs'] += 1

            # Copy files
            for file in files:
                src_file = os.path.join(root, file)
                dst_file = os.path.join(dst_dir, file)

                # Check if file should be skipped
                if self._should_skip_path(src_file):
                    self.copy_stats['skipped_files'] += 1
                    continue

                # Show progress
                self._print_progress(src_file)

                try:
                    # Copy file
                    shutil.copy2(src_file, dst_file)
                    self.copy_stats['total_files'] += 1

                    # Add to total size
                    if os.path.exists(src_file):
                        self.copy_stats['total_size'] += os.path.getsize(src_file)

                except Exception as e:
                    print(f"\n[WARNING] Failed to copy {src_file}: {str(e)}")
                    continue

        # Clear progress line and print completion
        print(f"\r{' ' * 80}\r", end="")  # Clear the line
        print(f"[SUCCESS] Copy operation completed")
        self._print_copy_statistics()

    def _print_copy_statistics(self):
        """Print copy operation statistics"""
        size_mb = self.copy_stats['total_size'] / (1024 * 1024)
        print(f"[STATS] Copy Statistics:")
        print(f"  Files copied: {self.copy_stats['total_files']}")
        print(f"  Directories created: {self.copy_stats['total_dirs']}")
        print(f"  Files skipped: {self.copy_stats['skipped_files']}")
        print(f"  Total size: {size_mb:.2f} MB")

    def create_secure_build_directory(self, app_name: str) -> str:
        """
        Create secure build directory according to requirements:
        Copy to D:\programing\.build_dir\compile_factory\{app_name}_{timestamp}
        """
        try:
            # Ensure base build directory exists
            if not os.path.exists(self.build_base_dir):
                os.makedirs(self.build_base_dir)
                print(f"[INFO] Created build base directory: {self.build_base_dir}")

            # Ensure compile_factory directory exists
            if not os.path.exists(self.compile_factory_dir):
                os.makedirs(self.compile_factory_dir)
                print(f"[INFO] Created compile factory directory: {self.compile_factory_dir}")

            # Create timestamped directory name inside compile_factory
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            build_dir_name = f"{app_name}_{timestamp}"
            self.final_working_dir = os.path.join(self.compile_factory_dir, build_dir_name)

            print(f"[INFO] Creating secure build directory: {self.final_working_dir}")

            # Remove existing directory if it exists
            if os.path.exists(self.final_working_dir):
                print(f"[WARNING] Build directory already exists, removing: {self.final_working_dir}")
                shutil.rmtree(self.final_working_dir)

            # Copy project with progress display
            self._copy_with_progress(self.source_project_dir, self.final_working_dir)

            print(f"[SUCCESS] Project copied to: {self.final_working_dir}")
            return self.final_working_dir

        except Exception as e:
            print(f"[ERROR] Failed to create secure build directory: {str(e)}")
            raise
    
    def get_working_directory(self) -> Optional[str]:
        """Get the current working directory"""
        return self.final_working_dir
    
    def verify_project_structure(self) -> bool:
        """Verify that the copied project has the expected Flutter structure"""
        if not self.final_working_dir or not os.path.exists(self.final_working_dir):
            print(f"[ERROR] Working directory does not exist: {self.final_working_dir}")
            return False
        
        required_files = [
            "pubspec.yaml",
            "lib",
            "android",
            "web"
        ]
        
        missing_files = []
        for required_file in required_files:
            file_path = os.path.join(self.final_working_dir, required_file)
            if not os.path.exists(file_path):
                missing_files.append(required_file)
        
        if missing_files:
            print(f"[ERROR] Missing required files/directories: {', '.join(missing_files)}")
            return False
        
        print(f"[SUCCESS] Project structure verified")
        return True
    
    def cleanup_old_builds(self, keep_count: int = 5) -> None:
        """Clean up old build directories, keeping only the most recent ones"""
        try:
            if not os.path.exists(self.build_base_dir):
                return
            
            # Get all build directories
            build_dirs = []
            for item in os.listdir(self.build_base_dir):
                item_path = os.path.join(self.build_base_dir, item)
                if os.path.isdir(item_path) and '_' in item and item != "compile_factory":
                    # Check if it's a timestamped build directory
                    parts = item.split('_')
                    if len(parts) >= 2:
                        try:
                            # Try to parse timestamp
                            timestamp_str = '_'.join(parts[-2:])
                            datetime.strptime(timestamp_str, "%Y%m%d_%H%M%S")
                            build_dirs.append((item_path, os.path.getctime(item_path)))
                        except ValueError:
                            # Not a valid timestamp, skip
                            continue
            
            # Sort by creation time (newest first)
            build_dirs.sort(key=lambda x: x[1], reverse=True)
            
            # Remove old directories
            if len(build_dirs) > keep_count:
                for dir_path, _ in build_dirs[keep_count:]:
                    print(f"[INFO] Cleaning up old build directory: {dir_path}")
                    shutil.rmtree(dir_path)
                    
        except Exception as e:
            print(f"[WARNING] Failed to cleanup old builds: {str(e)}")
    
    def get_external_resources_directory(self) -> str:
        """Get external resources directory path"""
        return os.path.join(self.build_base_dir, "build_apps_static_resources")
    
    def ensure_external_resources_directory(self) -> str:
        """Ensure external resources directory exists"""
        external_dir = self.get_external_resources_directory()
        if not os.path.exists(external_dir):
            os.makedirs(external_dir)
            print(f"[INFO] Created external resources directory: {external_dir}")
        return external_dir
