#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Integrated Automation Controller
Advanced UI automation using integrated analysis, mapping, and live element finding
Provides seamless analysis-to-automation pipeline with real-time element discovery
"""

import os
import sys
import time
from typing import Dict, List, Optional, Any, Tuple

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

# Add ncore path

from providor.common_imports import ColorPrint
from base.error_handler import ErrorHandler, with_error_handling, with_retry
from base.performance_cache import UI_ELEMENT_CACHE, cached_function
from providor.providor_second import CONFIG
from providor.window_mapping_provider import WINDOW_MAPPING_PROVIDER, UIElementMapping
from utils.integrated_window_analyzer import IntegratedWindowAnalyzer
import win32gui
import win32con
import win32api

class IntegratedAutomationController:
    """
    Advanced UI automation controller using integrated analysis and mapping
    Provides real-time element discovery and automation
    """
    
    def __init__(self):
        """Initialize integrated automation controller"""
        # Load configuration
        ui_settings = CONFIG.get('ui_automation', {})
        error_settings = CONFIG.get('error_handling', {})

        self.auto_configure_ui = ui_settings.get('auto_configure_ui', True)
        self.ui_operation_delay = ui_settings.get('ui_operation_delay', 1.0)
        self.tab_item_names = ui_settings.get('tab_item_names', ['主档案'])
        self.profile_combobox_text = ui_settings.get('profile_combobox_text', '火鸟')
        self.sequence_combobox_names = ui_settings.get('sequence_combobox_names', ['大小秘境'])

        # Enhanced configuration
        self.max_retry_attempts = ui_settings.get('max_retry_attempts', 3)
        self.element_search_timeout = ui_settings.get('element_search_timeout', 10)
        self.auto_refresh_mapping = ui_settings.get('auto_refresh_mapping', True)
        self.use_live_controls = ui_settings.get('use_live_controls', True)
        self.coordinate_click_fallback = ui_settings.get('coordinate_click_fallback', True)
        self.detailed_logging = ui_settings.get('detailed_logging', True)

        # Initialize error handler
        self.error_handler = ErrorHandler(
            max_retries=error_settings.get('max_error_retries', 3),
            retry_delay=error_settings.get('error_recovery_delay', 2.0),
            detailed_logging=error_settings.get('detailed_error_logging', True),
            auto_recovery=error_settings.get('auto_error_recovery', True)
        )

        # Initialize integrated analyzer
        self.integrated_analyzer = IntegratedWindowAnalyzer()
        self.mapping_provider = WINDOW_MAPPING_PROVIDER

        ColorPrint.green("[INIT] IntegratedAutomationController initialized with enhanced features")
        ColorPrint.blue(f"[CONFIG] Auto configure UI: {self.auto_configure_ui}")
        ColorPrint.blue(f"[CONFIG] Max retry attempts: {self.max_retry_attempts}")
        ColorPrint.blue(f"[CONFIG] Use live controls: {self.use_live_controls}")
        ColorPrint.blue(f"[CONFIG] Auto refresh mapping: {self.auto_refresh_mapping}")
        ColorPrint.blue(f"[CONFIG] Detailed logging: {self.detailed_logging}")
    
    def perform_integrated_ui_automation(self, window_titles: List[str], process_name: str) -> Dict[str, Any]:
        """
        Perform complete UI automation using integrated analysis and mapping
        """
        try:
            if not self.auto_configure_ui:
                ColorPrint.gray("[UI_SKIP] UI automation disabled in configuration")
                return {"success": True, "skipped": True, "reason": "UI automation disabled"}
            
            ColorPrint.blue(f"[INTEGRATED_UI] Starting integrated UI automation for '{process_name}'")
            
            # Step 1: Analyze and map the window
            analysis_result = self.integrated_analyzer.analyze_and_map_window(window_titles, process_name)
            
            if not analysis_result.get("success", False):
                return {"success": False, "error": f"Window analysis failed: {analysis_result.get('error', 'Unknown')}"}
            
            window_handle = analysis_result.get("window_handle", 0)
            actual_window_title = analysis_result.get("actual_window_title", "")
            
            ColorPrint.green(f"[INTEGRATED_UI] Window analyzed: '{actual_window_title}' (handle: {window_handle})")
            
            # Step 2: Activate window
            try:
                win32gui.SetForegroundWindow(window_handle)
                win32gui.ShowWindow(window_handle, win32con.SW_RESTORE)
                time.sleep(1)
                ColorPrint.blue("[INTEGRATED_UI] Window activated")
            except Exception as e:
                ColorPrint.yellow(f"[INTEGRATED_UI] Window activation warning: {e}")
            
            # Step 3: Perform automation steps
            results = {
                "tab_clicked": False,
                "profile_selected": False,
                "sequence_selected": False,
                "start_clicked": False
            }
            
            # Step 3.1: Click tab item
            results["tab_clicked"] = self._click_tab_item_integrated(window_handle)
            time.sleep(self.ui_operation_delay)
            
            # Step 3.2: Select profile combobox
            results["profile_selected"] = self._select_profile_combobox_integrated(window_handle)
            time.sleep(self.ui_operation_delay)
            
            # Step 3.3: Select sequence combobox
            results["sequence_selected"] = self._select_sequence_combobox_integrated(window_handle)
            time.sleep(self.ui_operation_delay)
            
            # Step 3.4: Click start button
            results["start_clicked"] = self._click_start_button_integrated(window_handle)
            
            # Calculate success
            success_count = sum(1 for result in results.values() if result)
            total_steps = len(results)
            overall_success = results["start_clicked"] or success_count >= 2
            
            ColorPrint.blue(f"[INTEGRATED_UI] Automation completed: {success_count}/{total_steps} steps successful")
            
            return {
                "success": overall_success,
                "results": results,
                "success_count": success_count,
                "total_steps": total_steps,
                "method": "integrated_analysis",
                "window_handle": window_handle,
                "window_title": actual_window_title,
                "analysis_result": analysis_result
            }
            
        except Exception as e:
            ColorPrint.red(f"[INTEGRATED_UI] Critical error in integrated UI automation: {e}")
            import traceback
            return {"success": False, "error": str(e), "traceback": traceback.format_exc()}
    
    def _click_tab_item_integrated(self, window_handle: int) -> bool:
        """Click tab item using integrated analysis"""
        try:
            ColorPrint.blue("[UI_STEP_1] Finding tab item using integrated analysis...")
            
            # Find tab controls
            tab_elements = self.integrated_analyzer.find_and_get_elements(
                window_handle, 
                {"type": "TabItemControl"}
            )
            
            ColorPrint.blue(f"[UI_STEP_1] Found {len(tab_elements)} tab controls")
            
            # Find matching tab
            for tab_element in tab_elements:
                tab_name = tab_element.element_name
                ColorPrint.gray(f"[TAB_FOUND] '{tab_name}'")
                
                for search_name in self.tab_item_names:
                    if search_name in tab_name:
                        ColorPrint.green(f"[TAB_MATCH] Found matching tab: '{tab_name}'")
                        
                        # Try to get live control and click
                        live_control = self.integrated_analyzer.get_live_ui_control(tab_element)
                        if live_control:
                            try:
                                live_control.Click()
                                ColorPrint.green("[UI_STEP_1] ✓ Tab clicked using live control")
                                return True
                            except Exception as e:
                                ColorPrint.yellow(f"[UI_STEP_1] Live control click failed: {e}")
                        
                        # Fallback to coordinate click
                        center_x, center_y = tab_element.get_center_point()
                        if center_x > 0 and center_y > 0:
                            win32api.SetCursorPos((center_x, center_y))
                            win32api.mouse_event(2, 0, 0)  # Left button down
                            win32api.mouse_event(4, 0, 0)  # Left button up
                            ColorPrint.green(f"[UI_STEP_1] ✓ Tab clicked at coordinates ({center_x}, {center_y})")
                            return True
                        
                        break
            
            ColorPrint.yellow("[UI_STEP_1] ✗ No matching tab found")
            return False
            
        except Exception as e:
            ColorPrint.red(f"[UI_STEP_1] ✗ Error clicking tab: {e}")
            return False
    
    def _select_profile_combobox_integrated(self, window_handle: int) -> bool:
        """Select profile combobox using integrated analysis"""
        try:
            ColorPrint.blue("[UI_STEP_2] Finding profile combobox using integrated analysis...")
            
            # Find profile combobox by automation ID
            profile_elements = self.integrated_analyzer.find_and_get_elements(
                window_handle,
                {"type": "ComboBoxControl", "automation_id": "cmbMasterProfile"}
            )
            
            ColorPrint.blue(f"[UI_STEP_2] Found {len(profile_elements)} profile comboboxes")
            
            if not profile_elements:
                ColorPrint.yellow("[UI_STEP_2] ✗ Profile combobox not found")
                return False
            
            profile_element = profile_elements[0]
            ColorPrint.green(f"[PROFILE_FOUND] Profile combobox: '{profile_element.element_name}'")
            
            # Try to get live control and interact
            live_control = self.integrated_analyzer.get_live_ui_control(profile_element)
            if live_control:
                try:
                    # Click to open dropdown
                    live_control.Click()
                    time.sleep(0.5)
                    
                    # Try to find and select item containing profile text
                    # This is a simplified approach - in practice, you might need to enumerate dropdown items
                    ColorPrint.green("[UI_STEP_2] ✓ Profile combobox clicked (dropdown opened)")
                    return True
                    
                except Exception as e:
                    ColorPrint.yellow(f"[UI_STEP_2] Live control interaction failed: {e}")
            
            # Fallback to coordinate click
            center_x, center_y = profile_element.get_center_point()
            if center_x > 0 and center_y > 0:
                win32api.SetCursorPos((center_x, center_y))
                win32api.mouse_event(2, 0, 0)  # Left button down
                win32api.mouse_event(4, 0, 0)  # Left button up
                ColorPrint.green(f"[UI_STEP_2] ✓ Profile combobox clicked at ({center_x}, {center_y})")
                return True
            
            return False
            
        except Exception as e:
            ColorPrint.red(f"[UI_STEP_2] ✗ Error selecting profile: {e}")
            return False
    
    def _select_sequence_combobox_integrated(self, window_handle: int) -> bool:
        """Select sequence combobox using integrated analysis"""
        try:
            ColorPrint.blue("[UI_STEP_3] Finding sequence combobox using integrated analysis...")
            
            # Find sequence combobox by automation ID
            sequence_elements = self.integrated_analyzer.find_and_get_elements(
                window_handle,
                {"type": "ComboBoxControl", "automation_id": "cmbSequence"}
            )
            
            ColorPrint.blue(f"[UI_STEP_3] Found {len(sequence_elements)} sequence comboboxes")
            
            if not sequence_elements:
                ColorPrint.yellow("[UI_STEP_3] ✗ Sequence combobox not found")
                return False
            
            sequence_element = sequence_elements[0]
            ColorPrint.green(f"[SEQUENCE_FOUND] Sequence combobox found")
            
            # Try to get live control and interact
            live_control = self.integrated_analyzer.get_live_ui_control(sequence_element)
            if live_control:
                try:
                    live_control.Click()
                    time.sleep(0.5)
                    ColorPrint.green("[UI_STEP_3] ✓ Sequence combobox clicked (dropdown opened)")
                    return True
                except Exception as e:
                    ColorPrint.yellow(f"[UI_STEP_3] Live control interaction failed: {e}")
            
            # Fallback to coordinate click
            center_x, center_y = sequence_element.get_center_point()
            if center_x > 0 and center_y > 0:
                win32api.SetCursorPos((center_x, center_y))
                win32api.mouse_event(2, 0, 0)  # Left button down
                win32api.mouse_event(4, 0, 0)  # Left button up
                ColorPrint.green(f"[UI_STEP_3] ✓ Sequence combobox clicked at ({center_x}, {center_y})")
                return True
            
            return False
            
        except Exception as e:
            ColorPrint.red(f"[UI_STEP_3] ✗ Error selecting sequence: {e}")
            return False
    
    def _click_start_button_integrated(self, window_handle: int) -> bool:
        """Click start button using integrated analysis"""
        try:
            ColorPrint.blue("[UI_STEP_4] Finding start button using integrated analysis...")
            
            # Find start button by automation ID or name
            start_elements = self.integrated_analyzer.find_and_get_elements(
                window_handle,
                {"type": "ButtonControl", "automation_id": "btnStart"}
            )
            
            # If not found by automation ID, try by name
            if not start_elements:
                start_elements = self.integrated_analyzer.find_and_get_elements(
                    window_handle,
                    {"type": "ButtonControl", "name_contains": "Start botting"}
                )
            
            ColorPrint.blue(f"[UI_STEP_4] Found {len(start_elements)} start buttons")
            
            if not start_elements:
                ColorPrint.yellow("[UI_STEP_4] ✗ Start button not found")
                return False
            
            start_element = start_elements[0]
            ColorPrint.green(f"[START_FOUND] Start button: '{start_element.element_name}'")
            
            # Try to get live control and click
            live_control = self.integrated_analyzer.get_live_ui_control(start_element)
            if live_control:
                try:
                    live_control.Click()
                    ColorPrint.green("[UI_STEP_4] ✓ Start button clicked using live control")
                    return True
                except Exception as e:
                    ColorPrint.yellow(f"[UI_STEP_4] Live control click failed: {e}")
            
            # Fallback to coordinate click
            center_x, center_y = start_element.get_center_point()
            if center_x > 0 and center_y > 0:
                win32api.SetCursorPos((center_x, center_y))
                win32api.mouse_event(2, 0, 0)  # Left button down
                win32api.mouse_event(4, 0, 0)  # Left button up
                ColorPrint.green(f"[UI_STEP_4] ✓ Start button clicked at ({center_x}, {center_y})")
                return True
            
            return False
            
        except Exception as e:
            ColorPrint.red(f"[UI_STEP_4] ✗ Error clicking start button: {e}")
            return False
    
    def quick_automation_by_criteria(self, window_titles: List[str], process_name: str, 
                                   automation_steps: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Perform quick automation based on a list of criteria-based steps
        Each step should have: {"action": "click", "criteria": {...}, "description": "..."}
        """
        try:
            ColorPrint.blue(f"[QUICK_AUTO] Starting quick automation for '{process_name}' with {len(automation_steps)} steps")
            
            # Analyze and map window first
            analysis_result = self.integrated_analyzer.analyze_and_map_window(window_titles, process_name)
            
            if not analysis_result.get("success", False):
                return {"success": False, "error": f"Window analysis failed: {analysis_result.get('error', 'Unknown')}"}
            
            window_handle = analysis_result.get("window_handle", 0)
            
            # Activate window
            try:
                win32gui.SetForegroundWindow(window_handle)
                win32gui.ShowWindow(window_handle, win32con.SW_RESTORE)
                time.sleep(1)
            except Exception as e:
                ColorPrint.yellow(f"[QUICK_AUTO] Window activation warning: {e}")
            
            # Execute steps
            results = {}
            for i, step in enumerate(automation_steps):
                step_name = step.get("description", f"Step_{i+1}")
                action = step.get("action", "click")
                criteria = step.get("criteria", {})
                
                ColorPrint.blue(f"[QUICK_AUTO] Executing step: {step_name}")
                
                if action == "click":
                    success = self._execute_click_step(window_handle, criteria, step_name)
                    results[step_name] = success
                    
                    if success:
                        ColorPrint.green(f"[QUICK_AUTO] ✓ {step_name} completed")
                    else:
                        ColorPrint.red(f"[QUICK_AUTO] ✗ {step_name} failed")
                    
                    time.sleep(self.ui_operation_delay)
                else:
                    ColorPrint.yellow(f"[QUICK_AUTO] Unsupported action: {action}")
                    results[step_name] = False
            
            success_count = sum(1 for result in results.values() if result)
            total_steps = len(results)
            
            return {
                "success": success_count > 0,
                "results": results,
                "success_count": success_count,
                "total_steps": total_steps,
                "method": "quick_automation"
            }
            
        except Exception as e:
            ColorPrint.red(f"[QUICK_AUTO] Error in quick automation: {e}")
            return {"success": False, "error": str(e)}
    
    def _execute_click_step(self, window_handle: int, criteria: Dict[str, Any], step_name: str) -> bool:
        """Execute a click step based on criteria"""
        try:
            elements = self.integrated_analyzer.find_and_get_elements(window_handle, criteria)
            
            if not elements:
                ColorPrint.yellow(f"[CLICK_STEP] No elements found for {step_name}")
                return False
            
            element = elements[0]  # Use first matching element
            
            # Try live control first
            live_control = self.integrated_analyzer.get_live_ui_control(element)
            if live_control:
                try:
                    live_control.Click()
                    return True
                except:
                    pass
            
            # Fallback to coordinate click
            center_x, center_y = element.get_center_point()
            if center_x > 0 and center_y > 0:
                win32api.SetCursorPos((center_x, center_y))
                win32api.mouse_event(2, 0, 0)
                win32api.mouse_event(4, 0, 0)
                return True
            
            return False
            
        except Exception as e:
            ColorPrint.red(f"[CLICK_STEP] Error in click step: {e}")
            return False

def main():
    """Test function"""
    controller = IntegratedAutomationController()
    
    # Test quick automation steps
    automation_steps = [
        {
            "action": "click",
            "criteria": {"type": "TabItemControl", "name_contains": "主档案"},
            "description": "Click_Tab"
        },
        {
            "action": "click", 
            "criteria": {"type": "ComboBoxControl", "automation_id": "cmbMasterProfile"},
            "description": "Select_Profile"
        },
        {
            "action": "click",
            "criteria": {"type": "ButtonControl", "automation_id": "btnStart"},
            "description": "Click_Start"
        }
    ]
    
    result = controller.quick_automation_by_criteria(["Test Window"], "TestProcess", automation_steps)
    ColorPrint.blue(f"Quick automation result: {result}")

if __name__ == "__main__":
    main()
