#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Events Package
Event handlers for D4 state changes

All event functions use shared data from D4InterfaceData and D4State
No parameters are passed - data is read directly from shared memory
"""

from .exp_farming_events import *
from .team_health_events import *
from .screen_events import *
from .game_state_events import *
from .event_manager import D4EventManager, get_event_manager

__all__ = [
    # Event Manager
    'D4EventManager',
    'get_event_manager',
    
    # EXP Farming Events
    'on_exp_farming_started',
    'on_exp_farming_stopped',
    'on_exp_farming_tick_completed',
    
    # Team Health Events
    'on_team_health_detected',
    'on_team_member_joined',
    'on_team_member_left',
    'on_team_health_changed',
    
    # Screen Events
    'on_screen_size_changed',
    'on_screen_coordinates_changed',
    'on_display_mode_changed',
    
    # Game State Events
    'on_game_state_changed',
    'on_current_map_changed',
    'on_dungeon_progress_changed',
]
