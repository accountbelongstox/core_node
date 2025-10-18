#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game State Events
Event handlers for game state changes

All functions use shared data from D4InterfaceData and D4State
No parameters are passed - data is read directly from shared memory
"""

import sys
from pathlib import Path

# Add project paths
current_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(current_dir))

from providor.common_imports import ColorPrint
# D4State functionality now integrated into D4InterfaceData
from share.game_interface_data import get_d4_interface_data


def on_game_state_changed():
    """
    Event triggered when game state changes
    
    Uses shared data from D4State
    """
    try:
        d4_data = get_d4_interface_data()
        
        state = "Running" if d4_data.is_exp_farming_running() else "Stopped"
        ColorPrint.green(f"[Game State Event] Game state changed: {state}")
        
    except Exception as e:
        ColorPrint.red(f"[Game State Event] Error in on_game_state_changed: {e}")


def on_current_map_changed():
    """
    Event triggered when current map changes
    
    Uses shared data from D4InterfaceData
    """
    try:
        d4_data = get_d4_interface_data()
        
        if d4_data.detected_regions and 'map_name' in d4_data.detected_regions:
            map_name = d4_data.detected_regions['map_name']
            ColorPrint.green(f"[Game State Event] Current map changed: {map_name}")
        else:
            ColorPrint.blue("[Game State Event] Current map changed: Unknown")
        
    except Exception as e:
        ColorPrint.red(f"[Game State Event] Error in on_current_map_changed: {e}")


def on_dungeon_progress_changed():
    """
    Event triggered when dungeon progress changes
    
    Uses shared data from D4InterfaceData
    """
    try:
        d4_data = get_d4_interface_data()
        
        if d4_data.detected_regions and 'dungeon_progress' in d4_data.detected_regions:
            progress = d4_data.detected_regions['dungeon_progress']
            ColorPrint.green(f"[Game State Event] Dungeon progress changed: {progress}")
        else:
            ColorPrint.blue("[Game State Event] Dungeon progress changed: Unknown")
        
    except Exception as e:
        ColorPrint.red(f"[Game State Event] Error in on_dungeon_progress_changed: {e}")
