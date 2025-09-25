#!/usr/bin/env python3

import os
import sys
import json
import platform
from pathlib import Path
from typing import Dict, List, Optional, Any

class UnifiedManagerCore:
    def __init__(self):
        self.script_dir = Path(__file__).parent.resolve()
        self.project_root = self._find_project_root()
        self.is_windows = platform.system() == "Windows"
        self.is_linux = not self.is_windows
        self.data_dir = self._setup_data_directory()

        # Initialize paths
        self.apps_dir = self.project_root / "apps"
        self.poly_apps_dir = self.project_root / "poly_apps"
        self.ncore_dir = self.project_root / "ncore"
        self.scripts_dir = self.project_root / "scripts"
        self.unified_manager_dir = self.scripts_dir / "unified_manager"

        # Registry file
        self.registry_file = self.unified_manager_dir / "app_registry.json"

        # Load app registry
        self.registry = self._load_app_registry()

        # Main executable
        self.main_js = self.project_root / "main.js"

    def _find_project_root(self) -> Path:
        """Find the project root by looking for specific markers"""
        current = self.script_dir
        while current != current.parent:
            if (current / ".git").exists() or (current / "main.js").exists():
                return current
            current = current.parent
        return self.script_dir.parent.parent.parent

    def _setup_data_directory(self) -> Path:
        """Setup data exchange directory"""
        if self.is_windows:
            data_dir = Path(os.path.expanduser("~")) / ".core_node" / "unified_manager"
        else:
            data_dir = Path(os.path.expanduser("~")) / ".core_node" / "unified_manager"

        data_dir.mkdir(parents=True, exist_ok=True)

        # Create cache subdirectory
        self.cache_dir = data_dir / "cache"
        self.cache_dir.mkdir(exist_ok=True)

        return data_dir

    def _load_app_registry(self) -> Dict[str, Any]:
        """Load application registry from JSON file"""
        try:
            if not self.registry_file.exists():
                print(f"Error: Registry file not found: {self.registry_file}")
                return {"apps": {}, "presets": {}}

            with open(self.registry_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading registry: {e}")
            return {"apps": {}, "presets": {}}

    def get_app_script_path(self, app_path: str, script_name: str) -> Path:
        """Get full path to app script"""
        if Path(app_path).is_absolute():
            full_app_path = Path(app_path)
        else:
            full_app_path = self.project_root / app_path

        scripts_dir = full_app_path / "scripts"
        return scripts_dir / script_name

    def get_app_path(self, app_name: str, app_config: Dict[str, Any]) -> str:
        """Get application path based on configuration"""
        if "path" in app_config:
            return app_config["path"]
        elif app_config.get("type") == "ncore-app":
            return f"ncore/{app_name}"
        elif app_config.get("type") == "poly-app":
            return f"poly_apps/{app_name}"
        else:
            return f"apps/{app_name}"

    def build_script_command(self, app_name: str, script_type: str, script_name: str) -> Optional[str]:
        """Build the command to execute a script for an app"""
        app_config = self.registry["apps"].get(app_name)
        if not app_config:
            return None

        app_path = self.get_app_path(app_name, app_config)
        script_path = self.get_app_script_path(app_path, script_name)

        if not script_path.exists():
            return None

        # Generate PowerShell script based on script type and platform
        if self.is_windows:
            if script_type == "start_cmd":
                return f'start "" "{script_path}"'
            elif script_type == "deploy_cmd":
                return f'explorer "{script_path}"'
            else:
                return f'& "{script_path}"'
        else:
            if script_type == "start_cmd":
                return f'bash "{script_path}" &'
            else:
                return f'bash "{script_path}"'

    def get_available_commands(self, app_name: str) -> Dict[str, str]:
        """Get all available commands for an app"""
        commands = {}

        # Try multiple script extensions
        script_extensions = []
        if self.is_windows:
            script_extensions = [".bat", ".cmd", ".ps1", ".sh"]
        else:
            script_extensions = [".sh", ".bat", ".cmd"]

        script_types = ["start", "install", "deploy", "stop", "build"]

        app_config = self.registry["apps"].get(app_name)
        if not app_config:
            return commands

        app_path = self.get_app_path(app_name, app_config)

        for script_type in script_types:
            found_script = False
            for ext in script_extensions:
                script_name = f"{script_type}{ext}"
                script_path = self.get_app_script_path(app_path, script_name)

                if script_path.exists():
                    command = self.build_script_command(app_name, f"{script_type}_cmd", script_name)
                    if command:
                        commands[f"{script_type}_cmd"] = command
                        found_script = True
                        break

            # If no script found, add a default command anyway
            if not found_script and script_type == "start":
                # For poly apps, we can always start them with node main.js
                if app_config.get("type") == "poly-app":
                    commands["start_cmd"] = self._get_node_command_poly(app_name)
                # For ncore apps, use node main.js app=AppName
                elif app_config.get("type") == "ncore-app":
                    commands["start_cmd"] = self._get_node_command_ncore(app_name)

        return commands

    def _get_node_command_poly(self, app_name: str) -> str:
        """Get node command for poly apps"""
        return f'node "{self.main_js}" poly_app={app_name}'

    def _get_node_command_ncore(self, app_name: str) -> str:
        """Get node command for ncore apps"""
        return f'node "{self.main_js}" app={app_name}'

    def _load_cache(self) -> Dict[str, str]:
        """Load cached app action selections"""
        cache_file = self.cache_dir / "app_actions.json"
        try:
            if cache_file.exists():
                with open(cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load cache: {e}")
        return {}

    def _save_cache(self, cache_data: Dict[str, str]):
        """Save app action selections to cache"""
        cache_file = self.cache_dir / "app_actions.json"
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Warning: Could not save cache: {e}")

    def write_action_result(self, action: str, script_path: str = None, params: Dict[str, Any] = None) -> str:
        """Write action result to data directory and return the path"""
        result_file = self.data_dir / "action_result.json"

        result = {
            "action": action,
            "script_path": script_path,
            "params": params or {},
            "timestamp": str(Path().resolve())  # Current timestamp marker
        }

        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        return str(script_path) if script_path else ""

    def show_interactive_menu(self) -> str:
        """Show interactive menu with arrow key navigation"""
        menu_items = [
            {"text": "Start Applications", "action": self._handle_start_applications},
            {"text": "Start Poly Applications", "action": self._handle_start_poly_applications},
            {"text": "Install Dependencies", "action": self._handle_install_dependencies},
            {"text": "Build Applications", "action": self._handle_build_applications},
            {"text": "Back to Main Menu", "action": self._handle_back_to_main_menu},
            {"text": "Exit", "action": lambda: ""}
        ]

        selected_index = 0

        # Check if we can use arrow keys (Windows with msvcrt)
        try:
            import msvcrt
            can_use_arrows = True
        except ImportError:
            can_use_arrows = False

        if not can_use_arrows:
            # Fallback to number selection
            print("=== Unified App Manager ===")
            print("Select an option:")
            for i, item in enumerate(menu_items, 1):
                print(f"{i}. {item['text']}")

            print()
            try:
                choice = input(f"Enter your choice (1-{len(menu_items)}): ").strip()
                choice_num = int(choice)
                if 1 <= choice_num <= len(menu_items):
                    return menu_items[choice_num - 1]["action"]()
                else:
                    print("Invalid selection.")
                    return ""
            except (EOFError, ValueError):
                print("\nExiting...")
                return ""

        # Arrow key navigation for Windows
        import msvcrt
        import os

        def draw_menu():
            os.system('cls' if os.name == 'nt' else 'clear')
            print("=== Unified App Manager ===")
            print("Use ↑↓ arrows to navigate, Enter to select")
            print()

            for i, item in enumerate(menu_items):
                if i == selected_index:
                    print(f"> {item['text']}")
                else:
                    print(f"  {item['text']}")

        while True:
            draw_menu()

            key = msvcrt.getch()

            if key == b'\xe0':  # Special key prefix
                key = msvcrt.getch()
                if key == b'H':  # Up arrow
                    selected_index = (selected_index - 1) % len(menu_items)
                elif key == b'P':  # Down arrow
                    selected_index = (selected_index + 1) % len(menu_items)
            elif key == b'\r':  # Enter
                os.system('cls' if os.name == 'nt' else 'clear')
                return menu_items[selected_index]["action"]()
            elif key == b'\x1b':  # Escape
                os.system('cls' if os.name == 'nt' else 'clear')
                print("Exiting...")
                return ""

    def show_applications_list(self):
        """Display all available applications and presets"""
        print("\n=== Available Applications (from registry) ===")
        print()

        # Sort apps by ID
        apps = self.registry.get("apps", {})
        sorted_apps = sorted(apps.items(), key=lambda x: x[1].get("id", 0))

        print(f"Found {len(sorted_apps)} applications in registry:")
        print()

        for app_name, app_config in sorted_apps:
            description = app_config.get("description", "")
            if len(description) > 50:
                description = description[:47] + "..."
            print(f"{app_config.get('id', 0)}: {app_name} ({app_config.get('type', 'unknown')}) '{description}'")

        print("\n=== Available Presets ===")

        # Sort presets by ID
        presets = self.registry.get("presets", {})
        sorted_presets = sorted(presets.items(), key=lambda x: x[1].get("id", 0))

        print(f"Found {len(sorted_presets)} presets:")
        print()

        for preset_name, preset_config in sorted_presets:
            apps_list = ", ".join(preset_config.get("app_names", []))
            description = preset_config.get("description", "")
            print(f"{preset_config.get('id', 0)}: {preset_name} - {description}")
            print(f"    Apps: {apps_list}")

        input("\nPress Enter to continue...")

    def _handle_start_applications(self) -> str:
        """Handle start applications menu choice"""
        return self._show_app_start_interactive()

    def _handle_start_poly_applications(self) -> str:
        """Handle start poly applications menu choice"""
        return self._show_poly_apps_interactive()

    def _show_poly_apps_interactive(self) -> str:
        """Show interactive poly apps menu"""
        # Get poly apps from registry
        poly_apps = []
        apps = self.registry.get("apps", {})
        for app_name, app_config in apps.items():
            if app_config.get("type") == "poly-app":
                poly_apps.append(app_name)

        if not poly_apps:
            print("No poly apps found in registry.")
            input("Press Enter to continue...")
            return ""

        print("\nAvailable poly apps:")
        for i, app in enumerate(poly_apps, 1):
            print(f"{i}. {app}")
        print("0. Return to main menu")

        choice = input("Select a poly app to run: ").strip()

        if choice == "0" or not choice:
            return ""

        try:
            selected_index = int(choice) - 1
            if 0 <= selected_index < len(poly_apps):
                selected_app = poly_apps[selected_index]
                return self._execute_app_node_command(selected_app)
        except (ValueError, IndexError):
            print("Invalid selection.")
            input("Press Enter to continue...")

        return ""

    def _show_app_start_interactive(self) -> str:
        """Show interactive app start menu with toggle functionality"""
        apps = self.registry.get("apps", {})
        presets = self.registry.get("presets", {})

        if not apps and not presets:
            print("No applications or presets found in registry.")
            input("Press Enter to continue...")
            return ""

        # Load cached selections
        cache_data = self._load_cache()

        # Prepare app items with available actions
        app_items = []
        sorted_apps = sorted(apps.items(), key=lambda x: x[1].get("id", 0))

        for app_name, app_config in sorted_apps:
            available_commands = self.get_available_commands(app_name)

            if available_commands:
                # Map command types to display names - always include all actions
                action_types = ["start", "install", "build", "deploy"]

                if action_types:
                    # Get cached selection or default to first available
                    cache_key = f"app_{app_name}"
                    current_action = cache_data.get(cache_key, action_types[0])
                    if current_action not in action_types:
                        current_action = action_types[0]

                    app_items.append({
                        "type": "app",
                        "name": app_name,
                        "config": app_config,
                        "available_actions": action_types,
                        "current_action": current_action,
                        "commands": available_commands
                    })

        # Prepare preset items with actions
        preset_items = []
        sorted_presets = sorted(presets.items(), key=lambda x: x[1].get("id", 0))
        for preset_name, preset_config in sorted_presets:
            # Presets can have start, install, build, deploy actions
            preset_actions = ["start", "install", "build", "deploy"]

            # Get cached selection or default to start
            cache_key = f"preset_{preset_name}"
            current_action = cache_data.get(cache_key, "start")
            if current_action not in preset_actions:
                current_action = "start"

            preset_items.append({
                "type": "preset",
                "name": preset_name,
                "config": preset_config,
                "available_actions": preset_actions,
                "current_action": current_action
            })

        # Combine all items
        all_items = app_items + preset_items

        if not all_items:
            print("No executable applications or presets found.")
            input("Press Enter to continue...")
            return ""

        return self._show_toggle_menu(all_items, cache_data)

    def _show_toggle_menu(self, items: List[Dict], cache_data: Dict[str, str]) -> str:
        """Show menu with toggle functionality"""
        selected_index = 0

        # Check if we can use arrow keys
        try:
            import msvcrt
            can_use_arrows = True
        except ImportError:
            can_use_arrows = False

        if not can_use_arrows:
            # Fallback for non-Windows systems
            return self._show_simple_toggle_menu(items, cache_data)

        # Arrow key navigation for Windows
        import msvcrt
        import os

        def draw_toggle_menu():
            os.system('cls' if os.name == 'nt' else 'clear')
            print("=== Available Applications ===")
            print("Use ↑↓ arrows to navigate, ←→ to toggle actions, Enter to select")
            print()

            # Show apps
            app_count = 0
            for i, item in enumerate(items):
                if item["type"] == "app":
                    app_count += 1
                    prefix = ">" if i == selected_index else " "
                    app_config = item["config"]

                    if len(item["available_actions"]) > 1:
                        action_display = f"[{item['current_action']}]"
                    else:
                        action_display = f"[{item['current_action']}]"

                    print(f"{prefix} {app_config.get('id', 0)}: {item['name']} ({app_config.get('type', 'unknown')}) {action_display}")

            if app_count > 0:
                print("\n=== Available Presets ===")

            # Show presets
            for i, item in enumerate(items):
                if item["type"] == "preset":
                    prefix = ">" if i == selected_index else " "
                    preset_config = item["config"]
                    action_display = f"[{item['current_action']}]"
                    print(f"{prefix} P{preset_config.get('id', 0)}: {item['name']} {action_display}")

        while True:
            draw_toggle_menu()

            key = msvcrt.getch()

            # Debug: Show key codes (remove this after testing)
            if key not in [b'\xe0', b'\r', b'\x1b']:
                continue  # Ignore non-special keys for now

            if key == b'\xe0':  # Special key prefix
                key = msvcrt.getch()
                if key == b'H':  # Up arrow
                    selected_index = (selected_index - 1) % len(items)
                elif key == b'P':  # Down arrow
                    selected_index = (selected_index + 1) % len(items)
                elif key == b'K':  # Left arrow
                    current_item = items[selected_index]
                    if "available_actions" in current_item:
                        current_idx = current_item["available_actions"].index(current_item["current_action"])
                        new_idx = (current_idx - 1) % len(current_item["available_actions"])
                        current_item["current_action"] = current_item["available_actions"][new_idx]
                elif key == b'M':  # Right arrow
                    current_item = items[selected_index]
                    if "available_actions" in current_item:
                        current_idx = current_item["available_actions"].index(current_item["current_action"])
                        new_idx = (current_idx + 1) % len(current_item["available_actions"])
                        current_item["current_action"] = current_item["available_actions"][new_idx]
            elif key == b'\r':  # Enter
                os.system('cls' if os.name == 'nt' else 'clear')
                selected_item = items[selected_index]

                # Save current selections to cache
                new_cache_data = cache_data.copy()
                for item in items:
                    if item["type"] == "app":
                        cache_key = f"app_{item['name']}"
                        new_cache_data[cache_key] = item["current_action"]
                    elif item["type"] == "preset":
                        cache_key = f"preset_{item['name']}"
                        new_cache_data[cache_key] = item["current_action"]
                self._save_cache(new_cache_data)

                # Execute selected item
                if selected_item["type"] == "app":
                    return self._execute_app_action(selected_item)
                else:  # preset
                    return self._execute_preset_action(selected_item)
            elif key == b'\x1b':  # Escape
                os.system('cls' if os.name == 'nt' else 'clear')
                return ""

    def _show_simple_toggle_menu(self, items: List[Dict], cache_data: Dict[str, str]) -> str:
        """Simple menu fallback for non-Windows systems"""
        print("\n=== Available Applications ===")

        app_items = [item for item in items if item["type"] == "app"]
        preset_items = [item for item in items if item["type"] == "preset"]

        for item in app_items:
            app_config = item["config"]
            action_display = f"[{item['current_action']}]"
            print(f"{app_config.get('id', 0)}: {item['name']} ({app_config.get('type', 'unknown')}) {action_display}")

        if preset_items:
            print("\n=== Available Presets ===")
            for item in preset_items:
                preset_config = item["config"]
                action_display = f"[{item['current_action']}]"
                print(f"P{preset_config.get('id', 0)}: {item['name']} {action_display}")

        print("\nEnter app ID, app name, or preset name (Pxx):")
        try:
            choice = input("Selection: ").strip()
        except EOFError:
            return ""

        if not choice:
            return ""

        # Handle preset selection
        if choice.upper().startswith('P'):
            preset_id = choice[1:] if len(choice) > 1 else ""
            for item in preset_items:
                if str(item["config"].get("id", 0)) == preset_id:
                    return self._execute_preset_action(item)
            print(f"Preset P{preset_id} not found")
            input("Press Enter to continue...")
            return ""

        # Handle app selection by ID or name
        selected_item = None
        try:
            app_id = int(choice)
            for item in app_items:
                if item["config"].get("id") == app_id:
                    selected_item = item
                    break
        except ValueError:
            for item in app_items:
                if item["name"] == choice:
                    selected_item = item
                    break

        if selected_item:
            # Save cache
            new_cache_data = cache_data.copy()
            for item in app_items + preset_items:
                if item["type"] == "app":
                    cache_key = f"app_{item['name']}"
                    new_cache_data[cache_key] = item["current_action"]
                elif item["type"] == "preset":
                    cache_key = f"preset_{item['name']}"
                    new_cache_data[cache_key] = item["current_action"]
            self._save_cache(new_cache_data)

            return self._execute_app_action(selected_item)
        else:
            print(f"App '{choice}' not found")
            input("Press Enter to continue...")
            return ""

    def _execute_app_action(self, item: Dict) -> str:
        """Execute the selected action for an app"""
        app_name = item["name"]
        action = item["current_action"]
        app_config = item["config"]

        print(f"\n=== Debug Info for {app_name} ===")
        print(f"Action: {action}")
        print(f"Type: {app_config.get('type', 'unknown')}")

        # Get app path
        app_path = self.get_app_path(app_name, app_config)
        print(f"App path: {app_path}")

        # Check for script files with priority
        if self.is_windows:
            priority_extensions = [".ps1", ".bat", ".cmd"]
            secondary_extensions = [".sh"]
        else:
            priority_extensions = [".sh"]
            secondary_extensions = [".ps1", ".bat", ".cmd"]

        script_found = False
        found_priority = False

        # Check priority extensions first
        for ext in priority_extensions:
            script_name = f"{action}{ext}"
            script_path = self.get_app_script_path(app_path, script_name)
            exists = script_path.exists()
            if exists:
                if ext == ".ps1" and not found_priority:
                    # .ps1 is highest priority on Windows
                    print(f"Script: {script_path} - EXISTS")
                    script_found = True
                    found_priority = True
                elif ext in [".bat", ".cmd"] and not found_priority:
                    # .bat/.cmd only if no .ps1 found
                    print(f"Script: {script_path} - EXISTS")
                    script_found = True
                    found_priority = True
                elif ext == ".sh" and not self.is_windows:
                    # .sh on Linux
                    print(f"Script: {script_path} - EXISTS")
                    script_found = True
                    found_priority = True
                else:
                    # Gray out lower priority options
                    print(f"\033[90mScript: {script_path} - EXISTS (lower priority)\033[0m")

        # Check secondary extensions (gray out)
        for ext in secondary_extensions:
            script_name = f"{action}{ext}"
            script_path = self.get_app_script_path(app_path, script_name)
            exists = script_path.exists()
            if exists:
                print(f"\033[90mScript: {script_path} - EXISTS (cross-platform)\033[0m")
            else:
                print(f"\033[90mScript: {script_path} - NOT FOUND\033[0m")

        if not script_found:
            print(f"No {action} scripts found for {app_name}")
            if app_config.get("type") == "poly-app":
                print(f"For poly-app, would use: node \"{self.main_js}\" poly_app={app_name}")
            elif app_config.get("type") == "ncore-app":
                print(f"For ncore-app, would use: node \"{self.main_js}\" app={app_name}")

        input("\nPress Enter to continue...")
        return ""

    def _execute_preset_action(self, item: Dict) -> str:
        """Execute the selected action for a preset"""
        preset_name = item["name"]
        action = item["current_action"]
        preset_config = item["config"]
        app_names = preset_config.get("app_names", [])

        print(f"\n=== Debug Info for Preset {preset_name} ===")
        print(f"Action: {action}")
        print(f"Apps in preset: {', '.join(app_names)}")

        if not app_names:
            print(f"No apps defined in preset '{preset_name}'")
            input("Press Enter to continue...")
            return ""

        # Check each app in the preset
        apps = self.registry.get("apps", {})
        for app_name in app_names:
            if app_name in apps:
                app_config = apps[app_name]
                app_path = self.get_app_path(app_name, app_config)
                print(f"\nApp: {app_name}")
                print(f"  Path: {app_path}")

                # Check for script files with priority
                if self.is_windows:
                    priority_extensions = [".ps1", ".bat", ".cmd"]
                    secondary_extensions = [".sh"]
                else:
                    priority_extensions = [".sh"]
                    secondary_extensions = [".ps1", ".bat", ".cmd"]

                script_found = False
                found_priority = False

                # Check priority extensions first
                for ext in priority_extensions:
                    script_name = f"{action}{ext}"
                    script_path = self.get_app_script_path(app_path, script_name)
                    exists = script_path.exists()
                    if exists:
                        if ext == ".ps1" and not found_priority:
                            # .ps1 is highest priority on Windows
                            print(f"  Script: {script_path} - EXISTS")
                            script_found = True
                            found_priority = True
                        elif ext in [".bat", ".cmd"] and not found_priority:
                            # .bat/.cmd only if no .ps1 found
                            print(f"  Script: {script_path} - EXISTS")
                            script_found = True
                            found_priority = True
                        elif ext == ".sh" and not self.is_windows:
                            # .sh on Linux
                            print(f"  Script: {script_path} - EXISTS")
                            script_found = True
                            found_priority = True
                        else:
                            # Gray out lower priority options
                            print(f"  \033[90mScript: {script_path} - EXISTS (lower priority)\033[0m")

                # Check secondary extensions (gray out)
                for ext in secondary_extensions:
                    script_name = f"{action}{ext}"
                    script_path = self.get_app_script_path(app_path, script_name)
                    exists = script_path.exists()
                    if exists:
                        print(f"  \033[90mScript: {script_path} - EXISTS (cross-platform)\033[0m")
                    else:
                        print(f"  \033[90mScript: {script_path} - NOT FOUND\033[0m")

                if not script_found:
                    if app_config.get("type") == "poly-app":
                        print(f"  For poly-app, would use: node \"{self.main_js}\" poly_app={app_name}")
                    elif app_config.get("type") == "ncore-app":
                        print(f"  For ncore-app, would use: node \"{self.main_js}\" app={app_name}")
            else:
                print(f"\nApp: {app_name} - NOT FOUND IN REGISTRY")

        input("\nPress Enter to continue...")
        return ""

    def _execute_preset_by_name(self, preset_name: str) -> str:
        """Execute preset by name (for backward compatibility)"""
        presets = self.registry.get("presets", {})
        if preset_name in presets:
            preset_config = presets[preset_name]
            app_names = preset_config.get("app_names", [])
            return self._create_preset_action_script(app_names, "start", f"preset_{preset_name}")
        else:
            print(f"Preset '{preset_name}' not found")
            input("Press Enter to continue...")
            return ""

    def _execute_app_node_command(self, app_name: str) -> str:
        """Execute poly app using node main.js"""
        # Create a batch script to execute the node command
        script_content = f'node "{self.main_js}" poly_app={app_name}'

        # Create temporary batch/shell script
        if self.is_windows:
            temp_script = self.data_dir / "temp_execute.bat"
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write(f'@echo off\n')
                f.write(f'cd /d "{self.project_root}"\n')
                f.write(f'echo Running poly app: {app_name}\n')
                f.write(f'echo Command: {script_content}\n')
                f.write(f'{script_content}\n')
                f.write('pause\n')
        else:
            temp_script = self.data_dir / "temp_execute.sh"
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write(f'#!/bin/bash\n')
                f.write(f'cd "{self.project_root}"\n')
                f.write(f'echo "Running poly app: {app_name}"\n')
                f.write(f'echo "Command: {script_content}"\n')
                f.write(f'{script_content}\n')
                f.write('read -p "Press Enter to continue..."\n')
            temp_script.chmod(0o755)

        return self.write_action_result("execute_app", str(temp_script), {"app_name": app_name})

    def _execute_single_app(self, selection: str) -> str:
        """Execute a single app by ID or name"""
        apps = self.registry.get("apps", {})

        # Try to find by ID first
        selected_app = None
        try:
            app_id = int(selection)
            for app_name, app_config in apps.items():
                if app_config.get("id") == app_id:
                    selected_app = app_name
                    break
        except ValueError:
            # Try to find by name
            if selection in apps:
                selected_app = selection

        if not selected_app:
            print(f"App not found: {selection}")
            input("Press Enter to continue...")
            return ""

        # Find and execute start command
        commands = self.get_available_commands(selected_app)
        if "start_cmd" in commands:
            return self._create_execute_script(commands["start_cmd"], f"start_{selected_app}")
        else:
            print(f"No start script found for: {selected_app}")
            input("Press Enter to continue...")
            return ""

    def _execute_preset(self, preset_id: str) -> str:
        """Execute apps from a preset"""
        presets = self.registry.get("presets", {})

        selected_preset = None
        try:
            pid = int(preset_id)
            for preset_name, preset_config in presets.items():
                if preset_config.get("id") == pid:
                    selected_preset = preset_config
                    break
        except ValueError:
            pass

        if not selected_preset:
            print(f"Preset not found: P{preset_id}")
            input("Press Enter to continue...")
            return ""

        app_names = selected_preset.get("app_names", [])
        if not app_names:
            print("No apps defined in preset")
            input("Press Enter to continue...")
            return ""

        # Create script to start all apps in preset
        return self._create_preset_script(app_names, f"preset_{preset_id}")

    def _create_execute_script(self, command: str, script_name: str) -> str:
        """Create a script to execute a command"""
        if self.is_windows:
            temp_script = self.data_dir / f"{script_name}.bat"
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write(f'@echo off\n')
                f.write(f'cd /d "{self.project_root}"\n')
                f.write(f'echo Executing: {command}\n')
                f.write(f'{command}\n')
                f.write('pause\n')
        else:
            temp_script = self.data_dir / f"{script_name}.sh"
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write(f'#!/bin/bash\n')
                f.write(f'cd "{self.project_root}"\n')
                f.write(f'echo "Executing: {command}"\n')
                f.write(f'{command}\n')
                f.write('read -p "Press Enter to continue..."\n')
            temp_script.chmod(0o755)

        return self.write_action_result("execute_command", str(temp_script), {"command": command})

    def _create_preset_script(self, app_names: List[str], script_name: str) -> str:
        """Create a script to start multiple apps from a preset"""
        apps = self.registry.get("apps", {})
        commands = []

        for app_name in app_names:
            if app_name in apps:
                app_commands = self.get_available_commands(app_name)
                if "start_cmd" in app_commands:
                    commands.append(f'echo "Starting {app_name}..."')
                    commands.append(app_commands["start_cmd"])
                    commands.append("timeout /t 2 > nul" if self.is_windows else "sleep 2")

        if not commands:
            print("No valid start commands found for preset apps")
            input("Press Enter to continue...")
            return ""

        if self.is_windows:
            temp_script = self.data_dir / f"{script_name}.bat"
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write(f'@echo off\n')
                f.write(f'cd /d "{self.project_root}"\n')
                f.write(f'echo Starting preset apps: {", ".join(app_names)}\n')
                for command in commands:
                    f.write(f'{command}\n')
                f.write('pause\n')
        else:
            temp_script = self.data_dir / f"{script_name}.sh"
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write(f'#!/bin/bash\n')
                f.write(f'cd "{self.project_root}"\n')
                f.write(f'echo "Starting preset apps: {", ".join(app_names)}"\n')
                for command in commands:
                    f.write(f'{command}\n')
                f.write('read -p "Press Enter to continue..."\n')
            temp_script.chmod(0o755)

        return self.write_action_result("execute_preset", str(temp_script), {"app_names": app_names})

    def _create_preset_action_script(self, app_names: List[str], action: str, script_name: str) -> str:
        """Create a script to execute specific action for multiple apps from a preset"""
        apps = self.registry.get("apps", {})
        commands = []

        # Map action to command type
        command_map = {
            "start": "start_cmd",
            "install": "install_cmd",
            "build": "build_cmd",
            "deploy": "deploy_cmd"
        }

        command_type = command_map.get(action, "start_cmd")

        for app_name in app_names:
            if app_name in apps:
                app_commands = self.get_available_commands(app_name)
                if command_type in app_commands:
                    commands.append(f'echo "{action.title()}ing {app_name}..."')
                    commands.append(app_commands[command_type])
                    commands.append("timeout /t 2 > nul" if self.is_windows else "sleep 2")
                else:
                    commands.append(f'echo "No {action} command available for {app_name}"')

        if not commands:
            print(f"No valid {action} commands found for preset apps")
            input("Press Enter to continue...")
            return ""

        if self.is_windows:
            temp_script = self.data_dir / f"{script_name}.bat"
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write(f'@echo off\n')
                f.write(f'cd /d "{self.project_root}"\n')
                f.write(f'echo {action.title()}ing preset apps: {", ".join(app_names)}\n')
                for command in commands:
                    f.write(f'{command}\n')
                f.write('pause\n')
        else:
            temp_script = self.data_dir / f"{script_name}.sh"
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write(f'#!/bin/bash\n')
                f.write(f'cd "{self.project_root}"\n')
                f.write(f'echo "{action.title()}ing preset apps: {", ".join(app_names)}"\n')
                for command in commands:
                    f.write(f'{command}\n')
                f.write('read -p "Press Enter to continue..."\n')
            temp_script.chmod(0o755)

        return self.write_action_result(f"execute_preset_{action}", str(temp_script), {"app_names": app_names, "action": action})

    def _handle_install_dependencies(self) -> str:
        """Handle install dependencies menu choice"""
        return self._install_specific_apps()

    def _install_all_apps(self) -> str:
        """Install dependencies for all apps"""
        apps = self.registry.get("apps", {})
        install_commands = []

        for app_name, app_config in apps.items():
            commands = self.get_available_commands(app_name)
            if "install_cmd" in commands:
                install_commands.append(f'echo "Installing {app_name}..."')
                install_commands.append(commands["install_cmd"])

        if not install_commands:
            print("No install commands found for any apps")
            input("Press Enter to continue...")
            return ""

        return self._create_install_script(install_commands, "install_all")

    def _install_specific_apps(self) -> str:
        """Install dependencies for specific apps"""
        apps = self.registry.get("apps", {})
        sorted_apps = sorted(apps.items(), key=lambda x: x[1].get("id", 0))

        print("\nAvailable applications:")
        for app_name, app_config in sorted_apps:
            commands = self.get_available_commands(app_name)
            status = "✓" if "install_cmd" in commands else "✗"
            print(f"{status} {app_config.get('id', 0)}: {app_name}")

        print("\nEnter app IDs or names separated by spaces:")
        selection = input("Selection: ").strip()

        if not selection:
            return ""

        selected_apps = []
        for item in selection.split():
            app_name = None
            try:
                app_id = int(item)
                for name, config in apps.items():
                    if config.get("id") == app_id:
                        app_name = name
                        break
            except ValueError:
                if item in apps:
                    app_name = item

            if app_name:
                selected_apps.append(app_name)

        if not selected_apps:
            print("No valid apps selected")
            input("Press Enter to continue...")
            return ""

        install_commands = []
        for app_name in selected_apps:
            commands = self.get_available_commands(app_name)
            if "install_cmd" in commands:
                install_commands.append(f'echo "Installing {app_name}..."')
                install_commands.append(commands["install_cmd"])

        if not install_commands:
            print("No install commands found for selected apps")
            input("Press Enter to continue...")
            return ""

        return self._create_install_script(install_commands, "install_specific")

    def _create_install_script(self, commands: List[str], script_name: str) -> str:
        """Create installation script"""
        if self.is_windows:
            temp_script = self.data_dir / f"{script_name}.bat"
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write(f'@echo off\n')
                f.write(f'cd /d "{self.project_root}"\n')
                f.write('echo Installing dependencies...\n')
                for command in commands:
                    f.write(f'{command}\n')
                f.write('echo Installation completed.\n')
                f.write('pause\n')
        else:
            temp_script = self.data_dir / f"{script_name}.sh"
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write(f'#!/bin/bash\n')
                f.write(f'cd "{self.project_root}"\n')
                f.write('echo "Installing dependencies..."\n')
                for command in commands:
                    f.write(f'{command}\n')
                f.write('echo "Installation completed."\n')
                f.write('read -p "Press Enter to continue..."\n')
            temp_script.chmod(0o755)

        return self.write_action_result("install_dependencies", str(temp_script), {"commands": len(commands)})

    def _handle_build_applications(self) -> str:
        """Handle build applications menu choice"""
        return self._build_apps_interactive()

    def _build_apps_interactive(self) -> str:
        """Interactive build applications"""
        apps = self.registry.get("apps", {})
        sorted_apps = sorted(apps.items(), key=lambda x: x[1].get("id", 0))

        print("\nAvailable applications:")
        for app_name, app_config in sorted_apps:
            commands = self.get_available_commands(app_name)
            status = "✓" if "build_cmd" in commands else "✗"
            print(f"{status} {app_config.get('id', 0)}: {app_name}")

        print("\nEnter app IDs or names separated by spaces:")
        selection = input("Selection: ").strip()

        if not selection:
            return ""

        selected_apps = []
        for item in selection.split():
            app_name = None
            try:
                app_id = int(item)
                for name, config in apps.items():
                    if config.get("id") == app_id:
                        app_name = name
                        break
            except ValueError:
                if item in apps:
                    app_name = item

            if app_name:
                selected_apps.append(app_name)

        if not selected_apps:
            print("No valid apps selected")
            input("Press Enter to continue...")
            return ""

        build_commands = []
        for app_name in selected_apps:
            commands = self.get_available_commands(app_name)
            if "build_cmd" in commands:
                build_commands.append(f'echo "Building {app_name}..."')
                build_commands.append(commands["build_cmd"])

        if not build_commands:
            print("No build commands found for selected apps")
            input("Press Enter to continue...")
            return ""

        return self._create_build_script(build_commands, "build_selected")

    def _list_buildable_apps(self) -> str:
        """List all buildable applications"""
        apps = self.registry.get("apps", {})
        sorted_apps = sorted(apps.items(), key=lambda x: x[1].get("id", 0))

        print("\n=== Buildable Applications ===")
        buildable_count = 0

        for app_name, app_config in sorted_apps:
            commands = self.get_available_commands(app_name)
            if "build_cmd" in commands:
                buildable_count += 1
                print(f"✓ {app_config.get('id', 0)}: {app_name} ({app_config.get('type', 'unknown')})")
                print(f"    {app_config.get('description', '')}")

        print(f"\nTotal buildable applications: {buildable_count}")
        input("Press Enter to continue...")
        return ""

    def _build_all_apps(self) -> str:
        """Build all buildable applications"""
        apps = self.registry.get("apps", {})
        build_commands = []

        for app_name, app_config in apps.items():
            commands = self.get_available_commands(app_name)
            if "build_cmd" in commands:
                build_commands.append(f'echo "Building {app_name}..."')
                build_commands.append(commands["build_cmd"])

        if not build_commands:
            print("No build commands found for any apps")
            input("Press Enter to continue...")
            return ""

        return self._create_build_script(build_commands, "build_all")

    def _create_build_script(self, commands: List[str], script_name: str) -> str:
        """Create build script"""
        if self.is_windows:
            temp_script = self.data_dir / f"{script_name}.bat"
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write(f'@echo off\n')
                f.write(f'cd /d "{self.project_root}"\n')
                f.write('echo Building applications...\n')
                for command in commands:
                    f.write(f'{command}\n')
                f.write('echo Build completed.\n')
                f.write('pause\n')
        else:
            temp_script = self.data_dir / f"{script_name}.sh"
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write(f'#!/bin/bash\n')
                f.write(f'cd "{self.project_root}"\n')
                f.write('echo "Building applications..."\n')
                for command in commands:
                    f.write(f'{command}\n')
                f.write('echo "Build completed."\n')
                f.write('read -p "Press Enter to continue..."\n')
            temp_script.chmod(0o755)

        return self.write_action_result("build_applications", str(temp_script), {"commands": len(commands)})

    def _handle_build_poly_apps(self) -> str:
        """Handle build poly apps with interactive mode"""
        return self._build_apps_interactive()

    def _handle_test_registry_parser(self) -> str:
        """Handle test registry parser"""
        test_script_path = self.unified_manager_dir / "test_ini_registry.ps1"

        if test_script_path.exists():
            if self.is_windows:
                temp_script = self.data_dir / "test_registry.bat"
                with open(temp_script, 'w', encoding='utf-8') as f:
                    f.write(f'@echo off\n')
                    f.write(f'powershell -NoProfile -ExecutionPolicy Bypass -File "{test_script_path}"\n')
                    f.write('pause\n')
            else:
                # On Linux, we might need to run it differently
                temp_script = self.data_dir / "test_registry.sh"
                with open(temp_script, 'w', encoding='utf-8') as f:
                    f.write(f'#!/bin/bash\n')
                    f.write('echo "Registry parser test not available on Linux"\n')
                    f.write('read -p "Press Enter to continue..."\n')
                temp_script.chmod(0o755)

            return self.write_action_result("test_registry", str(temp_script), {})
        else:
            print("Error: test_ini_registry.ps1 script not found")
            input("Press Enter to continue...")
            return ""

    def _handle_back_to_main_menu(self) -> str:
        """Handle back to main menu choice"""
        dd_script = self.project_root / "scripts" / "shells" / "win" / "dd.ps1"

        if dd_script.exists():
            if self.is_windows:
                temp_script = self.data_dir / "back_to_main.bat"
                with open(temp_script, 'w', encoding='utf-8') as f:
                    f.write(f'@echo off\n')
                    f.write(f'powershell -NoProfile -ExecutionPolicy Bypass -File "{dd_script}" -SkipInitialization\n')
            else:
                temp_script = self.data_dir / "back_to_main.sh"
                with open(temp_script, 'w', encoding='utf-8') as f:
                    f.write(f'#!/bin/bash\n')
                    f.write('echo "Back to main menu not available on Linux"\n')
                    f.write('read -p "Press Enter to continue..."\n')
                temp_script.chmod(0o755)

            return self.write_action_result("back_to_main", str(temp_script), {})
        else:
            print("Error: dd.ps1 script not found")
            input("Press Enter to continue...")
            return ""

    def run(self) -> str:
        """Main entry point"""
        print("Starting Unified Application Manager (Python Version)")
        print()

        try:
            return self._show_app_start_interactive()
        except KeyboardInterrupt:
            print("\nExiting...")
            return ""
        except Exception as e:
            print(f"Error: {e}")
            return ""

def main():
    manager = UnifiedManagerCore()
    result_path = manager.run()

    # Output the result path for PowerShell to use
    if result_path:
        print(f"RESULT_PATH:{result_path}")

    return 0

if __name__ == "__main__":
    sys.exit(main())