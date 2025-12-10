"""
Project Type Menu
Displays menu for project type selection and writes selection to file variable system
"""

import os
import sys
from pathlib import Path
from typing import Dict, Any, Optional
from file_var_system import FileVarSystem
from project_type_detector import ProjectTypeDetector, detect_project_type

# Windows-specific import for keyboard input
try:
    import msvcrt
except ImportError:
    msvcrt = None


def show_project_type_menu(project_path: str) -> Optional[Dict[str, Any]]:
    """
    Display interactive menu for project type selection
    
    Args:
        project_path: Path to project root directory
        
    Returns:
        Dictionary with selected project type info or None if cancelled
    """
    fvs = FileVarSystem(namespace="RN_BUILD")
    
    # Detect project type
    detector = ProjectTypeDetector(project_path)
    detected_type = detector.detect()
    package_manager = detector.get_package_manager()
    
    # Available project types
    project_types = [
        {"key": "react", "name": "React (Vite/CRA)", "command": "dev"},
        {"key": "react-native", "name": "React Native", "command": "start"},
        {"key": "nuxt", "name": "Nuxt.js", "command": "dev"},
        {"key": "next", "name": "Next.js", "command": "dev"},
        {"key": "vue", "name": "Vue.js", "command": "dev"},
        {"key": "vite", "name": "Vite", "command": "dev"},
        {"key": "install-capacitor", "name": "安装 Capacitor 依赖", "command": "install-capacitor"},
    ]
    
    # Always show all types, but default to detected type
    available_types = project_types
    
    # Find index of detected type, default to 0 if not found
    selected_index = 0
    if detected_type != "unknown":
        for i, pt in enumerate(available_types):
            if pt["key"] == detected_type:
                selected_index = i
                break
    
    def draw_menu():
        os.system('cls' if os.name == 'nt' else 'clear')
        print("")
        print("=" * 79)
        print("  PROJECT TYPE SELECTION")
        print("=" * 79)
        print("")
        print(f"Project Path: {project_path}")
        print(f"Detected Type: {detector.PROJECT_TYPES.get(detected_type, 'Unknown')}")
        print(f"Package Manager: {package_manager}")
        print("")
        print("Select Project Type:")
        print("-" * 50)
        
        for i, pt in enumerate(available_types):
            is_selected = (i == selected_index)
            prefix = " -> " if is_selected else "    "
            display_text = f"{prefix}{i + 1}. {pt['name']}"
            
            if is_selected:
                print(f"\033[92m{display_text}\033[0m")  # Green
            else:
                print(display_text)
        
        print("")
        print("-" * 50)
        print("Controls: ↑/↓ to navigate, Enter to select, Q to quit")
        print("")
    
    def get_key():
        """Get keyboard input (Windows)"""
        if msvcrt:
            if msvcrt.kbhit():
                key = msvcrt.getch()
                if key == b'\xe0':  # Arrow key prefix
                    key = msvcrt.getch()
                    if key == b'H':  # Up
                        return 'up'
                    elif key == b'P':  # Down
                        return 'down'
                elif key == b'\r':  # Enter
                    return 'enter'
                elif key == b'q' or key == b'Q':
                    return 'quit'
        return None
    
    # Main menu loop
    import time
    menu_drawn = False
    
    while True:
        # Only redraw menu when selection changes or first time
        if not menu_drawn:
            draw_menu()
            menu_drawn = True
        
        if msvcrt:
            key = get_key()
            if key == 'up':
                selected_index = (selected_index - 1) % len(available_types)
                menu_drawn = False  # Redraw on next iteration
            elif key == 'down':
                selected_index = (selected_index + 1) % len(available_types)
                menu_drawn = False  # Redraw on next iteration
            elif key == 'enter':
                break
            elif key == 'quit':
                fvs.clear_menu_selection()
                return None
            else:
                # No key pressed, wait a bit to avoid busy loop
                time.sleep(0.1)
        else:
            # Fallback for non-Windows systems
            try:
                choice = input("Enter selection (1-{} or q to quit): ".format(len(available_types)))
                if choice.lower() == 'q':
                    fvs.clear_menu_selection()
                    return None
                selected_index = int(choice) - 1
                if 0 <= selected_index < len(available_types):
                    break
            except (ValueError, KeyboardInterrupt):
                fvs.clear_menu_selection()
                return None
    
    # Get selected project type
    selected_type = available_types[selected_index]
    
    # Prepare selection data
    selection = {
        "ProjectType": selected_type["key"],
        "ProjectTypeDisplay": selected_type["name"],
        "PackageManager": package_manager,
        "ProjectPath": project_path,
        "DetectedType": detected_type,
        "Command": selected_type["command"]
    }
    
    # Write to file variable system
    fvs.set_menu_selection(selection)
    
    return selection


def main():
    """Main entry point"""
    if len(sys.argv) < 2:
        print("Usage: python project_type_menu.py <project_path>")
        sys.exit(1)
    
    project_path = sys.argv[1]
    selection = show_project_type_menu(project_path)
    
    if selection:
        print("")
        print(f"Selected: {selection['ProjectTypeDisplay']}")
        print(f"Package Manager: {selection['PackageManager']}")
    else:
        print("")
        print("Selection cancelled")


if __name__ == "__main__":
    main()

