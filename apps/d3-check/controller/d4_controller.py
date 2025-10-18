#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Controller
Main controller for Diablo IV operations

Registered to timer_manager for periodic execution
Uses interceptor pattern to control task execution without starting/stopping timers
"""

import os
import sys
import time
from pathlib import Path
from datetime import datetime

# Add project paths
current_dir = Path(__file__).parent.parent
sys.path.insert(0, str(current_dir))

from providor.common_imports import ColorPrint
from providor.providor_index import DIABLO_IV_WINDOW_TITLES, TMP_DIR
# D4State functionality now integrated into D4InterfaceData
from d3utils.screenshot_provider import get_screenshot_provider
from share.game_interface_data import (
    get_d4_interface_data,
    D4_SCREENSHOT_DIR,
    D4_ANNOTATED_DIR
)
from controller.d4func import ExpFarmingManager, get_ui_status_updater, get_event_manager


class D4Controller:
    """
    D4 Main Controller

    Registered to timer_manager with 3-second interval
    Uses interceptor pattern: timer always runs but checks state before executing
    """

    def __init__(self):
        """Initialize D4 controller"""
        # D4State functionality now integrated into D4InterfaceData

        # Get D4 interface data (independent shared data)
        self.d4_data = get_d4_interface_data()

        # Initialize EXP farming manager
        self.exp_farming_manager = ExpFarmingManager()

        # Initialize UI status updater
        self.ui_status_updater = get_ui_status_updater()

        # Initialize event manager
        self.event_manager = get_event_manager()

        # Tick counter for EXP farming
        self.tick_counter = 0

        # Create directories from share constants
        D4_SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
        D4_ANNOTATED_DIR.mkdir(parents=True, exist_ok=True)

        ColorPrint.green("[D4Controller] Initialized")
        ColorPrint.blue(f"[D4Controller] Screenshot directory: {D4_SCREENSHOT_DIR}")
        ColorPrint.blue(f"[D4Controller] Annotated directory: {D4_ANNOTATED_DIR}")

    def process(self):
        """
        Main processing method called by timer

        This method is called every 3 seconds by timer_manager
        Uses interceptor pattern: timer always runs but checks state before executing
        """
        try:
            # Check if EXP farming is running (interceptor logic)
            if not self.d4_data.is_exp_farming_running():
                return  # Skip execution if not running

            # Increment tick counter
            self.tick_counter += 1

            # Print tick header
            print("\n" + "="*80)
            ColorPrint.blue(f"[D4 EXP Farming] Tick #{self.tick_counter}")
            print("="*80)

            # Delegate to EXP farming manager
            success = self.exp_farming_manager.start_exp_farming_process(self.d4_data)

            # Update UI status with latest shared data
            self.ui_status_updater.update_ui_status()

            # Check for state changes and trigger events
            self.event_manager.check_state_changes()

            # Print tick summary
            self._print_tick_summary(success)

        except Exception as e:
            ColorPrint.red(f"[D4Controller] Error in process: {e}")
            import traceback
            traceback.print_exc()

    def get_interceptor(self):
        """
        Get interceptor function for timer system
        
        Returns:
            Function that checks if EXP farming is running before executing process
        """
        def interceptor():
            """Interceptor function that checks EXP farming state"""
            return self.d4_data.is_exp_farming_running()
        
        return interceptor

    def _print_tick_summary(self, success: bool):
        """
        Print a clean summary for the current tick

        Args:
            success: Whether the tick process was successful
        """
        try:
            # Import DEBUG flag
            from providor.providor_index import DEBUG

            # Get window info
            window_size = self.d4_data.game_window_size if self.d4_data.game_window_size else (0, 0)
            is_windowed = self.d4_data.is_windowed_mode()

            # Get region/point counts
            region_count = len(self.d4_data.detected_regions) if hasattr(self.d4_data, 'detected_regions') else 0
            point_count = len(self.d4_data.detected_points) if hasattr(self.d4_data, 'detected_points') else 0

            # Get screenshot path
            screenshot_path = self.d4_data.last_screenshot_path if hasattr(self.d4_data, 'last_screenshot_path') and self.d4_data.last_screenshot_path else "N/A"
            if screenshot_path and screenshot_path != "N/A" and len(screenshot_path) > 60:
                screenshot_path = "..." + screenshot_path[-57:]

            # Get annotated image path
            annotated_path = self.d4_data.last_annotated_screenshot_path if hasattr(self.d4_data, 'last_annotated_screenshot_path') else None
            annotated_display = "N/A"
            if annotated_path:
                annotated_display = "..." + annotated_path[-57:] if len(annotated_path) > 60 else annotated_path

            # Print summary
            print("-" * 80)
            ColorPrint.green(f"[Summary] Status: {'[OK] Success' if success else '[ERROR] Failed'}")
            ColorPrint.blue(f"[Summary] DEBUG Mode: {'Enabled' if DEBUG else 'Disabled'}")
            ColorPrint.blue(f"[Summary] Window: {window_size[0]}x{window_size[1]} ({'Windowed' if is_windowed else 'Fullscreen'})")
            ColorPrint.blue(f"[Summary] Detected: {region_count} regions, {point_count} points")
            if screenshot_path != "N/A":
                ColorPrint.blue(f"[Summary] Screenshot: {screenshot_path}")
            if annotated_path:
                ColorPrint.blue(f"[Summary] Annotated: {annotated_display}")
            print("=" * 80 + "\n")

        except Exception as e:
            ColorPrint.red(f"[D4Controller] Error printing tick summary: {e}")

    def start_exp_farming(self):
        """
        Start EXP farming

        Sets state to trigger screenshot capture in timer callback
        """
        # Reset tick counter when starting
        self.tick_counter = 0
        self.d4_data.set_exp_farming_running(True)

        print("\n" + "="*80)
        ColorPrint.green("[D4 EXP Farming] Started")
        print("="*80 + "\n")

    def stop_exp_farming(self):
        """
        Stop EXP farming

        Sets state to skip screenshot capture in timer callback
        """
        self.d4_data.set_exp_farming_running(False)

        print("\n" + "="*80)
        ColorPrint.green(f"[D4 EXP Farming] Stopped (Total ticks: {self.tick_counter})")
        print("="*80 + "\n")

    def is_exp_farming_running(self) -> bool:
        """
        Check if EXP farming is running

        Returns:
            True if running, False otherwise
        """
        return self.d4_data.is_exp_farming_running()

    def get_state_dict(self) -> dict:
        """
        Get current D4 state

        Returns:
            Dictionary with current state
        """
        return self.d4_data.get_summary()


# Global D4 controller instance (singleton)
_d4_controller = None


def get_d4_controller() -> D4Controller:
    """
    Get global D4 controller instance (singleton)

    Returns:
        Global D4Controller instance
    """
    global _d4_controller

    if _d4_controller is None:
        _d4_controller = D4Controller()
        ColorPrint.green("[Global] D4 controller initialized")

    return _d4_controller


# Example usage
if __name__ == "__main__":
    # Get controller instance
    controller = get_d4_controller()

    # Start EXP farming
    controller.start_exp_farming()

    # Simulate timer calls
    print("\nSimulating timer calls...")
    for i in range(3):
        print(f"\n--- Timer call #{i+1} ---")
        controller.process()
        time.sleep(3)

    # Stop EXP farming
    controller.stop_exp_farming()

    # One more call (should be skipped)
    print("\n--- Timer call #4 (should be skipped) ---")
    controller.process()

    print(f"\nFinal state: {controller.get_state_dict()}")