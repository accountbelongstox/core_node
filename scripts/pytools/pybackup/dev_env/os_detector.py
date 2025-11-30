import platform
import os
import logging
from typing import Dict, List, Optional
from dataclasses import dataclass

from pycore.pygvar import (
    IS_WINDOWS,
    IS_LINUX,
    IS_MAC,
    SYSTEM_NAME,
    SYSTEM_VERSION
)

logger = logging.getLogger(__name__)


@dataclass
class OSInfo:
    system: str
    version: str
    version_name: str
    architecture: str
    is_windows10: bool = False
    is_windows11: bool = False
    is_linux: bool = False
    is_mac: bool = False

    def get_backup_namespace(self) -> str:
        if self.is_windows11:
            return 'Windows11'
        elif self.is_windows10:
            return 'Windows10'
        elif self.is_linux:
            return 'Linux'
        elif self.is_mac:
            return 'macOS'
        else:
            return 'Unknown'

    def __repr__(self) -> str:
        return f"OSInfo(system='{self.system}', version='{self.version}', namespace='{self.get_backup_namespace()}')"


class OSDetector:
    def __init__(self):
        self.os_info = self._detect_os()

    def _detect_os(self) -> OSInfo:
        system = platform.system()
        version = platform.version()
        architecture = platform.machine()

        version_name = 'Unknown'
        is_windows10 = False
        is_windows11 = False
        is_linux = False
        is_mac = False

        if IS_WINDOWS:
            version_name = self._detect_windows_version()
            is_windows10 = 'Windows10' in version_name or 'Windows 10' in version_name
            is_windows11 = 'Windows11' in version_name or 'Windows 11' in version_name

            if not (is_windows10 or is_windows11):
                try:
                    build_number = self._get_windows_build_number()
                    if build_number >= 22000:
                        is_windows11 = True
                        version_name = 'Windows11'
                    elif build_number >= 10240:
                        is_windows10 = True
                        version_name = 'Windows10'
                except:
                    pass

        elif IS_LINUX:
            is_linux = True
            version_name = self._detect_linux_distribution()

        elif IS_MAC:
            is_mac = True
            version_name = f"macOS {platform.mac_ver()[0]}"

        os_info = OSInfo(
            system=system,
            version=version,
            version_name=version_name,
            architecture=architecture,
            is_windows10=is_windows10,
            is_windows11=is_windows11,
            is_linux=is_linux,
            is_mac=is_mac
        )

        logger.info(f"Detected OS: {os_info}")
        return os_info

    def _detect_windows_version(self) -> str:
        try:
            import winreg

            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r'SOFTWARE\Microsoft\Windows NT\CurrentVersion'
            )

            product_name, _ = winreg.QueryValueEx(key, 'ProductName')
            build_number, _ = winreg.QueryValueEx(key, 'CurrentBuildNumber')

            winreg.CloseKey(key)

            build_num = int(build_number)

            if build_num >= 22000:
                return 'Windows11'
            elif build_num >= 10240:
                return 'Windows10'
            else:
                return product_name

        except Exception as e:
            logger.debug(f"Error detecting Windows version: {e}")
            return platform.win32_ver()[0] or 'Windows'

    def _get_windows_build_number(self) -> int:
        try:
            import winreg

            key = winreg.OpenKey(
                winreg.HKEY_LOCAL_MACHINE,
                r'SOFTWARE\Microsoft\Windows NT\CurrentVersion'
            )

            build_number, _ = winreg.QueryValueEx(key, 'CurrentBuildNumber')
            winreg.CloseKey(key)

            return int(build_number)

        except Exception as e:
            logger.debug(f"Error getting Windows build number: {e}")
            return 0

    def _detect_linux_distribution(self) -> str:
        try:
            if os.path.exists('/etc/os-release'):
                with open('/etc/os-release', 'r') as f:
                    lines = f.readlines()
                    dist_info = {}
                    for line in lines:
                        if '=' in line:
                            key, value = line.strip().split('=', 1)
                            dist_info[key] = value.strip('"')

                    name = dist_info.get('NAME', 'Linux')
                    version = dist_info.get('VERSION', '')
                    return f"{name} {version}".strip()

        except Exception as e:
            logger.debug(f"Error detecting Linux distribution: {e}")

        return 'Linux'

    def get_os_specific_paths(self) -> Dict[str, List[str]]:
        paths = {
            'dev_environments': [],
            'config_dirs': [],
            'tool_dirs': []
        }

        if self.os_info.is_windows10 or self.os_info.is_windows11:
            paths['dev_environments'] = [
                r'D:\applications',
                r'D:\lang_compiler',
                os.path.join(os.environ.get('USERPROFILE', ''), '.config'),
                os.path.join(os.environ.get('USERPROFILE', ''), '.ssh'),
                os.path.join(os.environ.get('APPDATA', ''), 'Code'),
                os.path.join(os.environ.get('APPDATA', ''), 'Cursor'),
            ]

            paths['config_dirs'] = [
                os.path.join(os.environ.get('USERPROFILE', ''), '.gitconfig'),
                os.path.join(os.environ.get('USERPROFILE', ''), '.npmrc'),
                os.path.join(os.environ.get('USERPROFILE', ''), '.yarnrc'),
                os.path.join(os.environ.get('USERPROFILE', ''), '.bashrc'),
                os.path.join(os.environ.get('USERPROFILE', ''), '.bash_profile'),
            ]

        elif self.os_info.is_linux:
            home = os.path.expanduser('~')
            paths['dev_environments'] = [
                '/opt/applications',
                '/opt/lang_compiler',
                os.path.join(home, '.config'),
                os.path.join(home, '.ssh'),
            ]

            paths['config_dirs'] = [
                os.path.join(home, '.gitconfig'),
                os.path.join(home, '.npmrc'),
                os.path.join(home, '.yarnrc'),
                os.path.join(home, '.bashrc'),
                os.path.join(home, '.bash_profile'),
                os.path.join(home, '.zshrc'),
            ]

        elif self.os_info.is_mac:
            home = os.path.expanduser('~')
            paths['dev_environments'] = [
                '/Applications',
                os.path.join(home, '.config'),
                os.path.join(home, '.ssh'),
            ]

            paths['config_dirs'] = [
                os.path.join(home, '.gitconfig'),
                os.path.join(home, '.npmrc'),
                os.path.join(home, '.yarnrc'),
                os.path.join(home, '.bashrc'),
                os.path.join(home, '.bash_profile'),
                os.path.join(home, '.zshrc'),
            ]

        existing_paths = {}
        for category, path_list in paths.items():
            existing_paths[category] = [p for p in path_list if os.path.exists(p)]

        return existing_paths

    def get_backup_namespace(self) -> str:
        return self.os_info.get_backup_namespace()

    def get_os_info(self) -> OSInfo:
        return self.os_info
