#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EXP Farming Events
Event handlers for EXP farming state changes

All functions use shared data from D4InterfaceData and D4State
No parameters are passed - data is read directly from shared memory
"""

import sys
from pathlib import Path

# Add project paths
current_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(current_dir))

from pycore.pyfoundations.color_print import ColorPrint
# D4State functionality now integrated into D4InterfaceData
from share.game_interface_data import get_d4_interface_data


def on_exp_farming_started():
    """
    Event triggered when EXP farming is started
    
    Uses shared data from D4State and D4InterfaceData
    """
    d4_data = get_d4_interface_data()
    ColorPrint.green("[EXP Farming Event] EXP farming started")
    ColorPrint.blue(f"[EXP Farming Event] Current state: {d4_data.is_exp_farming_running()}")


def on_exp_farming_stopped():
    """
    Event triggered when EXP farming is stopped
    
    Uses shared data from D4State and D4InterfaceData
    """
    d4_data = get_d4_interface_data()
    ColorPrint.yellow("[EXP Farming Event] EXP farming stopped")
    ColorPrint.blue(f"[EXP Farming Event] Current state: {d4_data.is_exp_farming_running()}")


def on_exp_farming_tick_completed():
    """
    Event triggered when EXP farming tick is completed
    
    Uses shared data from D4State and D4InterfaceData
    """
    d4_data = get_d4_interface_data()
    ColorPrint.blue("[EXP Farming Event] EXP farming tick completed")
    ColorPrint.blue(f"[EXP Farming Event] Screenshot timestamp: {d4_data.timestamp}")
