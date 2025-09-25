"""
Import Updater - Updates package import statements in Dart files
"""

import os
import re
from typing import List, Dict, Any

class ImportUpdater:
    """Updates package import statements in Dart files"""
    
    def __init__(self, working_directory: str):
        self.working_directory = working_directory
        self.update_results = []
    
    def update_imports(self, old_package_name: str, new_package_name: str) -> List[Dict[str, Any]]:
        """Update all import statements from old package name to new package name"""
        print(f"[INFO] Updating imports from '{old_package_name}' to '{new_package_name}'")
        
        # Find all Dart files
        dart_files = self.find_dart_files()
        
        for dart_file in dart_files:
            self.update_file_imports(dart_file, old_package_name, new_package_name)
        
        return self.update_results
    
    def find_dart_files(self) -> List[str]:
        """Find all Dart files in the project"""
        dart_files = []
        
        # Search in lib directory
        lib_dir = os.path.join(self.working_directory, 'lib')
        if os.path.exists(lib_dir):
            for root, dirs, files in os.walk(lib_dir):
                for file in files:
                    if file.endswith('.dart'):
                        dart_files.append(os.path.join(root, file))
        
        return dart_files
    
    def update_file_imports(self, file_path: str, old_package_name: str, new_package_name: str):
        """Update import statements in a single Dart file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            original_content = content
            
            # Pattern to match package imports
            import_pattern = rf"import\s+['\"]package:{re.escape(old_package_name)}/([^'\"]*)['\"]"
            
            # Replace with new package name
            def replace_import(match):
                path_part = match.group(1)
                return f"import 'package:{new_package_name}/{path_part}'"
            
            updated_content = re.sub(import_pattern, replace_import, content)
            
            # Count replacements
            replacement_count = len(re.findall(import_pattern, content))
            
            if updated_content != original_content:
                # Write updated content
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(updated_content)
                
                relative_path = os.path.relpath(file_path, self.working_directory)
                self.update_results.append({
                    'file_path': relative_path,
                    'replacement_count': replacement_count,
                    'status': 'success'
                })
                
                print(f"[SUCCESS] Updated imports in: {relative_path} ({replacement_count} replacements)")
            
        except Exception as e:
            relative_path = os.path.relpath(file_path, self.working_directory)
            self.update_results.append({
                'file_path': relative_path,
                'replacement_count': 0,
                'status': 'error',
                'error': str(e)
            })
            print(f"[ERROR] Failed to update imports in {relative_path}: {str(e)}")
