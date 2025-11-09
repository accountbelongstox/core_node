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

from providor.common_imports import ColorPrint
from share.game_interface_data import get_d4_interface_data


def get_current_map_name_from_shared_data() -> str:
    """
    Get current map name from shared data
    
    Returns:
        str: Current map name or "Unknown" if not available
    """
    try:
        d4_data = get_d4_interface_data()
        
        if d4_data.detected_regions:
            # Try map_name first (from OCR recognition)
            if 'map_name' in d4_data.detected_regions:
                return d4_data.detected_regions['map_name']
            # Fallback to current_map for backward compatibility
            elif 'current_map' in d4_data.detected_regions:
                return d4_data.detected_regions['current_map']
        
        return "Unknown"
        
    except Exception as e:
        ColorPrint.red(f"[MapNameUtils] Error getting current map name: {e}")
        return "Unknown"


def set_current_map_name(map_name: str) -> bool:
    """
    Set current map name in shared data
    
    Args:
        map_name: Map name to set
        
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        d4_data = get_d4_interface_data()
        
        # Initialize detected_regions if not exists
        if d4_data.detected_regions is None:
            d4_data.detected_regions = {}
        
        # Update map_name in detected_regions
        d4_data.detected_regions['map_name'] = map_name
        
        # Also update current_map for backward compatibility
        d4_data.detected_regions['current_map'] = map_name
        
        ColorPrint.blue(f"[MapNameUtils] Set current map name: '{map_name}'")
        return True
        
    except Exception as e:
        ColorPrint.red(f"[MapNameUtils] Error setting current map name: {e}")
        return False


def clear_current_map_name() -> bool:
    """
    Clear current map name from shared data
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        d4_data = get_d4_interface_data()
        
        if d4_data.detected_regions:
            # Clear map_name
            if 'map_name' in d4_data.detected_regions:
                del d4_data.detected_regions['map_name']
            
            # Clear current_map for backward compatibility
            if 'current_map' in d4_data.detected_regions:
                del d4_data.detected_regions['current_map']
        
        ColorPrint.blue("[MapNameUtils] Cleared current map name")
        return True
        
    except Exception as e:
        ColorPrint.red(f"[MapNameUtils] Error clearing current map name: {e}")
        return False


def is_map_name_available() -> bool:
    """
    Check if map name is available in shared data
    
    Returns:
        bool: True if map name is available, False otherwise
    """
    try:
        d4_data = get_d4_interface_data()
        
        if d4_data.detected_regions:
            return ('map_name' in d4_data.detected_regions or 
                   'current_map' in d4_data.detected_regions)
        
        return False
        
    except Exception as e:
        ColorPrint.red(f"[MapNameUtils] Error checking map name availability: {e}")
        return False


# Alias for backward compatibility
def get_current_map_name() -> str:
    """
    Alias for get_current_map_name_from_shared_data() for backward compatibility
    
    Returns:
        str: Current map name or "Unknown" if not available
    """
    return get_current_map_name_from_shared_data()
