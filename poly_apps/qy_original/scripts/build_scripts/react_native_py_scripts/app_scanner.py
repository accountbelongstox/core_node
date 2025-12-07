"""
App discovery and configuration scanning for React Native multi-app system
Scans src/apps/ directory to discover apps
NO HARDCODED REQUIREMENTS - All configs optional with defaults
All results written to file variable system
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional

# Add script directory to path for imports
SCRIPT_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPT_DIR))

from default_config import get_default_app_config, merge_ini_config
from file_var_system import FileVarSystem


def initialize_app_configs(app_directory: str) -> None:
    """
    Scan and initialize app configurations from src/apps/ directory
    Results are written to file variable system, not returned
    
    Args:
        app_directory: Root directory of the React Native project
    """
    fvs = FileVarSystem()
    
    apps_path = os.path.join(app_directory, "src", "apps")
    
    if not os.path.exists(apps_path):
        fvs.set_error(f"Apps directory not found at: {apps_path}")
        return
    
    # Scan for app subdirectories - ANY directory is considered an app
    apps_dir = Path(apps_path)
    app_dirs = [d for d in apps_dir.iterdir() if d.is_dir()]
    
    discovered_apps = {}
    
    for app_dir in app_dirs:
        namespace = app_dir.name
        
        # Get default configuration
        app_config = get_default_app_config(namespace)
        
        # Look for build_config.ini (optional)
        build_config_path = app_dir / "build_config.ini"
        if build_config_path.exists():
            app_config = merge_ini_config(app_config, str(build_config_path))
        
        # Add system paths
        app_config["AppDirectory"] = str(app_dir)
        app_config["Name"] = namespace
        
        # Check for App.tsx (optional, for display purposes only)
        app_entry_path = app_dir / "App.tsx"
        if app_entry_path.exists():
            app_config["AppEntry"] = str(app_entry_path)
        else:
            app_config["AppEntry"] = None
        
        # Store in discovered apps
        discovered_apps[namespace] = app_config
        
        # Write to file variable system
        fvs.set_app_config(namespace, app_config)
    
    # Write all discovered apps list
    apps_list = {
        "apps": list(discovered_apps.keys()),
        "count": len(discovered_apps)
    }
    fvs.set_status_json("DISCOVERED_APPS", apps_list)
    
    if len(discovered_apps) == 0:
        fvs.set_error("No app directories found")
    else:
        fvs.set_status("APPS_DISCOVERED", "true")


def get_app_configs_from_files() -> Dict[str, Dict[str, Any]]:
    """
    Get all app configurations from file variable system
    
    Returns:
        Dictionary mapping namespace to app configuration
    """
    fvs = FileVarSystem()
    apps_list = fvs.get_status_json("DISCOVERED_APPS", default={"apps": []})
    
    result = {}
    for app_name in apps_list.get("apps", []):
        config = fvs.get_app_config(app_name)
        if config:
            result[app_name] = config
    
    return result


def get_app_config_from_files(namespace: str) -> Optional[Dict[str, Any]]:
    """
    Get configuration for a specific app namespace from file variable system
    
    Args:
        namespace: App namespace identifier
        
    Returns:
        App configuration dictionary or None if not found
    """
    fvs = FileVarSystem()
    return fvs.get_app_config(namespace)


def test_app_exists_in_files(namespace: str) -> bool:
    """
    Check if an app namespace exists in file variable system

    Args:
        namespace: App namespace identifier

    Returns:
        True if app exists, False otherwise
    """
    fvs = FileVarSystem()
    config = fvs.get_app_config(namespace)
    return config is not None


def scan_apps(app_directory: str) -> Dict[str, Dict[str, Any]]:
    """
    Scan and return app configurations from src/apps/ directory

    Args:
        app_directory: Root directory of the React Native project

    Returns:
        Dictionary mapping namespace to app configuration
    """
    apps_path = os.path.join(app_directory, "src", "apps")

    if not os.path.exists(apps_path):
        raise FileNotFoundError(f"Apps directory not found at: {apps_path}")

    apps_dir = Path(apps_path)
    app_dirs = [d for d in apps_dir.iterdir() if d.is_dir()]

    discovered_apps = {}

    for app_dir in app_dirs:
        namespace = app_dir.name

        app_config = get_default_app_config(namespace)

        build_config_path = app_dir / "build_config.ini"
        if build_config_path.exists():
            app_config = merge_ini_config(app_config, str(build_config_path))

        app_config["AppDirectory"] = str(app_dir)
        app_config["Name"] = namespace

        app_entry_path = app_dir / "App.tsx"
        if app_entry_path.exists():
            app_config["AppEntry"] = str(app_entry_path)
        else:
            app_config["AppEntry"] = None

        discovered_apps[namespace] = app_config

    return discovered_apps


def get_app_config(namespace: str, app_directory: str) -> Optional[Dict[str, Any]]:
    """
    Get configuration for a specific app namespace

    Args:
        namespace: App namespace identifier
        app_directory: Root directory of the React Native project

    Returns:
        App configuration dictionary or None if not found
    """
    apps = scan_apps(app_directory)
    return apps.get(namespace)
