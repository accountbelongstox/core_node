#!/usr/bin/env python3

import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Any

from core.config import global_config

class FlutterApp:
    """Represents a Flutter application with its configuration"""

    def __init__(self, name: str, path: Path, index: int):
        self.name = name
        self.path = path
        self.index = index
        self.is_main = (name == "app_main")
        self.port = global_config.flutter_port_range_start + index
        self.entry_file = self._determine_entry_file()

    def _determine_entry_file(self) -> str:
        """Determine the entry file path for this app"""
        return str(global_config.flutter_project_dir / "lib" / "apps" / self.name / f"main_{self.name}.dart")

    def to_dict(self) -> Dict[str, Any]:
        """Convert app to dictionary representation"""
        return {
            "name": self.name,
            "path": str(self.path),
            "isMain": self.is_main,
            "index": self.index,
            "port": self.port,
            "entryFile": self.entry_file
        }

class FlutterAppManager:
    """Manages Flutter applications in the project"""

    def __init__(self, flutter_project_dir: Path):
        self.flutter_project_dir = flutter_project_dir
        self.apps_dir = flutter_project_dir / "lib" / "apps"
        self._apps_cache = None

    def get_flutter_apps(self, refresh: bool = False) -> List[FlutterApp]:
        """Get list of Flutter apps, with optional cache refresh"""
        if self._apps_cache is None or refresh:
            self._apps_cache = self._scan_flutter_apps()
        return self._apps_cache

    def _scan_flutter_apps(self) -> List[FlutterApp]:
        """Scan for Flutter apps in the project"""
        if not self.apps_dir.exists():
            print(f"Warning: Flutter apps directory not found: {self.apps_dir}", file=sys.stderr)
            return []

        apps = []
        app_dirs = [d for d in self.apps_dir.iterdir() if d.is_dir() and d.name.startswith("app_")]

        # Sort to ensure consistent ordering, with app_main first
        app_dirs.sort(key=lambda x: (x.name != "app_main", x.name))

        for index, app_dir in enumerate(app_dirs):
            app = FlutterApp(
                name=app_dir.name,
                path=app_dir,
                index=index
            )
            apps.append(app)

        return apps

    def get_app_by_name(self, app_name: str) -> Optional[FlutterApp]:
        """Get a specific app by name"""
        apps = self.get_flutter_apps()
        return next((app for app in apps if app.name == app_name), None)

    def get_app_by_index(self, index: int) -> Optional[FlutterApp]:
        """Get a specific app by index"""
        apps = self.get_flutter_apps()
        return next((app for app in apps if app.index == index), None)

    def get_apps_dict_list(self) -> List[Dict[str, Any]]:
        """Get apps as list of dictionaries for compatibility"""
        apps = self.get_flutter_apps()
        return [app.to_dict() for app in apps]

    def validate_app_exists(self, app_name: str) -> bool:
        """Validate that an app exists"""
        return self.get_app_by_name(app_name) is not None

    def get_app_count(self) -> int:
        """Get total number of apps"""
        return len(self.get_flutter_apps())

    def get_main_app(self) -> Optional[FlutterApp]:
        """Get the main app (app_main) if it exists"""
        return self.get_app_by_name("app_main")

    def list_app_names(self) -> List[str]:
        """Get list of all app names"""
        apps = self.get_flutter_apps()
        return [app.name for app in apps]

    def get_app_info_summary(self, app_name: str) -> Optional[Dict[str, Any]]:
        """Get comprehensive app information for debugging"""
        app = self.get_app_by_name(app_name)
        if not app:
            return None

        return {
            "name": app.name,
            "index": app.index,
            "port": app.port,
            "entry_file": app.entry_file,
            "is_main": app.is_main,
            "path": str(app.path),
            "entry_file_exists": Path(app.entry_file).exists()
        }