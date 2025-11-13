#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
RPC Configuration - Shared configuration for RPC services

Provides shared configuration including port settings that are used
across all RPC components (discovery, scanner, protocol, address provider).
"""

import os
from typing import Optional, Dict, Any
from pathlib import Path

from pycore.pyutils.rpc.config.constants import RPC_CONSTANTS

DEFAULTS = RPC_CONSTANTS.DEFAULTS


class RPCConfig:
    """
    RPC Configuration - Shared configuration manager
    
    Manages shared configuration including port settings used by:
    - RPC Discovery
    - Network Scanner
    - RPC Protocol
    - Address Provider
    
    All components share the same port configuration.
    """
    
    _instance: Optional['RPCConfig'] = None
    _initialized = False
    
    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize RPC Configuration"""
        if self._initialized:
            return
        
        # Default port (shared across all components)
        self.port: int = int(os.getenv('RPC_PORT', DEFAULTS['SERVER_PORT']))
        
        # Default host
        self.host: str = os.getenv('RPC_HOST', DEFAULTS['SERVER_HOST'])
        
        # Network settings
        self.scan_timeout: float = 2.0
        self.scan_interval: float = 0.5
        self.connection_timeout: float = 2.0
        
        # Discovery settings
        self.use_localhost: bool = True
        self.enable_network_scan: bool = True
        
        # Protocol settings
        self.protocol_version: str = "1.0"
        
        # Cache settings
        self.cache_enabled: bool = True
        self.cache_ttl: float = 300.0  # 5 minutes
        
        self._initialized = True
    
    def get_port(self) -> int:
        """
        Get shared port configuration
        
        Returns:
            Port number (shared across all RPC components)
        """
        return self.port
    
    def set_port(self, port: int):
        """
        Set shared port configuration
        
        Args:
            port: Port number (will be used by all RPC components)
        """
        self.port = port
    
    def get_host(self) -> str:
        """
        Get host configuration
        
        Returns:
            Host address
        """
        return self.host
    
    def set_host(self, host: str):
        """
        Set host configuration
        
        Args:
            host: Host address
        """
        self.host = host
    
    def get_config(self) -> Dict[str, Any]:
        """
        Get full configuration dictionary
        
        Returns:
            Configuration dictionary
        """
        return {
            'port': self.port,
            'host': self.host,
            'scan_timeout': self.scan_timeout,
            'scan_interval': self.scan_interval,
            'connection_timeout': self.connection_timeout,
            'use_localhost': self.use_localhost,
            'enable_network_scan': self.enable_network_scan,
            'protocol_version': self.protocol_version,
            'cache_enabled': self.cache_enabled,
            'cache_ttl': self.cache_ttl
        }
    
    def update_config(self, config: Dict[str, Any]):
        """
        Update configuration from dictionary
        
        Args:
            config: Configuration dictionary
        """
        for key, value in config.items():
            if hasattr(self, key):
                setattr(self, key, value)


# Global configuration instance
_rpc_config = RPCConfig()


def get_rpc_config() -> RPCConfig:
    """
    Get global RPC configuration instance
    
    Returns:
        RPCConfig singleton instance
    """
    return _rpc_config


__all__ = ['RPCConfig', 'get_rpc_config']

