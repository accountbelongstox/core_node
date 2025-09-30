#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Battle.net Controller
Coordinates Battle.net analysis and click operations
"""

import os
import sys
from typing import Dict

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

from providor.providor_second import CONFIG
from base.color_print import ColorPrint
from utils.program_manager import ProgramManager
from utils.tray_clicker import TrayIconClicker
from utils.integrated_automation_controller import IntegratedAutomationController
from utils.game_process_detector import GameProcessDetector


class BattleNetController:
    """Coordinates Battle.net analysis and click operations"""
    
    def __init__(self):
        # Get battlenet_path from CONFIG
        self.battlenet_path = CONFIG.get('battlenet', {}).get('battlenet_path', '')
        # Get window titles from CONFIG
        self.window_titles = CONFIG.get('battlenet', {}).get('window_titles', ['Battle.net', '战网'])
        # Get program name from CONFIG
        self.program_name = CONFIG.get('battlenet', {}).get('program_name', 'BattleNet')
        # Create ProgramManager instance with Battle.net window titles
        self.program_manager = ProgramManager(
            self.battlenet_path, 
            window_titles=self.window_titles
        )
        # Create IntegratedAutomationController for advanced UI automation
        self.integrated_automation = IntegratedAutomationController()
        # Create TrayIconClicker instance for fallback activation
        self.tray_clicker = TrayIconClicker()
        # Create GameProcessDetector instance for game process detection
        self.game_detector = GameProcessDetector()

        ColorPrint.green("[INIT] BattleNetController initialized with integrated automation")
        ColorPrint.blue(f"[CONFIG] Battle.net path: {self.battlenet_path}")
        ColorPrint.blue(f"[CONFIG] Window titles: {self.window_titles}")
        ColorPrint.blue(f"[CONFIG] Program name: {self.program_name}")

    def perform_integrated_battlenet_automation(self) -> Dict:
        """Perform complete Battle.net automation using integrated system"""
        try:
            ColorPrint.blue("[BATTLENET_AUTO] Starting integrated Battle.net automation...")

            # Step 1: Ensure Battle.net is running and activated
            if not self.ensure_battlenet_running_and_activated():
                return {"success": False, "error": "Failed to start/activate Battle.net"}

            # Step 2: Define Battle.net automation steps
            battlenet_steps = [
                {
                    "action": "click",
                    "criteria": {"type": "ButtonControl", "name_contains": "Diablo"},
                    "description": "Click_Diablo_Game"
                },
                {
                    "action": "click",
                    "criteria": {"type": "ButtonControl", "name_contains": "Play"},
                    "description": "Click_Play_Button"
                }
            ]

            # Step 3: Perform integrated automation
            result = self.integrated_automation.quick_automation_by_criteria(
                self.window_titles,
                self.program_name,
                battlenet_steps
            )

            if result.get("success", False):
                ColorPrint.green("[BATTLENET_AUTO] Battle.net automation completed successfully")

                # Wait for Diablo to launch
                import time
                ColorPrint.blue("[BATTLENET_AUTO] Waiting for Diablo III to launch...")
                time.sleep(5)

                # Check if Diablo launched
                diablo_info = self.game_detector.detect_diablo_process()
                if diablo_info:
                    ColorPrint.green("[BATTLENET_AUTO] ✓ Diablo III launched successfully")
                    result["diablo_launched"] = True
                    result["diablo_info"] = diablo_info
                else:
                    ColorPrint.yellow("[BATTLENET_AUTO] ⚠ Diablo III not detected yet")
                    result["diablo_launched"] = False

                return result
            else:
                ColorPrint.red(f"[BATTLENET_AUTO] Battle.net automation failed: {result.get('error', 'Unknown')}")
                return result

        except Exception as e:
            ColorPrint.red(f"[BATTLENET_AUTO] Error in integrated Battle.net automation: {e}")
            return {"success": False, "error": str(e)}

    def quick_launch_diablo(self) -> Dict:
        """Quick launch Diablo III using integrated automation"""
        try:
            ColorPrint.blue("[QUICK_LAUNCH] Quick launching Diablo III...")

            # Use integrated automation for quick click
            success = self.integrated_automation.quick_find_and_click(
                self.window_titles,
                self.program_name,
                {"type": "ButtonControl", "name_contains": "Diablo"}
            )

            if success:
                ColorPrint.green("[QUICK_LAUNCH] Diablo game button clicked")

                # Try to click Play button
                import time
                time.sleep(2)

                play_success = self.integrated_automation.quick_find_and_click(
                    self.window_titles,
                    self.program_name,
                    {"type": "ButtonControl", "name_contains": "Play"}
                )

                if play_success:
                    ColorPrint.green("[QUICK_LAUNCH] Play button clicked")
                    return {"success": True, "diablo_clicked": True, "play_clicked": True}
                else:
                    ColorPrint.yellow("[QUICK_LAUNCH] Play button click failed")
                    return {"success": True, "diablo_clicked": True, "play_clicked": False}
            else:
                ColorPrint.red("[QUICK_LAUNCH] Diablo game button click failed")
                return {"success": False, "diablo_clicked": False, "play_clicked": False}

        except Exception as e:
            ColorPrint.red(f"[QUICK_LAUNCH] Error in quick launch: {e}")
            return {"success": False, "error": str(e)}

    def ensure_battlenet_running_and_activated(self) -> bool:
        """Ensure Battle.net is running and activated"""
        ColorPrint.green(f"📁 Battle.net path from CONFIG: {self.battlenet_path}")
        return self.program_manager.ensure_program_running_and_activated()
    
    def analyze_battlenet_window(self) -> Dict:
        """Analyze Battle.net window and generate screenshots, position info, and JSON"""
        ColorPrint.yellow("🔍 Starting Battle.net window analysis...")
        
        # First try to ensure Battle.net is running and activated
        activation_result = self.ensure_battlenet_running_and_activated()
        
        if not activation_result:
            ColorPrint.red("❌ Failed to start/activate Battle.net")
            return {"success": False, "error": "Failed to start/activate Battle.net"}
        
        # Check if program was just started and adjust wait time accordingly
        was_just_started = self.program_manager.was_just_started
        if was_just_started:
            ColorPrint.gray("   Program was just started, waiting longer before analysis...")
            import time
            time.sleep(5)  # Additional wait for newly started programs
        
        # Try to analyze window with regular activation
        ColorPrint.green("✅ Battle.net is running, analyzing window...")
        analysis_result = self.window_analyzer.analyze_window(
            window_titles=self.window_titles,
            program_name=self.program_name
        )
        
        # If analysis failed, try tray clicker activation
        if not analysis_result.get("success", False):
            ColorPrint.yellow("⚠️  Window analysis failed, trying tray clicker activation...")
            
            # Try tray clicker activation
            if self.tray_clicker.click_tray_icon(self.battlenet_path):
                ColorPrint.green("✅ Tray clicker activation successful, retrying analysis...")
                
                # Wait longer for window to fully activate and appear
                import time
                if was_just_started:
                    ColorPrint.gray("   Program was just started, using longer wait time...")
                    time.sleep(10)  # Longer wait for newly started programs
                else:
                    time.sleep(5)  # Normal wait time
                
                # Retry analysis after tray activation with multiple attempts
                for attempt in range(3):
                    ColorPrint.gray(f"   Retry attempt {attempt + 1}/3...")
                    analysis_result = self.window_analyzer.analyze_window(
                        window_titles=self.window_titles,
                        program_name=self.program_name
                    )
                    
                    if analysis_result.get("success", False):
                        ColorPrint.green("✅ Window analysis successful after tray activation")
                        break
                    else:
                        if attempt < 2:  # Not the last attempt
                            ColorPrint.yellow(f"   Attempt {attempt + 1} failed, waiting 2 seconds...")
                            time.sleep(2)
                        else:
                            ColorPrint.red("❌ Window analysis failed even after tray activation")
            else:
                ColorPrint.red("❌ Tray clicker activation also failed")
        
        # If window analysis was successful, try to click Diablo III button
        if analysis_result.get("success", False):
            ColorPrint.green("🎮 Window analysis completed, attempting to click Diablo III button...")
            
            # Get the window handle from the analysis result
            window_info = analysis_result.get("window_info", {})
            window_handle = window_info.get("hwnd")
            
            if window_handle:
                # Try to click Diablo III button
                if self.diablo_clicker.click_diablo3_button(window_handle):
                    ColorPrint.green("✅ Diablo III button clicked successfully!")
                    analysis_result["diablo_clicked"] = True

                    # After successful Diablo III button click, try to click Play button
                    ColorPrint.blue("[NEXT_STEP] Attempting to click Play button...")
                    if self.play_clicker.click_play_button(window_handle):
                        ColorPrint.green("[PLAY_SUCCESS] Play button clicked successfully!")
                        analysis_result["play_clicked"] = True

                        # After successful Play button click, wait for game process
                        ColorPrint.blue("[GAME_DETECT] Waiting for Diablo III game process...")
                        game_process = self.game_detector.wait_for_diablo_process(timeout_seconds=60, check_interval=3.0)

                        if game_process:
                            ColorPrint.green("[GAME_SUCCESS] Diablo III game launched successfully!")
                            ColorPrint.green(f"[GAME_INFO] Game window: '{game_process['title']}'")
                            ColorPrint.green(f"[GAME_INFO] Window handle: {game_process['hwnd']}")
                            analysis_result["game_launched"] = True
                            analysis_result["game_window_title"] = game_process['title']
                            analysis_result["game_window_handle"] = game_process['hwnd']
                        else:
                            ColorPrint.yellow("[GAME_WARNING] Diablo III game process not detected")
                            analysis_result["game_launched"] = False
                    else:
                        ColorPrint.yellow("[PLAY_WARNING] Failed to click Play button")
                        analysis_result["play_clicked"] = False
                        analysis_result["game_launched"] = False
                else:
                    ColorPrint.yellow("⚠️  Failed to click Diablo III button")
                    analysis_result["diablo_clicked"] = False
                    analysis_result["play_clicked"] = False
                    analysis_result["game_launched"] = False
            else:
                ColorPrint.red("❌ Could not get window handle for Diablo III button clicking")
                analysis_result["diablo_clicked"] = False
                analysis_result["play_clicked"] = False
                analysis_result["game_launched"] = False
        analysis_result = self.window_analyzer.analyze_window(
            window_titles=self.window_titles,
            program_name=self.program_name
        )
        return analysis_result


def analyze_battlenet_window_with_fallback() -> Dict:
    """Analyze Battle.net window with fallback activation - Main exported method"""
    controller = BattleNetController()
    
    print("🔍 Starting Battle.net window analysis with fallback activation...")
    result = controller.analyze_battlenet_window()
    
    if result.get("success", False):
        print("✅ Battle.net window analysis completed successfully")
        print(f"📁 Files generated:")
        for file_type, file_path in result.get("files", {}).items():
            print(f"   {file_type}: {file_path}")
        
        # Report Diablo III button clicking result
        if result.get("diablo_clicked", False):
            print("[DIABLO_SUCCESS] Diablo III button clicked successfully!")

            # Report Play button clicking result
            if result.get("play_clicked", False):
                print("[PLAY_SUCCESS] Play button clicked successfully!")

                # Report game launch detection result
                if result.get("game_launched", False):
                    print("[GAME_SUCCESS] Diablo III game launched successfully!")
                    print(f"[GAME_INFO] Game window: '{result.get('game_window_title', 'Unknown')}'")
                    print(f"[GAME_INFO] Window handle: {result.get('game_window_handle', 'Unknown')}")
                    print("[COMPLETE] Full Battle.net automation sequence completed successfully!")
                else:
                    print("[GAME_WARNING] Diablo III game launch not detected")
                    print("[PARTIAL] Battle.net automation partially completed")
            else:
                print("[PLAY_WARNING] Play button clicking failed or not attempted")
        else:
            print("[DIABLO_WARNING] Diablo III button clicking failed or not attempted")
    else:
        print(f"❌ Battle.net window analysis failed: {result.get('error', 'Unknown error')}")
    
    return result 