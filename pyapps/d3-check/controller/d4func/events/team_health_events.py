#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Team Health Events
Event handlers for team health state changes

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


def on_team_health_detected():
    """
    Event triggered when team health is detected
    
    Uses shared data from D4InterfaceData
    """
    d4_data = get_d4_interface_data()
    if d4_data.team_health_info:
        total_members = d4_data.team_health_info.get('total_members', 0)
        ColorPrint.green(f"[Team Health Event] Team health detected: {total_members} members")
    else:
        ColorPrint.blue("[Team Health Event] Team health detected: No data")


def on_team_member_joined():
    """
    Event triggered when a team member joins
    
    Uses shared data from D4InterfaceData
    """
    d4_data = get_d4_interface_data()
    if d4_data.team_health_info:
        total_members = d4_data.team_health_info.get('total_members', 0)
        ColorPrint.green(f"[Team Health Event] Team member joined: Total {total_members} members")
    else:
        ColorPrint.blue("[Team Health Event] Team member joined: No data")


def on_team_member_left():
    """
    Event triggered when a team member leaves
    
    Uses shared data from D4InterfaceData
    """
    d4_data = get_d4_interface_data()
    if d4_data.team_health_info:
        total_members = d4_data.team_health_info.get('total_members', 0)
        ColorPrint.yellow(f"[Team Health Event] Team member left: Total {total_members} members")
    else:
        ColorPrint.blue("[Team Health Event] Team member left: No data")


def on_team_health_changed():
    """
    Event triggered when team health information changes
    
    Uses shared data from D4InterfaceData
    """
    d4_data = get_d4_interface_data()
    if d4_data.team_health_info:
        local_count = d4_data.team_health_info.get('local_map_members', 0)
        non_local_count = d4_data.team_health_info.get('non_local_map_members', 0)
        ColorPrint.blue(f"[Team Health Event] Team health changed: Local {local_count}, Non-Local {non_local_count}")
    else:
        ColorPrint.blue("[Team Health Event] Team health changed: No data")
