#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Click Handler
Handles all click-related operations for Battle.net interface
"""

import os
import sys
import time
import subprocess
import random
import math
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from pathlib import Path

from pycore.pyfoundations.third_party import get_third_package_psutil, get_third_package_win32gui, get_third_package_win32con, get_third_package_win32api, get_third_package_PIL, get_third_package_pyautogui, get_third_package_pygetwindow, get_third_package_uiautomation

psutil = get_third_package_psutil()
win32gui = get_third_package_win32gui()
win32con = get_third_package_win32con()
win32api = get_third_package_win32api()
PIL = get_third_package_PIL()
pyautogui = get_third_package_pyautogui()
pygetwindow = get_third_package_pygetwindow()
uiautomation = get_third_package_uiautomation()
import win32process

Image = PIL.Image
ImageDraw = PIL.ImageDraw
ImageFont = PIL.ImageFont
gw = pygetwindow
auto = uiautomation

from pyfoundations.color_print import ColorPrint


class ClickHandler:
    """Handles all click-related operations for Battle.net interface"""

    def __init__(self):
        self.battle_net_window = None

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
            if points:
                # Calculate time per step to fit within total duration
                time_per_step = duration / len(points)

                # Save original PAUSE setting
                original_pause = pyautogui.PAUSE
                pyautogui.PAUSE = 0  # No pause between moves

                start_time = time.time()
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

    def click(self, x: int, y: int, button: str = 'left', duration: float = 0.3) -> bool:
        """
        Click at specified position with visible mouse movement

        Args:
            x: Target X coordinate
            y: Target Y coordinate
            button: Mouse button ('left' or 'right')
            duration: Movement duration in seconds

        Returns:
            True if successful, False otherwise
        """
        try:
            # Move mouse to position
            pyautogui.moveTo(x, y, duration=duration)
            time.sleep(0.1)

            # Click with specified button
            pyautogui.click(x, y, button=button)
            return True
        except Exception as e:
            ColorPrint.red(f"Error clicking at ({x}, {y}) with {button} button: {e}")
            return False

    def left_click(self, x: int, y: int, duration: float = 0.3) -> bool:
        """
        Left click at specified position with visible mouse movement

        Args:
            x: Target X coordinate
            y: Target Y coordinate
            duration: Movement duration in seconds

        Returns:
            True if successful, False otherwise
        """
        try:
            # Move mouse to position
            pyautogui.moveTo(x, y, duration=duration)
            time.sleep(0.1)

            # Left click
            pyautogui.click(x, y, button='left')
            return True
        except Exception as e:
            ColorPrint.red(f"Error left clicking at ({x}, {y}): {e}")
            return False

    def right_click(self, x: int, y: int, duration: float = 0.3) -> bool:
        """
        Right click at specified position with visible mouse movement

        Args:
            x: Target X coordinate
            y: Target Y coordinate
            duration: Movement duration in seconds

        Returns:
            True if successful, False otherwise
        """
        try:
            # Move mouse to position
            pyautogui.moveTo(x, y, duration=duration)
            time.sleep(0.1)

            # Right click
            pyautogui.click(x, y, button='right')
            return True
        except Exception as e:
            ColorPrint.red(f"Error right clicking at ({x}, {y}): {e}")
            return False

    def find_and_click_tray_icon(self) -> bool:
        """Find and click Battle.net tray icon"""
        ColorPrint.yellow("🔍 Looking for Battle.net tray icon...")
        
        try:
            # Find system tray area
            tray_hwnd = None
            def enum_windows_callback(hwnd, lparam):
                nonlocal tray_hwnd
                if win32gui.IsWindowVisible(hwnd):
                    class_name = win32gui.GetClassName(hwnd)
                    if class_name in ["Shell_TrayWnd", "TrayNotifyWnd", "NotifyIconOverflowWindow"]:
                        tray_hwnd = hwnd
                        return False  # Stop enumeration
                return True
            
            win32gui.EnumWindows(enum_windows_callback, None)
            
            if not tray_hwnd:
                ColorPrint.yellow("⚠️  Could not find system tray area")
                return False
            
            # Get tray area position
            tray_rect = win32gui.GetWindowRect(tray_hwnd)
            ColorPrint.gray(f"   Tray area position: {tray_rect}")
            
            # Look for Battle.net icon in tray area
            battle_net_icon_pos = None
            
            def enum_child_windows_callback(hwnd, lparam):
                nonlocal battle_net_icon_pos
                try:
                    if win32gui.IsWindowVisible(hwnd):
                        class_name = win32gui.GetClassName(hwnd)
                        title = win32gui.GetWindowText(hwnd)
                        rect = win32gui.GetWindowRect(hwnd)
                        
                        # Check if this might be Battle.net related
                        if ('battle' in title.lower() or 'battle' in class_name.lower() or 
                            'blizzard' in title.lower() or 'blizzard' in class_name.lower()):
                            battle_net_icon_pos = rect
                            ColorPrint.green(f"✅ Found potential Battle.net tray icon: {title}")
                            return False  # Stop enumeration
                except Exception as e:
                    ColorPrint.yellow(f"⚠️  Error checking child window: {e}")
                return True
            
            win32gui.EnumChildWindows(tray_hwnd, enum_child_windows_callback, None)
            
            if battle_net_icon_pos:
                # Calculate center position of the icon
                center_x = (battle_net_icon_pos[0] + battle_net_icon_pos[2]) // 2
                center_y = (battle_net_icon_pos[1] + battle_net_icon_pos[3]) // 2
                
                ColorPrint.green(f"🖱️  Clicking Battle.net tray icon at ({center_x}, {center_y})")
                pyautogui.click(center_x, center_y)
                time.sleep(3)  # Wait for window to appear
                return True
            else:
                ColorPrint.yellow("⚠️  Battle.net tray icon not found")
                return False
                
        except Exception as e:
            ColorPrint.red(f"❌ Error finding/clicking tray icon: {e}")
            return False
    
    def click_element_by_window_message(self, window_handle: int, x: int, y: int) -> bool:
        """
        Click an element by sending window messages directly to the window handle
        
        Args:
            window_handle: Window handle (HWND)
            x: X coordinate relative to window
            y: Y coordinate relative to window
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Convert screen coordinates to client coordinates
            client_x = win32api.MAKELONG(x, y)
            
            # Send mouse down message
            win32api.SendMessage(window_handle, win32con.WM_LBUTTONDOWN, win32con.MK_LBUTTON, client_x)
            time.sleep(0.1)  # Brief pause
            
            # Send mouse up message
            win32api.SendMessage(window_handle, win32con.WM_LBUTTONUP, 0, client_x)
            
            ColorPrint.green(f"✅ Sent click message to window handle {window_handle} at ({x}, {y})")
            return True
            
        except Exception as e:
            ColorPrint.red(f"❌ Error sending click message: {e}")
            return False
    
    def click_element_by_post_message(self, window_handle: int, x: int, y: int) -> bool:
        """
        Click an element by posting window messages to the window handle
        
        Args:
            window_handle: Window handle (HWND)
            x: X coordinate relative to window
            y: Y coordinate relative to window
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Convert screen coordinates to client coordinates
            client_x = win32api.MAKELONG(x, y)
            
            # Post mouse down message
            win32api.PostMessage(window_handle, win32con.WM_LBUTTONDOWN, win32con.MK_LBUTTON, client_x)
            time.sleep(0.1)  # Brief pause
            
            # Post mouse up message
            win32api.PostMessage(window_handle, win32con.WM_LBUTTONUP, 0, client_x)
            
            ColorPrint.green(f"✅ Posted click message to window handle {window_handle} at ({x}, {y})")
            return True
            
        except Exception as e:
            ColorPrint.red(f"❌ Error posting click message: {e}")
            return False
    
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
    
    def find_and_click_diablo3_button(self, window, controls: List[Dict]) -> bool:
        """
        Find and click the Diablo III button using multiple methods
        
        Args:
            window: Battle.net window object
            controls: List of UI controls
            
        Returns:
            True if successful, False otherwise
        """
        ColorPrint.yellow("🎮 Looking for Diablo III button to click...")
        
        # Find the Diablo III button with automation_id "game-nav-btn-D3"
        diablo3_button = None
        diablo3_button_index = -1
        for i, control in enumerate(controls):
            if control.get('automation_id') == 'game-nav-btn-D3':
                diablo3_button = control
                diablo3_button_index = i
                ColorPrint.green(f"✅ Found Diablo III button: {control.get('name', 'No name')}")
                break
        
        if not diablo3_button:
            ColorPrint.yellow("⚠️  Diablo III button not found with automation_id 'game-nav-btn-D3'")
            ColorPrint.yellow("🔍 Searching for alternative Diablo III buttons...")
            
            # Try to find by name or other properties
            for i, control in enumerate(controls):
                name = control.get('name', '') or ''
                automation_id = control.get('automation_id', '') or ''
                value = control.get('value', '') or ''
                
                name = name.lower()
                automation_id = automation_id.lower()
                value = value.lower()
                
                if any(keyword in name or keyword in automation_id or keyword in value 
                       for keyword in ['diablo', 'd3']):
                    diablo3_button = control
                    diablo3_button_index = i
                    ColorPrint.green(f"✅ Found alternative Diablo III button: {control.get('name', 'No name')}")
                    break
        
        if not diablo3_button:
            ColorPrint.red("❌ Could not find Diablo III button")
            ColorPrint.yellow("📋 Available buttons/controls:")
            for i, control in enumerate(controls[:20]):  # Show first 20 controls
                if 'type' in control:
                    ColorPrint.gray(f"   {i}: {control.get('type', 'Unknown')} - {control.get('name', 'No name')} (ID: {control.get('automation_id', 'No ID')})")
                else:
                    ColorPrint.gray(f"   {i}: {control.get('class_name', 'Unknown')} - {control.get('title', 'No title')}")
            return False
        
        # Find the first ImageControl after the Diablo III button
        target_image_control = None
        if diablo3_button_index >= 0:
            ColorPrint.yellow("🔍 Looking for first ImageControl after Diablo III button...")
            for i in range(diablo3_button_index + 1, len(controls)):
                control = controls[i]
                if control.get('type') == 'ImageControl':
                    target_image_control = control
                    ColorPrint.green(f"✅ Found target ImageControl: {control.get('name', 'No name')} (ID: {control.get('automation_id', 'No ID')})")
                    break
        
        if not target_image_control:
            ColorPrint.yellow("⚠️  No imageControl found after Diablo III button, using button position")
            target_image_control = diablo3_button
        
        # Get target position
        rect = target_image_control.get('rect', {})
        if not rect:
            ColorPrint.red("❌ Could not get target position")
            return False
        
        # Calculate center position of the target
        center_x = rect['left'] + (rect['right'] - rect['left']) // 2
        center_y = rect['top'] + (rect['bottom'] - rect['top']) // 2
        
        ColorPrint.green(f"🖱️  Target position: ({center_x}, {center_y})")
        ColorPrint.gray(f"   Target info: {target_image_control.get('name', 'No name')} - {target_image_control.get('automation_id', 'No ID')}")
        
        # Use the generic click function
        return self.click_element_generic(target_image_control, window)
    
    def find_and_click_play_buttons(self, window, controls: List[Dict]) -> bool:
        """
        Find and click play buttons (called after first click)
        
        Args:
            window: Battle.net window object
            controls: UI controls list
            
        Returns:
            True if successful, False otherwise
        """
        ColorPrint.yellow("🎮 Looking for play buttons to click...")
        
        # Find play buttons using automation IDs array
        play_buttons = []
        for control in controls:
            automation_id = control.get('automation_id', '')
            if automation_id in PLAY_BUTTON_AUTOMATION_IDS:
                play_buttons.append(control)
                ColorPrint.green(f"✅ Found play button: {control.get('name', 'No name')} (ID: {automation_id})")
        
        if not play_buttons:
            ColorPrint.yellow(f"⚠️  No play buttons found with automation_ids: {PLAY_BUTTON_AUTOMATION_IDS}")
            return False
        
        # Click found play buttons
        success_count = 0
        for i, button in enumerate(play_buttons):
            ColorPrint.yellow(f"🖱️  Clicking play button {i+1}/{len(play_buttons)}...")
            if self.click_element_generic(button, window):
                success_count += 1
                time.sleep(1)  # Wait 1 second after click
        
        if success_count > 0:
            ColorPrint.green(f"✅ Successfully clicked {success_count}/{len(play_buttons)} play buttons")
            return True
        else:
            ColorPrint.red("❌ Failed to click any play buttons")
            return False
    
    def refresh_and_click_play_buttons(self, window) -> bool:
        """
        Refresh window and re-find play buttons for clicking
        
        Args:
            window: Battle.net window object
            
        Returns:
            True if successful, False otherwise
        """
        ColorPrint.yellow("🔄 Refreshing window and looking for play buttons...")
        
        try:
            # Re-activate window
            window.activate()
            time.sleep(2)  # Wait for window to fully activate
            
            # Re-enumerate controls
            controls = self.enumerate_controls_ui_automation(window)
            if not controls:
                ColorPrint.yellow("⚠️  No UI Automation controls found after refresh")
                return False
            
            ColorPrint.green(f"✅ Found {len(controls)} controls after refresh")
            
            # Find and click play buttons
            return self.find_and_click_play_buttons(window, controls)
            
        except Exception as e:
            ColorPrint.red(f"❌ Error refreshing window and clicking play buttons: {e}")
            return False
    
    def enumerate_controls_ui_automation(self, window) -> List[Dict]:
        """Enumerate all controls using UI Automation"""
        controls = []
        
        try:
            # Get UI Automation control from window handle
            window_handle = int(window._hWnd)
            self.battle_net_window = auto.ControlFromHandle(window_handle)
            
            if not self.battle_net_window.Exists():
                raise Exception("Cannot get Battle.net UI Automation controls")
            
            ColorPrint.green("🔍 Enumerating UI Automation controls...")
            
            # Recursively traverse all child controls
            def walk_controls(control, parent_id=None, level=0):
                control_id = len(controls)
                
                # Try to get visibility status
                try:
                    is_visible = control.IsVisible()
                except (AttributeError, Exception):
                    is_visible = None
                
                # Try to get enabled status
                try:
                    is_enabled = control.IsEnabled
                except (AttributeError, Exception):
                    is_enabled = None
                
                # Try to get value
                try:
                    value = control.CurrentValue
                except (AttributeError, Exception):
                    value = None
                
                # Try to get help text
                try:
                    help_text = control.CurrentHelpText
                except (AttributeError, Exception):
                    help_text = None
                
                # Try to get pattern support
                try:
                    patterns = []
                    for pattern in control.GetSupportedPatterns():
                        patterns.append(pattern.ProgrammaticName)
                except (AttributeError, Exception):
                    patterns = []
                
                control_info = {
                    "id": control_id,
                    "parent_id": parent_id,
                    "type": control.ControlTypeName,
                    "name": control.Name,
                    "automation_id": control.AutomationId,
                    "class_name": control.ClassName,
                    "value": value,
                    "help_text": help_text,
                    "patterns": patterns,
                    "rect": {
                        "left": control.BoundingRectangle.left,
                        "top": control.BoundingRectangle.top,
                        "right": control.BoundingRectangle.right,
                        "bottom": control.BoundingRectangle.bottom,
                        "width": control.BoundingRectangle.width(),
                        "height": control.BoundingRectangle.height()
                    },
                    "is_enabled": is_enabled,
                    "is_visible": is_visible,
                    "level": level
                }
                controls.append(control_info)
                
                # Traverse child controls
                try:
                    for child in control.GetChildren():
                        walk_controls(child, control_id, level + 1)
                except Exception as e:
                    ColorPrint.yellow(f"⚠️  Error traversing child controls: {e}")
            
            walk_controls(self.battle_net_window)
            ColorPrint.green(f"✅ Found {len(controls)} UI Automation controls")
            
        except Exception as e:
            ColorPrint.red(f"❌ Error enumerating UI Automation controls: {e}")
        
        return controls


def main():
    """Main function for testing"""
    click_handler = ClickHandler()
    print("Click Handler initialized successfully")


if __name__ == "__main__":
    main() 