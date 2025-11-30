#!/usr/bin/env python3
"""
File Number Manager Module

Manages file numbering for scripts and encrypted constants.
"""

from typing import List
from pathlib import Path

from utils.common_utils import get_winenvs_dir, get_linuxenvs_dir, get_platform_type
from config.path_config import get_path_config


class FileNumberManager:
    """Manages file numbering for scripts and encrypted constants"""

    def __init__(self, project_root: Path):
        self.path_config = get_path_config(project_root)
        self.project_root = project_root

    def get_next_file_number(self, command_prefix: str) -> int:
        """Get the next available file number for a command prefix"""
        platform_type = get_platform_type()

        directories = []
        if platform_type == 'windows':
            directories.append(get_winenvs_dir())
        else:
            directories.append(get_linuxenvs_dir())

        max_number = 0

        for directory in directories:
            if not directory.exists():
                continue

            for file_path in directory.iterdir():
                if file_path.is_file():
                    name = file_path.stem
                    if name.startswith(command_prefix):
                        try:
                            number_str = name[len(command_prefix):]
                            number = int(number_str)
                            max_number = max(max_number, number)
                        except ValueError:
                            continue

        return max_number + 1

    def get_next_encrypted_constant_number(self, config_name: str, var_names: List[str]) -> int:
        """Get the next available file number for encrypted constants"""
        raw_dir = self.path_config.raw_secret_dir
        if not raw_dir.exists():
            return 1

        max_number = 0

        for var_name in var_names:
            prefix = f"{var_name}_"
            for file_path in raw_dir.iterdir():
                if file_path.is_file():
                    name = file_path.name
                    if name.startswith(prefix):
                        try:
                            number_str = name[len(prefix):]
                            number = int(number_str)
                            max_number = max(max_number, number)
                        except ValueError:
                            continue

        return max_number + 1

    def list_existing_encrypted_constants(self, var_names: List[str]) -> List[int]:
        """List existing encrypted constant file numbers for a configuration"""
        raw_dir = self.path_config.raw_secret_dir
        if not raw_dir.exists():
            return []

        file_numbers = set()

        for var_name in var_names:
            prefix = f"{var_name}_"
            for file_path in raw_dir.iterdir():
                if file_path.is_file():
                    name = file_path.name
                    if name.startswith(prefix):
                        try:
                            number_str = name[len(prefix):]
                            number = int(number_str)
                            file_numbers.add(number)
                        except ValueError:
                            continue

        return sorted(file_numbers)

    def list_existing_scripts(self, command_prefix: str) -> List[dict]:
        """
        List existing scripts for a command prefix

        Only returns scripts that exist on BOTH Windows and Linux platforms.
        """
        scripts = []

        winenvs_dir = get_winenvs_dir()
        linuxenvs_dir = get_linuxenvs_dir()

        windows_file_numbers = set()
        if winenvs_dir.exists():
            for file_path in winenvs_dir.iterdir():
                if file_path.is_file() and file_path.suffix == '.ps1':
                    name = file_path.stem
                    if name.startswith(command_prefix):
                        try:
                            number_part = name.replace(command_prefix, '')
                            file_num = int(number_part)
                            windows_file_numbers.add(file_num)
                        except ValueError:
                            continue

        linux_file_numbers = set()
        if linuxenvs_dir.exists():
            for file_path in linuxenvs_dir.iterdir():
                if file_path.is_file() and file_path.suffix == '.sh':
                    name = file_path.stem
                    if name.startswith(command_prefix):
                        try:
                            number_part = name.replace(command_prefix, '')
                            file_num = int(number_part)
                            linux_file_numbers.add(file_num)
                        except ValueError:
                            continue

        common_file_numbers = windows_file_numbers & linux_file_numbers

        for file_num in sorted(common_file_numbers):
            win_script_name = f"{command_prefix}{file_num}.ps1"
            linux_script_name = f"{command_prefix}{file_num}.sh"

            scripts.append({
                'file_number': file_num,
                'windows_name': win_script_name,
                'linux_name': linux_script_name,
                'windows_path': winenvs_dir / win_script_name,
                'linux_path': linuxenvs_dir / linux_script_name
            })

        return scripts

    def list_all_existing_scripts(self, command_prefix: str) -> List[dict]:
        """
        List all existing scripts for a command prefix from current platform
        """
        scripts = []
        platform_type = get_platform_type()
        is_windows_platform = platform_type in ('windows', 'wsl')

        winenvs_dir = get_winenvs_dir()
        linuxenvs_dir = get_linuxenvs_dir()

        file_numbers = set()
        script_info = {}

        if winenvs_dir.exists():
            for file_path in winenvs_dir.iterdir():
                if file_path.is_file() and file_path.suffix == '.ps1':
                    name = file_path.stem
                    if name.startswith(command_prefix):
                        try:
                            number_part = name.replace(command_prefix, '')
                            file_num = int(number_part)
                            file_numbers.add(file_num)
                            if file_num not in script_info:
                                script_info[file_num] = {
                                    'windows_exists': False,
                                    'linux_exists': False,
                                    'windows_path': None,
                                    'linux_path': None
                                }
                            script_info[file_num]['windows_exists'] = True
                            script_info[file_num]['windows_path'] = file_path
                        except ValueError:
                            continue

        if linuxenvs_dir.exists():
            for file_path in linuxenvs_dir.iterdir():
                if file_path.is_file() and file_path.suffix == '.sh':
                    name = file_path.stem
                    if name.startswith(command_prefix):
                        try:
                            number_part = name.replace(command_prefix, '')
                            file_num = int(number_part)
                            file_numbers.add(file_num)
                            if file_num not in script_info:
                                script_info[file_num] = {
                                    'windows_exists': False,
                                    'linux_exists': False,
                                    'windows_path': None,
                                    'linux_path': None
                                }
                            script_info[file_num]['linux_exists'] = True
                            script_info[file_num]['linux_path'] = file_path
                        except ValueError:
                            continue

        for file_num in sorted(file_numbers):
            info = script_info[file_num]

            if is_windows_platform and not info['windows_exists']:
                continue
            if not is_windows_platform and not info['linux_exists']:
                continue

            win_script_name = f"{command_prefix}{file_num}.ps1"
            linux_script_name = f"{command_prefix}{file_num}.sh"

            scripts.append({
                'file_number': file_num,
                'windows_name': win_script_name,
                'linux_name': linux_script_name,
                'windows_path': info['windows_path'] or (winenvs_dir / win_script_name),
                'linux_path': info['linux_path'] or (linuxenvs_dir / linux_script_name),
                'windows_exists': info['windows_exists'],
                'linux_exists': info['linux_exists'],
                'exists_on_both': info['windows_exists'] and info['linux_exists']
            })

        return scripts


__all__ = ['FileNumberManager']

