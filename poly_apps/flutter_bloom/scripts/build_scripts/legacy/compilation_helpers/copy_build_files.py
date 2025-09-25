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
Copy Build Files Back to Flutter Project

PURPOSE:
Copies modified configuration and build files from the build directory back to the original Flutter project.

SPECIFICATIONS FOLLOWED:
1. Flutter Build System Guidelines - Maintains proper file structure and permissions
2. Build Directory Architecture - Works with D:\programing\.build_dir\{appname} structure
3. Android Build Configuration - Preserves Gradle and manifest file integrity
4. File System Standards - Uses proper file copying with metadata preservation

FUNCTIONALITY:
- Copies modified build.gradle files with updated applicationId
- Transfers updated strings.xml with new app display names
- Handles AndroidManifest.xml modifications if present
- Preserves file timestamps and permissions during copy operations
- Creates destination directories automatically if they don't exist

FILE MAPPINGS:
- android/app/build.gradle -> android/app/build.gradle (Application ID changes)
- android/app/src/main/res/values/strings.xml -> android/app/src/main/res/values/strings.xml (Display name changes)
- android/app/src/main/AndroidManifest.xml -> android/app/src/main/AndroidManifest.xml (Manifest updates)

COMPLIANCE:
- Uses shutil.copy2() for proper metadata preservation
- Implements error handling for missing files or directories
- Provides detailed logging of copy operations
- Validates source files before attempting copy operations

INTEGRATION:
- Called as final step in run_all_helpers.py build pipeline
- Ensures all modifications are applied to the actual Flutter project
- Works with relative path mappings for flexibility
- Provides success/failure reporting for build process validation

TECHNICAL DETAILS:
- Handles Windows and Unix file path separators correctly
- Uses pathlib for cross-platform path operations
- Implements safe directory creation with parents=True
- Provides comprehensive error reporting and status updates

SAFETY FEATURES:
- Only copies files that exist in the build directory
- Creates destination directories safely
- Reports skipped files for debugging purposes
- Maintains original file structure and hierarchy
"""

import os
import shutil
import argparse
from pathlib import Path

class BuildFilesCopier:
    def __init__(self, flutter_root, build_cache_dir, appname):
        self.flutter_root = Path(flutter_root)
        self.build_cache_dir = Path(build_cache_dir)
        self.appname = appname
        self.build_dir = Path(build_cache_dir).parent / appname
        
        # Define file mappings (source -> destination)
        self.file_mappings = [
            # Android files
            ("android/app/build.gradle", "android/app/build.gradle"),
            ("android/app/src/main/res/values/strings.xml", "android/app/src/main/res/values/strings.xml"),
            ("android/app/src/main/AndroidManifest.xml", "android/app/src/main/AndroidManifest.xml"),
        ]
    
    def copy_file_if_exists(self, source_rel, dest_rel):
        """Copy a file from build directory to Flutter project if it exists"""
        source_path = self.build_dir / source_rel
        dest_path = self.flutter_root / dest_rel
        
        if source_path.exists():
            # Ensure destination directory exists
            dest_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Copy file
            shutil.copy2(source_path, dest_path)
            print(f"Copied: {source_rel} -> {dest_rel}")
            return True
        else:
            print(f"Skipped: {source_rel} (file not found in build directory)")
            return False
    
    def copy_all_files(self):
        """Copy all modified files back to Flutter project"""
        print(f"Copying build files from {self.build_dir} to {self.flutter_root}")
        print("-" * 60)
        
        copied_count = 0
        total_count = len(self.file_mappings)
        
        for source_rel, dest_rel in self.file_mappings:
            if self.copy_file_if_exists(source_rel, dest_rel):
                copied_count += 1
        
        print("-" * 60)
        print(f"Copy operation completed: {copied_count}/{total_count} files copied")
        return copied_count > 0

def print_specifications():
    """Print the specifications and standards this script follows"""
    print("=" * 80)
    print("BUILD FILES COPIER - SPECIFICATIONS")
    print("=" * 80)
    print("STANDARDS FOLLOWED:")
    print("• Flutter Build System Guidelines")
    print("• File System Safety and Integrity Standards")
    print("• FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md Guidelines")
    print("• Cross-Platform Path Handling")
    print("• Metadata Preservation Standards")
    print("")
    print("FILE OPERATIONS:")
    print("• build.gradle: Copies application ID modifications")
    print("• strings.xml: Transfers app display name changes")
    print("• AndroidManifest.xml: Applies manifest updates if present")
    print("• Metadata: Preserves timestamps and permissions (shutil.copy2)")
    print("• Directory Safety: Creates destination directories automatically")
    print("")
    print("SAFETY FEATURES:")
    print("• Source validation before copy operations")
    print("• Detailed operation logging and status reporting")
    print("• Graceful handling of missing source files")
    print("• Maintains original project structure integrity")
    print("=" * 80)

def main():
    print_specifications()
    
    parser = argparse.ArgumentParser(description='Copy build files back to Flutter project')
    parser.add_argument('--appname', required=True, help='App name')
    parser.add_argument('--flutter-root', required=True, help='Flutter project root directory')
    parser.add_argument('--build-cache-dir', required=True, help='Build cache directory')
    
    args = parser.parse_args()
    
    copier = BuildFilesCopier(args.flutter_root, args.build_cache_dir, args.appname)
    success = copier.copy_all_files()
    
    if success:
        print("Build files copy completed successfully")
        return 0
    else:
        print("No files were copied")
        return 1

if __name__ == "__main__":
    exit(main())