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
Pubspec Configuration Manager
Handles pubspec.yaml configuration for build isolation
"""

import os
import re
import shutil
from typing import List

class PubspecConfigurationManager:
    """Manages pubspec.yaml configuration for build"""
    
    def __init__(self, working_directory: str):
        self.working_directory = working_directory
        self.pubspec_path = os.path.join(working_directory, 'pubspec.yaml')
        self.backup_path = os.path.join(working_directory, 'pubspec.yaml.backup')
    
    def configure_for_build(self, target_app: str):
        """Configure pubspec.yaml for single app build"""
        if not os.path.exists(self.pubspec_path):
            print(f"[ERROR] pubspec.yaml not found: {self.pubspec_path}")
            return False
        
        print(f"[INFO] Configuring pubspec.yaml for app: {target_app}")
        
        # Create backup
        shutil.copy2(self.pubspec_path, self.backup_path)
        
        try:
            with open(self.pubspec_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Comment out other app directories
            modified_content = self.comment_out_other_apps(content, target_app)
            
            # Remove other sub-app static directories
            modified_content = self.remove_other_app_assets(modified_content, target_app)
            
            # Write modified content
            with open(self.pubspec_path, 'w', encoding='utf-8') as f:
                f.write(modified_content)
            
            print(f"[SUCCESS] pubspec.yaml configured for {target_app}")
            return True
            
        except Exception as e:
            print(f"[ERROR] Failed to configure pubspec.yaml: {str(e)}")
            # Restore backup
            if os.path.exists(self.backup_path):
                shutil.copy2(self.backup_path, self.pubspec_path)
            return False
    
    def comment_out_other_apps(self, content: str, target_app: str) -> str:
        """Comment out other app directories in pubspec.yaml"""
        lines = content.split('\n')
        modified_lines = []
        in_flutter_section = False
        in_assets_section = False
        
        for line in lines:
            stripped_line = line.strip()
            
            # Track sections
            if stripped_line.startswith('flutter:'):
                in_flutter_section = True
                in_assets_section = False
            elif stripped_line.startswith('assets:'):
                in_assets_section = True
            elif stripped_line and not line.startswith(' ') and not line.startswith('\t'):
                in_flutter_section = False
                in_assets_section = False
            
            # Process app directory references
            if in_flutter_section and in_assets_section:
                if self.is_app_directory_reference(stripped_line):
                    app_name = self.extract_app_name_from_line(stripped_line)
                    if app_name and app_name != target_app:
                        # Comment out this line
                        modified_lines.append(f"    # {stripped_line}  # Commented out for {target_app} build")
                        continue
            
            modified_lines.append(line)
        
        return '\n'.join(modified_lines)
    
    def remove_other_app_assets(self, content: str, target_app: str) -> str:
        """Remove other sub-app static directories from assets"""
        lines = content.split('\n')
        modified_lines = []
        
        for line in lines:
            stripped_line = line.strip()
            
            # Check if this is an asset line for another app
            if self.is_other_app_asset_line(stripped_line, target_app):
                # Comment out this asset line
                modified_lines.append(f"    # {stripped_line}  # Removed for {target_app} build")
            else:
                modified_lines.append(line)
        
        return '\n'.join(modified_lines)
    
    def is_app_directory_reference(self, line: str) -> bool:
        """Check if line references an app directory"""
        app_patterns = [
            r'- lib/apps/\w+/',
            r'- assets/apps/\w+/',
            r'lib/apps/\w+/assets/'
        ]
        
        for pattern in app_patterns:
            if re.search(pattern, line):
                return True
        
        return False
    
    def extract_app_name_from_line(self, line: str) -> str:
        """Extract app name from asset line"""
        # Pattern to match app names in asset paths
        patterns = [
            r'lib/apps/(\w+)/',
            r'assets/apps/(\w+)/',
            r'apps/(\w+)/'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                return match.group(1)
        
        return ""
    
    def is_other_app_asset_line(self, line: str, target_app: str) -> bool:
        """Check if line is an asset line for another app"""
        if not line.startswith('- '):
            return False
        
        # Extract app name from the line
        app_name = self.extract_app_name_from_line(line)
        
        # If we found an app name and it's not the target app, remove it
        return app_name and app_name != target_app
    
    def restore_backup(self):
        """Restore pubspec.yaml from backup"""
        if os.path.exists(self.backup_path):
            shutil.copy2(self.backup_path, self.pubspec_path)
            print(f"[INFO] Restored pubspec.yaml from backup")
        else:
            print(f"[WARNING] No backup found to restore")
    
    def cleanup_backup(self):
        """Remove backup file"""
        if os.path.exists(self.backup_path):
            os.remove(self.backup_path)
            print(f"[INFO] Cleaned up pubspec.yaml backup")
    
    def get_app_directories(self) -> List[str]:
        """Get list of app directories from pubspec.yaml"""
        if not os.path.exists(self.pubspec_path):
            return []
        
        app_dirs = []
        
        try:
            with open(self.pubspec_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Find all app directory references
            patterns = [
                r'- lib/apps/(\w+)/',
                r'- assets/apps/(\w+)/',
                r'lib/apps/(\w+)/assets/'
            ]
            
            for pattern in patterns:
                matches = re.findall(pattern, content)
                app_dirs.extend(matches)
            
            # Remove duplicates and return
            return list(set(app_dirs))
            
        except Exception as e:
            print(f"[ERROR] Failed to read app directories: {str(e)}")
            return []
