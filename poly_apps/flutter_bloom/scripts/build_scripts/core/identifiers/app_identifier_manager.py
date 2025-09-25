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
App Identifier Manager
Handles app name and package ID replacement across all platform files
"""

import os
import re
import random
import string
from typing import Dict, List, Any

class AppIdentifierManager:
    """Manages app name and package ID replacement"""
    
    def __init__(self, working_directory: str):
        self.working_directory = working_directory
        self.replacement_results = []
    
    def process_app_identifiers(self, app_name: str, app_config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Process app name and package ID replacements"""
        
        # Get configuration
        config_app_name = self.get_config_value(app_config, 'build', 'app_name', '')
        config_package_id = self.get_config_value(app_config, 'build', 'package_id', '')
        random_app_name = self.get_config_value(app_config, 'build', 'random_app_name', 'false').lower() == 'true'
        random_package_id = self.get_config_value(app_config, 'build', 'random_package_id', 'false').lower() == 'true'
        
        # Generate final identifiers
        final_app_name = self.generate_app_name(config_app_name, random_app_name)
        final_package_id = self.generate_package_id(config_package_id, random_package_id)
        
        print(f"[INFO] App Identifier Configuration:")
        print(f"  Final App Name: {final_app_name}")
        print(f"  Final Package ID: {final_package_id}")
        print(f"  Random App Name: {random_app_name}")
        print(f"  Random Package ID: {random_package_id}")
        
        # Replace in all platform files
        self.replace_in_android_files(final_app_name, final_package_id)
        self.replace_in_web_files(final_app_name, final_package_id)
        self.replace_in_windows_files(final_app_name, final_package_id)
        self.replace_in_macos_files(final_app_name, final_package_id)
        self.replace_in_ios_files(final_app_name, final_package_id)
        self.replace_in_pubspec_yaml(final_app_name, final_package_id)

        # Create MainActivity.java with correct package name
        self.create_main_activity(final_package_id)

        # Remove old MainActivity files to prevent conflicts
        self.remove_old_main_activity_files()
        
        return self.replacement_results
    
    def generate_app_name(self, config_name: str, random_name: bool) -> str:
        """Generate final app name (must be valid Dart identifier)"""
        if random_name:
            adjectives = ['Amazing', 'Brilliant', 'Creative', 'Dynamic', 'Elegant', 'Fantastic', 'Great', 'Innovative']
            nouns = ['App', 'Tool', 'Helper', 'Manager', 'Studio', 'Pro', 'Plus', 'Express']
            return f"{random.choice(adjectives)}{random.choice(nouns)}"  # No space for Dart identifier
        elif config_name:
            # Convert to valid Dart identifier
            return self.to_dart_identifier(config_name)
        else:
            return "flutter_bloom_app"  # Valid Dart identifier

    def to_dart_identifier(self, name: str) -> str:
        """Convert string to valid Dart identifier"""
        # Replace spaces and special characters with underscores
        import re
        # Convert to lowercase and replace non-alphanumeric characters with underscores
        dart_name = re.sub(r'[^a-zA-Z0-9_]', '_', name.lower())
        # Ensure it doesn't start with a number
        if dart_name and dart_name[0].isdigit():
            dart_name = 'app_' + dart_name
        # Remove multiple consecutive underscores
        dart_name = re.sub(r'_+', '_', dart_name)
        # Remove leading/trailing underscores
        dart_name = dart_name.strip('_')
        # Ensure it's not empty
        if not dart_name:
            dart_name = 'flutter_app'
        return dart_name

    def generate_package_id(self, config_package_id: str, random_package_id: bool) -> str:
        """Generate final package ID"""
        if random_package_id:
            # Generate random package ID
            company = ''.join(random.choices(string.ascii_lowercase, k=6))
            app = ''.join(random.choices(string.ascii_lowercase, k=8))
            return f"com.{company}.{app}"
        elif config_package_id:
            return config_package_id
        else:
            return "com.flutterbloom.app"
    
    def replace_in_android_files(self, app_name: str, package_id: str):
        """Replace identifiers in Android files"""
        android_dir = os.path.join(self.working_directory, 'android')
        if not os.path.exists(android_dir):
            return
        
        # Files to process
        files_to_process = [
            'app/build.gradle',
            'app/src/main/AndroidManifest.xml',
            'app/src/debug/AndroidManifest.xml',
            'app/src/profile/AndroidManifest.xml',
            'app/google-services.json'
        ]
        
        for file_path in files_to_process:
            full_path = os.path.join(android_dir, file_path)
            if os.path.exists(full_path):
                self.replace_in_file(full_path, 'android', {
                    'app_name': app_name,
                    'package_id': package_id
                })
    
    def replace_in_web_files(self, app_name: str, package_id: str):
        """Replace identifiers in Web files"""
        web_dir = os.path.join(self.working_directory, 'web')
        if not os.path.exists(web_dir):
            return
        
        files_to_process = [
            'index.html',
            'manifest.json'
        ]
        
        for file_path in files_to_process:
            full_path = os.path.join(web_dir, file_path)
            if os.path.exists(full_path):
                self.replace_in_file(full_path, 'web', {
                    'app_name': app_name,
                    'package_id': package_id
                })
    
    def replace_in_windows_files(self, app_name: str, package_id: str):
        """Replace identifiers in Windows files"""
        windows_dir = os.path.join(self.working_directory, 'windows')
        if not os.path.exists(windows_dir):
            return
        
        files_to_process = [
            'runner/Runner.rc',
            'runner/main.cpp'
        ]
        
        for file_path in files_to_process:
            full_path = os.path.join(windows_dir, file_path)
            if os.path.exists(full_path):
                self.replace_in_file(full_path, 'windows', {
                    'app_name': app_name,
                    'package_id': package_id
                })
    
    def replace_in_macos_files(self, app_name: str, package_id: str):
        """Replace identifiers in macOS files"""
        macos_dir = os.path.join(self.working_directory, 'macos')
        if not os.path.exists(macos_dir):
            return
        
        files_to_process = [
            'Runner/Info.plist',
            'Runner.xcodeproj/project.pbxproj'
        ]
        
        for file_path in files_to_process:
            full_path = os.path.join(macos_dir, file_path)
            if os.path.exists(full_path):
                self.replace_in_file(full_path, 'macos', {
                    'app_name': app_name,
                    'package_id': package_id
                })
    
    def replace_in_ios_files(self, app_name: str, package_id: str):
        """Replace identifiers in iOS files"""
        ios_dir = os.path.join(self.working_directory, 'ios')
        if not os.path.exists(ios_dir):
            return
        
        files_to_process = [
            'Runner/Info.plist',
            'Runner.xcodeproj/project.pbxproj'
        ]
        
        for file_path in files_to_process:
            full_path = os.path.join(ios_dir, file_path)
            if os.path.exists(full_path):
                self.replace_in_file(full_path, 'ios', {
                    'app_name': app_name,
                    'package_id': package_id
                })
    
    def replace_in_pubspec_yaml(self, app_name: str, package_id: str):
        """Replace identifiers in pubspec.yaml"""
        pubspec_path = os.path.join(self.working_directory, 'pubspec.yaml')
        if os.path.exists(pubspec_path):
            self.replace_in_file(pubspec_path, 'flutter', {
                'app_name': app_name,
                'package_id': package_id
            })
    
    def replace_in_file(self, file_path: str, platform: str, replacements: Dict[str, str]):
        """Replace identifiers in a specific file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            replacement_count = 0
            
            # Define replacement patterns for different platforms
            patterns = self.get_replacement_patterns(platform)
            
            for pattern_type, pattern in patterns.items():
                if pattern_type == 'app_name':
                    if platform == 'flutter':
                        # Special handling for Flutter pubspec.yaml to preserve "name:" prefix
                        new_content = re.sub(r'(name:\s*)[^\s\n]+', f'\\1{replacements["app_name"]}', content)
                    elif platform == 'android':
                        # Special handling for Android to preserve android:label=" prefix
                        new_content = re.sub(r'(android:label=")[^"]*(")', f'\\1{replacements["app_name"]}\\2', content)
                    elif platform == 'web':
                        # Special handling for Web to preserve "name": prefix
                        new_content = re.sub(r'("name":\s*")[^"]*(")', f'\\1{replacements["app_name"]}\\2', content)
                    else:
                        new_content = re.sub(pattern, replacements['app_name'], content, flags=re.IGNORECASE)
                    if new_content != content:
                        replacement_count += 1
                        content = new_content
                
                elif pattern_type == 'package_id':
                    if platform == 'android':
                        # Special handling for Android files
                        if 'google-services.json' in file_path:
                            # Handle google-services.json format
                            new_content = re.sub(r'("package_name":\s*")[^"]*(")', f'\\1{replacements["package_id"]}\\2', content)
                        else:
                            # Handle build.gradle format
                            new_content = re.sub(r'(applicationId\s+")[^"]*(")', f'\\1{replacements["package_id"]}\\2', content)
                            # Remove package attribute from AndroidManifest.xml (no longer supported in newer Flutter)
                            if 'AndroidManifest.xml' in file_path:
                                new_content = re.sub(r'\s*package\s*=\s*"[^"]*"', '', new_content)
                    else:
                        new_content = re.sub(pattern, replacements['package_id'], content)
                    if new_content != content:
                        replacement_count += 1
                        content = new_content
            
            # Write back if changes were made
            if content != original_content:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                
                relative_path = os.path.relpath(file_path, self.working_directory)
                self.replacement_results.append({
                    'platform': platform,
                    'file_path': relative_path,
                    'replacement_count': replacement_count,
                    'status': 'success'
                })
                
                print(f"[SUCCESS] Updated {platform} file: {relative_path} ({replacement_count} replacements)")
        
        except Exception as e:
            relative_path = os.path.relpath(file_path, self.working_directory)
            print(f"[ERROR] Failed to update {platform} file {relative_path}: {str(e)}")
            self.replacement_results.append({
                'platform': platform,
                'file_path': relative_path,
                'replacement_count': 0,
                'status': 'error',
                'error': str(e)
            })
    
    def get_replacement_patterns(self, platform: str) -> Dict[str, str]:
        """Get replacement patterns for each platform"""
        patterns = {
            'android': {
                'app_name': r'android:label="[^"]*"',
                'package_id': r'applicationId\s+"[^"]*"'
            },
            'web': {
                'app_name': r'"name":\s*"[^"]*"',
                'package_id': r'"start_url":\s*"[^"]*"'
            },
            'windows': {
                'app_name': r'VALUE "ProductName",\s*"[^"]*"'
            },
            'flutter': {
                'app_name': r'name:\s*[^\s\n]+'
            }
        }
        
        return patterns.get(platform, {})
    
    def create_main_activity(self, package_id: str):
        """Create MainActivity.java with correct package name"""
        try:
            # Convert package ID to directory path
            package_path = package_id.replace('.', os.sep)
            java_dir = os.path.join(self.working_directory, 'android', 'app', 'src', 'main', 'java', package_path)

            # Create directory if it doesn't exist
            os.makedirs(java_dir, exist_ok=True)

            # Create MainActivity.java content
            main_activity_content = f"""package {package_id};

