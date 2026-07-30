#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Click Handler (public facade)
Handles all click-related operations for Battle.net interface.

This is the high-level desktop automation facade after the in-place split:
  - mouse movement primitives  -> pycore.pyutils.input.mouse_movement.MouseMovement
  - Battle.net/Diablo III automation -> pycore.pyutils.input.battlenet_clicker.BattlenetClicker
  - UI-Automation control enumeration -> pycore.pyutils.window.analyzer.WindowAnalyzer
  - window-message clicks (WM_LBUTTONDOWN/UP) -> pycore.pyutils.window.ops.WindowOps.post_message
  - tray icon clicking -> pycore.pyutils.input.tray_clicker.TrayIconClicker

The ClickHandler class keeps its full public method surface (move_*, click,
left_click, right_click, click_at_game_coord, click_element_generic,
find_and_click_*, enumerate_controls_ui_automation, ...) and delegates to the
siblings above, so all existing importers
Callers use ``pycore.pyctl.desktop.click_handler.ClickHandler``.
"""

import time
from datetime import datetime
from typing import List, Dict, Tuple, Optional

from pycore.pyfoundations.third_party.api import get_third_package_pyautogui
from pycore.pyfoundations.third_party.api import get_third_package_uiautomation

from pycore.pyutils.input.tray_clicker import TrayIconClicker


pyautogui = get_third_package_pyautogui()
uiautomation = get_third_package_uiautomation()
auto = uiautomation

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from pycore.pyutils.input.mouse_movement import MouseMovement
from pycore.pyutils.input.battlenet_clicker import BattlenetClicker
from pycore.pyutils.window.analyzer import WindowAnalyzer
from pycore.pyutils.window.ops import (
    WindowOps,
    WM_LBUTTONDOWN,
    WM_LBUTTONUP,
    MK_LBUTTON,
)


class ClickHandler:
    """Handles all click-related operations for Battle.net interface"""

    def __init__(self):
        self.battle_net_window = None
        # Composed helpers (split out of this file).
        self._mouse = MouseMovement()
        self._battlenet = BattlenetClicker(self)
        self._window_analyzer = WindowAnalyzer()
        self._window_ops = WindowOps()
        self._tray_clicker = None  # lazy: tray_clicker -> pywinauto is Windows-only

    # ------------------------------------------------------------------ #
    # Mouse movement (delegated to MouseMovement)
    # ------------------------------------------------------------------ #
    def move_mouse_to(self, x: int, y: int, duration: float = 0.0) -> bool:
        """Move mouse to specified position. See MouseMovement.move_mouse_to."""
        return self._mouse.move_mouse_to(x, y, duration=duration)

    def get_mouse_position(self) -> Tuple[int, int]:
        """Get current mouse position. See MouseMovement.get_mouse_position."""
        return self._mouse.get_mouse_position()

    def move_mouse_visible(self, x: int, y: int, duration: float = 0.5) -> bool:
        """Move mouse with visible trajectory. See MouseMovement.move_mouse_visible."""
        return self._mouse.move_mouse_visible(x, y, duration=duration)

    def move_mouse_curve(self, target_x: int, target_y: int, duration: float = None, curve_type: str = 'bezier') -> bool:
        """Move mouse with curved trajectory. See MouseMovement.move_mouse_curve."""
        return self._mouse.move_mouse_curve(target_x, target_y, duration=duration, curve_type=curve_type)

    def move_mouse_virtual(self, x: int, y: int) -> bool:
        """Virtual mouse movement. See MouseMovement.move_mouse_virtual."""
        return self._mouse.move_mouse_virtual(x, y)

    def move_mouse_straight(self, target_x: int, target_y: int, duration: float = 0.2, visible: bool = True) -> bool:
        """Move mouse in straight line. See MouseMovement.move_mouse_straight."""
        return self._mouse.move_mouse_straight(target_x, target_y, duration=duration, visible=visible)

    # ------------------------------------------------------------------ #
    # Click primitives (live on the facade)
    # ------------------------------------------------------------------ #
    def click(
        self,
        x: int,
        y: int,
        button: str = 'left',
        duration: float = 0.3,
        return_to_original: bool = False,
        direct_click: bool = False,
        pause_after_move: Optional[float] = None,
    ) -> bool:
        """
        Click at specified position (screen coordinates).

        Args:
            x: Target X coordinate (screen).
            y: Target Y coordinate (screen).
            button: Mouse button ('left' or 'right').
            duration: Movement duration in seconds (ignored if direct_click=True).
            return_to_original: If True, move mouse back to position before click after clicking.
            direct_click: If True, move to (x,y) with duration=0 (no visible trajectory), then click.
            pause_after_move: Seconds to sleep after move before click (default 0.05 if direct_click else 0.1).
                             Use a smaller value (e.g. 0.02) from config for faster click.

        Returns:
            True if successful, False otherwise.
        """
        # PyAutoGUI fail-safe: 鼠标移到屏幕左上角会触发 FailSafeException，不执行 (0,0) 或角落坐标的点击
        if x <= 5 and y <= 5:
            ColorPrint.gray("[ClickHandler] Skip click at (%s,%s) to avoid PyAutoGUI fail-safe" % (x, y))
            return False
        try:
            move_duration = 0.0 if direct_click else duration
            pause = pause_after_move if pause_after_move is not None else (0.05 if direct_click else 0.1)
            original_pos = pyautogui.position() if return_to_original else None

            pyautogui.moveTo(x, y, duration=move_duration)
            if pause > 0:
                time.sleep(pause)
            pyautogui.click(x, y, button=button)

            if return_to_original and original_pos is not None:
                pyautogui.moveTo(original_pos[0], original_pos[1], duration=0.0)
            return True
        except Exception as e:
            ColorPrint.red(f"Error clicking at ({x}, {y}) with {button} button: {e}")
            return False

    def left_click(
        self,
        x: int,
        y: int,
        duration: float = 0.3,
        return_to_original: bool = False,
        direct_click: bool = False,
        pause_after_move: Optional[float] = None,
    ) -> bool:
        """Left click at (x,y). See click() for return_to_original, direct_click, pause_after_move."""
        return self.click(
            x, y, button='left', duration=duration,
            return_to_original=return_to_original, direct_click=direct_click,
            pause_after_move=pause_after_move,
        )

    def right_click(
        self,
        x: int,
        y: int,
        duration: float = 0.3,
        return_to_original: bool = False,
        direct_click: bool = False,
        pause_after_move: Optional[float] = None,
    ) -> bool:
        """Right click at (x,y). See click() for return_to_original, direct_click, pause_after_move."""
        return self.click(
            x, y, button='right', duration=duration,
            return_to_original=return_to_original, direct_click=direct_click,
            pause_after_move=pause_after_move,
        )

    def click_at_game_coord(
        self,
        game_x: int,
        game_y: int,
        window_offset: Tuple[int, int],
        return_to_original: bool = False,
        direct_click: bool = True,
        button: str = 'left',
        duration: float = 0.3,
        pause_after_move: Optional[float] = None,
    ) -> bool:
        """
        Click at game-window-relative coordinates by converting to screen coords using current window_offset.
        Use this after resize so callers can pass fresh window_offset from the latest screenshot.

        Args:
            game_x: X relative to game window client area.
            game_y: Y relative to game window client area.
            window_offset: (offset_x, offset_y) of window client area on screen (from current screenshot).
            return_to_original: If True, move mouse back after click.
            direct_click: If True, no movement trajectory (instant move then click).
            button: Mouse button.
            duration: Movement duration when direct_click=False.
            pause_after_move: Seconds to sleep after move before click (see click()).

        Returns:
            True if successful.
        """
        screen_x = window_offset[0] + game_x
        screen_y = window_offset[1] + game_y
        return self.click(
            screen_x, screen_y,
            button=button, duration=duration,
            return_to_original=return_to_original,
            direct_click=direct_click,
            pause_after_move=pause_after_move,
        )

    # ------------------------------------------------------------------ #
    # Tray icon clicking (thin wrapper over TrayIconClicker)
    # ------------------------------------------------------------------ #
    def find_and_click_tray_icon(self, instant: bool = True, interval_after: float = 1.0) -> bool:
        """
        Find and click Battle.net tray icon.

        Delegates to pycore.pyutils.input.tray_clicker.TrayIconClicker.click_tray_icon,
        matching either 'battle' or 'blizzard' tray icons (same intent as the old
        inline implementation). TrayIconClicker performs its own cursor move +
        double-click and restores the cursor, so ``instant`` is accepted for API
        compatibility but has no effect here. ``interval_after`` seconds are slept
        after a successful click (preserving the old default of 1.0s).
        """
        ColorPrint.yellow("🔍 Looking for Battle.net tray icon...")
        try:
            # Lazy import: tray_clicker -> pywinauto is Windows-only; a top-level
            # import would break click_handler import on Linux (matches the old
            # inline impl's runtime-only pywinauto dependency).
            if self._tray_clicker is None:
                self._tray_clicker = TrayIconClicker()
            ok = self._tray_clicker.click_tray_icon("battle")
            if not ok:
                ok = self._tray_clicker.click_tray_icon("blizzard")
            if ok and interval_after > 0:
                time.sleep(interval_after)
            return ok
        except Exception as e:
            ColorPrint.red(f"❌ Error finding/clicking tray icon: {e}")
            return False

    # ------------------------------------------------------------------ #
    # Window-message clicks (delegated to WindowOps.post_message)
    # ------------------------------------------------------------------ #
    def click_element_by_window_message(self, window_handle: int, x: int, y: int) -> bool:
        """
        Click an element by sending window messages directly to the window handle.

        Delegates to WindowOps.post_message (PostMessageW) with WM_LBUTTONDOWN/UP.
        The (x, y) client coordinates are packed into lparam via MAKELONG
        ((y << 16) | (x & 0xFFFF)), matching the original win32api packing.

        Args:
            window_handle: Window handle (HWND)
            x: X coordinate relative to window
            y: Y coordinate relative to window

        Returns:
            True if successful, False otherwise
        """
        try:
            # Pack client coords into lparam (equivalent to win32api.MAKELONG(x, y))
            lparam = (y << 16) | (x & 0xFFFF)
            self._window_ops.post_message(window_handle, WM_LBUTTONDOWN, MK_LBUTTON, lparam)
            time.sleep(0.1)  # Brief pause
            self._window_ops.post_message(window_handle, WM_LBUTTONUP, 0, lparam)

            ColorPrint.green(f"✅ Sent click message to window handle {window_handle} at ({x}, {y})")
            return True

        except Exception as e:
            ColorPrint.red(f"❌ Error sending click message: {e}")
            return False

    def click_element_by_post_message(self, window_handle: int, x: int, y: int) -> bool:
        """
        Click an element by posting window messages to the window handle.

        Delegates to WindowOps.post_message (PostMessageW) with WM_LBUTTONDOWN/UP.
        The (x, y) client coordinates are packed into lparam via MAKELONG
        ((y << 16) | (x & 0xFFFF)), matching the original win32api packing.

        Args:
            window_handle: Window handle (HWND)
            x: X coordinate relative to window
            y: Y coordinate relative to window

        Returns:
            True if successful, False otherwise
        """
        try:
            # Pack client coords into lparam (equivalent to win32api.MAKELONG(x, y))
            lparam = (y << 16) | (x & 0xFFFF)
            self._window_ops.post_message(window_handle, WM_LBUTTONDOWN, MK_LBUTTON, lparam)
            time.sleep(0.1)  # Brief pause
            self._window_ops.post_message(window_handle, WM_LBUTTONUP, 0, lparam)

            ColorPrint.green(f"✅ Posted click message to window handle {window_handle} at ({x}, {y})")
            return True

        except Exception as e:
            ColorPrint.red(f"❌ Error posting click message: {e}")
            return False

    # ------------------------------------------------------------------ #
    # Generic element-click fallback chain (lives on the facade)
    # ------------------------------------------------------------------ #
    def _click_with_pyautogui(self, x: int, y: int) -> bool:
        """Click using PyAutoGUI"""
        try:
            pyautogui.click(x, y)
            return True
        except Exception as e:
            ColorPrint.yellow(f"⚠️  PyAutoGUI click failed: {e}")
            return False

    def _click_with_foreground_activation(self, window, x: int, y: int) -> bool:
        """Click with foreground window activation"""
        try:
            # Activate the window first
            window.activate()
            time.sleep(0.5)  # Wait for window activation

            # Then click using PyAutoGUI
            pyautogui.click(x, y)
            return True
        except Exception as e:
            ColorPrint.yellow(f"⚠️  Foreground activation click failed: {e}")
            return False

    def _click_with_uiautomation(self, control_info: Dict) -> bool:
        """Click using UI Automation"""
        try:
            # Try to get the UI Automation control and click it
            if self.battle_net_window:
                # Find the control by automation ID
                control = self.battle_net_window.FindFirstChild(
                    auto.ControlType.Button,
                    auto.GetCondition().AutomationId(control_info.get('automation_id', ''))
                )
                if control and control.Exists():
                    control.Click()
                    return True
        except Exception as e:
            ColorPrint.yellow(f"⚠️  UI Automation click failed: {e}")
        return False

    def _print_element_click_info(self, control_info: Dict, click_x: int, click_y: int):
        """Print detailed information about the element to be clicked"""
        ColorPrint.white("📋 Element Click Information:")
        ColorPrint.gray(f"   Element Type: {control_info.get('type', 'Unknown')}")
        ColorPrint.gray(f"   Element Name: {control_info.get('name', 'No name')}")
        ColorPrint.gray(f"   Automation ID: {control_info.get('automation_id', 'No ID')}")
        ColorPrint.gray(f"   Class Name: {control_info.get('class_name', 'Unknown')}")

        rect = control_info.get('rect', {})
        if rect:
            ColorPrint.gray(f"   Element Position: Left={rect.get('left', 0)}, Top={rect.get('top', 0)}, Right={rect.get('right', 0)}, Bottom={rect.get('bottom', 0)}")
            ColorPrint.gray(f"   Element Size: Width={rect.get('width', 0)}, Height={rect.get('height', 0)}")

        ColorPrint.gray(f"   Click Coordinates: X={click_x}, Y={click_y}")
        ColorPrint.gray(f"   Is Enabled: {control_info.get('is_enabled', 'Unknown')}")
        ColorPrint.gray(f"   Is Visible: {control_info.get('is_visible', 'Unknown')}")
        ColorPrint.gray(f"   Level: {control_info.get('level', 'Unknown')}")

    def _print_click_success_info(self, control_info: Dict, click_x: int, click_y: int, method_name: str):
        """Print information about successful click"""
        ColorPrint.white("✅ Click Success Information:")
        ColorPrint.green(f"   Click Method: {method_name}")
        ColorPrint.green(f"   Element Type: {control_info.get('type', 'Unknown')}")
        ColorPrint.green(f"   Element Name: {control_info.get('name', 'No name')}")
        ColorPrint.green(f"   Automation ID: {control_info.get('automation_id', 'No ID')}")
        ColorPrint.green(f"   Click Coordinates: X={click_x}, Y={click_y}")

        rect = control_info.get('rect', {})
        if rect:
            ColorPrint.green(f"   Element Position: Left={rect.get('left', 0)}, Top={rect.get('top', 0)}, Right={rect.get('right', 0)}, Bottom={rect.get('bottom', 0)}")
            ColorPrint.green(f"   Element Size: Width={rect.get('width', 0)}, Height={rect.get('height', 0)}")

        ColorPrint.green(f"   Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    def click_element_generic(self, element_info: Dict, window=None) -> bool:
        """
        Generic clicking function that can click images, buttons, and other elements

        Args:
            element_info: Dictionary containing element information
            window: Window object (optional)

        Returns:
            True if successful, False otherwise
        """
        try:
            # Get element position
            rect = element_info.get('rect', {})
            if not rect:
                ColorPrint.red("❌ Could not get element position")
                return False

            # Calculate center position
            center_x = rect['left'] + (rect['right'] - rect['left']) // 2
            center_y = rect['top'] + (rect['bottom'] - rect['top']) // 2

            ColorPrint.green(f"🖱️  Clicking element at position ({center_x}, {center_y})")
            ColorPrint.gray(f"   Element info: {element_info.get('name', 'No name')} - {element_info.get('automation_id', 'No ID')}")

            # Print detailed element information
            self._print_element_click_info(element_info, center_x, center_y)

            # Try multiple clicking methods
            methods = [
                ("Method 1: Background click - Direct window message",
                 lambda: self.click_element_by_window_message(window._hWnd, center_x, center_y) if window else False),
                ("Method 2: Background click - Post window message",
                 lambda: self.click_element_by_post_message(window._hWnd, center_x, center_y) if window else False),
                ("Method 3: Background click - PyAutoGUI",
                 lambda: self._click_with_pyautogui(center_x, center_y)),
                ("Method 4: Foreground click - Activate window then PyAutoGUI",
                 lambda: self._click_with_foreground_activation(window, center_x, center_y) if window else False),
                ("Method 5: UI Automation click",
                 lambda: self._click_with_uiautomation(element_info))
            ]

            success_count = 0
            for i, (method_name, method_func) in enumerate(methods, 1):
                try:
                    ColorPrint.yellow(f"🖱️  Trying Method {i}: {method_name}...")
                    if method_func():
                        ColorPrint.green(f"✅ Method {i} succeeded: {method_name}")
                        # Print click success information
                        self._print_click_success_info(element_info, center_x, center_y, method_name)
                        success_count += 1
                    else:
                        ColorPrint.red(f"❌ Method {i} failed: {method_name}")

                    # Wait 1 second before next attempt (except for the last one)
                    if i < len(methods):
                        ColorPrint.gray(f"   Waiting 1 second before next method...")
                        time.sleep(1)

                except Exception as e:
                    ColorPrint.red(f"❌ Method {i} failed with error: {method_name} - {e}")
                    if i < len(methods):
                        ColorPrint.gray(f"   Waiting 1 second before next method...")
                        time.sleep(1)
                    continue

            if success_count > 0:
                ColorPrint.green(f"✅ Completed all methods. {success_count} method(s) succeeded.")
                return True
            else:
                ColorPrint.red("❌ All clicking methods failed")
                return False

        except Exception as e:
            ColorPrint.red(f"❌ Error in generic click function: {e}")
            return False

    # ------------------------------------------------------------------ #
    # Battle.net / Diablo III automation (delegated to BattlenetClicker)
    # ------------------------------------------------------------------ #
    def find_and_click_diablo3_button(self, window, controls: List[Dict]) -> bool:
        """Find and click the Diablo III button. See BattlenetClicker.find_and_click_diablo3_button."""
        return self._battlenet.find_and_click_diablo3_button(window, controls)

    def find_and_click_play_buttons(self, window, controls: List[Dict]) -> bool:
        """Find and click play buttons. See BattlenetClicker.find_and_click_play_buttons."""
        return self._battlenet.find_and_click_play_buttons(window, controls)

    def refresh_and_click_play_buttons(self, window) -> bool:
        """Refresh window and re-click play buttons. See BattlenetClicker.refresh_and_click_play_buttons."""
        return self._battlenet.refresh_and_click_play_buttons(window)

    # ------------------------------------------------------------------ #
    # UI-Automation control enumeration (delegated to WindowAnalyzer)
    # ------------------------------------------------------------------ #
    def enumerate_controls_ui_automation(self, window) -> List[Dict]:
        """Enumerate all controls using UI Automation.

        Delegates to WindowAnalyzer.enumerate_controls_ui_automation (deleting the
        local duplicate). Preserves the historical side-effect: the old local copy
        set self.battle_net_window = ControlFromHandle(hwnd), which
        _click_with_uiautomation reads. WindowAnalyzer stores the same control as
        its self.target_window, so we mirror it back here.
        """
        controls = self._window_analyzer.enumerate_controls_ui_automation(window)
        # Preserve side-effect consumed by _click_with_uiautomation.
        self.battle_net_window = getattr(self._window_analyzer, "target_window", None)
        return controls


def main():
    """Main function for testing"""
    click_handler = ClickHandler()
    ColorPrint.plain("Click Handler initialized successfully")


if __name__ == "__main__":
    main()
