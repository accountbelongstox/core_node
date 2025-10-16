#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared Data Structures Package
Centralized data structures shared across D3 application
"""

from .game_interface_data import (
    D3InterfaceData,
    UIRegion,
    BagCoordinates,
    BagLayout,
    DetectionResult,
    get_game_interface_data,
    clear_game_interface_data,
    get_scaled_bag_region,
    get_scaled_blacksmith_salvage_button,
    get_scaled_reforge_region,
    update_global_scale,
    get_global_scale,
    GLOBAL_SCALE_X,
    GLOBAL_SCALE_Y
)

__all__ = [
    'D3InterfaceData',
    'UIRegion',
    'BagCoordinates',
    'BagLayout',
    'DetectionResult',
    'get_game_interface_data',
    'clear_game_interface_data',
    'get_scaled_bag_region',
    'get_scaled_blacksmith_salvage_button',
    'get_scaled_reforge_region',
    'update_global_scale',
    'get_global_scale',
    'GLOBAL_SCALE_X',
    'GLOBAL_SCALE_Y'
]
