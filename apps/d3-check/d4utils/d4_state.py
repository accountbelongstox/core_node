#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 State Manager
Centralized state management for Diablo IV operations

Similar to D3's game_state.py, provides:
- State tracking for D4-specific features
- Callback system for state change notifications
- Thread-safe state updates
"""

import os
import sys
import threading
from typing import List, Callable, Optional, Dict, Any
from dataclasses import dataclass, field

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
sys.path.insert(0, project_root)

from providor.common_imports import ColorPrint


@dataclass
class TeamMemberState:
    """Team member state data"""
    name: str = ""
    level: int = 0
    health_percent: float = 100.0
    is_alive: bool = True
    is_online: bool = True


@dataclass
class TeamState:
    """Team/Party state data"""
    has_team: bool = False
    team_size: int = 0
    member1: TeamMemberState = field(default_factory=TeamMemberState)
    member2: TeamMemberState = field(default_factory=TeamMemberState)
    member3: TeamMemberState = field(default_factory=TeamMemberState)

    def get_member(self, index: int) -> Optional[TeamMemberState]:
        """Get team member by index (1-3)"""
        if index == 1:
            return self.member1
        elif index == 2:
            return self.member2
        elif index == 3:
            return self.member3
        return None


@dataclass
class GameWindowInfo:
    """Game window information"""
    detected: bool = False
    hwnd: Optional[int] = None
    title: str = ""
    size: tuple = (0, 0)  # (width, height)
    position: tuple = (0, 0)  # (x, y)


class D4State:
    """
    D4 State Manager

    Manages state for D4-specific operations with callback support
    """

    def __init__(self):
        """Initialize D4 state manager"""
        self._lock = threading.Lock()
        self._callbacks: List[Callable] = []

        # Game running state
        self.game_running = False

        # Game window information
        self.window_info = GameWindowInfo()

        # EXP Farming state
        self.exp_farming_running = False

        # Team/Party state
        self.team_state = TeamState()

        # Game progress
        self.game_progress = {
            "current_act": 0,  # 0-5
            "current_chapter": 0,
            "current_quest": "",
            "difficulty": "",  # Normal, Nightmare, Hell, Torment, etc.
            "world_tier": 0  # 1-4
        }

        # Experience tracking
        self.experience = {
            "current_level": 0,
            "current_exp": 0,
            "exp_to_next_level": 0,
            "exp_percent": 0.0,
            "paragon_level": 0
        }

        # Screenshot state
        self.last_screenshot_path = None
        self.last_screenshot_time = 0.0

        ColorPrint.green("[D4State] Initialized")

    def add_callback(self, callback: Callable):
        """
        Add callback function to be notified of state changes

        Args:
            callback: Function to call when state changes
        """
        with self._lock:
            if callback not in self._callbacks:
                self._callbacks.append(callback)
                ColorPrint.blue(f"[D4State] Callback registered: {callback.__name__}")

    def remove_callback(self, callback: Callable):
        """
        Remove callback function

        Args:
            callback: Function to remove
        """
        with self._lock:
            if callback in self._callbacks:
                self._callbacks.remove(callback)
                ColorPrint.blue(f"[D4State] Callback removed: {callback.__name__}")

    def _notify_callbacks(self):
        """
        Notify all registered callbacks of state changes

        NOTE: This method must be called OUTSIDE the lock to prevent deadlock
        """
        callbacks_copy = []

        with self._lock:
            callbacks_copy = self._callbacks.copy()

        # Call callbacks outside lock to prevent deadlock
        for callback in callbacks_copy:
            try:
                callback()
            except Exception as e:
                ColorPrint.red(f"[D4State] Error in callback {callback.__name__}: {e}")

    # ==================== Game Running State ====================

    def set_game_running(self, running: bool):
        """
        Set game running state

        Args:
            running: True if game is running, False otherwise
        """
        should_notify = False

        with self._lock:
            if self.game_running != running:
                self.game_running = running
                should_notify = True
                ColorPrint.blue(f"[D4State] Game running: {running}")

        if should_notify:
            self._notify_callbacks()

    def is_game_running(self) -> bool:
        """Check if game is running"""
        with self._lock:
            return self.game_running

    # ==================== Window Information ====================

    def set_window_info(self, detected: bool, hwnd: Optional[int] = None,
                       title: str = "", size: tuple = (0, 0), position: tuple = (0, 0)):
        """
        Set window information

        Args:
            detected: True if window is detected
            hwnd: Window handle
            title: Window title
            size: Window size (width, height)
            position: Window position (x, y)
        """
        should_notify = False

        with self._lock:
            if (self.window_info.detected != detected or
                self.window_info.size != size or
                self.window_info.title != title):
                self.window_info.detected = detected
                self.window_info.hwnd = hwnd
                self.window_info.title = title
                self.window_info.size = size
                self.window_info.position = position
                should_notify = True
                ColorPrint.blue(f"[D4State] Window info updated: detected={detected}, title='{title}', size={size}")

        if should_notify:
            self._notify_callbacks()

    def get_window_info(self) -> Dict[str, Any]:
        """Get window information as dictionary"""
        with self._lock:
            return {
                "detected": self.window_info.detected,
                "hwnd": self.window_info.hwnd,
                "title": self.window_info.title,
                "size": self.window_info.size,
                "position": self.window_info.position
            }

    # ==================== EXP Farming State ====================

    def set_exp_farming_running(self, running: bool):
        """
        Set EXP farming running state

        Args:
            running: True if EXP farming is running, False otherwise
        """
        should_notify = False

        with self._lock:
            if self.exp_farming_running != running:
                self.exp_farming_running = running
                should_notify = True
                ColorPrint.blue(f"[D4State] EXP farming running: {running}")

        if should_notify:
            self._notify_callbacks()

    def is_exp_farming_running(self) -> bool:
        """Check if EXP farming is running"""
        with self._lock:
            return self.exp_farming_running

    # ==================== Team/Party State ====================

    def set_team_state(self, has_team: bool, team_size: int = 0):
        """
        Set basic team state

        Args:
            has_team: True if in a team/party
            team_size: Number of team members (1-4)
        """
        should_notify = False

        with self._lock:
            if self.team_state.has_team != has_team or self.team_state.team_size != team_size:
                self.team_state.has_team = has_team
                self.team_state.team_size = team_size
                should_notify = True
                ColorPrint.blue(f"[D4State] Team state: has_team={has_team}, size={team_size}")

        if should_notify:
            self._notify_callbacks()

    def set_team_member(self, index: int, name: str = "", level: int = 0,
                       health_percent: float = 100.0, is_alive: bool = True,
                       is_online: bool = True):
        """
        Set team member state

        Args:
            index: Member index (1-3)
            name: Member name
            level: Member level
            health_percent: Health percentage (0-100)
            is_alive: Is member alive
            is_online: Is member online
        """
        should_notify = False

        with self._lock:
            member = self.team_state.get_member(index)
            if member:
                if (member.name != name or member.level != level or
                    member.health_percent != health_percent or
                    member.is_alive != is_alive or member.is_online != is_online):
                    member.name = name
                    member.level = level
                    member.health_percent = health_percent
                    member.is_alive = is_alive
                    member.is_online = is_online
                    should_notify = True
                    ColorPrint.blue(f"[D4State] Team member {index} updated: {name} (Lv.{level})")

        if should_notify:
            self._notify_callbacks()

    def get_team_state(self) -> Dict[str, Any]:
        """Get team state as dictionary"""
        with self._lock:
            return {
                "has_team": self.team_state.has_team,
                "team_size": self.team_state.team_size,
                "member1": {
                    "name": self.team_state.member1.name,
                    "level": self.team_state.member1.level,
                    "health_percent": self.team_state.member1.health_percent,
                    "is_alive": self.team_state.member1.is_alive,
                    "is_online": self.team_state.member1.is_online
                },
                "member2": {
                    "name": self.team_state.member2.name,
                    "level": self.team_state.member2.level,
                    "health_percent": self.team_state.member2.health_percent,
                    "is_alive": self.team_state.member2.is_alive,
                    "is_online": self.team_state.member2.is_online
                },
                "member3": {
                    "name": self.team_state.member3.name,
                    "level": self.team_state.member3.level,
                    "health_percent": self.team_state.member3.health_percent,
                    "is_alive": self.team_state.member3.is_alive,
                    "is_online": self.team_state.member3.is_online
                }
            }

    # ==================== Game Progress ====================

    def set_game_progress(self, current_act: int = 0, current_chapter: int = 0,
                         current_quest: str = "", difficulty: str = "", world_tier: int = 0):
        """
        Set game progress

        Args:
            current_act: Current act (0-5)
            current_chapter: Current chapter
            current_quest: Current quest name
            difficulty: Difficulty level
            world_tier: World tier (1-4)
        """
        should_notify = False

        with self._lock:
            if (self.game_progress["current_act"] != current_act or
                self.game_progress["current_chapter"] != current_chapter or
                self.game_progress["current_quest"] != current_quest or
                self.game_progress["difficulty"] != difficulty or
                self.game_progress["world_tier"] != world_tier):
                self.game_progress["current_act"] = current_act
                self.game_progress["current_chapter"] = current_chapter
                self.game_progress["current_quest"] = current_quest
                self.game_progress["difficulty"] = difficulty
                self.game_progress["world_tier"] = world_tier
                should_notify = True
                ColorPrint.blue(f"[D4State] Game progress updated: Act {current_act}, WT{world_tier}")

        if should_notify:
            self._notify_callbacks()

    def get_game_progress(self) -> Dict[str, Any]:
        """Get game progress as dictionary"""
        with self._lock:
            return self.game_progress.copy()

    # ==================== Experience Tracking ====================

    def set_experience(self, current_level: int = 0, current_exp: int = 0,
                      exp_to_next_level: int = 0, paragon_level: int = 0):
        """
        Set experience data

        Args:
            current_level: Current character level
            current_exp: Current experience points
            exp_to_next_level: Experience needed for next level
            paragon_level: Paragon level
        """
        should_notify = False
        exp_percent = 0.0

        if exp_to_next_level > 0:
            exp_percent = (current_exp / exp_to_next_level) * 100.0

        with self._lock:
            if (self.experience["current_level"] != current_level or
                self.experience["current_exp"] != current_exp or
                self.experience["paragon_level"] != paragon_level):
                self.experience["current_level"] = current_level
                self.experience["current_exp"] = current_exp
                self.experience["exp_to_next_level"] = exp_to_next_level
                self.experience["exp_percent"] = exp_percent
                self.experience["paragon_level"] = paragon_level
                should_notify = True
                ColorPrint.blue(f"[D4State] Experience updated: Lv.{current_level} ({exp_percent:.1f}%), Paragon {paragon_level}")

        if should_notify:
            self._notify_callbacks()

    def get_experience(self) -> Dict[str, Any]:
        """Get experience data as dictionary"""
        with self._lock:
            return self.experience.copy()

    # ==================== Screenshot State ====================

    def set_last_screenshot(self, path: str, timestamp: float):
        """
        Set last screenshot information

        Args:
            path: Screenshot file path
            timestamp: Screenshot timestamp
        """
        with self._lock:
            self.last_screenshot_path = path
            self.last_screenshot_time = timestamp
            ColorPrint.blue(f"[D4State] Screenshot saved: {path}")

        # Always notify for screenshot updates (needed for UI logging)
        self._notify_callbacks()

    def get_last_screenshot_path(self) -> Optional[str]:
        """Get last screenshot path"""
        with self._lock:
            return self.last_screenshot_path

    # ==================== Complete State ====================

    def get_state_dict(self) -> dict:
        """
        Get complete current state as dictionary

        Returns:
            Dictionary with all current state
        """
        with self._lock:
            return {
                "game_running": self.game_running,
                "window_info": {
                    "detected": self.window_info.detected,
                    "hwnd": self.window_info.hwnd,
                    "title": self.window_info.title,
                    "size": self.window_info.size,
                    "position": self.window_info.position
                },
                "exp_farming_running": self.exp_farming_running,
                "team_state": {
                    "has_team": self.team_state.has_team,
                    "team_size": self.team_state.team_size,
                    "member1": {
                        "name": self.team_state.member1.name,
                        "level": self.team_state.member1.level,
                        "health_percent": self.team_state.member1.health_percent,
                        "is_alive": self.team_state.member1.is_alive,
                        "is_online": self.team_state.member1.is_online
                    },
                    "member2": {
                        "name": self.team_state.member2.name,
                        "level": self.team_state.member2.level,
                        "health_percent": self.team_state.member2.health_percent,
                        "is_alive": self.team_state.member2.is_alive,
                        "is_online": self.team_state.member2.is_online
                    },
                    "member3": {
                        "name": self.team_state.member3.name,
                        "level": self.team_state.member3.level,
                        "health_percent": self.team_state.member3.health_percent,
                        "is_alive": self.team_state.member3.is_alive,
                        "is_online": self.team_state.member3.is_online
                    }
                },
                "game_progress": self.game_progress.copy(),
                "experience": self.experience.copy(),
                "last_screenshot_path": self.last_screenshot_path,
                "last_screenshot_time": self.last_screenshot_time
            }


# Global D4 state instance (singleton)
_d4_state = None
_state_lock = threading.Lock()


def get_d4_state() -> D4State:
    """
    Get global D4 state instance (singleton)

    Returns:
        Global D4State instance
    """
    global _d4_state, _state_lock

    if _d4_state is None:
        with _state_lock:
            if _d4_state is None:
                _d4_state = D4State()
                ColorPrint.green("[Global] D4 state manager initialized")

    return _d4_state


# Example usage
if __name__ == "__main__":
    # Get state instance
    state = get_d4_state()

    # Define callback
    def on_state_change():
        print(f"State changed!")

    # Add callback
    state.add_callback(on_state_change)

    # Test state changes
    state.set_game_running(True)
    state.set_window_info(True, 12345, "Diablo IV", (1920, 1080), (0, 0))
    state.set_exp_farming_running(True)
    state.set_team_state(True, 3)
    state.set_team_member(1, "Player1", 70, 85.5, True, True)
    state.set_game_progress(5, 3, "Final Quest", "Torment VI", 4)
    state.set_experience(70, 15000000, 20000000, 150)
    state.set_last_screenshot("/path/to/screenshot.png", 12345.67)

    print(f"\nCurrent state:")
    import json
    print(json.dumps(state.get_state_dict(), indent=2, ensure_ascii=False))
