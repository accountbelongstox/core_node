#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuration Manager

Manages configuration with presets and merging
"""

import json
from pathlib import Path
from typing import Dict, Any
from pycore.pyfoundations.color_print import ColorPrint


class ConfigManager:
    """Configuration manager with preset support"""

    def __init__(self, config: Dict[str, Any] = None):
        self.config = config or {}
        self.presets = {}
        self.is_loaded = False
        self.config_dir = Path(__file__).parent

    async def load(self):
        """Load configuration and presets"""
        try:
            ColorPrint.debug('Loading configuration...')

            self.load_presets()

            self.is_loaded = True
            ColorPrint.debug('Configuration loaded')
        except Exception as error:
            ColorPrint.red(f'Failed to load configuration: {error}')
            raise

    def load_presets(self):
        """Load preset configurations"""
        preset_files = {
            'desktop': 'presets/desktop.json',
            'headless': 'presets/headless.json',
            'mobile': 'presets/mobile.json'
        }

        for preset_name, preset_file in preset_files.items():
            preset_path = self.config_dir / preset_file
            if preset_path.exists():
                try:
                    with open(preset_path, 'r', encoding='utf-8') as f:
                        self.presets[preset_name] = json.load(f)
                        ColorPrint.debug(f"Loaded preset: {preset_name}")
                except Exception as error:
                    ColorPrint.warn(f"Failed to load preset {preset_name}: {error}")
            else:
                self.presets[preset_name] = self.get_default_preset(preset_name)
                ColorPrint.debug(f"Using default preset: {preset_name}")

    def get_default_preset(self, preset_name: str) -> Dict[str, Any]:
        """
        Get default preset configuration

        Args:
            preset_name: Preset name

        Returns:
            Default preset dictionary
        """
        if preset_name == 'desktop':
            return {
                'browser': 'edge',
                'headless': False,
                'browser_options': {
                    'args': [
                        '--start-maximized',
                        '--disable-infobars'
                    ]
                }
            }
        elif preset_name == 'headless':
            return {
                'browser': 'chrome',
                'headless': True,
                'browser_options': {
                    'args': [
                        '--no-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-setuid-sandbox'
                    ]
                }
            }
        elif preset_name == 'mobile':
            return {
                'browser': 'chrome',
                'headless': False,
                'browser_options': {
                    'args': [
                        '--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
                    ],
                    'window_size': (375, 812)
                }
            }
        else:
            return {}

    def merge_session_config(self, options: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge session options with base config and preset

        Args:
            options: Session options

        Returns:
            Merged configuration
        """
        merged = {}

        preset_name = options.get('preset')
        if preset_name and preset_name in self.presets:
            merged.update(self.presets[preset_name])

        merged.update(self.config)

        merged.update(options)

        return merged

    def get_info(self) -> Dict[str, Any]:
        """
        Get configuration information

        Returns:
            Dictionary with config info
        """
        return {
            'is_loaded': self.is_loaded,
            'presets': list(self.presets.keys()),
            'config': self.config
        }
