#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Python Application Launcher

Core library for launching Python applications with:
- App discovery in pyapps/ directory
- Fuzzy matching for app names
- Interactive selection for multiple matches
- Environment injection
- Dynamic module loading

Usage:
    from pycore.pyfoundations.app_launcher import AppLauncher

    launcher = AppLauncher()
    launcher.start()
"""

import sys
import os
import importlib
import importlib.util
from pathlib import Path
from typing import Optional, List
from pycore.pyfoundations.serialized_worker import SerializedValue


# Optional executable-launcher hook. pylauncher (a higher layer) registers a
# provider here at its import time so AppLauncher can launch sidecar executables
# WITHOUT pyfoundations importing UP into pylauncher (which the layering forbids:
# pyfoundations may import only pybasecommon + stdlib). When no provider is
# registered, the executable-search step is simply skipped.
_EXECUTABLE_LAUNCHER_PROVIDER = SerializedValue(
    None,
    "ExecutableLauncherHookState",
)


def register_executable_launcher_provider(provider) -> None:
    """
    Register a zero-arg callable that returns an executable-launcher object
    exposing ``search_and_launch_app_executables(app_dir, app_name, silent=...)``.

    Called by pycore.pylauncher at its import time so app_launcher never imports
    pylauncher directly (preserves the one-directional layer dependency).
    """
    _EXECUTABLE_LAUNCHER_PROVIDER.set(provider)


class AppLauncher:
    """
    Application Launcher

    Handles discovery, selection, and launching of Python applications
    in the pyapps/ directory.
    """

    def __init__(self, project_root: Optional[Path] = None):
        """
        Initialize App Launcher

        Args:
            project_root: Project root directory (auto-detected if not provided)
        """
        if project_root is None:
            # Auto-detect: 3 levels up from this file
            self.project_root = Path(__file__).parent.parent.parent
        else:
            self.project_root = Path(project_root)

        self.pyapps_dir = self.project_root / 'pyapps'
        self.app = None
        self.app_name = None
        self.app_dir = None
        self.app_entry = None
        self.context_loaded = False

    def get_available_apps(self, debug: bool = False) -> List[str]:
        """
        Get list of available Python apps

        Supports two entry point patterns:
        - New pattern (recommended): {appname}/main.py
        - Old pattern (legacy): {appname}/{appname}_main.py

        Args:
            debug: Print debug information during scan

        Returns:
            List of app names that have valid entry points
        """
        if not self.pyapps_dir.exists():
            if debug:
                print(f"[DEBUG] pyapps directory not found: {self.pyapps_dir}")
            return []

        if debug:
            print(f"\n[DEBUG] Scanning pyapps directory: {self.pyapps_dir}")

        apps = []
        for item in self.pyapps_dir.iterdir():
            if debug:
                print(f"[DEBUG] Checking: {item.name}")

            if not item.is_dir():
                if debug:
                    print(f"[DEBUG]   -> Skipped (not a directory)")
                continue

            if item.name.startswith('.') or item.name.startswith('__'):
                if debug:
                    print(f"[DEBUG]   -> Skipped (hidden/system directory)")
                continue

            # Check for entry point (standard pattern first, then fallback)
            main_file_standard = item / f"{item.name}_main.py"
            main_file_fallback = item / "main.py"

            has_standard = main_file_standard.exists()
            has_fallback = main_file_fallback.exists()

            if debug:
                print(f"[DEBUG]   -> {item.name}_main.py exists: {has_standard}")
                print(f"[DEBUG]   -> main.py exists: {has_fallback}")

            if has_standard or has_fallback:
                apps.append(item.name)
                if debug:
                    entry_file = f"{item.name}_main.py" if has_standard else "main.py"
                    print(f"[DEBUG]   -> Added (entry: {entry_file})")
            else:
                if debug:
                    print(f"[DEBUG]   -> Skipped (no valid entry point)")

        if debug:
            print(f"\n[DEBUG] Found {len(apps)} app(s): {', '.join(apps)}\n")

        return sorted(apps)

    def get_app_name_from_args(self) -> Optional[str]:
        """
        Get app name from command line arguments

        Supports multiple formats:
        - --app=appname
        - -app=appname
        - app=appname
        - --app appname
        - -app appname

        Returns:
            App name or None if not found
        """
        args = sys.argv[1:]

        # Check each argument
        for i, arg in enumerate(args):
            # Format: --app=name, -app=name, app=name
            if '=' in arg:
                if arg.startswith('--app=') or arg.startswith('-app=') or arg.startswith('app='):
                    return arg.split('=', 1)[1].strip()

            # Format: --app name, -app name
            elif arg in ['--app', '-app']:
                if i + 1 < len(args):
                    return args[i + 1].strip()

        # Check environment variables
        return os.environ.get('APP') or os.environ.get('APPNAME') or os.environ.get('APP_NAME')

    def find_matching_apps(self, query: str) -> List[str]:
        """
        Find apps matching the query (fuzzy matching)

        Args:
            query: Search query (can be partial)

        Returns:
            List of matching app names
        """
        available_apps = self.get_available_apps()
        query_lower = query.lower()

        # Try exact match first
        exact_matches = [app for app in available_apps if app.lower() == query_lower]
        if exact_matches:
            return exact_matches

        # Try prefix match
        prefix_matches = [app for app in available_apps if app.lower().startswith(query_lower)]
        if prefix_matches:
            return prefix_matches

        # Try contains match
        contains_matches = [app for app in available_apps if query_lower in app.lower()]
        if contains_matches:
            return contains_matches

        return []

    def prompt_for_app_selection(self, apps: List[str] = None) -> Optional[str]:
        """
        Prompt user to select an app from list

        Args:
            apps: List of apps to choose from (all apps if None)

        Returns:
            Selected app name or None if cancelled
        """
        if apps is None:
            apps = self.get_available_apps()

        if not apps:
            print('Error: No applications found in the pyapps directory.')
            return None

        print('\nAvailable Python applications:')
        for i, app_name in enumerate(apps, 1):
            print(f'  [{i}] {app_name}')
        print()

        while True:
            answer = input('Select an application by number or name: ').strip()

            if not answer:
                print('Input cannot be empty.')
                continue

            # Try numeric selection
            if answer.isdigit():
                index = int(answer) - 1
                if 0 <= index < len(apps):
                    return apps[index]
                else:
                    print(f'Invalid number. Please select 1-{len(apps)}.')
                    continue

            # Try name matching
            matches = self.find_matching_apps(answer)

            if len(matches) == 1:
                return matches[0]
            elif len(matches) > 1:
                print(f'\nMultiple matches found:')
                for i, match in enumerate(matches, 1):
                    print(f'  [{i}] {match}')
                continue
            else:
                print('No matching application found. Please try again.')
                continue

    def inject_app_to_environment(self, app_name: str):
        """
        Inject app name into environment and arguments

        Args:
            app_name: App name to inject
        """
        # Add to command line arguments if not already present
        app_arg_pattern = ['--app=', '-app=', 'app=', '--app', '-app']
        app_arg_exists = any(
            arg.startswith(pattern) or arg == pattern.rstrip('=')
            for arg in sys.argv
            for pattern in app_arg_pattern
        )

        if not app_arg_exists:
            sys.argv.append(f'--app={app_name}')

        # Set environment variables
        os.environ['APP'] = app_name
        os.environ['APPNAME'] = app_name
        os.environ['APP_NAME'] = app_name

    def resolve_app(self) -> bool:
        """
        Resolve which app to launch

        Uses fuzzy matching and interactive selection if needed.

        Returns:
            True if app resolved successfully, False otherwise
        """
        if self.context_loaded:
            return True

        # Get app name from arguments
        query = self.get_app_name_from_args()

        if query:
            # Find matching apps
            matches = self.find_matching_apps(query)

            if len(matches) == 0:
                print(f"\nError: No application found matching '{query}'")

                # Show detailed scan with debug info
                available = self.get_available_apps(debug=True)

                if available:
                    print(f"Available applications:")
                    for app in available:
                        print(f"  - {app}")
                else:
                    print("No applications found in pyapps directory.")

                print(f"\nTip: Use keyword matching (e.g., 'mcp' matches 'mcpserver')")
                print(f"Tip: Create a new app in pyapps/{query}/ with main.py entry point")
                return False

            elif len(matches) == 1:
                # Single match - use it
                selected_app = matches[0]
                if selected_app != query:
                    print(f"Matched '{query}' to app: {selected_app}")

            else:
                # Multiple matches - prompt user to select
                print(f"\nMultiple applications match '{query}':")
                selected_app = self.prompt_for_app_selection(matches)
                if not selected_app:
                    return False
        else:
            # No query provided - show all apps
            selected_app = self.prompt_for_app_selection()
            if not selected_app:
                print('No application selected. Exiting.')
                return False

        # Inject selected app
        self.inject_app_to_environment(selected_app)

        # Set app paths
        self.app_name = selected_app
        self.app_dir = self.pyapps_dir / selected_app

        # Determine entry point (standard pattern first, then fallback)
        entry_standard = self.app_dir / f"{selected_app}_main.py"
        entry_fallback = self.app_dir / "main.py"

        if entry_standard.exists():
            self.app_entry = entry_standard
        elif entry_fallback.exists():
            self.app_entry = entry_fallback
        else:
            print(f'Error: No valid entry point found for app: {selected_app}')
            print(f'Expected one of:')
            print(f'  - {self.app_dir}/{selected_app}_main.py (standard pattern)')
            print(f'  - {self.app_dir}/main.py (fallback pattern)')
            return False

        # Validate directory exists
        if not self.app_dir.exists():
            print(f'Error: App directory not found: {self.app_dir}')
            return False

        self.context_loaded = True
        return True

    def start(self) -> bool:
        """
        Start the application

        Returns:
            True if started successfully, False otherwise
        """
        # Resolve app
        if not self.resolve_app():
            return False

        # Suppress startup banner in MCP mode to avoid interfering with STDIO protocol
        is_mcp_mode = os.environ.get('PYCORE_MCP_MODE', '').lower() in ('1', 'true', 'yes')
        if not is_mcp_mode:
            print(f'\n=== Starting Python App: {self.app_name} ===')
            print(f'App Directory: {self.app_dir}')
            print(f'App Entry: {self.app_entry}')
            print()

        # Search and launch executable files in app directory via the registered
        # provider (pylauncher). This allows parallel startup of other processes
        # without blocking the main app. Skipped when no provider is registered,
        # so pyfoundations never imports UP into pylauncher.
        executable_launcher_provider = _EXECUTABLE_LAUNCHER_PROVIDER.get()
        if executable_launcher_provider is not None:
            if not is_mcp_mode:
                print(f'[Launcher] Searching for executable files in app directory...')
            executable_launcher = executable_launcher_provider()
            if executable_launcher is not None:
                executable_launcher.search_and_launch_app_executables(
                    self.app_dir,
                    self.app_name,
                    silent=is_mcp_mode
                )

        # Load the app module dynamically
        module_name = f"pyapps.{self.app_name}.{self.app_name}_main"
        spec = importlib.util.spec_from_file_location(
            module_name,
            self.app_entry
        )

        if spec is None or spec.loader is None:
            print(f'Error: Failed to load app module from {self.app_entry}')
            return False

        # Create and execute module - let errors expose naturally
        app_module = importlib.util.module_from_spec(spec)
        sys.modules[module_name] = app_module
        spec.loader.exec_module(app_module)

        # Look for entry function (main or start)
        if hasattr(app_module, 'main') and callable(app_module.main):
            app_module.main()
        elif hasattr(app_module, 'start') and callable(app_module.start):
            app_module.start()
        else:
            print(f'Warning: App {self.app_name} does not have a main() or start() function')
            print('Module loaded but no entry function found.')

        return True

    def stop(self):
        """Stop the application"""
        if self.app and hasattr(self.app, 'stop') and callable(self.app.stop):
            self.app.stop()


def main():
    """Main entry point for AppLauncher"""
    launcher = AppLauncher()
    success = launcher.start()
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
