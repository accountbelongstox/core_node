#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Screenshot Handler for D4 Controller. Singleton via get_screenshot_handler(); do not instantiate elsewhere.
"""

from datetime import datetime

from pycore.pyfoundations.color_print import ColorPrint
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
        ColorPrint.blue("[ScreenshotHandler] Capturing screenshot and collecting info...")
        screenshot_data = self.screenshot_provider.gen(
            use_optimized_capture=True,
            window_titles=DIABLO_IV_WINDOW_TITLES
        )
        if screenshot_data is None:
            ColorPrint.yellow("[ScreenshotHandler] Failed to capture screenshot")
            d4_data.window_detected = False
            d4_data.window_hwnd = None
            d4_data.window_title = ""
            d4_data.window_position = (0, 0)
            return False
        if screenshot_data.game_window_size:
            d4_data.window_detected = True
            d4_data.window_hwnd = None
            d4_data.window_title = ""
            d4_data.window_position = screenshot_data.window_offset
            self.d4_data.screenshot_data = screenshot_data
            self.d4_data.game_window_size = screenshot_data.game_window_size
            self.d4_data.fullscreen_size = screenshot_data.fullscreen_size
            self.d4_data.window_offset = screenshot_data.window_offset
            self.d4_data.timestamp = datetime.now().isoformat()
            ColorPrint.blue(f"[ScreenshotHandler] 📸 Updated D4 data:")
            ColorPrint.blue(f"  fullscreen_size: {self.d4_data.fullscreen_size}")
            ColorPrint.blue(f"  game_window_size: {self.d4_data.game_window_size}")
            ColorPrint.blue(f"  window_offset: {self.d4_data.window_offset}")
            ColorPrint.blue(f"  is_windowed: {self.d4_data.is_windowed_mode()}")
            ColorPrint.green("[ScreenshotHandler] Screenshot captured and info collected")
            return True
        else:
            d4_data.window_detected = False
            d4_data.window_hwnd = None
            d4_data.window_title = ""
            d4_data.window_position = (0, 0)
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
        if not screenshot_data or not screenshot_data.game_window_image:
            return ""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        screenshot_filename = f"d4_exp_farming_{timestamp}.png"
        screenshot_path = screenshot_dir / screenshot_filename
        screenshot_data.game_window_image.save(screenshot_path)
        ColorPrint.green(f"[ScreenshotHandler] Screenshot saved: {screenshot_path}")
        return str(screenshot_path)


_screenshot_handler_instance = None


def get_screenshot_handler() -> ScreenshotHandler:
    """Return the global ScreenshotHandler instance (singleton)."""
    global _screenshot_handler_instance
    if _screenshot_handler_instance is None:
        _screenshot_handler_instance = ScreenshotHandler()
    return _screenshot_handler_instance
