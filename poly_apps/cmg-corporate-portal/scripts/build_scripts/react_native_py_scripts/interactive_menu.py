"""
Interactive menu system for app selection
All selections written to file variable system
"""

import os
import sys
import json
import time
from typing import Dict, Any, List, Optional
from pathlib import Path
from file_var_system import FileVarSystem

# Windows-specific import for keyboard input
try:
    import msvcrt
except ImportError:
    msvcrt = None


def get_app_state_file(app_directory: str) -> str:
    """
    Get path to app state file
    
    Args:
        app_directory: Root directory of the React Native project
        
    Returns:
        Path to app state file
    """
    state_dir = os.path.join(app_directory, ".app-states")
    os.makedirs(state_dir, exist_ok=True)
    
    return os.path.join(state_dir, "app-preferences.json")


def load_app_states(app_directory: str) -> Dict[str, Any]:
    """
    Load app states from file
    
    Args:
        app_directory: Root directory of the React Native project
        
    Returns:
        Dictionary of app states
    """
    state_file = get_app_state_file(app_directory)
    
    if os.path.exists(state_file):
        try:
            with open(state_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {}
    
    return {}


def save_app_states(app_directory: str, states: Dict[str, Any]) -> None:
    """
    Save app states to file
    
    Args:
        app_directory: Root directory of the React Native project
        states: Dictionary of app states
    """
    state_file = get_app_state_file(app_directory)
    
    with open(state_file, 'w', encoding='utf-8') as f:
        json.dump(states, f, indent=2, ensure_ascii=False)


def show_interactive_menu(
    menu_items: List[Dict[str, Any]],
    initial_index: int = 0,
    app_directory: str = ""
) -> None:
    """
    Display interactive menu for app selection
    Selection is written to file variable system
    
    Args:
        menu_items: List of menu items with 'Name' and 'DisplayName' keys
        initial_index: Initial selected index
        app_directory: Root directory of the React Native project
    """
    fvs = FileVarSystem()
    
    mode_options = ["debug", "build", "test"]
    platform_options = ["android", "ios"]
    selected_index = initial_index
    
    if selected_index >= len(menu_items):
        selected_index = 0
    
    # Load app states from file
    app_states = load_app_states(app_directory)
    
    # Initialize default states for all apps if not set
    for item in menu_items:
        app_name = item["Name"]
        if app_name not in app_states:
            app_states[app_name] = {
                "mode": "debug",
                "platform": "android"
            }
    
    def get_mode_label(mode_value: str) -> str:
        mode_labels = {
            "debug": "Debug",
            "build": "Build",
            "test": "Test"
        }
        return mode_labels.get(mode_value, mode_value)
    
    def get_platform_label(platform_value: str) -> str:
        platform_labels = {
            "android": "Android",
            "ios": "iOS"
        }
        return platform_labels.get(platform_value, platform_value)
    
    def draw_menu():
        os.system('cls' if os.name == 'nt' else 'clear')
        print("")
        print("=" * 79)
        print("  REACT NATIVE MULTI-APP LAUNCHER")
        print("=" * 79)
        print("")
        print("Apps:")
        print("-" * 50)
        
        for i, item in enumerate(menu_items):
            is_selected = (i == selected_index)
            app_name = item["Name"]
            
            # Get app-specific mode and platform
            app_mode = app_states.get(app_name, {}).get("mode", "debug")
            app_platform = app_states.get(app_name, {}).get("platform", "android")
            
            mode_label = get_mode_label(app_mode)
            platform_label = get_platform_label(app_platform)
            
            prefix = " -> " if is_selected else "    "
            display_text = f"{prefix}{i}. {item['DisplayName']} ({app_name}) [{mode_label}/{platform_label}]"
            
            if is_selected:
                print(f"\033[92m{display_text}\033[0m")  # Green
            else:
                print(display_text)
        
        print("-" * 50)
        print("")
        print("Controls:")
        print("  [Up/Down]    Navigate apps")
        print("  [Left]       Toggle mode (Debug/Build/Test)")
        print("  [Right]      Toggle platform (Android/iOS)")
        print("  [Enter]      Launch selected app")
        print("  [ESC]        Quit")
        print("")
        print("=" * 79)

    # Interactive input loop using msvcrt (Windows standard library)
    # Wait a moment for PowerShell output to settle
    time.sleep(0.3)

    # Clear ALL keyboard buffer including stdin
    while msvcrt.kbhit():
        msvcrt.getch()

    # Additional clear - flush stdin completely
    if hasattr(sys.stdin, 'flush'):
        try:
            sys.stdin.flush()
        except:
            pass

    while True:
        draw_menu()
        print("\n>>> Press Enter to confirm, ESC to cancel <<<")
        sys.stdout.flush()  # Force output to display

        # Blocking read - wait for key press
        key = msvcrt.getch()
        print(f"[DEBUG] Key pressed: {repr(key)}")  # Debug output

        if key == b'\x1b':  # ESC
            print("\n[INFO] Selection cancelled by user")
            return

        elif key == b'\r' or key == b'\n':  # Enter
            # Confirm selection and exit loop
            selected_app = menu_items[selected_index]
            selected_app_name = selected_app["Name"]
            selected_mode = app_states.get(selected_app_name, {}).get("mode", "debug")
            selected_platform = app_states.get(selected_app_name, {}).get("platform", "android")

            selection = {
                "SelectedIndex": selected_index,
                "SelectedApp": selected_app,
                "Mode": selected_mode,
                "Platform": selected_platform
            }

            fvs.set_menu_selection(selection)
            print(f"\n[OK] Selection confirmed: {selected_app_name} [{selected_mode}/{selected_platform}]")
            break

        elif key == b'\xe0' or key == b'\x00':  # Arrow keys prefix on Windows
            arrow = msvcrt.getch()

            if arrow == b'H':  # Up arrow
                selected_index = (selected_index - 1) % len(menu_items)

            elif arrow == b'P':  # Down arrow
                selected_index = (selected_index + 1) % len(menu_items)

            elif arrow == b'K':  # Left arrow - cycle mode (Debug->Build->Test->Debug)
                app_name = menu_items[selected_index]["Name"]
                current_mode = app_states.get(app_name, {}).get("mode", "debug")
                mode_index = mode_options.index(current_mode)
                new_mode = mode_options[(mode_index + 1) % len(mode_options)]
                app_states[app_name]["mode"] = new_mode
                save_app_states(app_directory, app_states)

            elif arrow == b'M':  # Right arrow - cycle platform (Android->iOS->Android)
                app_name = menu_items[selected_index]["Name"]
                current_platform = app_states.get(app_name, {}).get("platform", "android")
                platform_index = platform_options.index(current_platform)
                new_platform = platform_options[(platform_index + 1) % len(platform_options)]
                app_states[app_name]["platform"] = new_platform
                save_app_states(app_directory, app_states)
