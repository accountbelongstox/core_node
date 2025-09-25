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
Pubspec Processor for Flutter Bloom Build System
Handles pubspec.yaml modifications for app-specific builds
"""

import os
import shutil
from typing import List

class PubspecProcessor:
    """Handles pubspec.yaml modifications for app-specific builds"""
    
    def __init__(self):
        pass
    
    def get_all_apps(self, working_dir: str) -> List[str]:
        """Get all app directories from lib/apps"""
        lib_apps_dir = os.path.join(working_dir, "lib", "apps")
        all_apps = []
        
        if os.path.exists(lib_apps_dir):
            all_apps = [d for d in os.listdir(lib_apps_dir) 
                       if os.path.isdir(os.path.join(lib_apps_dir, d)) and d.startswith("app_")]
        
        return all_apps
    
    def get_exclude_patterns(self, all_apps: List[str], target_app: str) -> List[str]:
        """Get asset patterns to exclude (other apps)"""
        exclude_patterns = []
        
        for other_app in all_apps:
            if other_app != target_app:
                exclude_patterns.extend([
                    f"assets/apps/{other_app}/",
                    f"assets/.internal_{other_app}/",
                    f"assets/{other_app}/"
                ])
        
        return exclude_patterns
    
    def modify_pubspec_yaml(self, working_dir: str, app_name: str) -> bool:
        """Modify pubspec.yaml to comment out other apps' assets"""
        pubspec_path = os.path.join(working_dir, "pubspec.yaml")
        
        if not os.path.exists(pubspec_path):
            print(f"[ERROR] pubspec.yaml not found at: {pubspec_path}")
            return False
        
        print(f"[INFO] Modifying pubspec.yaml for app: {app_name}")
        
        try:
            # Read original file
            with open(pubspec_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            # Create backup
            backup_path = f"{pubspec_path}.backup"
            with open(backup_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            
            # Get all apps and exclude patterns
            all_apps = self.get_all_apps(working_dir)
            exclude_patterns = self.get_exclude_patterns(all_apps, app_name)
            
            # Process lines
            modified_lines = []
            in_assets_section = False
            assets_indent_level = 0
            
            for line in lines:
                stripped = line.strip()
                
                # Detect assets section
                if stripped == 'assets:':
                    in_assets_section = True
                    assets_indent_level = len(line) - len(line.lstrip())
                    modified_lines.append(line)
                    continue
                
                if in_assets_section:
                    current_indent = len(line) - len(line.lstrip())
                    
                    # Check if we're still in assets section
                    if current_indent <= assets_indent_level and stripped and not stripped.startswith('#'):
                        in_assets_section = False
                        modified_lines.append(line)
                        continue
                    
                    # Check if this line should be commented out
                    should_comment = False
                    for pattern in exclude_patterns:
                        if pattern in line:
                            should_comment = True
                            break
                    
                    if should_comment and not stripped.startswith('#'):
                        # Comment out the line
                        indent = ' ' * current_indent
                        content = line[current_indent:]
                        commented_line = f"{indent}# {content}"
                        modified_lines.append(commented_line)
                        print(f"[INFO] Commented out: {stripped}")
                    else:
                        modified_lines.append(line)
                else:
                    modified_lines.append(line)
            
            # Write modified file
            with open(pubspec_path, 'w', encoding='utf-8') as f:
                f.writelines(modified_lines)
            
            print("[SUCCESS] pubspec.yaml modified successfully")
            return True
            
        except Exception as e:
            print(f"[ERROR] Failed to modify pubspec.yaml: {e}")
            return False
    
    def update_app_name(self, working_dir: str, new_name: str) -> bool:
        """Update app name in pubspec.yaml"""
        pubspec_path = os.path.join(working_dir, "pubspec.yaml")
        
        if not os.path.exists(pubspec_path):
            print(f"[ERROR] pubspec.yaml not found at: {pubspec_path}")
            return False
        
        try:
            # Read file
            with open(pubspec_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace name field
            lines = content.split('\n')
            modified_lines = []
            
            for line in lines:
                if line.strip().startswith('name:'):
                    modified_lines.append(f"name: {new_name}")
                    print(f"[INFO] Updated app name to: {new_name}")
                else:
                    modified_lines.append(line)
            
            # Write back
            with open(pubspec_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(modified_lines))
            
            return True
            
        except Exception as e:
            print(f"[ERROR] Failed to update app name: {e}")
            return False
    
    def update_description(self, working_dir: str, new_description: str) -> bool:
        """Update description in pubspec.yaml"""
        pubspec_path = os.path.join(working_dir, "pubspec.yaml")
        
        if not os.path.exists(pubspec_path):
            print(f"[ERROR] pubspec.yaml not found at: {pubspec_path}")
            return False
        
        try:
            # Read file
            with open(pubspec_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Replace description field
            lines = content.split('\n')
            modified_lines = []
            
            for line in lines:
                if line.strip().startswith('description:'):
                    modified_lines.append(f"description: {new_description}")
                    print(f"[INFO] Updated description to: {new_description}")
                else:
                    modified_lines.append(line)
            
            # Write back
            with open(pubspec_path, 'w', encoding='utf-8') as f:
                f.write('\n'.join(modified_lines))
            
            return True
            
        except Exception as e:
            print(f"[ERROR] Failed to update description: {e}")
            return False
    
    def restore_backup(self, working_dir: str) -> bool:
        """Restore pubspec.yaml from backup"""
        pubspec_path = os.path.join(working_dir, "pubspec.yaml")
        backup_path = f"{pubspec_path}.backup"
        
        if not os.path.exists(backup_path):
            print(f"[ERROR] Backup file not found: {backup_path}")
            return False
        
        try:
            shutil.copy2(backup_path, pubspec_path)
            print("[SUCCESS] pubspec.yaml restored from backup")
            return True
            
        except Exception as e:
            print(f"[ERROR] Failed to restore backup: {e}")
            return False
