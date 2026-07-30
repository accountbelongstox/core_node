# -*- coding: utf-8 -*-
"""
Interactive Menu
Provides menu interface for configuration with arrow key navigation
"""

import sys
import os
import json

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.launcher.config_manager import ConfigManager
from pycore.pyutils.launcher.app_finder import AppFinder

try:
    import msvcrt
    HAS_MSVCRT = True
except ImportError:
    HAS_MSVCRT = False


class InteractiveMenu:
    """Interactive menu for launcher configuration with arrow key navigation"""
    
    def __init__(self, config_manager=None, app_finder=None):
        """Initialize interactive menu"""
        self.config_manager = config_manager or ConfigManager()
        self.app_finder = app_finder or AppFinder()
    
    def get_key(self):
        """
        Get keyboard input with arrow key support
        
        Returns:
            str: 'up', 'down', 'left', 'right', 'enter', 'esc', or character
        """
        if HAS_MSVCRT and os.name == 'nt':  # Windows
            while True:
                if msvcrt.kbhit():
                    key = msvcrt.getch()
                    # Handle special keys (arrows)
                    if key == b'\xe0' or key == b'\x00':
                        key = msvcrt.getch()
                        arrow_map = {
                            b'H': 'up',      # Up arrow
                            b'P': 'down',    # Down arrow
                            b'K': 'left',    # Left arrow
                            b'M': 'right'    # Right arrow
                        }
                        return arrow_map.get(key, '')
                    elif key == b'\r':  # Enter
                        return 'enter'
                    elif key == b'\x1b':  # ESC
                        return 'esc'
                    elif key == b'\x08':  # Backspace
                        return 'backspace'
                    else:
                        try:
                            return key.decode('utf-8').lower()
                        except:
                            pass
        else:
            try:
                import termios
                import tty

                fd = sys.stdin.fileno()
                old_settings = termios.tcgetattr(fd)
                try:
                    tty.setraw(sys.stdin.fileno())
                    ch = sys.stdin.read(1)
                    if ch == '\x1b':  # ESC sequence
                        ch2 = sys.stdin.read(1)
                        if ch2 == '[':
                            ch3 = sys.stdin.read(1)
                            arrow_map = {
                                'A': 'up',
                                'B': 'down',
                                'D': 'left',
                                'C': 'right'
                            }
                            return arrow_map.get(ch3, '')
                        return 'esc'
                    if ch in ('\r', '\n'):
                        return 'enter'
                    return ch.lower()
                finally:
                    termios.tcsetattr(fd, termios.TCSADRAIN, old_settings)
            except ImportError:
                return input().strip().lower()
            except Exception:
                return input().strip().lower()
        return ''
    
    def show_menu_with_selection(self, title, items, selected_index=0):
        """
        Show menu with arrow key selection
        
        Args:
            title: Menu title
            items: List of menu items (strings)
            selected_index: Initially selected index
        
        Returns:
            int: Selected index, or -1 if cancelled
        """
        while True:
            # Clear screen and show menu
            os.system('cls' if os.name == 'nt' else 'clear')
            
            ColorPrint.plain("\n" + "=" * 60)
            ColorPrint.plain(title)
            ColorPrint.plain("=" * 60)
            
            for i, item in enumerate(items):
                if i == selected_index:
                    ColorPrint.plain(f"> {item} <")  # Highlight selected item
                else:
                    ColorPrint.plain(f"  {item}")
            
            ColorPrint.plain("=" * 60)
            ColorPrint.plain("Use UP/DOWN arrows to navigate, LEFT/RIGHT to confirm, ESC to cancel")
            
            key = self.get_key()
            
            if key == 'up':
                selected_index = max(0, selected_index - 1)
            elif key == 'down':
                selected_index = min(len(items) - 1, selected_index + 1)
            elif key == 'right' or key == 'enter':
                return selected_index
            elif key == 'esc':
                return -1
    
    def show_main_menu(self):
        """Show main menu with arrow key navigation and toggle support - only APP_DEFINITIONS apps"""
        # Get all apps from APP_DEFINITIONS
        all_apps = list(self.app_finder.APP_DEFINITIONS.keys())
        
        # Build menu items dynamically from APP_DEFINITIONS
        menu_items = []
        toggle_callbacks = []
        app_order = []  # Track order: ['terminal', 'chrome', 'chrome_beta', 'antigravity', ...]
        
        # First: Terminal (special case)
        term_config = self.config_manager.get_terminal_config()
        term_toggle = term_config.get('toggle', 'X6')
        term_enabled = term_config.get('enabled', True)
        term_status = f"{term_toggle}" if term_enabled else "DISABLE"
        menu_items.append(f"Terminal: {term_status}")
        toggle_callbacks.append(self._toggle_terminal)
        app_order.append('terminal')
        
        # Then: All apps from APP_DEFINITIONS, with special handling for chrome
        for app_name in all_apps:
            if app_name == 'chrome':
                # Show CHROME (stable) separately
                chrome_config = self.config_manager.get_app_config('chrome')
                chrome_version = chrome_config.get('version', 'stable')
                
                # CHROME (stable) - show ON only if version is stable and enabled
                chrome_enabled = chrome_config.get('enabled', False) and chrome_version == 'stable'
                menu_items.append(f"CHROME: {'ON' if chrome_enabled else 'OFF'}")
                toggle_callbacks.append(self._toggle_chrome_stable)
                app_order.append('chrome_stable')
            elif app_name == 'chrome_beta':
                # Show CHROME_BETA separately (always beta version)
                chrome_beta_config = self.config_manager.get_app_config('chrome_beta')
                chrome_beta_enabled = chrome_beta_config.get('enabled', False)
                menu_items.append(f"CHROME_BETA: {'ON' if chrome_beta_enabled else 'OFF'}")
                toggle_callbacks.append(self._toggle_chrome_beta)
                app_order.append('chrome_beta')
            else:
                app_config = self.config_manager.get_app_config(app_name)
                enabled = "ON" if app_config.get('enabled', False) else "OFF"
                menu_items.append(f"{app_name.upper()}: {enabled}")
                
                # Create toggle callback for each app
                if app_name == 'antigravity':
                    toggle_callbacks.append(self._toggle_antigravity)
                else:
                    toggle_callbacks.append(lambda name=app_name: self._toggle_other_app(name))
                
                app_order.append(app_name)
        
        # Add Exit option
        menu_items.append("0. Exit and Continue")
        toggle_callbacks.append(None)
        app_order.append('exit')
        
        selected = self._show_main_menu_with_toggle(
            "Window Launcher Configuration Menu",
            all_apps,
            menu_items,
            toggle_callbacks,
            app_order,
            selected_index=0
        )
        
        if selected == -1 or selected == len(app_order) - 1:
            return '0'
        
        # Return app name for handling (if needed for future expansion)
        if selected < len(app_order):
            selected_app = app_order[selected]
            if selected_app == 'terminal':
                return 'terminal'
            elif selected_app == 'exit':
                return '0'
            # For apps, we could return the app name, but currently all are just toggles
            return '0'
        
        return '0'
    
    def _show_main_menu_with_toggle(self, title, all_apps, items, toggle_callbacks, app_order, selected_index=0):
        """Show main menu with toggle support - dynamically updates status"""
        while True:
            # Refresh menu items with current status
            menu_items = []
            
            # Terminal
            term_config = self.config_manager.get_terminal_config()
            term_toggle = term_config.get('toggle', 'X6')
            term_enabled = term_config.get('enabled', True)
            term_status = f"{term_toggle}" if term_enabled else "DISABLE"
            menu_items.append(f"Terminal: {term_status}")
            
            # All apps from APP_DEFINITIONS, with special handling for chrome
            for app_name in all_apps:
                if app_name == 'chrome':
                    # Show CHROME (stable) separately
                    chrome_config = self.config_manager.get_app_config('chrome')
                    chrome_version = chrome_config.get('version', 'stable')
                    
                    # CHROME (stable) - show ON only if version is stable and enabled
                    chrome_enabled = chrome_config.get('enabled', False) and chrome_version == 'stable'
                    menu_items.append(f"CHROME: {'ON' if chrome_enabled else 'OFF'}")
                elif app_name == 'chrome_beta':
                    # Show CHROME_BETA separately (always beta version)
                    chrome_beta_config = self.config_manager.get_app_config('chrome_beta')
                    chrome_beta_enabled = chrome_beta_config.get('enabled', False)
                    menu_items.append(f"CHROME_BETA: {'ON' if chrome_beta_enabled else 'OFF'}")
                else:
                    app_config = self.config_manager.get_app_config(app_name)
                    enabled = "ON" if app_config.get('enabled', False) else "OFF"
                    menu_items.append(f"{app_name.upper()}: {enabled}")
            
            # Exit
            menu_items.append("0. Exit and Continue")
            
            # Clear screen and show menu
            os.system('cls' if os.name == 'nt' else 'clear')
            
            ColorPrint.plain("\n" + "=" * 60)
            ColorPrint.plain(title)
            ColorPrint.plain("=" * 60)
            
            for i, item in enumerate(menu_items):
                toggle_hint = ""
                if i < len(toggle_callbacks) and toggle_callbacks[i] is not None:
                    toggle_hint = " [LEFT/RIGHT to toggle]"
                
                if i == selected_index:
                    ColorPrint.plain(f"> {item} <{toggle_hint}")
                else:
                    ColorPrint.plain(f"  {item}")
            
            ColorPrint.plain("=" * 60)
            ColorPrint.plain("UP/DOWN: Navigate | LEFT/RIGHT: Toggle | ESC: Exit")
            
            key = self.get_key()
            
            if key == 'up':
                selected_index = max(0, selected_index - 1)
            elif key == 'down':
                selected_index = min(len(menu_items) - 1, selected_index + 1)
            elif key == 'left' or key == 'right':
                # Toggle if callback exists
                if selected_index < len(toggle_callbacks) and toggle_callbacks[selected_index] is not None:
                    toggle_callbacks[selected_index]()
                    continue  # Refresh menu to show updated status
            elif key == 'enter':
                return selected_index
            elif key == 'esc':
                return len(menu_items) - 1  # Return Exit index
    
    def show_menu_with_toggle(self, title, items, toggle_callbacks, selected_index=0):
        """
        Show menu with arrow key selection and left/right toggle support
        
        Args:
            title: Menu title
            items: List of menu items (strings, will be regenerated for status updates)
            toggle_callbacks: List of callback functions (None for no toggle, function for toggle)
            selected_index: Initially selected index
        
        Returns:
            int: Selected index, or -1 if cancelled
        """
        while True:
            # Refresh menu items with current status
            term_config = self.config_manager.get_terminal_config()
            chrome_config = self.config_manager.get_app_config('chrome')
            antigravity_config = self.config_manager.get_app_config('antigravity')

            term_toggle = term_config.get('toggle', 'X6')
            term_enabled = term_config.get('enabled', True)
            term_status = f"{term_toggle}" if term_enabled else "DISABLE"
            chrome_enabled = chrome_config.get('enabled', True)
            chrome_status = "ON" if chrome_enabled else "OFF"
            antigravity_enabled = antigravity_config.get('enabled', True)
            antigravity_status = "ON" if antigravity_enabled else "OFF"

            # Update menu items with current status
            if len(items) >= 3:
                items = [
                    f"1. Terminal: {term_status}",
                    f"2. Chrome: {chrome_status}",
                    f"3. Antigravity: {antigravity_status}",
                    items[3] if len(items) > 3 else "4. Other Applications",
                    items[4] if len(items) > 4 else "5. Find Applications (Refresh Cache)",
                    items[5] if len(items) > 5 else "6. View Current Configuration",
                    items[6] if len(items) > 6 else "0. Exit and Continue"
                ]
            
            # Clear screen and show menu
            os.system('cls' if os.name == 'nt' else 'clear')
            
            ColorPrint.plain("\n" + "=" * 60)
            ColorPrint.plain(title)
            ColorPrint.plain("=" * 60)
            
            for i, item in enumerate(items):
                toggle_hint = ""
                if i < len(toggle_callbacks) and toggle_callbacks[i] is not None:
                    toggle_hint = " [LEFT/RIGHT to toggle]"
                
                if i == selected_index:
                    ColorPrint.plain(f"> {item} <{toggle_hint}")  # Highlight selected item
                else:
                    ColorPrint.plain(f"  {item}")
            
            ColorPrint.plain("=" * 60)
            ColorPrint.plain("UP/DOWN: Navigate | LEFT/RIGHT: Toggle | ENTER: Configure | ESC: Cancel")
            
            key = self.get_key()
            
            if key == 'up':
                selected_index = max(0, selected_index - 1)
            elif key == 'down':
                selected_index = min(len(items) - 1, selected_index + 1)
            elif key == 'left' or key == 'right':
                # Toggle if callback exists
                if selected_index < len(toggle_callbacks) and toggle_callbacks[selected_index] is not None:
                    toggle_callbacks[selected_index]()
                    # Config is saved inside toggle callback
                    continue  # Refresh menu to show updated status
            elif key == 'enter':
                return selected_index
            elif key == 'esc':
                return -1
    
    def _toggle_terminal(self):
        """Toggle terminal configuration (X4 -> X6 -> X8 -> X12 -> DISABLE -> X4)"""
        term_config = self.config_manager.get_terminal_config()
        current_toggle = term_config.get('toggle', 'X6')
        if current_toggle == 'X16':
            current_toggle = 'X12'
        toggle_sequence = ['X4', 'X6', 'X8', 'X12', 'DISABLE']

        try:
            current_index = toggle_sequence.index(current_toggle)
            next_index = (current_index + 1) % len(toggle_sequence)
        except ValueError:
            next_index = 1  # Default to X6

        next_toggle = toggle_sequence[next_index]
        enabled = next_toggle != 'DISABLE'

        self.config_manager.set('terminal.toggle', next_toggle)
        self.config_manager.set('terminal.enabled', enabled)

        # Update grid based on toggle
        if next_toggle == 'X4':
            self.config_manager.set('terminal.columns', 2)
            self.config_manager.set('terminal.rows', 2)
        elif next_toggle == 'X6':
            self.config_manager.set('terminal.columns', 3)
            self.config_manager.set('terminal.rows', 2)
        elif next_toggle == 'X8':
            self.config_manager.set('terminal.columns', 4)
            self.config_manager.set('terminal.rows', 2)
        elif next_toggle == 'X12':
            self.config_manager.set('terminal.columns', 4)
            self.config_manager.set('terminal.rows', 3)

        # Save immediately
        self.config_manager.save_config()
    
    def _toggle_chrome(self):
        """Toggle Chrome enabled/disabled"""
        chrome_config = self.config_manager.get_app_config('chrome')
        enabled = not chrome_config.get('enabled', True)
        self.config_manager.set('applications.chrome.enabled', enabled)
        # Save immediately
        self.config_manager.save_config()
    
    def _toggle_chrome_stable(self):
        """Toggle Chrome stable enabled/disabled"""
        chrome_config = self.config_manager.get_app_config('chrome')
        current_version = chrome_config.get('version', 'stable')
        current_enabled = chrome_config.get('enabled', False)
        
        # If currently stable version and enabled, toggle it off
        if current_version == 'stable' and current_enabled:
            enabled = False
        else:
            # Switch to stable and enable it
            enabled = True
            self.config_manager.set('applications.chrome.version', 'stable')
        
        self.config_manager.set('applications.chrome.enabled', enabled)
        # Also disable chrome_beta to avoid both being enabled
        self.config_manager.set('applications.chrome_beta.enabled', False)
        self.config_manager.save_config()
    
    def _toggle_chrome_beta(self):
        """Toggle Chrome beta enabled/disabled"""
        chrome_beta_config = self.config_manager.get_app_config('chrome_beta')
        current_enabled = chrome_beta_config.get('enabled', False)
        
        # Toggle chrome_beta enabled state
        enabled = not current_enabled
        self.config_manager.set('applications.chrome_beta.enabled', enabled)
        
        # If enabling chrome_beta, disable chrome stable to avoid conflicts
        if enabled:
            chrome_config = self.config_manager.get_app_config('chrome')
            if chrome_config.get('enabled', False) and chrome_config.get('version', 'stable') == 'stable':
                self.config_manager.set('applications.chrome.enabled', False)
        
        self.config_manager.save_config()
    
    def _toggle_antigravity(self):
        """Toggle Antigravity enabled/disabled"""
        antigravity_config = self.config_manager.get_app_config('antigravity')
        enabled = not antigravity_config.get('enabled', True)
        self.config_manager.set('applications.antigravity.enabled', enabled)
        # Save immediately
        self.config_manager.save_config()
    
    def show_terminal_menu(self):
        """Show terminal configuration menu"""
        os.system('cls' if os.name == 'nt' else 'clear')
        ColorPrint.plain("\n" + "-" * 60)
        ColorPrint.plain("Terminal Configuration")
        ColorPrint.plain("-" * 60)
        term_config = self.config_manager.get_terminal_config()
        
        ColorPrint.plain(f"Current settings:")
        ColorPrint.plain(f"  Enabled: {term_config.get('enabled', True)}")
        toggle_label = term_config.get('toggle', 'X6')
        if toggle_label == 'X16':
            toggle_label = 'X12'
        ColorPrint.plain(f"  Toggle: {toggle_label} (X4/X6/X8/X12/DISABLE)")
        ColorPrint.plain(f"  Columns: {term_config.get('columns', 3)}")
        ColorPrint.plain(f"  Rows: {term_config.get('rows', 2)}")
        ColorPrint.plain("\nOptions:")
        
        menu_items = [
            "1. Toggle Terminal (X4/X6/X8/X12/DISABLE)",
            "2. Set Grid Layout (Columns x Rows)",
            "0. Back"
        ]
        
        selected = self.show_menu_with_selection("Terminal Configuration", menu_items, 0)
        
        if selected == -1 or selected == 2:
            return
        
        if selected == 0:
            # Toggle Terminal
            toggle_items = [
                "1. X4 (4 windows)",
                "2. X6 (6 windows)",
                "3. X8 (8 windows)",
                "4. X12 (12 windows)",
                "5. DISABLE",
                "0. Back"
            ]
            
            toggle_selected = self.show_menu_with_selection("Toggle Terminal", toggle_items, 1)
            
            if toggle_selected >= 0 and toggle_selected < 5:
                toggle_map = ['X4', 'X6', 'X8', 'X12', 'DISABLE']
                toggle_value = toggle_map[toggle_selected]
                
                self.config_manager.set('terminal.toggle', toggle_value)
                self.config_manager.set('terminal.enabled', toggle_value != 'DISABLE')
                
                # Update grid based on toggle
                if toggle_value == 'X4':
                    self.config_manager.set('terminal.columns', 2)
                    self.config_manager.set('terminal.rows', 2)
                elif toggle_value == 'X6':
                    self.config_manager.set('terminal.columns', 3)
                    self.config_manager.set('terminal.rows', 2)
                elif toggle_value == 'X8':
                    self.config_manager.set('terminal.columns', 4)
                    self.config_manager.set('terminal.rows', 2)
                elif toggle_value == 'X12':
                    self.config_manager.set('terminal.columns', 4)
                    self.config_manager.set('terminal.rows', 3)
                
                self.config_manager.save_config()
                ColorPrint.plain(f"\nUpdated: Toggle set to {toggle_value}")
                input("\nPress Enter to continue...")
        
        elif selected == 1:
            # Set Grid Layout
            os.system('cls' if os.name == 'nt' else 'clear')
            try:
                cols = int(input("Enter columns: "))
                rows = int(input("Enter rows: "))
                self.config_manager.set('terminal.columns', cols)
                self.config_manager.set('terminal.rows', rows)
                self.config_manager.save_config()
                ColorPrint.plain(f"Updated: Grid set to {cols}x{rows}")
                input("\nPress Enter to continue...")
            except ValueError:
                ColorPrint.plain("Invalid input")
                input("\nPress Enter to continue...")
    
    def show_chrome_menu(self):
        """Show Chrome configuration menu"""
        os.system('cls' if os.name == 'nt' else 'clear')
        ColorPrint.plain("\n" + "-" * 60)
        ColorPrint.plain("Chrome Configuration")
        ColorPrint.plain("-" * 60)
        chrome_config = self.config_manager.get_app_config('chrome')
        
        ColorPrint.plain(f"Current settings:")
        ColorPrint.plain(f"  Enabled: {chrome_config.get('enabled', True)}")
        ColorPrint.plain(f"  Version: {chrome_config.get('version', 'stable')}")
        # Path is not shown here - it's in cache, not config
        ColorPrint.plain("\nOptions:")
        
        menu_items = [
            "1. Enable/Disable Chrome",
            "2. Select Version (canary/stable/beta)",
            "3. Find Chrome (Refresh)",
            "0. Back"
        ]
        
        selected = self.show_menu_with_selection("Chrome Configuration", menu_items, 0)
        
        if selected == -1 or selected == 3:
            return
        
        if selected == 0:
            # Enable/Disable
            enabled = not chrome_config.get('enabled', True)
            self.config_manager.set('applications.chrome.enabled', enabled)
            self.config_manager.save_config()
            ColorPrint.plain(f"\nChrome {'enabled' if enabled else 'disabled'}")
            input("\nPress Enter to continue...")
        
        elif selected == 1:
            # Select Version
            version_items = [
                "1. Canary",
                "2. Stable",
                "3. Beta",
                "0. Back"
            ]
            
            version_selected = self.show_menu_with_selection("Chrome Version", version_items, 1)
            
            if version_selected >= 0 and version_selected < 3:
                version_map = ['canary', 'stable', 'beta']
                version = version_map[version_selected]
                self.config_manager.set('applications.chrome.version', version)
                # Find and update cache (NOT config - paths belong in cache)
                chrome_path = self.app_finder.find_chrome_by_version(version)
                if chrome_path:
                    # Path is automatically saved to cache by find_chrome_by_version
                    pass
                self.config_manager.save_config()
                ColorPrint.plain(f"\nVersion set to: {version}")
                if chrome_path:
                    ColorPrint.plain(f"Found Chrome {version}: {chrome_path}")
                    ColorPrint.plain("Path saved to cache (app_cache.json)")
                input("\nPress Enter to continue...")
        
        elif selected == 2:
            # Find Chrome
            ColorPrint.plain("\nSearching for Chrome...")
            self.app_finder.find_chrome_versions(force_refresh=True)
            chrome_config = self.config_manager.get_app_config('chrome')
            version = chrome_config.get('version', 'stable')
            chrome_path = self.app_finder.find_chrome_by_version(version)
            if chrome_path:
                # Path is automatically saved to cache by find_chrome_by_version
                # Do NOT save to config - paths belong in cache only
                ColorPrint.plain(f"Found Chrome {version}: {chrome_path}")
                ColorPrint.plain("Path saved to cache (app_cache.json)")
            else:
                ColorPrint.plain("Chrome not found")
            input("\nPress Enter to continue...")
    
    def show_antigravity_menu(self):
        """Show Antigravity configuration menu"""
        os.system('cls' if os.name == 'nt' else 'clear')
        ColorPrint.plain("\n" + "-" * 60)
        ColorPrint.plain("Antigravity Configuration")
        ColorPrint.plain("-" * 60)
        antigravity_config = self.config_manager.get_app_config('antigravity')

        ColorPrint.plain(f"Current settings:")
        ColorPrint.plain(f"  Enabled: {antigravity_config.get('enabled', True)}")
        # Path is not shown here - it's in cache, not config
        ColorPrint.plain("\nOptions:")

        menu_items = [
            "1. Enable/Disable Antigravity",
            "2. Find Antigravity (Refresh)",
            "0. Back"
        ]

        selected = self.show_menu_with_selection("Antigravity Configuration", menu_items, 0)

        if selected == -1 or selected == 2:
            return

        if selected == 0:
            enabled = not antigravity_config.get('enabled', True)
            self.config_manager.set('applications.antigravity.enabled', enabled)
            self.config_manager.save_config()
            ColorPrint.plain(f"\nAntigravity {'enabled' if enabled else 'disabled'}")
            input("\nPress Enter to continue...")

        elif selected == 1:
            ColorPrint.plain("\nSearching for Antigravity...")
            antigravity_path = self.app_finder.find_app('antigravity', force_refresh=True)
            if antigravity_path:
                # Path is automatically saved to cache by find_app
                # Do NOT save to config - paths belong in cache only
                ColorPrint.plain(f"Found Antigravity: {antigravity_path}")
                ColorPrint.plain("Path saved to cache (app_cache.json)")
            else:
                ColorPrint.plain("Antigravity not found")
            input("\nPress Enter to continue...")
    
    def show_other_apps_menu(self):
        """Show other applications menu with toggle support"""
        # Get all apps except chrome and antigravity (they have their own menus)
        all_apps = list(self.app_finder.APP_DEFINITIONS.keys())
        apps = [app for app in all_apps if app not in ['chrome', 'antigravity']]
        
        if not apps:
            ColorPrint.plain("No other applications configured.")
            input("\nPress Enter to continue...")
            return
        
        # Build menu items with current status
        menu_items = []
        toggle_callbacks = []
        
        for app_name in apps:
            app_config = self.config_manager.get_app_config(app_name)
            enabled = "ON" if app_config.get('enabled', False) else "OFF"
            menu_items.append(f"{app_name.upper()}: {enabled}")
            # Create toggle callback for each app
            toggle_callbacks.append(lambda name=app_name: self._toggle_other_app(name))
        
        menu_items.append("0. Back")
        toggle_callbacks.append(None)  # Back has no toggle
        
        selected = self._show_other_apps_menu_with_toggle("Other Applications", apps, menu_items, toggle_callbacks, 0)
        
        if selected == -1 or selected == len(apps):
            return
        
        # If Enter pressed on an app, allow finding it
        if 0 <= selected < len(apps):
            app_name = apps[selected]
            # Show find option
            os.system('cls' if os.name == 'nt' else 'clear')
            ColorPrint.plain(f"\n{app_name.upper()} Options:")
            ColorPrint.plain("1. Find Application (Refresh)")
            ColorPrint.plain("0. Back")
            choice = input("\nSelect option: ").strip()
            
            if choice == '1':
                ColorPrint.plain(f"\nSearching for {app_name}...")
                app_path = self.app_finder.find_app(app_name, force_refresh=True)
                if app_path:
                    ColorPrint.plain(f"Found {app_name}: {app_path}")
                    ColorPrint.plain("Path saved to cache (app_cache.json)")
                else:
                    ColorPrint.plain(f"{app_name} not found")
                input("\nPress Enter to continue...")
    
    def _show_other_apps_menu_with_toggle(self, title, apps, items, toggle_callbacks, selected_index=0):
        """Show other apps menu with toggle support"""
        while True:
            # Refresh menu items with current status
            menu_items = []
            for app_name in apps:
                app_config = self.config_manager.get_app_config(app_name)
                enabled = "ON" if app_config.get('enabled', False) else "OFF"
                menu_items.append(f"{app_name.upper()}: {enabled}")
            menu_items.append("0. Back")
            
            # Clear screen and show menu
            os.system('cls' if os.name == 'nt' else 'clear')
            
            ColorPrint.plain("\n" + "=" * 60)
            ColorPrint.plain(title)
            ColorPrint.plain("=" * 60)
            
            for i, item in enumerate(menu_items):
                toggle_hint = ""
                if i < len(toggle_callbacks) and toggle_callbacks[i] is not None:
                    toggle_hint = " [LEFT/RIGHT to toggle]"
                
                if i == selected_index:
                    ColorPrint.plain(f"> {item} <{toggle_hint}")
                else:
                    ColorPrint.plain(f"  {item}")
            
            ColorPrint.plain("=" * 60)
            ColorPrint.plain("UP/DOWN: Navigate | LEFT/RIGHT: Toggle | ENTER: Find App | ESC: Back")
            
            key = self.get_key()
            
            if key == 'up':
                selected_index = max(0, selected_index - 1)
            elif key == 'down':
                selected_index = min(len(menu_items) - 1, selected_index + 1)
            elif key == 'left' or key == 'right':
                # Toggle if callback exists
                if selected_index < len(toggle_callbacks) and toggle_callbacks[selected_index] is not None:
                    toggle_callbacks[selected_index]()
                    continue  # Refresh menu
            elif key == 'enter':
                return selected_index
            elif key == 'esc':
                return len(apps)  # Return Back index
    
    def _toggle_other_app(self, app_name):
        """Toggle other application enabled/disabled"""
        app_config = self.config_manager.get_app_config(app_name)
        enabled = not app_config.get('enabled', False)
        self.config_manager.set(f'applications.{app_name}.enabled', enabled)
        # Save immediately
        self.config_manager.save_config()
    
    def show_config(self):
        """Show current configuration"""
        os.system('cls' if os.name == 'nt' else 'clear')
        ColorPrint.plain("\n" + "=" * 60)
        ColorPrint.plain("Current Configuration")
        ColorPrint.plain("=" * 60)
        
        config = self.config_manager.config
        ColorPrint.plain(json.dumps(config, indent=2, ensure_ascii=False))
        input("\nPress Enter to continue...")
    
    def refresh_all_apps(self):
        """Refresh all application cache (not config)"""
        os.system('cls' if os.name == 'nt' else 'clear')
        ColorPrint.plain("\nSearching for all applications...")
        results = self.app_finder.find_all_apps(force_refresh=True)
        
        # Cache is automatically saved by AppFinder.find_all_apps
        # Do NOT automatically update config - cache is separate from config
        
        ColorPrint.plain("\nFound applications (saved to cache):")
        for app_name, app_path in results.items():
            status = app_path if app_path else "Not found"
            ColorPrint.plain(f"  {app_name}: {status}")
        
        ColorPrint.plain("\nNote: Paths are saved to app_cache.json, not config.json")
        ColorPrint.plain("Use individual app menus to save paths to config if needed.")
        
        input("\nPress Enter to continue...")
    
    def run(self):
        """Run interactive menu - all toggles are done in main menu"""
        while True:
            choice = self.show_main_menu()
            
            # Exit (choice == '0' or 'exit')
            if choice == '0':
                break
            
            # All apps are toggled directly in main menu, no submenus needed
            # If user wants more detailed config (like Chrome version), they can modify config.json directly
            # or we can add Enter key support for detailed config in future
