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
Compilation Helper Script 2: Copy Splash Screen Images

This script copies splash screen images from external assets directory to Flutter project
based on flutter_native_splash.yaml configuration.
"""

import argparse
import os
import shutil
import sys
import yaml
from pathlib import Path
from typing import Dict, List, Optional

class SplashCopier:
    def __init__(self, appname: str, external_assets_dir: str, flutter_root: str):
        self.appname = appname
        self.external_assets_dir = Path(external_assets_dir)
        self.flutter_root = Path(flutter_root)
        self.flutter_assets_dir = self.flutter_root / "assets"
        
        # Load splash configuration
        self.splash_config = self._load_splash_config()
    
    def _load_splash_config(self) -> Optional[Dict]:
        """Load flutter_native_splash.yaml configuration"""
        splash_config_path = self.flutter_root / "flutter_native_splash.yaml"
        if splash_config_path.exists():
            try:
                with open(splash_config_path, 'r', encoding='utf-8') as f:
                    return yaml.safe_load(f)
            except Exception as e:
                print(f"Warning: Could not load splash config: {e}")
        return None
    
    def _copy_splash_file(self, src_file: Path, dst_path: Path) -> bool:
        """Copy a single splash file to destination"""
        try:
            dst_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_file, dst_path)
            print(f"  Copied splash: {src_file.name} -> {dst_path}")
            return True
        except Exception as e:
            print(f"  Error copying splash {src_file.name}: {e}")
            return False
    
    def copy_splash_screens(self) -> int:
        """Copy splash screen images based on flutter_native_splash.yaml"""
        print("Copying splash screen images...")
        
        if not self.splash_config:
            print("  No splash configuration found, skipping...")
            return 0
        
        external_splash_dir = self.external_assets_dir / "splash"
        if not external_splash_dir.exists():
            print("  No external splash directory found, skipping...")
            return 0
        
        # Get splash image paths from config
        splash_config = self.splash_config.get('flutter_native_splash', {})
        splash_images = []
        
        # Collect all splash image paths
        for key in ['image', 'branding', 'image_dark', 'branding_dark']:
            if key in splash_config:
                splash_images.append(splash_config[key])
        
        # Android 12 splash images
        android_12_config = splash_config.get('android_12', {})
        for key in ['image', 'branding', 'image_dark', 'branding_dark']:
            if key in android_12_config:
                splash_images.append(android_12_config[key])
        
        # Remove duplicates and None values
        splash_images = list(set(filter(None, splash_images)))
        
        if not splash_images:
            print("  No splash images configured, skipping...")
            return 0
        
        # Copy splash images
        copied_count = 0
        external_files = list(external_splash_dir.glob("*"))
        external_files = [f for f in external_files if f.is_file()]
        
        if not external_files:
            print("  No splash files found in external directory, skipping...")
            return 0
        
        for splash_image_path in splash_images:
            if splash_image_path:
                # Create destination path
                dst_path = self.flutter_root / splash_image_path
                
                # Find best matching file from external directory
                splash_filename = Path(splash_image_path).name
                
                # Try exact match first
                matching_file = None
                for ext_file in external_files:
                    if ext_file.name == splash_filename:
                        matching_file = ext_file
                        break
                
                # If no exact match, use first available file
                if not matching_file and external_files:
                    matching_file = external_files[0]
                
                if matching_file:
                    if self._copy_splash_file(matching_file, dst_path):
                        copied_count += 1
        
        print(f"Splash images copied: {copied_count}")
        return copied_count
    
    def run(self) -> bool:
        """Run the splash copying process"""
        print(f"Starting splash copying for app: {self.appname}")
        print(f"External assets directory: {self.external_assets_dir}")
        print(f"Flutter root: {self.flutter_root}")
        print()
        
        try:
            copied_count = self.copy_splash_screens()
            
            print(f"\nSplash copying completed successfully!")
            print(f"Total splash files copied: {copied_count}")
            
            return True
            
        except Exception as e:
            print(f"Error during splash copying: {e}")
            return False

def main():
    parser = argparse.ArgumentParser(description="Copy splash screen images from external directory to Flutter project")
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
    copier = SplashCopier(args.appname, args.external_assets, args.flutter_root)
    success = copier.run()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
