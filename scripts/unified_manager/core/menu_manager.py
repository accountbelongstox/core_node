#!/usr/bin/env python3
"""
Menu Manager for Unified App Manager
Handles all user interaction and menu display
"""

import sys
import os
import tty
import termios
from typing import List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class MenuConfig:
    """Menu configuration"""
    enable_systemd: bool = False
    enable_nginx: bool = False
    enable_firewall: bool = False
    enable_domain_proxy: bool = False


class MenuManager:
    """Manages interactive menu display and user input"""

    # Color codes
    COLOR_HEADER = "\033[36m"
    COLOR_SUCCESS = "\033[32m"
    COLOR_WARNING = "\033[33m"
    COLOR_ERROR = "\033[31m"
    COLOR_INFO = "\033[90m"
    COLOR_HIGHLIGHT = "\033[37m"
    COLOR_RESET = "\033[0m"

    def __init__(self, apps: List, config: MenuConfig, root_dir: str):
        self.apps = apps
        self.config = config
        self.root_dir = root_dir
        self.current_index = 0
        self.old_settings = None

    def clear_screen(self):
        """Clear terminal screen"""
        print("\033[H\033[2J\033[3J", end='', flush=True)

    def log_header(self, message: str):
        """Print header message"""
        print(f"{self.COLOR_HEADER}=== {message} ==={self.COLOR_RESET}")

    def log_success(self, message: str):
        """Print success message"""
        print(f"{self.COLOR_SUCCESS}✓ {message}{self.COLOR_RESET}")

    def log_warning(self, message: str):
        """Print warning message"""
        print(f"{self.COLOR_WARNING}⚠ {message}{self.COLOR_RESET}")

    def log_error(self, message: str):
        """Print error message"""
        print(f"{self.COLOR_ERROR}✗ {message}{self.COLOR_RESET}")

    def log_info(self, message: str):
        """Print info message"""
        print(f"{self.COLOR_INFO}{message}{self.COLOR_RESET}")

    def show_menu(self) -> None:
        """Display main application menu"""
        self.clear_screen()
        self.log_header("dd.sh Unified App Manager >16 (Python Core)")
        self.log_info(f"Platform: {sys.platform} | Root: {self.root_dir}")
        print()

        if not self.apps:
            self.log_error("No applications found")
            self.log_info("Searched directories: apps/, pyapps/, poly_apps/")
            self.log_info("Make sure application directories contain valid entry points")
            print()
            self.log_warning("Press R to rescan or Q to quit")
            print()
            return

        # Calculate column widths
        max_name_width = max((len(app.name) for app in self.apps), default=8)
        name_width = max(max_name_width, 8)

        self.log_warning("Application List:")

        # Header
        print(f"No. | {'App Name':<{name_width}} | {'Type':<11} | {'Framework':<14} | Port  | Debug")
        print(f"----|{'-' * name_width}-|-------------|----------------|-------|------")

        # App list
        for i, app in enumerate(self.apps):
            indicator = ">" if i == self.current_index else " "
            color = self.COLOR_WARNING if i == self.current_index else self.COLOR_HIGHLIGHT

            debug_str = "true" if app.debug_mode else "false"

            print(f"{color}{indicator}{i+1:2d} | {app.name:<{name_width}} | "
                  f"{app.type:<11} | {app.framework:<14} | {app.port:<5} | "
                  f"{debug_str}{self.COLOR_RESET}")

        print()
        self.log_warning("Controls:")
        print("Enter app number to select | L: Launch | R: Rescan | Q: Quit")

        if self.config.enable_systemd:
            print("C: Create service | P: Create service + domain proxy")

        print()
        print(f"{self.COLOR_HEADER}Enter app number (1-{len(self.apps)}) or command: {self.COLOR_RESET}", end='', flush=True)

    def get_user_input(self) -> str:
        """Get user input from terminal"""
        try:
            # Save terminal settings
            if self.old_settings is None:
                self.old_settings = termios.tcgetattr(sys.stdin)

            # Read input
            user_input = input()
            return user_input.strip()

        except KeyboardInterrupt:
            print()
            return "Q"
        except EOFError:
            return "Q"

    def restore_terminal(self):
        """Restore terminal settings"""
        if self.old_settings:
            try:
                termios.tcsetattr(sys.stdin, termios.TCSADRAIN, self.old_settings)
            except:
                pass

    def process_input(self, user_input: str) -> Tuple[str, Optional[int]]:
        """
        Process user input and return action and app index

        Returns:
            Tuple of (action, app_index)
            Actions: 'launch', 'service', 'proxy', 'rescan', 'quit', 'select', 'invalid'
        """
        if not user_input:
            # Empty input = launch current app
            return ('launch', self.current_index)

        input_upper = user_input.upper()

        # Check for commands
        if input_upper in ['Q', 'QUIT', 'EXIT']:
            return ('quit', None)
        elif input_upper == 'L':
            return ('launch', self.current_index)
        elif input_upper == 'R':
            return ('rescan', None)
        elif input_upper == 'C' and self.config.enable_systemd:
            return ('service', self.current_index)
        elif input_upper == 'P' and self.config.enable_domain_proxy:
            return ('proxy', self.current_index)

        # Check for numeric input (app selection)
        if user_input.isdigit():
            app_num = int(user_input)
            app_index = app_num - 1

            if 0 <= app_index < len(self.apps):
                self.current_index = app_index
                return ('select', app_index)
            else:
                return ('invalid', None)

        return ('invalid', None)

    def show_error(self, message: str):
        """Show error message and wait"""
        print()
        self.log_error(message)
        print()

    def wait_for_key(self, message: str = "Press any key to continue..."):
        """Wait for user to press any key"""
        print(f"{self.COLOR_WARNING}{message}{self.COLOR_RESET}", end='', flush=True)
        try:
            # Save settings
            old = termios.tcgetattr(sys.stdin)
            try:
                # Set raw mode
                tty.setraw(sys.stdin.fileno())
                # Read one character
                sys.stdin.read(1)
            finally:
                # Restore settings
                termios.tcsetattr(sys.stdin, termios.TCSADRAIN, old)
        except:
            # Fallback to input()
            input()
        print()
