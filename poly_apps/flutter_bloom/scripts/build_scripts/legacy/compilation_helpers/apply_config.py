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
Compilation Helper Script 8: Apply Configuration

This script applies external configuration to replace app name, package ID, and other
platform-specific settings based on configuration files in the external assets directory.
"""

import argparse
import json
import os
import re
import sys
from pathlib import Path
from typing import Dict, Optional

class ConfigApplier:
    def __init__(self, appname: str, external_assets_dir: str, flutter_root: str):
        self.appname = appname
        self.external_assets_dir = Path(external_assets_dir)
        self.flutter_root = Path(flutter_root)
        self.android_dir = self.flutter_root / "android"
        self.ios_dir = self.flutter_root / "ios"
        
    def _update_file_content(self, file_path: Path, pattern: str, replacement: str, description: str) -> bool:
        """Update file content using regex pattern"""
        if not file_path.exists():
            print(f"  File not found: {file_path}")
            return False
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = re.sub(pattern, replacement, content)
            
            if new_content != content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"  Updated {description}: {file_path}")
                return True
            else:
                print(f"  No changes needed for {description}: {file_path}")
                return False
                
        except Exception as e:
            print(f"  Error updating {description} in {file_path}: {e}")
            return False
    
    def apply_android_config(self, android_config: Dict) -> int:
        """Apply Android-specific configuration"""
        print("Applying Android configuration...")
        updates_count = 0
        
        # Update AndroidManifest.xml
        manifest_path = self.android_dir / "app" / "src" / "main" / "AndroidManifest.xml"
        if 'package' in android_config:
            pattern = r'package="[^"]*"'
            replacement = f'package="{android_config["package"]}"'
            if self._update_file_content(manifest_path, pattern, replacement, "AndroidManifest.xml package"):
                updates_count += 1
        
        # Update build.gradle
        build_gradle_path = self.android_dir / "app" / "build.gradle"
        if 'applicationId' in android_config:
            pattern = r'applicationId\s+"[^"]*"'
            replacement = f'applicationId "{android_config["applicationId"]}"'
            if self._update_file_content(build_gradle_path, pattern, replacement, "build.gradle applicationId"):
                updates_count += 1
        
        # Update app name in strings.xml
        if 'app_name' in android_config:
            strings_path = self.android_dir / "app" / "src" / "main" / "res" / "values" / "strings.xml"
            pattern = r'<string name="app_name">[^<]*</string>'
            replacement = f'<string name="app_name">{android_config["app_name"]}</string>'
            if self._update_file_content(strings_path, pattern, replacement, "strings.xml app_name"):
                updates_count += 1
        
        print(f"Android configuration updates: {updates_count}")
        return updates_count
    
    def apply_ios_config(self, ios_config: Dict) -> int:
        """Apply iOS-specific configuration"""
        print("Applying iOS configuration...")
        updates_count = 0
        
        # Update Info.plist
        info_plist_path = self.ios_dir / "Runner" / "Info.plist"
        
        if 'displayName' in ios_config:
            pattern = r'<key>CFBundleDisplayName</key>\s*<string>[^<]*</string>'
            replacement = f'<key>CFBundleDisplayName</key>\n\t<string>{ios_config["displayName"]}</string>'
            if self._update_file_content(info_plist_path, pattern, replacement, "Info.plist CFBundleDisplayName"):
                updates_count += 1
        
        if 'bundleId' in ios_config:
            pattern = r'<key>CFBundleIdentifier</key>\s*<string>[^<]*</string>'
            replacement = f'<key>CFBundleIdentifier</key>\n\t<string>{ios_config["bundleId"]}</string>'
            if self._update_file_content(info_plist_path, pattern, replacement, "Info.plist CFBundleIdentifier"):
                updates_count += 1
        
        if 'version' in ios_config:
            pattern = r'<key>CFBundleShortVersionString</key>\s*<string>[^<]*</string>'
            replacement = f'<key>CFBundleShortVersionString</key>\n\t<string>{ios_config["version"]}</string>'
            if self._update_file_content(info_plist_path, pattern, replacement, "Info.plist CFBundleShortVersionString"):
                updates_count += 1
        
        print(f"iOS configuration updates: {updates_count}")
        return updates_count
    
    def apply_general_config(self, general_config: Dict) -> int:
        """Apply general configuration"""
        print("Applying general configuration...")
        updates_count = 0
        
        # Update pubspec.yaml
        pubspec_path = self.flutter_root / "pubspec.yaml"
        
        if 'app_name' in general_config:
            pattern = r'name:\s*[^\n]*'
            replacement = f'name: {general_config["app_name"]}'
            if self._update_file_content(pubspec_path, pattern, replacement, "pubspec.yaml name"):
                updates_count += 1
        
        if 'description' in general_config:
            pattern = r'description:\s*[^\n]*'
            replacement = f'description: {general_config["description"]}'
            if self._update_file_content(pubspec_path, pattern, replacement, "pubspec.yaml description"):
                updates_count += 1
        
        if 'version' in general_config:
            pattern = r'version:\s*[^\n]*'
            replacement = f'version: {general_config["version"]}'
            if self._update_file_content(pubspec_path, pattern, replacement, "pubspec.yaml version"):
                updates_count += 1
        
        print(f"General configuration updates: {updates_count}")
        return updates_count
    
    def apply_configuration(self) -> int:
        """Apply external configuration to replace app name, package ID, etc."""
        print("Applying external configuration...")
        
        config_dir = self.external_assets_dir / "config"
        if not config_dir.exists():
            print("  No external config directory found, skipping...")
            return 0
        
        # Look for configuration files
        config_files = list(config_dir.glob("*.json"))
        if not config_files:
            print("  No configuration files found, skipping...")
            return 0
        
        total_updates = 0
        
        for config_file in config_files:
            try:
                # Try utf-8-sig first to handle BOM, then fallback to utf-8
                try:
                    with open(config_file, 'r', encoding='utf-8-sig') as f:
                        config = json.load(f)
                except UnicodeDecodeError:
                    with open(config_file, 'r', encoding='utf-8') as f:
                        config = json.load(f)
                
                print(f"  Processing config: {config_file.name}")
                
                # Apply Android configuration
                if 'android' in config:
                    updates = self.apply_android_config(config['android'])
                    total_updates += updates
                
                # Apply iOS configuration
                if 'ios' in config:
                    updates = self.apply_ios_config(config['ios'])
                    total_updates += updates
                
                # Apply general configuration
                if 'general' in config:
                    updates = self.apply_general_config(config['general'])
                    total_updates += updates
                
                print()
                
            except Exception as e:
                print(f"  Error processing config {config_file.name}: {e}")
        
        return total_updates
    
    def run(self) -> bool:
        """Run the configuration application process"""
        print(f"Starting configuration application for app: {self.appname}")
        print(f"External assets directory: {self.external_assets_dir}")
        print(f"Flutter root: {self.flutter_root}")
        print()
        
        try:
            total_updates = self.apply_configuration()
            
            print(f"Configuration application completed successfully!")
            print(f"Total configuration updates: {total_updates}")
            
            return True
            
        except Exception as e:
            print(f"Error during configuration application: {e}")
            return False

def main():
    parser = argparse.ArgumentParser(description="Apply external configuration to Flutter project")
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
    
    # Create applier and run
    applier = ConfigApplier(args.appname, args.external_assets, args.flutter_root)
    success = applier.run()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
