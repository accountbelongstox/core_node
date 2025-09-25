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
Asset Replacement Engine
Handles intelligent asset replacement with external resources taking priority
"""

import os
import shutil
from typing import Dict, List, Any, Optional
from ..resources.resource_finder import ResourceFinder

class AssetReplacementEngine:
    """Handles asset replacement with external resources priority"""
    
    def __init__(self, working_directory: str, external_resources_dir: str, image_processor):
        self.working_directory = working_directory
        self.external_resources_dir = external_resources_dir
        self.image_processor = image_processor
        self.replacement_results = []
        self.backup_dir = os.path.join(working_directory, '.asset_backups')

        # Initialize resource finder
        self.resource_finder = ResourceFinder(external_resources_dir, working_directory)
    
    def replace_app_assets(self, app_name: str, app_config: Dict[str, Any], platform_assets: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Replace assets for the specified app"""
        print(f"[INFO] Starting asset replacement for app: {app_name}")
        
        # Create backup directory
        os.makedirs(self.backup_dir, exist_ok=True)
        
        # Get resource configuration
        icon_file = self.get_config_value(app_config, 'resources', 'icon_file', 'icon.png')
        notification_icon = self.get_config_value(app_config, 'resources', 'notification_icon', 'ic_notification.png')
        splash_screen = self.get_config_value(app_config, 'resources', 'splash_screen', None)
        background_image = self.get_config_value(app_config, 'resources', 'background_image', None)
        use_external = self.get_config_value(app_config, 'build_settings', 'use_external_resources', 'false').lower() == 'true'
        
        print(f"[INFO] Resource configuration:")
        print(f"  Icon File: {icon_file}")
        print(f"  Notification Icon: {notification_icon}")
        print(f"  Splash Screen: {splash_screen}")
        print(f"  Background Image: {background_image}")
        print(f"  Use External Resources: {use_external}")
        
        # Process each platform
        for platform, assets in platform_assets.items():
            if assets:
                print(f"[INFO] Processing {platform} platform assets")
                self.process_platform_assets(platform, assets, app_name, {
                    'icon_file': icon_file,
                    'notification_icon': notification_icon,
                    'splash_screen': splash_screen,
                    'background_image': background_image,
                    'use_external': use_external
                })
        
        return self.replacement_results
    
    def process_platform_assets(self, platform: str, assets: Dict[str, List[str]], app_name: str, resource_config: Dict[str, Any]):
        """Process assets for a specific platform"""
        
        # Process icons
        for icon_path in assets.get('icons', []):
            self.replace_icon_asset(platform, icon_path, app_name, resource_config)
        
        # Process images
        for image_path in assets.get('images', []):
            self.replace_image_asset(platform, image_path, app_name, resource_config)
        
        # Process splash screens
        for splash_path in assets.get('splash_screens', []):
            self.replace_splash_asset(platform, splash_path, app_name, resource_config)
        
        # Process backgrounds
        for bg_path in assets.get('backgrounds', []):
            self.replace_background_asset(platform, bg_path, app_name, resource_config)
    
    def replace_icon_asset(self, platform: str, asset_path: str, app_name: str, resource_config: Dict[str, Any]):
        """Replace icon asset"""
        full_asset_path = os.path.join(self.working_directory, asset_path)
        
        if not os.path.exists(full_asset_path):
            return
        
        # Find replacement resource
        replacement_source = self.find_replacement_resource(
            resource_config['icon_file'], 
            resource_config['use_external'],
            app_name
        )
        
        if replacement_source:
            self.perform_asset_replacement(
                full_asset_path, 
                replacement_source, 
                platform, 
                'icon',
                asset_path
            )
    
    def replace_image_asset(self, platform: str, asset_path: str, app_name: str, resource_config: Dict[str, Any]):
        """Replace general image asset"""
        # Similar logic to replace_icon_asset but for general images
        pass
    
    def replace_splash_asset(self, platform: str, asset_path: str, app_name: str, resource_config: Dict[str, Any]):
        """Replace splash screen asset"""
        if not resource_config['splash_screen']:
            return  # No splash screen configured
        
        full_asset_path = os.path.join(self.working_directory, asset_path)
        
        if not os.path.exists(full_asset_path):
            return
        
        replacement_source = self.find_replacement_resource(
            resource_config['splash_screen'], 
            resource_config['use_external'],
            app_name
        )
        
        if replacement_source:
            self.perform_asset_replacement(
                full_asset_path, 
                replacement_source, 
                platform, 
                'splash_screen',
                asset_path
            )
    
    def replace_background_asset(self, platform: str, asset_path: str, app_name: str, resource_config: Dict[str, Any]):
        """Replace background asset"""
        if not resource_config['background_image']:
            return  # No background image configured
        
        # Similar logic to splash screen replacement
        pass
    
    def find_replacement_resource(self, resource_filename: str, use_external: bool, app_name: str) -> Optional[str]:
        """Find replacement resource using advanced ResourceFinder"""

        result = self.resource_finder.find_app_resource(app_name, resource_filename, use_external)

        if result:
            print(f"[INFO] Found replacement resource: {result}")
        else:
            print(f"[WARNING] No replacement resource found for: {resource_filename}")

        return result
    
    def perform_asset_replacement(self, target_path: str, source_path: str, platform: str, asset_type: str, relative_path: str):
        """Perform the actual asset replacement"""
        
        # Create backup
        backup_path = os.path.join(self.backup_dir, relative_path.replace('/', '_').replace('\\', '_'))
        os.makedirs(os.path.dirname(backup_path), exist_ok=True)
        shutil.copy2(target_path, backup_path)
        
        # Process image if needed (resize, crop, etc.)
        processed_source = self.image_processor.process_for_target(source_path, target_path, platform, asset_type)
        
        # Replace the asset
        shutil.copy2(processed_source, target_path)
        
        # Record replacement
        replacement_record = {
            'platform': platform,
            'asset_type': asset_type,
            'target_path': relative_path,
            'source_path': source_path,
            'backup_path': backup_path,
            'status': 'success'
        }
        
        self.replacement_results.append(replacement_record)
        print(f"[SUCCESS] Replaced {asset_type} in {platform}: {relative_path}")
    
    def get_config_value(self, config: Dict[str, Any], section: str, key: str, default: Any) -> Any:
        """Get configuration value with default fallback"""
        return config.get(section, {}).get(key, default)
