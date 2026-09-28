#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Screen Events
Event handlers for screen state changes

All functions use shared data from D4InterfaceData and D4State
No parameters are passed - data is read directly from shared memory
"""

import sys
from pathlib import Path

# Add project paths
current_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(current_dir))

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
# D4State functionality now integrated into D4InterfaceData
from share.game_interface_data import get_d4_interface_data


def on_screen_size_changed():
    """
    Event triggered when screen size changes
    
    Uses shared data from D4InterfaceData
    """
    d4_data = get_d4_interface_data()
    if d4_data.game_window_size:
        width, height = d4_data.game_window_size
        ColorPrint.green(f"[Screen Event] Screen size changed: {width}x{height}")
    else:
        ColorPrint.blue("[Screen Event] Screen size changed: No data")


def on_screen_coordinates_changed():
    """
    Event triggered when screen coordinates change
    
    Uses shared data from D4InterfaceData
    """
    d4_data = get_d4_interface_data()
    if d4_data.window_offset:
        x, y = d4_data.window_offset
        ColorPrint.green(f"[Screen Event] Screen coordinates changed: ({x}, {y})")
    else:
        ColorPrint.blue("[Screen Event] Screen coordinates changed: No data")


def on_display_mode_changed():
    """
    Event triggered when display mode changes (windowed/fullscreen)
    
    Uses shared data from D4InterfaceData
    """
    d4_data = get_d4_interface_data()
    mode = "Windowed" if d4_data.is_windowed_mode() else "Fullscreen"
    ColorPrint.green(f"[Screen Event] Display mode changed: {mode}")
