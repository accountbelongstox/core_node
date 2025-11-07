#!/usr/bin/env python3
"""
Flutter App Directory Tree Printer
Scans Flutter apps and prints directory structure based on selected mode
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

# For interactive menu on Windows
try:
    import msvcrt
except ImportError:
    msvcrt = None

# Directory definitions
ROOT_DIR = Path(__file__).parent / "../.."
FLUTTER_DIR = ROOT_DIR / "poly_apps" / "flutter_bloom"
CACHE_DIR = Path.home() / ".core_node" / ".flutter_build"
CACHE_FILE = CACHE_DIR / "menu_cache.json"

# Print modes
MODES = ["code_assets", "code", "all"]

# Directories to exclude
EXCLUDE_DIRS = {
    "node_modules", ".git", ".idea", ".vscode", "__pycache__",
    ".dart_tool", "build", "android", "ios", "windows", "linux", "macos",
    ".gradle", ".android", ".ios", "dist", "out"
}

# File extensions to exclude
EXCLUDE_EXTENSIONS = {
    ".pyd", ".pyc", ".so", ".dll", ".exe", ".bin", ".obj",
    ".class", ".jar", ".war", ".ear", ".lock"
}

# ANSI color codes
COLOR_YELLOW = '\033[93m'
COLOR_RESET = '\033[0m'


def print_yellow(text):
    """Print text in yellow color"""
    print(f"{COLOR_YELLOW}{text}{COLOR_RESET}")


def scan_available_apps():
    """Scan and return list of available app names"""
    apps_dir = FLUTTER_DIR / "lib" / "apps"

    if not apps_dir.exists():
        return []

    apps = []
    for entry in sorted(apps_dir.iterdir()):
        if entry.is_dir() and not entry.name.startswith('.'):
            apps.append(entry.name)

    # Add special 'flutter' option
    apps.append('flutter')

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

    def __init__(self, base_dir=None):
        self.output_lines = []
        self.base_dir = Path(base_dir) if base_dir else None

    def should_exclude(self, path, is_dir=False):
        """Check if path should be excluded"""
        name = os.path.basename(path)

        # Exclude directories
        if is_dir and name in EXCLUDE_DIRS:
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


class FlutterAppMenu:
    """Interactive menu for Flutter app selection"""

    def __init__(self):
        self.apps = []
        self.selected_index = 0
        self.cache = CacheManager.load_cache()
        self.scan_apps()

    def scan_apps(self):
        """Scan Flutter apps directory"""
        apps_dir = FLUTTER_DIR / "lib" / "apps"

        if not apps_dir.exists():
            print(f"Error: Apps directory not found: {apps_dir}")
            sys.exit(1)

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

        # Add "flutter" option
        flutter_mode = self.cache.get('__flutter__', MODES[0])
        if flutter_mode not in MODES:
            flutter_mode = MODES[0]

        self.apps.append({
            'name': 'flutter',
            'mode': flutter_mode
        })

        # Set selected index from cache
        cached_selection = self.cache.get('__selected_index__', 0)
        if 0 <= cached_selection < len(self.apps):
            self.selected_index = cached_selection

    def display_menu(self):
        """Display the menu"""
        os.system('cls' if os.name == 'nt' else 'clear')
        print("=" * 60)
        print("Flutter App Directory Printer")
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
            if app['name'] == 'flutter':
                cache_data['__flutter__'] = app['mode']
            else:
                cache_data[app['name']] = app['mode']

        cache_data['__selected_index__'] = self.selected_index
        CacheManager.save_cache(cache_data)

    def get_getch(self):
        """Get single character input (cross-platform)"""
        if msvcrt:  # Windows
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
        else:
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


class FlutterPrinter:
    """Main printer class"""

    def __init__(self):
        self.printer = DirectoryTreePrinter(base_dir=FLUTTER_DIR)
        self.guide_doc = FLUTTER_DIR / "development-guides" / "FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md"
        self.ensure_guide_header()

    def ensure_guide_header(self):
        """Ensure the guide document has the architecture prompt at the beginning"""
        if not self.guide_doc.exists():
            return
        
        # Read current content
        try:
            with open(self.guide_doc, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"Warning: Could not read guide document: {e}")
            return
        
        # Check if header already exists
        header_marker = "<!-- ### FLUTTER ARCHITECTURE PROMPT START ### -->"
        if header_marker in content:
            return  # Header already exists
        
        # Prepare the header prompt
        header_prompt = """<!-- ### FLUTTER ARCHITECTURE PROMPT START ### -->
