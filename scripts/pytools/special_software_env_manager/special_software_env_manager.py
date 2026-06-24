#!/usr/bin/env python3
"""
Special Software Environment Variables Management Menu

Provides a menu interface for setting environment variables for special software like AI tools.
This is the Python implementation replacing the PowerShell version.

This is the ONLY entry point for this module.

Usage:
    python special_software_env_manager.py
"""

import os
# This is an env-variable / secret manager: it imports pyfoundations ONLY for get_secret_key.
# Importing pyfoundations runs third_party.py's import-time check_and_install_dependencies()
# (CUDA probe + heavy GUI/ML installs such as PySide6 ~629M) — pure waste for a secret reader.
# Skip it (must be set BEFORE any import that can pull pyfoundations). Mirrors the convention
# in scripts/pycore/run_callmodule_service.py and the 152 launcher helper.
os.environ.setdefault('PYCORE_SKIP_DEP_CHECK', '1')

import sys
import traceback
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

# Add pycore to path for secret_manager
_current_file = Path(__file__).resolve()
_project_root = _current_file.parent.parent.parent.parent
_pycore_path = _project_root / 'pycore'
if _pycore_path.exists():
    sys.path.insert(0, str(_pycore_path))

# Import from subdirectories
from utils.common_utils import (
    ColorMessage, clear_screen, is_admin, get_project_root
)
from config.config_manager import ConfigManager
from generators.command_content_generator_windows import WindowsCommandContentGenerator
from generators.command_content_generator_linux import LinuxCommandContentGenerator

# Import managers
from utils.secret_manager import resolve_secret_value
from managers.file_number_manager import FileNumberManager
from managers.app_scanner import AppScanner
from managers.variable_input_handler import VariableInputHandler
from managers.encrypted_constants_manager import EncryptedConstantsManager
from managers.script_manager import ScriptManager
from managers.backup_manager import BackupManager
from managers.environment_variable_manager import EnvironmentVariableManager
from managers.menu_handler import MenuHandler
from managers.command_handler import CommandHandler

# Check secret manager availability
try:
    from pyfoundations import get_secret_key, get_all_secret_keys
    SECRET_MANAGER_AVAILABLE = True
except Exception as exc:
    SECRET_MANAGER_AVAILABLE = False
    ColorMessage.write(
        f"WARNING: Secret manager not available from pycore ({exc})",
        'warning'
    )


class SpecialSoftwareEnvManager:
    """Main manager for special software environment variables"""

    def __init__(self):
        # Core components
        self.config_manager = ConfigManager()
        self.project_root = get_project_root()

        # Initialize managers
        self.file_number_manager = FileNumberManager(self.project_root)
        self.app_scanner = AppScanner(self.project_root)
        self.variable_input_handler = VariableInputHandler(
            self.app_scanner, self.project_root
        )

        # Command generators
        self.windows_generator = WindowsCommandContentGenerator()
        self.linux_generator = LinuxCommandContentGenerator()

        # Initialize managers that depend on others
        self.script_manager = ScriptManager(
            self.windows_generator, self.linux_generator
        )
        from config.path_config import get_path_config
        path_config = get_path_config(self.project_root)
        self.backup_manager = BackupManager(path_config.backup_dir)
        self.env_var_manager = EnvironmentVariableManager(
            self.backup_manager, self.project_root, self.file_number_manager
        )
        self.encrypted_constants_manager = EncryptedConstantsManager(
            self.project_root,
            self.file_number_manager,
            self.variable_input_handler
        )
        self.command_handler = CommandHandler(
            self.file_number_manager,
            self.variable_input_handler,
            self.script_manager,
            self.env_var_manager,
            self.project_root
        )
        self.menu_handler = MenuHandler(self.config_manager)

    def show_main_menu(self):
        """Display the main menu"""
        handlers = {
            'file_number_manager': self.file_number_manager,
            'variable_input_handler': self.variable_input_handler,
            'script_manager': self.script_manager,
            'env_var_manager': self.env_var_manager,
            'encrypted_constants_manager': self.encrypted_constants_manager,
            'command_handler': self.command_handler,
            'secret_manager_available': SECRET_MANAGER_AVAILABLE
        }
        self.menu_handler.show_main_menu(handlers)


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
        traceback.print_exc()
        input("Press Enter to exit...")
        sys.exit(1)
