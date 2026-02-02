#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared Data Structures Package
Centralized data structures shared across D3 application.

Prefer direct imports from submodules (no secondary encapsulation):
  from share.game_interface_data import ... ; from share.project_path import ...
"""

from .project_path import get_project_root, ensure_d3_check_in_sys_path
from .game_interface_data import (
    D3InterfaceData,
    StandardCoordinates,
    STANDARD_COORDS,
    UIRegion,
    BagCoordinates,
    BagLayout,
    DetectionResult,
    get_d3_interface_data,
    get_game_interface_data,
    clear_game_interface_data,
    get_scaled_bag_region,
    get_scaled_blacksmith_salvage_button,
    get_scaled_reforge_region,
    get_scaled_kanai_put_material_button,
    get_scaled_conversion_button,
    get_scaled_kanai_right_panel_toggle,
    get_scaled_kanai_next_page_button,
    update_global_scale,
    get_global_scale,
    get_screen_resolution,
    GLOBAL_SCALE_X,
    GLOBAL_SCALE_Y
)

__all__ = [
    'get_project_root',
    'ensure_d3_check_in_sys_path',
    'D3InterfaceData',
    'StandardCoordinates',
    'STANDARD_COORDS',
    'UIRegion',
    'BagCoordinates',
    'BagLayout',
    'DetectionResult',
    'get_d3_interface_data',
    'get_game_interface_data',
    'clear_game_interface_data',
    'get_scaled_bag_region',
    'get_scaled_blacksmith_salvage_button',
    'get_scaled_reforge_region',
    'get_scaled_kanai_put_material_button',
    'get_scaled_conversion_button',
    'get_scaled_kanai_right_panel_toggle',
    'get_scaled_kanai_next_page_button',
    'update_global_scale',
    'get_global_scale',
    'get_screen_resolution',
    'GLOBAL_SCALE_X',
    'GLOBAL_SCALE_Y',
]
