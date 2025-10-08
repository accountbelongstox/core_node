#!/usr/bin/env python3
"""
Laravel App Directory Tree Printer
Scans Laravel apps and prints directory structure based on selected mode
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

# Directory definitions
ROOT_DIR = Path(__file__).parent / "../.."
LARAVEL_DIR = ROOT_DIR / "poly_apps" / "laravel_main"
CACHE_DIR = Path.home() / ".core_node" / ".laravel_build"
CACHE_FILE = CACHE_DIR / "laravel_menu_cache.json"

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
    # Try multiple possible locations for Apps directory
    possible_apps_dirs = [
        LARAVEL_DIR / "app" / "Apps",  # Prioritize this location as it's where the apps actually are
        LARAVEL_DIR / "Apps",
        LARAVEL_DIR / "app" / "apps"
    ]

    apps = []
    apps_dir = None
    for possible_dir in possible_apps_dirs:
        if possible_dir.exists():
            apps_dir = possible_dir
            break

    if apps_dir:
        print(f"Found Apps directory at: {apps_dir}")
        for entry in sorted(apps_dir.iterdir()):
            if entry.is_dir() and not entry.name.startswith('.'):
                apps.append(entry.name)
    else:
        print_yellow("Warning: Apps directory not found in any expected location")
        print_yellow("Only 'laravel' option will be available")

    # Always add 'laravel' option
    apps.append('laravel')

    return apps


def fuzzy_match_app(search_term, available_apps):
    """Fuzzy match app name (case-insensitive substring match)"""
    search_lower = search_term.lower()

    # Exact match first
    for app in available_apps:
        if app.lower() == search_lower:
            return app

    # Substring match
    matches = [app for app in available_apps if search_lower in app.lower()]

    if len(matches) == 1:
        return matches[0]
    elif len(matches) > 1:
        print_yellow(f"Warning: Multiple matches found for '{search_term}': {', '.join(matches)}")
        print_yellow(f"Using first match: {matches[0]}")
        return matches[0]
    else:
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
        self.output_lines = []
        self.base_dir = Path(base_dir) if base_dir else None
        self.selected_app = selected_app

    def should_exclude(self, path, is_dir=False):
        """Check if path should be excluded"""
        name = os.path.basename(path)
        path_obj = Path(path)

        # Exclude dot directories
        if is_dir and (name.startswith('.') or name in EXCLUDE_DOT_DIRS):
            return True

        # Exclude directories by pattern
        if is_dir:
            # Check for patterns in EXCLUDE_DIRS
            for exclude_dir in EXCLUDE_DIRS:
                if exclude_dir in str(path_obj.relative_to(self.base_dir if self.base_dir else path_obj.parent)):
                    return True

        # Exclude by extension
        if not is_dir:
            ext = os.path.splitext(name)[1]
            if ext in EXCLUDE_EXTENSIONS:
                return True

        return False

    def print_tree(self, directory, prefix="", is_last=True):
        """Recursively print directory tree"""
        if not os.path.exists(directory):
            return

        try:
            entries = sorted(os.listdir(directory))
        except PermissionError:
            return

        # Filter out excluded items
        filtered_entries = []
        for entry in entries:
            entry_path = os.path.join(directory, entry)
            is_dir = os.path.isdir(entry_path)
            if not self.should_exclude(entry_path, is_dir):
                filtered_entries.append((entry, is_dir))

        for i, (entry, is_dir) in enumerate(filtered_entries):
            is_last_entry = (i == len(filtered_entries) - 1)
            entry_path = os.path.join(directory, entry)

            # Draw tree structure
            connector = "└── " if is_last_entry else "├── "
            self.output_lines.append(f"{prefix}{connector}{entry}")

            # Recurse into directories
            if is_dir:
                extension = "    " if is_last_entry else "│   "
                self.print_tree(entry_path, prefix + extension, is_last_entry)

    def generate_tree(self, paths, root_name="Root", header_info=None):
        """Generate tree for multiple paths with optional header"""
        self.output_lines = []

        # Add header information if provided
        if header_info:
            for line in header_info:
                self.output_lines.append(line)
            self.output_lines.append("")  # Empty line separator

        # Add root name
        self.output_lines.append(root_name)

        for i, path in enumerate(paths):
            if not os.path.exists(path):
                continue

            is_last = (i == len(paths) - 1)
            path_obj = Path(path)

            # Calculate relative path for display
            if self.base_dir:
                try:
                    rel_path = path_obj.relative_to(self.base_dir)
                    display_name = str(rel_path).replace('\\', '/')
                except ValueError:
                    # If path is not relative to base_dir, use name
                    display_name = path_obj.name
            else:
                display_name = path_obj.name

            if path_obj.is_file():
                connector = "└── " if is_last else "├── "
                self.output_lines.append(f"{connector}{display_name}")
            else:
                connector = "└── " if is_last else "├── "
                self.output_lines.append(f"{connector}{display_name}/")
                extension = "    " if is_last else "│   "
                self.print_tree(path, extension, is_last)

        return "\n".join(self.output_lines)


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
        paths_to_print = []

        # Find the correct apps directory
        possible_apps_dirs = [
            LARAVEL_DIR / "app" / "Apps",  # Prioritize this location
            LARAVEL_DIR / "Apps",
            LARAVEL_DIR / "app" / "apps"
        ]

        apps_dir = None
        for possible_dir in possible_apps_dirs:
            if possible_dir.exists():
                apps_dir = possible_dir
                break

        # Set up printer with exclusion rules
        if app_name == 'laravel':
            exclude_apps = []
            selected_app = None
        else:
            exclude_apps = [app for app in scan_available_apps() if app != app_name and app != 'laravel']
            selected_app = app_name

        self.printer = DirectoryTreePrinter(
            base_dir=LARAVEL_DIR,
            exclude_apps=exclude_apps,
            selected_app=selected_app
        )

        if app_name == 'laravel':
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
            # Print specific app
            root_name = f"{app_name} [{mode}]"

            if mode == 'code':
                paths_to_print = []
                # Only add the specific app directory if it's not under app/
                if not (apps_dir == LARAVEL_DIR / "app" / "Apps"):
                    paths_to_print.append(apps_dir / app_name)
                # Always add core Laravel directories
                paths_to_print.extend([
                    LARAVEL_DIR / "app",
                    LARAVEL_DIR / "config",
                    LARAVEL_DIR / "database",
                    LARAVEL_DIR / "routes"
                ])
            elif mode == 'code_routes':
                paths_to_print = []
                # Only add the specific app directory if it's not under app/
                if not (apps_dir == LARAVEL_DIR / "app" / "Apps"):
                    paths_to_print.append(apps_dir / app_name)
                # Always add core Laravel directories
                paths_to_print.extend([
                    LARAVEL_DIR / "app",
                    LARAVEL_DIR / "config",
                    LARAVEL_DIR / "database"
                ])
            elif mode == 'all':
                paths_to_print = []
                # Only add the specific app directory if it's not under app/
                if not (apps_dir == LARAVEL_DIR / "app" / "Apps"):
                    paths_to_print.append(apps_dir / app_name)
                # Always add core Laravel directories
                paths_to_print.extend([
                    LARAVEL_DIR / "app",
                    LARAVEL_DIR / "config",
                    LARAVEL_DIR / "database",
                    LARAVEL_DIR / "routes",
                    LARAVEL_DIR / "resources",
                    LARAVEL_DIR / "composer.json"
                ])

        # Generate header
        header_info = self.generate_header(app_name, mode)

        # Generate tree
        tree_content = self.printer.generate_tree(
            [str(p) for p in paths_to_print],
            root_name,
            header_info=header_info
        )

        # Generate output file path
        if use_timestamp:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            if app_name == 'laravel':
                output_file = LARAVEL_DIR / f"laravel_tree_{mode}_{timestamp}.txt"
            else:
                output_dir = LARAVEL_DIR / "Apps" / app_name
                output_dir.mkdir(parents=True, exist_ok=True)
                output_file = output_dir / f"{app_name}_tree_{mode}_{timestamp}.txt"
        else:
            # Use fixed filename without timestamp
            if app_name == 'laravel':
                output_file = LARAVEL_DIR / f"laravel_tree_{mode}.txt"
            else:
                output_dir = LARAVEL_DIR / "Apps" / app_name
                output_dir.mkdir(parents=True, exist_ok=True)
                output_file = output_dir / f"{app_name}_tree_{mode}.txt"

        # Write to file
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(tree_content)

        print(f"\n[OK] Tree printed to: {output_file}")
        print(f"  Total lines: {len(tree_content.splitlines())}")

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
    # Parse command line arguments
    args = parse_arguments()

    # Resolve paths
    global ROOT_DIR, LARAVEL_DIR
    ROOT_DIR = ROOT_DIR.resolve()
    LARAVEL_DIR = LARAVEL_DIR.resolve()

    # Check if Laravel directory exists
    if not LARAVEL_DIR.exists():
        print(f"Error: Laravel directory not found: {LARAVEL_DIR}")
        sys.exit(1)

    # Determine app and mode
    if args.app:
        # Command line mode - skip menu
        print("Initializing Laravel App Printer (CLI mode)...")

        # Get available apps
        available_apps = scan_available_apps()

        # Fuzzy match app name
        matched_app = fuzzy_match_app(args.app, available_apps)

        if not matched_app:
            print(f"Error: No app found matching '{args.app}'")
            print(f"Available apps: {', '.join(available_apps)}")
            sys.exit(1)

        # Determine mode
        if args.mode:
            mode = args.mode
        else:
            mode = MODES[0]  # Default to first mode
            print_yellow(f"Warning: No mode specified, using default mode: '{mode}'")

        # Determine if timestamp should be used
        use_timestamp = args.timestamp or USE_TIMESTAMP_BY_DEFAULT

        print(f"App: {matched_app}")
        print(f"Mode: {mode}")
        print(f"Timestamp: {'Yes' if use_timestamp else 'No (fixed filename)'}")

        # Print selected app
        printer = LaravelPrinter()
        printer.print_app(matched_app, mode, use_timestamp=use_timestamp)

    else:
        # Interactive menu mode
        print("Initializing Laravel App Printer...")

        menu = LaravelAppMenu()
        selected_app = menu.run()

        # Check if timestamp should be used for interactive mode
        use_timestamp = USE_TIMESTAMP_BY_DEFAULT

        print(f"App: {selected_app['name']}")
        print(f"Mode: {selected_app['mode']}")
        print(f"Timestamp: {'Yes' if use_timestamp else 'No (fixed filename)'}")

        # Print selected app
        printer = LaravelPrinter()
        printer.print_app(selected_app['name'], selected_app['mode'], use_timestamp=use_timestamp)


if __name__ == "__main__":
    main()