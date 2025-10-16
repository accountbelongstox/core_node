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

# DEBUG 开关：设置为 False 关闭所有 debug 弹窗
DEBUG_MESSAGEBOX = False


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
        try:
            ColorPrint.debug_messagebox("DEBUG #19", f"[GameState] Enter set_rosbot_status({running})", DEBUG_MESSAGEBOX)

            should_notify = False
            with self._lock:
                ColorPrint.debug_messagebox("DEBUG #20", "[GameState] Lock acquired successfully", DEBUG_MESSAGEBOX)

                if self.rosbot_running != running:
                    ColorPrint.debug_messagebox("DEBUG #21", f"[GameState] Status changed from {self.rosbot_running} to {running}", DEBUG_MESSAGEBOX)
                    self.rosbot_running = running
                    should_notify = True
                    ColorPrint.blue(f"[GameState] ROSBOT status: {'Running' if running else 'Stopped'}")
                else:
                    ColorPrint.debug_messagebox("DEBUG #21-SKIP", "[GameState] Status unchanged, skipping notification", DEBUG_MESSAGEBOX)

            # Call _notify_callbacks outside lock to avoid deadlock
            if should_notify:
                ColorPrint.debug_messagebox("DEBUG #22", "[GameState] Preparing to call _notify_callbacks (outside lock)", DEBUG_MESSAGEBOX)
                self._notify_callbacks()
                ColorPrint.debug_messagebox("DEBUG #23", "[GameState] _notify_callbacks returned", DEBUG_MESSAGEBOX)

        except Exception as e:
            ColorPrint.debug_messagebox("ERROR", f"[GameState] Exception: {e}", DEBUG_MESSAGEBOX, "error")
            ColorPrint.red(f"[GameState] Error setting ROSBOT status: {e}")
    
    def set_d3_status(self, running: bool):
        """Set Diablo III running status"""
        should_notify = False
        with self._lock:
            if self.d3_running != running:
                self.d3_running = running
                should_notify = True
                ColorPrint.blue(f"[GameState] D3 status: {'Running' if running else 'Stopped'}")

        if should_notify:
            self._notify_callbacks()
    
    def set_map_type(self, map_type: str):
        """Set current map type"""
        should_notify = False
        with self._lock:
            if self.map_type != map_type:
                self.map_type = map_type
                should_notify = True
                ColorPrint.blue(f"[GameState] Map type: {map_type}")

        if should_notify:
            self._notify_callbacks()
    
    def set_game_stage(self, stage: str):
        """Set current game stage"""
        should_notify = False
        with self._lock:
            if self.game_stage != stage:
                self.game_stage = stage
                should_notify = True
                ColorPrint.blue(f"[GameState] Game stage: {stage}")

        if should_notify:
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
        try:
            ColorPrint.debug_messagebox("DEBUG #24", "[GameState] Enter _notify_callbacks", DEBUG_MESSAGEBOX)

            # Get callbacks and state outside of lock to avoid deadlock
            callbacks = []
            state = None
            with self._lock:
                ColorPrint.debug_messagebox("DEBUG #25", "[GameState] _notify_callbacks acquired lock", DEBUG_MESSAGEBOX)
                callbacks = self._callbacks.copy()
                # Get state directly without calling get_state() to avoid nested lock
                state = {
                    'rosbot_running': self.rosbot_running,
                    'd3_running': self.d3_running,
                    'map_type': self.map_type,
                    'game_stage': self.game_stage
                }
                ColorPrint.debug_messagebox("DEBUG #26", f"[GameState] Found {len(callbacks)} callback(s)", DEBUG_MESSAGEBOX)

            # Call callbacks outside of lock
            for i, callback in enumerate(callbacks):
                try:
                    ColorPrint.debug_messagebox("DEBUG #27", f"[GameState] Preparing to call callback {i+1}/{len(callbacks)}: {callback.__name__}", DEBUG_MESSAGEBOX)
                    callback(state)
                    ColorPrint.debug_messagebox("DEBUG #28", f"[GameState] Callback {i+1} completed", DEBUG_MESSAGEBOX)
                except Exception as e:
                    ColorPrint.debug_messagebox("ERROR", f"[GameState] Callback {i+1} exception: {e}", DEBUG_MESSAGEBOX, "error")
                    ColorPrint.red(f"[GameState] Callback {i+1} error: {e}")

            ColorPrint.debug_messagebox("DEBUG #29", "[GameState] _notify_callbacks completed", DEBUG_MESSAGEBOX)

        except Exception as e:
            ColorPrint.debug_messagebox("ERROR", f"[GameState] _notify_callbacks exception: {e}", DEBUG_MESSAGEBOX, "error")
            ColorPrint.red(f"[GameState] Error in _notify_callbacks: {e}")


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