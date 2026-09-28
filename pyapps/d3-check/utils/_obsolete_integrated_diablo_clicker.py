#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Integrated Diablo Button Clicker
Advanced Diablo III button clicking using integrated automation system
Replaces the legacy DiabloButtonClicker with modern integrated approach
"""

import os
import sys
from typing import Dict, List, Optional

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

# Add ncore path

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from utils.integrated_automation_controller import IntegratedAutomationController
from providor.providor_second import CONFIG

class IntegratedDiabloClicker:
    """
    Advanced Diablo III button clicker using integrated automation
    Provides multiple strategies for finding and clicking Diablo buttons
    """
    
    def __init__(self):
        """Initialize integrated Diablo clicker"""
        # Load configuration
        battlenet_settings = CONFIG.get('battlenet', {})
        self.diablo_iii_tab_auto_id = battlenet_settings.get('diablo_iii_tab_auto_id', '')
        
        # Initialize integrated automation
        self.integrated_automation = IntegratedAutomationController()
        
        ColorPrint.green("[INIT] IntegratedDiabloClicker initialized")
        ColorPrint.blue(f"[CONFIG] Diablo III tab auto ID: {self.diablo_iii_tab_auto_id}")
    
    def click_diablo_button_smart(self, window_titles: List[str], process_name: str = "BattleNet") -> Dict:
        """
        Smart Diablo button clicking with multiple fallback strategies
        """
        try:
            ColorPrint.blue("[DIABLO_SMART] Starting smart Diablo button click...")
            
            # Strategy 1: Try by automation ID (most reliable)
            if self.diablo_iii_tab_auto_id:
                ColorPrint.blue("[DIABLO_SMART] Strategy 1: Automation ID")
                result = self._try_click_by_criteria(
                    window_titles, process_name,
                    {"automation_id": self.diablo_iii_tab_auto_id},
                    "automation_id"
                )
                if result["success"]:
                    return result
            
            # Strategy 2: Try by name containing "Diablo"
            ColorPrint.blue("[DIABLO_SMART] Strategy 2: Name contains 'Diablo'")
            result = self._try_click_by_criteria(
                window_titles, process_name,
                {"type": "ButtonControl", "name_contains": "Diablo"},
                "name_contains_diablo"
            )
            if result["success"]:
                return result
            
            # Strategy 3: Try by name containing Chinese characters
            ColorPrint.blue("[DIABLO_SMART] Strategy 3: Name contains Chinese")
            result = self._try_click_by_criteria(
                window_titles, process_name,
                {"type": "ButtonControl", "name_contains": "暗黑"},
                "name_contains_chinese"
            )
            if result["success"]:
                return result
            
            # Strategy 4: Try any button with Diablo-related class name
            ColorPrint.blue("[DIABLO_SMART] Strategy 4: Class name contains 'diablo'")
            result = self._try_click_by_criteria(
                window_titles, process_name,
                {"type": "ButtonControl", "class_name_contains": "diablo"},
                "class_name_diablo"
            )
            if result["success"]:
                return result
            
            # Strategy 5: Advanced search - analyze all buttons and find best match
            ColorPrint.blue("[DIABLO_SMART] Strategy 5: Advanced button analysis")
            result = self._advanced_diablo_search(window_titles, process_name)
            if result["success"]:
                return result
            
            ColorPrint.red("[DIABLO_SMART] All strategies failed")
            return {"success": False, "error": "All click strategies failed"}
            
        except Exception as e:
            ColorPrint.red(f"[DIABLO_SMART] Error in smart Diablo click: {e}")
            return {"success": False, "error": str(e)}
    
    def _try_click_by_criteria(self, window_titles: List[str], process_name: str, 
                              criteria: Dict, strategy_name: str) -> Dict:
        """Try to click using specific criteria"""
        try:
            success = self.integrated_automation.quick_find_and_click(
                window_titles, process_name, criteria
            )
            
            if success:
                ColorPrint.green(f"[DIABLO_CLICK] ✓ Success using {strategy_name}")
                return {
                    "success": True,
                    "strategy": strategy_name,
                    "criteria": criteria
                }
            else:
                ColorPrint.yellow(f"[DIABLO_CLICK] ✗ Failed using {strategy_name}")
                return {"success": False, "strategy": strategy_name}
                
        except Exception as e:
            ColorPrint.red(f"[DIABLO_CLICK] Error in {strategy_name}: {e}")
            return {"success": False, "strategy": strategy_name, "error": str(e)}
    
    def _advanced_diablo_search(self, window_titles: List[str], process_name: str) -> Dict:
        """Advanced search for Diablo button by analyzing all buttons"""
        try:
            ColorPrint.blue("[ADVANCED_SEARCH] Analyzing all buttons for Diablo match...")
            
            # Get all buttons in the window
            success, elements, live_controls = self.integrated_automation.integrated_analyzer.analyze_find_and_prepare(
                window_titles, process_name, {"type": "ButtonControl"}
            )
            
            if not success or not elements:
                return {"success": False, "error": "No buttons found"}
            
            ColorPrint.blue(f"[ADVANCED_SEARCH] Found {len(elements)} buttons to analyze")
            
            # Score each button based on how likely it is to be the Diablo button
            button_scores = []
            
            for i, element in enumerate(elements):
                score = 0
                reasons = []
                
                name = element.element_name.lower()
                automation_id = element.automation_id.lower()
                class_name = element.class_name.lower()
                
                # Scoring criteria
                if "diablo" in name:
                    score += 10
                    reasons.append("name_contains_diablo")
                
                if "暗黑" in element.element_name:
                    score += 10
                    reasons.append("name_contains_chinese")
                
                if self.diablo_iii_tab_auto_id and automation_id == self.diablo_iii_tab_auto_id.lower():
                    score += 15
                    reasons.append("automation_id_match")
                
                if "diablo" in automation_id:
                    score += 8
                    reasons.append("automation_id_contains_diablo")
                
                if "diablo" in class_name:
                    score += 5
                    reasons.append("class_name_contains_diablo")
                
                if "iii" in name or "3" in name:
                    score += 3
                    reasons.append("contains_version_number")
                
                if score > 0:
                    button_scores.append({
                        "element": element,
                        "live_control": live_controls[i] if i < len(live_controls) else None,
                        "score": score,
                        "reasons": reasons
                    })
                    
                    ColorPrint.gray(f"  Button '{element.element_name}': score {score} ({', '.join(reasons)})")
            
            if not button_scores:
                return {"success": False, "error": "No Diablo-related buttons found"}
            
            # Sort by score (highest first)
            button_scores.sort(key=lambda x: x["score"], reverse=True)
            
            # Try to click the highest scoring button
            best_button = button_scores[0]
            ColorPrint.green(f"[ADVANCED_SEARCH] Best match: '{best_button['element'].element_name}' (score: {best_button['score']})")
            
            # Try live control first
            if best_button["live_control"]:
                try:
                    best_button["live_control"].Click()
                    ColorPrint.green("[ADVANCED_SEARCH] ✓ Clicked using live control")
                    return {
                        "success": True,
                        "strategy": "advanced_search",
                        "method": "live_control",
                        "button_name": best_button["element"].element_name,
                        "score": best_button["score"],
                        "reasons": best_button["reasons"]
                    }
                except Exception as e:
                    ColorPrint.yellow(f"[ADVANCED_SEARCH] Live control failed: {e}")
            
            # Fallback to coordinate click
            center_x, center_y = best_button["element"].get_center_point()
            if center_x > 0 and center_y > 0:
                import win32api
                win32api.SetCursorPos((center_x, center_y))
                win32api.mouse_event(2, 0, 0)  # Left button down
                win32api.mouse_event(4, 0, 0)  # Left button up
                ColorPrint.green(f"[ADVANCED_SEARCH] ✓ Clicked at coordinates ({center_x}, {center_y})")
                return {
                    "success": True,
                    "strategy": "advanced_search",
                    "method": "coordinate_click",
                    "coordinates": (center_x, center_y),
                    "button_name": best_button["element"].element_name,
                    "score": best_button["score"],
                    "reasons": best_button["reasons"]
                }
            
            return {"success": False, "error": "Could not click best match button"}
            
        except Exception as e:
            ColorPrint.red(f"[ADVANCED_SEARCH] Error in advanced search: {e}")
            return {"success": False, "error": str(e)}
    
    def click_diablo_button_simple(self, window_titles: List[str], process_name: str = "BattleNet") -> Dict:
        """Simple Diablo button click - just try the most common approach"""
        try:
            ColorPrint.blue("[DIABLO_SIMPLE] Simple Diablo button click...")
            
            success = self.integrated_automation.quick_find_and_click(
                window_titles, process_name,
                {"type": "ButtonControl", "name_contains": "Diablo"}
            )
            
            if success:
                ColorPrint.green("[DIABLO_SIMPLE] ✓ Diablo button clicked successfully")
                return {"success": True, "method": "simple"}
            else:
                ColorPrint.red("[DIABLO_SIMPLE] ✗ Simple click failed")
                return {"success": False, "method": "simple"}
                
        except Exception as e:
            ColorPrint.red(f"[DIABLO_SIMPLE] Error in simple click: {e}")
            return {"success": False, "error": str(e)}
    
    def get_diablo_button_info(self, window_titles: List[str], process_name: str = "BattleNet") -> Dict:
        """Get information about available Diablo buttons without clicking"""
        try:
            ColorPrint.blue("[DIABLO_INFO] Getting Diablo button information...")
            
            # Analyze window and find all buttons
            success, elements, _ = self.integrated_automation.integrated_analyzer.analyze_find_and_prepare(
                window_titles, process_name, {"type": "ButtonControl"}
            )
            
            if not success or not elements:
                return {"success": False, "error": "No buttons found"}
            
            # Find Diablo-related buttons
            diablo_buttons = []
            for element in elements:
                name = element.element_name.lower()
                automation_id = element.automation_id.lower()
                
                if ("diablo" in name or "暗黑" in element.element_name or 
                    "diablo" in automation_id or 
                    (self.diablo_iii_tab_auto_id and automation_id == self.diablo_iii_tab_auto_id.lower())):
                    
                    diablo_buttons.append({
                        "name": element.element_name,
                        "automation_id": element.automation_id,
                        "class_name": element.class_name,
                        "rect": element.rect,
                        "is_enabled": element.is_enabled,
                        "is_visible": element.is_visible
                    })
            
            ColorPrint.blue(f"[DIABLO_INFO] Found {len(diablo_buttons)} Diablo-related buttons")
            
            for i, button in enumerate(diablo_buttons):
                ColorPrint.gray(f"  {i+1}. '{button['name']}' (ID: {button['automation_id']})")
            
            return {
                "success": True,
                "total_buttons": len(elements),
                "diablo_buttons": diablo_buttons,
                "diablo_button_count": len(diablo_buttons)
            }
            
        except Exception as e:
            ColorPrint.red(f"[DIABLO_INFO] Error getting button info: {e}")
            return {"success": False, "error": str(e)}

def main():
    """Test function"""
    clicker = IntegratedDiabloClicker()
    
    # Test getting button info
    info_result = clicker.get_diablo_button_info(["Battle.net"], "BattleNet")
    ColorPrint.blue(f"Button info result: {info_result.get('success', False)}")
    
    # Test simple click (commented out to avoid actual clicking)
    # click_result = clicker.click_diablo_button_simple(["Battle.net"], "BattleNet")
    # ColorPrint.blue(f"Click result: {click_result.get('success', False)}")

if __name__ == "__main__":
    main()
