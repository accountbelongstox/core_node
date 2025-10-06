#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Battle.net Manager
Manages Battle.net startup, automation, and Diablo process management
"""

import time
from pathlib import Path
from typing import Dict, List, Optional
from utils.color_print import ColorPrint
from utils.process_manager import ProcessManager
from utils.ui_analyzer import UIAnalyzer
from utils.automation_controller import AutomationController


class BattlenetManager:
    """Manages Battle.net operations and Diablo process control"""
    
    def __init__(self, battlenet_path: str, battlenet_args: str = "", 
                 diablo_window_titles: List[str] = None):
        """
        Initialize Battle.net manager
        
        Args:
            battlenet_path: Path to Battle.net executable
            battlenet_args: Launch arguments for Battle.net
            diablo_window_titles: Window titles to identify Diablo processes
        """
        self.battlenet_path = Path(battlenet_path) if battlenet_path else None
        self.battlenet_args = battlenet_args
        self.diablo_window_titles = diablo_window_titles or ["Diablo"]
        
        self.process_manager = ProcessManager()
        self.automation_controller = AutomationController()
        self.ui_analyzer = None
        
        ColorPrint.green("✅ BattlenetManager initialized")
        if self.battlenet_path:
            ColorPrint.blue(f"🎮 Battle.net path: {self.battlenet_path}")
            ColorPrint.blue(f"⚙️  Battle.net args: {self.battlenet_args}")
        ColorPrint.blue(f"🎯 Diablo window titles: {self.diablo_window_titles}")
    
    def start_battlenet(self, wait_time: int = 10) -> Dict:
        """
        Start Battle.net application
        
        Args:
            wait_time: Time to wait after startup
            
        Returns:
            Dictionary with startup result
        """
        try:
            if not self.battlenet_path or not self.battlenet_path.exists():
                return {
                    "success": False,
                    "error": f"Battle.net executable not found: {self.battlenet_path}"
                }
            
            ColorPrint.blue("🚀 Starting Battle.net...")
            
            # Check if Battle.net is already running
            battlenet_processes = self.process_manager.get_processes_by_name("Battle.net.exe")
            if battlenet_processes:
                ColorPrint.green(f"✅ Battle.net already running (PID: {battlenet_processes[0]['pid']})")
                return {
                    "success": True,
                    "message": "Battle.net already running",
                    "process_info": battlenet_processes[0]
                }
            
            # Start Battle.net
            success = self.process_manager.start_program_with_explorer(
                str(self.battlenet_path), 
                self.battlenet_args
            )
            
            if not success:
                return {
                    "success": False,
                    "error": "Failed to start Battle.net"
                }
            
            ColorPrint.green("✅ Battle.net startup command sent")
            ColorPrint.blue(f"⏳ Waiting {wait_time} seconds for Battle.net to load...")
            time.sleep(wait_time)
            
            # Verify Battle.net started
            battlenet_processes = self.process_manager.get_processes_by_name("Battle.net.exe")
            if battlenet_processes:
                ColorPrint.green(f"✅ Battle.net started successfully (PID: {battlenet_processes[0]['pid']})")
                return {
                    "success": True,
                    "message": "Battle.net started successfully",
                    "process_info": battlenet_processes[0]
                }
            else:
                ColorPrint.yellow("⚠️  Battle.net process not detected after startup")
                return {
                    "success": False,
                    "error": "Battle.net process not detected after startup"
                }
                
        except Exception as e:
            ColorPrint.red(f"❌ Error starting Battle.net: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def stop_battlenet(self) -> Dict:
        """
        Stop Battle.net application
        
        Returns:
            Dictionary with stop result
        """
        try:
            ColorPrint.blue("🛑 Stopping Battle.net...")
            
            # Find Battle.net processes
            battlenet_processes = self.process_manager.get_processes_by_name("Battle.net.exe")
            
            if not battlenet_processes:
                ColorPrint.yellow("⚠️  No Battle.net processes found")
                return {
                    "success": True,
                    "message": "No Battle.net processes to stop"
                }
            
            # Kill Battle.net processes
            killed_count = 0
            for process in battlenet_processes:
                if self.process_manager.kill_process_by_pid(process['pid']):
                    killed_count += 1
            
            if killed_count > 0:
                ColorPrint.green(f"✅ Stopped {killed_count} Battle.net process(es)")
                return {
                    "success": True,
                    "message": f"Stopped {killed_count} Battle.net process(es)"
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to stop Battle.net processes"
                }
                
        except Exception as e:
            ColorPrint.red(f"❌ Error stopping Battle.net: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def kill_diablo_processes(self) -> Dict:
        """
        Kill all Diablo-related processes
        
        Returns:
            Dictionary with kill result
        """
        try:
            ColorPrint.blue("🔄 Killing Diablo processes...")
            
            # Find Diablo processes by window titles
            diablo_processes = self.process_manager.get_processes_by_window_title(self.diablo_window_titles)
            
            if not diablo_processes:
                ColorPrint.yellow("⚠️  No Diablo processes found")
                return {
                    "success": True,
                    "message": "No Diablo processes to kill",
                    "killed_processes": []
                }
            
            killed_processes = []
            killed_count = 0
            
            for process in diablo_processes:
                ColorPrint.blue(f"🔄 Killing Diablo process: {process['name']} (PID: {process['pid']})")
                
                if self.process_manager.kill_process_by_pid(process['pid']):
                    killed_count += 1
                    killed_processes.append({
                        "name": process['name'],
                        "pid": process['pid'],
                        "window_title": process.get('window_title', '')
                    })
                    ColorPrint.green(f"✅ Killed: {process['name']} (PID: {process['pid']})")
            
            if killed_count > 0:
                ColorPrint.green(f"✅ Successfully killed {killed_count} Diablo process(es)")
                time.sleep(2)  # Wait for processes to fully terminate
            
            return {
                "success": True,
                "message": f"Killed {killed_count} Diablo process(es)",
                "killed_processes": killed_processes,
                "total_killed": killed_count
            }
            
        except Exception as e:
            ColorPrint.red(f"❌ Error killing Diablo processes: {e}")
            return {
                "success": False,
                "error": str(e),
                "killed_processes": []
            }
    
    def restart_diablo_sequence(self, restart_battlenet: bool = True) -> Dict:
        """
        Complete Diablo restart sequence
        
        Args:
            restart_battlenet: Whether to restart Battle.net first
            
        Returns:
            Dictionary with restart result
        """
        try:
            ColorPrint.blue("🔄 Starting Diablo restart sequence...")
            
            # Step 1: Kill Diablo processes
            kill_result = self.kill_diablo_processes()
            if not kill_result["success"]:
                return kill_result
            
            # Step 2: Restart Battle.net if requested
            if restart_battlenet:
                # Stop Battle.net first
                stop_result = self.stop_battlenet()
                if not stop_result["success"]:
                    ColorPrint.yellow(f"⚠️  Battle.net stop warning: {stop_result.get('error', 'Unknown error')}")
                
                time.sleep(3)  # Wait for Battle.net to fully stop
                
                # Start Battle.net
                start_result = self.start_battlenet()
                if not start_result["success"]:
                    return {
                        "success": False,
                        "error": f"Failed to restart Battle.net: {start_result.get('error', 'Unknown error')}",
                        "diablo_kill_result": kill_result
                    }
            
            ColorPrint.green("✅ Diablo restart sequence completed successfully")
            return {
                "success": True,
                "message": "Diablo restart sequence completed",
                "diablo_kill_result": kill_result,
                "battlenet_restarted": restart_battlenet
            }
            
        except Exception as e:
            ColorPrint.red(f"❌ Error in Diablo restart sequence: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def perform_battlenet_automation(self, operation_sequence: List[str], 
                                   ui_analysis_dir: str = None) -> Dict:
        """
        Perform automated operations on Battle.net
        
        Args:
            operation_sequence: List of operations to perform
            ui_analysis_dir: Directory for UI analysis output
            
        Returns:
            Dictionary with automation result
        """
        try:
            if not operation_sequence:
                ColorPrint.yellow("⚠️  No Battle.net operations configured")
                return {
                    "success": True,
                    "message": "No operations to perform"
                }
            
            ColorPrint.blue("🤖 Starting Battle.net automation...")
            
            # Find Battle.net window
            battlenet_window_titles = ["Battle.net", "战网", "Blizzard Battle.net"]
            
            # Perform UI analysis if directory provided
            ui_elements = None
            if ui_analysis_dir and self.ui_analyzer is None:
                self.ui_analyzer = UIAnalyzer(ui_analysis_dir)
            
            if self.ui_analyzer:
                for window_title in battlenet_window_titles:
                    analysis_result = self.ui_analyzer.analyze_window_ui(window_title, "battlenet")
                    if analysis_result["success"]:
                        ui_elements = analysis_result.get("ui_elements")
                        ColorPrint.green(f"✅ Battle.net UI analysis completed: {window_title}")
                        break
                
                if not ui_elements:
                    ColorPrint.yellow("⚠️  Battle.net UI analysis failed, proceeding without UI data")
            
            # Execute automation operations
            for window_title in battlenet_window_titles:
                automation_result = self.automation_controller.execute_operations(
                    window_title, 
                    operation_sequence,
                    ui_elements
                )
                
                if automation_result["success"]:
                    ColorPrint.green("✅ Battle.net automation completed successfully")
                    return {
                        "success": True,
                        "message": "Battle.net automation completed",
                        "automation_result": automation_result
                    }
            
            ColorPrint.yellow("⚠️  Battle.net window not found for automation")
            return {
                "success": False,
                "error": "Battle.net window not found for automation"
            }
            
        except Exception as e:
            ColorPrint.red(f"❌ Error in Battle.net automation: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def is_battlenet_running(self) -> bool:
        """Check if Battle.net is running"""
        try:
            processes = self.process_manager.get_processes_by_name("Battle.net.exe")
            return len(processes) > 0
        except Exception as e:
            ColorPrint.red(f"❌ Error checking Battle.net status: {e}")
            return False
    
    def is_diablo_running(self) -> bool:
        """Check if Diablo is running"""
        try:
            processes = self.process_manager.get_processes_by_window_title(self.diablo_window_titles)
            return len(processes) > 0
        except Exception as e:
            ColorPrint.red(f"❌ Error checking Diablo status: {e}")
            return False
    
    def get_status_info(self) -> Dict:
        """Get comprehensive status information"""
        return {
            "battlenet_running": self.is_battlenet_running(),
            "diablo_running": self.is_diablo_running(),
            "battlenet_path": str(self.battlenet_path) if self.battlenet_path else None,
            "battlenet_args": self.battlenet_args,
            "diablo_window_titles": self.diablo_window_titles
        }
