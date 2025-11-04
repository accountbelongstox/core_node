#!/usr/bin/env python3
"""
Special Software Environment Variables Management Menu

Provides a menu interface for setting environment variables for special software like AI tools.
This is the Python implementation replacing the PowerShell version.

Usage:
    python special_software_env_manager.py
"""

import os
import sys
import platform
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from common_utils import ColorMessage, show_menu, is_admin, clear_screen, get_key_press
from config_manager import ConfigManager
from command_content_generator_windows import WindowsCommandContentGenerator
from command_content_generator_linux import LinuxCommandContentGenerator


class SpecialSoftwareEnvManager:
    """Main manager for special software environment variables"""

    def __init__(self):
        self.config_manager = ConfigManager()
        self.windows_generator = WindowsCommandContentGenerator()
        self.linux_generator = LinuxCommandContentGenerator()

        # Action to config name mapping
        self.action_to_config = {
            'claude': 'Claude AI',
            'droid': 'Factory AI Droid',
            'openai': 'OpenAI',
            'ssh': 'SSH Connection'
        }

    def get_full_config_name(self, action: str) -> str:
        """Get full configuration name from action"""
        return self.action_to_config.get(action, action)

    def show_main_menu(self):
        """Display the main menu"""
        while True:
            menu_items = []

            # Add configuration items
            for config_name, config in self.config_manager.get_all_configs().items():
                action = config['Common']
                menu_items.append({
                    'Text': config['DisplayName'],
                    'Action': action,
                    'HasSubMenu': True
                })

            # Add utility items
            menu_items.extend([
                {'Text': 'View All Environment Variables', 'Action': 'viewall', 'HasSubMenu': False},
                {'Text': 'Refresh Current Terminal Environment', 'Action': 'refresh', 'HasSubMenu': False},
                {'Text': 'Back to Main Menu', 'Action': 'back', 'HasSubMenu': False},
                {'Text': 'Exit', 'Action': 'exit', 'HasSubMenu': False}
            ])

            action = show_menu("Special Software Environment Variables Manager", menu_items)

            # Handle actions
            if action == 'viewall':
                self.show_all_environment_variables()
            elif action == 'refresh':
                self.refresh_current_terminal_environment()
            elif action == 'back':
                continue
            elif action == 'exit':
                sys.exit(0)
            elif action in self.action_to_config:
                self.show_submenu(action)
            else:
                ColorMessage.write(f"Unknown action: {action}", 'error')
                input("Press Enter to continue...")

    def show_submenu(self, action: str):
        """Show submenu for a specific configuration"""
        config_name = self.get_full_config_name(action)
        config = self.config_manager.get_config(config_name)

        if not config:
            ColorMessage.write(f"Configuration '{config_name}' not found", 'error')
            input("Press Enter to continue...")
            return

        while True:
            display_name = config['DisplayName']
            menu_items = [
                {'Text': f"Add {display_name} Global Command", 'Action': 'addcommand', 'HasSubMenu': False},
                {'Text': f"Set {display_name} Environment Variables", 'Action': 'setenvvars', 'HasSubMenu': False},
                {'Text': f"View {display_name} Environment Variables", 'Action': 'viewenvvars', 'HasSubMenu': False},
                {'Text': f"View {display_name} Scripts", 'Action': 'viewscripts', 'HasSubMenu': False},
                {'Text': 'Restore from Configuration', 'Action': 'restore', 'HasSubMenu': False},
                {'Text': 'Back to Main Menu', 'Action': 'back', 'HasSubMenu': False}
            ]

            submenu_action = show_menu(f"{display_name} Menu", menu_items)

            if submenu_action == 'addcommand':
                self.add_global_command(config_name)
            elif submenu_action == 'setenvvars':
                self.set_environment_variables(config_name)
            elif submenu_action == 'viewenvvars':
                self.view_environment_variables(config_name)
            elif submenu_action == 'viewscripts':
                self.view_scripts(config_name)
            elif submenu_action == 'restore':
                self.restore_configuration(config_name)
            elif submenu_action == 'back':
                return

    def add_global_command(self, config_name: str):
        """Add a new global command for the specified configuration"""
        clear_screen()
        ColorMessage.write(f"Add Global Command for {config_name}", 'info')
        ColorMessage.write("This feature is currently under development", 'warning')
        ColorMessage.write("", 'info')
        ColorMessage.write("The Python implementation will generate both:", 'info')
        ColorMessage.write("1. Windows PowerShell script (.ps1) with full env var management", 'success')
        ColorMessage.write("2. Linux bash script (.sh) for command availability only", 'success')
        ColorMessage.write("", 'info')
        input("Press Enter to continue...")

    def view_scripts(self, config_name: str):
        """View existing scripts for the specified configuration"""
        clear_screen()
        ColorMessage.write(f"View Scripts for {config_name}", 'info')
        ColorMessage.write("This feature is currently under development", 'warning')
        input("Press Enter to continue...")

    def restore_configuration(self, config_name: str):
        """Restore configuration from saved file"""
        clear_screen()
        ColorMessage.write(f"Restore Configuration for {config_name}", 'info')
        ColorMessage.write("This feature is currently under development", 'warning')
        input("Press Enter to continue...")

    def set_environment_variables(self, config_name: str):
        """Set environment variables for the specified configuration"""
        config = self.config_manager.get_config(config_name)
        if not config:
            ColorMessage.write(f"Configuration '{config_name}' not found", 'error')
            input("Press Enter to continue...")
            return

        clear_screen()
        ColorMessage.write(config['Title'], 'info')
        ColorMessage.write(config['Description'], 'info')
        ColorMessage.write("=" * len(config['Title']), 'info')
        print()

        if not is_admin():
            ColorMessage.write("This operation requires administrator/root privileges.", 'error')
            ColorMessage.write("Please run this script as administrator/root.", 'warning')
            input("Press any key to continue...")
            return

        ColorMessage.write("Current environment variable status:", 'info')
        for var in config['Variables']:
            value = os.environ.get(var['Name'])
            if value:
                ColorMessage.write(f"{var['DisplayName']}: {value}", 'success')
            else:
                ColorMessage.write(f"{var['DisplayName']}: [Not set]", 'warning')

        print()
        ColorMessage.write("Enter new values for each variable.", 'info')
        ColorMessage.write("Press Enter to skip or keep current value.", 'info')
        print()

        new_values = {}
        for var in config['Variables']:
            display_name = var['DisplayName']
            description = var.get('Description', '')
            current_value = os.environ.get(var['Name'], '')

            if description:
                ColorMessage.write(f"{display_name}: {description}", 'info')

            if current_value:
                prompt = f"{display_name} (current: ***hidden***): "
            else:
                prompt = f"{display_name} (not set): "

            user_input = input(prompt).strip()

            if user_input:
                new_values[var['Name']] = user_input
                ColorMessage.write(f"Will set {display_name}", 'success')
            elif current_value:
                ColorMessage.write(f"Keeping current value for {display_name}", 'info')
            else:
                ColorMessage.write(f"Skipping {display_name}", 'warning')

        if new_values:
            print()
            ColorMessage.write("Setting environment variables...", 'info')

            if platform.system() == 'Windows':
                ColorMessage.write("On Windows, you need to use WindowsPathFunction.ps1 to set system variables", 'warning')
                ColorMessage.write("For now, setting variables in current session only", 'info')

            for var_name, var_value in new_values.items():
                os.environ[var_name] = var_value
                ColorMessage.write(f"Set {var_name} in current session", 'success')

            print()
            ColorMessage.write("Environment variables updated in current session", 'success')
            ColorMessage.write("Note: These changes are temporary. Use 'Add Global Command' to make them permanent.", 'warning')
        else:
            ColorMessage.write("No changes made", 'info')

        print()
        input("Press Enter to continue...")

    def view_environment_variables(self, config_name: str):
        """View environment variables for the specified configuration"""
        config = self.config_manager.get_config(config_name)
        if not config:
            ColorMessage.write(f"Configuration '{config_name}' not found", 'error')
            input("Press Enter to continue...")
            return

        clear_screen()
        ColorMessage.write(config['Title'], 'info')
        ColorMessage.write(config['Description'], 'info')
        ColorMessage.write("=" * len(config['Title']), 'info')
        print()

        for var in config['Variables']:
            value = os.environ.get(var['Name'])
            display_name = var['DisplayName']

            ColorMessage.write(f"{display_name}: ", 'info', no_newline=True)
            if value:
                ColorMessage.write(value, 'success')
            else:
                ColorMessage.write("[Not set]", 'warning')

        print()
        input("Press Enter to continue...")

    def show_all_environment_variables(self):
        """Show all environment variables for all configurations"""
        clear_screen()
        ColorMessage.write("All Environment Variables Status", 'info')
        ColorMessage.write("=" * 50, 'info')

        for config_name, config in self.config_manager.get_all_configs().items():
            print()
            ColorMessage.write(config['Title'], 'info')
            ColorMessage.write("-" * len(config['Title']), 'info')

            for var in config['Variables']:
                value = os.environ.get(var['Name'])
                if value:
                    ColorMessage.write(f"{var['DisplayName']}: {value}", 'success')
                else:
                    ColorMessage.write(f"{var['DisplayName']}: [Not set]", 'warning')

        print()
        input("Press Enter to continue...")

    def refresh_current_terminal_environment(self):
        """Refresh environment variables in current terminal"""
        clear_screen()
        ColorMessage.write("Refresh Current Terminal Environment", 'info')
        ColorMessage.write("=" * 50, 'info')
        ColorMessage.write("This will refresh all environment variables in the current terminal session.", 'info')
        ColorMessage.write("No system changes will be made - only current terminal will be updated.", 'info')
        print()

        if platform.system() == 'Windows':
            ColorMessage.write("On Windows, environment variables are refreshed automatically", 'success')
            ColorMessage.write("when you restart your terminal or use the Windows path function.", 'info')
        else:
            ColorMessage.write("On Linux, you may need to source your shell configuration:", 'info')
            ColorMessage.write("  source ~/.bashrc  (for bash)", 'success')
            ColorMessage.write("  source ~/.zshrc   (for zsh)", 'success')

        print()
        input("Press Enter to continue...")


def main():
    """Main entry point"""
    clear_screen()

    # Check for admin privileges
    if not is_admin():
        ColorMessage.write("This script requires administrator/root privileges.", 'error')
        ColorMessage.write("Please run as administrator/root to manage system environment variables.", 'warning')
        input("Press any key to continue...")

    # Create and run manager
    manager = SpecialSoftwareEnvManager()
    manager.show_main_menu()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print()
        ColorMessage.write("Program interrupted by user", 'warning')
        sys.exit(0)
    except Exception as e:
        ColorMessage.write(f"An error occurred: {e}", 'error')
        import traceback
        traceback.print_exc()
        input("Press Enter to exit...")
        sys.exit(1)
