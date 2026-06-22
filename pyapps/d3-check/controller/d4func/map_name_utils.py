#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Map Name Utilities for D4
Provides unified methods for getting current map name from shared data
"""

import sys
from pathlib import Path
from typing import Optional

# Add project paths
current_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(current_dir))

from pycore.pyfoundations.color_print import ColorPrint
from share.game_interface_data import get_d4_interface_data


def get_current_map_name_from_shared_data() -> str:
    """
    Get current map name from shared data
    
    Returns:
        str: Current map name or "Unknown" if not available
    """
    d4_data = get_d4_interface_data()
    if d4_data.detected_regions:
        if 'map_name' in d4_data.detected_regions:
            return d4_data.detected_regions['map_name']
        elif 'current_map' in d4_data.detected_regions:
            return d4_data.detected_regions['current_map']
    return "Unknown"


def set_current_map_name(map_name: str) -> bool:
    """
    Set current map name in shared data
    
    Args:
        map_name: Map name to set
        
    Returns:
        bool: True if successful, False otherwise
    """
    d4_data = get_d4_interface_data()
    if d4_data.detected_regions is None:
        d4_data.detected_regions = {}
    d4_data.detected_regions['map_name'] = map_name
    d4_data.detected_regions['current_map'] = map_name
    ColorPrint.blue(f"[MapNameUtils] Set current map name: '{map_name}'")
    return True


def clear_current_map_name() -> bool:
    """
    Clear current map name from shared data
    
    Returns:
        bool: True if successful, False otherwise
    """
    d4_data = get_d4_interface_data()
    if d4_data.detected_regions:
        if 'map_name' in d4_data.detected_regions:
            del d4_data.detected_regions['map_name']
        if 'current_map' in d4_data.detected_regions:
            del d4_data.detected_regions['current_map']
    ColorPrint.blue("[MapNameUtils] Cleared current map name")
    return True


def is_map_name_available() -> bool:
    """
    Check if map name is available in shared data
    
    Returns:
        bool: True if map name is available, False otherwise
    """
    d4_data = get_d4_interface_data()
    if d4_data.detected_regions:
        return ('map_name' in d4_data.detected_regions or
                'current_map' in d4_data.detected_regions)
    return False


# Alias for backward compatibility
def get_current_map_name() -> str:
    """
    Alias for get_current_map_name_from_shared_data() for backward compatibility
    
    Returns:
        str: Current map name or "Unknown" if not available
    """
    return get_current_map_name_from_shared_data()
