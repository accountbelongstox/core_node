#!/usr/bin/env python3
"""
Laravel App Directory Tree Printer
Scans Laravel apps and prints directory structure based on selected mode
"""

import os
import sys
import json
import argparse
import re
from pathlib import Path
from datetime import datetime

# Directory definitions
ROOT_DIR = Path(__file__).parent / "../.."
LARAVEL_DIR = ROOT_DIR / "poly_apps" / "laravel_main"
APPS_NAMESPACE_DIR = LARAVEL_DIR / "app" / "Apps"
USERNAME = os.environ.get('USERNAME', os.environ.get('USER', 'default'))
CACHE_DIR = Path('D:/programing/Users') / USERNAME / '.core_node' / '.laravel_build'
CACHE_FILE = CACHE_DIR / "laravel_menu_cache.json"

# Debug flag
DEBUG = True

def debug_print(message):
    """Print debug message if DEBUG is enabled"""
    if DEBUG:
        print(f"[DEBUG] {message}")

# Print modes
MODES = ["code", "code_routes", "all"]

# Directories to exclude
EXCLUDE_DIRS = {
    "node_modules", ".git", ".idea", ".vscode", "__pycache__",
    "vendor", "storage", "bootstrap/cache", "tests", "database/factories",
    "database/seeders", "public/hot", "public/storage"
}

# Directories that always start with dot
EXCLUDE_DOT_DIRS = {
    ".git", ".idea", ".vscode", ".docker", ".env", ".github"
}

# File extensions to exclude
EXCLUDE_EXTENSIONS = {
    ".pyd", ".pyc", ".so", ".dll", ".exe", ".bin", ".obj",
    ".class", ".jar", ".war", ".ear", ".lock", ".log"
}

ROUTE_GLOBAL_ALLOW = {
    "api",
    "api.php",
    "console.php",
    "settings.php",
    "web.php"
}

# ANSI color codes
COLOR_YELLOW = '\033[93m'
COLOR_RESET = '\033[0m'

# Constants
USE_TIMESTAMP_BY_DEFAULT = False  # Set to True to use timestamp by default


def print_yellow(text):
    """Print text in yellow color"""
    print(f"{COLOR_YELLOW}{text}{COLOR_RESET}")


def scan_available_apps():
    """Scan and return list of available app names"""
    debug_print("=== scan_available_apps() START ===")
    debug_print(f"ROOT_DIR: {ROOT_DIR}")
    debug_print(f"LARAVEL_DIR: {LARAVEL_DIR}")

    # Try multiple possible locations for Apps directory
    possible_apps_dirs = [
        LARAVEL_DIR / "app" / "Apps",  # Prioritize this location as it's where the apps actually are
        LARAVEL_DIR / "Apps",
        LARAVEL_DIR / "app" / "apps"
    ]

    apps = []
    apps_dir = None
    debug_print("Checking possible Apps directories:")

    for i, possible_dir in enumerate(possible_apps_dirs):
        debug_print(f"  {i+1}. Checking: {possible_dir} - EXISTS: {possible_dir.exists()}")
        if possible_dir.exists():
            apps_dir = possible_dir
            debug_print(f"  -> SELECTED: {apps_dir}")
            break

    if apps_dir:
        print(f"Found Apps directory at: {apps_dir}")
        debug_print("Scanning for apps:")
        for entry in sorted(apps_dir.iterdir()):
            debug_print(f"  Entry: {entry.name} - IS_DIR: {entry.is_dir()} - STARTS_WITH_DOT: {entry.name.startswith('.')}")
            if entry.is_dir() and not entry.name.startswith('.'):
                apps.append(entry.name)
                debug_print(f"    -> ADDED: {entry.name}")
        debug_print(f"Total apps found: {len(apps)}")
    else:
        print_yellow("Warning: Apps directory not found in any expected location")
        print_yellow("Only 'laravel' option will be available")

    # Always add 'laravel' option
    apps.append('laravel')
    debug_print(f"Final apps list: {apps}")
    debug_print("=== scan_available_apps() END ===")
    return apps


