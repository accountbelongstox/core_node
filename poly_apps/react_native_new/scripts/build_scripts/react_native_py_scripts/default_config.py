"""
Default configuration values for React Native multi-app system
"""

import os
import configparser
from typing import Dict, Any


def get_default_app_config(namespace: str) -> Dict[str, Any]:
    """
    Get default configuration for an app namespace
    
    Args:
        namespace: App namespace identifier
        
    Returns:
        Dictionary with default configuration values
    """
    namespace_upper = namespace.upper()
    
    return {
        # Basic Info
        "namespace": namespace,
        "displayName": namespace_upper,
        "displayNameEn": namespace_upper,
        "displayNameZh": namespace,
        "displayNameEs": namespace_upper,
        
        # Package Info
        "bundleId": f"com.{namespace}.app",
        "version": "1.0.0",
        "versionCode": 1,
        
        # Platforms
        "platforms": ["android", "ios"],
        
        # Theme
        "defaultTheme": "light",
        "primaryColor": "#007AFF",
        "backgroundColor": "#FFFFFF",
        
        # Features
        "authentication": True,
        "pushNotifications": False,
        "analytics": False,
        
        # API
        "apiBaseUrl": "https://api.example.com",
        "apiTimeout": 30000,
        
        # Navigation
        "initialRoute": "Home",
        
        # Assets (default paths)
        "iconPath": f"assets/apps/app_{namespace}/icon.png",
        "splashScreenPath": f"assets/apps/app_{namespace}/splash.png",
        "backgroundImagePath": f"assets/apps/app_{namespace}/background.png",
        
        # Build Options
        "minSdkVersion": 21,
        "targetSdkVersion": 33,
        "compileSdkVersion": 33,
        "iosDeploymentTarget": "12.0",
        
        # Optimization
        "optimizeImages": True,
        "enableHermes": True,
        "enableProguard": True,

        # Build Settings
        "use_external_safe_build": True,  # Enable factory directory by default
        "external_build_dir": "",  # Auto-generated if empty
        
        # Development
        "port": 8081,
        "devCommand": "react-native start",
        "buildAndroidCommand": "react-native run-android",
        "buildIosCommand": "react-native run-ios",
        "testCommand": "jest",
    }


def merge_ini_config(default_config: Dict[str, Any], ini_file_path: str) -> Dict[str, Any]:
    """
    Merge INI file configuration with default config
    
    Args:
        default_config: Default configuration dictionary
        ini_file_path: Path to INI configuration file
        
    Returns:
        Merged configuration dictionary
    """
    config = default_config.copy()
    
    if not os.path.exists(ini_file_path):
        return config

    try:
        parser = configparser.ConfigParser()
        parser.read(ini_file_path, encoding='utf-8')
        
        # Convert INI sections to flat dictionary
        for section in parser.sections():
            for key, value in parser.items(section):
                # Parse value types
                if value.lower() == "true":
                    parsed_value = True
                elif value.lower() == "false":
                    parsed_value = False
                elif value.isdigit():
                    parsed_value = int(value)
                elif value.replace('.', '', 1).isdigit():
                    parsed_value = float(value)
                else:
                    # Remove quotes if present
                    parsed_value = value.strip('"\'')
                
                # Store in config (flatten section.key to key)
                config[key] = parsed_value
                
    except Exception as e:
        print(f"[WARNING] Failed to parse INI file: {ini_file_path}")
        print(f"[WARNING] Error: {e}")
        print("[WARNING] Using default configuration")
    
    return config

