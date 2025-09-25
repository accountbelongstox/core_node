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
App Display Name Manager for Flutter Build System

PURPOSE:
Manages Android application display names according to Flutter development guidelines.

SPECIFICATIONS FOLLOWED:
1. Flutter Build System Guidelines - Multi-app aggregation architecture
2. Android App Naming Standards - Uses strings.xml for localized app names
3. Build Directory Structure - Operates on D:\programing\.build_dir\{appname} structure
4. Cache Management - Stores display names in .cache\gvar for persistence

FUNCTIONALITY:
- Generates random display names using predefined adjectives and nouns
- Supports manual input for custom display names  
- Uses default/cached names for consistency
- Modifies android/app/src/main/res/values/strings.xml app_name value
- Works with relative paths to avoid modifying original Flutter project files

COMPLIANCE:
- Follows Flutter project structure standards
- Implements proper XML parsing and modification
- Uses UTF-8 encoding for international character support
- Provides fallback mechanisms for error handling

INTEGRATION:
- Called by run_all_helpers.py as part of build pipeline
- Receives configuration via environment variables from PowerShell
- Caches results in D:\programing\.build_dir\.cache\gvar directory
"""

import os
import re
import json
import random
import argparse
from pathlib import Path
import xml.etree.ElementTree as ET

class AppDisplayNameManager:
    def __init__(self, flutter_root, build_cache_dir, appname):
        self.flutter_root = Path(flutter_root)
        self.build_cache_dir = Path(build_cache_dir)
        self.appname = appname
        
        # Use build directory for app-specific files
        self.build_dir = Path(build_cache_dir).parent / appname
        self.strings_xml_path = self.build_dir / "android" / "app" / "src" / "main" / "res" / "values" / "strings.xml"
        
        # Ensure directories exist
        self.build_cache_dir.mkdir(parents=True, exist_ok=True)
        self.build_dir.mkdir(parents=True, exist_ok=True)
        
        # Create android directory structure if it doesn't exist
        android_values_dir = self.strings_xml_path.parent
        android_values_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy original strings.xml if it doesn't exist in build dir
        original_strings = self.flutter_root / "android" / "app" / "src" / "main" / "res" / "values" / "strings.xml"
        if original_strings.exists() and not self.strings_xml_path.exists():
            import shutil
            shutil.copy2(original_strings, self.strings_xml_path)
            print(f"Copied original strings.xml to build directory: {self.strings_xml_path}")
    
    def generate_random_display_name(self):
        """Generate a random app display name"""
        adjectives = [
            "Super", "Amazing", "Cool", "Smart", "Fast", "Modern", "Pro", 
            "Elite", "Premium", "Ultimate", "Advanced", "Dynamic", "Creative",
            "Powerful", "Innovative", "Brilliant", "Efficient", "Sleek"
        ]
        nouns = [
            "App", "Tool", "Helper", "Builder", "Maker", "Studio", "Lab", 
            "Hub", "Center", "Platform", "Suite", "Manager", "Assistant",
            "Creator", "Explorer", "Navigator", "Companion", "Toolkit"
        ]
        
        adjective = random.choice(adjectives)
        noun = random.choice(nouns)
        return f"{adjective} {noun}"
    
    def get_cached_display_name(self, appname):
        """Get cached display name for specific app"""
        cache_file = self.build_cache_dir / f"app_display_name_{appname}"
        if cache_file.exists():
            return cache_file.read_text(encoding='utf-8').strip()
        return None
    
    def set_cached_display_name(self, appname, display_name):
        """Cache display name for specific app"""
        cache_file = self.build_cache_dir / f"app_display_name_{appname}"
        cache_file.write_text(display_name, encoding='utf-8')
    
    def get_current_display_name(self):
        """Get current display name from strings.xml"""
        if not self.strings_xml_path.exists():
            return None
        
        try:
            tree = ET.parse(self.strings_xml_path)
            root = tree.getroot()
            
            for string_elem in root.findall('string'):
                if string_elem.get('name') == 'app_name':
                    return string_elem.text
        except ET.ParseError:
            # Fallback to regex if XML parsing fails
            content = self.strings_xml_path.read_text(encoding='utf-8')
            match = re.search(r'<string name="app_name">([^<]+)</string>', content)
            if match:
                return match.group(1)
        
        return None
    
    def set_display_name(self, new_display_name):
        """Update display name in strings.xml"""
        if not self.strings_xml_path.exists():
            print(f"Error: strings.xml not found at {self.strings_xml_path}")
            return False
        
        try:
            # Try to parse as XML first
            tree = ET.parse(self.strings_xml_path)
            root = tree.getroot()
            
            # Find and update app_name
            app_name_found = False
            for string_elem in root.findall('string'):
                if string_elem.get('name') == 'app_name':
                    string_elem.text = new_display_name
                    app_name_found = True
                    break
            
            if not app_name_found:
                # Add new app_name element
                new_elem = ET.Element('string', name='app_name')
                new_elem.text = new_display_name
                root.append(new_elem)
            
            # Write back to file
            tree.write(self.strings_xml_path, encoding='utf-8', xml_declaration=True)
            print(f"Updated strings.xml app_name to: {new_display_name}")
            return True
            
        except ET.ParseError:
            # Fallback to regex replacement
            content = self.strings_xml_path.read_text(encoding='utf-8')
            new_content = re.sub(
                r'<string name="app_name">[^<]+</string>',
                f'<string name="app_name">{new_display_name}</string>',
                content
            )
            
            if new_content != content:
                self.strings_xml_path.write_text(new_content, encoding='utf-8')
                print(f"Updated strings.xml app_name to: {new_display_name}")
                return True
            else:
                print("Error: Could not find app_name in strings.xml")
                return False
    
    def process_display_name(self, appname, mode, manual_name=None):
        """Main process for handling display name based on user choice"""
        current_name = self.get_current_display_name()
        
        if mode == "Random Generate":
            # Generate new random name
            new_name = self.generate_random_display_name()
            print(f"Generated random display name: {new_name}")
            
        elif mode == "Manual Input":
            # Use provided manual name
            if manual_name:
                new_name = manual_name.strip()
                print(f"Using manual display name: {new_name}")
            else:
                print("Error: Manual input mode selected but no name provided")
                return None
                
        elif mode == "Use Default":
            # Use cached name if available, otherwise current name
            cached_name = self.get_cached_display_name(appname)
            if cached_name:
                new_name = cached_name
                print(f"Using cached display name: {new_name}")
            elif current_name:
                new_name = current_name
                print(f"Using current display name: {new_name}")
            else:
                # Fallback to random if nothing available
                new_name = self.generate_random_display_name()
                print(f"No cached or current name found, generated random: {new_name}")
        else:
            print(f"Error: Unknown mode '{mode}'")
            return None
        
        # Cache the name
        self.set_cached_display_name(appname, new_name)
        
        # Update strings.xml
        if self.set_display_name(new_name):
            print(f"Successfully set display name for {appname}: {new_name}")
            return new_name
        else:
            print(f"Failed to update display name for {appname}")
            return None

def print_specifications():
    """Print the specifications and standards this script follows"""
    print("=" * 80)
    print("APP DISPLAY NAME MANAGER - SPECIFICATIONS")
    print("=" * 80)
    print("STANDARDS FOLLOWED:")
    print("• Flutter Multi-App Aggregation Architecture")
    print("• Android String Resource Management (strings.xml)")
    print("• FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md Guidelines")
    print("• Build Directory Isolation (D:\\programing\\.build_dir\\{appname})")
    print("• UTF-8 Encoding for International Character Support")
    print("")
    print("OPERATIONS:")
    print("• Random Generation: Uses predefined adjective + noun combinations")
    print("• Manual Input: Accepts user-provided display names")
    print("• Default Mode: Uses cached or existing display names")
    print("• XML Modification: Updates <string name=\"app_name\"> in strings.xml")
    print("• Cache Management: Stores display names in .cache\\gvar directory")
    print("=" * 80)

def main():
    print_specifications()
    
    parser = argparse.ArgumentParser(description='Manage Flutter app display names')
    parser.add_argument('--appname', required=True, help='App name')
    parser.add_argument('--flutter-root', required=True, help='Flutter project root directory')
    parser.add_argument('--build-cache-dir', required=True, help='Build cache directory')
    parser.add_argument('--mode', required=True, choices=['Random Generate', 'Manual Input', 'Use Default'], 
                      help='Display name mode')
    parser.add_argument('--manual-name', help='Manual display name (required for Manual Input mode)')
    
    args = parser.parse_args()
    
    # Validate manual input mode
    if args.mode == 'Manual Input' and not args.manual_name:
        print("Error: Manual Input mode requires --manual-name parameter")
        return 1
    
    manager = AppDisplayNameManager(args.flutter_root, args.build_cache_dir, args.appname)
    result = manager.process_display_name(args.appname, args.mode, args.manual_name)
    
    if result:
        print(f"Display name management completed successfully: {result}")
        return 0
    else:
        print("Display name management failed")
        return 1

if __name__ == "__main__":
    exit(main())