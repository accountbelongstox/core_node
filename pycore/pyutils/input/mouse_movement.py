#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Mouse Movement Primitives
Low-level mouse movement helpers (instant / visible / curved / virtual).

Extracted from click_handler.py so the ClickHandler facade can delegate here
instead of carrying movement logic. These primitives hold no state and only
depend on pyautogui + stdlib; ClickHandler forwards move_* calls to this class.
"""

import math
import random
import time
from typing import Tuple

from pycore.pyfoundations.third_party.api import get_third_package_pyautogui
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

pyautogui = get_third_package_pyautogui()


class MouseMovement:
    """Stateless mouse movement primitives used by ClickHandler."""

    def move_mouse_to(self, x: int, y: int, duration: float = 0.0) -> bool:
        """
        Move mouse to specified position

        Note: Includes 100ms delay at method start to prevent consecutive call blocking

        Args:
            x: Target X coordinate
            y: Target Y coordinate
            duration: Movement duration in seconds (0 = instant)

        Returns:
            True if successful, False otherwise
        """
        if x <= 5 and y <= 5:
            ColorPrint.gray("[ClickHandler] Skip moveTo (%s,%s) to avoid PyAutoGUI fail-safe" % (x, y))
            return False
        try:
            pyautogui.moveTo(x, y, duration=duration)
            return True
        except Exception as e:
            ColorPrint.red(f"❌ Error moving mouse to ({x}, {y}): {e}")
            return False

    def get_mouse_position(self) -> Tuple[int, int]:
        """
        Get current mouse position

        Returns:
            Tuple of (x, y) coordinates
        """
        return pyautogui.position()

    def save_mouse_position(self) -> Tuple[int, int]:
        """
        Record current mouse position before a mouse operation

        Returns:
            Tuple of (x, y) coordinates to pass to restore_mouse_position()
        """
        return pyautogui.position()

    def restore_mouse_position(self, position: Tuple[int, int]) -> bool:
        """
        Restore mouse to a position recorded by save_mouse_position() (instant move)

        Args:
            position: (x, y) tuple recorded before the operation; None is ignored

        Returns:
            True if successful, False otherwise
        """
        if not position:
            return False
        try:
            pyautogui.moveTo(position[0], position[1], duration=0)
            return True
        except Exception as e:
            ColorPrint.red(f"[MouseMovement] Error restoring mouse position to {position}: {e}")
            return False

    def move_mouse_visible(self, x: int, y: int, duration: float = 0.5) -> bool:
        """
        Move mouse to specified position with visible trajectory

        Args:
            x: Target X coordinate
            y: Target Y coordinate
            duration: Movement duration in seconds (default 0.5 for visible movement)

        Returns:
            True if successful, False otherwise
        """
        if x <= 5 and y <= 5:
            ColorPrint.gray("[ClickHandler] Skip move_mouse_visible (%s,%s) to avoid PyAutoGUI fail-safe" % (x, y))
            return False
        try:
            pyautogui.moveTo(x, y, duration=duration)
            return True
        except Exception as e:
            ColorPrint.red(f"Error moving mouse to ({x}, {y}): {e}")
            return False

    def move_mouse_curve(self, target_x: int, target_y: int, duration: float = None, curve_type: str = 'bezier') -> bool:
        """
        Move mouse to target position with curved trajectory (human-like)

        Args:
            target_x: Target X coordinate
            target_y: Target Y coordinate
            duration: Movement duration in seconds (default: auto-calculated, 150-200ms)
            curve_type: Type of curve ('bezier', 'arc', 'sine')

        Returns:
            True if successful, False otherwise
        """
        if target_x <= 5 and target_y <= 5:
            ColorPrint.gray("[ClickHandler] Skip move_mouse_curve to (%s,%s) to avoid PyAutoGUI fail-safe" % (target_x, target_y))
            return False
        try:
            start_x, start_y = pyautogui.position()

            # Calculate distance and steps
            distance = math.sqrt((target_x - start_x)**2 + (target_y - start_y)**2)

            # Reduce steps for faster movement - use fewer points
            steps = max(int(distance / 50), 10)  # Fewer steps, min 10

            # Auto-calculate duration if not specified - faster default
            if duration is None:
                # Scale duration with distance: 100-200ms for normal moves
                duration = min(0.1 + (distance / 3000), 0.2)

            points = []

            if curve_type == 'bezier':
                # Bezier curve with random control point for more variation
                offset_range = int(distance * 0.2)  # Proportional to distance
                control_x = (start_x + target_x) / 2 + random.randint(-offset_range, offset_range)
                control_y = (start_y + target_y) / 2 + random.randint(-offset_range, offset_range)

                for i in range(steps + 1):
                    t = i / steps
                    # Quadratic Bezier curve formula
                    x = (1 - t)**2 * start_x + 2 * (1 - t) * t * control_x + t**2 * target_x
                    y = (1 - t)**2 * start_y + 2 * (1 - t) * t * control_y + t**2 * target_y
                    points.append((int(x), int(y)))

            elif curve_type == 'arc':
                # Arc curve
                mid_x = (start_x + target_x) / 2
                mid_y = (start_y + target_y) / 2
                arc_height = distance * 0.2 * random.choice([-1, 1])  # Random arc direction

                for i in range(steps + 1):
                    t = i / steps
                    # Parabolic arc
                    x = start_x + (target_x - start_x) * t
                    arc_offset = 4 * arc_height * t * (1 - t)  # Parabola formula
                    y = start_y + (target_y - start_y) * t + arc_offset
                    points.append((int(x), int(y)))

            elif curve_type == 'sine':
                # Sine wave curve
                frequency = random.uniform(1, 3)
                amplitude = random.randint(5, 20)

                for i in range(steps + 1):
                    t = i / steps
                    x = start_x + (target_x - start_x) * t
                    sine_offset = amplitude * math.sin(frequency * math.pi * t)
                    y = start_y + (target_y - start_y) * t + sine_offset
                    points.append((int(x), int(y)))

            # Execute movement - all points moved within total duration
            # Use tweening for smooth movement across all points at once
            start_time = time.time()
            if points:
                # Calculate time per step to fit within total duration
                time_per_step = duration / len(points)

                # Save original PAUSE setting
                original_pause = pyautogui.PAUSE
                pyautogui.PAUSE = 0  # No pause between moves

                for i, (point_x, point_y) in enumerate(points):
                    pyautogui.moveTo(point_x, point_y, duration=0)  # Instant move to each point
                    # Sleep only enough to maintain timing
                    if i < len(points) - 1:
                        elapsed = time.time() - start_time
                        target_time = (i + 1) * time_per_step
                        sleep_time = max(0, target_time - elapsed)
                        if sleep_time > 0:
                            time.sleep(sleep_time)

                # Restore original PAUSE
                pyautogui.PAUSE = original_pause

            # Ensure we reach exact target
            pyautogui.moveTo(target_x, target_y, duration=0)

            actual_duration = time.time() - start_time
            ColorPrint.gray(f"[ClickHandler] Moved mouse with {curve_type} curve from ({start_x},{start_y}) to ({target_x},{target_y}) in {actual_duration*1000:.0f}ms")
            return True

        except Exception as e:
            ColorPrint.red(f"[ClickHandler] Error moving mouse with curve to ({target_x}, {target_y}): {e}")
            return False

    def move_mouse_virtual(self, x: int, y: int) -> bool:
        """
        Virtual mouse movement (no actual cursor movement, just position update)
        Useful for tracking position without visible movement

        Args:
            x: Target X coordinate
            y: Target Y coordinate

        Returns:
            True if successful, False otherwise
        """
        try:
            # Note: pyautogui doesn't support true virtual movement
            # This is a placeholder that would require win32api for true virtual movement
            # For now, we do instant movement
            current_pos = pyautogui.position()
            pyautogui.moveTo(x, y, duration=0)
            ColorPrint.gray(f"[ClickHandler] Virtual move from {current_pos} to ({x},{y})")
            return True
        except Exception as e:
            ColorPrint.red(f"[ClickHandler] Error in virtual mouse move to ({x}, {y}): {e}")
            return False

    def move_mouse_straight(self, target_x: int, target_y: int, duration: float = 0.2, visible: bool = True) -> bool:
        """
        Move mouse in straight line to target position

        Args:
            target_x: Target X coordinate
            target_y: Target Y coordinate
            duration: Movement duration in seconds
            visible: Whether to show visible movement (True) or instant (False)

        Returns:
            True if successful, False otherwise
        """
        try:
            if visible:
                pyautogui.moveTo(target_x, target_y, duration=duration)
                ColorPrint.gray(f"[ClickHandler] Straight move to ({target_x},{target_y}) in {duration}s")
            else:
                pyautogui.moveTo(target_x, target_y, duration=0)
                ColorPrint.gray(f"[ClickHandler] Instant move to ({target_x},{target_y})")
            return True
        except Exception as e:
            ColorPrint.red(f"[ClickHandler] Error moving mouse straight to ({target_x}, {target_y}): {e}")
            return False
