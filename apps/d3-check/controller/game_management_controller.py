#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game Management Controller
Orchestrates game process detection, state management, and RoS-BoT management
Handles communication between utils classes and manages state updates
"""

import os
import sys
import time
from typing import Dict, List, Optional

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

from base.color_print import ColorPrint
from state.game_state_manager import GameStateManager
from state.comprehensive_state_manager import ComprehensiveStateManager
from utils.game_process_detector import GameProcessDetector
from utils.rosbot_manager import RoSBotManager
from utils.ui_automation_controller import UIAutomationController
from utils.window_activator import WindowActivator


class GameManagementController:
    """
    Controller that orchestrates game management workflow
    Handles communication between utils classes and manages state updates
    """
    
    def __init__(self):
        """Initialize game management controller"""
        # Initialize state managers
        self.game_state_manager = GameStateManager()
        self.comprehensive_state_manager = ComprehensiveStateManager()
        
        # Initialize utils (no cross-dependencies)
        self.process_detector = GameProcessDetector()
        self.window_activator = WindowActivator()
        self.ui_automation_controller = UIAutomationController()
        
        # Initialize RoS-BoT manager (inject dependencies)
        self.rosbot_manager = RoSBotManager()
        
        ColorPrint.green("[INIT] GameManagementController initialized")
    
    def update_all_process_states(self):
        """Update all process states using process detector"""
        try:
            # Detect Diablo III
            diablo_info = self.process_detector.detect_diablo_process()
            if diablo_info:
                self.game_state_manager.update_diablo_state(
                    is_running=True,
                    pid=diablo_info.get('pid', 0),
                    window_handle=diablo_info.get('hwnd', 0),
                    window_title=diablo_info.get('title', '')
                )
                self.comprehensive_state_manager.update_diablo_status(
                    "running",
                    diablo_info.get('title', ''),
                    diablo_info.get('hwnd', 0)
                )
            else:
                self.game_state_manager.update_diablo_state(is_running=False)
                self.comprehensive_state_manager.update_diablo_status("not_running")
            
            # Detect RoS-BoT
            rosbot_info = self.process_detector.detect_rosbot_process()
            if rosbot_info:
                self.game_state_manager.update_rosbot_state(
                    is_running=True,
                    pid=rosbot_info.get('pid', 0),
                    window_handle=rosbot_info.get('hwnd', 0),
                    window_title=rosbot_info.get('title', '')
                )
            else:
                self.game_state_manager.update_rosbot_state(is_running=False)
            
            # Detect other exe processes
            other_exe_processes = self.process_detector.detect_other_exe_processes()
            
            # Update existing states to not running first
            for state in self.game_state_manager.get_other_exe_states():
                state.is_running = False
            
            # Update with detected processes
            for exe_name, process_info in other_exe_processes.items():
                self.game_state_manager.update_other_exe_state(
                    exe_name=exe_name,
                    is_running=True,
                    pid=process_info.get('pid', 0),
                    window_handle=process_info.get('hwnd', 0),
                    window_title=process_info.get('title', '')
                )
                
                # Update comprehensive state for the first running other exe
                if not self.comprehensive_state_manager.rosbot_state.current_other_exe:
                    self.comprehensive_state_manager.update_rosbot_startup_status(
                        "running",
                        exe_name,
                        process_info.get('title', ''),
                        process_info.get('hwnd', 0)
                    )
            
            # Increment detection cycle
            self.comprehensive_state_manager.increment_detection_cycle()
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error updating process states: {e}")
    
    def should_start_rosbot_management(self) -> bool:
        """Determine if RoS-BoT management should be started"""
        return self.game_state_manager.should_start_rosbot()
    
    def perform_rosbot_management(self) -> Dict:
        """Perform RoS-BoT management sequence"""
        try:
            ColorPrint.blue("[ROSBOT_MGMT] Starting RoS-BoT management sequence...")
            
            # Determine if this is initial cleanup
            force_cleanup = not self.game_state_manager.initial_cleanup_done
            
            if force_cleanup:
                ColorPrint.yellow("[INITIAL_CLEANUP] Performing initial cleanup and restart")
                self.comprehensive_state_manager.update_rosbot_startup_status("starting")
            else:
                ColorPrint.blue("[NORMAL_MGMT] Performing normal RoS-BoT management")
            
            # Execute RoS-BoT sequence
            result = self.rosbot_manager.start_rosbot_sequence(force_cleanup)
            
            if result.get("success", False):
                ColorPrint.green("[ROSBOT_MGMT] RoS-BoT management completed successfully")
                
                # Mark initial cleanup as done if this was the first time
                if force_cleanup:
                    self.game_state_manager.mark_initial_cleanup_done()
                
                # Update comprehensive state with new other exe
                new_other_exe = result.get("new_other_exe")
                if new_other_exe:
                    exe_name = new_other_exe['exe_name']
                    process_info = new_other_exe['process_info']
                    
                    self.comprehensive_state_manager.update_rosbot_startup_status(
                        "running",
                        exe_name,
                        process_info.get('title', ''),
                        process_info.get('hwnd', 0)
                    )
                    
                    # Update cleanup status
                    cleaned_exe_list = result.get("cleaned_exe_list", [])
                    self.comprehensive_state_manager.update_rosbot_cleanup_status(True, cleaned_exe_list)
                    
                    if force_cleanup:
                        self.comprehensive_state_manager.mark_rosbot_first_startup_cleanup()
                
                # Update UI automation progress
                analysis_results = result.get("analysis_results", {})
                for process_name, analysis in analysis_results.items():
                    ui_automation = analysis.get("ui_automation")
                    if ui_automation:
                        self.comprehensive_state_manager.update_rosbot_ui_automation_progress(ui_automation)
                        
                        # Mark analysis as completed
                        self.game_state_manager.mark_analysis_completed("other_exe", process_name, analysis)
                
                return result
            else:
                ColorPrint.red(f"[ROSBOT_MGMT] RoS-BoT management failed: {result.get('error', 'Unknown')}")
                self.comprehensive_state_manager.update_rosbot_startup_status("failed")
                return result
                
        except Exception as e:
            ColorPrint.red(f"[ROSBOT_MGMT] Error in RoS-BoT management: {e}")
            self.comprehensive_state_manager.update_rosbot_startup_status("failed")
            return {"success": False, "error": str(e)}
    
    def activate_window_if_needed(self, window_handle: int, window_title: str = "") -> bool:
        """Activate window if needed using window activator"""
        try:
            return self.window_activator.activate_window_by_handle(window_handle, window_title)
        except Exception as e:
            ColorPrint.red(f"[WINDOW_ACTIVATION] Error activating window: {e}")
            return False
    
    def perform_ui_automation(self, window_handle: int, ui_controls: List[Dict] = None) -> Dict:
        """Perform UI automation using UI automation controller"""
        try:
            return self.ui_automation_controller.perform_full_ui_automation(window_handle, ui_controls)
        except Exception as e:
            ColorPrint.red(f"[UI_AUTOMATION] Error in UI automation: {e}")
            return {"success": False, "error": str(e)}
    
    def get_system_status(self) -> Dict:
        """Get comprehensive system status"""
        game_status = self.game_state_manager.get_system_status()
        comprehensive_status = self.comprehensive_state_manager.get_comprehensive_status()
        
        return {
            "game_state": game_status,
            "comprehensive_state": comprehensive_status,
            "timestamp": time.time()
        }
    
    def print_system_status(self, force_print: bool = False):
        """Print system status"""
        self.game_state_manager.print_system_status(force_print)
    
    def print_comprehensive_status(self, force_print: bool = False):
        """Print comprehensive system status"""
        self.comprehensive_state_manager.print_comprehensive_status(force_print)
    
    def check_time_limits(self) -> Dict[str, bool]:
        """Check if any time limits are exceeded"""
        status = self.comprehensive_state_manager.get_comprehensive_status()
        rosbot = status["rosbot"]
        
        return {
            "time_limit_exceeded": rosbot["time_limit_exceeded"],
            "should_restart": rosbot["should_restart_due_to_time_limit"]
        }
    
    def handle_time_limit_restart(self) -> Dict:
        """Handle restart due to time limit"""
        try:
            ColorPrint.yellow("[TIME_LIMIT] Time limit exceeded - performing restart...")
            
            # Update status
            self.comprehensive_state_manager.update_rosbot_startup_status("restarting")
            
            # Perform restart (force cleanup)
            result = self.perform_rosbot_management()
            
            if result.get("success", False):
                ColorPrint.green("[TIME_LIMIT] Restart completed successfully")
            else:
                ColorPrint.red("[TIME_LIMIT] Restart failed")
            
            return result
            
        except Exception as e:
            ColorPrint.red(f"[TIME_LIMIT] Error in time limit restart: {e}")
            return {"success": False, "error": str(e)}


def main():
    """Main function for testing"""
    controller = GameManagementController()
    
    # Test process state updates
    controller.update_all_process_states()
    
    # Print status
    controller.print_system_status(force_print=True)
    controller.print_comprehensive_status(force_print=True)
    
    # Test system status
    status = controller.get_system_status()
    ColorPrint.blue(f"[TEST] System status keys: {list(status.keys())}")


if __name__ == "__main__":
    main()
