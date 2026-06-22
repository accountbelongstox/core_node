#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
State-Aware Click Handler
Wrapper for ClickHandler that checks execution state before each action
"""

import os
import sys
from typing import Optional, Tuple

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.color_print import ColorPrint
from d3utils.click_handler_singleton import get_click_handler
from providor.providor_index import should_stop_assistant

class StateAwareClickHandler:
    """
    Click handler with execution state awareness

    Wraps all ClickHandler methods and checks execution state before each action.
    If should_stop is True, actions are aborted and False is returned.

    This allows clean interruption of mouse automation sequences.
    """

    def __init__(self):
        """Initialize state-aware click handler"""
        self.click_handler = get_click_handler()

    def _check_state(self, action_name: str) -> bool:
        """
        Check if execution should continue

        Args:
            action_name: Name of the action being performed

        Returns:
            True if should continue, False if should stop
        """
        if should_stop_assistant():
            ColorPrint.yellow(f"[StateClick] Execution interrupted before {action_name}")
            return False
        return True

    def click(
        self,
        x: int,
        y: int,
        button: str = 'left',
        duration: float = 0.1,
        return_to_original: bool = False,
        direct_click: bool = False,
        pause_after_move: Optional[float] = None,
    ) -> bool:
        """Click at position with state check. Pass return_to_original/direct_click/pause_after_move to inner ClickHandler."""
        if not self._check_state(f"click at ({x}, {y})"):
            return False
        return self.click_handler.click(
            x, y, button=button, duration=duration,
            return_to_original=return_to_original,
            direct_click=direct_click,
            pause_after_move=pause_after_move,
        )

    def left_click(
        self,
        x: int,
        y: int,
        duration: float = 0.1,
        return_to_original: bool = False,
        direct_click: bool = False,
        pause_after_move: Optional[float] = None,
    ) -> bool:
        """Left click with state check."""
        if not self._check_state(f"left click at ({x}, {y})"):
            return False
        return self.click_handler.left_click(
            x, y, duration=duration,
            return_to_original=return_to_original,
            direct_click=direct_click,
            pause_after_move=pause_after_move,
        )

    def right_click(
        self,
        x: int,
        y: int,
        duration: float = 0.1,
        return_to_original: bool = False,
        direct_click: bool = False,
        pause_after_move: Optional[float] = None,
    ) -> bool:
        """Right click with state check."""
        if not self._check_state(f"right click at ({x}, {y})"):
            return False
        return self.click_handler.right_click(
            x, y, duration=duration,
            return_to_original=return_to_original,
            direct_click=direct_click,
            pause_after_move=pause_after_move,
        )

    def double_click(self, x: int, y: int, duration: float = 0.1) -> bool:
        """
        Double click with state check

        Args:
            x: X coordinate
            y: Y coordinate
            duration: Click duration

        Returns:
            True if clicked successfully, False if interrupted or failed
        """
        if not self._check_state(f"double click at ({x}, {y})"):
            return False

        return self.click_handler.double_click(x, y, duration)

    def move_mouse(self, x: int, y: int, duration: float = 0.2) -> bool:
        """
        Move mouse with state check

        Args:
            x: Target X coordinate
            y: Target Y coordinate
            duration: Movement duration

        Returns:
            True if moved successfully, False if interrupted or failed
        """
        if not self._check_state(f"move mouse to ({x}, {y})"):
            return False

        return self.click_handler.move_mouse_to(x, y, duration)

    def move_mouse_curve(self, x: int, y: int, curve_type: str = 'bezier', duration: Optional[float] = None) -> bool:
        """
        Move mouse in a curve with state check

        Args:
            x: Target X coordinate
            y: Target Y coordinate
            curve_type: Type of curve ('bezier', 'sine', 'quadratic')
            duration: Movement duration (auto-calculated if None)

        Returns:
            True if moved successfully, False if interrupted or failed
        """
        if not self._check_state(f"move mouse curve to ({x}, {y})"):
            return False

        return self.click_handler.move_mouse_curve(x, y, curve_type, duration)

    def drag(self, start_x: int, start_y: int, end_x: int, end_y: int, duration: float = 0.5) -> bool:
        """
        Drag from start to end with state check

        Args:
            start_x: Start X coordinate
            start_y: Start Y coordinate
            end_x: End X coordinate
            end_y: End Y coordinate
            duration: Drag duration

        Returns:
            True if dragged successfully, False if interrupted or failed
        """
        if not self._check_state(f"drag from ({start_x}, {start_y}) to ({end_x}, {end_y})"):
            return False

        return self.click_handler.drag(start_x, start_y, end_x, end_y, duration)

    def get_mouse_position(self) -> Tuple[int, int]:
        """
        Get current mouse position (no state check needed for read operation)

        Returns:
            Tuple of (x, y) coordinates
        """
        return self.click_handler.get_mouse_position()

# Singleton instance
_state_aware_click_handler_instance: Optional[StateAwareClickHandler] = None

def get_state_aware_click_handler() -> StateAwareClickHandler:
    """Get singleton state-aware click handler instance"""
    global _state_aware_click_handler_instance
    if _state_aware_click_handler_instance is None:
        _state_aware_click_handler_instance = StateAwareClickHandler()
    return _state_aware_click_handler_instance
