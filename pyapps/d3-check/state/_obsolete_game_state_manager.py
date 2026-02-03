#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game State Manager
Pure state management for game processes without business logic
Only provides state storage and basic state operations
"""

import os
import sys
import time
from typing import Dict, List, Optional
from dataclasses import dataclass

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

# Add ncore path

from providor.providor_second import CONFIG, load_config
from pycore.pyfoundations.color_print import ColorPrint

@dataclass
class ProcessState:
    """State information for a single process"""
    exe_name: str = ""
    is_running: bool = False
    pid: int = 0
    window_handle: int = 0
    window_title: str = ""
    last_seen: float = 0
    analysis_completed: bool = False
    analysis_result: Optional[Dict] = None

class GameStateManager:
    """
    Pure state manager for game processes
    No business logic - only state storage and basic operations
    """
    
    def __init__(self):
        """Initialize game state manager"""
        # Ensure configuration is loaded
        load_config()
        
        # Initialize process states
        self.diablo_state = ProcessState(exe_name="Diablo III.exe")
        self.rosbot_state = ProcessState(exe_name="RoS-BoT.exe")
        self.other_exe_states = []  # List of ProcessState for other exe files
        
        # Runtime tracking
        self.last_status_print = 0
        self.status_print_interval = 5  # Print status every 5 seconds
        self.initial_cleanup_done = False  # Track if initial cleanup has been performed
        
        # Load configuration
        ros_settings = CONFIG.get('ros_settings', {})
        self.auto_start_rosbot = ros_settings.get('auto_start_rosbot', True)
        self.auto_start_other_exe = ros_settings.get('auto_start_other_exe', True)
        self.rosbot_exe_name = ros_settings.get('rosbot_exe_name', 'RoS-BoT.exe')
        self.force_cleanup_restart = ros_settings.get('force_cleanup_restart', True)
        
        # Monitoring settings
        monitoring_settings = CONFIG.get('monitoring', {})
        self.check_interval = monitoring_settings.get('check_interval_seconds', 5)
        self.force_start_diablo = monitoring_settings.get('force_start_diablo', False)
        self.force_start_battlenet = monitoring_settings.get('force_start_battlenet', False)
        
        ColorPrint.green("[INIT] GameStateManager initialized")
        ColorPrint.blue(f"[CONFIG] Auto start RoS-BoT: {self.auto_start_rosbot}")
        ColorPrint.blue(f"[CONFIG] Auto start other exe: {self.auto_start_other_exe}")
        ColorPrint.blue(f"[CONFIG] Force cleanup restart: {self.force_cleanup_restart}")
    
    def update_diablo_state(self, is_running: bool, pid: int = 0, window_handle: int = 0, window_title: str = ""):
        """Update Diablo III state"""
        self.diablo_state.is_running = is_running
        self.diablo_state.pid = pid
        self.diablo_state.window_handle = window_handle
        self.diablo_state.window_title = window_title
        self.diablo_state.last_seen = time.time()
    
    def update_rosbot_state(self, is_running: bool, pid: int = 0, window_handle: int = 0, window_title: str = ""):
        """Update RoS-BoT state"""
        self.rosbot_state.is_running = is_running
        self.rosbot_state.pid = pid
        self.rosbot_state.window_handle = window_handle
        self.rosbot_state.window_title = window_title
        self.rosbot_state.last_seen = time.time()
    
    def update_other_exe_state(self, exe_name: str, is_running: bool, pid: int = 0, window_handle: int = 0, window_title: str = ""):
        """Update other exe state"""
        # Find existing state or create new one
        state = None
        for s in self.other_exe_states:
            if s.exe_name == exe_name:
                state = s
                break
        
        if state is None:
            state = ProcessState(exe_name=exe_name)
            self.other_exe_states.append(state)
        
        state.is_running = is_running
        state.pid = pid
        state.window_handle = window_handle
        state.window_title = window_title
        state.last_seen = time.time()
    
    def get_diablo_state(self) -> ProcessState:
        """Get Diablo III state"""
        return self.diablo_state
    
    def get_rosbot_state(self) -> ProcessState:
        """Get RoS-BoT state"""
        return self.rosbot_state
    
    def get_other_exe_states(self) -> List[ProcessState]:
        """Get all other exe states"""
        return self.other_exe_states
    
    def get_other_exe_state(self, exe_name: str) -> Optional[ProcessState]:
        """Get specific other exe state"""
        for state in self.other_exe_states:
            if state.exe_name == exe_name:
                return state
        return None
    
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
    
    def should_start_diablo(self) -> bool:
        """Determine if Diablo III should be started"""
        return self.force_start_diablo and not self.diablo_state.is_running
    
    def should_start_battlenet(self) -> bool:
        """Determine if Battle.net should be started"""
        return self.force_start_battlenet
    
    def get_system_status(self) -> Dict[str, bool]:
        """Get system status for decision making"""
        return {
            "diablo_running": self.diablo_state.is_running,
            "rosbot_running": self.rosbot_state.is_running,
            "other_exe_running": any(state.is_running for state in self.other_exe_states),
            "needs_diablo_start": self.should_start_diablo(),
            "needs_rosbot_start": self.should_start_rosbot(),
            "needs_other_exe_start": self.auto_start_other_exe and not any(state.is_running for state in self.other_exe_states),
            "initial_cleanup_done": self.initial_cleanup_done
        }
    
    def mark_analysis_completed(self, process_type: str, process_name: str = None, analysis_result: Dict = None):
        """Mark analysis as completed for a process"""
        if process_type == "diablo":
            self.diablo_state.analysis_completed = True
            self.diablo_state.analysis_result = analysis_result
        elif process_type == "rosbot":
            self.rosbot_state.analysis_completed = True
            self.rosbot_state.analysis_result = analysis_result
        elif process_type == "other_exe" and process_name:
            for state in self.other_exe_states:
                if state.exe_name == process_name or state.exe_name == f"{process_name}.exe":
                    state.analysis_completed = True
                    state.analysis_result = analysis_result
                    break
    
    def mark_initial_cleanup_done(self):
        """Mark that initial cleanup has been completed"""
        self.initial_cleanup_done = True
        ColorPrint.blue("[CLEANUP_DONE] Initial cleanup completed - will use normal detection from now on")
    
    def print_system_status(self, force_print: bool = False):
        """Print system status"""
        current_time = time.time()
        if not force_print and (current_time - self.last_status_print) < self.status_print_interval:
            return
        
        self.last_status_print = current_time
        
        ColorPrint.print_header("Game State Summary")
        
        # Diablo status
        if self.diablo_state.is_running:
            ColorPrint.green(f"[DIABLO] Running: '{self.diablo_state.window_title}'")
            ColorPrint.blue(f"         Handle: {self.diablo_state.window_handle}")
        else:
            ColorPrint.red("[DIABLO] Not running")
        
        # RoS-BoT status
        if self.rosbot_state.is_running:
            ColorPrint.green(f"[ROSBOT] Running: '{self.rosbot_state.window_title}'")
            ColorPrint.blue(f"         Handle: {self.rosbot_state.window_handle}")
        else:
            ColorPrint.red("[ROSBOT] Not running")
        
        # Other exe status
        running_count = sum(1 for state in self.other_exe_states if state.is_running)
        total_count = len(self.other_exe_states)
        
        if running_count > 0:
            ColorPrint.green(f"[WORKER_PROCESSES] {running_count}/{total_count} processes running:")
            for state in self.other_exe_states:
                if state.is_running:
                    ColorPrint.green(f"  [{state.exe_name}] Running: '{state.window_title}'")
                    ColorPrint.blue(f"                    Handle: {state.window_handle}")
        else:
            ColorPrint.red(f"[WORKER_PROCESSES] 0/{total_count} processes running")

def main():
    """Main function for testing"""
    state_manager = GameStateManager()
    
    # Test state updates
    state_manager.update_diablo_state(True, 1234, 5678, "暗黑破壞神III")
    state_manager.update_rosbot_state(True, 2345, 6789, "RoS-BoT")
    state_manager.update_other_exe_state("TestExe.exe", True, 3456, 7890, "TestWindow")
    
    # Print status
    state_manager.print_system_status(force_print=True)
    
    # Test system status
    status = state_manager.get_system_status()
    ColorPrint.blue(f"System status: {status}")

if __name__ == "__main__":
    main()
