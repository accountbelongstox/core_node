"""
Metro Port Manager for React Native Multi-App System
Automatically assigns unique Metro ports to each app
"""

from pathlib import Path
from typing import Dict

# Metro port assignment starts from 8090
BASE_METRO_PORT = 8090

# Port assignment cache (app_namespace -> port)
_port_cache: Dict[str, int] = {}


def get_metro_port(project_root: Path, app_namespace: str) -> int:
    """
    Get Metro port for specific app (auto-assigned based on app order)

    Args:
        project_root: Root directory of React Native project
        app_namespace: App namespace identifier

    Returns:
        Metro port number for the app (8090+)
    """
    # Check cache first
    if app_namespace in _port_cache:
        return _port_cache[app_namespace]

    # Scan all apps in src/apps directory and sort alphabetically
    apps_dir = project_root / "src" / "apps"

    # Get all app directories (sorted alphabetically for consistent port assignment)
    app_dirs = sorted([d.name for d in apps_dir.iterdir() if d.is_dir()])

    # Find index of current app
    try:
        app_index = app_dirs.index(app_namespace)
    except ValueError:
        # App not found, use base port
        app_index = 0

    # Calculate port: BASE_METRO_PORT + app_index
    port = BASE_METRO_PORT + app_index

    # Cache the port
    _port_cache[app_namespace] = port

    return port


def get_all_app_ports(project_root: Path) -> Dict[str, int]:
    """
    Get all app-to-port mappings

    Args:
        project_root: Root directory of React Native project

    Returns:
        Dictionary mapping app_namespace to metro_port
    """
    apps_dir = project_root / "src" / "apps"

    # Get all app directories (sorted alphabetically)
    app_dirs = sorted([d.name for d in apps_dir.iterdir() if d.is_dir()])

    # Build app->port mapping
    return {
        app_name: BASE_METRO_PORT + index
        for index, app_name in enumerate(app_dirs)
    }