<!-- 
⚠️ IMPORTANT: AI MUST READ THIS DOCUMENT FIRST ⚠️

This document contains the ARCHITECTURE and REFERENCE documentation for this Flutter project.

🔑 KEY ARCHITECTURE INFORMATION:
- This is a MULTI-APP (Multi-Entry) Flutter framework
- Multiple apps coexist in a single codebase with separate entry points
- Each app has its own entry file: lib/apps/app_{name}/main_app_{name}.dart
- Common code is shared in lib/common/
- Main entry (lib/main.dart) is a lightweight proxy that routes to specific apps

📋 FRAMEWORK STRUCTURE:
- Multi-entry pattern: Each app has independent entry point
- Shared common code: lib/common/ contains shared utilities, widgets, etc.
- App-specific code: lib/apps/{app_name}/ contains app-specific implementation
- Unified routing: All apps share routing, localization, and static resources

🎯 FOR AI ASSISTANTS:
- ALWAYS check this document before making architectural decisions
- Understand the multi-app structure before modifying code
- Respect the separation between common and app-specific code
- Follow the entry point patterns when creating new apps

This is a critical reference document - please review it thoroughly before proceeding.
-->
<!-- ### FLUTTER ARCHITECTURE PROMPT END ### -->

"""
        
        # Insert header at the beginning
        new_content = header_prompt + content
        
        # Write back to file
        try:
            with open(self.guide_doc, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"[OK] Architecture prompt added to guide document")
        except Exception as e:
            print(f"Warning: Could not write to guide document: {e}")

    def generate_header(self, app_name, mode):
        """Generate header information"""
        header = [
            "=" * 80,
            "Flutter App Directory Tree",
            "=" * 80,
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"App: {app_name}",
            f"Mode: {mode}",
            f"Flutter Root: {str(FLUTTER_DIR).replace(chr(92), '/')}",
            f"Development Guide: {str(self.guide_doc.relative_to(FLUTTER_DIR)).replace(chr(92), '/')}",
            "=" * 80
        ]
        return header

    def print_app(self, app_name, mode, use_timestamp=False):
        """Print app directory tree based on mode"""
        paths_to_print = []

        if app_name == 'flutter':
            # Print entire Flutter directory
            root_name = f"flutter_bloom [{mode}]"

            if mode == 'code':
                paths_to_print = [
                    FLUTTER_DIR / "lib",
                    FLUTTER_DIR / "pubspec.yaml"
                ]
            elif mode == 'code_assets':
                paths_to_print = [
                    FLUTTER_DIR / "lib",
                    FLUTTER_DIR / "assets",
                    FLUTTER_DIR / "pubspec.yaml"
                ]
            elif mode == 'all':
                # Exclude certain directories for 'all' mode
                paths_to_print = [FLUTTER_DIR]
                # Will use filtering in tree printer
        else:
            # Print specific app
            root_name = f"{app_name} [{mode}]"

            if mode == 'code':
                paths_to_print = [
                    FLUTTER_DIR / "lib" / "apps" / app_name,
                    FLUTTER_DIR / "lib" / "common"
                ]
            elif mode == 'code_assets':
                paths_to_print = [
                    FLUTTER_DIR / "lib" / "apps" / app_name,
                    FLUTTER_DIR / "lib" / "common",
                    FLUTTER_DIR / "assets" / "apps" / app_name,
                    FLUTTER_DIR / "assets" / "common"
                ]
            elif mode == 'all':
                paths_to_print = [
                    FLUTTER_DIR / "lib" / "apps" / app_name,
                    FLUTTER_DIR / "lib" / "common",
                    FLUTTER_DIR / "assets" / "apps" / app_name,
                    FLUTTER_DIR / "assets" / "common",
                    FLUTTER_DIR / "pubspec.yaml"
                ]

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
            if app_name == 'flutter':
                output_file = FLUTTER_DIR / f"flutter_tree_{mode}_{timestamp}.txt"
            else:
                output_dir = FLUTTER_DIR / "lib" / "apps" / app_name
                output_dir.mkdir(parents=True, exist_ok=True)
                output_file = output_dir / f"{app_name}_tree_{mode}_{timestamp}.txt"
        else:
            # Use fixed filename without timestamp
            if app_name == 'flutter':
                output_file = FLUTTER_DIR / f"flutter_tree_{mode}.txt"
            else:
                output_dir = FLUTTER_DIR / "lib" / "apps" / app_name
                output_dir.mkdir(parents=True, exist_ok=True)
                output_file = output_dir / f"{app_name}_tree_{mode}.txt"

        # Write to file
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(tree_content)

        # Output path in a copy-friendly format
        output_path_str = str(output_file.resolve())
        print(f"\n[OK] Tree printed to:")
        print(output_path_str)

        return output_file


def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description='Flutter App Directory Tree Printer',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python flutter_app_printer.py                    # Interactive menu (fixed filename)
  python flutter_app_printer.py achat              # Print app_achat with default mode (fixed filename)
  python flutter_app_printer.py achat code         # Print app_achat with code mode (fixed filename)
  python flutter_app_printer.py achat code --timestamp  # Print with timestamp in filename
  python flutter_app_printer.py flutter all        # Print entire flutter directory
        '''
    )

    parser.add_argument(
        'app',
        nargs='?',
        help='App name (supports fuzzy matching, e.g., "achat" matches "app_achat")'
    )

    parser.add_argument(
        'mode',
        nargs='?',
        choices=MODES,
        help=f'Print mode: {", ".join(MODES)}'
    )

    parser.add_argument(
        '--timestamp',
        action='store_true',
        help='Use timestamp in filename (default: False, uses fixed filename)'
    )

    return parser.parse_args()


# Constants
USE_TIMESTAMP_BY_DEFAULT = False  # Set to True to use timestamp by default


def main():
    """Main entry point"""
    # Parse command line arguments
    args = parse_arguments()

    # Resolve paths
    global ROOT_DIR, FLUTTER_DIR
    ROOT_DIR = ROOT_DIR.resolve()
    FLUTTER_DIR = FLUTTER_DIR.resolve()

    # Check if Flutter directory exists
    if not FLUTTER_DIR.exists():
        print(f"Error: Flutter directory not found: {FLUTTER_DIR}")
        sys.exit(1)

    # Determine app and mode
    if args.app:
        # Command line mode - skip menu
        print("Initializing Flutter App Printer (CLI mode)...")

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
        printer = FlutterPrinter()
        printer.print_app(matched_app, mode, use_timestamp=use_timestamp)

    else:
        # Interactive menu mode
        print("Initializing Flutter App Printer...")

        menu = FlutterAppMenu()
        selected_app = menu.run()

        # Check if timestamp should be used for interactive mode
        use_timestamp = USE_TIMESTAMP_BY_DEFAULT

        print(f"App: {selected_app['name']}")
        print(f"Mode: {selected_app['mode']}")
        print(f"Timestamp: {'Yes' if use_timestamp else 'No (fixed filename)'}")

        # Print selected app
        printer = FlutterPrinter()
        printer.print_app(selected_app['name'], selected_app['mode'], use_timestamp=use_timestamp)


if __name__ == "__main__":
    main()
