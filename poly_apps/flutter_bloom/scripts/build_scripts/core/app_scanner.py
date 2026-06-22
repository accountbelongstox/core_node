#!/usr/bin/env python3
# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

"""
Flutter App Scanner
Scans and manages Flutter applications in the project
"""

import os
from pathlib import Path
from typing import List, Dict, Any, Optional

from utils.print_helper import PrintHelper


class FlutterAppScanner:
    """
    Scans Flutter project for available applications
    """

    def __init__(self, project_root: Optional[Path] = None):
        """Initialize the app scanner"""
        self.project_root = project_root or self._find_project_root()
        # PrintHelper is now a static class
        self.apps_dir = self.project_root / "lib" / "apps"

    def _find_project_root(self) -> Path:
        """Find Flutter project root directory"""
        current = Path.cwd()
        while current.parent != current:
            if (current / "pubspec.yaml").exists():
                return current
            current = current.parent
        return Path.cwd()

    def scan_applications(self) -> List[Dict[str, Any]]:
        """
        Scan for Flutter applications

        Returns:
            List of application dictionaries with metadata
        """
        try:
            if not self.apps_dir.exists():
                PrintHelper.warning(f"Flutter apps directory not found: {self.apps_dir}", "APP-SCANNER")
                return []

            apps = []
            for app_dir in self.apps_dir.iterdir():
                if app_dir.is_dir() and app_dir.name.startswith("app_"):
                    app_info = self._scan_single_app(app_dir)
                    if app_info:
                        apps.append(app_info)

            return sorted(apps, key=lambda x: (not x["isMain"], x["name"]))

        except Exception as e:
            PrintHelper.error(f"App scanning failed: {e}", "APP-SCANNER")
            return []

    def _scan_single_app(self, app_dir: Path) -> Optional[Dict[str, Any]]:
        """
        Scan a single application directory

        Args:
            app_dir: Path to application directory

        Returns:
            Application info dictionary or None
        """
        try:
            app_name = app_dir.name
            is_main = app_name == "app_main"

            # Look for main entry file
            entry_files = [
                app_dir / f"main_{app_name}.dart",
                app_dir / "main.dart",
                app_dir / f"{app_name}.dart"
            ]

            entry_file = None
            for candidate in entry_files:
                if candidate.exists():
                    entry_file = candidate
                    break

            if not entry_file:
                PrintHelper.warning(f"No entry file found for {app_name}", "APP-SCANNER")
                entry_file = entry_files[0]  # Use expected default

            return {
                "name": app_name,
                "path": str(app_dir),
                "isMain": is_main,
                "entryFile": str(entry_file),
                "exists": entry_file.exists() if entry_file else False
            }

        except Exception as e:
            PrintHelper.error(f"Failed to scan app {app_dir.name}: {e}", "APP-SCANNER")
            return None

    def get_apps_with_index(self) -> List[Dict[str, Any]]:
        """
        Get applications with index information for port allocation

        Returns:
            List of applications with index and port information
        """
        apps = self.scan_applications()
        apps_with_index = []

        # app_main always gets index 0 if it exists
        main_app = next((app for app in apps if app["name"] == "app_main"), None)
        if main_app:
            main_app_indexed = main_app.copy()
            main_app_indexed.update({
                "index": 0,
                "port": 10000
            })
            apps_with_index.append(main_app_indexed)

        # Other apps get indices 1, 2, 3... based on alphabetical order
        other_apps = [app for app in apps if app["name"] != "app_main"]
        for i, app in enumerate(other_apps):
            app_indexed = app.copy()
            app_indexed.update({
                "index": i + 1,
                "port": 10000 + i + 1
            })
            apps_with_index.append(app_indexed)

        return apps_with_index

    def get_app_by_name(self, app_name: str) -> Optional[Dict[str, Any]]:
        """
        Get application information by name

        Args:
            app_name: Name of the application

        Returns:
            Application info dictionary or None
        """
        apps = self.get_apps_with_index()
        return next((app for app in apps if app["name"] == app_name), None)

    def validate_project(self) -> bool:
        """
        Validate that we're in a Flutter project

        Returns:
            True if valid Flutter project, False otherwise
        """
        pubspec_path = self.project_root / "pubspec.yaml"
        if not pubspec_path.exists():
            PrintHelper.error(f"pubspec.yaml not found in {self.project_root}", "APP-SCANNER")
            return False

        if not self.apps_dir.exists():
            PrintHelper.warning(f"Apps directory not found: {self.apps_dir}", "APP-SCANNER")

        return True

    def get_project_info(self) -> Dict[str, Any]:
        """
        Get project information

        Returns:
            Project information dictionary
        """
        return {
            "root": str(self.project_root),
            "apps_dir": str(self.apps_dir),
            "is_valid": self.validate_project(),
            "app_count": len(self.scan_applications())
        }