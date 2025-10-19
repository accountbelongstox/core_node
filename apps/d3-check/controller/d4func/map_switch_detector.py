#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Map Switch Detector for D4
Detects map switching by monitoring the Map Name region for black screen
"""

import sys
from pathlib import Path

# Add project paths
current_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(current_dir))

from providor.common_imports import ColorPrint
from share.game_interface_data import get_d4_interface_data
from d4utils.black_screen_detector import is_black_screen


class MapSwitchDetector:
    """
    Detects map switching in D4 by monitoring the Map Name region

    State Machine:
    1. Normal → Switching (when black screen detected)
    2. Switching → Post-Switch Idle (when black screen clears)
    3. Post-Switch Idle → Normal (when any operation happens)

    The detector monitors the Map Name region each tick:
    - If completely black (±10% tolerance): is_switching_map = True
    - When black clears: is_post_switch_idle = True, increment map_switch_count
    """

    def __init__(self):
        """Initialize map switch detector"""
        self.d4_data = get_d4_interface_data()
        self._previous_is_black = False  # Track previous state to detect transitions

        ColorPrint.green("[MapSwitchDetector] Initialized")

    def detect_map_switch(self) -> bool:
        """
        Detect map switching state by checking Map Name region for black screen

        This should be called every tick with the latest detected_regions data.

        Returns:
            bool: True if detection successful, False otherwise
        """
        try:
            # Check if we have region images available
            if not hasattr(self.d4_data, 'detected_regions') or self.d4_data.detected_regions is None:
                return False

            if 'region_images' not in self.d4_data.detected_regions:
                return False

            region_images = self.d4_data.detected_regions['region_images']

            # Get Map Name region image
            if 'Map Name' not in region_images:
                ColorPrint.yellow("[MapSwitchDetector] Map Name region not found in detected_regions")
                return False

            map_name_image = region_images['Map Name']

            if map_name_image is None:
                ColorPrint.yellow("[MapSwitchDetector] Map Name region image is None")
                return False

            # Check if the Map Name region is black
            is_currently_black = is_black_screen(map_name_image)

            # State machine transitions
            if is_currently_black and not self._previous_is_black:
                # Transition: Normal → Switching (black screen just appeared)
                self.d4_data.is_switching_map = True
                self.d4_data.is_post_switch_idle = False
                ColorPrint.blue("[MapSwitchDetector] 🗺️  Map switching started (black screen detected)")

            elif not is_currently_black and self._previous_is_black:
                # Transition: Switching → Post-Switch Idle (black screen just cleared)
                self.d4_data.is_switching_map = False
                self.d4_data.is_post_switch_idle = True
                self.d4_data.map_switch_count += 1
                ColorPrint.green(f"[MapSwitchDetector] ✅ Map switch completed (count: {self.d4_data.map_switch_count})")
                
                # Trigger map name recognition when switching to post-switch idle
                self._trigger_map_name_recognition()

            elif is_currently_black:
                # Still switching (black screen persists)
                # Keep is_switching_map = True
                pass

            else:
                # Not black and wasn't black before
                # Keep current state (either Normal or Post-Switch Idle)
                pass

            # Update previous state for next tick
            self._previous_is_black = is_currently_black

            return True

        except Exception as e:
            ColorPrint.red(f"[MapSwitchDetector] Error detecting map switch: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _trigger_map_name_recognition(self):
        """
        Trigger map name recognition when switching to post-switch idle state
        """
        try:
            from .map_name_recognizer import get_map_name_recognizer
            
            # Get map name recognizer and attempt recognition
            map_recognizer = get_map_name_recognizer()
            recognition_success = map_recognizer.recognize_map_name()
            
            if recognition_success:
                ColorPrint.blue("[MapSwitchDetector] Map name recognition triggered successfully")
            else:
                ColorPrint.yellow("[MapSwitchDetector] Map name recognition not triggered or failed")
                
        except Exception as e:
            ColorPrint.red(f"[MapSwitchDetector] Error triggering map name recognition: {e}")

    def reset_post_switch_idle(self):
        """
        Reset post-switch idle state (called when user performs an action)

        Transition: Post-Switch Idle → Normal
        """
        if self.d4_data.is_post_switch_idle:
            self.d4_data.is_post_switch_idle = False
            ColorPrint.blue("[MapSwitchDetector] Post-switch idle cleared (user action detected)")

    def get_map_switch_stats(self) -> dict:
        """
        Get current map switching statistics

        Returns:
            Dictionary with stats:
            {
                'is_switching': bool,
                'is_post_switch_idle': bool,
                'switch_count': int
            }
        """
        return {
            'is_switching': self.d4_data.is_switching_map,
            'is_post_switch_idle': self.d4_data.is_post_switch_idle,
            'switch_count': self.d4_data.map_switch_count
        }


# Global singleton instance
_map_switch_detector = None


def get_map_switch_detector() -> MapSwitchDetector:
    """
    Get global map switch detector instance (singleton)

    Returns:
        Global MapSwitchDetector instance
    """
    global _map_switch_detector

    if _map_switch_detector is None:
        _map_switch_detector = MapSwitchDetector()
        ColorPrint.green("[Global] Map switch detector initialized")

    return _map_switch_detector
