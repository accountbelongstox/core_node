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
Package Replacer for Flutter Bloom Build System
Handles package ID and app name replacement in platform-specific files
"""

import os
import re
import random
import string
from typing import Dict, List, Optional

class PackageReplacer:
    """Handles package ID and app name replacement across platforms"""
    
    def __init__(self):
        # Platform-specific file patterns and replacement rules
        self.replacement_rules = {
            "android": {
                "files": [
                    "android/app/build.gradle",
                    "android/app/src/main/AndroidManifest.xml",
                    "android/app/src/debug/AndroidManifest.xml",
                    "android/app/src/profile/AndroidManifest.xml",
                    "android/app/google-services.json"
                ],
                "package_patterns": [
                    r'applicationId\s*["\']([^"\']+)["\']',
                    r'package\s*=\s*["\']([^"\']+)["\']',
                    r'"package_name":\s*"([^"]+)"'
                ],
                "name_patterns": [
                    r'android:label\s*=\s*["\']([^"\']+)["\']'
                ]
            },
            "ios": {
                "files": [
                    "ios/Runner/Info.plist",
                    "ios/Runner.xcodeproj/project.pbxproj"
                ],
                "package_patterns": [
                    r'<key>CFBundleIdentifier</key>\s*<string>([^<]+)</string>',
                    r'PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);'
                ],
                "name_patterns": [
                    r'<key>CFBundleDisplayName</key>\s*<string>([^<]+)</string>',
                    r'<key>CFBundleName</key>\s*<string>([^<]+)</string>'
                ]
            },
            "web": {
                "files": [
                    "web/index.html",
                    "web/manifest.json"
                ],
                "package_patterns": [],
                "name_patterns": [
                    r'<title>([^<]+)</title>',
                    r'"name":\s*"([^"]+)"',
                    r'"short_name":\s*"([^"]+)"'
                ]
            },
            "windows": {
                "files": [
                    "windows/runner/Runner.rc",
                    "windows/runner/main.cpp"
                ],
                "package_patterns": [],
                "name_patterns": [
                    r'VALUE\s+"ProductName",\s+"([^"]+)"',
                    r'VALUE\s+"InternalName",\s+"([^"]+)"'
                ]
            },
            "macos": {
                "files": [
                    "macos/Runner/Info.plist",
                    "macos/Runner.xcodeproj/project.pbxproj"
                ],
                "package_patterns": [
                    r'<key>CFBundleIdentifier</key>\s*<string>([^<]+)</string>',
                    r'PRODUCT_BUNDLE_IDENTIFIER\s*=\s*([^;]+);'
                ],
                "name_patterns": [
                    r'<key>CFBundleDisplayName</key>\s*<string>([^<]+)</string>',
                    r'<key>CFBundleName</key>\s*<string>([^<]+)</string>'
                ]
            }
        }
    
    def generate_random_package_id(self, base_domain: str = "com.flutter") -> str:
        """Generate random package ID"""
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        return f"{base_domain}.app_{random_suffix}"
    
    def generate_random_app_name(self) -> str:
        """Generate random app name"""
        adjectives = [
            'Amazing', 'Super', 'Cool', 'Smart', 'Fast', 'Modern', 'Pro',
            'Ultimate', 'Advanced', 'Premium', 'Elite', 'Perfect', 'Awesome'
        ]
        nouns = [
            'App', 'Tool', 'Helper', 'Manager', 'Studio', 'Hub', 'Center',
            'Suite', 'Platform', 'Solution', 'System', 'Engine'
        ]
        return f"{random.choice(adjectives)} {random.choice(nouns)}"
    
    def find_files_to_replace(self, working_dir: str, platform: str) -> List[str]:
        """Find files that need package/name replacement for a platform"""
        files_to_replace = []

        if platform not in self.replacement_rules:
            return files_to_replace

        file_patterns = self.replacement_rules[platform]["files"]

        for pattern in file_patterns:
            file_path = os.path.join(working_dir, pattern)
            if os.path.exists(file_path):
                files_to_replace.append(file_path)

        return files_to_replace
    
    def find_current_package_id(self, working_dir: str, platform: str) -> Optional[str]:
        """Find current package ID in platform files"""
        if platform not in self.replacement_rules:
            return None
        
        files = self.find_files_to_replace(working_dir, platform)
        patterns = self.replacement_rules[platform]["package_patterns"]
        
        for file_path in files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                for pattern in patterns:
                    match = re.search(pattern, content)
                    if match:
                        return match.group(1)
            except Exception as e:
                print(f"[WARNING] Failed to read {file_path}: {e}")
        
        return None
    
    def find_current_app_name(self, working_dir: str, platform: str) -> Optional[str]:
        """Find current app name in platform files"""
        if platform not in self.replacement_rules:
            return None
        
        files = self.find_files_to_replace(working_dir, platform)
        patterns = self.replacement_rules[platform]["name_patterns"]
        
        for file_path in files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                for pattern in patterns:
                    match = re.search(pattern, content)
                    if match:
                        return match.group(1)
            except Exception as e:
                print(f"[WARNING] Failed to read {file_path}: {e}")
        
        return None
    
    def replace_package_id(self, working_dir: str, platform: str, old_package_id: str, new_package_id: str) -> bool:
        """Replace package ID in platform files"""
        if platform not in self.replacement_rules:
            return False
        
        files = self.find_files_to_replace(working_dir, platform)
        patterns = self.replacement_rules[platform]["package_patterns"]
        
        success = True
        
        for file_path in files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                original_content = content
                
                for pattern in patterns:
                    # Replace using regex substitution
                    def replace_func(match):
                        if match.group(1) == old_package_id:
                            return match.group(0).replace(old_package_id, new_package_id)
                        return match.group(0)
                    
                    content = re.sub(pattern, replace_func, content)
                
                # Only write if content changed
                if content != original_content:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"[SUCCESS] Updated package ID in {file_path}")
                
            except Exception as e:
                print(f"[ERROR] Failed to update package ID in {file_path}: {e}")
                success = False
        
        return success
    
    def replace_app_name(self, working_dir: str, platform: str, old_app_name: str, new_app_name: str) -> bool:
        """Replace app name in platform files"""
        if platform not in self.replacement_rules:
            return False
        
        files = self.find_files_to_replace(working_dir, platform)
        patterns = self.replacement_rules[platform]["name_patterns"]
        
        success = True
        
        for file_path in files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                original_content = content
                
                for pattern in patterns:
                    # Replace using regex substitution
                    def replace_func(match):
                        if match.group(1) == old_app_name:
                            return match.group(0).replace(old_app_name, new_app_name)
                        return match.group(0)
                    
                    content = re.sub(pattern, replace_func, content)
                
                # Only write if content changed
                if content != original_content:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"[SUCCESS] Updated app name in {file_path}")
                
            except Exception as e:
                print(f"[ERROR] Failed to update app name in {file_path}: {e}")
                success = False
        
        return success
    
    def process_all_platforms(self, working_dir: str, app_config: Dict) -> Dict:
        """Process package ID and app name replacement for all platforms"""
        print("[INFO] Processing package ID and app name replacement...")
        
        # Get configuration
        package_settings = app_config.get("package_settings", {})
        app_info = app_config.get("app_info", {})
        
        # Determine new values
        if package_settings.get("random_package_id", "false").lower() == "true":
            new_package_id = self.generate_random_package_id()
        else:
            new_package_id = package_settings.get("default_package_id", "com.example.app")
        
        if package_settings.get("random_display_name", "false").lower() == "true":
            new_app_name = self.generate_random_app_name()
        else:
            new_app_name = app_info.get("display_name_english", "Flutter App")
        
        replacement_results = {
            "new_package_id": new_package_id,
            "new_app_name": new_app_name,
            "platforms": {},
            "errors": []
        }
        
        # Process each platform
        platforms = ["android", "ios", "web", "windows", "macos"]
        
        for platform in platforms:
            platform_path = os.path.join(working_dir, platform)
            if not os.path.exists(platform_path):
                continue
            
            print(f"[INFO] Processing {platform} platform...")
            
            # Find current values
            current_package_id = self.find_current_package_id(working_dir, platform)
            current_app_name = self.find_current_app_name(working_dir, platform)
            
            platform_result = {
                "old_package_id": current_package_id,
                "old_app_name": current_app_name,
                "package_id_success": False,
                "app_name_success": False
            }
            
            # Replace package ID if found
            if current_package_id and current_package_id != new_package_id:
                platform_result["package_id_success"] = self.replace_package_id(
                    working_dir, platform, current_package_id, new_package_id
                )
            
            # Replace app name if found
            if current_app_name and current_app_name != new_app_name:
                platform_result["app_name_success"] = self.replace_app_name(
                    working_dir, platform, current_app_name, new_app_name
                )
            
            replacement_results["platforms"][platform] = platform_result
        
        print(f"[SUCCESS] Package replacement completed")
        print(f"[INFO] New package ID: {new_package_id}")
        print(f"[INFO] New app name: {new_app_name}")
        
        return replacement_results
