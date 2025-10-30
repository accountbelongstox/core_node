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
"""

from .color_print import ColorPrint
from .encyclopedia import Encyclopedia, ENCYCLOPEDIA

# Event bus
from .event_bus import EventBus, EventTypes, Event

# Global variables
from .gvar import GlobalVarManager

# Device abstractions
from .device import DeviceInfo, Resolution, ServerParams, VideoCodec, AndroidDevice, ScrcpyDevice

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
]

__version__ = '1.0.0'