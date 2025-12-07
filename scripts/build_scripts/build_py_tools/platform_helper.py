#!/usr/bin/env python3

"""
Platform Helper Module
Provides platform-specific command generation for cross-platform support.
Follows architecture rule: Python only generates commands, Shell executes them.
"""

import platform
from pathlib import Path
from typing import Dict, List
from keys_center import KeysCenter


class PlatformHelper:
    """Generates platform-specific commands for Shell execution"""

    def __init__(self):
        self.system = platform.system()  # 'Windows', 'Linux', 'Darwin'
        self.is_windows = self.system == 'Windows'
        self.is_unix = self.system in ['Linux', 'Darwin']

    def get_shell_type(self) -> str:
        """Returns the shell type for the current platform"""
        if self.is_windows:
            return 'powershell'
        return 'bash'

    def get_clear_command(self) -> str:
        """Returns platform-specific screen clear command"""
        return 'cls' if self.is_windows else 'clear'

    def get_path_separator(self) -> str:
        """Returns platform-specific path separator"""
        return '\\' if self.is_windows else '/'

    def get_null_device(self) -> str:
        """Returns platform-specific null device"""
        return 'NUL' if self.is_windows else '/dev/null'

    def normalize_path(self, path: str) -> str:
        """Converts path to platform-specific format"""
        return str(Path(path))

    def get_install_command(self, package_manager: str) -> str:
        """
        Returns the install command for the package manager.
        No command execution - just returns the command string.
        """
        commands = {
            'pnpm': 'pnpm install',
            'yarn': 'yarn install',
            'npm': 'npm install',
            'composer': 'composer install',
            'flutter': 'flutter pub get',
        }
        return commands.get(package_manager, 'npm install')

    def get_build_command(self, package_manager: str, script_name: str = 'build') -> str:
        """
        Returns the build command for the package manager.
        """
        if package_manager in ['pnpm', 'yarn', 'npm']:
            return f'{package_manager} run {script_name}'
        elif package_manager == 'composer':
            return f'php artisan {script_name}'
        return f'{package_manager} {script_name}'

    def get_tool_check_command(self, tool_name: str) -> Dict[str, str]:
        """
        Returns platform-specific command to check if a tool is available.

        Returns:
            Dict with 'command' and 'expected_exit_code'
        """
        if self.is_windows:
            return {
                'command': f'where.exe {tool_name}',
                'expected_exit_code': 0,
                'error_redirect': f'2>NUL'
            }
        else:
            return {
                'command': f'which {tool_name}',
                'expected_exit_code': 0,
                'error_redirect': '2>/dev/null'
            }

    def get_directory_exists_command(self, directory: str) -> Dict[str, str]:
        """Returns platform-specific command to check if directory exists"""
        if self.is_windows:
            return {
                'command': f'Test-Path "{directory}"',
                'shell': 'powershell',
            }
        else:
            return {
                'command': f'[ -d "{directory}" ]',
                'shell': 'bash',
            }

    def get_file_exists_command(self, file_path: str) -> Dict[str, str]:
        """Returns platform-specific command to check if file exists"""
        if self.is_windows:
            return {
                'command': f'Test-Path "{file_path}"',
                'shell': 'powershell',
            }
        else:
            return {
                'command': f'[ -f "{file_path}" ]',
                'shell': 'bash',
            }

    def get_remove_directory_command(self, directory: str) -> str:
        """Returns platform-specific command to remove directory"""
        if self.is_windows:
            return f'Remove-Item -Recurse -Force "{directory}"'
        return f'rm -rf "{directory}"'

    def get_create_directory_command(self, directory: str) -> str:
        """Returns platform-specific command to create directory"""
        if self.is_windows:
            return f'New-Item -ItemType Directory -Force -Path "{directory}"'
        return f'mkdir -p "{directory}"'

    def get_copy_command(self, source: str, destination: str, recursive: bool = False) -> str:
        """Returns platform-specific copy command"""
        if self.is_windows:
            if recursive:
                return f'Copy-Item -Recurse -Force "{source}" "{destination}"'
            return f'Copy-Item -Force "{source}" "{destination}"'
        else:
            if recursive:
                return f'cp -r "{source}" "{destination}"'
            return f'cp "{source}" "{destination}"'

    def get_chmod_command(self, path: str, mode: str = '755') -> str:
        """Returns chmod command (Unix only, returns empty string on Windows)"""
        if self.is_unix:
            return f'chmod -R {mode} "{path}"'
        return ''  # Windows doesn't use chmod

    def get_environment_variable_set(self, var_name: str, var_value: str) -> str:
        """Returns platform-specific command to set environment variable"""
        if self.is_windows:
            return f'$env:{var_name} = "{var_value}"'
        return f'export {var_name}="{var_value}"'

    def get_cd_command(self, directory: str) -> str:
        """Returns platform-specific change directory command"""
        # cd is universal, but path format differs
        normalized_path = self.normalize_path(directory)
        return f'cd "{normalized_path}"'

    def generate_validation_script(self, project_path: str, project_type: str,
                                   project_name: str, action: str) -> List[str]:
        """
        Generates a platform-specific validation script.
        Returns list of command strings for Shell to execute.
        """
        commands = []

        # Set working directory
        commands.append(self.get_cd_command(project_path))

        # Run validation
        py_tools_dir = str(Path(__file__).parent)

        # Project validation
        commands.append(
            f'python3 "{py_tools_dir}/project_validator.py" '
            f'"{project_path}" "{project_type}" "{project_name}"'
        )

        # Dependency check
        commands.append(
            f'python3 "{py_tools_dir}/dependency_manager.py" '
            f'"{project_path}" "{project_type}" "{project_name}"'
        )

        # Build requirements (if build action)
        if action in ['build', 'generate']:
            commands.append(
                f'python3 "{py_tools_dir}/build_validator.py" '
                f'"{project_path}" "{project_type}" "{action}" "{project_name}"'
            )

        return commands

    def generate_dependency_install_script(self, project_path: str,
                                          package_manager: str) -> List[str]:
        """
        Generates a platform-specific dependency installation script.
        """
        commands = []

        # Change to project directory
        commands.append(self.get_cd_command(project_path))

        # Check tool availability
        tool_check = self.get_tool_check_command(package_manager)

        if self.is_windows:
            commands.append(
                f'if (!(Get-Command {package_manager} -ErrorAction SilentlyContinue)) {{'
            )
            commands.append(f'    Write-Host "Error: {package_manager} is not installed"')
            commands.append(f'    exit 1')
            commands.append('}')
        else:
            commands.append(f'if ! command -v {package_manager} &> /dev/null; then')
            commands.append(f'    echo "Error: {package_manager} is not installed"')
            commands.append(f'    exit 1')
            commands.append('fi')

        # Install dependencies
        install_cmd = self.get_install_command(package_manager)
        commands.append(install_cmd)

        # Check result
        if self.is_windows:
            commands.append('if ($LASTEXITCODE -ne 0) {')
            commands.append('    Write-Host "✗ Failed to install dependencies"')
            commands.append('    exit 1')
            commands.append('}')
            commands.append('Write-Host "✓ Dependencies installed successfully"')
        else:
            commands.append('if [ $? -eq 0 ]; then')
            commands.append('    echo "✓ Dependencies installed successfully"')
            commands.append('else')
            commands.append('    echo "✗ Failed to install dependencies"')
            commands.append('    exit 1')
            commands.append('fi')

        return commands


if __name__ == "__main__":
    import sys

    helper = PlatformHelper()

    print(f"Platform: {helper.system}")
    print(f"Shell type: {helper.get_shell_type()}")
    print(f"Clear command: {helper.get_clear_command()}")
    print(f"Path separator: {helper.get_path_separator()}")
    print(f"Null device: {helper.get_null_device()}")
    print()

    if len(sys.argv) > 1:
        command_type = sys.argv[1]

        if command_type == "install" and len(sys.argv) > 3:
            project_path = sys.argv[2]
            package_manager = sys.argv[3]

            print("Generated install script:")
            print("=" * 60)
            for cmd in helper.generate_dependency_install_script(project_path, package_manager):
                print(cmd)

        elif command_type == "validate" and len(sys.argv) > 5:
            project_path = sys.argv[2]
            project_type = sys.argv[3]
            project_name = sys.argv[4]
            action = sys.argv[5]

            print("Generated validation script:")
            print("=" * 60)
            for cmd in helper.generate_validation_script(project_path, project_type, project_name, action):
                print(cmd)
