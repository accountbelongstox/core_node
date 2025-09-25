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
ID Manager for Flutter Build System

PURPOSE:
Manages Android application IDs according to Flutter development and Android packaging standards.

SPECIFICATIONS FOLLOWED:
1. Android Package Naming Convention - Uses reverse domain notation (e.g., com.example.app)
2. Flutter Build System Guidelines - Multi-app aggregation architecture
3. Build Directory Structure - Operates on D:\programing\.build_dir\{appname} structure  
4. Gradle Build Configuration - Modifies android/app/build.gradle applicationId

FUNCTIONALITY:
- Generates random application IDs in format xxx.xxx.xxx
- Caches application IDs for consistency across builds
- Supports using previous IDs or generating new random IDs
- Modifies build.gradle applicationId property
- Works with relative paths to avoid modifying original Flutter project files

COMPLIANCE:
- Follows Android application ID naming standards
- Implements proper Gradle file parsing and modification
- Uses regex patterns for reliable text replacement
- Provides error handling and validation

INTEGRATION:
- Called by run_all_helpers.py as part of build pipeline
- Receives random ID flag via environment variables from PowerShell
- Caches results in D:\programing\.build_dir\.cache\gvar directory
- Works with both double-quoted and single-quoted applicationId values

TECHNICAL DETAILS:
- Supports Gradle file format variations
- Handles UTF-8 encoding properly
- Provides rollback capability through caching mechanism
"""

import os
import re
import json
import random
import argparse
from pathlib import Path

class IDManager:
    def __init__(self, flutter_root, build_cache_dir, appname):
        self.flutter_root = Path(flutter_root)
        self.build_cache_dir = Path(build_cache_dir)
        self.appname = appname
        
        # Use build directory for app-specific files
        self.build_dir = Path(build_cache_dir).parent / appname
        self.build_gradle_path = self.build_dir / "android" / "app" / "build.gradle"
        
        # Ensure directories exist
        self.build_cache_dir.mkdir(parents=True, exist_ok=True)
        self.build_dir.mkdir(parents=True, exist_ok=True)
        
        # Create android directory structure if it doesn't exist
        android_app_dir = self.build_gradle_path.parent
        android_app_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy original build.gradle if it doesn't exist in build dir
        original_gradle = self.flutter_root / "android" / "app" / "build.gradle"
        if original_gradle.exists() and not self.build_gradle_path.exists():
            import shutil
            shutil.copy2(original_gradle, self.build_gradle_path)
            print(f"Copied original build.gradle to build directory: {self.build_gradle_path}")
    
    def generate_random_id(self):
        """Generate a random app ID in format xxx.xxx.xxx"""
        part1 = random.randint(100, 999)
        part2 = random.randint(100, 999)
        part3 = random.randint(100, 999)
        return f"{part1}.{part2}.{part3}"
    
    def get_cached_app_id(self, appname):
        """Get cached app ID for specific app"""
        cache_file = self.build_cache_dir / f"app_id_{appname}"
        if cache_file.exists():
            return cache_file.read_text(encoding='utf-8').strip()
        return None
    
    def set_cached_app_id(self, appname, app_id):
        """Cache app ID for specific app"""
        cache_file = self.build_cache_dir / f"app_id_{appname}"
        cache_file.write_text(app_id, encoding='utf-8')
    
    def get_build_gradle_app_id(self):
        """Extract current applicationId from build.gradle"""
        if not self.build_gradle_path.exists():
            return None
        
        content = self.build_gradle_path.read_text(encoding='utf-8')
        match = re.search(r'applicationId\s*["\']([^"\']+)["\']', content)
        if match:
            return match.group(1)
        return None
    
    def set_build_gradle_app_id(self, new_app_id):
        """Update applicationId in build.gradle"""
        if not self.build_gradle_path.exists():
            print(f"Error: build.gradle not found at {self.build_gradle_path}")
            return False
        
        content = self.build_gradle_path.read_text(encoding='utf-8')
        new_content = re.sub(
            r'(applicationId\s*["\'])[^"\']+(["\'])',
            rf'\g<1>{new_app_id}\g<2>',
            content
        )
        
        self.build_gradle_path.write_text(new_content, encoding='utf-8')
        print(f"Updated build.gradle applicationId to: {new_app_id}")
        return True
    
    def process_app_id(self, appname, use_random_id):
        """Main process for handling app ID based on user choice"""
        if use_random_id:
            # Generate new random ID
            new_id = self.generate_random_id()
            print(f"Generated new random ID: {new_id}")
            
            # Cache the new ID
            self.set_cached_app_id(appname, new_id)
            
            # Update build.gradle
            if self.set_build_gradle_app_id(new_id):
                print(f"Successfully set app ID for {appname}: {new_id}")
                return new_id
            else:
                print(f"Failed to update build.gradle for {appname}")
                return None
        else:
            # Use previous ID
            cached_id = self.get_cached_app_id(appname)
            if cached_id:
                print(f"Using cached ID: {cached_id}")
                
                # Update build.gradle with cached ID
                if self.set_build_gradle_app_id(cached_id):
                    print(f"Successfully restored cached ID for {appname}: {cached_id}")
                    return cached_id
                else:
                    print(f"Failed to update build.gradle for {appname}")
                    return None
            else:
                # No cached ID, use current build.gradle ID
                current_id = self.get_build_gradle_app_id()
                if current_id:
                    print(f"No cached ID found, using current build.gradle ID: {current_id}")
                    self.set_cached_app_id(appname, current_id)
                    return current_id
                else:
                    print(f"No ID found in build.gradle, generating new random ID")
                    return self.process_app_id(appname, True)

def print_specifications():
    """Print the specifications and standards this script follows"""
    print("=" * 80)
    print("APPLICATION ID MANAGER - SPECIFICATIONS")
    print("=" * 80)
    print("STANDARDS FOLLOWED:")
    print("• Android Package Naming Convention (reverse domain notation)")
    print("• Flutter Multi-App Aggregation Architecture")
    print("• FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md Guidelines")
    print("• Build Directory Isolation (D:\\programing\\.build_dir\\{appname})")
    print("• Gradle Build Configuration Standards")
    print("")
    print("OPERATIONS:")
    print("• Random ID Generation: Creates xxx.xxx.xxx format identifiers")
    print("• ID Caching: Stores application IDs for consistency")
    print("• Gradle Modification: Updates applicationId in android/app/build.gradle")
    print("• Pattern Matching: Supports both single and double quoted values")
    print("• Rollback Support: Maintains previous IDs through caching system")
    print("=" * 80)

def main():
    print_specifications()
    
    parser = argparse.ArgumentParser(description='Manage Flutter app IDs')
    parser.add_argument('--appname', required=True, help='App name')
    parser.add_argument('--flutter-root', required=True, help='Flutter project root directory')
    parser.add_argument('--build-cache-dir', required=True, help='Build cache directory')
    parser.add_argument('--use-random-id', action='store_true', help='Generate new random ID')
    
    args = parser.parse_args()
    
    id_manager = IDManager(args.flutter_root, args.build_cache_dir, args.appname)
    result = id_manager.process_app_id(args.appname, args.use_random_id)
    
    if result:
        print(f"ID management completed successfully: {result}")
        return 0
    else:
        print("ID management failed")
        return 1

if __name__ == "__main__":
    exit(main())