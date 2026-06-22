#!/usr/bin/env python3
"""
Shell Executor - Cross-platform shell command generation
Generates shell commands (bash/powershell/bat) to be executed by respective shells
Python only prepares commands, shell scripts execute them
"""

import os
import platform
import tempfile
from pathlib import Path
from typing import List, Dict, Optional
from dataclasses import dataclass


@dataclass
class ShellCommand:
    """Represents a shell command to be executed"""
    command: str
    description: str
    working_dir: Optional[str] = None
    platform: str = "all"


class ShellExecutor:
    """
    Cross-platform shell command generator
    Generates scripts for PowerShell (Windows) and Bash (Linux/Mac)
    """

    def __init__(self):
        self.system = platform.system().lower()
        self.is_windows = self.system == "windows"
        self.is_linux = self.system == "linux"
        self.is_mac = self.system == "darwin"

        # Temp directory for script files
        self.temp_dir = Path(tempfile.gettempdir()) / "flutter_bloom_scripts"
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def generate_bat_file(
        self,
        commands: List[str],
        title: str = "Flutter Bloom Script",
        working_dir: Optional[str] = None,
        pause_on_exit: bool = True
    ) -> str:
        """
        Generate a Windows BAT file with commands
        Returns: path to generated BAT file
        """
        bat_content = [
            "@echo off",
            f'title {title}',
            "echo ========================================",
            f"echo {title}",
            "echo ========================================",
            "echo."
        ]

        if working_dir:
            bat_content.append(f'cd /d "{working_dir}"')

        bat_content.extend(commands)

        if pause_on_exit:
            bat_content.append("")
            bat_content.append("pause")

        bat_file = self.temp_dir / f"{title.replace(' ', '_').lower()}.bat"
        bat_file.write_text("\n".join(bat_content), encoding='ascii')

        return str(bat_file)

    def generate_bash_script(
        self,
        commands: List[str],
        title: str = "Flutter Bloom Script",
        working_dir: Optional[str] = None,
        pause_on_exit: bool = False
    ) -> str:
        """
        Generate a Linux/Mac bash script with commands
        Returns: path to generated bash script
        """
        bash_content = [
            "#!/bin/bash",
            "",
            f"# {title}",
            "echo '========================================'",
            f"echo '{title}'",
            "echo '========================================'",
            "echo"
        ]

        if working_dir:
            bash_content.append(f'cd "{working_dir}" || exit 1')

        bash_content.extend(commands)

        if pause_on_exit:
            bash_content.append("")
            bash_content.append('read -p "Press Enter to continue..."')

        bash_file = self.temp_dir / f"{title.replace(' ', '_').lower()}.sh"
        bash_file.write_text("\n".join(bash_content), encoding='utf-8')

        # Make executable
        os.chmod(bash_file, 0o755)

        return str(bash_file)

    def generate_powershell_script(
        self,
        commands: List[str],
        title: str = "Flutter Bloom Script",
        working_dir: Optional[str] = None
    ) -> str:
        """
        Generate a PowerShell script with commands
        Returns: path to generated PS1 script
        """
        ps_content = [
            "$ErrorActionPreference = 'Stop'",
            f"Write-Host '{title}' -ForegroundColor Green",
            "Write-Host '========================================' -ForegroundColor Cyan",
            ""
        ]

        if working_dir:
            ps_content.append(f'Set-Location "{working_dir}"')

        ps_content.extend(commands)

        ps_file = self.temp_dir / f"{title.replace(' ', '_').lower()}.ps1"
        ps_file.write_text("\n".join(ps_content), encoding='utf-8')

        return str(ps_file)

    def write_shell_variable(self, var_name: str, var_value: str, shell_file: str):
        """
        Write a variable to shell file for later sourcing
        Creates platform-specific variable export syntax
        """
        shell_path = Path(shell_file)

        if self.is_windows:
            # Windows BAT syntax
            content = f"set {var_name}={var_value}\n"
        else:
            # Bash syntax
            content = f'export {var_name}="{var_value}"\n'

        shell_path.write_text(content, encoding='utf-8')

    def get_flutter_clean_command(self) -> str:
        """Get platform-specific flutter clean command"""
        return "flutter clean"

    def get_flutter_pub_get_command(self) -> str:
        """Get platform-specific flutter pub get command"""
        return "flutter pub get"

    def get_flutter_run_command(
        self,
        platform: str,
        entry_file: str,
        port: Optional[int] = None
    ) -> str:
        """
        Generate flutter run command
        """
        cmd = f"flutter run -d {platform}"

        if entry_file:
            cmd += f' --target "{entry_file}"'

        if port and platform in ["web-server", "chrome"]:
            cmd += f" --web-port {port}"

        return cmd

    def get_directory_remove_command(self, directory: str) -> str:
        """Get platform-specific command to remove directory"""
        if self.is_windows:
            return f'if exist "{directory}" rmdir /s /q "{directory}"'
        else:
            return f'rm -rf "{directory}"'

    def get_directory_create_command(self, directory: str) -> str:
        """Get platform-specific command to create directory"""
        if self.is_windows:
            return f'if not exist "{directory}" mkdir "{directory}"'
        else:
            return f'mkdir -p "{directory}"'

    def get_file_copy_command(self, source: str, dest: str) -> str:
        """Get platform-specific file copy command"""
        if self.is_windows:
            return f'copy /y "{source}" "{dest}"'
        else:
            return f'cp -f "{source}" "{dest}"'

    def get_open_browser_command(self, url: str) -> str:
        """Get platform-specific command to open browser"""
        if self.is_windows:
            return f'start {url}'
        elif self.is_mac:
            return f'open {url}'
        else:  # Linux
            return f'xdg-open {url} 2>/dev/null || true'

    def get_process_start_command(self, executable: str, args: str = "") -> str:
        """Get platform-specific command to start a process"""
        if self.is_windows:
            return f'start "" "{executable}" {args}'
        else:
            return f'"{executable}" {args} &'


# Global instance
shell_executor = ShellExecutor()
