#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3 Screenshot Capturer
Captures screenshots of Diablo III game window
"""

import os
import sys
from typing import Optional, List
from pathlib import Path

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
ncore_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(current_dir))), "ncore")
sys.path.insert(0, project_root)
sys.path.insert(0, ncore_path)

from pytools.pyfoundations.color_print import ColorPrint
from pytools.pyutils.window_screenshot import WindowScreenshot
from providor.providor_index import DIABLO_III_WINDOW_TITLES


class D3ScreenshotCapturer:
    """
    Screenshot capturer for Diablo III game window

    Features:
    - Automatically finds Diablo III window by title
    - Activates window before capturing
    - Returns None if window not found
    """

    def __init__(self):
        """Initialize screenshot capturer"""
        self.screenshot_manager = WindowScreenshot(match_mode="in")
        self.window_offset_x = 0  # Window left position on screen
        self.window_offset_y = 0  # Window top position on screen
        ColorPrint.green("[D3ScreenshotCapturer] Initialized")

    def capture(self, filename_prefix: str = "d3_screenshot") -> Optional[Path]:
        """
        Capture a new screenshot of Diablo III window

        This method:
        1. Searches for Diablo III window by title
        2. Activates the window
        3. Captures screenshot
        4. Returns screenshot path or None if window not found

        Args:
            filename_prefix: Prefix for screenshot filename

        Returns:
            Path to captured screenshot or None if window not found
        """
        ColorPrint.blue("[Capture] Searching for Diablo III window...")

        try:
            # Find window first to get offset coordinates
            windows = self.screenshot_manager.find_windows_by_titles(DIABLO_III_WINDOW_TITLES)

            if not windows:
                ColorPrint.yellow("[Capture] No Diablo III window found")
                return None

            # Save window offset from the first matching window
            window_info = windows[0]
            rect = window_info["rect"]  # (left, top, right, bottom)
            self.window_offset_x = rect[0]
            self.window_offset_y = rect[1]

            ColorPrint.blue(f"[Capture] Window position: offset_x={self.window_offset_x}, offset_y={self.window_offset_y}")

            # Capture screenshot (automatically activates window)
            screenshots = self.screenshot_manager.screenshot_by_titles(
                titles=DIABLO_III_WINDOW_TITLES,
                filename_prefix=filename_prefix
            )

            if not screenshots:
                ColorPrint.yellow("[Capture] Failed to capture screenshot")
                return None

            screenshot_path = screenshots[0]
            ColorPrint.green(f"[Capture] Screenshot captured: {screenshot_path}")

            return Path(screenshot_path)

        except Exception as e:
            ColorPrint.red(f"[Capture] Error capturing screenshot: {e}")
            import traceback
            traceback.print_exc()
            return None

    def get_window_offset(self) -> tuple:
        """
        Get window offset coordinates (left, top)

        Returns:
            Tuple (offset_x, offset_y) representing window position on screen
        """
        return (self.window_offset_x, self.window_offset_y)

    def check_window_exists(self) -> bool:
        """
        Check if Diablo III window exists

        Returns:
            True if window found, False otherwise
        """
        try:
            windows = self.screenshot_manager.find_windows_by_titles(DIABLO_III_WINDOW_TITLES)
            if windows:
                ColorPrint.green(f"[Check] Found {len(windows)} Diablo III window(s)")
                return True
            else:
                ColorPrint.yellow("[Check] No Diablo III windows found")
                return False
        except Exception as e:
            ColorPrint.red(f"[Check] Error checking window: {e}")
            return False


# Example usage
if __name__ == "__main__":
    capturer = D3ScreenshotCapturer()

    # Check if window exists
    if capturer.check_window_exists():
        # Capture screenshot
        screenshot_path = capturer.capture()
        if screenshot_path:
            print(f"Screenshot saved: {screenshot_path}")
        else:
            print("Failed to capture screenshot")
    else:
        print("Diablo III window not found")
