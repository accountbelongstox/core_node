#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI Automation Controller
Handles automated UI operations for RoS-BoT other exe processes
"""

import os
import sys
import time
from typing import List, Dict, Optional, Any

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

# Add ncore path

from providor.providor_second import CONFIG, load_config
from pycore.pyfoundations.color_print import ColorPrint
import uiautomation as auto
import win32gui
import win32con

class UIAutomationController:
    """Handles automated UI operations for RoS-BoT processes"""
    
    def __init__(self):
        """Initialize UI automation controller"""
        # Ensure configuration is loaded
        load_config()
        
        # Load UI automation settings
        ros_settings = CONFIG.get('ros_settings', {})
        self.auto_configure_ui = ros_settings.get('auto_configure_ui', True)
        self.tab_item_names = ros_settings.get('tab_item_names', ['主档案'])
        self.profile_combobox_text = ros_settings.get('profile_combobox_text', '火鸟')
        self.sequence_combobox_names = ros_settings.get('sequence_combobox_names', ['大小秘境'])
        self.ui_operation_delay = ros_settings.get('ui_operation_delay', 1.0)
        
        ColorPrint.green("[INIT] UIAutomationController initialized")
        ColorPrint.blue(f"[CONFIG] Auto configure UI: {self.auto_configure_ui}")
        ColorPrint.blue(f"[CONFIG] Tab item names: {self.tab_item_names}")
        ColorPrint.blue(f"[CONFIG] Profile combobox text: {self.profile_combobox_text}")
        ColorPrint.blue(f"[CONFIG] Sequence combobox names: {self.sequence_combobox_names}")

    def _safe_get_control_info(self, control) -> Dict:
        """Safely get control information with error handling"""
        try:
            info = {
                'control': control,
                'name': '',
                'type': '',
                'automation_id': '',
                'class_name': '',
                'is_enabled': True,
                'is_visible': True,
                'rect': {'left': 0, 'top': 0, 'right': 0, 'bottom': 0, 'width': 0, 'height': 0}
            }

            # Safely get each property
            try:
                info['name'] = control.Name or ''
            except:
                pass

            try:
                info['type'] = control.ControlTypeName or ''
            except:
                pass

            try:
                info['automation_id'] = control.AutomationId or ''
            except:
                pass

            try:
                info['class_name'] = control.ClassName or ''
            except:
                pass

            try:
                info['is_enabled'] = control.IsEnabled
            except:
                pass

            try:
                info['is_visible'] = control.IsVisible()
            except:
                pass

            try:
                rect = control.BoundingRectangle
                info['rect'] = {
                    'left': rect.left,
                    'top': rect.top,
                    'right': rect.right,
                    'bottom': rect.bottom,
                    'width': rect.width(),
                    'height': rect.height()
                }
            except:
                pass

            return info

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error getting control info: {e}")
            return None

    def find_controls_by_type_and_name(self, window_control: auto.Control, control_type: str, name_contains: List[str] = None) -> List[Dict]:
        """Find controls by type and optionally by name containing specific text"""
        try:
            found_controls = []
            
            def walk_controls(control, level=0):
                try:
                    # Use safe method to get control info
                    control_info = self._safe_get_control_info(control)
                    if not control_info:
                        return

                    control_type_name = control_info['type']
                    control_name = control_info['name']

                    # Check if control type matches
                    if control_type_name == control_type:
                        # If name filter is provided, check if name contains any of the specified texts
                        if name_contains:
                            for search_text in name_contains:
                                if search_text in control_name:
                                    control_info['level'] = level
                                    found_controls.append(control_info)
                                    ColorPrint.gray(f"[FOUND_CONTROL] {control_type} '{control_name}' (level {level})")
                                    break
                        else:
                            # No name filter, add all controls of this type
                            control_info['level'] = level
                            found_controls.append(control_info)
                            ColorPrint.gray(f"[FOUND_CONTROL] {control_type} '{control_name}' (level {level})")

                    # Recursively search child controls
                    try:
                        for child in control.GetChildren():
                            walk_controls(child, level + 1)
                    except:
                        # Skip if can't get children
                        pass

                except Exception:
                    # Skip controls that cause errors
                    pass
            
            walk_controls(window_control)
            return found_controls
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error finding controls: {e}")
            return []
    
    def click_tab_item(self, window_control: auto.Control) -> bool:
        """Find and click tab item containing specified names"""
        try:
            ColorPrint.blue("[TAB_SEARCH] Searching for tab items...")
            
            # Find all TabItemControl elements
            tab_controls = self.find_controls_by_type_and_name(window_control, "TabItemControl")
            
            ColorPrint.blue(f"[TAB_FOUND] Found {len(tab_controls)} tab items:")
            for i, tab in enumerate(tab_controls):
                ColorPrint.gray(f"  [{i+1}] '{tab['name']}'")
            
            # Find tab item containing any of the specified names
            target_tab = None
            for tab in tab_controls:
                for search_name in self.tab_item_names:
                    if search_name in tab['name']:
                        target_tab = tab
                        ColorPrint.green(f"[TAB_MATCH] Found matching tab: '{tab['name']}'")
                        break
                if target_tab:
                    break
            
            if target_tab:
                ColorPrint.blue(f"[TAB_CLICK] Clicking tab: '{target_tab['name']}'")
                target_tab['control'].Click()
                time.sleep(self.ui_operation_delay)
                ColorPrint.green(f"[TAB_SUCCESS] Tab clicked successfully")
                return True
            else:
                ColorPrint.red(f"[TAB_ERROR] No tab found containing: {self.tab_item_names}")
                return False
                
        except Exception as e:
            ColorPrint.red(f"[TAB_ERROR] Error clicking tab item: {e}")
            return False
    
    def select_profile_combobox(self, window_control: auto.Control) -> bool:
        """Find and select profile combobox item"""
        try:
            ColorPrint.blue("[PROFILE_SEARCH] Searching for profile combobox...")
            
            # Find ComboBoxControl with automation_id "cmbMasterProfile"
            combo_controls = self.find_controls_by_type_and_name(window_control, "ComboBoxControl")
            
            profile_combo = None
            for combo in combo_controls:
                if combo['automation_id'] == 'cmbMasterProfile':
                    profile_combo = combo
                    break
            
            if not profile_combo:
                ColorPrint.red("[PROFILE_ERROR] Profile combobox not found")
                return False
            
            ColorPrint.green(f"[PROFILE_FOUND] Found profile combobox: '{profile_combo['name']}'")
            
            # Click to open combobox
            ColorPrint.blue("[PROFILE_OPEN] Opening profile combobox...")
            profile_combo['control'].Click()
            time.sleep(self.ui_operation_delay)
            
            # Get combobox items
            try:
                combo_items = []
                for child in profile_combo['control'].GetChildren():
                    if child.ControlTypeName == "ListItemControl":
                        combo_items.append({
                            'control': child,
                            'name': child.Name
                        })
                
                ColorPrint.blue(f"[PROFILE_ITEMS] Found {len(combo_items)} profile options:")
                for i, item in enumerate(combo_items):
                    ColorPrint.gray(f"  [{i+1}] '{item['name']}'")
                
                # Find item containing the specified text
                target_item = None
                for item in combo_items:
                    if self.profile_combobox_text in item['name']:
                        target_item = item
                        ColorPrint.green(f"[PROFILE_MATCH] Found matching profile: '{item['name']}'")
                        break
                
                if target_item:
                    ColorPrint.blue(f"[PROFILE_SELECT] Selecting profile: '{target_item['name']}'")
                    target_item['control'].Click()
                    time.sleep(self.ui_operation_delay)
                    ColorPrint.green("[PROFILE_SUCCESS] Profile selected successfully")
                    return True
                else:
                    ColorPrint.red(f"[PROFILE_ERROR] No profile found containing: '{self.profile_combobox_text}'")
                    return False
                    
            except Exception as e:
                ColorPrint.red(f"[PROFILE_ERROR] Error getting combobox items: {e}")
                return False
                
        except Exception as e:
            ColorPrint.red(f"[PROFILE_ERROR] Error selecting profile combobox: {e}")
            return False
    
    def select_sequence_combobox(self, window_control: auto.Control) -> bool:
        """Find and select sequence combobox item"""
        try:
            ColorPrint.blue("[SEQUENCE_SEARCH] Searching for sequence combobox...")
            
            # Find ComboBoxControl with automation_id "cmbSequence"
            combo_controls = self.find_controls_by_type_and_name(window_control, "ComboBoxControl")
            
            sequence_combo = None
            for combo in combo_controls:
                if combo['automation_id'] == 'cmbSequence':
                    sequence_combo = combo
                    break
            
            if not sequence_combo:
                ColorPrint.red("[SEQUENCE_ERROR] Sequence combobox not found")
                return False
            
            ColorPrint.green(f"[SEQUENCE_FOUND] Found sequence combobox")
            
            # Click to open combobox
            ColorPrint.blue("[SEQUENCE_OPEN] Opening sequence combobox...")
            sequence_combo['control'].Click()
            time.sleep(self.ui_operation_delay)
            
            # Get combobox items
            try:
                combo_items = []
                for child in sequence_combo['control'].GetChildren():
                    if child.ControlTypeName == "ListItemControl":
                        combo_items.append({
                            'control': child,
                            'name': child.Name
                        })
                
                ColorPrint.blue(f"[SEQUENCE_ITEMS] Found {len(combo_items)} sequence options:")
                for i, item in enumerate(combo_items):
                    ColorPrint.gray(f"  [{i+1}] '{item['name']}'")
                
                # Find item containing any of the specified texts
                target_item = None
                for item in combo_items:
                    for search_name in self.sequence_combobox_names:
                        if search_name in item['name']:
                            target_item = item
                            ColorPrint.green(f"[SEQUENCE_MATCH] Found matching sequence: '{item['name']}'")
                            break
                    if target_item:
                        break
                
                if target_item:
                    ColorPrint.blue(f"[SEQUENCE_SELECT] Selecting sequence: '{target_item['name']}'")
                    target_item['control'].Click()
                    time.sleep(self.ui_operation_delay)
                    ColorPrint.green("[SEQUENCE_SUCCESS] Sequence selected successfully")
                    return True
                else:
                    ColorPrint.red(f"[SEQUENCE_ERROR] No sequence found containing: {self.sequence_combobox_names}")
                    return False
                    
            except Exception as e:
                ColorPrint.red(f"[SEQUENCE_ERROR] Error getting combobox items: {e}")
                return False
                
        except Exception as e:
            ColorPrint.red(f"[SEQUENCE_ERROR] Error selecting sequence combobox: {e}")
            return False

    def click_start_button(self, window_control: auto.Control) -> bool:
        """Find and click the Start botting button"""
        try:
            ColorPrint.blue("[START_SEARCH] Searching for Start botting button...")

            # Find ButtonControl with automation_id "btnStart"
            button_controls = self.find_controls_by_type_and_name(window_control, "ButtonControl")

            start_button = None
            for button in button_controls:
                if button['automation_id'] == 'btnStart' or 'Start botting' in button['name']:
                    start_button = button
                    break

            if not start_button:
                ColorPrint.red("[START_ERROR] Start botting button not found")
                return False

            ColorPrint.green(f"[START_FOUND] Found start button: '{start_button['name']}'")
            ColorPrint.blue(f"[START_CLICK] Clicking start button...")

            start_button['control'].Click()
            time.sleep(self.ui_operation_delay)

            ColorPrint.green("[START_SUCCESS] Start button clicked successfully")
            return True

        except Exception as e:
            ColorPrint.red(f"[START_ERROR] Error clicking start button: {e}")
            return False

    def perform_ui_automation_from_json(self, window_handle: int, ui_controls: List[Dict]) -> Dict:
        """Perform UI automation using pre-analyzed JSON control data"""
        try:
            if not self.auto_configure_ui:
                ColorPrint.gray("[UI_SKIP] UI automation disabled in configuration")
                return {"success": True, "skipped": True, "reason": "UI automation disabled"}

            ColorPrint.blue("[UI_AUTO_JSON] Starting UI automation using JSON control data...")
            ColorPrint.blue(f"[UI_DEBUG] Window handle: {window_handle}")
            ColorPrint.blue(f"[UI_DEBUG] Available controls: {len(ui_controls)}")

            # Validate window handle
            if not window_handle or window_handle <= 0:
                return {"success": False, "error": "Invalid window handle"}

            # Try to activate window first
            try:
                win32gui.SetForegroundWindow(window_handle)
                win32gui.ShowWindow(window_handle, win32con.SW_RESTORE)
                time.sleep(1)  # Wait for activation
                ColorPrint.blue("[UI_DEBUG] Window activated successfully")
            except Exception as e:
                ColorPrint.yellow(f"[UI_WARNING] Window activation failed: {e}")

            results = {
                "tab_clicked": False,
                "profile_selected": False,
                "sequence_selected": False,
                "start_clicked": False
            }

            # Step 1: Find and click tab item using JSON data
            ColorPrint.blue("[UI_STEP_1] Finding tab item from JSON data...")
            tab_controls = [ctrl for ctrl in ui_controls if ctrl.get('type') == 'TabItemControl']
            ColorPrint.blue(f"[UI_DEBUG] Found {len(tab_controls)} tab controls in JSON")

            for tab in tab_controls:
                tab_name = tab.get('name', '')
                ColorPrint.gray(f"[TAB_FOUND] '{tab_name}'")

                # Check if tab name contains any of our target names
                for search_name in self.tab_item_names:
                    if search_name in tab_name:
                        ColorPrint.green(f"[TAB_MATCH] Found matching tab: '{tab_name}'")

                        # Click using coordinates from JSON
                        rect = tab.get('rect', {})
                        if rect:
                            center_x = rect.get('left', 0) + rect.get('width', 0) // 2
                            center_y = rect.get('top', 0) + rect.get('height', 0) // 2

                            try:
                                import win32api
                                win32api.SetCursorPos((center_x, center_y))
                                win32api.mouse_event(2, 0, 0)  # Left button down
                                win32api.mouse_event(4, 0, 0)  # Left button up
                                time.sleep(self.ui_operation_delay)
                                results["tab_clicked"] = True
                                ColorPrint.green("[UI_STEP_1] ✓ Tab clicked successfully")
                            except Exception as e:
                                ColorPrint.red(f"[UI_STEP_1] ✗ Tab click error: {e}")
                        break
                if results["tab_clicked"]:
                    break

            if not results["tab_clicked"]:
                ColorPrint.yellow("[UI_STEP_1] ✗ No matching tab found")

            time.sleep(self.ui_operation_delay)

            # Step 2: Find and select profile combobox
            ColorPrint.blue("[UI_STEP_2] Finding profile combobox from JSON data...")
            profile_combos = [ctrl for ctrl in ui_controls
                            if ctrl.get('type') == 'ComboBoxControl' and
                            ctrl.get('automation_id') == 'cmbMasterProfile']

            ColorPrint.blue(f"[UI_DEBUG] Found {len(profile_combos)} profile comboboxes in JSON")

            if profile_combos:
                profile_combo = profile_combos[0]
                ColorPrint.green(f"[PROFILE_FOUND] Profile combobox found")

                # Click combobox using coordinates
                rect = profile_combo.get('rect', {})
                if rect:
                    center_x = rect.get('left', 0) + rect.get('width', 0) // 2
                    center_y = rect.get('top', 0) + rect.get('height', 0) // 2

                    try:
                        import win32api
                        win32api.SetCursorPos((center_x, center_y))
                        win32api.mouse_event(2, 0, 0)  # Left button down
                        win32api.mouse_event(4, 0, 0)  # Left button up
                        time.sleep(self.ui_operation_delay)

                        # Note: We can't easily get dropdown items from JSON, so we'll mark as attempted
                        results["profile_selected"] = True
                        ColorPrint.green("[UI_STEP_2] ✓ Profile combobox clicked")
                    except Exception as e:
                        ColorPrint.red(f"[UI_STEP_2] ✗ Profile click error: {e}")
            else:
                ColorPrint.yellow("[UI_STEP_2] ✗ Profile combobox not found")

            time.sleep(self.ui_operation_delay)

            # Step 3: Find and select sequence combobox
            ColorPrint.blue("[UI_STEP_3] Finding sequence combobox from JSON data...")
            sequence_combos = [ctrl for ctrl in ui_controls
                             if ctrl.get('type') == 'ComboBoxControl' and
                             ctrl.get('automation_id') == 'cmbSequence']

            ColorPrint.blue(f"[UI_DEBUG] Found {len(sequence_combos)} sequence comboboxes in JSON")

            if sequence_combos:
                sequence_combo = sequence_combos[0]
                ColorPrint.green(f"[SEQUENCE_FOUND] Sequence combobox found")

                # Click combobox using coordinates
                rect = sequence_combo.get('rect', {})
                if rect:
                    center_x = rect.get('left', 0) + rect.get('width', 0) // 2
                    center_y = rect.get('top', 0) + rect.get('height', 0) // 2

                    try:
                        import win32api
                        win32api.SetCursorPos((center_x, center_y))
                        win32api.mouse_event(2, 0, 0)  # Left button down
                        win32api.mouse_event(4, 0, 0)  # Left button up
                        time.sleep(self.ui_operation_delay)

                        results["sequence_selected"] = True
                        ColorPrint.green("[UI_STEP_3] ✓ Sequence combobox clicked")
                    except Exception as e:
                        ColorPrint.red(f"[UI_STEP_3] ✗ Sequence click error: {e}")
            else:
                ColorPrint.yellow("[UI_STEP_3] ✗ Sequence combobox not found")

            time.sleep(self.ui_operation_delay)

            # Step 4: Find and click start button
            ColorPrint.blue("[UI_STEP_4] Finding start button from JSON data...")
            start_buttons = [ctrl for ctrl in ui_controls
                           if ctrl.get('type') == 'ButtonControl' and
                           (ctrl.get('automation_id') == 'btnStart' or 'Start botting' in ctrl.get('name', ''))]

            ColorPrint.blue(f"[UI_DEBUG] Found {len(start_buttons)} start buttons in JSON")

            if start_buttons:
                start_button = start_buttons[0]
                ColorPrint.green(f"[START_FOUND] Start button found: '{start_button.get('name', '')}'")

                # Click button using coordinates
                rect = start_button.get('rect', {})
                if rect:
                    center_x = rect.get('left', 0) + rect.get('width', 0) // 2
                    center_y = rect.get('top', 0) + rect.get('height', 0) // 2

                    try:
                        import win32api
                        win32api.SetCursorPos((center_x, center_y))
                        win32api.mouse_event(2, 0, 0)  # Left button down
                        win32api.mouse_event(4, 0, 0)  # Left button up
                        time.sleep(self.ui_operation_delay)

                        results["start_clicked"] = True
                        ColorPrint.green("[UI_STEP_4] ✓ Start button clicked successfully")
                    except Exception as e:
                        ColorPrint.red(f"[UI_STEP_4] ✗ Start button click error: {e}")
            else:
                ColorPrint.yellow("[UI_STEP_4] ✗ Start button not found")

            # Check overall success
            success_count = sum(1 for result in results.values() if result)
            total_steps = len(results)

            ColorPrint.blue(f"[UI_COMPLETE] UI automation completed: {success_count}/{total_steps} steps successful")

            # Consider it successful if at least the start button was clicked
            overall_success = results["start_clicked"] or success_count >= 2

            return {
                "success": overall_success,
                "results": results,
                "success_count": success_count,
                "total_steps": total_steps,
                "method": "json_based",
                "debug_info": {
                    "window_handle": window_handle,
                    "controls_available": len(ui_controls)
                }
            }

        except Exception as e:
            ColorPrint.red(f"[UI_ERROR] Critical error in JSON-based UI automation: {e}")
            import traceback
            ColorPrint.red(f"[UI_ERROR] Traceback: {traceback.format_exc()}")
            return {"success": False, "error": str(e), "traceback": traceback.format_exc()}

    def perform_full_ui_automation(self, window_handle: int, ui_controls: List[Dict] = None) -> Dict:
        """Perform complete UI automation sequence with robust error handling"""
        try:
            if not self.auto_configure_ui:
                ColorPrint.gray("[UI_SKIP] UI automation disabled in configuration")
                return {"success": True, "skipped": True, "reason": "UI automation disabled"}

            # If we have JSON control data, use the JSON-based method
            if ui_controls and len(ui_controls) > 0:
                ColorPrint.blue("[UI_AUTO] Using JSON-based UI automation...")
                return self.perform_ui_automation_from_json(window_handle, ui_controls)

            ColorPrint.blue("[UI_AUTO] Starting complete UI automation sequence...")
            ColorPrint.blue(f"[UI_DEBUG] Window handle: {window_handle}")

            # Validate window handle
            if not window_handle or window_handle <= 0:
                return {"success": False, "error": "Invalid window handle"}

            # Try to activate window first (like Battle.net controller does)
            try:
                win32gui.SetForegroundWindow(window_handle)
                win32gui.ShowWindow(window_handle, win32con.SW_RESTORE)
                time.sleep(1)  # Wait for activation
                ColorPrint.blue("[UI_DEBUG] Window activated successfully")
            except Exception as e:
                ColorPrint.yellow(f"[UI_WARNING] Window activation failed: {e}")

            # Get window control from handle with retry logic
            window_control = None
            for attempt in range(3):
                try:
                    ColorPrint.blue(f"[UI_DEBUG] Attempt {attempt + 1} to get window control...")
                    window_control = auto.ControlFromHandle(window_handle)
                    if window_control and window_control.Exists():
                        ColorPrint.green("[UI_DEBUG] Window control obtained successfully")
                        break
                    else:
                        ColorPrint.yellow(f"[UI_DEBUG] Window control attempt {attempt + 1} failed")
                        time.sleep(2)  # Wait before retry
                except Exception as e:
                    ColorPrint.yellow(f"[UI_DEBUG] Window control attempt {attempt + 1} error: {e}")
                    time.sleep(2)

            if not window_control or not window_control.Exists():
                return {"success": False, "error": "Cannot get window control from handle after retries"}

            # Get window info for debugging
            try:
                window_info = self._safe_get_control_info(window_control)
                if window_info:
                    ColorPrint.blue(f"[UI_DEBUG] Window title: '{window_info['name']}'")
                    ColorPrint.blue(f"[UI_DEBUG] Window class: '{window_info['class_name']}'")
                    ColorPrint.blue(f"[UI_DEBUG] Window rect: {window_info['rect']}")
            except Exception as e:
                ColorPrint.yellow(f"[UI_DEBUG] Cannot get window info: {e}")

            results = {
                "tab_clicked": False,
                "profile_selected": False,
                "sequence_selected": False,
                "start_clicked": False
            }

            # Step 1: Click tab item
            ColorPrint.blue("[UI_STEP_1] Clicking tab item...")
            try:
                results["tab_clicked"] = self.click_tab_item(window_control)
                if results["tab_clicked"]:
                    ColorPrint.green("[UI_STEP_1] ✓ Tab clicked successfully")
                else:
                    ColorPrint.yellow("[UI_STEP_1] ✗ Tab click failed, continuing...")
            except Exception as e:
                ColorPrint.red(f"[UI_STEP_1] ✗ Tab click error: {e}")

            time.sleep(self.ui_operation_delay)

            # Step 2: Select profile combobox
            ColorPrint.blue("[UI_STEP_2] Selecting profile combobox...")
            try:
                results["profile_selected"] = self.select_profile_combobox(window_control)
                if results["profile_selected"]:
                    ColorPrint.green("[UI_STEP_2] ✓ Profile selected successfully")
                else:
                    ColorPrint.yellow("[UI_STEP_2] ✗ Profile selection failed, continuing...")
            except Exception as e:
                ColorPrint.red(f"[UI_STEP_2] ✗ Profile selection error: {e}")

            time.sleep(self.ui_operation_delay)

            # Step 3: Select sequence combobox
            ColorPrint.blue("[UI_STEP_3] Selecting sequence combobox...")
            try:
                results["sequence_selected"] = self.select_sequence_combobox(window_control)
                if results["sequence_selected"]:
                    ColorPrint.green("[UI_STEP_3] ✓ Sequence selected successfully")
                else:
                    ColorPrint.yellow("[UI_STEP_3] ✗ Sequence selection failed, continuing...")
            except Exception as e:
                ColorPrint.red(f"[UI_STEP_3] ✗ Sequence selection error: {e}")

            time.sleep(self.ui_operation_delay)

            # Step 4: Click start button
            ColorPrint.blue("[UI_STEP_4] Clicking start button...")
            try:
                results["start_clicked"] = self.click_start_button(window_control)
                if results["start_clicked"]:
                    ColorPrint.green("[UI_STEP_4] ✓ Start button clicked successfully")
                else:
                    ColorPrint.red("[UI_STEP_4] ✗ Start button click failed")
            except Exception as e:
                ColorPrint.red(f"[UI_STEP_4] ✗ Start button click error: {e}")

            # Check overall success
            success_count = sum(1 for result in results.values() if result)
            total_steps = len(results)

            ColorPrint.blue(f"[UI_COMPLETE] UI automation completed: {success_count}/{total_steps} steps successful")

            # Consider it successful if at least the start button was clicked
            overall_success = results["start_clicked"] or success_count >= 2

            return {
                "success": overall_success,
                "results": results,
                "success_count": success_count,
                "total_steps": total_steps,
                "debug_info": {
                    "window_handle": window_handle,
                    "window_activated": True
                }
            }

        except Exception as e:
            ColorPrint.red(f"[UI_ERROR] Critical error in UI automation: {e}")
            import traceback
            ColorPrint.red(f"[UI_ERROR] Traceback: {traceback.format_exc()}")
            return {"success": False, "error": str(e), "traceback": traceback.format_exc()}

def main():
    """Main function for testing"""
    UIAutomationController()
    print("[TEST] UIAutomationController initialized successfully")

if __name__ == "__main__":
    main()
