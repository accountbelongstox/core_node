# -*- coding: utf-8 -*-
"""
Configuration Manager
Manages launcher configuration settings
"""

import json
from pathlib import Path
from typing import Dict, Any

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.launcher.app_finder import AppFinder
from pycore.pyutils.common.user_data_store import user_data_store

_SECTION = "launcher"

class ConfigManager:
    """Manage launcher configuration"""
    
    def __init__(self, config_path=None):
        """
        Initialize config manager
        
        Args:
            config_path: Path to config file (default: launcher directory / config.json)
        """
        self._uses_unified_store = config_path is None
        if self._uses_unified_store:
            config_path = Path(__file__).parent / 'config.json'
        
        self.config_path = Path(config_path)
        self.config = self.load_config()
    
    def _get_applications_defaults(self):
        """Get default applications configuration from APP_DEFINITIONS"""
        # Import here to avoid circular import
        
        defaults = {}
        app_definitions = AppFinder.APP_DEFINITIONS
        
        # Get all applications from APP_DEFINITIONS
        # Note: Do NOT include 'path' field - paths belong in app_cache.json, not config.json
        for app_name in app_definitions.keys():
            if app_name == 'chrome':
                # Chrome has version option (defaults to stable)
                defaults[app_name] = {
                    'enabled': True,
                    'version': 'stable'  # canary, stable, beta
                }
            elif app_name == 'chrome_beta':
                # Chrome Beta is a separate app entry
                defaults[app_name] = {
                    'enabled': False  # Disabled by default
                }
            else:
                # Default enabled state: only antigravity enabled by default
                defaults[app_name] = {
                    'enabled': True if app_name == 'antigravity' else False
                }
        
        return defaults
    
    def load_config(self):
        """Load configuration from file"""
        default_config = {
            'terminal': {
                'enabled': True,
                'columns': 3,
                'rows': 2,
                'toggle': 'X6'  # X4, X6, X8, DISABLE
            },
            'measurements': {
                'columns': 67,
                'columns_width_px': 510,
                'rows': 32,
                'rows_height_px': 485
            },
            'calibration': {
                'actual_height_px': 485,
                'term_rows': 32
            },
            # Reserve pixels for WT window chrome + safety so content fits in grid cell (avoids overlap)
            'window_chrome': {
                'title_bar_plus_padding_px': 56,
                'horizontal_padding_px': 24,
                'content_scale': 0.78,
                # Inter-cell gaps (px) so adjacent terminal windows never touch
                # ("squeezed together"). Subtracted from the screen before grid
                # division, then re-added as a step between cell origins.
                'gap_horizontal_px': 16,
                'gap_vertical_px': 24
            },
            'applications': self._get_applications_defaults()
        }
        
        if self._uses_unified_store:
            personalized = user_data_store.get_personalized_section(_SECTION)
            if not personalized and self.config_path.exists():
                try:
                    with open(self.config_path, 'r', encoding='utf-8') as f:
                        legacy_config = json.load(f)
                    if isinstance(legacy_config, dict):
                        user_data_store.set_section(_SECTION, legacy_config)
                except Exception as e:
                    ColorPrint.plain(f"Warning: Failed to migrate launcher config: {e}")
            user_config = user_data_store.get_section(_SECTION)
            self._merge_config(default_config, user_config)
            self._ensure_all_apps_in_config(default_config)
            self._remove_paths_from_config(default_config)
            return default_config

        if self.config_path.exists():
            try:
                with open(self.config_path, 'r', encoding='utf-8') as f:
                    user_config = json.load(f)
                    # Merge with defaults
                    self._merge_config(default_config, user_config)
                    # Migrate legacy X16 (4x4) toggle to X12 (4x3).
                    term = default_config.get('terminal', {})
                    if term.get('toggle') == 'X16':
                        term['toggle'] = 'X12'
                        term['columns'] = 4
                        term['rows'] = 3
                    # Ensure all apps from APP_DEFINITIONS are in config
                    self._ensure_all_apps_in_config(default_config)
                    # Remove all 'path' fields from applications (paths belong in cache, not config)
                    self._remove_paths_from_config(default_config)
                    return default_config
            except Exception as e:
                ColorPrint.plain(f"Warning: Failed to load config, using defaults: {e}")
        
        return default_config
    
    def _merge_config(self, default, user):
        """Merge user config into default config"""
        for key, value in user.items():
            if key in default:
                if isinstance(value, dict) and isinstance(default[key], dict):
                    self._merge_config(default[key], value)
                else:
                    default[key] = value
    
    def save_config(self):
        """Save configuration to file (paths are automatically removed)"""
        try:
            # Remove all 'path' fields before saving (paths belong in cache, not config)
            config_to_save = json.loads(json.dumps(self.config))  # Deep copy
            self._remove_paths_from_config(config_to_save)
            
            if self._uses_unified_store:
                user_data_store.set_section(_SECTION, config_to_save)
            else:
                with open(self.config_path, 'w', encoding='utf-8') as f:
                    json.dump(config_to_save, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            ColorPrint.plain(f"Error: Failed to save config: {e}")
            return False
    
    def get(self, key_path, default=None):
        """
        Get config value by dot-separated path
        
        Args:
            key_path: Dot-separated path (e.g., 'terminal.columns')
            default: Default value if not found
        
        Returns:
            Config value or default
        """
        keys = key_path.split('.')
        value = self.config
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return default
        return value
    
    def set(self, key_path, value):
        """
        Set config value by dot-separated path
        
        Args:
            key_path: Dot-separated path (e.g., 'terminal.columns')
            value: Value to set
        """
        keys = key_path.split('.')
        config = self.config
        for key in keys[:-1]:
            if key not in config:
                config[key] = {}
            config = config[key]
        config[keys[-1]] = value
    
    def get_terminal_config(self):
        """Get terminal configuration"""
        return self.config.get('terminal', {})
    
    def get_applications_config(self):
        """Get applications configuration"""
        return self.config.get('applications', {})
    
    def get_app_config(self, app_name):
        """Get specific application configuration"""
        return self.config.get('applications', {}).get(app_name, {})
    
    def get_measurements_config(self):
        """Get measurements configuration"""
        return self.config.get('measurements', {})
    
    def get_calibration_config(self):
        """Get calibration configuration"""
        return self.config.get('calibration', {})
    
    def _ensure_all_apps_in_config(self, config):
        """Ensure all apps from APP_DEFINITIONS are in config"""
        # Import here to avoid circular import
        
        app_defaults = self._get_applications_defaults()
        if 'applications' not in config:
            config['applications'] = {}
        
        # Add any missing apps from APP_DEFINITIONS
        for app_name, app_default in app_defaults.items():
            if app_name not in config['applications']:
                config['applications'][app_name] = app_default.copy()
            # Ensure structure is correct (remove path if exists)
            if 'path' in config['applications'][app_name]:
                del config['applications'][app_name]['path']
            if app_name == 'chrome':
                if 'version' not in config['applications'][app_name]:
                    config['applications'][app_name]['version'] = 'stable'
            # chrome_beta doesn't need version field, it's always beta
    
    def _remove_paths_from_config(self, config):
        """Remove all 'path' fields from applications config"""
        if 'applications' in config:
            for app_name, app_config in config['applications'].items():
                if isinstance(app_config, dict) and 'path' in app_config:
                    del app_config['path']

