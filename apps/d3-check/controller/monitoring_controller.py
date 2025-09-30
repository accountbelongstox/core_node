#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Monitoring Controller
Continuous monitoring system for Diablo III and Battle.net
"""

import os
import sys
import time
import threading


# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

from providor.providor_second import CONFIG, load_config
from base.color_print import ColorPrint
from controller.game_management_controller import GameManagementController
from controller.battlenet_controller import BattleNetController


class MonitoringController:
    """Continuous monitoring system for Diablo III and Battle.net"""
    
    def __init__(self):
        """Initialize monitoring controller"""
        # Ensure configuration is loaded
        load_config()

        # Load configuration
        self.monitoring_enabled = CONFIG.get('monitoring', {}).get('enabled', True)
        self.check_interval = CONFIG.get('monitoring', {}).get('check_interval_seconds', 5)
        self.force_start_diablo = CONFIG.get('monitoring', {}).get('force_start_diablo', False)
        self.force_start_battlenet = CONFIG.get('monitoring', {}).get('force_start_battlenet', False)
        self.startup_timeout = CONFIG.get('monitoring', {}).get('startup_timeout_seconds', 120)
        
        # Initialize components
        self.game_management_controller = GameManagementController()
        self.battlenet_controller = BattleNetController()
        
        # State tracking
        self.is_running = False
        self.is_startup_in_progress = False
        self.startup_lock = threading.Lock()
        
        ColorPrint.green("[INIT] MonitoringController initialized")
        ColorPrint.blue(f"[CONFIG] Check interval: {self.check_interval}s")
        ColorPrint.blue(f"[CONFIG] Force start Diablo: {self.force_start_diablo}")
        ColorPrint.blue(f"[CONFIG] Force start Battle.net: {self.force_start_battlenet}")
    
    def update_system_status(self):
        """Update status of all processes"""
        self.game_management_controller.update_all_process_states()

    def print_system_status(self, force_print: bool = False):
        """Print system status summary"""
        self.game_management_controller.print_system_status(force_print)

    def should_start_diablo(self) -> bool:
        """Determine if Diablo III should be started"""
        return self.game_state_manager.should_start_diablo()

    def should_start_battlenet(self) -> bool:
        """Determine if Battle.net should be started"""
        if self.force_start_battlenet:
            ColorPrint.blue("[DECISION] Force start Battle.net enabled - will start")
            return True

        # If Diablo is already running and we don't force start, skip Battle.net
        if self.game_state_manager.diablo_state.is_running and not self.force_start_diablo:
            ColorPrint.green("[SKIP] Diablo III running and no force start - skip Battle.net")
            return False
        else:
            ColorPrint.yellow("[DECISION] Need to start Battle.net for Diablo launch")
            return True
    
    def perform_startup_sequence(self) -> bool:
        """Perform the complete startup sequence"""
        try:
            with self.startup_lock:
                self.is_startup_in_progress = True
                ColorPrint.blue("[STARTUP] Starting complete startup sequence...")
                
                start_time = time.time()
                
                # Check if we need to start anything
                need_diablo = self.should_start_diablo()
                need_battlenet = self.should_start_battlenet()
                
                if not need_diablo and not need_battlenet:
                    ColorPrint.green("[COMPLETE] No startup needed - all systems running")
                    return True
                
                if need_battlenet:
                    ColorPrint.blue("[BATTLENET] Starting Battle.net automation sequence...")
                    
                    # Run the complete Battle.net automation
                    result = self.battlenet_controller.analyze_battlenet_window()
                    
                    if result.get("success", False):
                        if result.get("game_launched", False):
                            elapsed_time = time.time() - start_time
                            ColorPrint.green(f"[SUCCESS] Diablo III launch successful in {elapsed_time:.1f}s")
                            ColorPrint.green(f"[GAME] Diablo III launched: '{result.get('game_window_title', 'Unknown')}'")

                            # Update state manager with Diablo launch success
                            self.game_state_manager.update_all_status()

                            # Step: Start RoS-BoT management sequence
                            ColorPrint.blue("[ROSBOT] Starting RoS-BoT management sequence...")
                            rosbot_result = self.game_state_manager.rosbot_manager.start_rosbot_sequence()

                            if rosbot_result.get("success", False):
                                total_elapsed = time.time() - start_time
                                ColorPrint.green(f"[COMPLETE] Full startup sequence successful in {total_elapsed:.1f}s")

                                # Update state manager with analysis results
                                if rosbot_result.get("rosbot_process"):
                                    self.game_state_manager.mark_analysis_completed("rosbot", analysis_result=rosbot_result.get("analysis_results", {}).get("rosbot"))

                                for other_exe in rosbot_result.get("other_exe_started", []):
                                    exe_name = other_exe['exe_name']
                                    process_name = exe_name.replace('.exe', '')
                                    analysis_result = rosbot_result.get("analysis_results", {}).get(process_name)
                                    self.game_state_manager.mark_analysis_completed("other_exe", process_name, analysis_result)

                                # Print final status
                                self.game_state_manager.print_status_summary(force_print=True)

                                return True
                            else:
                                ColorPrint.yellow(f"[PARTIAL] Diablo III launched but RoS-BoT failed: {rosbot_result.get('error', 'Unknown')}")
                                return True  # Still consider successful since Diablo launched
                        elif result.get("play_clicked", False):
                            ColorPrint.yellow("[PARTIAL] Play button clicked but game not detected")
                            return False
                        elif result.get("diablo_clicked", False):
                            ColorPrint.yellow("[PARTIAL] Diablo III button clicked but Play button failed")
                            return False
                        else:
                            ColorPrint.yellow("[PARTIAL] Battle.net analysis successful but no buttons clicked")
                            return False
                    else:
                        ColorPrint.red("[FAILED] Battle.net automation failed")
                        return False
                else:
                    ColorPrint.green("[SKIP] Battle.net startup not needed")
                    return True
                    
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error in startup sequence: {e}")
            return False
        finally:
            self.is_startup_in_progress = False
    
    def monitoring_cycle(self):
        """Single monitoring cycle"""
        try:
            # Check if startup is in progress (non-blocking check)
            if self.is_startup_in_progress:
                ColorPrint.gray("[MONITOR] Startup in progress - skipping check")
                return

            # Update all process status
            self.update_system_status()

            # Print status summary every 5 seconds
            self.print_system_status()

            # Get system status for decision making
            system_status = self.game_management_controller.game_state_manager.get_system_status()

            # Check if any action is needed
            if system_status["needs_diablo_start"]:
                ColorPrint.blue("[ACTION] Starting Diablo III launch sequence...")
                success = self.perform_startup_sequence()

                if success:
                    ColorPrint.green("[RESULT] Startup sequence completed successfully")
                    # Update status after successful startup
                    self.update_system_status()
                    self.print_system_status(force_print=True)
                else:
                    ColorPrint.red("[RESULT] Startup sequence failed")
            elif system_status["needs_rosbot_start"] or system_status["needs_other_exe_start"]:
                # Use game management controller for RoS-BoT management
                rosbot_result = self.game_management_controller.perform_rosbot_management()

                if rosbot_result.get("success", False):
                    ColorPrint.green("[RESULT] RoS-BoT management completed successfully")
                    # Update and print final status
                    self.update_system_status()
                    self.print_system_status(force_print=True)
                else:
                    ColorPrint.red(f"[RESULT] RoS-BoT management failed: {rosbot_result.get('error', 'Unknown')}")
            else:
                ColorPrint.gray("[ACTION] All systems running - no action needed")

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error in monitoring cycle: {e}")

    def run_single_cycle(self):
        """Run a single monitoring cycle for testing"""
        try:
            ColorPrint.blue("[SINGLE_CYCLE] Running single monitoring cycle...")
            self.monitoring_cycle()
            ColorPrint.green("[SINGLE_CYCLE] Single cycle completed successfully")
        except Exception as e:
            ColorPrint.red(f"[SINGLE_CYCLE] Error in single cycle: {e}")
            raise

    def start_monitoring(self):
        """Start the continuous monitoring loop"""
        if not self.monitoring_enabled:
            ColorPrint.yellow("[DISABLED] Monitoring is disabled in configuration")
            return

        ColorPrint.green("[START] Starting continuous monitoring...")
        ColorPrint.blue(f"[INFO] Check interval: {self.check_interval} seconds")
        ColorPrint.blue(f"[INFO] Startup timeout: {self.startup_timeout} seconds")
        ColorPrint.blue("[INFO] Press Ctrl+C to stop monitoring")
        ColorPrint.blue("=" * 50)

        self.is_running = True
        cycle_count = 0

        try:
            while self.is_running:
                cycle_count += 1
                ColorPrint.blue(f"[CYCLE_{cycle_count}] Starting monitoring cycle...")

                self.monitoring_cycle()

                if not self.is_running:
                    break

                # Wait for next check (but allow interruption during startup)
                if self.is_startup_in_progress:
                    ColorPrint.gray("[WAIT] Startup in progress - waiting for completion...")
                    # During startup, check more frequently but don't start new cycles
                    while self.is_startup_in_progress and self.is_running:
                        time.sleep(1)
                else:
                    ColorPrint.gray(f"[WAIT] Next check in {self.check_interval} seconds...")
                    for _ in range(self.check_interval):
                        if not self.is_running:
                            break
                        time.sleep(1)

        except KeyboardInterrupt:
            ColorPrint.yellow("[INTERRUPTED] Monitoring stopped by user")
        except Exception as e:
            ColorPrint.red(f"[ERROR] Monitoring error: {e}")
        finally:
            self.is_running = False
            ColorPrint.blue(f"[STOP] Monitoring stopped after {cycle_count} cycles")
    
    def stop_monitoring(self):
        """Stop the monitoring loop"""
        ColorPrint.blue("[STOP] Stopping monitoring...")
        self.is_running = False


def main():
    """Main function for testing"""
    controller = MonitoringController()
    controller.start_monitoring()


if __name__ == "__main__":
    main()
