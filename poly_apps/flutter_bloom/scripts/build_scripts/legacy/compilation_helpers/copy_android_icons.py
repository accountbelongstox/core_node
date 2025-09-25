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
Compilation Helper Script 3: Copy Android Icons

This script copies Android-specific icons from external assets directory to Android project directories.
"""

import argparse
import os
import shutil
import sys
from pathlib import Path
from typing import List, Tuple

class AndroidIconsCopier:
    def __init__(self, appname: str, external_assets_dir: str, flutter_root: str):
        self.appname = appname
        self.external_assets_dir = Path(external_assets_dir)
        self.flutter_root = Path(flutter_root)
        self.android_dir = self.flutter_root / "android"
        
    def _copy_files(self, src_dir: Path, dst_dir: Path, file_pattern: str = "*") -> int:
        """Copy files from source to destination directory"""
        if not src_dir.exists():
            return 0
        
        copied_count = 0
        dst_dir.mkdir(parents=True, exist_ok=True)
        
        for src_file in src_dir.glob(file_pattern):
            if src_file.is_file():
                dst_file = dst_dir / src_file.name
                try:
                    shutil.copy2(src_file, dst_file)
                    print(f"  Copied: {src_file.name} -> {dst_file}")
                    copied_count += 1
                except Exception as e:
                    print(f"  Error copying {src_file.name}: {e}")
        
        return copied_count
    
    def copy_android_icons(self) -> int:
        """Copy Android icons from external assets"""
        print("Copying Android icons...")
        
        external_android_icons_dir = self.external_assets_dir / "android_icons"
        if not external_android_icons_dir.exists():
            print("  No external Android icons directory found, skipping...")
            return 0
        
        # Android app directory structure
        android_app_dir = self.android_dir / "app" / "src" / "main"
        if not android_app_dir.exists():
            print("  Android app directory not found, skipping...")
            return 0
        
        # Android resource directories with their patterns
        resource_dirs = [
            ("res/mipmap-hdpi", "*.png"),
            ("res/mipmap-mdpi", "*.png"),
            ("res/mipmap-xhdpi", "*.png"),
            ("res/mipmap-xxhdpi", "*.png"),
            ("res/mipmap-xxxhdpi", "*.png"),
            ("res/drawable", "*.png"),
            ("res/drawable", "*.xml"),
            ("res/drawable-hdpi", "*.png"),
            ("res/drawable-mdpi", "*.png"),
            ("res/drawable-xhdpi", "*.png"),
            ("res/drawable-xxhdpi", "*.png"),
            ("res/drawable-xxxhdpi", "*.png"),
            ("res/values", "*.xml"),
        ]
        
        total_copied = 0
        for res_dir, pattern in resource_dirs:
            dst_dir = android_app_dir / res_dir
            copied = self._copy_files(external_android_icons_dir, dst_dir, pattern)
            total_copied += copied
            if copied > 0:
                print(f"    {res_dir}: {copied} files")
        
        print(f"Android icons copied: {total_copied}")
        return total_copied
    
    def copy_android_launcher_icons(self) -> int:
        """Copy Android launcher icons with proper naming"""
        print("Copying Android launcher icons...")
        
        external_android_icons_dir = self.external_assets_dir / "android_icons"
        if not external_android_icons_dir.exists():
            return 0
        
        android_app_dir = self.android_dir / "app" / "src" / "main"
        if not android_app_dir.exists():
            return 0
        
        # Look for launcher icon files
        launcher_icons = []
        for icon_file in external_android_icons_dir.glob("*"):
            if icon_file.is_file() and icon_file.suffix.lower() in ['.png', '.jpg', '.jpeg']:
                if 'launcher' in icon_file.name.lower() or 'ic_launcher' in icon_file.name.lower():
                    launcher_icons.append(icon_file)
        
        if not launcher_icons:
            # If no specific launcher icons, use any PNG files
            launcher_icons = list(external_android_icons_dir.glob("*.png"))
        
        if not launcher_icons:
            print("  No launcher icons found, skipping...")
            return 0
        
        # Copy to different density folders with proper naming
        density_dirs = [
            "res/mipmap-hdpi",
            "res/mipmap-mdpi", 
            "res/mipmap-xhdpi",
            "res/mipmap-xxhdpi",
            "res/mipmap-xxxhdpi"
        ]
        
        total_copied = 0
        for launcher_icon in launcher_icons[:1]:  # Use first icon
            for density_dir in density_dirs:
                dst_dir = android_app_dir / density_dir
                dst_dir.mkdir(parents=True, exist_ok=True)
                
                # Copy with standard launcher icon name
                dst_file = dst_dir / "ic_launcher.png"
                try:
                    shutil.copy2(launcher_icon, dst_file)
                    print(f"  Copied launcher icon: {launcher_icon.name} -> {dst_file}")
                    total_copied += 1
                except Exception as e:
                    print(f"  Error copying launcher icon to {dst_file}: {e}")
        
        print(f"Launcher icons copied: {total_copied}")
        return total_copied
    
    def run(self) -> bool:
        """Run the Android icons copying process"""
        print(f"Starting Android icons copying for app: {self.appname}")
        print(f"External assets directory: {self.external_assets_dir}")
        print(f"Flutter root: {self.flutter_root}")
        print()
        
        try:
            general_copied = self.copy_android_icons()
            launcher_copied = self.copy_android_launcher_icons()
            
            total_copied = general_copied + launcher_copied
            print(f"\nAndroid icons copying completed successfully!")
            print(f"Total files copied: {total_copied}")
            
            return True
            
        except Exception as e:
            print(f"Error during Android icons copying: {e}")
            return False

def main():
    parser = argparse.ArgumentParser(description="Copy Android icons from external directory to Android project")
    parser.add_argument("--appname", required=True, help="App name")
    parser.add_argument("--external-assets", required=True, help="External assets directory")
    parser.add_argument("--flutter-root", required=True, help="Flutter project root directory")
    
    args = parser.parse_args()
    
    # Validate paths
    if not Path(args.external_assets).exists():
        print(f"Error: External assets directory does not exist: {args.external_assets}")
        sys.exit(1)
    
    if not Path(args.flutter_root).exists():
        print(f"Error: Flutter root directory does not exist: {args.flutter_root}")
        sys.exit(1)
    
    # Create copier and run
    copier = AndroidIconsCopier(args.appname, args.external_assets, args.flutter_root)
    success = copier.run()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
