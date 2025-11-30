#!/usr/bin/env python3
"""
App Scanner Module

Scans project directories for available applications to provide menu options.
"""

from pathlib import Path
from typing import List, Optional
import os

from config.path_config import get_path_config


class AppScanner:
    """Scans for available applications in project directories"""

    def __init__(self, project_root: Path):
        self.project_root = project_root
        self.path_config = get_path_config(project_root)

    def _scan_directory(self, directory: Path, pattern: str = "*") -> List[str]:
        """Scan a directory for items matching a pattern"""
        if not directory.exists():
            return []
        
        items = []
        try:
            for item in directory.glob(pattern):
                if item.is_dir():
                    items.append(item.name)
        except Exception:
            pass
        
        return sorted(items)

    def get_laravel_apps(self) -> List[str]:
        """Get list of Laravel applications"""
        return self._scan_directory(self.path_config.laravel_apps_dir)

    def get_nuxt_apps(self) -> List[str]:
        """Get list of Nuxt applications"""
        return self._scan_directory(self.path_config.nuxt_apps_dir)

    def get_flutter_apps(self) -> List[str]:
        """Get list of Flutter applications"""
        return self._scan_directory(self.path_config.flutter_apps_dir)

    def get_menu_options_for_input_type(self, input_type: str) -> Optional[List[str]]:
        """
        Get menu options based on input type
        
        Args:
            input_type: Type of input (e.g., 'LaravelApp', 'NuxtApp', 'FlutterApp', 'AppName')
        
        Returns:
            List of menu options, or None if input type doesn't require menu
        """
        if input_type == 'LaravelApp':
            return self.get_laravel_apps()
        elif input_type == 'NuxtApp':
            return self.get_nuxt_apps()
        elif input_type == 'FlutterApp':
            return self.get_flutter_apps()
        elif input_type == 'AppName':
            # Return all apps from all frameworks
            all_apps = []
            all_apps.extend(self.get_laravel_apps())
            all_apps.extend(self.get_nuxt_apps())
            all_apps.extend(self.get_flutter_apps())
            return sorted(list(set(all_apps))) if all_apps else None
        else:
            return None


__all__ = ['AppScanner']

