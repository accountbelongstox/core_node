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
Resource Finder
Advanced resource finding with external/internal priority and extension fallback
Based on legacy find_res_by_build_dir.py but improved
"""

import os
from typing import Optional, List

class ResourceFinder:
    """Advanced resource finder with priority system"""
    
    def __init__(self, external_resources_dir: str, working_directory: str):
        self.external_resources_dir = external_resources_dir
        self.working_directory = working_directory
        
        # Ensure external resources directory exists
        os.makedirs(external_resources_dir, exist_ok=True)
    
    def find_app_resource(self, app_name: str, resource_filename: str, use_external: bool = True) -> Optional[str]:
        """Find app-specific resource with priority system"""
        
        # Priority 1: External app-specific directories (if enabled)
        if use_external:
            external_result = self.find_in_external_dirs(app_name, resource_filename)
            if external_result:
                return external_result
        
        # Priority 2: Internal app-specific directories
        internal_result = self.find_in_internal_dirs(app_name, resource_filename)
        if internal_result:
            return internal_result
        
        # Priority 3: Default/fallback resources
        default_result = self.find_in_default_dirs(resource_filename)
        if default_result:
            return default_result
        
        return None
    
    def find_in_external_dirs(self, app_name: str, resource_filename: str) -> Optional[str]:
        """Search in external resource directories"""
        
        # External directory patterns based on legacy code
        external_dirs = [
            os.path.join(self.external_resources_dir, f"{app_name}_icons"),
            os.path.join(self.external_resources_dir, f"{app_name}_images"),
            os.path.join(self.external_resources_dir, f"{app_name}_launch"),
            os.path.join(self.external_resources_dir, app_name),  # General app directory
            self.external_resources_dir  # Root external directory
        ]
        
        return self.search_in_directories(external_dirs, resource_filename)
    
    def find_in_internal_dirs(self, app_name: str, resource_filename: str) -> Optional[str]:
        """Search in internal app directories"""
        
        internal_dirs = [
            os.path.join(self.working_directory, 'lib', 'apps', app_name, 'assets'),
            os.path.join(self.working_directory, 'assets', f"{app_name}_icons"),
            os.path.join(self.working_directory, 'assets', f"{app_name}_images"),
            os.path.join(self.working_directory, 'assets', f"{app_name}_launch"),
            os.path.join(self.working_directory, 'assets', app_name)
        ]
        
        return self.search_in_directories(internal_dirs, resource_filename)
    
    def find_in_default_dirs(self, resource_filename: str) -> Optional[str]:
        """Search in default/fallback directories"""
        
        default_dirs = [
            os.path.join(self.working_directory, 'assets', 'defaults'),
            os.path.join(self.working_directory, 'assets', 'common'),
            os.path.join(self.working_directory, 'assets')
        ]
        
        return self.search_in_directories(default_dirs, resource_filename)
    
    def search_in_directories(self, directories: List[str], resource_filename: str) -> Optional[str]:
        """Search for resource in given directories with extension fallback"""
        
        base_name, original_ext = os.path.splitext(resource_filename)
        original_ext = original_ext.lower()
        
        # Define alternative extensions
        if original_ext == '.png':
            alt_extensions = ['.jpg', '.jpeg', '.webp']
        elif original_ext in ['.jpg', '.jpeg']:
            alt_extensions = ['.png', '.webp']
        elif original_ext == '.webp':
            alt_extensions = ['.png', '.jpg', '.jpeg']
        else:
            alt_extensions = ['.png', '.jpg', '.jpeg', '.webp']
        
        # Search for original filename first
        for directory in directories:
            if not directory or not os.path.isdir(directory):
                continue
            
            candidate_path = os.path.join(directory, resource_filename)
            if os.path.isfile(candidate_path) and self.is_valid_resource_file(candidate_path):
                return candidate_path
        
        # Search for alternative extensions
        for alt_ext in alt_extensions:
            alt_filename = base_name + alt_ext
            for directory in directories:
                if not directory or not os.path.isdir(directory):
                    continue
                
                candidate_path = os.path.join(directory, alt_filename)
                if os.path.isfile(candidate_path) and self.is_valid_resource_file(candidate_path):
                    return candidate_path
        
        return None
    
    def is_valid_resource_file(self, file_path: str) -> bool:
        """Check if resource file is valid (not a placeholder)"""
        
        if not os.path.isfile(file_path):
            return False
        
        # Check file size - skip very small files (likely 1px placeholders)
        file_size = os.path.getsize(file_path)
        if file_size < 100:  # Less than 100 bytes is likely a placeholder
            return False
        
        # Check if it's an image file
        valid_extensions = ['.png', '.jpg', '.jpeg', '.webp', '.ico', '.bmp', '.gif']
        file_ext = os.path.splitext(file_path)[1].lower()
        
        if file_ext not in valid_extensions:
            return False
        
        # Additional check for 1x1 pixel images using PIL if available
        try:
            from PIL import Image
            with Image.open(file_path) as img:
                width, height = img.size
                if width <= 1 and height <= 1:
                    return False  # Skip 1x1 placeholder images
        except ImportError:
            # PIL not available, skip pixel size check
            pass
        except Exception:
            # Error opening image, consider it invalid
            return False
        
        return True
    
    def create_external_resource_structure(self, app_name: str):
        """Create external resource directory structure for an app"""
        
        app_dirs = [
            os.path.join(self.external_resources_dir, f"{app_name}_icons"),
            os.path.join(self.external_resources_dir, f"{app_name}_images"),
            os.path.join(self.external_resources_dir, f"{app_name}_launch"),
            os.path.join(self.external_resources_dir, app_name)
        ]
        
        for app_dir in app_dirs:
            os.makedirs(app_dir, exist_ok=True)
        
        # Create README file with instructions
        readme_path = os.path.join(self.external_resources_dir, f"{app_name}_README.txt")
        with open(readme_path, 'w', encoding='utf-8') as f:
            f.write(f"External Resources for {app_name}\n")
            f.write("=" * 40 + "\n\n")
            f.write(f"{app_name}_icons/    - App icons (icon.png, ic_notification.png)\n")
            f.write(f"{app_name}_images/   - General images\n")
            f.write(f"{app_name}_launch/   - Launch/splash screen images\n")
            f.write(f"{app_name}/          - General app resources\n\n")
            f.write("Note: External resources take priority over internal resources during build.\n")
    
    def list_available_resources(self, app_name: str) -> dict:
        """List all available resources for an app"""
        
        resources = {
            'external': [],
            'internal': [],
            'default': []
        }
        
        # Scan external directories
        external_dirs = [
            os.path.join(self.external_resources_dir, f"{app_name}_icons"),
            os.path.join(self.external_resources_dir, f"{app_name}_images"),
            os.path.join(self.external_resources_dir, f"{app_name}_launch"),
            os.path.join(self.external_resources_dir, app_name)
        ]
        
        for ext_dir in external_dirs:
            if os.path.isdir(ext_dir):
                for file in os.listdir(ext_dir):
                    file_path = os.path.join(ext_dir, file)
                    if self.is_valid_resource_file(file_path):
                        resources['external'].append(os.path.relpath(file_path, self.external_resources_dir))
        
        # Scan internal directories
        internal_dirs = [
            os.path.join(self.working_directory, 'lib', 'apps', app_name, 'assets'),
            os.path.join(self.working_directory, 'assets', f"{app_name}_icons"),
            os.path.join(self.working_directory, 'assets', f"{app_name}_images"),
            os.path.join(self.working_directory, 'assets', f"{app_name}_launch")
        ]
        
        for int_dir in internal_dirs:
            if os.path.isdir(int_dir):
                for file in os.listdir(int_dir):
                    file_path = os.path.join(int_dir, file)
                    if self.is_valid_resource_file(file_path):
                        resources['internal'].append(os.path.relpath(file_path, self.working_directory))
        
        return resources
