#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Comprehensive State Manager
Complete state management for all system components including RoS-BoT, Battle.net, Diablo III, and game monitoring
Pure state management without business logic - only provides state storage and basic operations
"""

import os
import sys
import time
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

# Add ncore path

from providor.providor_second import CONFIG, load_config
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

@dataclass
class RosBotState:
    """Complete RoS-BoT state information"""
    # Basic startup state
    startup_status: str = "not_started"  # not_started, starting, running, failed, stopped
    
    # Cleanup state
    cleanup_completed: bool = False  # Whether initial cleanup of other exe files was successful
    cleanup_other_exe_list: List[str] = field(default_factory=list)  # List of other exe files that were cleaned up
    
    # First startup state
    first_startup_cleanup: bool = False  # Whether first startup cleanup has been performed
    
    # UI automation progress
    ui_automation_progress: Dict[str, Any] = field(default_factory=dict)  # UI automation step progress and results
    
    # Current process information
    current_other_exe: str = ""  # Current active other exe filename (e.g., "XjoltSQ2Si.exe")
    current_window_title: str = ""  # Current window title (e.g., "vzj0i949QezvJeisr")
    current_window_handle: int = 0  # Current window handle
    
    # Timing information
    last_startup_time: Optional[datetime] = None  # Last time RoS-BoT was started
    continuous_runtime: timedelta = timedelta(0)  # Duration since last startup
    
    # Configuration and limits
    delayed_startup_config: int = 0  # Delayed startup configuration in seconds (0 = immediate)
    single_run_time_limit: int = 0  # Single run time limit in seconds (0 = unlimited)
    restart_after_time_limit: bool = False  # Whether to restart after time limit is reached
    
    def update_runtime(self):
        """Update continuous runtime based on last startup time"""
        if self.last_startup_time:
            self.continuous_runtime = datetime.now() - self.last_startup_time
    
    def is_time_limit_exceeded(self) -> bool:
        """Check if single run time limit is exceeded"""
        if self.single_run_time_limit <= 0:
            return False
        self.update_runtime()
        return self.continuous_runtime.total_seconds() >= self.single_run_time_limit
    
    def should_restart_due_to_time_limit(self) -> bool:
        """Check if should restart due to time limit"""
        return self.restart_after_time_limit and self.is_time_limit_exceeded()

@dataclass
class BattleNetState:
    """Complete Battle.net state information"""
    # Basic startup state
    startup_status: str = "not_started"  # not_started, starting, running, failed, stopped
    
    # Force startup configuration
    force_startup: bool = False  # Whether Battle.net startup is forced
    
    # UI automation progress
    ui_automation_progress: Dict[str, Any] = field(default_factory=dict)  # UI automation step progress and results
    
    # Current window information
    current_window_title: str = ""  # Current Battle.net window title
    current_window_handle: int = 0  # Current Battle.net window handle

@dataclass
class DiabloState:
    """Complete Diablo III state information"""
    # Basic startup state
    startup_status: str = "not_started"  # not_started, starting, running, failed, stopped
    
    # Actual detected window information
    actual_window_title: str = ""  # Actual detected Diablo III window title (e.g., "暗黑破壞神III")
    current_window_handle: int = 0  # Current Diablo III window handle

@dataclass
class SystemRuntimeState:
    """System runtime statistics"""
    # Runtime information
    total_runtime: timedelta = timedelta(0)  # Total system runtime since start
    start_time: Optional[datetime] = None  # System start time
    
    # Detection statistics
    detection_count: int = 0  # Total number of detection cycles performed
    
    def update_runtime(self):
        """Update total runtime"""
        if self.start_time:
            self.total_runtime = datetime.now() - self.start_time
    
    def increment_detection_count(self):
        """Increment detection count"""
        self.detection_count += 1

@dataclass
class GameLogState:
    """Game log monitoring state (for future use)"""
    # Log directory and file information
    game_log_directory: str = ""  # Game log directory path
    last_log_read_time: Optional[datetime] = None  # Last time game log was read
    new_log_content: str = ""  # New log content since last read (relative to previous read)

@dataclass
class GameStatusState:
    """In-game status state (for future use)"""
    # Current location status
    current_location: str = "unknown"  # town, wilderness, greater_rift, nephalem_rift, other
    
    # Current game behavior
    current_behavior: str = "unknown"  # nephalem_rift_in_progress, greater_rift_in_progress, greater_rift_boss_fight, greater_rift_gem_upgrade, in_town, npc_interaction_repair, other
    
    # Stuck detection state
    stuck_status: str = "normal"  # normal, potentially_stuck, confirmed_stuck, recovering

class ComprehensiveStateManager:
    """
    Comprehensive state manager for all system components
    Pure state management - no business logic, only state storage and basic operations
    """
    
    def __init__(self):
        """Initialize comprehensive state manager"""
        # Ensure configuration is loaded
        load_config()
        
        # Initialize all state components
        self.rosbot_state = RosBotState()
        self.battlenet_state = BattleNetState()
        self.diablo_state = DiabloState()
        self.system_runtime_state = SystemRuntimeState()
        self.game_log_state = GameLogState()
        self.game_status_state = GameStatusState()
        
        # Load configuration
        self._load_configuration()
        
        # Initialize system start time
        self.system_runtime_state.start_time = datetime.now()
        
        ColorPrint.green("[INIT] ComprehensiveStateManager initialized")
        self._print_configuration()
    
    def _load_configuration(self):
        """Load configuration from config file"""
        try:
            # Load RoS-BoT configuration
            ros_settings = CONFIG.get('ros_settings', {})
            self.rosbot_state.delayed_startup_config = ros_settings.get('delayed_startup_config', 0)
            self.rosbot_state.single_run_time_limit = ros_settings.get('single_run_time_limit', 0)
            self.rosbot_state.restart_after_time_limit = ros_settings.get('restart_after_time_limit', False)
            
            # Load Battle.net configuration
            monitoring_settings = CONFIG.get('monitoring', {})
            self.battlenet_state.force_startup = monitoring_settings.get('force_start_battlenet', False)
            
            # Load game log configuration (for future use)
            system_settings = CONFIG.get('system_settings', {})
            self.game_log_state.game_log_directory = system_settings.get('game_log_directory', '')
            
        except Exception as e:
            ColorPrint.red(f"[CONFIG_ERROR] Error loading configuration: {e}")
    
    def _print_configuration(self):
        """Print current configuration"""
        ColorPrint.blue("[CONFIG] RoS-BoT Configuration:")
        ColorPrint.blue(f"  Delayed startup: {self.rosbot_state.delayed_startup_config}s")
        ColorPrint.blue(f"  Run time limit: {self.rosbot_state.single_run_time_limit}s")
        ColorPrint.blue(f"  Restart after limit: {self.rosbot_state.restart_after_time_limit}")
        
        ColorPrint.blue("[CONFIG] Battle.net Configuration:")
        ColorPrint.blue(f"  Force startup: {self.battlenet_state.force_startup}")
        
        ColorPrint.blue("[CONFIG] Game Log Configuration:")
        ColorPrint.blue(f"  Log directory: {self.game_log_state.game_log_directory}")
    
    # RoS-BoT State Management Methods
    def update_rosbot_startup_status(self, status: str, other_exe: str = "", window_title: str = "", window_handle: int = 0):
        """Update RoS-BoT startup status"""
        old_status = self.rosbot_state.startup_status
        self.rosbot_state.startup_status = status
        
        if status == "running":
            self.rosbot_state.last_startup_time = datetime.now()
            self.rosbot_state.current_other_exe = other_exe
            self.rosbot_state.current_window_title = window_title
            self.rosbot_state.current_window_handle = window_handle
            ColorPrint.green(f"[ROSBOT_STATUS] {old_status} → {status}")
            ColorPrint.blue(f"[ROSBOT_INFO] Other exe: {other_exe}")
            ColorPrint.blue(f"[ROSBOT_INFO] Window title: '{window_title}'")
            ColorPrint.blue(f"[ROSBOT_INFO] Window handle: {window_handle}")
        else:
            ColorPrint.blue(f"[ROSBOT_STATUS] {old_status} → {status}")
    
    def update_rosbot_cleanup_status(self, completed: bool, cleaned_exe_list: List[str] = None):
        """Update RoS-BoT cleanup status"""
        self.rosbot_state.cleanup_completed = completed
        if cleaned_exe_list:
            self.rosbot_state.cleanup_other_exe_list = cleaned_exe_list
        
        ColorPrint.blue(f"[ROSBOT_CLEANUP] Completed: {completed}")
        if cleaned_exe_list:
            ColorPrint.blue(f"[ROSBOT_CLEANUP] Cleaned exe files: {cleaned_exe_list}")
    
    def mark_rosbot_first_startup_cleanup(self):
        """Mark RoS-BoT first startup cleanup as completed"""
        self.rosbot_state.first_startup_cleanup = True
        ColorPrint.blue("[ROSBOT_FIRST_CLEANUP] First startup cleanup completed")
    
    def update_rosbot_ui_automation_progress(self, progress: Dict[str, Any]):
        """Update RoS-BoT UI automation progress"""
        self.rosbot_state.ui_automation_progress = progress
        
        # Log progress details
        if progress.get("success", False):
            results = progress.get("results", {})
            success_count = progress.get("success_count", 0)
            total_steps = progress.get("total_steps", 0)
            ColorPrint.green(f"[ROSBOT_UI] Automation progress: {success_count}/{total_steps} steps completed")
            
            for step, completed in results.items():
                status = "✓" if completed else "✗"
                ColorPrint.blue(f"[ROSBOT_UI] {step}: {status}")
        else:
            ColorPrint.red(f"[ROSBOT_UI] Automation failed: {progress.get('error', 'Unknown')}")
    
    # Battle.net State Management Methods
    def update_battlenet_status(self, status: str, window_title: str = "", window_handle: int = 0):
        """Update Battle.net status"""
        old_status = self.battlenet_state.startup_status
        self.battlenet_state.startup_status = status
        self.battlenet_state.current_window_title = window_title
        self.battlenet_state.current_window_handle = window_handle
        
        ColorPrint.blue(f"[BATTLENET_STATUS] {old_status} → {status}")
        if window_title:
            ColorPrint.blue(f"[BATTLENET_INFO] Window title: '{window_title}'")
            ColorPrint.blue(f"[BATTLENET_INFO] Window handle: {window_handle}")
    
    def update_battlenet_ui_automation_progress(self, progress: Dict[str, Any]):
        """Update Battle.net UI automation progress"""
        self.battlenet_state.ui_automation_progress = progress
        
        if progress.get("success", False):
            ColorPrint.green("[BATTLENET_UI] UI automation completed successfully")
        else:
            ColorPrint.red(f"[BATTLENET_UI] UI automation failed: {progress.get('error', 'Unknown')}")
    
    # Diablo State Management Methods
    def update_diablo_status(self, status: str, window_title: str = "", window_handle: int = 0):
        """Update Diablo III status"""
        old_status = self.diablo_state.startup_status
        self.diablo_state.startup_status = status
        self.diablo_state.actual_window_title = window_title
        self.diablo_state.current_window_handle = window_handle
        
        ColorPrint.blue(f"[DIABLO_STATUS] {old_status} → {status}")
        if window_title:
            ColorPrint.blue(f"[DIABLO_INFO] Actual window title: '{window_title}'")
            ColorPrint.blue(f"[DIABLO_INFO] Window handle: {window_handle}")
    
    # System Runtime Management Methods
    def increment_detection_cycle(self):
        """Increment detection cycle count"""
        self.system_runtime_state.increment_detection_count()
    
    # State Query Methods
    def get_comprehensive_status(self) -> Dict[str, Any]:
        """Get complete system status"""
        # Update runtime information
        self.system_runtime_state.update_runtime()
        self.rosbot_state.update_runtime()
        
        return {
            "rosbot": {
                "startup_status": self.rosbot_state.startup_status,
                "cleanup_completed": self.rosbot_state.cleanup_completed,
                "cleanup_other_exe_list": self.rosbot_state.cleanup_other_exe_list,
                "first_startup_cleanup": self.rosbot_state.first_startup_cleanup,
                "ui_automation_progress": self.rosbot_state.ui_automation_progress,
                "current_other_exe": self.rosbot_state.current_other_exe,
                "current_window_title": self.rosbot_state.current_window_title,
                "current_window_handle": self.rosbot_state.current_window_handle,
                "last_startup_time": self.rosbot_state.last_startup_time.isoformat() if self.rosbot_state.last_startup_time else None,
                "continuous_runtime_seconds": self.rosbot_state.continuous_runtime.total_seconds(),
                "delayed_startup_config": self.rosbot_state.delayed_startup_config,
                "single_run_time_limit": self.rosbot_state.single_run_time_limit,
                "restart_after_time_limit": self.rosbot_state.restart_after_time_limit,
                "time_limit_exceeded": self.rosbot_state.is_time_limit_exceeded(),
                "should_restart_due_to_time_limit": self.rosbot_state.should_restart_due_to_time_limit()
            },
            "battlenet": {
                "startup_status": self.battlenet_state.startup_status,
                "force_startup": self.battlenet_state.force_startup,
                "ui_automation_progress": self.battlenet_state.ui_automation_progress,
                "current_window_title": self.battlenet_state.current_window_title,
                "current_window_handle": self.battlenet_state.current_window_handle
            },
            "diablo": {
                "startup_status": self.diablo_state.startup_status,
                "actual_window_title": self.diablo_state.actual_window_title,
                "current_window_handle": self.diablo_state.current_window_handle
            },
            "system_runtime": {
                "total_runtime_seconds": self.system_runtime_state.total_runtime.total_seconds(),
                "start_time": self.system_runtime_state.start_time.isoformat() if self.system_runtime_state.start_time else None,
                "detection_count": self.system_runtime_state.detection_count
            },
            "game_log": {
                "game_log_directory": self.game_log_state.game_log_directory,
                "last_log_read_time": self.game_log_state.last_log_read_time.isoformat() if self.game_log_state.last_log_read_time else None,
                "new_log_content": self.game_log_state.new_log_content
            },
            "game_status": {
                "current_location": self.game_status_state.current_location,
                "current_behavior": self.game_status_state.current_behavior,
                "stuck_status": self.game_status_state.stuck_status
            }
        }
    
    def print_comprehensive_status(self, force_print: bool = False):
        """Print comprehensive system status"""
        status = self.get_comprehensive_status()
        
        ColorPrint.print_header("COMPREHENSIVE SYSTEM STATE")
        
        # RoS-BoT Status
        rosbot = status["rosbot"]
        ColorPrint.print_section("RoS-BoT Status")
        ColorPrint.blue(f"Status: {rosbot['startup_status']}")
        ColorPrint.blue(f"Current exe: {rosbot['current_other_exe']}")
        ColorPrint.blue(f"Window title: '{rosbot['current_window_title']}'")
        ColorPrint.blue(f"Runtime: {rosbot['continuous_runtime_seconds']:.1f}s")
        ColorPrint.blue(f"First cleanup: {rosbot['first_startup_cleanup']}")
        
        # Battle.net Status
        battlenet = status["battlenet"]
        ColorPrint.print_section("Battle.net Status")
        ColorPrint.blue(f"Status: {battlenet['startup_status']}")
        ColorPrint.blue(f"Window title: '{battlenet['current_window_title']}'")
        
        # Diablo Status
        diablo = status["diablo"]
        ColorPrint.print_section("Diablo III Status")
        ColorPrint.blue(f"Status: {diablo['startup_status']}")
        ColorPrint.blue(f"Window title: '{diablo['actual_window_title']}'")
        
        # System Runtime
        runtime = status["system_runtime"]
        ColorPrint.print_section("System Runtime")
        ColorPrint.blue(f"Runtime: {runtime['total_runtime_seconds']:.1f}s")
        ColorPrint.blue(f"Detection cycles: {runtime['detection_count']}")

def main():
    """Main function for testing"""
    state_manager = ComprehensiveStateManager()
    
    # Test status updates
    state_manager.update_rosbot_startup_status("running", "TestExe.exe", "TestTitle", 12345)
    state_manager.update_battlenet_status("running", "Battle.net", 67890)
    state_manager.update_diablo_status("running", "暗黑破壞神III", 54321)
    
    # Print comprehensive status
    state_manager.print_comprehensive_status(force_print=True)

if __name__ == "__main__":
    main()
