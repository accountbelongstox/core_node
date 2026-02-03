#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Operation Base Class
Base class for all D4 mouse/keyboard operations, integrates with share data
"""

import sys
import time
import random
from pathlib import Path
from typing import Optional, Tuple
from abc import ABC, abstractmethod
import pyautogui

from share.project_path import ensure_d3_check_in_sys_path, get_project_root
ensure_d3_check_in_sys_path()

# Add pycore path
pycore_path = get_project_root().parent / "pycore"
sys.path.insert(0, str(pycore_path))

from pycore.pyutils.click_handler import ClickHandler
from pycore.pyfoundations.color_print import ColorPrint
from share.game_interface_data import get_d4_interface_data
from share.coordinate_helper import (
    calculate_screen_coordinate,
    calculate_random_point_in_region,
    get_title_bar_random_point,
    calculate_random_delay
    # debug_show_title_bar_range - removed, use only for debugging
)


class D4OperationBase(ABC):
    """
    Base class for all D4 operations

    Provides:
    - Access to shared data (d4_data)
    - Access to pycore ClickHandler
    - Window activation logic (title bar click for windowed mode)
    - Common utility methods
    """

    def __init__(self):
        """Initialize D4 operation base"""
        self.d4_data = get_d4_interface_data()
        self.click_handler = ClickHandler()
        self._window_activated = False

    def _ensure_window_active(self) -> bool:
        """
        Ensure game window is active (for windowed mode only)

        In windowed mode, clicks title bar once per operation.
        In fullscreen mode, skips activation.

        Returns:
            bool: True if window is active
        """
        ColorPrint.blue(f"[D4Operation] _ensure_window_active called, _window_activated={self._window_activated}")

        if self._window_activated:
            ColorPrint.blue("[D4Operation] Window already activated, skipping")
            return True

        is_windowed = self.d4_data.is_windowed_mode()
        ColorPrint.blue(f"[D4Operation] is_windowed_mode={is_windowed}")
        ColorPrint.blue(f"[D4Operation] fullscreen_size={self.d4_data.fullscreen_size}, game_window_size={self.d4_data.game_window_size}")

        if is_windowed:
            ColorPrint.blue("[D4Operation] Windowed mode detected, will click title bar")
            # Click title bar to activate window
            if self._click_title_bar():
                self._window_activated = True
                time.sleep(0.05)  # Brief delay for window activation
                ColorPrint.blue("[D4Operation] Window activated")
                return True
            else:
                ColorPrint.yellow("[D4Operation] Failed to activate window, continuing anyway")
                return False
        else:
            # Fullscreen mode - no activation needed
            ColorPrint.blue("[D4Operation] Fullscreen mode detected, no activation needed")
            self._window_activated = True
            return True

    def _click_title_bar(self) -> bool:
        """
        Click random position in title bar to activate window

        Returns:
            bool: True if successful
        """
        try:
            # Get random point in title bar (screen coordinates)
            screen_point = get_title_bar_random_point()

            if screen_point is None:
                ColorPrint.yellow("[D4Operation] No window size available for title bar click")
                return False

            screen_x, screen_y = screen_point
            ColorPrint.blue(f"[D4Operation] Clicking title bar at screen ({screen_x}, {screen_y})")

            # Click title bar instantly
            pyautogui.click(screen_x, screen_y)
            ColorPrint.green(f"[D4Operation] ✓ Title bar clicked successfully")
            return True

        except Exception as e:
            ColorPrint.red(f"[D4Operation] Error clicking title bar: {e}")
            return False

    def _click_point(
        self,
        point: Tuple[int, int],
        button: str = 'left',
        duration: Optional[float] = None,
        use_standard_resolution: bool = True
    ) -> bool:
        """
        Click at a specific point

        Args:
            point: Point in game coordinates (standard or actual resolution)
            button: Mouse button ('left' or 'right')
            duration: Movement duration in seconds (None = random 100-500ms)
            use_standard_resolution: True if point is in standard resolution

        Returns:
            bool: True if successful
        """
        try:
            # Calculate screen coordinate
            screen_x, screen_y = calculate_screen_coordinate(point, use_standard_resolution)

            # Use random duration if not specified
            if duration is None:
                duration = calculate_random_delay()

            ColorPrint.gray(f"[D4Operation] Clicking point at screen ({screen_x}, {screen_y})")

            return self.click_handler.click(screen_x, screen_y, button=button, duration=duration)

        except Exception as e:
            ColorPrint.red(f"[D4Operation] Error clicking point {point}: {e}")
            return False

    def _click_region(
        self,
        region_start: Tuple[int, int],
        region_end: Tuple[int, int],
        button: str = 'left',
        duration: Optional[float] = None,
        use_standard_resolution: bool = True,
        margin: int = 5
    ) -> bool:
        """
        Click at random position within a region

        Args:
            region_start: Region top-left corner (game coordinate)
            region_end: Region bottom-right corner (game coordinate)
            button: Mouse button ('left' or 'right')
            duration: Movement duration in seconds (None = random 100-500ms)
            use_standard_resolution: True if coords are in standard resolution
            margin: Margin from region edges in pixels

        Returns:
            bool: True if successful
        """
        try:
            # Calculate random screen coordinate in region
            screen_x, screen_y = calculate_random_point_in_region(
                region_start,
                region_end,
                use_standard_resolution,
                margin
            )

            # Use random duration if not specified
            if duration is None:
                duration = calculate_random_delay()

            ColorPrint.gray(f"[D4Operation] Clicking region at random screen ({screen_x}, {screen_y})")

            return self.click_handler.click(screen_x, screen_y, button=button, duration=duration)

        except Exception as e:
            ColorPrint.red(f"[D4Operation] Error clicking region {region_start}-{region_end}: {e}")
            return False

    def _move_to(self, x: int, y: int, duration: float = 0.2) -> bool:
        """
        Internal move method

        Args:
            x: Target X coordinate
            y: Target Y coordinate
            duration: Movement duration in seconds

        Returns:
            bool: True if successful
        """
        try:
            return self.click_handler.move_mouse_to(x, y, duration=duration)
        except Exception as e:
            ColorPrint.red(f"[D4Operation] Error moving to ({x}, {y}): {e}")
            return False

    def _press_key(self, key: str, delay: float = 0.1) -> bool:
        """
        Internal key press method

        Args:
            key: Key to press (e.g., 'o', 'enter', 'esc')
            delay: Delay after key press in seconds

        Returns:
            bool: True if successful
        """
        try:
            ColorPrint.blue(f"[D4Operation] Pressing key: '{key}'")
            pyautogui.press(key)

            if delay > 0:
                time.sleep(delay)

            return True

        except Exception as e:
            ColorPrint.red(f"[D4Operation] Error pressing key '{key}': {e}")
            return False

    def _wait(self, seconds: float):
        """
        Wait for specified seconds

        Args:
            seconds: Seconds to wait
        """
        ColorPrint.gray(f"[D4Operation] Waiting {seconds}s")
        time.sleep(seconds)

    def _wait_for_next_tick(self):
        """
        Wait for next D4 controller tick

        Uses the tick interval from shared data
        """
        tick_interval = getattr(self.d4_data, 'tick_interval', 0.1)
        self._wait(tick_interval)
        ColorPrint.gray(f"[D4Operation] Waited for next tick ({tick_interval}s)")

    @abstractmethod
    def execute(self) -> bool:
        """
        Execute the operation

        Must be implemented by subclasses.

        Returns:
            bool: True if operation succeeded
        """
        pass

    def run(self) -> bool:
        """
        Run the operation

        Ensures window is active before executing.

        Returns:
            bool: True if operation succeeded
        """
        try:
            # Ensure window is active (only once per operation)
            if not self._ensure_window_active():
                ColorPrint.yellow("[D4Operation] Window activation failed, attempting operation anyway")

            # Execute the operation
            result = self.execute()

            # Reset activation flag for next operation
            self._window_activated = False

            return result

        except Exception as e:
            ColorPrint.red(f"[D4Operation] Error running operation: {e}")
            import traceback
            traceback.print_exc()
            return False

    # ============================================================================
    # Extended Methods for Auto Team Formation
    # ============================================================================

    def _get_region_info(self, region_name: str) -> Optional[dict]:
        """
        Get region information from detected_regions

        Args:
            region_name: Region name (e.g., "Find Team")

        Returns:
            dict with 'coords' or None if not found
        """
        if not hasattr(self.d4_data, 'detected_regions') or not self.d4_data.detected_regions:
            ColorPrint.yellow(f"[D4Operation] No detected_regions available")
            return None

        if 'region_coords' not in self.d4_data.detected_regions:
            ColorPrint.yellow(f"[D4Operation] No region_coords in detected_regions")
            return None

        region_coords = self.d4_data.detected_regions['region_coords']
        if region_name not in region_coords:
            ColorPrint.yellow(f"[D4Operation] Region '{region_name}' not found")
            return None

        return {'coords': region_coords[region_name]}

    def click_region_center_random(
        self,
        region_name: str,
        margin: int = 5,
        delay_ms: Tuple[int, int] = (100, 300)
    ) -> bool:
        """
        Click random position near region center

        Args:
            region_name: Region name from detected_regions
            margin: Random offset range in pixels
            delay_ms: Delay range in milliseconds (min, max)

        Returns:
            bool: True if successful
        """
        try:
            # Get region info
            region_info = self._get_region_info(region_name)
            if not region_info:
                return False

            coords = region_info['coords']
            x1, y1, x2, y2 = coords

            # Calculate center
            center_x = (x1 + x2) // 2
            center_y = (y1 + y2) // 2

            # Add random offset
            offset_x = random.randint(-margin, margin)
            offset_y = random.randint(-margin, margin)

            target_x = center_x + offset_x
            target_y = center_y + offset_y

            ColorPrint.blue(f"[D4Operation] Clicking region '{region_name}' at ({target_x}, {target_y})")

            # Click
            point = (target_x, target_y)
            if not self._click_point(point, use_standard_resolution=False):
                return False

            # Random delay
            delay_seconds = random.uniform(delay_ms[0], delay_ms[1]) / 1000.0
            time.sleep(delay_seconds)

            ColorPrint.green(f"[D4Operation] ✓ Region clicked")
            return True

        except Exception as e:
            ColorPrint.red(f"[D4Operation] Error clicking region '{region_name}': {e}")
            return False

    def type_text(
        self,
        text: str,
        char_delay_ms: Tuple[int, int] = (50, 100)
    ) -> bool:
        """
        Type text character by character with random delay

        Args:
            text: Text to type
            char_delay_ms: Delay range between characters (ms)

        Returns:
            bool: True if successful
        """
        try:
            ColorPrint.blue(f"[D4Operation] Typing text: '{text}'")

            for char in text:
                pyautogui.write(char)
                delay_seconds = random.uniform(char_delay_ms[0], char_delay_ms[1]) / 1000.0
                time.sleep(delay_seconds)

            ColorPrint.green(f"[D4Operation] ✓ Text typed")
            return True

        except Exception as e:
            ColorPrint.red(f"[D4Operation] Error typing text: {e}")
            return False

    def type_number(
        self,
        number: int,
        char_delay_ms: Tuple[int, int] = (50, 100)
    ) -> bool:
        """
        Type number

        Args:
            number: Number to type
            char_delay_ms: Delay range between characters (ms)

        Returns:
            bool: True if successful
        """
        return self.type_text(str(number), char_delay_ms)

    def calculate_region_row_point(
        self,
        region_name: str,
        total_rows: int,
        target_row: int,
        random_offset: int = 5
    ) -> Optional[Tuple[int, int]]:
        """
        Calculate click point for a specific row in a region

        Args:
            region_name: Region name
            total_rows: Total number of rows in region
            target_row: Target row number (1-based)
            random_offset: Random offset in pixels

        Returns:
            (x, y) coordinate or None
        """
        try:
            # Get region info
            region_info = self._get_region_info(region_name)
            if not region_info:
                return None

            coords = region_info['coords']
            x1, y1, x2, y2 = coords

            # Calculate row height
            region_height = y2 - y1
            row_height = region_height / total_rows

            # Calculate target row center Y coordinate
            # Row 1 is at the top, so: y = y1 + (row_number - 0.5) * row_height
            target_y = y1 + (target_row - 0.5) * row_height

            # Calculate center X
            center_x = (x1 + x2) // 2

            # Add random offset
            offset_x = random.randint(-random_offset, random_offset)
            offset_y = random.randint(-random_offset, random_offset)

            result_x = int(center_x + offset_x)
            result_y = int(target_y + offset_y)

            ColorPrint.blue(f"[D4Operation] Calculated row {target_row}/{total_rows} point: ({result_x}, {result_y})")
            return (result_x, result_y)

        except Exception as e:
            ColorPrint.red(f"[D4Operation] Error calculating row point: {e}")
            return None
