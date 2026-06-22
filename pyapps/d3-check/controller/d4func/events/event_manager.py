#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Event Manager
Manages state changes and triggers corresponding events

Uses shared data from D4InterfaceData and D4State
No parameters are passed - data is read directly from shared memory
"""

import sys
from pathlib import Path
from typing import Dict, Callable, Any

# Add project paths
current_dir = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(current_dir))

from pycore.pyfoundations.color_print import ColorPrint
# D4State functionality now integrated into D4InterfaceData
from share.game_interface_data import get_d4_interface_data, D4_EVENT_KEYS

# Import all event functions
from .exp_farming_events import (
    on_exp_farming_started,
    on_exp_farming_stopped,
    on_exp_farming_tick_completed
)
from .team_health_events import (
    on_team_health_detected,
    on_team_member_joined,
    on_team_member_left,
    on_team_health_changed
)
from .screen_events import (
    on_screen_size_changed,
    on_screen_coordinates_changed,
    on_display_mode_changed
)
from .game_state_events import (
    on_game_state_changed,
    on_current_map_changed,
    on_dungeon_progress_changed
)


class D4EventManager:
    """
    D4 Event Manager
    
    Manages state changes and triggers corresponding events
    All event functions use shared data from D4InterfaceData and D4State
    """
    
    def __init__(self):
        """Initialize event manager"""
        # D4State functionality now integrated into D4InterfaceData
        self.d4_data = get_d4_interface_data()
        
        # Event function mapping
        self.event_functions: Dict[str, Callable] = {
            D4_EVENT_KEYS['EXP_FARMING_STARTED']: on_exp_farming_started,
            D4_EVENT_KEYS['EXP_FARMING_STOPPED']: on_exp_farming_stopped,
            D4_EVENT_KEYS['EXP_FARMING_TICK_COMPLETED']: on_exp_farming_tick_completed,
            
            D4_EVENT_KEYS['TEAM_HEALTH_DETECTED']: on_team_health_detected,
            D4_EVENT_KEYS['TEAM_MEMBER_JOINED']: on_team_member_joined,
            D4_EVENT_KEYS['TEAM_MEMBER_LEFT']: on_team_member_left,
            D4_EVENT_KEYS['TEAM_HEALTH_CHANGED']: on_team_health_changed,
            
            D4_EVENT_KEYS['SCREEN_SIZE_CHANGED']: on_screen_size_changed,
            D4_EVENT_KEYS['SCREEN_COORDINATES_CHANGED']: on_screen_coordinates_changed,
            D4_EVENT_KEYS['DISPLAY_MODE_CHANGED']: on_display_mode_changed,
            
            D4_EVENT_KEYS['GAME_STATE_CHANGED']: on_game_state_changed,
            D4_EVENT_KEYS['CURRENT_MAP_CHANGED']: on_current_map_changed,
            D4_EVENT_KEYS['DUNGEON_PROGRESS_CHANGED']: on_dungeon_progress_changed,
        }
        
        # Previous state tracking for change detection
        self.previous_states: Dict[str, Any] = {}
        
        ColorPrint.blue("[D4EventManager] Initialized")
    
    def trigger_event(self, event_key: str):
        """
        Trigger an event by key
        
        Args:
            event_key: Event key from D4_EVENT_KEYS
        """
        if event_key in self.event_functions:
            event_function = self.event_functions[event_key]
            event_function()
            ColorPrint.blue(f"[D4EventManager] Event triggered: {event_key}")
        else:
            ColorPrint.yellow(f"[D4EventManager] Unknown event key: {event_key}")

    def check_state_changes(self):
        """
        Check for state changes and trigger corresponding events
        
        Uses shared data from D4InterfaceData and D4State
        """
        self._check_exp_farming_changes()
        self._check_team_health_changes()
        self._check_screen_changes()
        self._check_game_state_changes()

    def _check_exp_farming_changes(self):
        """Check EXP farming state changes"""
        current_running = self.d4_data.is_exp_farming_running()
        previous_running = self.previous_states.get('exp_farming_running')
        
        if previous_running is not None:
            if current_running and not previous_running:
                self.trigger_event(D4_EVENT_KEYS['EXP_FARMING_STARTED'])
            elif not current_running and previous_running:
                self.trigger_event(D4_EVENT_KEYS['EXP_FARMING_STOPPED'])
        
        self.previous_states['exp_farming_running'] = current_running
    
    def _check_team_health_changes(self):
        """Check team health state changes"""
        current_team_info = self.d4_data.team_health_info
        previous_team_info = self.previous_states.get('team_health_info')
        
        if current_team_info:
            current_total = current_team_info.get('total_members', 0)
            previous_total = previous_team_info.get('total_members', 0) if previous_team_info else 0
            
            if previous_team_info is None:
                # First detection
                self.trigger_event(D4_EVENT_KEYS['TEAM_HEALTH_DETECTED'])
            elif current_total > previous_total:
                # Member joined
                self.trigger_event(D4_EVENT_KEYS['TEAM_MEMBER_JOINED'])
            elif current_total < previous_total:
                # Member left
                self.trigger_event(D4_EVENT_KEYS['TEAM_MEMBER_LEFT'])
            elif current_team_info != previous_team_info:
                # Health info changed
                self.trigger_event(D4_EVENT_KEYS['TEAM_HEALTH_CHANGED'])
        
        self.previous_states['team_health_info'] = current_team_info.copy() if current_team_info else None
    
    def _check_screen_changes(self):
        """Check screen state changes"""
        # Check screen size changes
        current_size = self.d4_data.game_window_size
        previous_size = self.previous_states.get('game_window_size')
        
        if previous_size is not None and current_size != previous_size:
            self.trigger_event(D4_EVENT_KEYS['SCREEN_SIZE_CHANGED'])
        
        self.previous_states['game_window_size'] = current_size
        
        # Check screen coordinates changes
        current_coords = self.d4_data.window_offset
        previous_coords = self.previous_states.get('window_offset')
        
        if previous_coords is not None and current_coords != previous_coords:
            self.trigger_event(D4_EVENT_KEYS['SCREEN_COORDINATES_CHANGED'])
        
        self.previous_states['window_offset'] = current_coords
        
        # Check display mode changes
        current_mode = self.d4_data.is_windowed_mode()
        previous_mode = self.previous_states.get('is_windowed_mode')
        
        if previous_mode is not None and current_mode != previous_mode:
            self.trigger_event(D4_EVENT_KEYS['DISPLAY_MODE_CHANGED'])
        
        self.previous_states['is_windowed_mode'] = current_mode
    
    def _check_game_state_changes(self):
        """Check game state changes"""
        # Check current map changes
        current_map = self.d4_data.detected_regions.get('map_name') if self.d4_data.detected_regions else None
        previous_map = self.previous_states.get('current_map')
        
        if previous_map is not None and current_map != previous_map:
            self.trigger_event(D4_EVENT_KEYS['CURRENT_MAP_CHANGED'])
        
        self.previous_states['current_map'] = current_map
        
        # Check dungeon progress changes
        current_progress = self.d4_data.detected_regions.get('dungeon_progress') if self.d4_data.detected_regions else None
        previous_progress = self.previous_states.get('dungeon_progress')
        
        if previous_progress is not None and current_progress != previous_progress:
            self.trigger_event(D4_EVENT_KEYS['DUNGEON_PROGRESS_CHANGED'])
        
        self.previous_states['dungeon_progress'] = current_progress


# Global event manager instance (singleton)
_event_manager = None


def get_event_manager() -> D4EventManager:
    """
    Get global event manager instance (singleton)
    
    Returns:
        Global D4EventManager instance
    """
    global _event_manager
    
    if _event_manager is None:
        _event_manager = D4EventManager()
        ColorPrint.green("[Global] D4 event manager initialized")
    
    return _event_manager
