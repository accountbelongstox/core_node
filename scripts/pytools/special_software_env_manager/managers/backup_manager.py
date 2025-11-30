#!/usr/bin/env python3
"""
Backup Manager Module

Handles configuration backup and restore operations.
"""

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List

from utils.common_utils import ColorMessage, get_platform_type
from config.path_config import get_path_config


class BackupManager:
    """Manages configuration backups"""

    def __init__(self, backup_dir: Path = None):
        if backup_dir is None:
            self.path_config = get_path_config()
            backup_dir = self.path_config.backup_dir
        else:
            self.path_config = get_path_config()
        self.backup_dir = backup_dir
        self.backup_dir.mkdir(parents=True, exist_ok=True)

    def save_configuration_backup(self, config_name: str, env_vars: dict) -> Path:
        """Save configuration as backup file"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{config_name.lower().replace(' ', '_')}_backup_{timestamp}.json"
        backup_path = self.backup_dir / filename

        backup_data = {
            'config_name': config_name,
            'timestamp': timestamp,
            'platform': get_platform_type(),
            'environment_variables': env_vars
        }

        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, indent=2)

        return backup_path

    def list_configuration_backups(self, config_name: str) -> List[dict]:
        """List available configuration backups"""
        backups = []

        if not self.backup_dir.exists():
            return backups

        config_prefix = config_name.lower().replace(' ', '_')
        for backup_file in self.backup_dir.iterdir():
            if backup_file.is_file() and backup_file.suffix == '.json':
                if backup_file.name.startswith(config_prefix):
                    try:
                        with open(backup_file, 'r', encoding='utf-8') as f:
                            data = json.load(f)
                            backups.append({
                                'path': backup_file,
                                'name': backup_file.name,
                                'timestamp': data.get('timestamp', 'unknown'),
                                'platform': data.get('platform', 'unknown'),
                                'config_name': data.get('config_name', config_name)
                            })
                    except Exception:
                        continue

        return sorted(backups, key=lambda x: x['timestamp'], reverse=True)


__all__ = ['BackupManager']

