#!/usr/bin/env python3
"""
Nuxt App Directory Snapshot Printer
Generates tree files for Nuxt apps with copy-friendly paths.
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

try:
    import msvcrt
except ImportError:
    msvcrt = None


ROOT_DIR = (Path(__file__).parent / "../..").resolve()
NUXT_DIR = (ROOT_DIR / "poly_apps" / "nuxt_main").resolve()
APPS_DIR = NUXT_DIR / "apps"
USERNAME = os.environ.get('USERNAME', os.environ.get('USER', 'default'))
CACHE_DIR = Path('D:/programing/Users') / USERNAME / '.core_node' / '.nuxt_build'
CACHE_FILE = CACHE_DIR / "menu_cache.json"

MODES = ["code_assets", "code", "all"]

EXCLUDE_DIRS = {
    "node_modules", ".git", ".idea", ".vscode", "__pycache__",
    ".nuxt", ".output", "dist", "out", "build", ".cache"
}

EXCLUDE_EXTENSIONS = {
    ".pyd", ".pyc", ".so", ".dll", ".exe", ".bin", ".obj",
    ".class", ".jar", ".war", ".ear", ".lock"
}

GENERAL_CODE_DIRS = [
    "apps", "common", "components", "composables", "configs",
    "constants", "i18n", "layouts", "middleware", "plugins",
    "services", "stores", "theme", "types", "utils"
]

GENERAL_ASSET_DIRS = ["assets", "public", "docs"]

IMPORTANT_FILES = [
    "nuxt.config.ts", "app-entry.ts", "app-setting.ts",
    "package.json", "tsconfig.json"
]

NUXT_PROMPT_LINES = [
    "<!-- ### NUXT MULTI-APP PROMPT START ### -->",
    "<!--",
    "⚠️ IMPORTANT: This Nuxt workspace uses a multi-app namespace architecture.",
    "- Each namespace lives under apps/app_{name} with its own layouts, routes, and configs.",
    "- Shared utilities live in common/, components/, services/, stores/, and theme/.",
    "- Read development-guides/NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md before editing.",
    "- Keep AI responses aligned with namespace isolation rules and routing prefixes.",
    "- Always prefer reusing/expanding common/ libraries & components before touching app-specific code.",
    "- When common/ must be extended, keep the design generic enough for every namespace.",
    "-->",
    "<!-- ### NUXT MULTI-APP PROMPT END ### -->"
]

LIMITED_DISPLAY_RULES = {
    "public/assets/images/flags": {
        "limit": 2,
        "message": "... some more flag assets hidden ..."
    },
    "apps": {
        "limit": 5,
        "message": "... some more app_* namespaces hidden ..."
    }
}

COLOR_YELLOW = '\033[93m'
COLOR_RESET = '\033[0m'


def print_yellow(text):
    """Print text in yellow color"""
    print(f"{COLOR_YELLOW}{text}{COLOR_RESET}")


def normalize_path(path) -> str:
    """Return a path string with forward slashes"""
    return str(path).replace('\\', '/')


def scan_available_apps():
    """Scan and return list of available app names"""
    apps = []

    if APPS_DIR.exists():
        for entry in sorted(APPS_DIR.iterdir()):
            if entry.is_dir() and not entry.name.startswith('.'):
                name = entry.name
                if name.startswith('app_'):
                    name = name[4:]
                apps.append(name)

    # Add special option for the entire workspace
    apps.append('nuxt')
    return apps


def fuzzy_match_app(search_term, available_apps):
    """Fuzzy match app name (case-insensitive substring match)"""
    search_lower = search_term.lower()

    for app in available_apps:
        if app.lower() == search_lower:
            return app

    matches = [app for app in available_apps if search_lower in app.lower()]

    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        print_yellow(
            f"Warning: Multiple matches found for '{search_term}': {', '.join(matches)}"  # noqa: E501
        )
        print_yellow(f"Using first match: {matches[0]}")
        return matches[0]
    return None


class CacheManager:
    """Manages cache for menu selections"""

    @staticmethod
    def load_cache():
        try:
            if CACHE_FILE.exists():
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception:
            pass
        return {}

    @staticmethod
    def save_cache(cache_data):
        try:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(cache_data, f, indent=2)
        except Exception:
            pass


class DirectoryTreePrinter:
    """Prints directory tree structure"""

    def __init__(self, base_dir=None, limit_rules=None):
        self.output_lines = []
        self.base_dir = Path(base_dir) if base_dir else None
        self.limit_rules = limit_rules or {}

    def _get_limit_rule(self, directory):
        if not self.limit_rules or not self.base_dir:
            return None

        try:
            rel_path = Path(directory).resolve().relative_to(self.base_dir.resolve())
        except Exception:
            return None

        key = normalize_path(rel_path)
        return self.limit_rules.get(key)

    def should_exclude(self, path, is_dir=False):
        name = os.path.basename(path)

        if is_dir and name in EXCLUDE_DIRS:
            return True

        if not is_dir:
            ext = os.path.splitext(name)[1]
            if ext in EXCLUDE_EXTENSIONS:
                return True

        return False

    def print_tree(self, directory, prefix="", is_last=True):
        if not os.path.exists(directory):
            return

        try:
            entries = sorted(os.listdir(directory))
        except PermissionError:
            return

        filtered_entries = []
        for entry in entries:
            entry_path = os.path.join(directory, entry)
            is_dir = os.path.isdir(entry_path)
            if not self.should_exclude(entry_path, is_dir):
                filtered_entries.append({
                    'name': entry,
                    'is_dir': is_dir,
                    'path': entry_path,
                    'placeholder': False
                })

        rule = self._get_limit_rule(directory)
        if rule:
            limit = max(1, rule.get('limit', len(filtered_entries)))
        else:
            limit = None

        if limit and len(filtered_entries) > limit:
            truncated = len(filtered_entries) - limit
            filtered_entries = filtered_entries[:limit]
            message = rule.get('message', '... some more entries hidden ...')
            message = message.replace('{count}', str(truncated))
            filtered_entries.append({
                'name': message,
                'is_dir': False,
                'path': None,
                'placeholder': True
            })

        for i, entry in enumerate(filtered_entries):
            is_last_entry = i == len(filtered_entries) - 1
            connector = "└── " if is_last_entry else "├── "
            self.output_lines.append(f"{prefix}{connector}{entry['name']}")

            if entry['is_dir'] and not entry['placeholder']:
                extension = "    " if is_last_entry else "│   "
                self.print_tree(entry['path'], prefix + extension, is_last_entry)

    def generate_tree(self, paths, root_name="Root", header_info=None):
        self.output_lines = []

        if header_info:
            for line in header_info:
                self.output_lines.append(line)
            self.output_lines.append("")

        self.output_lines.append(root_name)

        for i, path in enumerate(paths):
            if not os.path.exists(path):
                continue

            is_last = i == len(paths) - 1
            path_obj = Path(path)

            if self.base_dir:
                try:
                    rel_path = path_obj.relative_to(self.base_dir)
                    display_name = str(rel_path).replace('\\', '/')
                except ValueError:
                    display_name = path_obj.name
            else:
                display_name = path_obj.name

            connector = "└── " if is_last else "├── "
            if path_obj.is_file():
                self.output_lines.append(f"{connector}{display_name}")
            else:
                self.output_lines.append(f"{connector}{display_name}/")
                extension = "    " if is_last else "│   "
                self.print_tree(str(path_obj), extension, is_last)

        return "\n".join(self.output_lines)


class NuxtAppMenu:
    """Interactive menu for Nuxt app selection"""

    def __init__(self):
        self.apps = []
        self.selected_index = 0
        self.cache = CacheManager.load_cache()
        self.scan_apps()

    def scan_apps(self):
        available_apps = scan_available_apps()

        for app in available_apps:
            cached_mode = self.cache.get(app, MODES[0])
            if cached_mode not in MODES:
                cached_mode = MODES[0]
            self.apps.append({'name': app, 'mode': cached_mode})

        cached_selection = self.cache.get('__selected_index__', 0)
        if 0 <= cached_selection < len(self.apps):
            self.selected_index = cached_selection

    def display_menu(self):
        os.system('cls' if os.name == 'nt' else 'clear')
        print("=" * 60)
        print("Nuxt App Directory Printer")
        print("=" * 60)
        print("\nUse ↓/↑ to select app, ←/→ to toggle mode, Enter to print\n")

        for i, app in enumerate(self.apps):
            marker = '>' if i == self.selected_index else ' '
            mode_str = f"[{app['mode']}]"
            print(f"{marker} {app['name']:<30} {mode_str}")

        print("\nPress 'q' to quit")

    def toggle_mode(self, direction):
        app = self.apps[self.selected_index]
        current_index = MODES.index(app['mode'])

        if direction == 'right':
            new_index = (current_index + 1) % len(MODES)
        else:
            new_index = (current_index - 1) % len(MODES)

        app['mode'] = MODES[new_index]

    def move_selection(self, direction):
        if direction == 'up':
            self.selected_index = (self.selected_index - 1) % len(self.apps)
        else:
            self.selected_index = (self.selected_index + 1) % len(self.apps)

    def save_current_state(self):
        cache_data = {}
        for app in self.apps:
            cache_data[app['name']] = app['mode']
        cache_data['__selected_index__'] = self.selected_index
        CacheManager.save_cache(cache_data)

    def get_getch(self):
        if msvcrt:
            char = msvcrt.getch()
            if char in (b'\xe0', b'\x00'):
                char = msvcrt.getch()
                arrow_keys = {b'H': 'up', b'P': 'down', b'K': 'left', b'M': 'right'}
                return arrow_keys.get(char, '')
            if char == b'\r':
                return 'enter'
            if char == b'q':
                return 'quit'
            return ''
        else:
            import termios
            import tty
            fd = sys.stdin.fileno()
            old_settings = termios.tcgetattr(fd)
            try:
                tty.setraw(fd)
                char = sys.stdin.read(1)
                if char == '\x1b':
                    char += sys.stdin.read(2)
                    arrow_keys = {
                        '\x1b[A': 'up',
                        '\x1b[B': 'down',
                        '\x1b[D': 'left',
                        '\x1b[C': 'right'
                    }
                    return arrow_keys.get(char, '')
                if char in ('\r', '\n'):
                    return 'enter'
                if char == 'q':
                    return 'quit'
            finally:
                termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
            return ''

    def run(self):
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


class NuxtPrinter:
    """Generates directory tree files for Nuxt apps"""

    def __init__(self):
        self.printer = DirectoryTreePrinter(base_dir=NUXT_DIR, limit_rules=LIMITED_DISPLAY_RULES)
        self.guide_doc = NUXT_DIR / "development-guides" / "NUXT_MULTI_APP_NAMESPACE_ARCHITECTURE.md"

    def generate_header(self, app_name, mode):
        header = list(NUXT_PROMPT_LINES)
        header.append("")
        guide_rel = normalize_path(self.guide_doc.relative_to(NUXT_DIR)) if self.guide_doc.exists() else "(missing)"
        header.extend([
            "=" * 80,
            "Nuxt App Directory Snapshot",
            "=" * 80,
            f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"App: {app_name}",
            f"Mode: {mode}",
            f"Nuxt Root: {normalize_path(NUXT_DIR)}",
            f"Architecture Guide: {guide_rel}",
            "=" * 80
        ])
        return header

    def resolve_app_directory(self, app_name):
        if app_name == 'nuxt':
            return NUXT_DIR

        candidate_names = [app_name]
        if not app_name.startswith('app_'):
            candidate_names.insert(0, f"app_{app_name}")

        for candidate in candidate_names:
            candidate_path = APPS_DIR / candidate
            if candidate_path.exists():
                return candidate_path

        raise FileNotFoundError(f"App directory not found for '{app_name}'")

    def get_paths_for_workspace(self, mode):
        if mode == 'all':
            return [NUXT_DIR]

        paths = [NUXT_DIR / d for d in GENERAL_CODE_DIRS]
        paths.extend(NUXT_DIR / f for f in IMPORTANT_FILES)

        if mode == 'code_assets':
            paths.extend(NUXT_DIR / d for d in GENERAL_ASSET_DIRS)

        return paths

    def get_paths_for_app(self, app_name, mode):
        app_dir = self.resolve_app_directory(app_name)

        if mode == 'all':
            return [app_dir]

        shared_dirs = [
            app_dir,
            NUXT_DIR / "common",
            NUXT_DIR / "components",
            NUXT_DIR / "composables",
            NUXT_DIR / "configs",
            NUXT_DIR / "constants",
            NUXT_DIR / "services",
            NUXT_DIR / "stores",
            NUXT_DIR / "theme",
            NUXT_DIR / "types",
            NUXT_DIR / "utils",
            NUXT_DIR / "layouts",
            NUXT_DIR / "plugins",
            NUXT_DIR / "middleware",
            NUXT_DIR / "i18n"
        ]

        shared_dirs.extend(
            NUXT_DIR / f
            for f in (
                "app-entry.ts",
                "app-setting.ts",
                "nuxt.config.ts",
                "package.json",
                "tsconfig.json"
            )
        )

        if mode == 'code_assets':
            shared_dirs.extend([NUXT_DIR / "assets", NUXT_DIR / "public", NUXT_DIR / "docs"])

        return shared_dirs

    def print_app(self, app_name, mode, use_timestamp=False):
        if app_name == 'nuxt':
            root_name = f"nuxt_main [{mode}]"
            paths_to_print = self.get_paths_for_workspace(mode)
        else:
            root_name = f"{app_name} [{mode}]"
            paths_to_print = self.get_paths_for_app(app_name, mode)

        header_info = self.generate_header(app_name, mode)
        tree_content = self.printer.generate_tree(
            [str(p) for p in paths_to_print],
            root_name,
            header_info=header_info
        )

        if use_timestamp:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            suffix = f"_{timestamp}"
        else:
            suffix = ""

        if app_name == 'nuxt':
            output_file = NUXT_DIR / f"nuxt_tree_{mode}{suffix}.txt"
        else:
            app_dir = self.resolve_app_directory(app_name)
            app_dir.mkdir(parents=True, exist_ok=True)
            safe_name = app_name if app_name.startswith('app_') else f"app_{app_name}"
            output_file = app_dir / f"{safe_name}_tree_{mode}{suffix}.txt"

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(tree_content)

        abs_path = normalize_path(output_file.resolve())
        try:
            rel_path = normalize_path(output_file.resolve().relative_to(ROOT_DIR))
        except ValueError:
            rel_path = abs_path

        print("\n[OK] Directory snapshot saved.")
        print("Windows clients copy the absolute path; Linux clients copy the relative path below:")
        print(abs_path)
        print(rel_path)

        return output_file


def parse_arguments():
    parser = argparse.ArgumentParser(
        description='Nuxt App Directory Snapshot Printer',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''\
Examples:
  python nuxt_app_printer.py                  # Interactive menu (fixed filename)
  python nuxt_app_printer.py nuxt all         # Print entire Nuxt workspace
  python nuxt_app_printer.py admin code       # Print app_admin code snapshot
  python nuxt_app_printer.py admin code --timestamp   # Append timestamp to filename
        '''
    )

    parser.add_argument(
        'app',
        nargs='?',
        help='App name (supports fuzzy matching, e.g., "admin" matches app_admin)'
    )

    parser.add_argument(
        'mode',
        nargs='?',
        choices=MODES,
        help=f"Print mode: {', '.join(MODES)}"
    )

    parser.add_argument(
        '--timestamp',
        action='store_true',
        help='Use timestamp in filename (default: fixed filename)'
    )

    return parser.parse_args()


USE_TIMESTAMP_BY_DEFAULT = False


def main():
    args = parse_arguments()

    if not NUXT_DIR.exists():
        print(f"Error: Nuxt directory not found: {NUXT_DIR}")
        sys.exit(1)

    if args.app:
        print("Initializing Nuxt App Printer (CLI mode)...")
        available_apps = scan_available_apps()
        matched_app = fuzzy_match_app(args.app, available_apps)

        if not matched_app:
            print(f"Error: No app found matching '{args.app}'")
            print(f"Available apps: {', '.join(available_apps)}")
            sys.exit(1)

        mode = args.mode or MODES[0]
        if not args.mode:
            print_yellow(f"Warning: No mode specified, using default mode: '{mode}'")

        use_timestamp = args.timestamp or USE_TIMESTAMP_BY_DEFAULT

        print(f"App: {matched_app}")
        print(f"Mode: {mode}")
        print(f"Timestamp: {'Yes' if use_timestamp else 'No (fixed filename)'}")

        printer = NuxtPrinter()
        printer.print_app(matched_app, mode, use_timestamp=use_timestamp)

    else:
        print("Initializing Nuxt App Printer...")
        menu = NuxtAppMenu()
        selected_app = menu.run()
        use_timestamp = USE_TIMESTAMP_BY_DEFAULT

        print(f"App: {selected_app['name']}")
        print(f"Mode: {selected_app['mode']}")
        print(f"Timestamp: {'Yes' if use_timestamp else 'No (fixed filename)'}")

        printer = NuxtPrinter()
        printer.print_app(selected_app['name'], selected_app['mode'], use_timestamp=use_timestamp)


if __name__ == "__main__":
    main()
