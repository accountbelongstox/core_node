#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Integrated Window Analyzer
Combines window analysis, mapping creation, and element finding in one integrated system
Provides real-time analysis-to-automation pipeline
"""

import os
import sys
import time
import json
from typing import Dict, List, Optional, Any, Tuple

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

from base.color_print import ColorPrint
from providor.window_mapping_provider import WINDOW_MAPPING_PROVIDER, UIElementMapping
from utils.window_analyzer import WindowAnalyzer
import uiautomation as auto


class IntegratedWindowAnalyzer:
    """
    Integrated window analyzer that combines analysis, mapping, and element finding
    Provides seamless analysis-to-automation pipeline
    """
    
    def __init__(self):
        """Initialize integrated window analyzer"""
        self.window_analyzer = WindowAnalyzer()
        self.mapping_provider = WINDOW_MAPPING_PROVIDER
        
        ColorPrint.green("[INIT] IntegratedWindowAnalyzer initialized")
    
    def analyze_and_map_window(self, window_titles: List[str], process_name: str, 
                              refresh_if_exists: bool = True) -> Dict[str, Any]:
        """
        Analyze window and create mapping in one operation
        Returns both analysis result and mapping information
        """
        try:
            ColorPrint.blue(f"[INTEGRATED] Starting integrated analysis for '{process_name}'")
            
            # Step 1: Perform window analysis
            analysis_result = self.window_analyzer.analyze_window(window_titles, process_name)
            
            if not analysis_result.get("success", False):
                ColorPrint.red(f"[INTEGRATED] Window analysis failed: {analysis_result.get('error', 'Unknown')}")
                return analysis_result
            
            # Step 2: Extract analysis data
            controls = analysis_result.get("controls", [])
            window_handle = analysis_result.get("window_handle", 0)
            actual_window_title = analysis_result.get("window_title", "")
            
            if not window_handle or not controls:
                ColorPrint.yellow("[INTEGRATED] No window handle or controls found")
                return analysis_result
            
            # Step 3: Check if mapping already exists
            existing_mapping = self.mapping_provider.get_window_mapping(window_handle)
            
            if existing_mapping and not refresh_if_exists:
                ColorPrint.blue(f"[INTEGRATED] Using existing mapping for '{actual_window_title}'")
                mapping_created = True
            else:
                # Step 4: Create or refresh mapping
                if existing_mapping:
                    ColorPrint.blue(f"[INTEGRATED] Refreshing existing mapping for '{actual_window_title}'")
                    mapping_created = self.mapping_provider.refresh_window_mapping(window_handle, controls)
                else:
                    ColorPrint.blue(f"[INTEGRATED] Creating new mapping for '{actual_window_title}'")
                    mapping_created = self.mapping_provider.register_window_mapping(
                        window_handle=window_handle,
                        window_title=actual_window_title,
                        process_name=process_name,
                        analysis_data=controls,
                        json_file_path=analysis_result.get("files", {}).get("json", ""),
                        screenshot_path=analysis_result.get("files", {}).get("screenshot", "")
                    )
            
            # Step 5: Enhance result with mapping information
            analysis_result["mapping_created"] = mapping_created
            analysis_result["window_handle"] = window_handle
            analysis_result["actual_window_title"] = actual_window_title
            analysis_result["elements_mapped"] = len(controls) if mapping_created else 0
            
            if mapping_created:
                ColorPrint.green(f"[INTEGRATED] Successfully created mapping with {len(controls)} elements")
            else:
                ColorPrint.red("[INTEGRATED] Failed to create mapping")
            
            return analysis_result
            
        except Exception as e:
            ColorPrint.red(f"[INTEGRATED] Error in integrated analysis: {e}")
            return {"success": False, "error": str(e)}
    
    def find_and_get_elements(self, window_handle: int, criteria: Dict[str, Any], 
                             auto_refresh: bool = True) -> List[UIElementMapping]:
        """
        Find elements and optionally refresh mapping if not found
        """
        try:
            # First attempt to find elements
            elements = self.mapping_provider.find_elements(window_handle, criteria)
            
            if elements or not auto_refresh:
                return elements
            
            # If no elements found and auto_refresh is enabled, refresh mapping
            ColorPrint.yellow(f"[INTEGRATED] No elements found, attempting to refresh mapping...")
            
            mapping = self.mapping_provider.get_window_mapping(window_handle)
            if not mapping:
                ColorPrint.red(f"[INTEGRATED] No mapping found for window handle {window_handle}")
                return []
            
            # Re-analyze the window
            refresh_result = self.analyze_and_map_window(
                [mapping.window_title], 
                mapping.process_name, 
                refresh_if_exists=True
            )
            
            if refresh_result.get("success", False):
                # Try finding elements again
                elements = self.mapping_provider.find_elements(window_handle, criteria)
                ColorPrint.blue(f"[INTEGRATED] After refresh, found {len(elements)} elements")
                return elements
            else:
                ColorPrint.red("[INTEGRATED] Failed to refresh mapping")
                return []
                
        except Exception as e:
            ColorPrint.red(f"[INTEGRATED] Error finding elements: {e}")
            return []
    
    def get_live_ui_control(self, element_mapping: UIElementMapping) -> Optional[Any]:
        """
        Get live UI automation control for an element mapping
        Attempts to find the actual UI control based on mapping data
        """
        try:
            # If we already have a cached control, check if it's still valid
            if element_mapping.ui_control and element_mapping.is_valid():
                return element_mapping.ui_control
            
            # Try to find the control using UI automation
            # First, get the window control
            try:
                window_handle = int(element_mapping.element_id.split('_')[0])
                window_control = auto.ControlFromHandle(window_handle)
                if not window_control or not window_control.Exists():
                    return None
            except (ValueError, IndexError):
                return None
            
            # Search for the control using various criteria
            search_criteria = []
            
            # Try by automation ID first (most reliable)
            if element_mapping.automation_id:
                search_criteria.append({"AutomationId": element_mapping.automation_id})
            
            # Try by name
            if element_mapping.element_name:
                search_criteria.append({"Name": element_mapping.element_name})
            
            # Try by class name and control type
            if element_mapping.class_name:
                search_criteria.append({"ClassName": element_mapping.class_name})
            
            for criteria in search_criteria:
                try:
                    # Find control using the criteria
                    found_control = window_control.FindFirstByPropertyCondition(**criteria)
                    if found_control and found_control.Exists():
                        # Cache the control
                        element_mapping.ui_control = found_control
                        ColorPrint.green(f"[INTEGRATED] Found live control for '{element_mapping.element_name}'")
                        return found_control
                except:
                    continue
            
            ColorPrint.yellow(f"[INTEGRATED] Could not find live control for '{element_mapping.element_name}'")
            return None
            
        except Exception as e:
            ColorPrint.red(f"[INTEGRATED] Error getting live UI control: {e}")
            return None
    
    def analyze_find_and_prepare(self, window_titles: List[str], process_name: str, 
                                search_criteria: Dict[str, Any]) -> Tuple[bool, List[UIElementMapping], Optional[Any]]:
        """
        Complete pipeline: analyze window, find elements, and prepare for automation
        Returns: (success, element_mappings, live_controls)
        """
        try:
            ColorPrint.blue(f"[PIPELINE] Starting complete analysis pipeline for '{process_name}'")
            
            # Step 1: Analyze and map
            analysis_result = self.analyze_and_map_window(window_titles, process_name)
            
            if not analysis_result.get("success", False):
                return False, [], None
            
            window_handle = analysis_result.get("window_handle", 0)
            
            # Step 2: Find elements
            elements = self.find_and_get_elements(window_handle, search_criteria)
            
            if not elements:
                ColorPrint.yellow(f"[PIPELINE] No elements found matching criteria: {search_criteria}")
                return True, [], None  # Analysis succeeded but no matching elements
            
            # Step 3: Get live controls for immediate use
            live_controls = []
            for element in elements:
                live_control = self.get_live_ui_control(element)
                if live_control:
                    live_controls.append(live_control)
            
            ColorPrint.green(f"[PIPELINE] Pipeline complete: {len(elements)} elements found, {len(live_controls)} live controls ready")
            
            return True, elements, live_controls
            
        except Exception as e:
            ColorPrint.red(f"[PIPELINE] Error in analysis pipeline: {e}")
            return False, [], None
    
    def quick_find_and_click(self, window_titles: List[str], process_name: str, 
                           click_criteria: Dict[str, Any]) -> bool:
        """
        Quick operation: analyze, find, and click in one call
        """
        try:
            ColorPrint.blue(f"[QUICK_CLICK] Quick click operation for '{process_name}'")
            
            success, elements, live_controls = self.analyze_find_and_prepare(
                window_titles, process_name, click_criteria
            )
            
            if not success or not elements:
                ColorPrint.red("[QUICK_CLICK] Failed to find elements for clicking")
                return False
            
            # Click the first matching element
            element = elements[0]
            
            # Try using live control first
            if live_controls and len(live_controls) > 0:
                try:
                    live_controls[0].Click()
                    ColorPrint.green(f"[QUICK_CLICK] Successfully clicked '{element.element_name}' using live control")
                    return True
                except Exception as e:
                    ColorPrint.yellow(f"[QUICK_CLICK] Live control click failed: {e}, trying coordinate click")
            
            # Fallback to coordinate click
            center_x, center_y = element.get_center_point()
            if center_x > 0 and center_y > 0:
                import win32api
                win32api.SetCursorPos((center_x, center_y))
                win32api.mouse_event(2, 0, 0)  # Left button down
                win32api.mouse_event(4, 0, 0)  # Left button up
                ColorPrint.green(f"[QUICK_CLICK] Successfully clicked '{element.element_name}' at ({center_x}, {center_y})")
                return True
            else:
                ColorPrint.red("[QUICK_CLICK] Invalid coordinates for clicking")
                return False
                
        except Exception as e:
            ColorPrint.red(f"[QUICK_CLICK] Error in quick click: {e}")
            return False
    
    def get_mapping_summary(self, window_handle: int) -> Dict[str, Any]:
        """Get summary of mapping for a window"""
        mapping = self.mapping_provider.get_window_mapping(window_handle)
        if not mapping:
            return {"error": "No mapping found"}
        
        element_types = {}
        for element in mapping.elements.values():
            element_types[element.element_type] = element_types.get(element.element_type, 0) + 1
        
        return {
            "window_title": mapping.window_title,
            "process_name": mapping.process_name,
            "total_elements": len(mapping.elements),
            "element_types": element_types,
            "last_refresh": mapping.last_refresh.isoformat(),
            "json_file": mapping.json_file_path,
            "screenshot": mapping.screenshot_path
        }


def main():
    """Test function"""
    analyzer = IntegratedWindowAnalyzer()
    
    # Test integrated analysis
    result = analyzer.analyze_and_map_window(["Test Window"], "TestProcess")
    ColorPrint.blue(f"Analysis result: {result.get('success', False)}")
    
    # Test element finding
    if result.get("success", False):
        window_handle = result.get("window_handle", 0)
        elements = analyzer.find_and_get_elements(window_handle, {"type": "ButtonControl"})
        ColorPrint.blue(f"Found {len(elements)} button elements")


if __name__ == "__main__":
    main()
