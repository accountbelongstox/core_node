#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Events Package
Event handlers for D4 state changes.

Import directly from submodules (no secondary encapsulation):
  from controller.d4func.events.event_manager import D4EventManager, get_event_manager
  from controller.d4func.events.exp_farming_events import on_exp_farming_started, ...
"""

from .exp_farming_events import (
    on_exp_farming_started,
    on_exp_farming_stopped,
    on_exp_farming_tick_completed,
)
from .team_health_events import (
    on_team_health_detected,
    on_team_member_joined,
    on_team_member_left,
    on_team_health_changed,
)
from .screen_events import (
    on_screen_size_changed,
    on_screen_coordinates_changed,
    on_display_mode_changed,
)
from .game_state_events import (
    on_game_state_changed,
    on_current_map_changed,
    on_dungeon_progress_changed,
)
from .event_manager import D4EventManager, get_event_manager

__all__ = [
    'D4EventManager',
    'get_event_manager',
    'on_exp_farming_started',
    'on_exp_farming_stopped',
    'on_exp_farming_tick_completed',
    'on_team_health_detected',
    'on_team_member_joined',
    'on_team_member_left',
    'on_team_health_changed',
    'on_screen_size_changed',
    'on_screen_coordinates_changed',
    'on_display_mode_changed',
    'on_game_state_changed',
    'on_current_map_changed',
    'on_dungeon_progress_changed',
]
