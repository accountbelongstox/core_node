#!/usr/bin/env python3
"""
Nuxt App Directory Tree Printer
Scans Nuxt apps and prints directory structure based on selected mode
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

ROOT_DIR = Path(__file__).parent / "../.."
NUXT_DIR = ROOT_DIR / "poly_apps" / "nuxt_main"
APPS_DIR = NUXT_DIR / "apps"
CACHE_DIR = Path.home() / ".core_node" / ".nuxt_build"
CACHE_FILE = CACHE_DIR / "menu_cache.json"

MODES = ["code_assets", "code", "all"]

EXCLUDE_DIRS = {
    "node_modules", ".git", ".idea", ".vscode", "__pycache__",
    "dist", "out", ".nuxt", ".output", "build", ".cache"
}

EXCLUDE_EXTENSIONS = {
    ".pyd", ".pyc", ".so", ".dll", ".exe", ".bin", ".obj",
    ".class", ".jar", ".war", ".ear", ".lock"
}

COMMON_DIRS = {
    "composables", "constants", "layouts", "locales",
    "services", "stores", "styles", "theme", "types",
    "utils", "assets"
}

COLOR_YELLOW = '\033[93m'
COLOR_GREEN = '\033[92m'
COLOR_CYAN = '\033[96m'
COLOR_RED = '\033[91m'
COLOR_RESET = '\033[0m'


def print_colored(text, color):
    """Print text in specified color"""
    print(f"{color}{text}{COLOR_RESET}")


def scan_available_apps():
    """Scan and return list of available app names"""
    if not APPS_DIR.exists():
        return []

    apps = []
    for entry in sorted(APPS_DIR.iterdir()):
        if entry.is_dir() and entry.name.startswith('app_'):
            app_name = entry.name[4:]
            apps.append(app_name)

    apps.append('all')
    return apps


def should_exclude(path, exclude_dirs):
    """Check if path should be excluded"""
    for exclude in exclude_dirs:
        if exclude in path.parts:
            return True
    return False


def build_tree(directory, prefix="", mode="code_assets", app_filter=None, include_app_specific=True):
    """Build directory tree structure"""
    tree_lines = []

    try:
        entries = sorted(directory.iterdir())
    except PermissionError:
        return tree_lines

    dirs = []
    files = []

    for entry in entries:
        if entry.name.startswith('.'):
            continue
        if should_exclude(entry, EXCLUDE_DIRS):
            continue
        if entry.is_dir():
            dirs.append(entry)
        elif entry.is_file():
            if entry.suffix not in EXCLUDE_EXTENSIONS:
                files.append(entry)

    entries_to_show = dirs + files

    for i, entry in enumerate(entries_to_show):
        is_last = (i == len(entries_to_show) - 1)
        current_prefix = "└── " if is_last else "├── "
        next_prefix = "    " if is_last else "│   "

        if entry.is_dir():
            show_dir = True

            if app_filter and app_filter != 'all':
                is_app_specific = entry.name.startswith(f"app_") or entry.name.startswith(f"{app_filter}_")
                is_common = any(entry.name.startswith(part) for part in COMMON_DIRS)

                if is_app_specific and not include_app_specific:
                    if app_filter not in entry.name:
                        show_dir = False

            if show_dir:
                tree_lines.append(f"{prefix}{current_prefix}{entry.name}/")

                if mode in ["all", "code_assets"]:
                    subtree = build_tree(entry, prefix + next_prefix, mode, app_filter, include_app_specific)
                    tree_lines.extend(subtree)
        else:
            if mode == "code":
                if entry.suffix in ['.ts', '.vue', '.js', '.json']:
                    tree_lines.append(f"{prefix}{current_prefix}{entry.name}")
            elif mode == "code_assets":
                if entry.suffix in ['.ts', '.vue', '.js', '.json', '.css', '.svg', '.png', '.jpg', '.jpeg', '.gif']:
                    tree_lines.append(f"{prefix}{current_prefix}{entry.name}")
            else:
                tree_lines.append(f"{prefix}{current_prefix}{entry.name}")

    return tree_lines


def print_app_structure(app_name, mode="code_assets"):
    """Print structure for a specific app"""
    if app_name == 'all':
        print_all_apps_structure(mode)
        return

    app_path = APPS_DIR / f"app_{app_name}"

    if not app_path.exists():
        print_colored(f"Error: App '{app_name}' not found", COLOR_RED)
        return

    print_colored(f"\n{'='*60}", COLOR_CYAN)
    print_colored(f"Nuxt App: {app_name}", COLOR_CYAN)
    print_colored(f"Path: {app_path}", COLOR_CYAN)
    print_colored(f"Mode: {mode}", COLOR_CYAN)
    print_colored(f"{'='*60}\n", COLOR_CYAN)

    tree_lines = build_tree(app_path, mode=mode, app_filter=app_name)

    for line in tree_lines:
        print(line)

    print_colored(f"\n{'='*60}\n", COLOR_CYAN)


def print_all_apps_structure(mode="code_assets"):
    """Print structure for all apps"""
    print_colored(f"\n{'='*60}", COLOR_CYAN)
    print_colored(f"All Nuxt Apps Directory Structure", COLOR_CYAN)
    print_colored(f"Path: {APPS_DIR}", COLOR_CYAN)
    print_colored(f"Mode: {mode}", COLOR_CYAN)
    print_colored(f"{'='*60}\n", COLOR_CYAN)

    tree_lines = build_tree(APPS_DIR, mode=mode)

    for line in tree_lines:
        print(line)

    print_colored(f"\n{'='*60}\n", COLOR_CYAN)


class CacheManager:
    """Manages cache for menu selections"""

    @staticmethod
    def load_cache():
        """Load cached menu selections"""
        try:
            if CACHE_FILE.exists():
                with open(CACHE_FILE, 'r') as f:
                    return json.load(f)
        except Exception:
            pass
        return {"app": None, "mode": "code_assets"}

    @staticmethod
    def save_cache(data):
        """Save menu selections to cache"""
        try:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            with open(CACHE_FILE, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception:
            pass


def interactive_menu():
    """Show interactive menu for app selection"""
    apps = scan_available_apps()
    cache = CacheManager.load_cache()

    print_colored(f"\n{'='*60}", COLOR_CYAN)
    print_colored("Nuxt App Structure Viewer", COLOR_CYAN)
    print_colored(f"{'='*60}\n", COLOR_GREEN)

    print("Available apps:")
    for i, app in enumerate(apps, 1):
        marker = " (cached)" if cache["app"] == app else ""
        print_colored(f"  {i}. {app}{marker}", COLOR_YELLOW)

    print("\nSelect app (1-{}):".format(len(apps)), end=" ")

    try:
        choice = int(input())
        if 1 <= choice <= len(apps):
            selected_app = apps[choice - 1]
        else:
            print_colored("Invalid choice", COLOR_RED)
            return
    except ValueError:
        print_colored("Invalid input", COLOR_RED)
        return

    print("\nSelect mode:")
    for i, mode in enumerate(MODES, 1):
        marker = " (cached)" if cache["mode"] == mode else ""
        print_colored(f"  {i}. {mode}{marker}", COLOR_YELLOW)

    print("\nSelect mode (1-3):", end=" ")

    try:
        mode_choice = int(input())
        if 1 <= mode_choice <= len(MODES):
            selected_mode = MODES[mode_choice - 1]
        else:
            print_colored("Invalid choice", COLOR_RED)
            return
    except ValueError:
        print_colored("Invalid input", COLOR_RED)
        return

    CacheManager.save_cache({"app": selected_app, "mode": selected_mode})
    print_app_structure(selected_app, selected_mode)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Print Nuxt app directory structure"
    )
    parser.add_argument(
        "app",
        nargs="?",
        help="App name to print (or 'all' for all apps, or 'interactive')"
    )
    parser.add_argument(
        "--mode",
        choices=MODES,
        default="code_assets",
        help="Print mode (default: code_assets)"
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Start interactive menu"
    )

    args = parser.parse_args()

    if args.interactive or (args.app is None):
        interactive_menu()
    else:
        if args.app not in scan_available_apps() and args.app != 'all':
            print_colored(f"Error: App '{args.app}' not found", COLOR_RED)
            available = scan_available_apps()
            print_colored("\nAvailable apps:", COLOR_YELLOW)
            for app in available:
                print_colored(f"  - {app}", COLOR_YELLOW)
            sys.exit(1)

        print_app_structure(args.app, args.mode)


if __name__ == "__main__":
    main()
