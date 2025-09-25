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
Compilation Helper Script 1: Copy Assets (Icons/Images)

This script copies icons and images from external assets directory to Flutter project assets.
External assets take priority over Flutter project assets.
"""

import argparse
import os
import shutil
import sys
from pathlib import Path
from typing import Optional

class AssetsCopier:
    def __init__(self, appname: str, external_assets_dir: str, flutter_root: str):
        self.appname = appname
        self.external_assets_dir = Path(external_assets_dir)
        self.flutter_root = Path(flutter_root)
        self.flutter_assets_dir = self.flutter_root / "assets"
        
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
    
    def copy_icons(self) -> int:
        """Copy icons from external assets to Flutter assets"""
        print("Copying icons...")
        
        external_icons_dir = self.external_assets_dir / "icons"
        
        # Copy to common icons directory
        common_icons_dir = self.flutter_assets_dir / "common" / "icons"
        common_copied = self._copy_files(external_icons_dir, common_icons_dir)
        
        # Copy to app-specific icons directory
        app_icons_dir = self.flutter_assets_dir / "apps" / f"app_{self.appname}" / "icons"
        app_copied = self._copy_files(external_icons_dir, app_icons_dir)
        
        total_copied = common_copied + app_copied
        print(f"Icons copied: {total_copied} (Common: {common_copied}, App: {app_copied})")
        return total_copied
    
    def copy_images(self) -> int:
        """Copy images from external assets to Flutter assets"""
        print("Copying images...")
        
        external_images_dir = self.external_assets_dir / "images"
        
        # Copy to common images directory
        common_images_dir = self.flutter_assets_dir / "common" / "images"
        common_copied = self._copy_files(external_images_dir, common_images_dir)
        
        # Copy to app-specific images directory
        app_images_dir = self.flutter_assets_dir / "apps" / f"app_{self.appname}" / "images"
        app_copied = self._copy_files(external_images_dir, app_images_dir)
        
        total_copied = common_copied + app_copied
        print(f"Images copied: {total_copied} (Common: {common_copied}, App: {app_copied})")
        return total_copied
    
    def run(self) -> bool:
        """Run the assets copying process"""
        print(f"Starting assets copying for app: {self.appname}")
        print(f"External assets directory: {self.external_assets_dir}")
        print(f"Flutter root: {self.flutter_root}")
        print()
        
        try:
            icons_copied = self.copy_icons()
            images_copied = self.copy_images()
            
            total_copied = icons_copied + images_copied
            print(f"\nAssets copying completed successfully!")
            print(f"Total files copied: {total_copied}")
            
            return True
            
        except Exception as e:
            print(f"Error during assets copying: {e}")
            return False

def main():
    parser = argparse.ArgumentParser(description="Copy assets (icons/images) from external directory to Flutter project")
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
    copier = AssetsCopier(args.appname, args.external_assets, args.flutter_root)
    success = copier.run()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
