#!/usr/bin/env python3
"""
Flutter Global Variable System - Python Implementation
Equivalent to FlutterGlobalVar.ps1 but simplified for build system
"""

import os
from pathlib import Path
from typing import Optional, Dict, List


class FlutterGlobalVar:
    """Python implementation of Flutter Global Variable system"""

    def __init__(self):
        # Find Flutter project root
        self.script_dir = Path(__file__).parent.parent.parent
        self.project_root = self._find_flutter_project_root()
        self.flutter_bloom_root = self.project_root

        # Use same directory structure as PowerShell FlutterGlobalVar.ps1
        # PowerShell uses: $Global:FTEMP_FLUTTER_DIR = Join-Path $Global:FTEMP_BASE_DIR "flutter_bloom"
        # Where $Global:FTEMP_BASE_DIR = Join-Path $Global:SCRIPT_ROOT_DIR ".cache"
        self.temp_dir = self.flutter_bloom_root / ".cache" / "flutter_bloom"

        # Ensure temp directory exists - handle conflicts gracefully
        try:
            self.temp_dir.mkdir(parents=True, exist_ok=True)
        except (FileExistsError, OSError) as e:
            # If .cache exists as file, try alternative path
            if self.temp_dir.parent.exists() and not self.temp_dir.parent.is_dir():
                # Use temp directory in script dir instead
                self.temp_dir = self.script_dir / ".cache" / "flutter_bloom"
                self.temp_dir.mkdir(parents=True, exist_ok=True)
            elif not self.temp_dir.exists():
                # Create alternative temp directory
                import tempfile
                self.temp_dir = Path(tempfile.gettempdir()) / "flutter_bloom_build"
                self.temp_dir.mkdir(parents=True, exist_ok=True)

        # Key constants (same as PowerShell version)
        self.KEY_SELECTED_APP = "SELECTED_APP"
        self.KEY_SELECTED_ACTION = "SELECTED_ACTION"
        self.KEY_SELECTED_PLATFORM = "SELECTED_PLATFORM"
        self.KEY_SELECTED_ENTRY_FILE = "SELECTED_ENTRY_FILE"
        self.KEY_APP_INDEX = "APP_INDEX"
        self.KEY_DEBUG_PORT = "DEBUG_PORT"
        self.KEY_SELECTED_COMPILATION_OPTION = "SELECTED_COMPILATION_OPTION"
        self.KEY_BUILD_PHASE = "BUILD_PHASE"

        # Added constant for temp_build_dir.txt
        self.TEMP_BUILD_DIR_FILE = "temp_build_dir.txt"

        # Also support the legacy APP_NAME, BUILD_ACTION, BUILD_PLATFORM keys
        self.KEY_APP_NAME = "APP_NAME"
        self.KEY_BUILD_ACTION = "BUILD_ACTION"
        self.KEY_BUILD_PLATFORM = "BUILD_PLATFORM"

    def _find_flutter_project_root(self) -> Path:
        """Find Flutter project root by looking for pubspec.yaml"""
        current = self.script_dir
        while current != current.parent:
            if (current / "pubspec.yaml").exists():
                return current
            current = current.parent

        # Fallback to expected location
        return self.script_dir.parent.parent

    def get_file_variable(self, name: str, default_value: str = "") -> str:
        """Get variable from file storage (equivalent to Get-FileVariable)"""
        file_path = self.temp_dir / name

        if file_path.exists():
            try:
                content = file_path.read_text(encoding='utf-8').strip()
                # Remove BOM if present
                if content.startswith('\ufeff'):
                    content = content[1:]
                print(f"[BUILD-DEBUG] Read file variable {name}: '{content}' from {file_path}")
                return content
            except Exception as e:
                print(f"[BUILD-ERROR] Failed to read {file_path}: {e}")
                return default_value
        else:
            print(f"[BUILD-DEBUG] File variable {name} not found at {file_path}")

        return default_value

    def get_flutter_apps_with_index(self) -> List[Dict]:
        """Get Flutter apps with index info (equivalent to Get-FlutterAppsWithIndex)"""
        apps = []
        lib_apps_dir = self.flutter_bloom_root / "lib" / "apps"

        if not lib_apps_dir.exists():
            return apps

        # Collect all app directories
        app_dirs = [d for d in lib_apps_dir.iterdir() if d.is_dir() and d.name.startswith("app_")]
        app_dirs.sort(key=lambda x: x.name)

        # app_main always gets index 0 if it exists
        main_app_dir = lib_apps_dir / "app_main"
        if main_app_dir.exists():
            entry_file = lib_apps_dir / "app_main" / "main_app_main.dart"
            apps.append({
                "name": "app_main",
                "path": str(main_app_dir),
                "isMain": True,
                "index": 0,
                "port": 10000,
                "entryFile": str(entry_file)
            })

        # Other apps get indices 1, 2, 3... based on alphabetical order
        other_apps = [d for d in app_dirs if d.name != "app_main"]
        for i, app_dir in enumerate(other_apps):
            index = i + 1
            entry_file = app_dir / f"main_{app_dir.name}.dart"
            apps.append({
                "name": app_dir.name,
                "path": str(app_dir),
                "isMain": False,
                "index": index,
                "port": 10000 + index,
                "entryFile": str(entry_file)
            })

        return apps

    def get_build_info(self) -> Dict[str, str]:
        """Get current build information from file variables"""
        # Try multiple key variants to ensure compatibility
        app_name = (self.get_file_variable(self.KEY_SELECTED_APP) or
                   self.get_file_variable(self.KEY_APP_NAME) or
                   self.get_file_variable("KEY_SELECTED_APP"))  # Try with KEY_ prefix too

        action = (self.get_file_variable(self.KEY_SELECTED_ACTION) or
                 self.get_file_variable(self.KEY_BUILD_ACTION) or
                 self.get_file_variable("KEY_SELECTED_ACTION"))

        platform = (self.get_file_variable(self.KEY_SELECTED_PLATFORM) or
                   self.get_file_variable(self.KEY_BUILD_PLATFORM) or
                   self.get_file_variable("KEY_SELECTED_PLATFORM"))

        return {
            "app_name": app_name,
            "action": action,
            "platform": platform,
            "entry_file": self.get_file_variable(self.KEY_SELECTED_ENTRY_FILE),
            "app_index": self.get_file_variable(self.KEY_APP_INDEX),
            "debug_port": self.get_file_variable(self.KEY_DEBUG_PORT)
        }

    def get_app_info_by_name(self, app_name: str) -> Optional[Dict]:
        """Get app info by name (equivalent to Get-AppInfoByName)"""
        apps_with_index = self.get_flutter_apps_with_index()
        return next((app for app in apps_with_index if app["name"] == app_name), None)


# Global instance for easy import
flutter_gvar = FlutterGlobalVar()