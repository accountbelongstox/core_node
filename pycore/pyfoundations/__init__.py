#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyFoundations - Core foundational utilities for Python projects

This module provides:
- Color printing utilities
- Global cache/encyclopedia
- Event bus for cross-app communication
- Global variable management
- Device abstractions
- Secret management (encryption/decryption)
"""

from .color_print import ColorPrint
from .encyclopedia import Encyclopedia, ENCYCLOPEDIA

# Event bus
from .event_bus import EventBus, EventTypes, Event

# Global variables
from .gvar import GlobalVarManager

# Device abstractions
from .device import DeviceInfo, Resolution, ServerParams, VideoCodec, AndroidDevice, ScrcpyDevice

# Secret management
from .secret_manager import (
    get_core_node_dir,
    get_secret_directories,
    decrypt_all_secrets,
    encrypt_all_secrets,
    get_secret_key,
    get_all_secret_keys,
    set_secret_key
)

__all__ = [
    # Utilities
    'ColorPrint',
    'Encyclopedia',
    'ENCYCLOPEDIA',

    # Events
    'EventBus',
    'EventTypes',
    'Event',

    # Global vars
    'GlobalVarManager',

    # Devices
    'DeviceInfo',
    'Resolution',
    'ServerParams',
    'VideoCodec',
    'AndroidDevice',
    'ScrcpyDevice',

    # Secret management
    'get_core_node_dir',
    'get_secret_directories',
    'decrypt_all_secrets',
    'encrypt_all_secrets',
    'get_secret_key',
    'get_all_secret_keys',
    'set_secret_key',
]

__version__ = '1.0.0'