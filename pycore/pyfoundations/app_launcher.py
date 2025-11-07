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

    def get_available_apps(self) -> List[str]:
        """
        Get list of available Python apps

        Returns:
            List of app names that have valid entry points
        """
        if not self.pyapps_dir.exists():
            return []

        apps = []
        for item in self.pyapps_dir.iterdir():
            if not item.is_dir():
                continue
            if item.name.startswith('.') or item.name.startswith('__'):
                continue

            # Check for entry point: {appname}/{appname}_main.py
            main_file = item / f"{item.name}_main.py"
            if main_file.exists():
                apps.append(item.name)

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
            try:
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

            except KeyboardInterrupt:
                print('\nSelection cancelled.')
                return None
            except Exception as e:
                print(f'Error: {e}')
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
                print(f"Error: No application found matching '{query}'")
                print(f"Available apps: {', '.join(self.get_available_apps())}")
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
        self.app_entry = self.app_dir / f"{selected_app}_main.py"

        # Validate
        if not self.app_dir.exists():
            print(f'Error: App directory not found: {self.app_dir}')
            return False

        if not self.app_entry.exists():
            print(f'Error: App entry point not found: {self.app_entry}')
            print(f'Expected: {selected_app}/{selected_app}_main.py')
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

        print(f'\n=== Starting Python App: {self.app_name} ===')
        print(f'App Directory: {self.app_dir}')
        print(f'App Entry: {self.app_entry}')
        print()

        try:
            # Load the app module dynamically
            module_name = f"pyapps.{self.app_name}.{self.app_name}_main"
            spec = importlib.util.spec_from_file_location(
                module_name,
                self.app_entry
            )

            if spec is None or spec.loader is None:
                print(f'Error: Failed to load app module from {self.app_entry}')
                return False

            # Create and execute module
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

        except Exception as e:
            print(f'Error starting app {self.app_name}: {e}')
            import traceback
            traceback.print_exc()
            return False

    def stop(self):
        """Stop the application"""
        if self.app and hasattr(self.app, 'stop') and callable(self.app.stop):
            try:
                self.app.stop()
            except Exception as e:
                print(f'Error stopping app: {e}')


def main():
    """Main entry point for AppLauncher"""
    launcher = AppLauncher()

    try:
        success = launcher.start()
        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        print('\nInterrupted by user')
        launcher.stop()
        sys.exit(0)

    except Exception as error:
        print(f'Unexpected error: {error}')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
