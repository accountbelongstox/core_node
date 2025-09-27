#!/usr/bin/env python3

import os
import sys
import json
import platform
import io
import atexit
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


NCORE_ROOT_DIR = Path(__file__).resolve().parent.parent.parent

if str(NCORE_ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(NCORE_ROOT_DIR))

for extra_path in (
    NCORE_ROOT_DIR,
    NCORE_ROOT_DIR / "ncore",
    NCORE_ROOT_DIR / "ncore" / "pytools",
):
    path_str = str(extra_path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

from pytools.pygvar import GlobalVarManager

UNIFIED_MANAGER_EXECUTION_KEY = "UNIFIED_APP_MANAGER_EXECUTION"


ACTION_SEQUENCE: Tuple[str, ...] = ("start", "install", "build", "deploy", "stop")

class UnifiedManagerCore:
    def __init__(self):
        self.script_dir = Path(__file__).parent.resolve()
        self.project_root = self._find_project_root()
        self.is_windows = platform.system() == "Windows"
        self.is_linux = not self.is_windows
        self.data_dir = self._setup_data_directory()

        self._input_stream = sys.stdin
        self._input_fd: Optional[int] = None
        self._input_stream_needs_close = False
        self._prepare_input_stream()

        # Initialize paths
        self.apps_dir = self.project_root / "apps"
        self.poly_apps_dir = self.project_root / "poly_apps"
        self.ncore_dir = self.project_root / "ncore"
        self.scripts_dir = self.project_root / "scripts"
        self.unified_manager_dir = self.scripts_dir / "unified_manager"
        self.unified_manager_py_dir = self.scripts_dir / "unified_manager_py"

        # Registry file - use the Python version directory
        self.registry_file = self.unified_manager_py_dir / "app_registry.json"

        # Load app registry
        self.registry = self._load_app_registry()

        # Main executable
        self.main_js = (self.project_root / "main.js").resolve()

        # Global variable manager for command dispatch
        self.global_vars = GlobalVarManager()
        self.execution_key = os.environ.get("UNIFIED_MANAGER_EXECUTION_KEY", UNIFIED_MANAGER_EXECUTION_KEY)
        self.global_vars.clear(self.execution_key)

    def _clear_screen(self) -> None:
        """Clear the console screen in a cross-platform way."""
        os.system('cls' if self.is_windows else 'clear')

    def _read_key(self) -> str:
        """Read a single key press and normalise it to a semantic token."""
        if self.is_windows:
            return self._read_key_windows()
        return self._read_key_posix()

    def _prepare_input_stream(self) -> None:
        if self.is_windows:
            try:
                self._input_fd = sys.stdin.fileno()
            except (io.UnsupportedOperation, AttributeError):
                self._input_fd = None
            return

        stream = self._input_stream

        if hasattr(stream, "isatty") and stream.isatty():
            try:
                self._input_fd = stream.fileno()
            except (io.UnsupportedOperation, AttributeError):
                self._input_fd = None
            return

        try:
            tty_stream = open('/dev/tty', 'r', encoding='utf-8', errors='ignore')
        except OSError:
            try:
                self._input_stream = sys.stdin
                self._input_fd = sys.stdin.fileno()
            except (io.UnsupportedOperation, AttributeError):
                self._input_fd = None
            return

        self._input_stream = tty_stream
        try:
            self._input_fd = tty_stream.fileno()
        except (io.UnsupportedOperation, AttributeError):
            self._input_fd = None

        if self._input_stream_needs_close is False:
            self._input_stream_needs_close = True
            atexit.register(tty_stream.close)

    def _can_use_interactive_controls(self) -> bool:
        if self.is_windows:
            try:
                import msvcrt  # type: ignore
                return True
            except ImportError:
                return False

        if self._input_fd is None:
            return False

        if not sys.stdout.isatty():
            return False

        term_value = os.environ.get('TERM') or ''
        if term_value.lower() == 'dumb':
            return False

        try:
            import termios  # type: ignore
        except ImportError:
            return False

        try:
            termios.tcgetattr(self._input_fd)
        except (termios.error, OSError):
            return False

        return True

    def _read_key_windows(self) -> str:
        import msvcrt  # type: ignore

        while True:
            key = msvcrt.getwch()
            if key == '\r':
                return "ENTER"
            if key == '\x1b':
                return "ESC"
            if key == '\xe0':
                extended = msvcrt.getwch()
                mapping = {
                    'H': "UP",
                    'P': "DOWN",
                    'K': "LEFT",
                    'M': "RIGHT",
                }
                if extended in mapping:
                    return mapping[extended]
            elif key in ('\x03', '\x1a'):  # Ctrl+C / Ctrl+Z
                raise KeyboardInterrupt

    def _read_key_posix(self) -> str:
        import termios
        import tty

        if self._input_fd is None:
            raise RuntimeError("Interactive input stream is not available")

        fd = self._input_fd
        stream = self._input_stream

        try:
            old_settings = termios.tcgetattr(fd)
        except termios.error as exc:
            raise RuntimeError("Terminal does not support raw mode") from exc

        try:
            tty.setraw(fd)
            ch = stream.read(1)
            if not ch:
                return "OTHER"
            if ch == '\x1b':
                next1 = stream.read(1)
                if next1 == '[':
                    next2 = stream.read(1)
                    mapping = {
                        'A': "UP",
                        'B': "DOWN",
                        'C': "RIGHT",
                        'D': "LEFT",
                    }
                    if next2 in mapping:
                        return mapping[next2]
                return "ESC"
            if ch in ('\r', '\n'):
                return "ENTER"
            if ch == '\x03':
                raise KeyboardInterrupt
            return "OTHER"
        finally:
            try:
                termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
            except termios.error:
                pass
    def _find_project_root(self) -> Path:
        """Find the project root by looking for specific markers"""
        if NCORE_ROOT_DIR.exists():
            return NCORE_ROOT_DIR

        current = self.script_dir
        while current != current.parent:
            if (current / ".git").exists() or (current / "main.js").exists():
                return current
            current = current.parent
        return self.script_dir.parent.parent.parent

    def _setup_data_directory(self) -> Path:
        """Setup data exchange directory"""
        candidates: List[Path] = []

        home_dir = Path(os.path.expanduser("~"))
        if self.is_windows:
            candidates.append(home_dir / ".core_node" / "unified_manager")
        else:
            candidates.extend(
                [
                    Path("/usr/.core_node/unified_manager"),
                    Path("/usr/core_node/unified_manager"),
                    Path("/www/core_node/unified_manager"),
                    home_dir / ".core_node" / "unified_manager",
                ]
            )

        for candidate in candidates:
            try:
                candidate.mkdir(parents=True, exist_ok=True)
                try:
                    candidate.chmod(0o755)
                except OSError:
                    pass
                self.cache_dir = candidate / "cache"
                self.cache_dir.mkdir(exist_ok=True)
                return candidate
            except PermissionError:
                continue

        fallback = home_dir / ".core_node" / "unified_manager"
        fallback.mkdir(parents=True, exist_ok=True)
        self.cache_dir = fallback / "cache"
        self.cache_dir.mkdir(exist_ok=True)
        return fallback

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
        app_type = app_config.get("type")
        if app_type == "poly-app":
            poly_path = Path("poly_apps") / app_name
            if (self.project_root / poly_path).exists():
                return str(poly_path)
            return f"poly_apps/{app_name}"

        if app_type == "ncore-app":
            ncore_path = Path("ncore") / app_name
            apps_path = Path("apps") / app_name
            if (self.project_root / ncore_path).exists():
                return str(ncore_path)
            if (self.project_root / apps_path).exists():
                return str(apps_path)
            return f"apps/{app_name}"

        return f"apps/{app_name}"

    def _script_priority_extensions(self) -> Tuple[str, ...]:
        if self.is_windows:
            return (".ps1", ".bat", ".cmd", ".sh")
        return (".sh", ".ps1", ".bat", ".cmd")

    def _locate_app_script(self, app_name: str, app_config: Dict[str, Any], action: str) -> Optional[Path]:
        app_path = self.get_app_path(app_name, app_config)
        for ext in self._script_priority_extensions():
            script_path = self.get_app_script_path(app_path, f"{action}{ext}")
            if script_path.exists():
                try:
                    return script_path.resolve()
                except OSError:
                    return script_path
        return None

    def _build_command_for_script(self, script_path: Path) -> str:
        try:
            absolute_path = script_path.resolve()
        except OSError:
            absolute_path = script_path
        ext = absolute_path.suffix.lower()
        quoted = f'"{absolute_path}"'
        if self.is_windows:
            if ext == ".ps1":
                return f'powershell -NoProfile -ExecutionPolicy Bypass -File {quoted}'
            if ext in {".bat", ".cmd"}:
                return quoted
            if ext == ".sh":
                return f'bash {quoted}'
            return quoted
        # Linux / others
        if ext == ".sh":
            return f'bash {quoted}'
        if ext == ".ps1":
            return f'powershell -NoProfile -ExecutionPolicy Bypass -File {quoted}'
        if ext in {".bat", ".cmd"}:
            return f'bash {quoted}'
        return quoted

    def _collect_app_action_targets(self, app_name: str, app_config: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        targets: Dict[str, Dict[str, Any]] = {}

        for action in ACTION_SEQUENCE:
            app_type = app_config.get("type")

            if action == "start" and app_type == "ncore-app":
                targets[action] = {
                    "kind": "command",
                    "command": self._get_node_command_ncore(app_name),
                }
                continue

            script_path = self._locate_app_script(app_name, app_config, action)
            if script_path:
                targets[action] = {
                    "kind": "script",
                    "path": script_path,
                }
                continue

            if action == "start":
                if app_type == "poly-app":
                    targets[action] = {
                        "kind": "command",
                        "command": self._get_node_command_poly(app_name),
                    }
                elif app_type == "ncore-app":
                    targets[action] = {
                        "kind": "command",
                        "command": self._get_node_command_ncore(app_name),
                    }

        return targets

    def _collect_preset_available_actions(self, preset_config: Dict[str, Any]) -> List[str]:
        app_names = preset_config.get("app_names", [])
        if not app_names:
            return []

        apps = self.registry.get("apps", {})
        available: List[str] = []
        action_to_command = {
            "start": "start_cmd",
            "install": "install_cmd",
            "build": "build_cmd",
            "deploy": "deploy_cmd",
            "stop": "stop_cmd",
        }

        for action in ACTION_SEQUENCE:
            command_key = action_to_command.get(action, "start_cmd")
            found = False
            for app_name in app_names:
                app_config = apps.get(app_name)
                if not app_config:
                    continue
                commands = self.get_available_commands(app_name)
                if command_key in commands:
                    found = True
                    break
                if action == "start":
                    targets = self._collect_app_action_targets(app_name, app_config)
                    if "start" in targets:
                        found = True
                        break
            if found:
                available.append(action)

        if not available and app_names:
            available.append("start")

        return available

    def _create_windows_ps1_wrapper(self, script_path: Path, app_name: str, action: str) -> Path:
        safe_app = app_name.replace(' ', '_')
        wrapper_name = f"{safe_app}_{action}_wrapper.bat"
        wrapper_path = self.cache_dir / wrapper_name
        with open(wrapper_path, 'w', encoding='utf-8') as f:
            f.write('@echo off\n')
            f.write(f'powershell -NoProfile -ExecutionPolicy Bypass -File "{script_path}"\n')
        return wrapper_path

    def _prepare_script_for_execution(self, script_path: Path, app_name: str, action: str) -> str:
        if not script_path.exists():
            print(f"Error: Script not found: {script_path}")
            input("Press Enter to continue...")
            return ""

        execution_path = script_path
        if self.is_windows and script_path.suffix.lower() == ".ps1":
            execution_path = self._create_windows_ps1_wrapper(script_path, app_name, action)

        if not self.is_windows:
            try:
                current_mode = execution_path.stat().st_mode
                execution_path.chmod(current_mode | 0o111)
            except OSError:
                pass

        params = {
            "app": app_name,
            "action": action,
            "original_script": str(script_path),
            "execution_script": str(execution_path),
        }
        return self.write_action_result("execute_script", str(execution_path), params)

    def _confirm_action_execution(self, app_name: str, action: str, detail: str) -> bool:
        print("")
        print(f"[CONFIRM] {app_name} :: {action}")
        print(f"Will execute: {detail}")
        response = input("Proceed? (y/N): ").strip().lower()
        return response in {"y", "yes"}

    def _confirm_preset_execution(self, preset_name: str, action: str, details: List[Tuple[str, str]]) -> bool:
        print("")
        print(f"[CONFIRM] Preset {preset_name} :: {action}")
        print("Will execute:")
        for app_name, command in details:
            print(f"  - {app_name}: {command}")
        response = input("Proceed? (y/N): ").strip().lower()
        return response in {"y", "yes"}

    def get_available_commands(self, app_name: str) -> Dict[str, str]:
        """Get all available commands for an app"""
        commands: Dict[str, str] = {}
        app_config = self.registry["apps"].get(app_name)
        if not app_config:
            return commands

        targets = self._collect_app_action_targets(app_name, app_config)
        for action, info in targets.items():
            key = f"{action}_cmd"
            if info["kind"] == "script":
                commands[key] = self._build_command_for_script(info["path"])
            elif info["kind"] == "command":
                commands[key] = info["command"]

        return commands

    def _get_node_command_poly(self, app_name: str) -> str:
        """Get node command for poly apps"""
        main_entry = str(self.main_js)
        return f'node "{main_entry}" poly_app={app_name}'

    def _get_node_command_ncore(self, app_name: str) -> str:
        """Get node command for ncore apps"""
        main_entry = str(self.main_js)
        return f'node "{main_entry}" app={app_name}'

    def _load_cache(self) -> Dict[str, Any]:
        """Load cached app action selections"""
        cache_file = self.cache_dir / "app_actions.json"
        try:
            if cache_file.exists():
                with open(cache_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load cache: {e}")
        return {}

    def _save_cache(self, cache_data: Dict[str, Any]) -> None:
        """Save app action selections to cache"""
        cache_file = self.cache_dir / "app_actions.json"
        try:
            with open(cache_file, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Warning: Could not save cache: {e}")



    def _get_cached_action(self, cache_data: Dict[str, Any], item_type: str, name: str) -> Optional[str]:

        """Retrieve cached action for an item, supporting legacy formats."""

        key = f"app_{name}" if item_type == "app" else f"preset_{name}"

        cached = cache_data.get(key)

        if isinstance(cached, str) and cached:

            return cached

        legacy_key = "app_actions" if item_type == "app" else "preset_actions"

        legacy_map = cache_data.get(legacy_key)

        if isinstance(legacy_map, dict):

            legacy_value = legacy_map.get(name)

            if isinstance(legacy_value, str) and legacy_value:

                return legacy_value

        return None










    def write_action_result(self, action: str, script_path: Optional[str] = None, params: Optional[Dict[str, Any]] = None) -> str:
        """Persist the last selected script so wrapper scripts can trigger it."""
        result_file = self.data_dir / "action_result.json"

        params_copy: Dict[str, Any] = dict(params or {})
        dispatch_commands: List[str] = []
        dispatch_scripts: List[str] = []

        def append_unique(collection: List[str], candidate: Optional[str]) -> None:
            if isinstance(candidate, str):
                trimmed = candidate.strip()
                if trimmed and trimmed not in collection:
                    collection.append(trimmed)

        if script_path:
            append_unique(dispatch_scripts, str(script_path))

        scripts_field = params_copy.get("scripts")
        if isinstance(scripts_field, list):
            for entry in scripts_field:
                if isinstance(entry, str):
                    append_unique(dispatch_scripts, entry)

        command_value = params_copy.get("command")
        append_unique(dispatch_commands, command_value)

        commands_field = params_copy.get("commands")
        if isinstance(commands_field, list):
            for entry in commands_field:
                if isinstance(entry, dict):
                    append_unique(dispatch_commands, entry.get("command"))
                else:
                    append_unique(dispatch_commands, entry)

        dispatch = {
            "commands": dispatch_commands,
            "scripts": dispatch_scripts,
        }

        result = {
            "action": action,
            "script_path": script_path,
            "params": params_copy,
            "dispatch": dispatch,
            "timestamp": datetime.now().isoformat(),
            "platform": "windows" if self.is_windows else "linux",
            "cache_dir": str(self.cache_dir),
        }

        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        try:
            if dispatch_commands or dispatch_scripts:
                self.global_vars.set_json(self.execution_key, result)
            else:
                self.global_vars.clear(self.execution_key)
        except Exception as exc:
            print(f"[WARN] Failed to update execution queue: {exc}")

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

        if not self._can_use_interactive_controls():
            return self._handle_menu_fallback(menu_items)

        # Arrow key navigation for both Windows and Linux
        def draw_menu():
            self._clear_screen()
            print("=== Unified App Manager ===")
            print("Use ↑↓ arrows to navigate, Enter to select, Esc to exit")
            print()

            for i, item in enumerate(menu_items):
                if i == selected_index:
                    print(f"> {item['text']}")
                else:
                    print(f"  {item['text']}")

        while True:
            draw_menu()

            try:
                key = self._read_key()
            except KeyboardInterrupt:
                self._clear_screen()
                return ""
            except RuntimeError:
                return self._handle_menu_fallback(menu_items)

            if key == "UP":
                selected_index = (selected_index - 1) % len(menu_items)
            elif key == "DOWN":
                selected_index = (selected_index + 1) % len(menu_items)
            elif key == "ENTER":
                self._clear_screen()
                return menu_items[selected_index]["action"]()
            elif key == "ESC":
                self._clear_screen()
                print("Exiting...")
                return ""

    def _handle_menu_fallback(self, menu_items: List[Dict[str, Any]]) -> str:
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
            print("Invalid selection.")
            return ""
        except (EOFError, ValueError):
            print("\nExiting...")
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

    def _show_app_start_interactive(self, wait_for_input: bool = True) -> str:
        """Show interactive app start menu with toggle functionality"""
        apps = self.registry.get("apps", {})
        presets = self.registry.get("presets", {})

        if not apps and not presets:
            print("No applications or presets found in registry.")
            if wait_for_input:
                input("Press Enter to continue...")
            return ""

        # Load cached selections
        cache_data = self._load_cache()

        app_items: List[Dict[str, Any]] = []
        sorted_apps = sorted(apps.items(), key=lambda x: x[1].get("id", 0))

        for app_name, app_config in sorted_apps:
            action_targets = self._collect_app_action_targets(app_name, app_config)
            if not action_targets:
                continue

            available_actions = [action for action in ACTION_SEQUENCE if action in action_targets]
            if not available_actions:
                continue

            cache_key = f"app_{app_name}"
            current_action = cache_data.get(cache_key, available_actions[0])
            if current_action not in available_actions:
                current_action = available_actions[0]

            app_items.append({
                "type": "app",
                "name": app_name,
                "config": app_config,
                "available_actions": available_actions,
                "current_action": current_action,
                "action_targets": action_targets,
                "display_label": f"A{len(app_items) + 1}",
            })

        preset_items: List[Dict[str, Any]] = []
        sorted_presets = sorted(presets.items(), key=lambda x: x[1].get("id", 0))
        for preset_name, preset_config in sorted_presets:
            available_actions = self._collect_preset_available_actions(preset_config)
            if not available_actions:
                continue

            cache_key = f"preset_{preset_name}"
            current_action = cache_data.get(cache_key, available_actions[0])
            if current_action not in available_actions:
                current_action = available_actions[0]

            preset_items.append({
                "type": "preset",
                "name": preset_name,
                "config": preset_config,
                "available_actions": available_actions,
                "current_action": current_action,
                "display_label": f"P{len(preset_items) + 1}",
            })

        all_items = app_items + preset_items

        if not all_items:
            print("No executable applications or presets found.")
            input("Press Enter to continue...")
            return ""

        last_index = cache_data.get("__last_selection_index__", 0)
        if not 0 <= last_index < len(all_items):
            last_index = 0

        return self._show_toggle_menu(all_items, cache_data, last_index, wait_for_input)

    def _show_toggle_menu(self, items: List[Dict[str, Any]], cache_data: Dict[str, Any], selected_index: int, wait_for_input: bool = True) -> str:
        """Show menu with toggle functionality, supporting both Windows and Linux arrows."""
        if not self._can_use_interactive_controls():
            return self._show_simple_toggle_menu(items, cache_data, selected_index, wait_for_input)

        def draw_menu(current_index: int) -> None:
            self._clear_screen()
            system_name = platform.system()
            print("=== Unified Application Manager ===")
            print(f"System: {system_name} | Cache: {self.cache_dir}")
            print("Use ↑↓ to navigate, ←→ to toggle, Enter to run, Esc to exit")
            print()

            printed_preset_header = False
            for idx, item in enumerate(items):
                if item["type"] == "preset" and not printed_preset_header:
                    print()
                    print("--- Presets ---")
                    printed_preset_header = True
                elif idx == 0:
                    print("--- Applications ---")

                prefix = ">" if idx == current_index else " "
                name = item["name"]
                label = item.get("display_label", str(idx + 1))
                actions = item.get("available_actions", [])
                current = item.get("current_action", "start")
                action_display = " ".join(
                    f"[{act.upper()}]" if act == current else act
                    for act in actions
                )

                if item["type"] == "app":
                    app_type = item["config"].get("type", "unknown")
                    app_id = item["config"].get("id", "-")
                    print(f"{prefix} [{label}] {name} (#{app_id}, {app_type}) :: {action_display}")
                else:
                    preset_id = item["config"].get("id", "-")
                    print(f"{prefix} [{label}] {name} (P{preset_id}) :: {action_display}")

        index = selected_index

        while True:
            draw_menu(index)
            try:
                key = self._read_key()
            except KeyboardInterrupt:
                self._clear_screen()
                return ""
            except RuntimeError:
                return self._show_simple_toggle_menu(items, cache_data, index, wait_for_input)

            if key == "UP":
                index = (index - 1) % len(items)
            elif key == "DOWN":
                index = (index + 1) % len(items)
            elif key in {"LEFT", "RIGHT"}:
                current_item = items[index]
                actions = current_item.get("available_actions", [])
                if len(actions) > 1:
                    current = current_item.get("current_action", actions[0])
                    current_idx = actions.index(current)
                    if key == "LEFT":
                        current_idx = (current_idx - 1) % len(actions)
                    else:
                        current_idx = (current_idx + 1) % len(actions)
                    current_item["current_action"] = actions[current_idx]
                    cache_key = f"app_{current_item['name']}" if current_item["type"] == "app" else f"preset_{current_item['name']}"
                    cache_data[cache_key] = current_item["current_action"]
                    cache_data["__last_selection_index__"] = index
                    self._save_cache(cache_data)
            elif key == "ENTER":
                self._clear_screen()
                selected_item = items[index]

                new_cache = cache_data.copy()
                new_cache["__last_selection_index__"] = index
                for item in items:
                    cache_key = f"app_{item['name']}" if item["type"] == "app" else f"preset_{item['name']}"
                    new_cache[cache_key] = item.get("current_action", "start")
                self._save_cache(new_cache)

                if selected_item["type"] == "app":
                    return self._execute_app_action(selected_item)
                return self._execute_preset_action(selected_item)
            elif key == "ESC":
                self._clear_screen()
                return ""

    def _show_simple_toggle_menu(self, items: List[Dict[str, Any]], cache_data: Dict[str, Any], selected_index: int, wait_for_input: bool = True) -> str:
        """Simple menu fallback when interactive arrows are unavailable."""
        print("=== Unified Application Manager ===")
        print(f"System: {platform.system()} | Cache: {self.cache_dir}")
        print("Input format: <label> [action]. Example: A1 install")
        print()

        printed_preset_header = False
        for idx, item in enumerate(items):
            # Print section headers
            if item["type"] == "preset" and not printed_preset_header:
                print()
                print("--- Presets ---")
                printed_preset_header = True
            elif idx == 0:
                print("--- Applications ---")

            label = item.get("display_label", f"#{idx + 1}")
            actions = item.get("available_actions", [])
            current = item.get("current_action", "start")
            action_display = " ".join(
                f"[{act.upper()}]" if act == current else act
                for act in actions
            )
            prefix = "*" if idx == selected_index else " "
            if item["type"] == "app":
                app_type = item["config"].get("type", "unknown")
                app_id = item["config"].get("id", "-")
                print(f"{prefix} [{label}] {item['name']} (#{app_id}, {app_type}) :: {action_display}")
            else:
                preset_id = item["config"].get("id", "-")
                print(f"{prefix} [{label}] {item['name']} (P{preset_id}) :: {action_display}")

        if not wait_for_input:
            return ""

        try:
            raw_choice = input("Selection: ").strip()
        except EOFError:
            return ""

        if not raw_choice:
            return ""

        parts = raw_choice.split()
        selection_token = parts[0]
        requested_action = parts[1].lower() if len(parts) > 1 else None

        selection_upper = selection_token.upper()
        selected_item: Optional[Dict[str, Any]] = None

        for idx, item in enumerate(items):
            label = item.get("display_label", f"#{idx + 1}").upper()
            if selection_upper == label:
                selected_item = item
                break
            if item["type"] == "preset" and selection_upper.startswith('P'):
                preset_id = selection_upper[1:]
                if str(item["config"].get("id", "")) == preset_id:
                    selected_item = item
                    break
            if item["type"] == "app":
                try:
                    app_id = int(selection_token)
                    if item["config"].get("id") == app_id:
                        selected_item = item
                        break
                except ValueError:
                    pass
                if item["name"].lower() == selection_token.lower():
                    selected_item = item
                    break

        if not selected_item:
            print(f"Selection '{selection_token}' not recognised")
            input("Press Enter to continue...")
            return ""

        if requested_action:
            actions = selected_item.get("available_actions", [])
            if requested_action not in actions:
                print(f"Action '{requested_action}' not available for {selected_item['name']}")
                input("Press Enter to continue...")
                return ""
            selected_item["current_action"] = requested_action

        new_cache = cache_data.copy()
        new_cache["__last_selection_index__"] = items.index(selected_item)
        for item in items:
            cache_key = f"app_{item['name']}" if item["type"] == "app" else f"preset_{item['name']}"
            new_cache[cache_key] = item.get("current_action", "start")
        self._save_cache(new_cache)

        if selected_item["type"] == "app":
            return self._execute_app_action(selected_item)
        return self._execute_preset_action(selected_item)

    def _execute_app_action(self, item: Dict[str, Any]) -> str:
        """Execute the selected action for an app."""
        app_name = item["name"]
        action = item.get("current_action", "start")
        app_config = item["config"]
        targets = item.get("action_targets") or self._collect_app_action_targets(app_name, app_config)
        target = targets.get(action)

        if not target:
            print(f"No '{action}' action available for {app_name}")
            input("Press Enter to continue...")
            return ""

        if target["kind"] == "script":
            script_path = target["path"]
            if not self._confirm_action_execution(app_name, action, f"script {script_path}"):
                print("Action cancelled.")
                return ""
            return self._prepare_script_for_execution(script_path, app_name, action)

        command = target.get("command")
        if not command:
            print(f"No command defined for {app_name}::{action}")
            input("Press Enter to continue...")
            return ""

        script_identifier = f"{action}_{app_name.replace(' ', '_')}"
        if not self._confirm_action_execution(app_name, action, f"command {command}"):
            print("Action cancelled.")
            return ""
        return self._create_execute_script(command, script_identifier)

    def _execute_preset_action(self, item: Dict[str, Any]) -> str:
        """Execute the selected action for a preset."""
        preset_name = item["name"]
        action = item.get("current_action", "start")
        preset_config = item["config"]
        app_names = preset_config.get("app_names", [])

        if not app_names:
            print(f"Preset '{preset_name}' has no applications configured")
            input("Press Enter to continue...")
            return ""

        script_name = f"preset_{preset_config.get('id', preset_name)}_{action}"
        result = self._create_preset_action_script(preset_name, app_names, action, script_name)
        if not result:
            print(f"Failed to create preset script for {preset_name}")
            input("Press Enter to continue...")
        return result

    def _execute_preset_by_name(self, preset_name: str) -> str:
        """Execute preset by name (for backward compatibility)"""
        presets = self.registry.get("presets", {})
        if preset_name in presets:
            preset_config = presets[preset_name]
            app_names = preset_config.get("app_names", [])
            return self._create_preset_action_script(preset_name, app_names, "start", f"preset_{preset_name}")
        else:
            print(f"Preset '{preset_name}' not found")
            input("Press Enter to continue...")
            return ""

    def _execute_app_node_command(self, app_name: str) -> str:
        """Execute poly app using node main.js"""
        # Create a batch script to execute the node command
        main_entry = str(self.main_js)
        script_content = f'node "{main_entry}" poly_app={app_name}'

        if not self._confirm_action_execution(app_name, "start", f"command {script_content}"):
            print("Action cancelled.")
            return ""

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

    def _create_preset_action_script(self, preset_name: str, app_names: List[str], action: str, script_name: str) -> str:
        """Create a script to execute specific action for multiple apps from a preset"""
        apps = self.registry.get("apps", {})
        run_entries: List[Tuple[str, str]] = []

        for app_name in app_names:
            app_config = apps.get(app_name)
            if not app_config:
                continue

            command: Optional[str] = None
            targets = self._collect_app_action_targets(app_name, app_config)
            target = targets.get(action)
            if target:
                if target["kind"] == "script":
                    command = self._build_command_for_script(target["path"])
                elif target["kind"] == "command":
                    command = target.get("command")

            if not command:
                app_commands = self.get_available_commands(app_name)
                command = app_commands.get(f"{action}_cmd")

            if not command:
                print(f"Warning: No {action} command found for {app_name}")
                continue

            run_entries.append((app_name, command))

        if not run_entries:
            print(f"No valid {action} commands found for preset apps")
            input("Press Enter to continue...")
            return ""

        if not self._confirm_preset_execution(preset_name, action, run_entries):
            print("Action cancelled.")
            return ""

        if self.is_windows:
            temp_script = self.data_dir / f"{script_name}.bat"
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write('@echo off\n')
                f.write(f'cd /d "{self.project_root}"\n')
                f.write(f'echo Launching {action} for preset apps: {", ".join(app for app, _ in run_entries)}\n')
                for app_name, command in run_entries:
                    escaped = command.replace('"', '""')
                    f.write(f'echo Starting {app_name} ({action})...\n')
                    f.write(f'start "" /B cmd /c "{escaped}"\n')
                f.write('echo All commands dispatched.\n')
                f.write('pause\n')
        else:
            temp_script = self.data_dir / f"{script_name}.sh"
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write('#!/bin/bash\n')
                f.write('set -e\n')
                f.write(f'cd "{self.project_root}"\n')
                f.write(f'echo "Launching {action} for preset apps: {", ".join(app for app, _ in run_entries)}"\n')
                for app_name, command in run_entries:
                    f.write(f'echo "Starting {app_name} ({action})..."\n')
                    f.write(f'({command}) &\n')
                f.write('echo "All commands dispatched in background."\n')
                f.write('read -p "Press Enter to continue..."\n')
            temp_script.chmod(0o755)

        params = {
            "preset": preset_name,
            "app_names": app_names,
            "action": action,
            "commands": [
                {"app": app_name, "command": command}
                for app_name, command in run_entries
            ],
        }

        return self.write_action_result(f"execute_preset_{action}", str(temp_script), params)

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
            # Check if we have command line arguments
            if len(sys.argv) > 1:
                # Command line mode - process arguments
                return self._process_command_line_args()
            elif not sys.stdin.isatty():
                # Non-interactive mode - show menu without waiting for input
                return self._show_app_start_interactive(wait_for_input=False)
            else:
                # Interactive mode - show menu and wait for input
                return self._show_app_start_interactive()
        except KeyboardInterrupt:
            print("\nExiting...")
            return ""
        except Exception as e:
            print(f"Error: {e}")
            return ""

    def _process_command_line_args(self) -> str:
        """Process command line arguments"""
        if len(sys.argv) < 2:
            return ""
        
        selection = sys.argv[1]
        action = sys.argv[2] if len(sys.argv) > 2 else None
        
        return self._process_selection(selection, action)
    
    def _process_stdin_input(self) -> str:
        """Process input from stdin"""
        try:
            # Read input from stdin
            line = sys.stdin.readline().strip()
            if not line:
                return ""
            
            parts = line.split()
            selection = parts[0] if parts else ""
            action = parts[1] if len(parts) > 1 else None
            
            return self._process_selection(selection, action)
        except (EOFError, KeyboardInterrupt):
            return ""
    
    def _process_selection(self, selection: str, action: Optional[str] = None) -> str:

        """Process a selection string and optional action"""

        if not selection:

            return ""



        cache_data = self._load_cache()

        if not isinstance(cache_data, dict):

            cache_data = {}



        requested_action = action.lower() if isinstance(action, str) else None



        # Get all items (apps and presets)

        apps = self.registry.get("apps", {})

        presets = self.registry.get("presets", {})



        # Build items list

        app_items: List[Dict[str, Any]] = []

        sorted_apps = sorted(apps.items(), key=lambda x: x[1].get("id", 0))

        for app_name, app_config in sorted_apps:

            action_targets = self._collect_app_action_targets(app_name, app_config)

            if not action_targets:

                continue



            available_actions = [act for act in ACTION_SEQUENCE if act in action_targets]

            if not available_actions:

                continue



            cached_action = self._get_cached_action(cache_data, "app", app_name)

            if cached_action not in available_actions:

                cached_action = None



            current_action = cached_action or available_actions[0]



            app_items.append({

                "type": "app",

                "name": app_name,

                "config": app_config,

                "available_actions": available_actions,

                "current_action": current_action,

                "action_targets": action_targets,

                "display_label": f"A{len(app_items) + 1}",

            })



        preset_items: List[Dict[str, Any]] = []

        sorted_presets = sorted(presets.items(), key=lambda x: x[1].get("id", 0))

        for preset_name, preset_config in sorted_presets:

            available_actions = self._collect_preset_available_actions(preset_config)

            if not available_actions:

                continue



            cached_action = self._get_cached_action(cache_data, "preset", preset_name)

            if cached_action not in available_actions:

                cached_action = None



            current_action = cached_action or available_actions[0]



            preset_items.append({

                "type": "preset",

                "name": preset_name,

                "config": preset_config,

                "available_actions": available_actions,

                "current_action": current_action,

                "display_label": f"P{len(preset_items) + 1}",

            })



        all_items = app_items + preset_items



        # Find the selected item

        selected_item: Optional[Dict[str, Any]] = None

        selection_upper = selection.upper()



        for item in all_items:

            label = item.get("display_label", "").upper()

            if selection_upper == label:

                selected_item = item

                break

            if item["type"] == "preset" and selection_upper.startswith('P'):

                preset_id = selection_upper[1:]

                if str(item["config"].get("id", "")) == preset_id:

                    selected_item = item

                    break

            if item["type"] == "app":

                try:

                    app_id = int(selection)

                    if item["config"].get("id") == app_id:

                        selected_item = item

                        break

                except ValueError:

                    pass

                if item["name"].lower() == selection.lower():

                    selected_item = item

                    break



        if not selected_item:

            print(f"Selection '{selection}' not recognised")

            return ""



        available_actions = selected_item.get("available_actions", [])



        if requested_action:

            if requested_action not in available_actions:

                print(f"Action '{requested_action}' not available for {selected_item['name']}")

                return ""

            selected_item["current_action"] = requested_action



        current_action = selected_item.get("current_action")

        if current_action not in available_actions and available_actions:

            current_action = available_actions[0]

            selected_item["current_action"] = current_action



        if selected_item["type"] == "app":

            result = self._execute_app_action(selected_item)

        else:

            result = self._execute_preset_action(selected_item)



        selected_index = all_items.index(selected_item) if selected_item in all_items else 0

        selected_action = selected_item.get("current_action") or (available_actions[0] if available_actions else "start")



        new_cache: Dict[str, Any] = dict(cache_data)

        cache_key = f"app_{selected_item['name']}" if selected_item["type"] == "app" else f"preset_{selected_item['name']}"

        new_cache[cache_key] = selected_action



        map_key = "app_actions" if selected_item["type"] == "app" else "preset_actions"

        existing_map = new_cache.get(map_key)

        if isinstance(existing_map, dict):

            updated_map = dict(existing_map)

        else:

            updated_map = {}

        updated_map[selected_item["name"]] = selected_action

        new_cache[map_key] = updated_map



        new_cache["__last_selection_index__"] = selected_index

        new_cache["last_selected_index"] = selected_index

        new_cache["last_selected_type"] = selected_item["type"]



        self._save_cache(new_cache)



        return result



def main():
    manager = UnifiedManagerCore()
    result_path = manager.run()

    # Output the result path for PowerShell to use
    if result_path:
        print(f"RESULT_PATH:{result_path}")

    return 0

if __name__ == "__main__":
    sys.exit(main())