import io.flutter.embedding.android.FlutterActivity;

public class MainActivity extends FlutterActivity {{
}}"""

            # Write MainActivity.java file
            main_activity_path = os.path.join(java_dir, 'MainActivity.java')
            with open(main_activity_path, 'w', encoding='utf-8') as f:
                f.write(main_activity_content)

            relative_path = os.path.relpath(main_activity_path, self.working_directory)
            self.replacement_results.append({
                'platform': 'android',
                'file_path': relative_path,
                'replacement_count': 1,
                'status': 'created'
            })

            print(f"[SUCCESS] Created MainActivity.java: {relative_path}")

        except Exception as e:
            print(f"[ERROR] Failed to create MainActivity.java: {str(e)}")
            self.replacement_results.append({
                'platform': 'android',
                'file_path': 'MainActivity.java',
                'replacement_count': 0,
                'status': 'error',
                'error': str(e)
            })

    def remove_old_main_activity_files(self):
        """Remove old MainActivity files to prevent conflicts"""
        try:
            # Common old package paths that might exist
            old_package_paths = [
                'android/app/src/main/java/com/ddsj/qyapp',
                'android/app/src/main/java/io/flutter/plugins',
                'android/app/src/main/kotlin/com/ddsj/qyapp'
            ]

            for old_path in old_package_paths:
                old_main_activity_dir = os.path.join(self.working_directory, old_path)
                if os.path.exists(old_main_activity_dir):
                    # Remove MainActivity files
                    for file_name in ['MainActivity.java', 'MainActivity.kt']:
                        old_file_path = os.path.join(old_main_activity_dir, file_name)
                        if os.path.exists(old_file_path):
                            os.remove(old_file_path)
                            relative_path = os.path.relpath(old_file_path, self.working_directory)
                            print(f"[SUCCESS] Removed old MainActivity: {relative_path}")

                    # Remove empty directories
                    try:
                        if os.path.exists(old_main_activity_dir) and not os.listdir(old_main_activity_dir):
                            os.rmdir(old_main_activity_dir)
                    except OSError:
                        pass  # Directory not empty, that's fine

        except Exception as e:
            print(f"[WARNING] Failed to remove old MainActivity files: {str(e)}")

    def get_config_value(self, config: Dict[str, Any], section: str, key: str, default: Any) -> Any:
        """Get configuration value with default fallback"""
        return config.get(section, {}).get(key, default)
