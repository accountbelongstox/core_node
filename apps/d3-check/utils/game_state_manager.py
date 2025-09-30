#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game State Manager
Unified state management for Diablo III and RoS-BoT processes
"""

import os
import sys
import time
from typing import Dict, List, Optional
from dataclasses import dataclass

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

from providor.providor_second import CONFIG, load_config
from base.color_print import ColorPrint
from utils.game_process_detector import GameProcessDetector
from utils.rosbot_manager import RoSBotManager


@dataclass
class ProcessState:
    """State information for a single process"""
    name: str
    exe_name: str
    is_running: bool
    window_title: str = ""
    window_handle: int = 0
    last_check_time: float = 0
    analysis_completed: bool = False
    analysis_result: Dict = None


class GameStateManager:
    """Unified state management for Diablo III and RoS-BoT processes"""
    
    def __init__(self):
        """Initialize game state manager"""
        # Ensure configuration is loaded
        load_config()
        
        # Load configuration
        self.monitoring_enabled = CONFIG.get('monitoring', {}).get('enabled', True)
        self.force_start_diablo = CONFIG.get('monitoring', {}).get('force_start_diablo', False)
        self.force_start_battlenet = CONFIG.get('monitoring', {}).get('force_start_battlenet', False)
        
        ros_settings = CONFIG.get('ros_settings', {})
        self.auto_start_rosbot = ros_settings.get('auto_start_rosbot', True)
        self.auto_start_other_exe = ros_settings.get('auto_start_other_exe', True)
        self.rosbot_exe_name = ros_settings.get('rosbot_exe_name', 'RoS-BoT.exe')
        self.force_cleanup_restart = ros_settings.get('force_cleanup_restart', True)
        
        # Initialize components
        self.game_detector = GameProcessDetector()
        self.rosbot_manager = RoSBotManager()
        
        # State tracking
        self.diablo_state = ProcessState(
            name="Diablo III",
            exe_name="Diablo III",
            is_running=False
        )
        
        self.rosbot_state = ProcessState(
            name="RoS-BoT",
            exe_name=self.rosbot_exe_name,
            is_running=False
        )
        
        self.other_exe_states = []  # List of ProcessState for other exe files
        self.last_status_print = 0
        self.status_print_interval = 5  # Print status every 5 seconds
        self.initial_cleanup_done = False  # Track if initial cleanup has been performed
        
        ColorPrint.green("[INIT] GameStateManager initialized")
        ColorPrint.blue(f"[CONFIG] Auto start RoS-BoT: {self.auto_start_rosbot}")
        ColorPrint.blue(f"[CONFIG] Auto start other exe: {self.auto_start_other_exe}")
        ColorPrint.blue(f"[CONFIG] Force cleanup restart: {self.force_cleanup_restart}")
    
    def check_diablo_status(self) -> bool:
        """Check Diablo III status"""
        try:
            diablo_process = self.game_detector.check_diablo_process_running()
            
            if diablo_process:
                self.diablo_state.is_running = True
                self.diablo_state.window_title = diablo_process['title']
                self.diablo_state.window_handle = diablo_process['hwnd']
                self.diablo_state.last_check_time = time.time()
                return True
            else:
                self.diablo_state.is_running = False
                self.diablo_state.window_title = ""
                self.diablo_state.window_handle = 0
                self.diablo_state.last_check_time = time.time()
                return False
                
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error checking Diablo status: {e}")
            return False
    
    def check_rosbot_status(self) -> bool:
        """Check RoS-BoT status"""
        try:
            rosbot_process = self.rosbot_manager.check_process_running(self.rosbot_exe_name)
            
            if rosbot_process:
                self.rosbot_state.is_running = True
                self.rosbot_state.window_title = rosbot_process['title']
                self.rosbot_state.window_handle = rosbot_process['hwnd']
                self.rosbot_state.last_check_time = time.time()
                return True
            else:
                self.rosbot_state.is_running = False
                self.rosbot_state.window_title = ""
                self.rosbot_state.window_handle = 0
                self.rosbot_state.last_check_time = time.time()
                return False
                
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error checking RoS-BoT status: {e}")
            return False
    
    def check_other_exe_status(self):
        """Check status of other exe files"""
        try:
            # Get list of other exe files
            other_exe_files = self.rosbot_manager.find_other_exe_files()
            
            # Update existing states or create new ones
            current_exe_names = [os.path.basename(exe_path) for exe_path in other_exe_files]
            
            # Remove states for exe files that no longer exist
            self.other_exe_states = [state for state in self.other_exe_states 
                                   if state.exe_name in current_exe_names]
            
            # Add new states for new exe files
            existing_exe_names = [state.exe_name for state in self.other_exe_states]
            for exe_path in other_exe_files:
                exe_name = os.path.basename(exe_path)
                if exe_name not in existing_exe_names:
                    self.other_exe_states.append(ProcessState(
                        name=exe_name.replace('.exe', ''),
                        exe_name=exe_name,
                        is_running=False
                    ))
            
            # Check status of each other exe
            for state in self.other_exe_states:
                process_info = self.rosbot_manager.check_process_running(state.exe_name)
                if process_info:
                    state.is_running = True
                    state.window_title = process_info['title']
                    state.window_handle = process_info['hwnd']
                else:
                    state.is_running = False
                    state.window_title = ""
                    state.window_handle = 0
                state.last_check_time = time.time()
                
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error checking other exe status: {e}")
    
    def update_all_status(self):
        """Update status of all processes"""
        self.check_diablo_status()
        self.check_rosbot_status()
        self.check_other_exe_status()
    
    def print_status_summary(self, force_print: bool = False):
        """Print status summary of all processes"""
        current_time = time.time()
        
        if not force_print and (current_time - self.last_status_print) < self.status_print_interval:
            return
        
        self.last_status_print = current_time
        
        ColorPrint.blue("=" * 60)
        ColorPrint.green("[STATUS] Game State Summary")
        ColorPrint.blue("-" * 30)
        
        # Diablo III status
        if self.diablo_state.is_running:
            ColorPrint.green(f"[DIABLO] Running: '{self.diablo_state.window_title}'")
            ColorPrint.gray(f"         Handle: {self.diablo_state.window_handle}")
        else:
            ColorPrint.red("[DIABLO] Not running")
        
        # RoS-BoT status (launcher)
        if self.rosbot_state.is_running:
            if self.rosbot_state.window_title and self.rosbot_state.window_title != f"{self.rosbot_exe_name} (No Window)":
                ColorPrint.green(f"[ROSBOT] Running: '{self.rosbot_state.window_title}'")
                ColorPrint.gray(f"         Handle: {self.rosbot_state.window_handle}")
                if self.rosbot_state.analysis_completed:
                    ColorPrint.blue("         Analysis: Completed")
            else:
                ColorPrint.blue("[ROSBOT] Running (Launcher - No Window)")
        else:
            ColorPrint.gray("[ROSBOT] Not running (Launcher)")

        # Other exe status (actual working processes)
        if self.other_exe_states:
            running_count = sum(1 for state in self.other_exe_states if state.is_running)
            ColorPrint.blue(f"[WORKER_PROCESSES] {running_count}/{len(self.other_exe_states)} processes running:")
            for state in self.other_exe_states:
                if state.is_running:
                    ColorPrint.green(f"  [{state.exe_name}] Running: '{state.window_title}'")
                    ColorPrint.gray(f"                    Handle: {state.window_handle}")
                    if state.analysis_completed:
                        ColorPrint.blue(f"                    Analysis: Completed")
                else:
                    ColorPrint.red(f"  [{state.exe_name}] Not running")
        else:
            ColorPrint.yellow("[WORKER_PROCESSES] No worker processes found")
        
        ColorPrint.blue("=" * 60)
    
    def should_start_diablo(self) -> bool:
        """Determine if Diablo III should be started"""
        if self.force_start_diablo:
            return True
        return not self.diablo_state.is_running
    
    def should_start_rosbot(self) -> bool:
        """Determine if RoS-BoT management should be started"""
        if not self.auto_start_rosbot and not self.auto_start_other_exe:
            return False
        if not self.diablo_state.is_running:
            return False  # Only start RoS-BoT management if Diablo is running

        # If this is the first time and force cleanup is enabled, do initial cleanup
        if self.force_cleanup_restart and not self.initial_cleanup_done:
            ColorPrint.blue("[DECISION] First startup - will perform initial cleanup and restart")
            return True

        # After initial cleanup, use normal logic
        # Check if any other exe is not running
        if self.auto_start_other_exe:
            for state in self.other_exe_states:
                if not state.is_running:
                    ColorPrint.blue("[DECISION] Some other exe not running - will start RoS-BoT management")
                    return True

        # If RoS-BoT itself needs to be running (not just as launcher)
        if self.auto_start_rosbot and not self.rosbot_state.is_running:
            ColorPrint.blue("[DECISION] RoS-BoT not running - will start RoS-BoT management")
            return True

        ColorPrint.gray("[DECISION] All processes running - no action needed")
        return False

    def should_start_other_exe(self) -> bool:
        """Determine if other exe files should be started (legacy method)"""
        # This is now handled by should_start_rosbot() since RoS-BoT manages other exe
        return self.should_start_rosbot()
    
    def get_system_status(self) -> Dict:
        """Get complete system status"""
        return {
            "diablo": {
                "running": self.diablo_state.is_running,
                "title": self.diablo_state.window_title,
                "handle": self.diablo_state.window_handle,
                "analysis_completed": self.diablo_state.analysis_completed
            },
            "rosbot": {
                "running": self.rosbot_state.is_running,
                "title": self.rosbot_state.window_title,
                "handle": self.rosbot_state.window_handle,
                "analysis_completed": self.rosbot_state.analysis_completed
            },
            "other_exe": [
                {
                    "name": state.name,
                    "exe_name": state.exe_name,
                    "running": state.is_running,
                    "title": state.window_title,
                    "handle": state.window_handle,
                    "analysis_completed": state.analysis_completed
                }
                for state in self.other_exe_states
            ],
            "needs_diablo_start": self.should_start_diablo(),
            "needs_rosbot_start": self.should_start_rosbot(),
            "needs_other_exe_start": self.should_start_other_exe()
        }
    
    def mark_analysis_completed(self, process_type: str, process_name: str = "", analysis_result: Dict = None):
        """Mark analysis as completed for a process"""
        if process_type == "diablo":
            self.diablo_state.analysis_completed = True
            self.diablo_state.analysis_result = analysis_result
        elif process_type == "rosbot":
            self.rosbot_state.analysis_completed = True
            self.rosbot_state.analysis_result = analysis_result
        elif process_type == "other_exe":
            for state in self.other_exe_states:
                if state.name == process_name or state.exe_name == process_name:
                    state.analysis_completed = True
                    state.analysis_result = analysis_result
                    break

    def mark_initial_cleanup_done(self):
        """Mark that initial cleanup has been completed"""
        self.initial_cleanup_done = True
        ColorPrint.blue("[CLEANUP_DONE] Initial cleanup completed - will use normal detection from now on")


def main():
    """Main function for testing"""
    state_manager = GameStateManager()
    
    ColorPrint.green("[TEST] Testing GameStateManager...")
    
    # Test status checking
    state_manager.update_all_status()
    state_manager.print_status_summary(force_print=True)
    
    # Test system status
    status = state_manager.get_system_status()
    ColorPrint.blue(f"[TEST] System needs Diablo start: {status['needs_diablo_start']}")
    ColorPrint.blue(f"[TEST] System needs RoS-BoT start: {status['needs_rosbot_start']}")
    ColorPrint.blue(f"[TEST] System needs other exe start: {status['needs_other_exe_start']}")


if __name__ == "__main__":
    main()
