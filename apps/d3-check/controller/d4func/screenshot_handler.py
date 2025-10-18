#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Screenshot Handler for D4 Controller
Handles screenshot capture and data collection
"""

import sys
from pathlib import Path
from datetime import datetime

# Add project paths
current_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(current_dir))

from providor.common_imports import ColorPrint
from providor.providor_index import DIABLO_IV_WINDOW_TITLES
from d3utils.screenshot_provider import get_screenshot_provider
from share.game_interface_data import get_d4_interface_data


class ScreenshotHandler:
    """
    Handles screenshot capture and data collection for D4
    
    Responsibilities:
    - Capture game screenshots
    - Update window state information
    - Store screenshot data in shared memory
    """

    def __init__(self):
        """Initialize screenshot handler"""
        self.screenshot_provider = get_screenshot_provider()
        self.d4_data = get_d4_interface_data()
        ColorPrint.blue("[ScreenshotHandler] Initialized")

    def capture_and_collect_info(self, d4_data) -> bool:
        """
        Capture screenshot and collect information
        
        Args:
            d4_data: D4 interface data instance
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            ColorPrint.blue("[ScreenshotHandler] Capturing screenshot and collecting info...")

            # Generate new screenshot using optimized capture
            screenshot_data = self.screenshot_provider.gen(
                use_optimized_capture=True,
                window_titles=DIABLO_IV_WINDOW_TITLES
            )

            if screenshot_data is None:
                ColorPrint.yellow("[ScreenshotHandler] Failed to capture screenshot")
                d4_data.set_window_info(False, None, "", (0, 0))
                return False

            # Update window state
            if screenshot_data.game_window_size:
                d4_data.set_window_info(
                    detected=True,
                    hwnd=None,  # hwnd not available from screenshot_data
                    title="",   # title not available from screenshot_data
                    position=screenshot_data.window_offset
                )

                # Update D4 interface data
                self.d4_data.game_window_size = screenshot_data.game_window_size
                self.d4_data.fullscreen_size = screenshot_data.fullscreen_size
                self.d4_data.window_offset = screenshot_data.window_offset
                self.d4_data.game_window_image = screenshot_data.game_window_image
                self.d4_data.fullscreen_image = screenshot_data.fullscreen_image
                self.d4_data.timestamp = datetime.now().isoformat()
                
                # Save screenshot_data to shared memory
                self.d4_data.screenshot_data = screenshot_data
                
                ColorPrint.green("[ScreenshotHandler] Screenshot captured and info collected")
                return True
            else:
                d4_data.set_window_info(False, None, "", (0, 0))
                return False

        except Exception as e:
            ColorPrint.red(f"[ScreenshotHandler] Error capturing screenshot: {e}")
            import traceback
            traceback.print_exc()
            return False

    def save_screenshot_to_disk(self, screenshot_data, screenshot_dir) -> str:
        """
        Save screenshot to disk
        
        Args:
            screenshot_data: Screenshot data object
            screenshot_dir: Directory to save screenshot
            
        Returns:
            str: Path to saved screenshot, empty string if failed
        """
        try:
            if not screenshot_data or not screenshot_data.game_window_image:
                return ""

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            screenshot_filename = f"d4_exp_farming_{timestamp}.png"
            screenshot_path = screenshot_dir / screenshot_filename
            
            screenshot_data.game_window_image.save(screenshot_path)
            ColorPrint.green(f"[ScreenshotHandler] Screenshot saved: {screenshot_path}")
            
            return str(screenshot_path)

        except Exception as e:
            ColorPrint.red(f"[ScreenshotHandler] Error saving screenshot: {e}")
            return ""