def fuzzy_match_app(search_term, available_apps):
    """Fuzzy match app name (case-insensitive substring match)"""
    debug_print("=== fuzzy_match_app() START ===")
    debug_print(f"Search term: '{search_term}'")
    debug_print(f"Available apps: {available_apps}")

    search_lower = search_term.lower()
    debug_print(f"Search term (lowercase): '{search_lower}'")

    # Exact match first
    debug_print("Checking for exact match:")
    for app in available_apps:
        debug_print(f"  Comparing '{app.lower()}' == '{search_lower}': {app.lower() == search_lower}")
        if app.lower() == search_lower:
            debug_print(f"  -> EXACT MATCH FOUND: {app}")
            debug_print("=== fuzzy_match_app() END (EXACT MATCH) ===")
            return app

    # Substring match
    debug_print("Checking for substring match:")
    matches = [app for app in available_apps if search_lower in app.lower()]
    debug_print(f"Substring matches: {matches}")

    if len(matches) == 1:
        debug_print(f"  -> SINGLE SUBSTRING MATCH: {matches[0]}")
        debug_print("=== fuzzy_match_app() END (SINGLE MATCH) ===")
        return matches[0]
    elif len(matches) > 1:
        print_yellow(f"Warning: Multiple matches found for '{search_term}': {', '.join(matches)}")
        print_yellow(f"Using first match: {matches[0]}")
        debug_print(f"  -> MULTIPLE MATCHES, USING FIRST: {matches[0]}")
        debug_print("=== fuzzy_match_app() END (MULTIPLE MATCHES) ===")
        return matches[0]
    else:
        debug_print("  -> NO MATCHES FOUND")
        debug_print("=== fuzzy_match_app() END (NO MATCHES) ===")
        return None


