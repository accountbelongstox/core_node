#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Controller
Main controller for Diablo IV operations.

Driven by D4ExtensionThread (every D4_TICK_INTERVAL), not timer_manager.
"""

import os
import sys
import time
from pathlib import Path
from datetime import datetime

# Add project paths
current_dir = Path(__file__).parent.parent
sys.path.insert(0, str(current_dir))

from pycore.pyfoundations.color_print import ColorPrint
from providor.app_constants import TMP_DIR
from providor.providor_index import DIABLO_IV_WINDOW_TITLES
# D4State functionality now integrated into D4InterfaceData
from d3utils.screenshot_provider import get_screenshot_provider
from providor.app_constants import D4_SCREENSHOT_DIR, D4_ANNOTATED_DIR
from share.game_interface_data import get_d4_interface_data
from controller.d4func import ExpFarmingManager, get_ui_status_updater
from controller.d4func.events.event_manager import get_event_manager


class D4Controller:
    """
    D4 Main Controller.

    process() is called by D4ExtensionThread every D4_TICK_INTERVAL when
    exp_farming or debug_window is active.
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
        Main processing method. Called by D4ExtensionThread every D4_TICK_INTERVAL
        when exp_farming or debug_window is active.
        """
        try:
            # Check if EXP farming is running
            exp_farming_running = self.d4_data.is_exp_farming_running()
            debug_window_open = self.d4_data.debug_window_open

            if exp_farming_running:
                # Full EXP farming process
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

                # Update debug window if open (interceptor pattern)
                self._update_debug_window_if_open()

                # Print tick summary
                self._print_tick_summary(success)

            elif debug_window_open:
                # Debug window only mode - perform screenshot and region detection
                ColorPrint.blue("[D4Controller] Debug window mode - performing screenshot and region detection...")
                
                # Use the same process as EXP farming but without the full farming logic
                # Step 1: Capture screenshot
                from .d4func.screenshot_handler import ScreenshotHandler
                screenshot_handler = ScreenshotHandler()
                screenshot_success = screenshot_handler.capture_and_collect_info(self.d4_data)
                ColorPrint.blue(f"[D4Controller] Screenshot capture result: {screenshot_success}")
                
                if screenshot_success:
                    # Step 2: Detect regions (this generates region_images)
                    from .d4func.region_detector import RegionDetector
                    region_detector = RegionDetector()
                    ColorPrint.blue("[D4Controller] About to call detect_regions_from_shared_data...")
                    detection_success = region_detector.detect_regions_from_shared_data()
                    ColorPrint.blue(f"[D4Controller] Region detection result: {detection_success}")

                    if detection_success:
                        # Step 3: Detect map switching (monitors Map Name region for black screen)
                        from .d4func.map_switch_detector import get_map_switch_detector
                        map_switch_detector = get_map_switch_detector()
                        map_switch_detector.detect_map_switch()
                        
                        # Step 4: Attempt map name recognition if in post-switch idle state
                        from .d4func.map_name_recognizer import get_map_name_recognizer
                        map_recognizer = get_map_name_recognizer()
                        map_recognizer.recognize_map_name()

                        # Update debug window with new data
                        self._update_debug_window_if_open()
                    else:
                        ColorPrint.yellow("[D4Controller] Region detection failed for debug window")
                else:
                    ColorPrint.yellow("[D4Controller] Screenshot capture failed for debug window")

            else:
                # Neither EXP farming nor debug window - skip execution
                return

        except Exception as e:
            ColorPrint.red(f"[D4Controller] Error in process: {e}")
            import traceback
            traceback.print_exc()

    def get_interceptor(self):
        """
        Get interceptor function for timer system
        
        Returns:
            Function that checks if EXP farming is running OR debug window is open
        """
        def interceptor():
            """Interceptor function that checks EXP farming state or debug window state"""
            # Allow execution if EXP farming is running OR debug window is open
            return self.d4_data.is_exp_farming_running() or self.d4_data.debug_window_open
        
        return interceptor

    def _print_tick_summary(self, success: bool):
        """
        Print a clean summary for the current tick

        Args:
            success: Whether the tick process was successful
        """
        try:
            # Import DEBUG flag
            from providor.app_constants import DEBUG

            # Get window info
            window_size = self.d4_data.game_window_size if self.d4_data.game_window_size else (0, 0)
            is_windowed = self.d4_data.is_windowed_mode()

            # Get region/point counts
            region_count = len(self.d4_data.detected_regions) if hasattr(self.d4_data, 'detected_regions') and self.d4_data.detected_regions else 0
            point_count = len(self.d4_data.detected_points) if hasattr(self.d4_data, 'detected_points') and self.d4_data.detected_points else 0

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
        self.d4_data.exp_farming_running = True  # Direct property access

        print("\n" + "="*80)
        ColorPrint.green("[D4 EXP Farming] Started")
        print("="*80 + "\n")

    def stop_exp_farming(self):
        """
        Stop EXP farming

        Sets state to skip screenshot capture in timer callback
        """
        self.d4_data.exp_farming_running = False  # Direct property access

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

    def _update_debug_window_if_open(self):
        """
        Update debug window images if debug window is open (interceptor pattern)

        This method checks if debug window is open before updating images.
        This implements the interceptor pattern - only execute when condition is met.
        """
        try:
            ColorPrint.blue(f"[D4Controller] Checking debug window status: {self.d4_data.debug_window_open}")

            # Check if debug window is open (interceptor logic)
            if not self.d4_data.debug_window_open:
                ColorPrint.yellow("[D4Controller] Debug window is closed, skipping update")
                return  # Skip update if window is closed

            ColorPrint.blue("[D4Controller] Debug window is open, updating images...")

            # Check detected_regions status
            if self.d4_data.detected_regions is None:
                ColorPrint.yellow("[D4Controller] detected_regions is None")
            elif 'region_images' not in self.d4_data.detected_regions:
                ColorPrint.yellow(f"[D4Controller] 'region_images' not in detected_regions. Keys: {list(self.d4_data.detected_regions.keys())}")
            else:
                region_count = len(self.d4_data.detected_regions.get('region_images', {}))
                ColorPrint.blue(f"[D4Controller] detected_regions has {region_count} region images")

            # Get debug window and update images
            from ui.components.debug_window import get_debug_window
            debug_window = get_debug_window()

            if debug_window is not None:
                debug_window.update_images()
                ColorPrint.green("[D4Controller] Debug window images updated successfully")
            else:
                ColorPrint.yellow("[D4Controller] Debug window instance is None")

        except Exception as e:
            ColorPrint.red(f"[D4Controller] Error updating debug window: {e}")
            import traceback
            traceback.print_exc()

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