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
App Configuration Manager
Handles loading and parsing of app build configuration files
"""

import os
import configparser
from typing import Dict, Any, Optional

class AppConfigManager:
    """Manages app build configuration files"""
    
    def __init__(self, config_path: str):
        self.config_path = config_path
        self.config = configparser.ConfigParser()
        self.app_config = {}
        
    def load_config(self) -> bool:
        """Load configuration from INI file"""
        try:
            if not os.path.exists(self.config_path):
                print(f"[ERROR] Config file not found: {self.config_path}")
                return False
            
            self.config.read(self.config_path, encoding='utf-8')
            
            # Parse app configuration
            if 'app' in self.config:
                self.app_config = dict(self.config['app'])
            
            print(f"[INFO] Loaded configuration from: {self.config_path}")
            return True
            
        except Exception as e:
            print(f"[ERROR] Failed to load config: {str(e)}")
            return False
    
    def get_app_name(self) -> str:
        """Get app name from config"""
        return self.app_config.get('app_name', '')
    
    def get_package_id(self) -> str:
        """Get package ID from config"""
        return self.app_config.get('package_id', '')
    
    def is_random_app_name(self) -> bool:
        """Check if app name should be randomly generated"""
        return self.app_config.get('random_app_name', 'false').lower() == 'true'
    
    def is_random_package_id(self) -> bool:
        """Check if package ID should be randomly generated"""
        return self.app_config.get('random_package_id', 'false').lower() == 'true'
    
    def use_external_resources(self) -> bool:
        """Check if external resources should be used"""
        return self.app_config.get('use_external_resources', 'true').lower() == 'true'
    
    def get_icon_file(self) -> str:
        """Get icon file path"""
        return self.app_config.get('icon_file', 'icon.png')
    
    def get_notification_icon(self) -> str:
        """Get notification icon file path"""
        return self.app_config.get('notification_icon', 'ic_notification.png')
    
    def get_splash_screen(self) -> Optional[str]:
        """Get splash screen file path"""
        splash = self.app_config.get('splash_screen', '')
        return splash if splash else None
    
    def get_background_image(self) -> Optional[str]:
        """Get background image file path"""
        background = self.app_config.get('background_image', '')
        return background if background else None
    
    def get_all_config(self) -> Dict[str, Any]:
        """Get all configuration as dictionary"""
        return self.app_config.copy()
    
    def print_config_summary(self) -> None:
        """Print configuration summary"""
        print(f"[INFO] App Configuration Summary:")
        print(f"  App Name: {self.get_app_name()}")
        print(f"  Package ID: {self.get_package_id()}")
        print(f"  Random App Name: {self.is_random_app_name()}")
        print(f"  Random Package ID: {self.is_random_package_id()}")
        print(f"  Use External Resources: {self.use_external_resources()}")
        print(f"  Icon File: {self.get_icon_file()}")
        print(f"  Notification Icon: {self.get_notification_icon()}")
        print(f"  Splash Screen: {self.get_splash_screen()}")
        print(f"  Background Image: {self.get_background_image()}")
