#!/usr/bin/env python3
"""
Compilation Menu Selector
Interactive menu for selecting Flutter compilation options
Replicates the functionality of Show-CompilationMenu from PowerShell
"""

import os
import sys
from pathlib import Path
from typing import Optional, Dict, List, Any

from shared.data_exchange.unified_variable_system import unified_vars
from utils.menu_helper import MenuHelper


class CompilationMenuSelector:
    """
    Interactive compilation menu selector
    Provides the same functionality as PowerShell's Show-CompilationMenu
    """

    # Compilation options matching PowerShell definition
    COMPILATION_OPTIONS = [
        {"name": "Analyze Code - Run static analysis", "value": "analyze"},
        {"name": "Clean Build - Remove build cache and rebuild", "value": "clean"},
        {"name": "Debug Build - Development version with debugging", "value": "debug"},
        {"name": "Profile Build - Performance profiling version", "value": "profile"},
        {"name": "Release Build - Production optimized version", "value": "release"},
        {"name": "Run Tests - Execute test suite", "value": "test"}
    ]

    def __init__(self):
        """Initialize the compilation menu selector"""
        self.menu_helper = MenuHelper()
        self.selected_index = self._load_cached_selection()

    def _load_cached_selection(self) -> int:
        """Load the cached selection index from file variables"""
        try:
            last_selection = unified_vars.get_file_variable(
                unified_vars.KEY_LAST_COMPILATION_MENU_SELECTION, ""
            )
            if last_selection:
                for i, option in enumerate(self.COMPILATION_OPTIONS):
                    if option["value"] == last_selection:
                        print(f"[BUILD-MENU] Loaded cached selection: {last_selection} (index {i})")
                        return i
        except Exception as e:
            print(f"[DEBUG] Could not load cached selection: {e}")
        return 2  # Default to Debug Build (index 2)

    def _save_selection(self, option_value: str) -> None:
        """Save the selected option to file variables and update cache"""
        try:
            # Save the current selection
            unified_vars.set_file_variable(
                unified_vars.KEY_SELECTED_COMPILATION_OPTION, option_value
            )
            # Save for next time (cache)
            unified_vars.set_file_variable(
                unified_vars.KEY_LAST_COMPILATION_MENU_SELECTION, option_value
            )
            # Set build phase
            unified_vars.set_file_variable(
                unified_vars.KEY_BUILD_PHASE, "compilation"
            )
            print(f"[BUILD-MENU] Selection saved and cached: {option_value}")
        except Exception as e:
            print(f"[ERROR] Failed to save compilation selection: {e}")

    def format_option_item(self, option: Dict, index: int) -> str:
        """Format a compilation option for display"""
        return f"{index + 1}. {option['name']}"

    def format_option_details(self, option: Dict) -> str:
        """Format detailed information about the selected option"""
        value = option['value']
        details = f"Selected Option Details:\n"
        details += f"  Option: {option['name']}\n"
        details += f"  Value: {value}\n"

        # Add specific descriptions for each option
        descriptions = {
            "analyze": "  → Runs 'flutter analyze' to check for potential issues in your code\n  → Performs static analysis without building the app",
            "clean": "  → Removes all build artifacts and caches\n  → Forces a complete rebuild from scratch\n  → Useful when experiencing build issues",
            "debug": "  → Builds a debug version of your app\n  → Includes debugging information and hot reload support\n  → Recommended for development",
            "profile": "  → Builds a profile version optimized for performance testing\n  → Includes profiling tools but excludes debug assertions\n  → Use for performance analysis",
            "release": "  → Builds a production-ready optimized version\n  → Smallest size and best performance\n  → No debug information included",
            "test": "  → Runs the Flutter test suite\n  → Executes unit tests, widget tests, and integration tests\n  → Reports test coverage and results"
        }

        details += descriptions.get(value, "  → Custom compilation option")
        return details

    def show_menu(self) -> Optional[Dict[str, str]]:
        """
        Show the interactive compilation menu with caching
        Returns the selected option dict or None if cancelled
        """
        print("[BUILD-MENU] Displaying compilation options...")
        print(f"[BUILD-MENU] Starting with cached selection index: {self.selected_index}")

        def handle_enter_selection(items: List[Dict], selected_index: int) -> str:
            """Handle Enter key - confirm selection"""
            selected_option = items[selected_index]
            self._save_selection(selected_option['value'])
            print(f"\n[COMPILATION-SELECTED] Confirmed: {selected_option['name']}")
            handle_enter_selection._result = selected_option
            return 'return'

        def handle_quick_debug(items: List[Dict], selected_index: int) -> str:
            """Handle Y key - quick select debug"""
            debug_option = next((opt for opt in items if opt['value'] == 'debug'), items[2])
            self._save_selection(debug_option['value'])
            print(f"\n[COMPILATION-QUICK-SELECT] Quick selected Debug: {debug_option['name']}")
            handle_quick_debug._result = debug_option
            return 'return'

        # Configure menu using MenuHelper's standard interface
        config = {
            'title': 'Flutter Bloom Build System - Compilation Menu',
            'items': self.COMPILATION_OPTIONS,
            'instructions': 'Use UP/DOWN arrows to navigate, ENTER to select, Y for Debug, ESC to cancel',
            'legend': f'Working Directory: {Path.cwd()}\nCached selection will be restored on next run',
            'item_formatter': self.format_option_item,
            'detail_formatter': self.format_option_details,
            'selection_formatter': lambda x: f"{x['name']} ({x['value']})",
            'key_handlers': {
                'enter': handle_enter_selection,
                'y': handle_quick_debug,
                'Y': handle_quick_debug
            },
            'allow_quick_select': True,
            'select_message': '[COMPILATION-SELECTED]',
            'quick_select_message': '[COMPILATION-QUICK-SELECT] Debug',
            'cancel_message': '[BUILD-CANCELLED] Build cancelled by user',
            'cache_key': 'compilation_menu_selection'  # Enable unified caching
        }

        try:
            # Set initial selection to cached value
            self.menu_helper.selected_index = self.selected_index

            result = self.menu_helper.show_interactive_menu(config)

            # Check for special results from handlers
            for handler in [handle_enter_selection, handle_quick_debug]:
                if hasattr(handler, '_result'):
                    special_result = handler._result
                    delattr(handler, '_result')
                    return special_result

            # Handle normal result and save to cache
            if result:
                self._save_selection(result['value'])
                print(f"\n[COMPILATION-SELECTED] Selected: {result['name']}")
                return result
            else:
                # Save current menu position even if cancelled (for next time)
                if hasattr(self.menu_helper, 'selected_index') and self.menu_helper.selected_index < len(self.COMPILATION_OPTIONS):
                    current_option = self.COMPILATION_OPTIONS[self.menu_helper.selected_index]
                    unified_vars.set_file_variable(
                        unified_vars.KEY_LAST_COMPILATION_MENU_SELECTION,
                        current_option['value']
                    )
                    print(f"[BUILD-MENU] Cached current position: {current_option['value']}")
                return None

        except KeyboardInterrupt:
            print("\n[BUILD-CANCELLED] Build cancelled by user")
            return None
        except Exception as e:
            print(f"[ERROR] Menu error: {e}")
            return None

    def get_default_option(self) -> Dict[str, str]:
        """Get the default compilation option (Debug)"""
        for option in self.COMPILATION_OPTIONS:
            if option["value"] == "debug":
                return option
        return self.COMPILATION_OPTIONS[0]  # Fallback to first option

    def show_menu_with_fallback(self) -> Dict[str, str]:
        """
        Show menu with automatic fallback to default if needed
        Always returns a valid option
        """
        try:
            result = self.show_menu()
            if result:
                return result
            else:
                print("[BUILD-INFO] No option selected, using default (Debug)")
                default_option = self.get_default_option()
                self._save_selection(default_option['value'])
                return default_option
        except Exception as e:
            print(f"[ERROR] Menu failed: {e}")
            print("[BUILD-INFO] Using default option (Debug)")
            default_option = self.get_default_option()
            self._save_selection(default_option['value'])
            return default_option


def main():
    """Test the compilation menu selector"""
    print("Testing Compilation Menu Selector")
    print("=" * 50)

    selector = CompilationMenuSelector()
    result = selector.show_menu_with_fallback()

    print("\nSelected option:")
    print(f"  Name: {result['name']}")
    print(f"  Value: {result['value']}")


if __name__ == "__main__":
    main()