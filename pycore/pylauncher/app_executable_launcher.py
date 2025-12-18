#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
App Executable Launcher

Searches for and launches executable files in app directory.
Similar to ncore's explorer.searchAndLaunchAppExecutables functionality.

Supports:
- Windows: .cmd, .bat files
- Linux: .sh files

Launch patterns:
1. main.{ext} - Generic main executable
2. {appname}.{ext} - App-specific executable
"""

import os
import sys
import subprocess
from pathlib import Path
from typing import Optional, List


class AppExecutableLauncher:
    """
    App Executable Launcher

    Searches for and launches executable files in app directories.
    """

    def __init__(self):
        """Initialize App Executable Launcher"""
        self.is_windows = sys.platform.startswith('win')
        self.is_linux = sys.platform.startswith('linux')
        self.is_mac = sys.platform == 'darwin'

        # Define supported extensions by platform
        if self.is_windows:
            self.supported_extensions = ['.cmd', '.bat']
        elif self.is_linux or self.is_mac:
            self.supported_extensions = ['.sh']
        else:
            self.supported_extensions = []

    def search_executable_file(self, directory: Path, base_name: str) -> Optional[Path]:
        """
        Search for executable file with specific base name

        Args:
            directory: Directory to search in
            base_name: Base name to search for (without extension)

        Returns:
            Path to executable file or None if not found
        """
        if not directory.exists():
            return None

        for ext in self.supported_extensions:
            file_path = directory / (base_name + ext)
            if file_path.exists():
                return file_path

        return None

    def launch_executable(self, file_path: Path) -> bool:
        """
        Launch executable file as detached process

        Args:
            file_path: Path to executable file

        Returns:
            True if launched successfully, False otherwise
        """
        if not file_path.exists():
            return False

        try:
            if self.is_windows:
                # Windows: Use explorer to launch (detached process)
                subprocess.Popen(
                    ['explorer', str(file_path)],
                    creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
                    close_fds=True
                )
            elif self.is_linux or self.is_mac:
                # Linux/Mac: Use subprocess with detached process
                # Make sure the script is executable
                if not os.access(file_path, os.X_OK):
                    # Try to make it executable
                    try:
                        os.chmod(file_path, 0o755)
                    except OSError:
                        pass

                if self.is_linux:
                    # Linux: Use xdg-open for detached execution
                    subprocess.Popen(
                        ['xdg-open', str(file_path)],
                        start_new_session=True,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        close_fds=True
                    )
                elif self.is_mac:
                    # Mac: Use open command
                    subprocess.Popen(
                        ['open', str(file_path)],
                        start_new_session=True,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                        close_fds=True
                    )
            else:
                return False

            return True
        except Exception:
            return False

    def search_and_launch_app_executables(
        self,
        app_directory: Path,
        app_name: str,
        silent: bool = False
    ) -> bool:
        """
        Search and launch executable files in app directory

        Searches for executables in this order:
        1. main.{ext} - Generic main executable
        2. {appname}.{ext} - App-specific executable

        Args:
            app_directory: App directory path
            app_name: App name for searching executables
            silent: Suppress informational messages (for MCP mode)

        Returns:
            True if executable found and launched, False otherwise
        """
        if not app_directory.exists():
            if not silent:
                print(f'[Launcher] App directory not found: {app_directory}')
            return False

        # Search for main executable first
        main_executable = self.search_executable_file(app_directory, 'main')
        if main_executable:
            if not silent:
                print(f'[Launcher] Found main executable: {main_executable}')

            success = self.launch_executable(main_executable)
            if success:
                if not silent:
                    print(f'[Launcher] Successfully launched: {main_executable}')
                return True
            else:
                if not silent:
                    print(f'[Launcher] Failed to launch: {main_executable}')
                return False

        # Search for app-specific executable
        app_executable = self.search_executable_file(app_directory, app_name)
        if app_executable:
            if not silent:
                print(f'[Launcher] Found app-specific executable: {app_executable}')

            success = self.launch_executable(app_executable)
            if success:
                if not silent:
                    print(f'[Launcher] Successfully launched: {app_executable}')
                return True
            else:
                if not silent:
                    print(f'[Launcher] Failed to launch: {app_executable}')
                return False

        # No executable found (this is normal, not an error)
        if not silent:
            print(f'[Launcher] No executable files found in: {app_directory}')
        return False


# Global singleton instance
_app_executable_launcher = None


def get_app_executable_launcher() -> AppExecutableLauncher:
    """
    Get global AppExecutableLauncher singleton instance

    Returns:
        AppExecutableLauncher instance
    """
    global _app_executable_launcher
    if _app_executable_launcher is None:
        _app_executable_launcher = AppExecutableLauncher()
    return _app_executable_launcher
