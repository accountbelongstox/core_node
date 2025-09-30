#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Main Controller
Manages the entire D3Check system including bot lifecycle, automation, and Battle.net integration
"""

import time
import threading
from pathlib import Path
from typing import Dict, List, Optional
from provider.config_provider import CONFIG
from controller.bot_state_manager import BotStateManager, BotState
from utils.color_print import ColorPrint
from utils.process_manager import ProcessManager
from utils.bot_scanner import BotScanner
from utils.ui_analyzer import UIAnalyzer
from utils.automation_controller import AutomationController
from utils.battlenet_manager import BattlenetManager


class MainController:
    """Main controller for the D3Check system"""
    
    def __init__(self):
        """Initialize main controller"""
        self.running = False
        self.process_manager = ProcessManager()
        self.bot_scanner = None
        self.ui_analyzer = None
        self.automation_controller = AutomationController()
        self.battlenet_manager = None
        self.state_manager = None
        
        # Load configuration
        self._load_configuration()
        
        # Initialize components
        self._initialize_components()
        
        ColorPrint.green("[OK] MainController initialized")
    
    def _load_configuration(self):
        """Load configuration from provider"""
        self.bot_base_dir = CONFIG.get_bot_base_dir()
        self.repeat_login_time = CONFIG.get_repeat_login_time()
        self.run_duration = CONFIG.get_run_duration()
        self.operation_ids = CONFIG.get_operation_ids()
        self.user_temp_dir = CONFIG.get_user_temp_dir()
        self.battlenet_path = CONFIG.get_battlenet_path()
        self.battlenet_args = CONFIG.get_battlenet_args()
        self.diablo_window_titles = CONFIG.get_diablo_window_titles()
        
        # Timing settings
        self.process_check_interval = CONFIG.get("timing_settings.process_check_interval", 5)
        self.ui_analysis_delay = CONFIG.get("timing_settings.ui_analysis_delay", 2)
        self.startup_wait_time = CONFIG.get("timing_settings.startup_wait_time", 10)
        self.shutdown_wait_time = CONFIG.get("timing_settings.shutdown_wait_time", 5)
        
        # System settings
        self.enable_ui_analysis = CONFIG.get("system_settings.enable_ui_analysis", True)
        self.save_ui_screenshots = CONFIG.get("system_settings.save_ui_screenshots", True)
        
        ColorPrint.blue("[CONFIG] Configuration loaded:")
        ColorPrint.gray(f"   Bot base dir: {self.bot_base_dir}")
        ColorPrint.gray(f"   Repeat login time: {self.repeat_login_time}s")
        ColorPrint.gray(f"   Run duration: {self.run_duration}s")
        ColorPrint.gray(f"   Operation IDs: {self.operation_ids}")
    
    def _initialize_components(self):
        """Initialize system components"""
        # Initialize bot scanner
        if self.bot_base_dir:
            self.bot_scanner = BotScanner(self.bot_base_dir)
        
        # Initialize UI analyzer
        if self.enable_ui_analysis:
            ui_analysis_dir = Path(self.user_temp_dir) / "ui_analysis"
            self.ui_analyzer = UIAnalyzer(str(ui_analysis_dir))

        # Initialize Battle.net manager
        if self.battlenet_path:
            self.battlenet_manager = BattlenetManager(
                self.battlenet_path,
                self.battlenet_args,
                self.diablo_window_titles
            )

        # Initialize state manager
        self.state_manager = BotStateManager(self.repeat_login_time, self.run_duration)

        # Set automation delay
        operation_delay = CONFIG.get("timing_settings.operation_delay", 1)
        self.automation_controller.set_operation_delay(operation_delay)
    
    def start(self):
        """Start the main control loop"""
        try:
            ColorPrint.green("[START] Starting D3Check main control loop")
            self.running = True
            
            # Initial bot directory scan
            if self.bot_scanner:
                scan_result = self.bot_scanner.scan_for_bot_directory()
                if not scan_result["success"]:
                    ColorPrint.red(f"[ERROR] Failed to scan bot directory: {scan_result['error']}")
                    return
            
            # Main control loop
            self._main_loop()
            
        except KeyboardInterrupt:
            ColorPrint.yellow("\n⚠️  Shutdown requested by user")
        except Exception as e:
            ColorPrint.red(f"❌ Fatal error in main controller: {e}")
        finally:
            self._shutdown()
    
    def _main_loop(self):
        """Main control loop"""
        last_state_print = 0
        
        while self.running:
            try:
                current_time = time.time()
                
                # Print state info every 30 seconds
                if current_time - last_state_print >= 30:
                    self.state_manager.print_state_info()
                    last_state_print = current_time
                
                # Handle state-based actions
                self._handle_current_state()
                
                # Sleep for process check interval
                time.sleep(self.process_check_interval)
                
            except Exception as e:
                ColorPrint.red(f"❌ Error in main loop: {e}")
                time.sleep(5)  # Wait before retrying
    
    def _handle_current_state(self):
        """Handle actions based on current state"""
        current_state = self.state_manager.get_current_state()
        
        if current_state == BotState.WAITING_TO_START:
            self._handle_waiting_to_start()
        elif current_state == BotState.STARTING:
            self._handle_starting()
        elif current_state == BotState.RUNNING:
            self._handle_running()
        elif current_state == BotState.NORMAL_EXIT_WAITING:
            self._handle_normal_exit_waiting()
        elif current_state == BotState.ERROR_EXIT_WAITING:
            self._handle_error_exit_waiting()
        elif current_state == BotState.DIABLO_RESTART_NEEDED:
            self._handle_diablo_restart_needed()
    
    def _handle_waiting_to_start(self):
        """Handle waiting to start state"""
        if self.state_manager.should_start_bot():
            self._start_bot_sequence()
    
    def _handle_starting(self):
        """Handle starting state"""
        # Check if bot processes are running
        if self.bot_scanner:
            boot_exe_name = self.bot_scanner.get_boot_exe_name()
            if boot_exe_name:
                if self.process_manager.is_process_running(boot_exe_name):
                    ColorPrint.green(f"✅ Bot process detected: {boot_exe_name}")
                    self.state_manager.handle_bot_started()
                    
                    # Always perform UI analysis and automation
                    self._perform_bot_automation(boot_exe_name)
            else:
                # Try to rescan for boot exe
                self.bot_scanner.rescan_for_boot_exe()
    
    def _handle_running(self):
        """Handle running state"""
        # Check if bot should be stopped
        if self.state_manager.should_stop_bot():
            self._stop_bot_sequence()
        else:
            # Check if bot is still running
            if self.bot_scanner:
                boot_exe_name = self.bot_scanner.get_boot_exe_name()
                if boot_exe_name and not self.process_manager.is_process_running(boot_exe_name):
                    ColorPrint.yellow("⚠️  Bot process no longer running")
                    self._check_bot_exit_reason()
    
    def _handle_normal_exit_waiting(self):
        """Handle normal exit waiting state"""
        if self.state_manager.should_start_bot():
            self._start_bot_sequence()
    
    def _handle_error_exit_waiting(self):
        """Handle error exit waiting state"""
        if self.state_manager.should_start_bot():
            # First restart Diablo if needed
            self._restart_diablo_if_needed()
            self._start_bot_sequence()
    
    def _handle_diablo_restart_needed(self):
        """Handle Diablo restart needed state"""
        self._restart_diablo_if_needed()
        self._start_bot_sequence()
    
    def _start_bot_sequence(self):
        """Start bot sequence"""
        try:
            ColorPrint.blue("🚀 Starting bot sequence...")
            self.state_manager.handle_bot_starting()

            if not self.bot_scanner:
                ColorPrint.red("❌ Bot scanner not initialized")
                return

            # Get bot executable paths
            bot_exe_path = self.bot_scanner.get_bot_exe_path()
            boot_exe_path = self.bot_scanner.get_boot_exe_path()

            # Priority 1: Check if boot exe (other exe) is already running
            if boot_exe_path:
                boot_exe_name = Path(boot_exe_path).name
                if self.process_manager.is_process_running(boot_exe_name):
                    ColorPrint.green(f"✅ Boot exe already running: {boot_exe_name}")
                    self.state_manager.handle_bot_started()
                    return
                else:
                    # Try to start boot exe directly first
                    ColorPrint.blue(f"[BOOT] Attempting to start boot exe directly: {boot_exe_name}")
                    force_restart = CONFIG.get("bot_settings.force_restart", True)
                    success = self.process_manager.start_program_with_explorer(boot_exe_path, "", force_restart, self.startup_wait_time)

                    if success:
                        ColorPrint.green(f"[SUCCESS] Boot exe started directly: {boot_exe_name}")
                        self.state_manager.handle_bot_started()
                        return
                    else:
                        ColorPrint.yellow(f"[FALLBACK] Failed to start boot exe directly, falling back to RoS-BoT.exe")

            # Priority 2: Start RoS-BoT.exe to generate boot exe
            if bot_exe_path:
                ColorPrint.blue(f"[ROSBOT] Starting RoS-BoT.exe: {bot_exe_path}")
                force_restart = CONFIG.get("bot_settings.force_restart", True)
                success = self.process_manager.start_program_with_explorer(bot_exe_path, "", force_restart, self.startup_wait_time)

                if success:
                    ColorPrint.green("[SUCCESS] RoS-BoT.exe started successfully")

                    # Rescan for boot exe
                    new_boot_exe = self.bot_scanner.rescan_for_boot_exe()
                    if new_boot_exe and self.process_manager.is_process_running(new_boot_exe):
                        ColorPrint.green(f"[BOOT_FOUND] Boot exe detected and running: {new_boot_exe}")
                        self.state_manager.handle_bot_started()
                    else:
                        ColorPrint.yellow("[FALLBACK] Boot exe not detected, using RoS-BoT.exe")
                        # Check if RoS-BoT.exe itself is still running
                        if self.process_manager.is_process_running("RoS-BoT.exe"):
                            ColorPrint.blue("[ACTIVE] RoS-BoT.exe is running, using as active process")
                            self.state_manager.handle_bot_started()
                        else:
                            ColorPrint.red("[ERROR] No active bot process found")
                            self.state_manager.handle_bot_error_exit()
                else:
                    ColorPrint.red("[FAILED] Failed to start RoS-BoT.exe")
                    self.state_manager.handle_bot_error_exit()
            else:
                ColorPrint.red("❌ Bot executable path not found")
                self.state_manager.handle_bot_error_exit()

        except Exception as e:
            ColorPrint.red(f"❌ Error in bot start sequence: {e}")
            self.state_manager.handle_bot_error_exit()
    
    def _stop_bot_sequence(self):
        """Stop bot sequence using F7 key"""
        try:
            ColorPrint.blue("🛑 Stopping bot sequence...")
            
            if self.bot_scanner:
                boot_exe_name = self.bot_scanner.get_boot_exe_name()
                if boot_exe_name:
                    # Send F7 key to stop the bot
                    ColorPrint.blue("⌨️  Sending F7 key to stop bot...")
                    result = self.automation_controller._perform_key_press("F7")
                    
                    if result["success"]:
                        ColorPrint.green("✅ F7 key sent successfully")
                        time.sleep(self.shutdown_wait_time)
                        
                        # Check if bot stopped
                        if not self.process_manager.is_process_running(boot_exe_name):
                            ColorPrint.green("✅ Bot stopped normally")
                            self.state_manager.handle_bot_normal_exit()
                        else:
                            ColorPrint.yellow("⚠️  Bot still running after F7, force killing...")
                            self.process_manager.kill_process_by_name(boot_exe_name)
                            self.state_manager.handle_bot_normal_exit()
                    else:
                        ColorPrint.red("❌ Failed to send F7 key")
                        self.state_manager.handle_bot_error_exit()
            
        except Exception as e:
            ColorPrint.red(f"❌ Error in bot stop sequence: {e}")
            self.state_manager.handle_bot_error_exit()
    
    def _perform_bot_automation(self, process_name: str):
        """Perform UI analysis and automation on bot"""
        try:
            # Always perform UI analysis
            ColorPrint.blue("[UI] Starting UI analysis...")
            time.sleep(self.ui_analysis_delay)

            # Initialize UI analyzer if not already done
            if not self.ui_analyzer:
                ui_analysis_dir = Path(self.user_temp_dir) / "ui_analysis"
                self.ui_analyzer = UIAnalyzer(str(ui_analysis_dir))

            # Analyze UI - always execute regardless of configuration
            analysis_result = self.ui_analyzer.analyze_window_ui(process_name, process_name)

            if analysis_result["success"]:
                ColorPrint.green("[UI_SUCCESS] UI analysis completed")
                ColorPrint.blue(f"[UI_INFO] Screenshot: {analysis_result['screenshot_path']}")
                ColorPrint.blue(f"[UI_INFO] JSON data: {analysis_result['json_path']}")
                ColorPrint.blue(f"[UI_INFO] Annotated: {analysis_result['annotated_path']}")
                ColorPrint.blue(f"[UI_INFO] Elements found: {analysis_result['ui_elements_count']}")

                # Perform automation if operation IDs are configured
                if self.operation_ids:
                    ColorPrint.blue("[AUTO] Starting automation sequence...")
                    automation_result = self.automation_controller.execute_operations(
                        process_name,
                        self.operation_ids,
                        analysis_result.get("ui_elements")
                    )

                    if automation_result["success"]:
                        ColorPrint.green("[AUTO_SUCCESS] Automation completed successfully")
                    else:
                        ColorPrint.yellow(f"[AUTO_WARNING] Automation issues: {automation_result.get('error', 'Unknown error')}")
                else:
                    ColorPrint.blue("[AUTO_SKIP] No operation IDs configured, skipping automation")
            else:
                ColorPrint.red(f"[UI_ERROR] UI analysis failed: {analysis_result.get('error', 'Unknown error')}")

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error in bot automation: {e}")
    
    def _check_bot_exit_reason(self):
        """Check reason for bot exit"""
        # Simple heuristic: if Diablo processes are found, it was likely an error
        diablo_processes = self.process_manager.get_processes_by_window_title(self.diablo_window_titles)
        
        if diablo_processes:
            ColorPrint.yellow("⚠️  Diablo processes found, assuming error exit")
            self.state_manager.handle_bot_error_exit()
        else:
            ColorPrint.blue("ℹ️  No Diablo processes found, assuming normal exit")
            self.state_manager.handle_bot_normal_exit()
    
    def _restart_diablo_if_needed(self):
        """Restart Diablo processes if needed"""
        try:
            if self.battlenet_manager:
                ColorPrint.blue("🔄 Using Battle.net manager for Diablo restart...")
                restart_battlenet = CONFIG.get("battlenet_settings.restart_battlenet_first", True)
                result = self.battlenet_manager.restart_diablo_sequence(restart_battlenet)

                if result["success"]:
                    ColorPrint.green("✅ Diablo restart sequence completed")

                    # Perform Battle.net automation if configured
                    battlenet_operations = CONFIG.get("battlenet_settings.operation_sequence", [])
                    if battlenet_operations:
                        ui_analysis_dir = str(Path(self.user_temp_dir) / "ui_analysis")
                        automation_result = self.battlenet_manager.perform_battlenet_automation(
                            battlenet_operations, ui_analysis_dir
                        )

                        if automation_result["success"]:
                            ColorPrint.green("✅ Battle.net automation completed")
                        else:
                            ColorPrint.yellow(f"⚠️  Battle.net automation warning: {automation_result.get('error', 'Unknown error')}")
                else:
                    ColorPrint.red(f"❌ Diablo restart failed: {result.get('error', 'Unknown error')}")
            else:
                # Fallback to manual process management
                ColorPrint.blue("🔄 Using manual Diablo process management...")
                diablo_processes = self.process_manager.get_processes_by_window_title(self.diablo_window_titles)

                for process in diablo_processes:
                    ColorPrint.blue(f"🔄 Killing Diablo process: {process['name']} (PID: {process['pid']})")
                    self.process_manager.kill_process_by_pid(process['pid'])

                if diablo_processes:
                    time.sleep(3)
                    ColorPrint.green("✅ Diablo processes terminated")

        except Exception as e:
            ColorPrint.red(f"❌ Error restarting Diablo: {e}")
    
    def _shutdown(self):
        """Shutdown the controller"""
        ColorPrint.blue("🛑 Shutting down MainController...")
        self.running = False
        
        # Cleanup temporary files
        if self.process_manager:
            self.process_manager.cleanup_temp_files()
        
        ColorPrint.green("✅ MainController shutdown complete")
    
    def stop(self):
        """Stop the controller"""
        self.running = False
