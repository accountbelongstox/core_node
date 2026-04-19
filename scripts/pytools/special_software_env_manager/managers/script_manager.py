#!/usr/bin/env python3
"""
Script Manager Module

Handles script generation, viewing, and restoration.
"""

import os
import platform
import stat
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Set
from datetime import datetime

from utils.common_utils import (
    ColorMessage, clear_screen, is_admin, get_winenvs_dir, get_linuxenvs_dir, ensure_directory_exists
)
from generators.command_content_generator_windows import WindowsCommandContentGenerator
from generators.command_content_generator_linux import LinuxCommandContentGenerator
from utils.secret_manager import LOCAL_SECRET_MANAGER


class ScriptManager:
    """Manages script generation, viewing, and restoration"""

    def __init__(self, windows_generator: WindowsCommandContentGenerator, linux_generator: LinuxCommandContentGenerator):
        self.windows_generator = windows_generator
        self.linux_generator = linux_generator

    def generate_scripts_for_config(
        self,
        config_name: str,
        config: Dict[str, Any],
        file_number: int,
        show_next_steps: bool = True,
        secret_manager_available: bool = False
    ) -> List[Path]:
        """Generate Windows/Linux scripts for a configuration"""
        command_prefix = config.get('CommandPrefix', '')

        if not command_prefix:
            if show_next_steps:
                ColorMessage.write("Configuration does not require script generation.", 'info')
                ColorMessage.write("Environment variables have been saved to encrypted storage.", 'success')
            return []

        file_name = f"{command_prefix}{file_number}"

        ColorMessage.write("Generating scripts...", 'info')
        print()

        script_paths = []
        success_count = 0

        is_ssh = (config_name == 'SSH Connection')
        mcp_support = config.get('MCPSupport', {})
        mcp_enabled = mcp_support.get('Enabled', False) and not is_ssh

        user_inputs = {}

        # Generate Windows script
        ps_command = config.get('WindowsCommand', command_prefix)
        if is_ssh:
            windows_content = self.windows_generator.generate_ssh_command_content(
                config_name, file_number, user_inputs, f"{file_name}.ps1"
            )
        else:
            mcp_section = ""
            if mcp_enabled:
                mcp_section = self.windows_generator.generate_mcp_section(
                    command_prefix, config['DisplayName'], command_prefix, support_upgrade=True
                )

            windows_content = self.windows_generator.generate_command_content(
                config_name, command_prefix, ps_command, file_number,
                config['Variables'], mcp_section, f"{file_name}.ps1"
            )

        winenvs_dir = get_winenvs_dir()
        ensure_directory_exists(str(winenvs_dir))
        win_script_path = winenvs_dir / f"{file_name}.ps1"

        try:
            with open(win_script_path, 'w', encoding='utf-8') as f:
                f.write(windows_content)
            ColorMessage.write(f"[OK] Windows script: {win_script_path}", 'success')
            script_paths.append(win_script_path)
            success_count += 1
        except Exception as e:
            ColorMessage.write(f"[X] Failed to create Windows script: {e}", 'error')

        # Generate Linux script
        bash_command = config.get('LinuxCommand', command_prefix)
        if is_ssh:
            linux_content = self.linux_generator.generate_ssh_command_content(
                config_name, file_number, user_inputs, f"{file_name}.sh"
            )
        else:
            linux_mcp_section = ""
            if mcp_enabled:
                linux_mcp_section = self.linux_generator.generate_mcp_section(
                    command_prefix, config['DisplayName'], command_prefix, support_upgrade=True
                )

            linux_content = self.linux_generator.generate_command_content(
                config_name, command_prefix, bash_command, file_number,
                config['Variables'], linux_mcp_section, f"{file_name}.sh"
            )

        linuxenvs_dir = get_linuxenvs_dir()
        ensure_directory_exists(str(linuxenvs_dir))
        linux_script_path = linuxenvs_dir / f"{file_name}.sh"

        try:
            with open(linux_script_path, 'w', encoding='utf-8') as f:
                f.write(linux_content)

            try:
                os.chmod(linux_script_path, 0o755)
            except Exception:
                pass

            if platform.system() != 'Windows':
                self._ensure_linux_symlink(linux_script_path)

            ColorMessage.write(f"[OK] Linux script: {linux_script_path}", 'success')
            script_paths.append(linux_script_path)
            success_count += 1
        except Exception as e:
            ColorMessage.write(f"[X] Failed to create Linux script: {e}", 'error')

        if success_count == 0:
            ColorMessage.write("No scripts were generated.", 'error')
            return script_paths

        if show_next_steps:
            print()
            ColorMessage.write("Script generation completed successfully!", 'success')
            ColorMessage.write("", 'info')
            ColorMessage.write("Next steps:", 'info')

            if secret_manager_available:
                ColorMessage.write("1. Secrets are encrypted and saved automatically", 'success')
                ColorMessage.write("2. Scripts will load secrets from encrypted storage", 'info')
            else:
                ColorMessage.write("1. Use SecretManager to store environment variables securely", 'info')

            ColorMessage.write("3. Run the scripts:", 'info')
            for script_path in script_paths:
                ColorMessage.write(f"   {script_path}", 'info')

        return script_paths

    def _ensure_linux_symlink(self, script_path: Path):
        """Ensure /usr/local/bin links to the given script"""
        if platform.system() == 'Windows':
            return

        link_dir = Path('/usr/local/bin')
        link_path = link_dir / script_path.stem

        try:
            if not link_dir.exists():
                parent = link_dir.parent
                if parent.exists() and os.access(parent, os.W_OK):
                    link_dir.mkdir(parents=True, exist_ok=True)
                else:
                    subprocess.run(['sudo', 'mkdir', '-p', str(link_dir)], check=True)

            if os.access(link_dir, os.W_OK):
                os.chmod(script_path, os.stat(script_path).st_mode | stat.S_IEXEC)
                subprocess.run(['ln', '-sf', str(script_path), str(link_path)], check=True)
            else:
                subprocess.run(['sudo', 'chmod', '+x', str(script_path)], check=True)
                subprocess.run(['sudo', 'ln', '-sf', str(script_path), str(link_path)], check=True)

            ColorMessage.write(f"[LINK] {link_path} -> {script_path}", 'success')
        except Exception as e:
            ColorMessage.write(f"[LINK] Failed to update symlink for {script_path.name}: {e}", 'warning')

    def _collect_secret_file_numbers(self, config: dict) -> List[int]:
        """Collect file numbers from secret storage for a config"""
        numbers: Set[int] = set()
        directories = [
            (LOCAL_SECRET_MANAGER.raw_dir, False),
            (LOCAL_SECRET_MANAGER.encrypted_dir, True)
        ]

        var_names = [var['Name'] for var in config.get('Variables', [])]

        for var_name in var_names:
            prefix = f"{var_name}_"
            prefix_upper = prefix.upper()

            for directory, is_encrypted in directories:
                if not directory or not directory.exists():
                    continue

                for entry in directory.iterdir():
                    if not entry.is_file():
                        continue

                    name = entry.name
                    if is_encrypted and name.lower().endswith('.js'):
                        name = name[:-3]

                    if name.upper().startswith(prefix_upper):
                        suffix = name[len(prefix):]
                        if suffix.isdigit():
                            numbers.add(int(suffix))

        return sorted(numbers)

    def restore_scripts_from_secrets(self, config_manager, secret_manager_available: bool = False):
        """Restore winenvs/linuxenvs scripts based on stored secrets"""
        clear_screen()
        ColorMessage.write("Restore Scripts from Secret Storage", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()

        if not is_admin():
            ColorMessage.write("Administrator/root privileges are required to restore scripts.", 'error')
            input("Press Enter to continue...")
            return

        if not LOCAL_SECRET_MANAGER.secret_keys_dir.exists():
            ColorMessage.write("Secret storage directory not found.", 'error')
            input("Press Enter to continue...")
            return

        total_sets = 0
        for config_name, config in config_manager.get_all_configs().items():
            file_numbers = self._collect_secret_file_numbers(config)
            if not file_numbers:
                continue

            ColorMessage.write(
                f"{config['DisplayName']}: found versions {', '.join(str(n) for n in file_numbers)}",
                'info'
            )

            for number in file_numbers:
                ColorMessage.write(f"  Restoring #{number}...", 'info')
                script_paths = self.generate_scripts_for_config(
                    config_name, config, number, show_next_steps=False,
                    secret_manager_available=secret_manager_available
                )
                if script_paths:
                    total_sets += 1

            print()

        if total_sets == 0:
            ColorMessage.write("No matching secrets were found to restore scripts.", 'warning')
        else:
            ColorMessage.write(f"Restored {total_sets} script set(s) from secret storage.", 'success')
            self._generate_symlink_script()

            if platform.system() == 'Windows':
                ColorMessage.write("\nTo use Linux scripts, run this on Linux:", 'info')
                ColorMessage.write("  bash scripts/linuxenvs/create_symlinks.sh", 'info')
            else:
                ColorMessage.write("Linux commands were linked into /usr/local/bin.", 'info')

        print()
        input("Press Enter to continue...")

    def regenerate_all_scripts(self, config_manager, secret_manager_available: bool = False):
        """Regenerate ALL scripts from secret storage (no admin required, no symlinks)"""
        clear_screen()
        ColorMessage.write("Regenerate All Scripts", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()

        if not LOCAL_SECRET_MANAGER.secret_keys_dir.exists():
            ColorMessage.write("Secret storage directory not found.", 'error')
            input("Press Enter to continue...")
            return

        total_sets = 0
        skipped = 0
        for config_name, config in config_manager.get_all_configs().items():
            file_numbers = self._collect_secret_file_numbers(config)
            if not file_numbers:
                continue

            display_name = config.get('DisplayName', config_name)
            ColorMessage.write(
                f"{display_name}: regenerating #{', '.join(str(n) for n in file_numbers)}",
                'info'
            )

            for number in file_numbers:
                script_paths = self.generate_scripts_for_config(
                    config_name, config, number, show_next_steps=False,
                    secret_manager_available=secret_manager_available
                )
                if script_paths:
                    total_sets += 1
                else:
                    skipped += 1

        print()
        if total_sets == 0:
            ColorMessage.write("No scripts were regenerated (no secrets found).", 'warning')
        else:
            ColorMessage.write(f"Regenerated {total_sets} script set(s).", 'success')
            if skipped:
                ColorMessage.write(f"Skipped {skipped} set(s) due to errors.", 'warning')

            # Generate symlink helper but don't require admin
            try:
                self._generate_symlink_script()
            except Exception:
                pass

            if platform.system() != 'Windows':
                ColorMessage.write("\nLinux symlinks updated where possible.", 'info')
            else:
                ColorMessage.write("\nTo update Linux symlinks, run on Linux:", 'info')
                ColorMessage.write("  bash scripts/linuxenvs/create_symlinks.sh", 'info')

        print()
        input("Press Enter to continue...")

    def _generate_symlink_script(self):
        """Generate a helper script to create symlinks on Linux"""
        linuxenvs_dir = get_linuxenvs_dir()
        script_path = linuxenvs_dir / "create_symlinks.sh"

        sh_scripts = sorted(linuxenvs_dir.glob("*.sh"))
        if not sh_scripts:
            return

        script_lines = [
            "#!/bin/bash",
            "# Auto-generated script to create symlinks for Linux environment scripts",
            "# This script should be run on Linux to create symlinks in /usr/local/bin",
            "",
            "set -e",
            "",
            "scriptSource=\"${BASH_SOURCE[0]}\"",
            "if [ -L \"$scriptSource\" ]; then",
            "    scriptSource=\"$(readlink -f \"$scriptSource\" 2>/dev/null || echo \"$scriptSource\")\"",
            "fi",
            "SCRIPT_DIR=\"$(cd \"$(dirname \"$scriptSource\")\" && pwd)\"",
            "",
            "echo \"Creating symlinks in /usr/local/bin...\"",
            "echo \"\"",
            "",
            "if [ -w /usr/local/bin ]; then",
            "    USE_SUDO=\"\"",
            "else",
            "    USE_SUDO=\"sudo\"",
            "fi",
            "",
        ]

        for script in sh_scripts:
            if script.name == "create_symlinks.sh":
                continue
            script_name = script.stem
            script_lines.append(f"# Link {script_name}")
            script_lines.append(f"$USE_SUDO chmod +x \"$SCRIPT_DIR/{script.name}\"")
            script_lines.append(f"$USE_SUDO ln -sf \"$SCRIPT_DIR/{script.name}\" /usr/local/bin/{script_name}")
            script_lines.append(f"echo \"[LINK] {script_name} -> $SCRIPT_DIR/{script.name}\"")
            script_lines.append("")

        script_lines.extend([
            "echo \"\"",
            "echo \"Symlinks created successfully!\"",
            "echo \"You can now run these commands from anywhere:\"",
            ""
        ])

        for script in sh_scripts:
            if script.name != "create_symlinks.sh":
                script_lines.append(f"echo \"  {script.stem}\"")

        try:
            with open(script_path, 'w', encoding='utf-8', newline='\n') as f:
                f.write('\n'.join(script_lines) + '\n')

            try:
                os.chmod(script_path, 0o755)
            except Exception:
                pass

            ColorMessage.write(f"\n[CREATED] Symlink helper: {script_path}", 'success')
        except Exception as e:
            ColorMessage.write(f"[WARNING] Failed to create symlink helper script: {e}", 'warning')

    def view_scripts(self, config_name: str, config: Dict[str, Any], file_number_manager):
        """View existing scripts for the specified configuration"""
        clear_screen()
        ColorMessage.write(f"View Scripts for {config_name}", 'info')
        ColorMessage.write("=" * 60, 'info')
        print()

        command_prefix = config.get('CommandPrefix', config.get('Common', ''))
        scripts = file_number_manager.list_existing_scripts(command_prefix)

        if not scripts:
            ColorMessage.write("No scripts found for this configuration.", 'warning')
            ColorMessage.write(f"Command prefix: {command_prefix}", 'info')
            ColorMessage.write("(Only showing scripts that exist on BOTH Windows and Linux platforms)", 'info')
            print()
            ColorMessage.write("Use 'Add Global Command' to create a new script.", 'info')
        else:
            ColorMessage.write(f"Found {len(scripts)} script pair(s) for {config['DisplayName']}:", 'success')
            ColorMessage.write("(Scripts exist on BOTH Windows and Linux platforms)", 'info')
            print()

            for i, script in enumerate(scripts, 1):
                ColorMessage.write(f"{i}. Script #{script['file_number']}", 'info')
                print()

                ColorMessage.write(f"   Windows: {script['windows_name']}", 'info')
                ColorMessage.write(f"   Path: {script['windows_path']}", 'info')
                try:
                    stat_info = script['windows_path'].stat()
                    size = stat_info.st_size
                    mtime = stat_info.st_mtime
                    mod_time = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                    ColorMessage.write(f"   Size: {size} bytes | Modified: {mod_time}", 'info')
                except Exception as e:
                    ColorMessage.write(f"   Error reading file info: {e}", 'warning')

                print()

                ColorMessage.write(f"   Linux: {script['linux_name']}", 'info')
                ColorMessage.write(f"   Path: {script['linux_path']}", 'info')
                try:
                    stat_info = script['linux_path'].stat()
                    size = stat_info.st_size
                    mtime = stat_info.st_mtime
                    mod_time = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d %H:%M:%S')
                    ColorMessage.write(f"   Size: {size} bytes | Modified: {mod_time}", 'info')
                except Exception as e:
                    ColorMessage.write(f"   Error reading file info: {e}", 'warning')

                print()

            ColorMessage.write("Operations:", 'info')
            ColorMessage.write("  - To edit: Open the script file in your text editor", 'info')
            ColorMessage.write("  - To run: Execute the script from your terminal/shell", 'info')

        print()
        ColorMessage.write("Current Environment Variables Status:", 'info')
        ColorMessage.write("-" * 60, 'info')
        print()

        for var in config.get('Variables', []):
            value = os.environ.get(var['Name'])
            display_name = var.get('DisplayName', var['Name'])

            ColorMessage.write(f"{display_name}: ", 'info', no_newline=True)
            if value:
                ColorMessage.write(value, 'success')
            else:
                ColorMessage.write("[Not set]", 'warning')

        print()
        input("Press Enter to continue...")


__all__ = ['ScriptManager']

