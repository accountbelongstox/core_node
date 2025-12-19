#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Plugin Interface

Defines the contract for plugin implementations
"""

from typing import Dict, Any


class IPlugin:
    """Base plugin interface"""

    def __init__(self):
        self.name = 'plugin'
        self.version = '1.0.0'
        self.is_initialized = False
        self.session = None

    def initialize(self, session: Any):
        """
        Initialize plugin with session

        Args:
            session: Session instance
        """
        raise NotImplementedError('IPlugin.initialize() must be implemented by subclass')

    def cleanup(self):
        """Cleanup plugin resources"""
        raise NotImplementedError('IPlugin.cleanup() must be implemented by subclass')

    def get_info(self) -> Dict[str, Any]:
        """
        Get plugin information

        Returns:
            Dictionary with plugin info
        """
        return {
            'name': self.name,
            'version': self.version,
            'is_initialized': self.is_initialized
        }
