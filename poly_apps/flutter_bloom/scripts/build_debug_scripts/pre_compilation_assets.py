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
Pre-compilation Asset Management Script

This script handles the pre-compilation tasks for Flutter apps:
1. Copy external assets (icons/images) to Flutter project assets
2. Copy splash screen images based on flutter_native_splash.yaml
3. Copy Android icons from external assets
4. Copy iOS, macOS, web, Windows resources
5. Apply external configuration to replace app name, package ID, etc.
"""

import argparse
import os
import shutil
import yaml
import json
from pathlib import Path
from typing import Dict, List, Optional
import sys

class AssetManager:
    def __init__(self, appname: str, external_assets_dir: str, flutter_root: str):
        self.appname = appname
        self.external_assets_dir = Path(external_assets_dir)
        self.flutter_root = Path(flutter_root)
        self.flutter_assets_dir = self.flutter_root / "assets"
        self.android_dir = self.flutter_root / "android"
        self.ios_dir = self.flutter_root / "ios"
        self.macos_dir = self.flutter_root / "macos"
        self.web_dir = self.flutter_root / "web"
        self.windows_dir = self.flutter_root / "windows"
        
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
                    print(f"  Copied: {src_file.name}")
                    copied_count += 1
                except Exception as e:
                    print(f"  Error copying {src_file.name}: {e}")
        
        return copied_count
    
    def copy_assets(self) -> None:
        """Copy icons and images from external assets to Flutter assets"""
        print("1. Copying icons and images...")
        
        # Copy icons
        external_icons_dir = self.external_assets_dir / "icons"
        flutter_icons_dir = self.flutter_assets_dir / "icons"
        icons_copied = self._copy_files(external_icons_dir, flutter_icons_dir)
        print(f"  Icons copied: {icons_copied}")
        
        # Copy images
        external_images_dir = self.external_assets_dir / "images"
        flutter_images_dir = self.flutter_assets_dir / "images"
        images_copied = self._copy_files(external_images_dir, flutter_images_dir)
        print(f"  Images copied: {images_copied}")
    
    def copy_splash_screens(self) -> None:
        """Copy splash screen images based on flutter_native_splash.yaml"""
        print("2. Copying splash screen images...")
        
        if not self.splash_config:
            print("  No splash configuration found, skipping...")
            return
        
        external_splash_dir = self.external_assets_dir / "splash"
        if not external_splash_dir.exists():
            print("  No external splash directory found, skipping...")
            return
        
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
        
        # Copy splash images
        copied_count = 0
        for splash_image in splash_images:
            if splash_image:
                # Extract directory from splash image path
                splash_dir = self.flutter_assets_dir / Path(splash_image).parent
                splash_dir.mkdir(parents=True, exist_ok=True)
                
                # Try to find matching file in external splash directory
                for ext_file in external_splash_dir.glob("*"):
                    if ext_file.is_file():
                        dst_file = splash_dir / Path(splash_image).name
                        try:
                            shutil.copy2(ext_file, dst_file)
                            print(f"  Copied splash: {ext_file.name} -> {dst_file}")
                            copied_count += 1
                            break
                        except Exception as e:
                            print(f"  Error copying splash {ext_file.name}: {e}")
        
        print(f"  Splash images copied: {copied_count}")
    
    def copy_android_icons(self) -> None:
        """Copy Android icons from external assets"""
        print("3. Copying Android icons...")
        
        external_android_icons_dir = self.external_assets_dir / "android_icons"
        if not external_android_icons_dir.exists():
            print("  No external Android icons directory found, skipping...")
            return
        
        # Android app directory structure
        android_app_dir = self.android_dir / "app" / "src" / "main"
        if not android_app_dir.exists():
            print("  Android app directory not found, skipping...")
            return
        
        # Copy to different Android resource directories
        resource_dirs = [
            ("res/mipmap-hdpi", "*.png"),
            ("res/mipmap-mdpi", "*.png"),
            ("res/mipmap-xhdpi", "*.png"),
            ("res/mipmap-xxhdpi", "*.png"),
            ("res/mipmap-xxxhdpi", "*.png"),
            ("res/drawable", "*.png"),
            ("res/drawable-hdpi", "*.png"),
            ("res/drawable-mdpi", "*.png"),
            ("res/drawable-xhdpi", "*.png"),
            ("res/drawable-xxhdpi", "*.png"),
            ("res/drawable-xxxhdpi", "*.png"),
        ]
        
        total_copied = 0
        for res_dir, pattern in resource_dirs:
            dst_dir = android_app_dir / res_dir
            copied = self._copy_files(external_android_icons_dir, dst_dir, pattern)
            total_copied += copied
        
        print(f"  Android icons copied: {total_copied}")
    
    def copy_ios_resources(self) -> None:
        """Copy iOS resources from external assets"""
        print("4. Copying iOS resources...")
        
        external_ios_dir = self.external_assets_dir / "ios"
        if not external_ios_dir.exists():
            print("  No external iOS directory found, skipping...")
            return
        
        # Copy to iOS directory
        copied = self._copy_files(external_ios_dir, self.ios_dir)
        print(f"  iOS resources copied: {copied}")
    
    def copy_macos_resources(self) -> None:
        """Copy macOS resources from external assets"""
        print("5. Copying macOS resources...")
        
        external_macos_dir = self.external_assets_dir / "macos"
        if not external_macos_dir.exists():
            print("  No external macOS directory found, skipping...")
            return
        
        # Copy to macOS directory
        copied = self._copy_files(external_macos_dir, self.macos_dir)
        print(f"  macOS resources copied: {copied}")
    
    def copy_web_resources(self) -> None:
        """Copy web resources from external assets"""
        print("6. Copying web resources...")
        
        external_web_dir = self.external_assets_dir / "web"
        if not external_web_dir.exists():
            print("  No external web directory found, skipping...")
            return
        
        # Copy to web directory
        copied = self._copy_files(external_web_dir, self.web_dir)
        print(f"  Web resources copied: {copied}")
    
    def copy_windows_resources(self) -> None:
        """Copy Windows resources from external assets"""
        print("7. Copying Windows resources...")
        
        external_windows_dir = self.external_assets_dir / "windows"
        if not external_windows_dir.exists():
            print("  No external Windows directory found, skipping...")
            return
        
        # Copy to Windows directory
        copied = self._copy_files(external_windows_dir, self.windows_dir)
        print(f"  Windows resources copied: {copied}")
    
    def apply_configuration(self) -> None:
        """Apply external configuration to replace app name, package ID, etc."""
        print("8. Applying external configuration...")
        
        config_dir = self.external_assets_dir / "config"
        if not config_dir.exists():
            print("  No external config directory found, skipping...")
            return
        
        # Look for configuration files
        config_files = list(config_dir.glob("*.json"))
        if not config_files:
            print("  No configuration files found, skipping...")
            return
        
        for config_file in config_files:
            try:
                with open(config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                
                print(f"  Processing config: {config_file.name}")
                
                # Apply Android configuration
                if 'android' in config:
                    self._apply_android_config(config['android'])
                
                # Apply iOS configuration
                if 'ios' in config:
                    self._apply_ios_config(config['ios'])
                
                # Apply general configuration
                if 'general' in config:
                    self._apply_general_config(config['general'])
                
            except Exception as e:
                print(f"  Error processing config {config_file.name}: {e}")
    
    def _apply_android_config(self, android_config: Dict) -> None:
        """Apply Android-specific configuration"""
        # Update AndroidManifest.xml
        manifest_path = self.android_dir / "app" / "src" / "main" / "AndroidManifest.xml"
        if manifest_path.exists() and 'package' in android_config:
            self._update_android_manifest(manifest_path, android_config['package'])
        
        # Update build.gradle
        build_gradle_path = self.android_dir / "app" / "build.gradle"
        if build_gradle_path.exists():
            self._update_build_gradle(build_gradle_path, android_config)
    
    def _apply_ios_config(self, ios_config: Dict) -> None:
        """Apply iOS-specific configuration"""
        # Update Info.plist
        info_plist_path = self.ios_dir / "Runner" / "Info.plist"
        if info_plist_path.exists():
            self._update_info_plist(info_plist_path, ios_config)
    
    def _apply_general_config(self, general_config: Dict) -> None:
        """Apply general configuration"""
        # Update pubspec.yaml
        pubspec_path = self.flutter_root / "pubspec.yaml"
        if pubspec_path.exists() and 'app_name' in general_config:
            self._update_pubspec(pubspec_path, general_config['app_name'])
    
    def _update_android_manifest(self, manifest_path: Path, package_name: str) -> None:
        """Update AndroidManifest.xml package name"""
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace package attribute
            import re
            content = re.sub(r'package="[^"]*"', f'package="{package_name}"', content)
            
            with open(manifest_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"    Updated AndroidManifest.xml package: {package_name}")
        except Exception as e:
            print(f"    Error updating AndroidManifest.xml: {e}")
    
    def _update_build_gradle(self, build_gradle_path: Path, android_config: Dict) -> None:
        """Update build.gradle with Android configuration"""
        try:
            with open(build_gradle_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Update applicationId
            if 'applicationId' in android_config:
                import re
                content = re.sub(
                    r'applicationId\s+"[^"]*"',
                    f'applicationId "{android_config["applicationId"]}"',
                    content
                )
            
            with open(build_gradle_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"    Updated build.gradle")
        except Exception as e:
            print(f"    Error updating build.gradle: {e}")
    
    def _update_info_plist(self, info_plist_path: Path, ios_config: Dict) -> None:
        """Update Info.plist with iOS configuration"""
        try:
            with open(info_plist_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Update CFBundleDisplayName
            if 'displayName' in ios_config:
                import re
                content = re.sub(
                    r'<key>CFBundleDisplayName</key>\s*<string>[^<]*</string>',
                    f'<key>CFBundleDisplayName</key>\n\t<string>{ios_config["displayName"]}</string>',
                    content
                )
            
            with open(info_plist_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"    Updated Info.plist")
        except Exception as e:
            print(f"    Error updating Info.plist: {e}")
    
    def _update_pubspec(self, pubspec_path: Path, app_name: str) -> None:
        """Update pubspec.yaml with app name"""
        try:
            with open(pubspec_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Update name field
            import re
            content = re.sub(r'name:\s*[^\n]*', f'name: {app_name}', content)
            
            with open(pubspec_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"    Updated pubspec.yaml name: {app_name}")
        except Exception as e:
            print(f"    Error updating pubspec.yaml: {e}")
    
    def run_all(self) -> None:
        """Run all pre-compilation tasks"""
        print(f"Starting pre-compilation for app: {self.appname}")
        print(f"External assets directory: {self.external_assets_dir}")
        print(f"Flutter root: {self.flutter_root}")
        print()
        
        try:
            self.copy_assets()
            print()
            
            self.copy_splash_screens()
            print()
            
            self.copy_android_icons()
            print()
            
            self.copy_ios_resources()
            print()
            
            self.copy_macos_resources()
            print()
            
            self.copy_web_resources()
            print()
            
            self.copy_windows_resources()
            print()
            
            self.apply_configuration()
            print()
            
            print("Pre-compilation completed successfully!")
            
        except Exception as e:
            print(f"Error during pre-compilation: {e}")
            sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Pre-compilation asset management for Flutter apps")
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
    
    # Create asset manager and run
    asset_manager = AssetManager(args.appname, args.external_assets, args.flutter_root)
    asset_manager.run_all()

if __name__ == "__main__":
    main()
