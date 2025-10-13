#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game State Manager
Tracks ROSBOT, Diablo III, map status, and game stage
"""
import os
import sys
import time
import threading
from typing import Dict, Any, Callable, List
from providor.common_imports import ColorPrint


class GameState:
    """Global game state manager"""
    
    def __init__(self):
        self._lock = threading.Lock()
        self._callbacks: List[Callable] = []
        
        # State variables
        self.rosbot_running = False
        self.d3_running = False
        self.map_type = "unknown"  # town, greater_rift, rift, unknown
        self.game_stage = "unknown"  # gem_upgrade, kill_boss, back_town, in_greater_rift, in_rift, unknown
        
        ColorPrint.blue("[GameState] Initialized")
    
    def set_rosbot_status(self, running: bool):
        """Set ROSBOT running status"""
        with self._lock:
            if self.rosbot_running != running:
                self.rosbot_running = running
                ColorPrint.blue(f"[GameState] ROSBOT status: {'Running' if running else 'Stopped'}")
                self._notify_callbacks()
    
    def set_d3_status(self, running: bool):
        """Set Diablo III running status"""
        with self._lock:
            if self.d3_running != running:
                self.d3_running = running
                ColorPrint.blue(f"[GameState] D3 status: {'Running' if running else 'Stopped'}")
                self._notify_callbacks()
    
    def set_map_type(self, map_type: str):
        """Set current map type"""
        with self._lock:
            if self.map_type != map_type:
                self.map_type = map_type
                ColorPrint.blue(f"[GameState] Map type: {map_type}")
                self._notify_callbacks()
    
    def set_game_stage(self, stage: str):
        """Set current game stage"""
        with self._lock:
            if self.game_stage != stage:
                self.game_stage = stage
                ColorPrint.blue(f"[GameState] Game stage: {stage}")
                self._notify_callbacks()
    
    def get_state(self) -> Dict[str, Any]:
        """Get current state snapshot"""
        with self._lock:
            return {
                'rosbot_running': self.rosbot_running,
                'd3_running': self.d3_running,
                'map_type': self.map_type,
                'game_stage': self.game_stage
            }
    
    def register_callback(self, callback: Callable):
        """Register state change callback"""
        with self._lock:
            self._callbacks.append(callback)
            ColorPrint.debug(f"[GameState] Registered callback: {callback.__name__}")
    
    def _notify_callbacks(self):
        """Notify all registered callbacks"""
        # Get callbacks and state outside of lock to avoid deadlock
        callbacks = []
        state = None
        with self._lock:
            callbacks = self._callbacks.copy()
            state = self.get_state()
        
        # Call callbacks outside of lock
        for callback in callbacks:
            try:
                callback(state)
            except Exception as e:
                ColorPrint.red(f"[GameState] Callback error: {e}")


# Global instance
_game_state = None


def get_game_state() -> GameState:
    """Get global game state instance"""
    global _game_state
    if _game_state is None:
        _game_state = GameState()
    return _game_state


def register_state_callback(callback: Callable):
    """Register callback for state changes"""
    get_game_state().register_callback(callback)