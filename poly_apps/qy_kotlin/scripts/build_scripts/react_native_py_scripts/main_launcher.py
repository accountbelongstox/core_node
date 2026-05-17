"""
Main launcher for React Native multi-app system
Handles menu display, app scanning, and calls app_switcher
All results written to file variable system for PowerShell/Shell to execute
"""

import sys
import os
from pathlib import Path

# Add current directory to path for imports
current_dir = Path(__file__).parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

from file_var_system import FileVarSystem
from app_scanner import scan_apps
from interactive_menu import show_interactive_menu
from app_switcher import switch_app
from project_locator import get_project_root
from emulator_manager import store_emulator_info
from config_keys import KEY_DISPLAY_NAME_ENGLISH, FALLBACK_DISPLAY_NAME_EN, FALLBACK_DISPLAY_NAME


def main():
    """
    Main entry point
    1. Auto-detect project root
    2. Scans emulator availability
    3. Scans apps and shows menu
    4. Calls app_switcher to configure app
    5. Writes results to file variable system for PowerShell
    """
    # Auto-detect project root based on script location
    project_root = str(get_project_root())

    fvs = FileVarSystem()
    fvs.clear_error()

    # Scan for Android emulator
    print("[Init] Scanning for Android emulator...")
    store_emulator_info()
    print()

    # Scan for apps
    apps = scan_apps(project_root)

    # Prepare menu items (use build_config.ini keys with fallback)
    menu_items = []
    for app_name, app_config in apps.items():
        display_name = (
            app_config.get(KEY_DISPLAY_NAME_ENGLISH) or
            app_config.get(FALLBACK_DISPLAY_NAME_EN) or
            app_config.get(FALLBACK_DISPLAY_NAME, app_name.upper())
        )
        menu_items.append({
            "Name": app_name,
            "DisplayName": display_name,
            "Config": app_config
        })

    # Show interactive menu and write selection to file variable system
    show_interactive_menu(
        menu_items=menu_items,
        initial_index=0,
        app_directory=project_root
    )

    # Read menu selection
    selection = fvs.get_menu_selection()
    if not selection:
        return

    selected_app = selection["SelectedApp"]["Name"]

    print()
    print(f"[Selection] App: {selected_app}")
    print()

    # Call app_switcher to configure app and setup factory
    print("[Step] Configuring app...")
    switch_app(project_root, selected_app)

    print("[OK] App configured successfully")


if __name__ == "__main__":
    main()