class CacheManager:
    """Manages cache for menu selections"""

    @staticmethod
    def load_cache():
        """Load cached menu selections"""
        try:
            if CACHE_FILE.exists():
                with open(CACHE_FILE, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load cache: {e}")
        return {}

    @staticmethod
    def save_cache(cache_data):
        """Save menu selections to cache"""
        try:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(CACHE_FILE, 'w') as f:
                json.dump(cache_data, f, indent=2)
        except Exception as e:
            print(f"Warning: Could not save cache: {e}")


class DirectoryTreePrinter:
    """Prints directory tree structure"""

    def __init__(self, base_dir=None, selected_app=None):
        debug_print("=== DirectoryTreePrinter.__init__() START ===")
        self.output_lines = []
        self.base_dir = Path(base_dir) if base_dir else None
        self.selected_app = selected_app
        self.namespace_root = APPS_NAMESPACE_DIR
        self.selected_namespace_path = None
        self.selected_namespace_printed = False
        self.namespace_tokens = set()
        if self.selected_app:
            lower_name = self.selected_app.lower()
            snake_case = re.sub(r'(?<!^)(?=[A-Z])', '_', self.selected_app).lower()
            compact_name = re.sub(r'[^a-z0-9]+', '', lower_name)
            self.namespace_tokens.update({lower_name, snake_case, compact_name})
            potential_namespace = self.namespace_root / self.selected_app
            if potential_namespace.exists():
                self.selected_namespace_path = potential_namespace.resolve()
        debug_print(f"  base_dir: {self.base_dir}")
        debug_print(f"  selected_app: {self.selected_app}")
        debug_print(f"  namespace_root: {self.namespace_root}")
        debug_print(f"  selected_namespace_path: {self.selected_namespace_path}")
        debug_print(f"  namespace_tokens: {sorted(self.namespace_tokens)}")
        debug_print("=== DirectoryTreePrinter.__init__() END ===")

    def should_exclude(self, path, is_dir=False):
        """Check if path should be excluded"""
        name = os.path.basename(path)
        path_obj = Path(path)
        resolved_path = path_obj.resolve()
        relative_parts = ()
        if self.base_dir:
            try:
                relative_parts = resolved_path.relative_to(self.base_dir.resolve()).parts
            except Exception:
                relative_parts = ()

        debug_print(f"  should_exclude() - path: {path}, is_dir: {is_dir}, name: {name}")

        if self.selected_app and self.namespace_root and self.namespace_root.exists():
            try:
                namespace_relative = resolved_path.relative_to(self.namespace_root.resolve())
            except Exception:
                namespace_relative = None
            if namespace_relative and namespace_relative.parts:
                namespace_owner = namespace_relative.parts[0]
                if namespace_owner != self.selected_app:
                    debug_print(f"    -> EXCLUDED (other namespace): {namespace_owner}")
                    return True

        if self.selected_app and relative_parts:
            if relative_parts[0] == 'routes' and len(relative_parts) >= 2:
                top_name = relative_parts[1]
                normalized = top_name.lower()
                if normalized not in ROUTE_GLOBAL_ALLOW:
                    token_match = any(token and token in normalized for token in self.namespace_tokens)
                    if not token_match:
                        debug_print(f"    -> EXCLUDED (unrelated route segment): {top_name}")
                        return True

        # Exclude dot directories
        if is_dir and (name.startswith('.') or name in EXCLUDE_DOT_DIRS):
            debug_print(f"    -> EXCLUDED (dot directory): {name}")
            return True

        # Exclude directories by pattern
        if is_dir:
            # Check for patterns in EXCLUDE_DIRS
            try:
                relative_path = path_obj.relative_to(self.base_dir if self.base_dir else path_obj.parent)
                for exclude_dir in EXCLUDE_DIRS:
                    if exclude_dir in str(relative_path):
                        debug_print(f"    -> EXCLUDED (pattern match): {exclude_dir} in {relative_path}")
                        return True
            except ValueError:
                pass

        # Exclude by extension
        if not is_dir:
            ext = os.path.splitext(name)[1]
            if ext in EXCLUDE_EXTENSIONS:
                debug_print(f"    -> EXCLUDED (extension): {ext}")
                return True

        debug_print(f"    -> NOT EXCLUDED: {path}")
        return False

    def should_skip_subtree(self, path):
        """Check if subtree traversal should be skipped to avoid duplication"""
        if not self.selected_app or not self.selected_namespace_path:
            return False

        try:
            resolved_path = Path(path).resolve()
        except Exception:
            return False

        if self.selected_namespace_printed and resolved_path == self.selected_namespace_path:
            debug_print(f"      -> Skipping subtree for already printed namespace: {resolved_path}")
            return True

        return False

    def print_tree(self, directory, prefix="", is_last=True):
        """Recursively print directory tree"""
        debug_print(f"  print_tree() - directory: {directory}, prefix: '{prefix}', is_last: {is_last}")

        if not os.path.exists(directory):
            debug_print(f"    -> Directory does not exist: {directory}")
            return

        try:
            entries = sorted(os.listdir(directory))
            debug_print(f"    -> Found {len(entries)} entries in {directory}")
        except PermissionError:
            debug_print(f"    -> Permission denied for directory: {directory}")
            return

        # Filter out excluded items
        filtered_entries = []
        for entry in entries:
            entry_path = os.path.join(directory, entry)
            is_dir = os.path.isdir(entry_path)
            if not self.should_exclude(entry_path, is_dir):
                filtered_entries.append((entry, is_dir))
                debug_print(f"      -> INCLUDED: {entry} (is_dir: {is_dir})")
            else:
                debug_print(f"      -> EXCLUDED: {entry} (is_dir: {is_dir})")

        debug_print(f"    -> After filtering: {len(filtered_entries)} entries remain")

        for i, (entry, is_dir) in enumerate(filtered_entries):
            is_last_entry = (i == len(filtered_entries) - 1)
            entry_path = os.path.join(directory, entry)
            debug_print(f"    -> Processing entry {i+1}/{len(filtered_entries)}: {entry} (is_last: {is_last_entry})")

            # Draw tree structure
            connector = "└── " if is_last_entry else "├── "
            line = f"{prefix}{connector}{entry}"
            self.output_lines.append(line)
            debug_print(f"      -> Added line: '{line}'")

            # Recurse into directories
            if is_dir:
                extension = "    " if is_last_entry else "│   "
                debug_print(f"      -> Recursing into subdirectory: {entry_path}")
                if self.should_skip_subtree(entry_path):
                    debug_print(f"      -> Subtree skipped for: {entry_path}")
                else:
                    self.print_tree(entry_path, prefix + extension, is_last_entry)

    def generate_tree(self, paths, root_name="Root", header_info=None):
        """Generate tree for multiple paths with optional header"""
        debug_print("=== DirectoryTreePrinter.generate_tree() START ===")
        debug_print(f"  paths: {paths}")
        debug_print(f"  root_name: {root_name}")
        debug_print(f"  header_info: {'YES' if header_info else 'NO'}")

        self.output_lines = []
        self.selected_namespace_printed = False

        # Add header information if provided
        if header_info:
            debug_print(f"  Adding {len(header_info)} header lines")
            for line in header_info:
                self.output_lines.append(line)
            self.output_lines.append("")  # Empty line separator

        # Add root name
        self.output_lines.append(root_name)
        debug_print(f"  Added root name: '{root_name}'")

        debug_print(f"  Processing {len(paths)} paths:")
        for i, path in enumerate(paths):
            debug_print(f"  Path {i+1}/{len(paths)}: {path}")
            if not os.path.exists(path):
                debug_print(f"    -> Path does not exist, skipping")
                continue

            is_last = (i == len(paths) - 1)
            path_obj = Path(path)
            debug_print(f"    -> Path exists, is_last: {is_last}, is_file: {path_obj.is_file()}")

            # Calculate relative path for display
            if self.base_dir:
                try:
                    rel_path = path_obj.relative_to(self.base_dir)
                    display_name = str(rel_path).replace('\\', '/')
                    debug_print(f"    -> Relative path: {display_name}")
                except ValueError:
                    # If path is not relative to base_dir, use name
                    display_name = path_obj.name
                    debug_print(f"    -> Using absolute name: {display_name}")
            else:
                display_name = path_obj.name
                debug_print(f"    -> No base_dir, using name: {display_name}")

            if path_obj.is_file():
                connector = "└── " if is_last else "├── "
                line = f"{connector}{display_name}"
                self.output_lines.append(line)
                debug_print(f"    -> Added file line: '{line}'")
            else:
                connector = "└── " if is_last else "├── "
                line = f"{connector}{display_name}/"
                self.output_lines.append(line)
                debug_print(f"    -> Added dir line: '{line}'")
                extension = "    " if is_last else "│   "
                debug_print(f"    -> Starting tree traversal for: {path}")
                self.print_tree(path, extension, is_last)

            if (
                self.selected_namespace_path
                and Path(path).resolve() == self.selected_namespace_path
            ):
                self.selected_namespace_printed = True
                debug_print("    -> Marked namespace as printed")

        result = "\n".join(self.output_lines)
        debug_print(f"=== DirectoryTreePrinter.generate_tree() END - Total lines: {len(self.output_lines)} ===")
        return result


class LaravelAppMenu:
    """Interactive menu for Laravel app selection"""

    def __init__(self):
        self.apps = []
        self.selected_index = 0
        self.cache = CacheManager.load_cache()
        self.scan_apps()

    def scan_apps(self):
        """Scan Laravel apps directory"""
        # Try multiple possible locations for Apps directory
        possible_apps_dirs = [
            LARAVEL_DIR / "app" / "Apps",  # Prioritize this location as it's where the apps actually are
            LARAVEL_DIR / "Apps",
            LARAVEL_DIR / "app" / "apps"
        ]

        apps_dir = None
        for possible_dir in possible_apps_dirs:
            if possible_dir.exists():
                apps_dir = possible_dir
                break

        if not apps_dir:
            print_yellow("Warning: Apps directory not found in any expected location")
            print_yellow("Only 'laravel' option will be available")
            # Add only the 'laravel' option
            laravel_mode = self.cache.get('__laravel__', MODES[0])
            if laravel_mode not in MODES:
                laravel_mode = MODES[0]

            self.apps.append({
                'name': 'laravel',
                'mode': laravel_mode
            })
            return

        # Scan for apps
        for entry in sorted(apps_dir.iterdir()):
            if entry.is_dir() and not entry.name.startswith('.'):
                # Load cached mode or default to first mode
                cached_mode = self.cache.get(entry.name, MODES[0])
                if cached_mode not in MODES:
                    cached_mode = MODES[0]

                self.apps.append({
                    'name': entry.name,
                    'mode': cached_mode
                })

        # Add "laravel" option
        laravel_mode = self.cache.get('__laravel__', MODES[0])
        if laravel_mode not in MODES:
            laravel_mode = MODES[0]

        self.apps.append({
            'name': 'laravel',
            'mode': laravel_mode
        })

        # Set selected index from cache
        cached_selection = self.cache.get('__selected_index__', 0)
        if 0 <= cached_selection < len(self.apps):
            self.selected_index = cached_selection

    def display_menu(self):
        """Display the menu"""
        os.system('cls' if os.name == 'nt' else 'clear')
        print("=" * 60)
        print("Laravel App Directory Printer")
        print("=" * 60)
        print("\nUse ↑↓ to select app, ←→ to change mode, Enter to print\n")

        for i, app in enumerate(self.apps):
            marker = ">" if i == self.selected_index else " "
            mode_str = f"[{app['mode']}]"
            print(f"{marker} {app['name']:<30} {mode_str}")

        print("\nPress 'q' to quit")

    def toggle_mode(self, direction):
        """Toggle mode left or right"""
        app = self.apps[self.selected_index]
        current_mode_index = MODES.index(app['mode'])

        if direction == 'right':
            new_index = (current_mode_index + 1) % len(MODES)
        else:  # left
            new_index = (current_mode_index - 1) % len(MODES)

        app['mode'] = MODES[new_index]

    def move_selection(self, direction):
        """Move selection up or down"""
        if direction == 'up':
            self.selected_index = (self.selected_index - 1) % len(self.apps)
        else:  # down
            self.selected_index = (self.selected_index + 1) % len(self.apps)

    def save_current_state(self):
        """Save current menu state to cache"""
        cache_data = {}
        for app in self.apps:
            if app['name'] == 'laravel':
                cache_data['__laravel__'] = app['mode']
            else:
                cache_data[app['name']] = app['mode']

        cache_data['__selected_index__'] = self.selected_index
        CacheManager.save_cache(cache_data)

    def get_getch(self):
        """Get single character input (cross-platform)"""
        try:
            import msvcrt
            char = msvcrt.getch()
            if char == b'\xe0' or char == b'\x00':  # Arrow key prefix on Windows
                char = msvcrt.getch()
                arrow_keys = {
                    b'H': 'up',
                    b'P': 'down',
                    b'K': 'left',
                    b'M': 'right'
                }
                return arrow_keys.get(char, '')
            elif char == b'\r':
                return 'enter'
            elif char == b'q':
                return 'quit'
            return ''
        except ImportError:
            # Fallback for non-Windows (basic implementation)
            import termios
            import tty
            fd = sys.stdin.fileno()
            old_settings = termios.tcgetattr(fd)
            try:
                tty.setraw(sys.stdin.fileno())
                char = sys.stdin.read(1)
                if char == '\x1b':  # ESC sequence
                    char += sys.stdin.read(2)
                    arrow_keys = {
                        '\x1b[A': 'up',
                        '\x1b[B': 'down',
                        '\x1b[D': 'left',
                        '\x1b[C': 'right'
                    }
                    return arrow_keys.get(char, '')
                elif char == '\r' or char == '\n':
                    return 'enter'
                elif char == 'q':
                    return 'quit'
            finally:
                termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
            return ''

    def run(self):
        """Run interactive menu"""
        while True:
            self.display_menu()

            key = self.get_getch()

            if key == 'up':
                self.move_selection('up')
            elif key == 'down':
                self.move_selection('down')
            elif key == 'left':
                self.toggle_mode('left')
            elif key == 'right':
                self.toggle_mode('right')
            elif key == 'enter':
                self.save_current_state()
                return self.apps[self.selected_index]
            elif key == 'quit':
                self.save_current_state()
                sys.exit(0)


class LaravelPrinter:
    """Main printer class"""

    def __init__(self):
        self.printer = None  # Will be initialized per print request
        self.guide_doc = LARAVEL_DIR / "README.md"

    def generate_header(self, app_name, mode):
        """Generate header information"""
        header = [
            "=" * 80,
            "Laravel App Directory Tree",
            "=" * 80,
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"App: {app_name}",
            f"Mode: {mode}",
            f"Laravel Root: {str(LARAVEL_DIR).replace(chr(92), '/')}",
            "=" * 80
        ]
        return header

    def print_app(self, app_name, mode, use_timestamp=False):
        """Print app directory tree based on mode"""
        debug_print("=== LaravelPrinter.print_app() START ===")
        debug_print(f"  app_name: {app_name}")
        debug_print(f"  mode: {mode}")
        debug_print(f"  use_timestamp: {use_timestamp}")

        paths_to_print = []

        # Find the correct apps directory
        possible_apps_dirs = [
            LARAVEL_DIR / "app" / "Apps",  # Prioritize this location
            LARAVEL_DIR / "Apps",
            LARAVEL_DIR / "app" / "apps"
        ]

        apps_dir = None
        debug_print("Finding correct apps directory:")
        for i, possible_dir in enumerate(possible_apps_dirs):
            debug_print(f"  {i+1}. Checking: {possible_dir} - EXISTS: {possible_dir.exists()}")
            if possible_dir.exists():
                apps_dir = possible_dir
                debug_print(f"    -> SELECTED apps_dir: {apps_dir}")
                break

        if not apps_dir:
            debug_print("  -> ERROR: No apps directory found!")
            debug_print("=== LaravelPrinter.print_app() END (ERROR) ===")
            return None

        # Set up printer
        selected_app = app_name if app_name != 'laravel' else None
        debug_print(f"  Setting up printer with selected_app: {selected_app}")
        self.printer = DirectoryTreePrinter(
            base_dir=LARAVEL_DIR,
            selected_app=selected_app
        )

        if app_name == 'laravel':
            debug_print("  Setting up for entire Laravel directory")
            # Print entire Laravel directory
            root_name = f"laravel_main [{mode}]"

            if mode == 'code':
                paths_to_print = [
                    LARAVEL_DIR / "app",
                    LARAVEL_DIR / "config",
                    LARAVEL_DIR / "database",
                    LARAVEL_DIR / "routes",
                    LARAVEL_DIR / "resources",
                    LARAVEL_DIR / "composer.json"
                ]
            elif mode == 'code_routes':
                paths_to_print = [
                    LARAVEL_DIR / "app",
                    LARAVEL_DIR / "config",
                    LARAVEL_DIR / "database",
                    LARAVEL_DIR / "resources",
                    LARAVEL_DIR / "composer.json"
                ]
            elif mode == 'all':
                # Include everything except excluded directories
                paths_to_print = [LARAVEL_DIR]
                # Will use filtering in tree printer
        else:
            debug_print(f"  Setting up for specific app: {app_name}")
            # Print specific app
            root_name = f"{app_name} [{mode}]"

            if mode == 'code':
                paths_to_print = [
                    apps_dir / app_name,
                    LARAVEL_DIR / "app",
                    LARAVEL_DIR / "config",
                    LARAVEL_DIR / "database",
                    LARAVEL_DIR / "routes"
                ]
            elif mode == 'code_routes':
                paths_to_print = [
                    apps_dir / app_name,
                    LARAVEL_DIR / "app",
                    LARAVEL_DIR / "config",
                    LARAVEL_DIR / "database"
                ]
            elif mode == 'all':
                paths_to_print = [
                    apps_dir / app_name,
                    LARAVEL_DIR / "app",
                    LARAVEL_DIR / "config",
                    LARAVEL_DIR / "database",
                    LARAVEL_DIR / "routes",
                    LARAVEL_DIR / "resources",
                    LARAVEL_DIR / "composer.json"
                ]

        debug_print(f"  Root name: {root_name}")
        debug_print(f"  Paths to print ({len(paths_to_print)}):")
        for i, path in enumerate(paths_to_print):
            debug_print(f"    {i+1}. {path} - EXISTS: {path.exists()}")

        # Generate header
        header_info = self.generate_header(app_name, mode)
        debug_print(f"  Generated header with {len(header_info)} lines")

        # Generate tree
        debug_print("  Starting tree generation...")
        tree_content = self.printer.generate_tree(
            [str(p) for p in paths_to_print],
            root_name,
            header_info=header_info
        )
        debug_print(f"  Tree generated - length: {len(tree_content)} characters")

        # Generate output file path
        debug_print("  Generating output file path...")
        if use_timestamp:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            debug_print(f"  Using timestamp: {timestamp}")
            if app_name == 'laravel':
                output_file = LARAVEL_DIR / f"laravel_tree_{mode}_{timestamp}.txt"
                debug_print(f"  Output file (laravel): {output_file}")
            else:
                # Use the correct apps directory path
                output_dir = apps_dir / app_name
                debug_print(f"  Creating output directory: {output_dir}")
                output_dir.mkdir(parents=True, exist_ok=True)
                output_file = output_dir / f"{app_name}_tree_{mode}_{timestamp}.txt"
                debug_print(f"  Output file (app): {output_file}")
        else:
            debug_print("  Using fixed filename (no timestamp)")
            if app_name == 'laravel':
                output_file = LARAVEL_DIR / f"laravel_tree_{mode}.txt"
                debug_print(f"  Output file (laravel): {output_file}")
            else:
                # Use the correct apps directory path
                output_dir = apps_dir / app_name
                debug_print(f"  Creating output directory: {output_dir}")
                output_dir.mkdir(parents=True, exist_ok=True)
                output_file = output_dir / f"{app_name}_tree_{mode}.txt"
                debug_print(f"  Output file (app): {output_file}")

        # Write to file
        debug_print(f"  Writing tree content to file: {output_file}")
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(tree_content)
        debug_print("  File write completed")

        print(f"\n[OK] Tree printed to: {output_file}")
        print(f"  Total lines: {len(tree_content.splitlines())}")
        debug_print(f"=== LaravelPrinter.print_app() END - Success ===")
        return output_file


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='Laravel App Directory Tree Printer',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python laravel_app_printer.py                    # Interactive menu (fixed filename)
  python laravel_app_printer.py user              # Print user app with default mode (fixed filename)
  python laravel_app_printer.py user code         # Print user app with code mode (fixed filename)
  python laravel_app_printer.py user all --timestamp  # Print with timestamp in filename
  python laravel_app_printer.py laravel all        # Print entire laravel directory
        '''
    )

    parser.add_argument(
        'app',
        nargs='?',
        help='App name (supports fuzzy matching, e.g., "user" matches "UserApp")'
    )

    parser.add_argument(
        'mode',
        nargs='?',
        choices=MODES,
        help=f'Print mode: {", ".join(MODES)} (code: includes code files, code_routes: excludes routes, all: includes everything)'
    )

    parser.add_argument(
        '--timestamp',
        action='store_true',
        help='Use timestamp in filename (default: False, uses fixed filename)'
    )

    return parser.parse_args()


def main():
    """Main entry point"""
    debug_print("=== main() START ===")

    # Parse command line arguments
    args = parse_arguments()
    debug_print(f"  Parsed arguments: app='{args.app}', mode='{args.mode}', timestamp={args.timestamp}")

    # Resolve paths
    global ROOT_DIR, LARAVEL_DIR
    ROOT_DIR = ROOT_DIR.resolve()
    LARAVEL_DIR = LARAVEL_DIR.resolve()
    debug_print(f"  Resolved ROOT_DIR: {ROOT_DIR}")
    debug_print(f"  Resolved LARAVEL_DIR: {LARAVEL_DIR}")

    # Check if Laravel directory exists
    if not LARAVEL_DIR.exists():
        print(f"Error: Laravel directory not found: {LARAVEL_DIR}")
        debug_print("=== main() END (ERROR: Laravel directory not found) ===")
        sys.exit(1)
    debug_print(f"  Laravel directory exists: {LARAVEL_DIR}")

    # Determine app and mode
    if args.app:
        debug_print("  Command line mode selected")
        # Command line mode - skip menu
        print("Initializing Laravel App Printer (CLI mode)...")

        # Get available apps
        available_apps = scan_available_apps()
        debug_print(f"  Available apps from scan: {available_apps}")

        # Fuzzy match app name
        matched_app = fuzzy_match_app(args.app, available_apps)
        debug_print(f"  Matched app: {matched_app}")

        if not matched_app:
            print(f"Error: No app found matching '{args.app}'")
            print(f"Available apps: {', '.join(available_apps)}")
            debug_print("=== main() END (ERROR: No app found) ===")
            sys.exit(1)

        # Determine mode
        if args.mode:
            mode = args.mode
        else:
            mode = MODES[0]  # Default to first mode
            print_yellow(f"Warning: No mode specified, using default mode: '{mode}'")
        debug_print(f"  Final mode: {mode}")

        # Determine if timestamp should be used
        use_timestamp = args.timestamp or USE_TIMESTAMP_BY_DEFAULT
        debug_print(f"  use_timestamp calculation: {args.timestamp} OR {USE_TIMESTAMP_BY_DEFAULT} = {use_timestamp}")

        print(f"App: {matched_app}")
        print(f"Mode: {mode}")
        print(f"Timestamp: {'Yes' if use_timestamp else 'No (fixed filename)'}")

        # Print selected app
        debug_print("  Starting LaravelPrinter.print_app()...")
        printer = LaravelPrinter()
        result = printer.print_app(matched_app, mode, use_timestamp=use_timestamp)
        debug_print(f"  LaravelPrinter.print_app() returned: {result}")

    else:
        debug_print("  Interactive menu mode selected")
        # Interactive menu mode
        print("Initializing Laravel App Printer...")

        menu = LaravelAppMenu()
        selected_app = menu.run()
        debug_print(f"  Selected app from menu: {selected_app}")

        # Check if timestamp should be used for interactive mode
        use_timestamp = USE_TIMESTAMP_BY_DEFAULT
        debug_print(f"  use_timestamp for interactive: {use_timestamp}")

        print(f"App: {selected_app['name']}")
        print(f"Mode: {selected_app['mode']}")
        print(f"Timestamp: {'Yes' if use_timestamp else 'No (fixed filename)'}")

        # Print selected app
        debug_print("  Starting LaravelPrinter.print_app()...")
        printer = LaravelPrinter()
        result = printer.print_app(selected_app['name'], selected_app['mode'], use_timestamp=use_timestamp)
        debug_print(f"  LaravelPrinter.print_app() returned: {result}")

    debug_print("=== main() END ===")


if __name__ == "__main__":
    main()
