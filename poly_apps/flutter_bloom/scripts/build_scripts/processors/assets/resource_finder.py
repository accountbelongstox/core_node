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
Resource Finder for Flutter Bloom Build System
Finds and locates external and internal resources
"""

import os
from typing import Optional, List
from core.constants.build_constants import EXTERNAL_RESOURCES_DIR, IMAGE_EXTENSIONS

class ResourceFinder:
    """Finds external and internal resources for app compilation"""
    
    def __init__(self):
        self.external_resources_dir = EXTERNAL_RESOURCES_DIR
        self.image_extensions = IMAGE_EXTENSIONS
    
    def find_external_resource(self, app_name: str, resource_filename: str) -> Optional[str]:
        """Find resource in external resources directory"""
        app_resource_dir = os.path.join(self.external_resources_dir, app_name)
        
        # Search in different subdirectories
        search_dirs = [
            os.path.join(app_resource_dir, "icon"),
            os.path.join(app_resource_dir, "splash"),
            os.path.join(app_resource_dir, "background"),
            os.path.join(app_resource_dir, "assets"),
            app_resource_dir
        ]
        
        # Try exact filename first
        for search_dir in search_dirs:
            if os.path.exists(search_dir):
                resource_path = os.path.join(search_dir, resource_filename)
                if os.path.exists(resource_path):
                    return resource_path
        
        # Try with different extensions
        base_name = os.path.splitext(resource_filename)[0]
        for search_dir in search_dirs:
            if os.path.exists(search_dir):
                for ext in self.image_extensions:
                    resource_path = os.path.join(search_dir, f"{base_name}{ext}")
                    if os.path.exists(resource_path):
                        return resource_path
        
        return None
    
    def find_internal_resource(self, working_dir: str, resource_filename: str) -> Optional[str]:
        """Find resource in internal assets directory"""
        assets_dir = os.path.join(working_dir, "assets")
        
        if not os.path.exists(assets_dir):
            return None
        
        # Search recursively in assets directory
        for root, dirs, files in os.walk(assets_dir):
            for file in files:
                if file == resource_filename:
                    return os.path.join(root, file)
        
        # Try with different extensions
        base_name = os.path.splitext(resource_filename)[0]
        for root, dirs, files in os.walk(assets_dir):
            for file in files:
                file_base = os.path.splitext(file)[0]
                if file_base == base_name and any(file.lower().endswith(ext) for ext in self.image_extensions):
                    return os.path.join(root, file)
        
        return None
    
    def find_platform_images(self, working_dir: str, platform: str) -> List[str]:
        """Find all images in a specific platform directory"""
        platform_path = os.path.join(working_dir, platform)
        images = []
        
        if not os.path.exists(platform_path):
            return images
        
        for root, dirs, files in os.walk(platform_path):
            for file in files:
                if any(file.lower().endswith(ext) for ext in self.image_extensions):
                    images.append(os.path.join(root, file))
        
        return images
    
    def find_all_platform_images(self, working_dir: str) -> dict:
        """Find all images in all platform directories"""
        platforms = ["android", "ios", "web", "windows", "macos"]
        all_images = {}
        
        for platform in platforms:
            all_images[platform] = self.find_platform_images(working_dir, platform)
        
        return all_images
    
    def get_resource_priority_list(self, app_name: str, resource_filename: str, working_dir: str, use_external: bool = True) -> List[str]:
        """Get prioritized list of resource locations"""
        resources = []
        
        if use_external:
            # Try external resources first
            external_resource = self.find_external_resource(app_name, resource_filename)
            if external_resource:
                resources.append(external_resource)
        
        # Fallback to internal resources
        internal_resource = self.find_internal_resource(working_dir, resource_filename)
        if internal_resource:
            resources.append(internal_resource)
        
        return resources
    
    def map_icon_name(self, filename: str) -> str:
        """Map common icon names to standard names"""
        base_name = os.path.splitext(filename)[0].lower()
        
        icon_mappings = {
            "ic_launcher": "icon",
            "launcher_icon": "icon",
            "app_icon": "icon",
            "ic_notification": "notification_icon",
            "notification": "notification_icon",
            "small_icon": "notification_icon",
            "splash_screen": "splash",
            "launch_image": "splash",
            "background_image": "background",
            "bg": "background"
        }
        
        return icon_mappings.get(base_name, base_name)
    
    def find_resource_by_type(self, app_name: str, resource_type: str, working_dir: str, use_external: bool = True) -> Optional[str]:
        """Find resource by type (icon, notification_icon, splash, background)"""
        # Map resource type to possible filenames
        type_filenames = {
            "icon": ["icon.png", "icon.jpg", "app_icon.png", "launcher_icon.png"],
            "notification_icon": ["notification_icon.png", "small_icon.png", "ic_notification.png"],
            "splash": ["splash.png", "splash_screen.png", "launch_image.png"],
            "background": ["background.png", "background_image.png", "bg.png"]
        }
        
        filenames = type_filenames.get(resource_type, [f"{resource_type}.png"])
        
        for filename in filenames:
            resources = self.get_resource_priority_list(app_name, filename, working_dir, use_external)
            if resources:
                return resources[0]  # Return first (highest priority) resource
        
        return None
    
    def validate_external_resources_structure(self, app_name: str) -> dict:
        """Validate external resources directory structure"""
        app_resource_dir = os.path.join(self.external_resources_dir, app_name)
        
        validation_result = {
            "exists": os.path.exists(app_resource_dir),
            "subdirs": {},
            "resources": {}
        }
        
        if not validation_result["exists"]:
            return validation_result
        
        # Check subdirectories
        expected_subdirs = ["icon", "splash", "background", "assets"]
        for subdir in expected_subdirs:
            subdir_path = os.path.join(app_resource_dir, subdir)
            validation_result["subdirs"][subdir] = os.path.exists(subdir_path)
        
        # Check for common resources
        resource_types = ["icon", "notification_icon", "splash", "background"]
        for resource_type in resource_types:
            resource_path = self.find_resource_by_type(app_name, resource_type, "", use_external=True)
            validation_result["resources"][resource_type] = resource_path is not None
        
        return validation_result
