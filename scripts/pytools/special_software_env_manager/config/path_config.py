#!/usr/bin/env python3
"""
Path Configuration Module

Centralized path configuration to avoid duplication across modules.
"""

from pathlib import Path
from typing import Dict

from utils.common_utils import get_project_root


class PathConfig:
    """Centralized path configuration"""

    def __init__(self, project_root: Path = None):
        if project_root is None:
            project_root = get_project_root()
        
        self.project_root = project_root
        self.scripts_dir = project_root / 'scripts'
        self.pytools_dir = self.scripts_dir / 'pytools'
        self.ai_tools_dir = self.pytools_dir / 'ai_tools'
        
        # Windows paths
        self.winenvs_dir = self.scripts_dir / 'winenvs'
        self.shells_dir = self.scripts_dir / 'shells'
        self.win_dir = self.shells_dir / 'win'
        self.win_common_dir = self.win_dir / 'win_common'
        self.secret_manager_ps1 = self.win_common_dir / 'SecretManager.ps1'
        
        # Linux paths
        self.linuxenvs_dir = self.scripts_dir / 'linuxenvs'
        self.linux_dir = self.shells_dir / 'linux'
        self.linux_common_dir = self.linux_dir / 'linux_common'
        
        # Secret paths
        self.secret_keys_dir = project_root / '.secret_keys'
        self.raw_secret_dir = self.secret_keys_dir / '.secret_ignore'
        self.encrypted_secret_dir = self.secret_keys_dir / 'already_encrypted'
        
        # App paths
        self.laravel_apps_dir = project_root / 'poly_apps' / 'laravel_main' / 'app' / 'Apps'
        self.nuxt_apps_dir = project_root / 'poly_apps' / 'nuxt_main' / 'apps'
        self.flutter_apps_dir = project_root / 'poly_apps' / 'flutter_bloom' / 'lib' / 'apps'
        
        # Backup path
        self.backup_dir = self.pytools_dir / 'special_software_env_manager' / 'backups'

    def get_mcp_sync_script_path(self, tool_type: str) -> Path:
        """Get MCP sync script path for a specific tool"""
        return self.ai_tools_dir / f'{tool_type}_sync_mcp_servers.py'

    def get_pre_launch_script_path(self, tool_type: str, platform: str = 'windows') -> Path:
        """Get pre-launch script path for a specific tool"""
        if platform == 'windows':
            return self.ai_tools_dir / f'{tool_type}_pre_launch.ps1'
        else:
            return self.ai_tools_dir / f'{tool_type}_pre_launch.sh'

    def get_update_script_path(self, tool_type: str, platform: str = 'windows') -> Path:
        """Get update/upgrade script path for a specific tool"""
        if platform == 'windows':
            return self.ai_tools_dir / f'{tool_type}_update.bat'
        else:
            return self.ai_tools_dir / f'{tool_type}_update.sh'

    def get_all_paths(self) -> Dict[str, Path]:
        """Get all configured paths as a dictionary"""
        return {
            'project_root': self.project_root,
            'scripts_dir': self.scripts_dir,
            'pytools_dir': self.pytools_dir,
            'ai_tools_dir': self.ai_tools_dir,
            'winenvs_dir': self.winenvs_dir,
            'linuxenvs_dir': self.linuxenvs_dir,
            'secret_keys_dir': self.secret_keys_dir,
            'raw_secret_dir': self.raw_secret_dir,
            'encrypted_secret_dir': self.encrypted_secret_dir,
            'backup_dir': self.backup_dir,
            'laravel_apps_dir': self.laravel_apps_dir,
            'nuxt_apps_dir': self.nuxt_apps_dir,
            'flutter_apps_dir': self.flutter_apps_dir,
        }


# Global instance
_path_config_instance = None


def get_path_config(project_root: Path = None) -> PathConfig:
    """Get global path configuration instance"""
    global _path_config_instance
    if _path_config_instance is None:
        _path_config_instance = PathConfig(project_root)
    return _path_config_instance


__all__ = ['PathConfig', 'get_path_config']

