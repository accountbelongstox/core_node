#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Play Button Clicker
Finds and clicks Play button in Battle.net interface after Diablo III is selected
"""

import os
import sys
import time
from typing import List, Dict, Optional
import uiautomation as auto

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

from providor.providor_second import PLAY_BUTTON_AUTOMATION_IDS
from utils.color_print import ColorPrint


class PlayButtonClicker:
    """Finds and clicks Play button in Battle.net interface"""
    
    def __init__(self):
        self.play_button_automation_ids = PLAY_BUTTON_AUTOMATION_IDS
    
    def find_play_button(self, window_handle: int) -> Optional[Dict]:
        """Find Play button in Battle.net interface"""
        try:
            # Get UI Automation control from window handle
            battle_net_window = auto.ControlFromHandle(window_handle)
            
            if not battle_net_window.Exists():
                ColorPrint.red("[ERROR] Cannot get Battle.net UI Automation controls")
                return None
            
            ColorPrint.blue("[SEARCH] Searching for Play button...")
            
            # Search for Play button using automation IDs
            play_button = None
            found_automation_id = None
            
            # Try to find the button by traversing all children
            def find_button_recursive(control, depth=0):
                nonlocal play_button, found_automation_id
                if play_button or depth > 10:  # Limit recursion depth
                    return
                
                try:
                    # Check if this control is the Play button
                    if hasattr(control, 'AutomationId'):
                        control_auto_id = control.AutomationId
                        if control_auto_id in self.play_button_automation_ids:
                            play_button = control
                            found_automation_id = control_auto_id
                            return
                    
                    # Recursively search children
                    for child in control.GetChildren():
                        find_button_recursive(child, depth + 1)
                except Exception:
                    # Skip controls that can't be accessed
                    pass
            
            find_button_recursive(battle_net_window)
            
            if play_button and play_button.Exists():
                # Get button information with safe attribute access
                button_info = {
                    "automation_id": found_automation_id,
                    "name": self._safe_get_name(play_button),
                    "class_name": self._safe_get_class_name(play_button),
                    "is_enabled": self._safe_get_enabled(play_button),
                    "is_visible": self._safe_get_visible(play_button),
                    "rect": self._safe_get_rect(play_button)
                }
                
                ColorPrint.green(f"[FOUND] Play button found: {button_info['automation_id']}")
                ColorPrint.gray(f"[INFO] Button name: {button_info['name']}")
                return button_info
            else:
                ColorPrint.yellow("[WARNING] Play button not found")
                return None
                
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error finding Play button: {e}")
            return None
    
    def _safe_get_name(self, control) -> str:
        """Safely get name of control"""
        try:
            return control.Name or ""
        except (AttributeError, Exception):
            return ""
    
    def _safe_get_class_name(self, control) -> str:
        """Safely get class name of control"""
        try:
            return control.ClassName or ""
        except (AttributeError, Exception):
            return ""
    
    def _safe_get_enabled(self, control) -> bool:
        """Safely get enabled status of control"""
        try:
            return control.IsEnabled
        except (AttributeError, Exception):
            return True  # Default to enabled if can't determine
    
    def _safe_get_visible(self, control) -> bool:
        """Safely get visible status of control"""
        try:
            return control.IsVisible()
        except (AttributeError, Exception):
            return True  # Default to visible if can't determine
    
    def _safe_get_rect(self, control) -> Dict:
        """Safely get rectangle of control"""
        try:
            rect = control.BoundingRectangle
            return {
                "left": rect.left,
                "top": rect.top,
                "right": rect.right,
                "bottom": rect.bottom,
                "width": rect.width(),
                "height": rect.height()
            }
        except (AttributeError, Exception):
            return {
                "left": 0,
                "top": 0,
                "right": 0,
                "bottom": 0,
                "width": 0,
                "height": 0
            }
    
    def click_play_button(self, window_handle: int) -> bool:
        """Find and click Play button"""
        try:
            ColorPrint.blue("[PLAY_CLICK] Starting Play button click sequence...")
            
            # Wait a moment for UI to update after Diablo III selection
            time.sleep(2)
            
            # Find the button
            button_info = self.find_play_button(window_handle)
            if not button_info:
                ColorPrint.red("[PLAY_ERROR] Play button not found")
                return False
            
            # Get UI Automation control from window handle
            battle_net_window = auto.ControlFromHandle(window_handle)
            
            # Find the button again for clicking
            play_button = None
            
            def find_button_recursive(control, depth=0):
                nonlocal play_button
                if play_button or depth > 10:
                    return
                
                try:
                    # Check if this control is the Play button
                    if hasattr(control, 'AutomationId'):
                        control_auto_id = control.AutomationId
                        if control_auto_id in self.play_button_automation_ids:
                            play_button = control
                            return
                    
                    # Recursively search children
                    for child in control.GetChildren():
                        find_button_recursive(child, depth + 1)
                except Exception:
                    # Skip controls that can't be accessed
                    pass
            
            find_button_recursive(battle_net_window)
            
            if play_button and play_button.Exists():
                # Check if button is enabled
                if not self._safe_get_enabled(play_button):
                    ColorPrint.yellow("[PLAY_WARNING] Play button is disabled")
                    return False
                
                # Get button center coordinates
                rect = self._safe_get_rect(play_button)
                center_x = rect["left"] + rect["width"] // 2
                center_y = rect["top"] + rect["height"] // 2
                
                # Get current mouse position to restore later
                import win32api
                original_pos = win32api.GetCursorPos()
                ColorPrint.gray(f"[MOUSE] Original position: {original_pos}")
                
                # Move mouse directly to button center
                ColorPrint.blue("[MOUSE] Moving to Play button...")
                try:
                    win32api.SetCursorPos((center_x, center_y))
                    ColorPrint.green(f"[MOUSE] Moved to button center: ({center_x}, {center_y})")
                except Exception as e:
                    ColorPrint.red(f"[MOUSE_ERROR] Error moving mouse: {e}")
                    return False
                
                # Wait a moment for mouse movement to complete
                time.sleep(0.2)
                
                # Click the button using UI Automation
                ColorPrint.blue("[CLICK] Clicking Play button...")
                
                # Multiple clicks for safety
                for click_attempt in range(3):
                    try:
                        play_button.Click()
                        ColorPrint.gray(f"[CLICK] Attempt {click_attempt + 1}/3")
                        time.sleep(0.1)
                    except Exception as e:
                        ColorPrint.yellow(f"[CLICK_WARNING] Click attempt {click_attempt + 1} failed: {e}")
                
                # Restore mouse position
                try:
                    win32api.SetCursorPos(original_pos)
                    ColorPrint.gray(f"[MOUSE] Position restored to: {original_pos}")
                except Exception as e:
                    ColorPrint.yellow(f"[MOUSE_WARNING] Error restoring position: {e}")
                
                ColorPrint.green("[PLAY_SUCCESS] Play button clicked successfully")
                return True
            else:
                ColorPrint.red("[PLAY_ERROR] Play button not found for clicking")
                return False
                
        except Exception as e:
            ColorPrint.red(f"[PLAY_ERROR] Error clicking Play button: {e}")
            return False


def main():
    """Main function for testing"""
    clicker = PlayButtonClicker()
    print("[INIT] PlayButtonClicker initialized successfully")


if __name__ == "__main__":
    main()
