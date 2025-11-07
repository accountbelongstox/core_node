#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Main Entry Point for Python Applications

This is the Python equivalent of main.js, providing:
- App selection and loading
- Dependency checking
- Context initialization
- Forwarding to app-specific entry points

Usage:
    python main.py --app=mcpserver
    python main.py --app=<appname>
"""

import sys
import os
import importlib
import importlib.util
from pathlib import Path
from typing import Optional, List

# Add project root to Python path
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))


class Main:
    """Main application launcher"""

    def __init__(self):
        self.app = None
        self.app_name = None
        self.app_dir = None
        self.app_entry = None
        self.context_loaded = False

    def get_available_apps(self) -> List[str]:
        """Get list of available Python apps"""
        pyapps_dir = PROJECT_ROOT / 'pyapps'
        if not pyapps_dir.exists():
            return []

        apps = []
        for item in pyapps_dir.iterdir():
            if item.is_dir() and not item.name.startswith('.') and not item.name.startswith('__'):
                main_file = item / f"{item.name}_main.py"
                if main_file.exists():
                    apps.append(item.name)

        return sorted(apps)

    def get_app_name(self) -> Optional[str]:
        """Get app name from command line arguments or environment"""
        # Check command line arguments
        for arg in sys.argv[1:]:
            if arg.startswith('--app=') or arg.startswith('-app='):
                return arg.split('=', 1)[1]
            elif arg.startswith('app='):
                return arg.split('=', 1)[1]

        # Check environment variables
        return os.environ.get('APP') or os.environ.get('APPNAME') or os.environ.get('APP_NAME')

    def prompt_for_app_selection(self) -> Optional[str]:
        """Prompt user to select an app"""
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

                # Try exact name match
                if answer.lower() in [app.lower() for app in apps]:
                    return next(app for app in apps if app.lower() == answer.lower())

                # Try partial match
                matches = [app for app in apps if app.lower().startswith(answer.lower())]
                if len(matches) == 1:
                    return matches[0]

                print('Invalid selection. Please try again.')

            except KeyboardInterrupt:
                print('\nSelection cancelled.')
                return None
            except Exception as e:
                print(f'Error: {e}')
                return None

    def inject_selected_app(self, app_name: str):
        """Inject selected app into environment and arguments"""
        # Add to command line arguments if not already present
        app_arg_exists = any(
            arg.startswith('--app=') or arg.startswith('-app=') or arg.startswith('app=')
            for arg in sys.argv
        )

        if not app_arg_exists:
            sys.argv.append(f'--app={app_name}')

        # Set environment variables
        os.environ['APP'] = app_name
        os.environ['APPNAME'] = app_name
        os.environ['APP_NAME'] = app_name

    def ensure_context(self) -> bool:
        """Ensure app context is loaded"""
        if self.context_loaded:
            return True

        # Get selected app
        selected_app = self.get_app_name()

        if not selected_app:
            selected_app = self.prompt_for_app_selection()
            if not selected_app:
                print('No application selected. Exiting.')
                return False

            self.inject_selected_app(selected_app)

        self.app_name = selected_app
        self.app_dir = PROJECT_ROOT / 'pyapps' / selected_app
        self.app_entry = self.app_dir / f"{selected_app}_main.py"

        # Validate app directory exists
        if not self.app_dir.exists():
            print(f'Error: App directory not found: {self.app_dir}')
            return False

        # Validate entry point exists
        if not self.app_entry.exists():
            print(f'Error: App entry point not found: {self.app_entry}')
            print(f'Expected: {self.app_entry}')
            return False

        self.context_loaded = True
        return True

    def start(self) -> bool:
        """Start the application"""
        # Ensure context is loaded
        if not self.ensure_context():
            return False

        print(f'\n=== Starting Python App: {self.app_name} ===')
        print(f'App Directory: {self.app_dir}')
        print(f'App Entry: {self.app_entry}')
        print()

        try:
            # Load the app module dynamically
            spec = importlib.util.spec_from_file_location(
                f"pyapps.{self.app_name}.{self.app_name}_main",
                self.app_entry
            )

            if spec is None or spec.loader is None:
                print(f'Error: Failed to load app module from {self.app_entry}')
                return False

            app_module = importlib.util.module_from_spec(spec)
            sys.modules[spec.name] = app_module
            spec.loader.exec_module(app_module)

            # Look for main() or start() function
            if hasattr(app_module, 'main'):
                app_module.main()
            elif hasattr(app_module, 'start'):
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
    """Main entry point"""
    main_instance = Main()

    try:
        success = main_instance.start()
        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        print('\nInterrupted by user')
        main_instance.stop()
        sys.exit(0)

    except Exception as error:
        print(f'Unexpected error: {error}')
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
