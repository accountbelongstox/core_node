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
Configuration Manager for Flutter Bloom Build System
Handles loading and parsing of app configuration files
"""

import os
import configparser
from typing import Dict, Any

# Import default resource files
try:
    from core.constants.build_constants import DEFAULT_RESOURCE_FILES
except ImportError:
    # Fallback if import fails
    DEFAULT_RESOURCE_FILES = {
        'icon_file': 'icon.png',
        'small_icon_file': 'notification_icon.png',
        'splash_screen_file': 'splash.png',
        'background_image_file': 'background.png'
    }

class ConfigManager:
    """Manages app configuration loading and parsing"""
    
    @staticmethod
    def load_app_config(config_path: str) -> Dict[str, Dict[str, str]]:
        """Load app configuration from INI file"""
        if not os.path.exists(config_path):
            raise Exception(f"App config file not found: {config_path}")
        
        config = configparser.ConfigParser()
        config.read(config_path, encoding='utf-8')
        
        result = {}
        for section_name in config.sections():
            result[section_name] = dict(config[section_name])
        
        return result
    
    @staticmethod
    def get_app_info(config: Dict[str, Dict[str, str]]) -> Dict[str, str]:
        """Get app information from config"""
        return config.get('app_info', {})
    
    @staticmethod
    def get_package_settings(config: Dict[str, Dict[str, str]]) -> Dict[str, str]:
        """Get package settings from config"""
        return config.get('package_settings', {})
    
    @staticmethod
    def get_build_settings(config: Dict[str, Dict[str, str]]) -> Dict[str, str]:
        """Get build settings from config"""
        return config.get('build_settings', {})
    
    @staticmethod
    def get_resources(config: Dict[str, Dict[str, str]]) -> Dict[str, str]:
        """Get resource settings from config with defaults"""
        resources = config.get('resources', {})

        # Apply defaults for missing resource files
        final_resources = DEFAULT_RESOURCE_FILES.copy()
        final_resources.update(resources)

        return final_resources
    
    @staticmethod
    def is_external_resources_enabled(config: Dict[str, Dict[str, str]]) -> bool:
        """Check if external resources are enabled"""
        build_settings = ConfigManager.get_build_settings(config)
        return build_settings.get('use_external_resources', 'false').lower() == 'true'
    
    @staticmethod
    def is_safe_build_enabled(config: Dict[str, Dict[str, str]]) -> bool:
        """Check if safe build (external compilation) is enabled"""
        build_settings = ConfigManager.get_build_settings(config)
        return build_settings.get('use_external_safe_build', 'true').lower() == 'true'
    
    @staticmethod
    def get_build_platforms(config: Dict[str, Dict[str, str]]) -> list:
        """Get build platforms from config"""
        build_settings = ConfigManager.get_build_settings(config)
        platforms_str = build_settings.get('build_platforms', 'android')
        
        if platforms_str.lower() == 'all':
            return ['android', 'ios', 'web', 'windows', 'macos']
        else:
            return [p.strip() for p in platforms_str.split(',')]
    
    @staticmethod
    def get_package_id(config: Dict[str, Dict[str, str]]) -> str:
        """Get package ID (generate random if needed)"""
        package_settings = ConfigManager.get_package_settings(config)
        
        if package_settings.get('random_package_id', 'false').lower() == 'true':
            # Generate random package ID
            import random
            import string
            random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
            return f"com.flutter.app_{random_suffix}"
        else:
            return package_settings.get('default_package_id', 'com.example.app')
    
    @staticmethod
    def get_display_name(config: Dict[str, Dict[str, str]], language: str = 'english') -> str:
        """Get display name (generate random if needed)"""
        app_info = ConfigManager.get_app_info(config)
        package_settings = ConfigManager.get_package_settings(config)
        
        if package_settings.get('random_display_name', 'false').lower() == 'true':
            # Generate random display name
            import random
            adjectives = ['Amazing', 'Super', 'Cool', 'Smart', 'Fast', 'Modern', 'Pro']
            nouns = ['App', 'Tool', 'Helper', 'Manager', 'Studio', 'Hub']
            return f"{random.choice(adjectives)} {random.choice(nouns)}"
        else:
            if language.lower() == 'chinese':
                return app_info.get('display_name_chinese', 'Flutter应用')
            else:
                return app_info.get('display_name_english', 'Flutter App')
    
    @staticmethod
    def validate_config(config: Dict[str, Dict[str, str]]) -> bool:
        """Validate configuration completeness"""
        required_sections = ['app_info', 'package_settings', 'build_settings', 'resources']
        
        for section in required_sections:
            if section not in config:
                print(f"[WARNING] Missing required section: {section}")
                return False
        
        # Check required fields in app_info
        app_info = config.get('app_info', {})
        required_app_fields = ['app_name', 'display_name_english']
        for field in required_app_fields:
            if field not in app_info:
                print(f"[WARNING] Missing required field in app_info: {field}")
                return False
        
        return True
