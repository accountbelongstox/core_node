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
Compilation Helper Scripts 4-7: Copy Platform-Specific Resources

This script copies platform-specific resources (iOS, macOS, web, Windows) from external assets
directory to their respective directories in the Flutter project.
"""

import argparse
import os
import shutil
import sys
from pathlib import Path
from typing import Dict, List

class PlatformResourcesCopier:
    def __init__(self, appname: str, external_assets_dir: str, flutter_root: str):
        self.appname = appname
        self.external_assets_dir = Path(external_assets_dir)
        self.flutter_root = Path(flutter_root)
        
        # Platform directories
        self.ios_dir = self.flutter_root / "ios"
        self.macos_dir = self.flutter_root / "macos"
        self.web_dir = self.flutter_root / "web"
        self.windows_dir = self.flutter_root / "windows"
        
    def _copy_files_recursive(self, src_dir: Path, dst_dir: Path) -> int:
        """Recursively copy files from source to destination directory"""
        if not src_dir.exists():
            return 0
        
        copied_count = 0
        
        for src_path in src_dir.rglob("*"):
            if src_path.is_file():
                # Calculate relative path
                rel_path = src_path.relative_to(src_dir)
                dst_path = dst_dir / rel_path
                
                # Create parent directories
                dst_path.parent.mkdir(parents=True, exist_ok=True)
                
                try:
                    shutil.copy2(src_path, dst_path)
                    print(f"  Copied: {rel_path}")
                    copied_count += 1
                except Exception as e:
                    print(f"  Error copying {rel_path}: {e}")
        
        return copied_count
    
    def copy_ios_resources(self) -> int:
        """Copy iOS resources from external assets"""
        print("Copying iOS resources...")
        
        external_ios_dir = self.external_assets_dir / "ios"
        if not external_ios_dir.exists():
            print("  No external iOS directory found, skipping...")
            return 0
        
        if not self.ios_dir.exists():
            print("  iOS directory not found in Flutter project, skipping...")
            return 0
        
        copied = self._copy_files_recursive(external_ios_dir, self.ios_dir)
        print(f"iOS resources copied: {copied}")
        return copied
    
    def copy_macos_resources(self) -> int:
        """Copy macOS resources from external assets"""
        print("Copying macOS resources...")
        
        external_macos_dir = self.external_assets_dir / "macos"
        if not external_macos_dir.exists():
            print("  No external macOS directory found, skipping...")
            return 0
        
        if not self.macos_dir.exists():
            print("  macOS directory not found in Flutter project, skipping...")
            return 0
        
        copied = self._copy_files_recursive(external_macos_dir, self.macos_dir)
        print(f"macOS resources copied: {copied}")
        return copied
    
    def copy_web_resources(self) -> int:
        """Copy web resources from external assets"""
        print("Copying web resources...")
        
        external_web_dir = self.external_assets_dir / "web"
        if not external_web_dir.exists():
            print("  No external web directory found, skipping...")
            return 0
        
        if not self.web_dir.exists():
            print("  Web directory not found in Flutter project, skipping...")
            return 0
        
        copied = self._copy_files_recursive(external_web_dir, self.web_dir)
        print(f"Web resources copied: {copied}")
        return copied
    
    def copy_windows_resources(self) -> int:
        """Copy Windows resources from external assets"""
        print("Copying Windows resources...")
        
        external_windows_dir = self.external_assets_dir / "windows"
        if not external_windows_dir.exists():
            print("  No external Windows directory found, skipping...")
            return 0
        
        if not self.windows_dir.exists():
            print("  Windows directory not found in Flutter project, skipping...")
            return 0
        
        copied = self._copy_files_recursive(external_windows_dir, self.windows_dir)
        print(f"Windows resources copied: {copied}")
        return copied
    
    def copy_specific_platform(self, platform: str) -> int:
        """Copy resources for a specific platform"""
        platform_methods = {
            'ios': self.copy_ios_resources,
            'macos': self.copy_macos_resources,
            'web': self.copy_web_resources,
            'windows': self.copy_windows_resources
        }
        
        if platform.lower() in platform_methods:
            return platform_methods[platform.lower()]()
        else:
            print(f"Unknown platform: {platform}")
            return 0
    
    def run(self, platforms: List[str] = None) -> bool:
        """Run the platform resources copying process"""
        print(f"Starting platform resources copying for app: {self.appname}")
        print(f"External assets directory: {self.external_assets_dir}")
        print(f"Flutter root: {self.flutter_root}")
        print()
        
        if platforms is None:
            platforms = ['ios', 'macos', 'web', 'windows']
        
        try:
            total_copied = 0
            
            for platform in platforms:
                copied = self.copy_specific_platform(platform)
                total_copied += copied
                print()
            
            print(f"Platform resources copying completed successfully!")
            print(f"Total files copied: {total_copied}")
            
            return True
            
        except Exception as e:
            print(f"Error during platform resources copying: {e}")
            return False

def main():
    parser = argparse.ArgumentParser(description="Copy platform-specific resources from external directory to Flutter project")
    parser.add_argument("--appname", required=True, help="App name")
    parser.add_argument("--external-assets", required=True, help="External assets directory")
    parser.add_argument("--flutter-root", required=True, help="Flutter project root directory")
    parser.add_argument("--platforms", nargs="*", choices=['ios', 'macos', 'web', 'windows'], 
                       help="Specific platforms to copy (default: all)")
    
    args = parser.parse_args()
    
    # Validate paths
    if not Path(args.external_assets).exists():
        print(f"Error: External assets directory does not exist: {args.external_assets}")
        sys.exit(1)
    
    if not Path(args.flutter_root).exists():
        print(f"Error: Flutter root directory does not exist: {args.flutter_root}")
        sys.exit(1)
    
    # Create copier and run
    copier = PlatformResourcesCopier(args.appname, args.external_assets, args.flutter_root)
    success = copier.run(args.platforms)
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
