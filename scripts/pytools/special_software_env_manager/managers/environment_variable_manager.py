#!/usr/bin/env python3
"""
Environment Variable Manager Module

Handles environment variable operations: setting, viewing, and saving.
"""

import os
import platform
import json
import traceback
from pathlib import Path
from typing import Dict, Any

from utils.common_utils import (
    ColorMessage, clear_screen, is_admin, get_winenvs_dir, get_linuxenvs_dir
)
from utils.secret_manager import resolve_secret_value
from managers.backup_manager import BackupManager
from config.path_config import get_path_config


class EnvironmentVariableManager:
    """Manages environment variable operations"""

    def __init__(self, backup_manager: BackupManager, project_root: Path):
        self.path_config = get_path_config(project_root)
        self.backup_manager = backup_manager
        self.project_root = project_root
        self.raw_dir = self.path_config.raw_secret_dir

    def set_environment_variables(self, config_name: str, config: Dict[str, Any]):
        """Set environment variables for the specified configuration"""
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

            try:
                backup_path = self.backup_manager.save_configuration_backup(config_name, new_values)
                ColorMessage.write(f"Configuration backup saved: {backup_path.name}", 'success')
            except Exception as e:
                ColorMessage.write(f"Warning: Failed to save backup: {e}", 'warning')
        else:
            ColorMessage.write("No changes made", 'info')

        print()
        input("Press Enter to continue...")

    def save_environment_variables_only(self, config_name: str, config: Dict[str, Any], file_number: int, user_inputs: Dict[str, str]):
        """Save environment variables to encrypted storage only (no script generation)"""
        if not self.raw_dir.exists():
            self.raw_dir.mkdir(parents=True, exist_ok=True)

        saved_count = 0
        for var_name, var_value in user_inputs.items():
            secret_key_name = f"{var_name}_{file_number}"
            secret_file = self.raw_dir / secret_key_name

            try:
                secret_file.write_text(var_value, encoding='utf-8')
                ColorMessage.write(f"[OK] Saved {var_name} to .secret_ignore", 'success')
                saved_count += 1
            except Exception as e:
                ColorMessage.write(f"[X] Error saving {var_name}: {e}", 'warning')

        if saved_count > 0:
            ColorMessage.write(f"Saved {saved_count}/{len(user_inputs)} secrets to .secret_ignore", 'success')
            ColorMessage.write(f"Location: {self.raw_dir}", 'info')

    def view_environment_variables(self, config_name: str, config: Dict[str, Any]):
        """View environment variables for the specified configuration"""
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

    def show_all_environment_variables(self, config_manager):
        """Show all environment variables for all configurations"""
        clear_screen()
        ColorMessage.write("All Environment Variables Status", 'info')
        ColorMessage.write("=" * 50, 'info')

        for config_name, config in config_manager.get_all_configs().items():
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

    def restore_configuration(self, config_name: str, config: Dict[str, Any]):
        """Restore configuration from saved file"""
        clear_screen()
        ColorMessage.write(f"Restore Configuration for {config_name}", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()

        backups = self.backup_manager.list_configuration_backups(config_name)

        if not backups:
            ColorMessage.write("No configuration backups found.", 'warning')
            ColorMessage.write(f"Backup directory: {self.backup_manager.backup_dir}", 'info')
            print()
            ColorMessage.write("Use 'Set Environment Variables' to create a configuration backup.", 'info')
            print()
            input("Press Enter to continue...")
            return

        ColorMessage.write(f"Found {len(backups)} backup(s):", 'success')
        print()

        for i, backup in enumerate(backups, 1):
            ColorMessage.write(f"{i}. {backup['name']}", 'info')
            ColorMessage.write(f"   Timestamp: {backup['timestamp']}", 'info')
            ColorMessage.write(f"   Platform: {backup['platform']}", 'info')
            print()

        ColorMessage.write("Enter backup number to restore (or 0 to cancel): ", 'info', no_newline=True)
        try:
            choice = int(input().strip())
            if choice == 0:
                ColorMessage.write("Restore cancelled.", 'info')
                print()
                input("Press Enter to continue...")
                return

            if choice < 1 or choice > len(backups):
                ColorMessage.write("Invalid selection.", 'error')
                print()
                input("Press Enter to continue...")
                return

            selected_backup = backups[choice - 1]
        except ValueError:
            ColorMessage.write("Invalid input.", 'error')
            print()
            input("Press Enter to continue...")
            return

        print()
        ColorMessage.write(f"Loading backup: {selected_backup['name']}", 'info')

        try:
            with open(selected_backup['path'], 'r', encoding='utf-8') as f:
                backup_data = json.load(f)

            env_vars = backup_data.get('environment_variables', {})

            if not env_vars:
                ColorMessage.write("No environment variables found in backup.", 'warning')
                print()
                input("Press Enter to continue...")
                return

            print()
            ColorMessage.write("Environment variables in backup:", 'info')
            for var_name, var_value in env_vars.items():
                ColorMessage.write(f"  {var_name}: ***hidden***", 'info')

            print()
            ColorMessage.write("Do you want to restore these variables? (y/N): ", 'warning', no_newline=True)
            confirm = input().strip().lower()

            if confirm != 'y':
                ColorMessage.write("Restore cancelled.", 'info')
                print()
                input("Press Enter to continue...")
                return

            print()
            ColorMessage.write("Restoring environment variables...", 'info')

            for var_name, var_value in env_vars.items():
                os.environ[var_name] = var_value
                ColorMessage.write(f"[OK] Restored {var_name}", 'success')

            print()
            ColorMessage.write("Configuration restored successfully!", 'success')
            ColorMessage.write("Note: Variables are set in current session only.", 'warning')
            ColorMessage.write("Use 'Add Global Command' to make them permanent.", 'info')

        except Exception as e:
            ColorMessage.write(f"Error restoring configuration: {e}", 'error')
            traceback.print_exc()

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

    def add_scripts_to_path(self):
        """Add winenvs/linuxenvs directories to system PATH"""
        clear_screen()
        ColorMessage.write("Add Scripts Directory to PATH", 'info')
        ColorMessage.write("=" * 80, 'info')
        print()

        if platform.system() == 'Windows':
            winenvs_dir = get_winenvs_dir()
            ColorMessage.write(f"Target directory: {winenvs_dir}", 'info')
            print()

            current_path = os.environ.get('PATH', '')
            if str(winenvs_dir) in current_path:
                ColorMessage.write("winenvs directory is already in your PATH!", 'success')
                print()
                input("Press Enter to continue...")
                return

            ColorMessage.write("This will add the winenvs directory to your USER PATH.", 'info')
            ColorMessage.write("Note: Administrator privileges are NOT required for user PATH.", 'info')
            print()

            choice = input("Do you want to proceed? (y/N): ")
            if choice.lower() != 'y':
                ColorMessage.write("Operation cancelled", 'warning')
                print()
                input("Press Enter to continue...")
                return

            print()
            ColorMessage.write("Adding to PATH...", 'info')

            try:
                ps_script = f"""
$currentUserPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
$newPath = '{winenvs_dir}'

if ($currentUserPath -notlike "*$newPath*") {{
    $updatedPath = $currentUserPath + ';' + $newPath
    [Environment]::SetEnvironmentVariable('PATH', $updatedPath, 'User')
    Write-Host '[SUCCESS] Added to PATH' -ForegroundColor Green
    Write-Host '[INFO] Please restart your terminal for changes to take effect' -ForegroundColor Yellow
}} else {{
    Write-Host '[INFO] Path already exists in PATH' -ForegroundColor Yellow
}}
"""
                import subprocess
                result = subprocess.run(
                    ['powershell', '-Command', ps_script],
                    capture_output=True,
                    text=True
                )

                if result.returncode == 0:
                    ColorMessage.write(result.stdout, 'success')
                    ColorMessage.write("\nPATH updated successfully!", 'success')
                    ColorMessage.write("Please restart your terminal for changes to take effect.", 'warning')
                else:
                    ColorMessage.write(f"Error: {result.stderr}", 'error')

            except Exception as e:
                ColorMessage.write(f"Failed to update PATH: {e}", 'error')

        else:  # Linux
            linuxenvs_dir = get_linuxenvs_dir()
            ColorMessage.write(f"Target directory: {linuxenvs_dir}", 'info')
            print()

            if not linuxenvs_dir.exists():
                ColorMessage.write(f"Scripts directory does not exist: {linuxenvs_dir}", 'error')
                print()
                input("Press Enter to continue...")
                return

            ColorMessage.write("This will create symbolic links in /usr/local/bin (requires sudo)", 'info')
            ColorMessage.write("This allows you to run scripts from anywhere without modifying PATH.", 'info')
            print()

            choice = input("Do you want to proceed? (y/N): ")
            if choice.lower() != 'y':
                ColorMessage.write("Operation cancelled", 'warning')
                print()
                input("Press Enter to continue...")
                return

            print()
            ColorMessage.write("Creating symbolic links...", 'info')
            success_count = 0
            failed_count = 0

            try:
                import subprocess
                usr_local_bin = Path('/usr/local/bin')
                if not usr_local_bin.exists():
                    ColorMessage.write("/usr/local/bin does not exist, creating it...", 'warning')
                    subprocess.run(['sudo', 'mkdir', '-p', str(usr_local_bin)], check=True)

                for script_file in linuxenvs_dir.iterdir():
                    if script_file.is_file() and script_file.suffix == '.sh':
                        link_name = script_file.stem
                        link_path = usr_local_bin / link_name

                        try:
                            ColorMessage.write(f"  {link_name} -> {script_file}", 'info')
                            subprocess.run(['sudo', 'ln', '-sf', str(script_file), str(link_path)], check=True)
                            subprocess.run(['sudo', 'chmod', '+x', str(script_file)], check=True)
                            success_count += 1
                        except Exception as e:
                            ColorMessage.write(f"  Failed: {link_name} - {e}", 'error')
                            failed_count += 1

                print()
                if success_count > 0:
                    ColorMessage.write(f"Successfully created {success_count} symbolic link(s)", 'success')
                if failed_count > 0:
                    ColorMessage.write(f"Failed to create {failed_count} symbolic link(s)", 'error')

            except Exception as e:
                ColorMessage.write(f"Failed to create symbolic links: {e}", 'error')

        print()
        input("Press Enter to continue...")


__all__ = ['EnvironmentVariableManager']

