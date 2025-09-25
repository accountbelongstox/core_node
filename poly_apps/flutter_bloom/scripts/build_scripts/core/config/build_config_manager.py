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
Build Configuration Manager
Handles loading and parsing of INI configuration files for sub-apps
"""

import os
import configparser
from typing import Dict, Any, Optional

class BuildConfigManager:
    """Manages build configuration for Flutter sub-apps"""
    
    def __init__(self):
        self.config = None
        self.config_path = None
    
    def load_config(self, config_path: str) -> Optional[Dict[str, Any]]:
        """Load configuration from INI file"""
        if not os.path.exists(config_path):
            print(f"[ERROR] Configuration file not found: {config_path}")
            return None
        
        try:
            self.config_path = config_path
            self.config = configparser.ConfigParser()
            self.config.read(config_path, encoding='utf-8')
            
            # Convert to dictionary for easier access
            config_dict = {}
            for section in self.config.sections():
                config_dict[section] = dict(self.config[section])
            
            # Add DEFAULT section if exists
            if self.config.defaults():
                config_dict['DEFAULT'] = dict(self.config.defaults())
            
            return config_dict
            
        except Exception as e:
            print(f"[ERROR] Failed to load configuration: {str(e)}")
            return None
    
    def get_app_name(self, config: Dict[str, Any]) -> str:
        """Get app name from configuration"""
        app_info_section = config.get('app_info', {})
        return app_info_section.get('app_name', '')

    def get_package_id(self, config: Dict[str, Any]) -> str:
        """Get package ID from configuration"""
        package_section = config.get('package_settings', {})
        return package_section.get('default_package_id', '')

    def is_random_app_name(self, config: Dict[str, Any]) -> bool:
        """Check if app name should be randomly generated"""
        package_section = config.get('package_settings', {})
        return package_section.get('random_display_name', 'false').lower() == 'true'

    def is_random_package_id(self, config: Dict[str, Any]) -> bool:
        """Check if package ID should be randomly generated"""
        package_section = config.get('package_settings', {})
        return package_section.get('random_package_id', 'false').lower() == 'true'

    def use_external_resources(self, config: Dict[str, Any]) -> bool:
        """Check if external resources should be used"""
        build_section = config.get('build_settings', {})
        return build_section.get('use_external_resources', 'false').lower() == 'true'
    
    def get_icon_file(self, config: Dict[str, Any]) -> str:
        """Get icon file name"""
        resources_section = config.get('resources', {})
        return resources_section.get('icon_file', 'icon.png')
    
    def get_notification_icon(self, config: Dict[str, Any]) -> str:
        """Get notification icon file name"""
        resources_section = config.get('resources', {})
        return resources_section.get('notification_icon', 'ic_notification.png')
    
    def get_splash_screen(self, config: Dict[str, Any]) -> Optional[str]:
        """Get splash screen file name"""
        resources_section = config.get('resources', {})
        splash = resources_section.get('splash_screen', '')
        return splash if splash else None
    
    def get_background_image(self, config: Dict[str, Any]) -> Optional[str]:
        """Get background image file name"""
        resources_section = config.get('resources', {})
        background = resources_section.get('background_image', '')
        return background if background else None
    
    def print_config_summary(self, config: Dict[str, Any]):
        """Print configuration summary"""
        print(f"[INFO] App Configuration Summary:")
        print(f"  App Name: {self.get_app_name(config)}")
        print(f"  Package ID: {self.get_package_id(config)}")
        print(f"  Random App Name: {self.is_random_app_name(config)}")
        print(f"  Random Package ID: {self.is_random_package_id(config)}")
        print(f"  Use External Resources: {self.use_external_resources(config)}")
        print(f"  Icon File: {self.get_icon_file(config)}")
        print(f"  Notification Icon: {self.get_notification_icon(config)}")
        print(f"  Splash Screen: {self.get_splash_screen(config)}")
        print(f"  Background Image: {self.get_background_image(config)}")
