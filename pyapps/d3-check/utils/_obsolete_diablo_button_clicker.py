#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diablo III Button Clicker
Finds and clicks Diablo III button in Battle.net interface
"""

import os
import sys
import time
from typing import List, Dict, Optional
import uiautomation as auto

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

# Add ncore path

from providor.providor_second import DIABLO_III_TAB_AUTO_ID
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from utils.integrated_automation_controller import IntegratedAutomationController

class DiabloButtonClicker:
    """Finds and clicks Diablo III button in Battle.net interface using integrated automation"""

    def __init__(self):
        self.diablo_iii_tab_auto_id = DIABLO_III_TAB_AUTO_ID
        self.integrated_automation = IntegratedAutomationController()

        ColorPrint.green("[INIT] DiabloButtonClicker initialized with integrated automation")

    def click_diablo_button_integrated(self, window_titles: List[str], process_name: str = "BattleNet") -> Dict:
        """Click Diablo III button using integrated automation"""
        try:
            ColorPrint.blue("[DIABLO_CLICK] Clicking Diablo III button using integrated automation...")

            # Define search criteria for Diablo button
            diablo_criteria = [
                {"type": "ButtonControl", "name_contains": "Diablo"},
                {"type": "ButtonControl", "name_contains": "暗黑破坏神"},
                {"automation_id": self.diablo_iii_tab_auto_id} if self.diablo_iii_tab_auto_id else None
            ]

            # Remove None criteria
            diablo_criteria = [c for c in diablo_criteria if c is not None]

            # Try each criteria until one works
            for i, criteria in enumerate(diablo_criteria):
                ColorPrint.blue(f"[DIABLO_CLICK] Trying criteria {i+1}: {criteria}")

                success = self.integrated_automation.quick_find_and_click(
                    window_titles, process_name, criteria
                )

                if success:
                    ColorPrint.green(f"[DIABLO_CLICK] ✓ Diablo button clicked using criteria {i+1}")
                    return {
                        "success": True,
                        "method": "integrated_automation",
                        "criteria_used": criteria,
                        "attempt": i+1
                    }
                else:
                    ColorPrint.yellow(f"[DIABLO_CLICK] ✗ Criteria {i+1} failed")

            ColorPrint.red("[DIABLO_CLICK] All criteria failed")
            return {"success": False, "error": "All search criteria failed"}

        except Exception as e:
            ColorPrint.red(f"[DIABLO_CLICK] Error in integrated Diablo button click: {e}")
            return {"success": False, "error": str(e)}

    def find_and_click_diablo_advanced(self, window_titles: List[str], process_name: str = "BattleNet") -> Dict:
        """Advanced Diablo button finding and clicking with multiple strategies"""
        try:
            ColorPrint.blue("[DIABLO_ADVANCED] Starting advanced Diablo button search...")

            # Strategy 1: Use integrated automation pipeline
            success, elements, live_controls = self.integrated_automation.integrated_analyzer.analyze_find_and_prepare(
                window_titles,
                process_name,
                {"type": "ButtonControl", "name_contains": "Diablo"}
            )

            if success and elements:
                ColorPrint.green(f"[DIABLO_ADVANCED] Found {len(elements)} Diablo-related elements")

                # Try to click the first element
                element = elements[0]

                # Try live control first
                if live_controls and len(live_controls) > 0:
                    try:
                        live_controls[0].Click()
                        ColorPrint.green("[DIABLO_ADVANCED] ✓ Clicked using live control")
                        return {
                            "success": True,
                            "method": "live_control",
                            "element_name": element.element_name,
                            "element_type": element.element_type
                        }
                    except Exception as e:
                        ColorPrint.yellow(f"[DIABLO_ADVANCED] Live control failed: {e}")

                # Fallback to coordinate click
                center_x, center_y = element.get_center_point()
                if center_x > 0 and center_y > 0:
                    import win32api
                    win32api.SetCursorPos((center_x, center_y))
                    win32api.mouse_event(2, 0, 0)  # Left button down
                    win32api.mouse_event(4, 0, 0)  # Left button up
                    ColorPrint.green(f"[DIABLO_ADVANCED] ✓ Clicked at coordinates ({center_x}, {center_y})")
                    return {
                        "success": True,
                        "method": "coordinate_click",
                        "coordinates": (center_x, center_y),
                        "element_name": element.element_name
                    }

            # Strategy 2: Fallback to legacy method
            ColorPrint.yellow("[DIABLO_ADVANCED] Integrated method failed, trying legacy method...")
            legacy_result = self.click_diablo3_button_legacy(window_titles)

            if legacy_result.get("success", False):
                legacy_result["method"] = "legacy_fallback"
                return legacy_result

            return {"success": False, "error": "All strategies failed"}

        except Exception as e:
            ColorPrint.red(f"[DIABLO_ADVANCED] Error in advanced Diablo button click: {e}")
            return {"success": False, "error": str(e)}

    def find_diablo3_button(self, window_handle: int) -> Optional[Dict]:
        """Find Diablo III button in Battle.net interface"""
        try:
            # Get UI Automation control from window handle
            battle_net_window = auto.ControlFromHandle(window_handle)
            
            if not battle_net_window.Exists():
                ColorPrint.red("❌ Cannot get Battle.net UI Automation controls")
                return None
            
            ColorPrint.green("🔍 Searching for Diablo III button...")
            
            # Search for Diablo III button using automation ID
            diablo_button = None
            
            # Try to find the button by traversing all children
            def find_button_recursive(control):
                nonlocal diablo_button
                if diablo_button:
                    return
                
                try:
                    # Check if this control is the Diablo III button
                    if (hasattr(control, 'AutomationId') and 
                        control.AutomationId == self.diablo_iii_tab_auto_id):
                        diablo_button = control
                        return
                    
                    # Recursively search children
                    for child in control.GetChildren():
                        find_button_recursive(child)
                except Exception as e:
                    # Skip controls that can't be accessed
                    pass
            
            find_button_recursive(battle_net_window)
            
            if diablo_button and diablo_button.Exists():
                # Get button information with safe attribute access
                button_info = {
                    "automation_id": diablo_button.AutomationId,
                    "name": diablo_button.Name,
                    "class_name": diablo_button.ClassName,
                    "is_enabled": self._safe_get_enabled(diablo_button),
                    "is_visible": self._safe_get_visible(diablo_button),
                    "rect": self._safe_get_rect(diablo_button)
                }
                
                ColorPrint.green(f"✅ Found Diablo III button: {button_info['name']}")
                return button_info
            else:
                ColorPrint.yellow("⚠️  Diablo III button not found")
                return None
                
        except Exception as e:
            ColorPrint.red(f"❌ Error finding Diablo III button: {e}")
            return None
    
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
    
    def click_diablo3_button_legacy(self, window_titles: List[str]) -> Dict:
        """Find and click Diablo III button using legacy method"""
        try:
            ColorPrint.yellow("[LEGACY] Using legacy Diablo button click method")

            # This is a simplified legacy implementation
            # In practice, you would need to find the window handle first
            ColorPrint.red("[LEGACY] Legacy method not fully implemented - use integrated methods instead")
            return {"success": False, "error": "Legacy method deprecated"}
        except Exception as e:
            ColorPrint.red(f"[LEGACY] Error in legacy method: {e}")
            return {"success": False, "error": str(e)}
                if diablo_button:
                    return
                
                try:
                    # Check if this control is the Diablo III button
                    if (hasattr(control, 'AutomationId') and 
                        control.AutomationId == self.diablo_iii_tab_auto_id):
                        diablo_button = control
                        return
                    
                    # Recursively search children
                    for child in control.GetChildren():
                        find_button_recursive(child)
                except Exception as e:
                    # Skip controls that can't be accessed
                    pass
            
            find_button_recursive(battle_net_window)
            
            if diablo_button and diablo_button.Exists():
                # Check if button is enabled
                if not self._safe_get_enabled(diablo_button):
                    ColorPrint.yellow("⚠️  Diablo III button is disabled")
                    return False
                
                # Get button center coordinates
                rect = self._safe_get_rect(diablo_button)
                center_x = rect["left"] + rect["width"] // 2
                center_y = rect["top"] + rect["height"] // 2
                
                # Get current mouse position to restore later
                import win32api
                original_pos = win32api.GetCursorPos()
                ColorPrint.gray(f"📍 Original mouse position: {original_pos}")
                
                # Move mouse directly to button center
                ColorPrint.green("🖱️  Moving mouse directly to Diablo III button...")
                try:
                    win32api.SetCursorPos((center_x, center_y))
                    ColorPrint.green(f"✅ Mouse moved to button center: ({center_x}, {center_y})")
                except Exception as e:
                    ColorPrint.red(f"❌ Error moving mouse: {e}")
                    return False
                
                # Wait a moment for mouse movement to complete
                time.sleep(0.1)
                
                # Click the button using UI Automation
                ColorPrint.green("🖱️  Clicking Diablo III button...")
                
                # Multiple clicks for safety
                for click_attempt in range(2):
                    diablo_button.Click()
                    ColorPrint.gray(f"   Click attempt {click_attempt + 1}/2")
                
                # Immediately restore mouse position
                try:
                    win32api.SetCursorPos(original_pos)
                    ColorPrint.gray(f"🖱️  Mouse position restored to: {original_pos}")
                except Exception as e:
                    ColorPrint.yellow(f"⚠️  Error restoring mouse position: {e}")
                
                ColorPrint.green("✅ Diablo III button clicked successfully")
                return True
            else:
                ColorPrint.red("❌ Diablo III button not found for clicking")
                return False
                
        except Exception as e:
            ColorPrint.red(f"❌ Error clicking Diablo III button: {e}")
            return False

def main():
    """Main function for testing"""
    clicker = DiabloButtonClicker()
    print("DiabloButtonClicker initialized successfully")

if __name__ == "__main__":
    main() 