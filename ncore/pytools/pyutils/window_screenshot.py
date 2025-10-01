#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window Screenshot Manager
Handles window searching, activation, and screenshot capture
"""

import os
import time
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple, Dict

# Add parent directory to path for dependency checking
pytools_dir = Path(__file__).parent.parent
sys.path.insert(0, str(pytools_dir))

# Check and install dependencies before importing third-party packages
from pytools import check_and_install_dependencies
check_and_install_dependencies()

import win32gui
import win32con
from PIL import ImageGrab
import pyautogui

from pyfoundations.color_print import ColorPrint
from pyfoundations.encyclopedia import ENCYCLOPEDIA
from pyutils.window_activator import WindowActivator
from pygvar.global_var_manager import PYTOOLS_TMP_DIR


class WindowScreenshot:
    """
    Window screenshot manager that can find windows by title(s),
    activate them, and take screenshots with timestamps
    """

    def __init__(self, match_mode: str = "endswith"):
        """
        Initialize window screenshot manager

        Args:
            match_mode: Window title matching mode - "in", "startswith", or "endswith" (default)
        """
        self.window_activator = WindowActivator()
        self.tmp_dir = PYTOOLS_TMP_DIR
        self.match_mode = match_mode.lower()

        if self.match_mode not in ["in", "startswith", "endswith"]:
            ColorPrint.yellow(f"[WARN] Invalid match_mode '{match_mode}', using 'endswith'")
            self.match_mode = "endswith"

        ColorPrint.green(f"[INIT] WindowScreenshot initialized")
        ColorPrint.blue(f"[TMP_DIR] Screenshot directory: {self.tmp_dir}")
        ColorPrint.blue(f"[MATCH_MODE] Title matching mode: {self.match_mode}")

    def _validate_cached_window(self, cached_info: Dict) -> bool:
        """
        Validate if cached window info is still valid

        Args:
            cached_info: Cached window information

        Returns:
            True if window still exists and is valid
        """
        try:
            hwnd = cached_info.get("hwnd")
            if not hwnd or not win32gui.IsWindow(hwnd):
                return False

            # Check if window is still visible
            if not win32gui.IsWindowVisible(hwnd):
                return False

            # Check if window title hasn't changed significantly
            current_title = win32gui.GetWindowText(hwnd)
            cached_title = cached_info.get("title", "")
            if current_title != cached_title:
                ColorPrint.yellow(f"[CACHE] Window title changed: '{cached_title}' -> '{current_title}'")
                return False

            return True

        except Exception as e:
            ColorPrint.yellow(f"[CACHE] Validation error: {e}")
            return False

    def find_windows_by_titles(self, titles: List[str], use_cache: bool = True) -> List[Dict]:
        """
        Find all windows matching any of the given titles
        First tries to get from encyclopedia cache, then searches if needed

        Args:
            titles: List of window titles or partial titles to search for
            use_cache: Whether to use cached window information

        Returns:
            List of dictionaries containing window information
        """
        # Convert single string to list
        if isinstance(titles, str):
            titles = [titles]

        matching_windows = []

        # Try to get from cache first
        if use_cache:
            for search_title in titles:
                cache_key = f"window_cache_{search_title.lower()}"
                cached_info = ENCYCLOPEDIA.get(cache_key)

                if cached_info and self._validate_cached_window(cached_info):
                    # Update rect in case window moved
                    try:
                        rect = win32gui.GetWindowRect(cached_info["hwnd"])
                        cached_info.update({
                            "rect": rect,
                            "left": rect[0],
                            "top": rect[1],
                            "right": rect[2],
                            "bottom": rect[3],
                            "width": rect[2] - rect[0],
                            "height": rect[3] - rect[1]
                        })
                        matching_windows.append(cached_info)
                        ColorPrint.green(f"[CACHE] Using cached window: '{cached_info['title']}' (Handle: {cached_info['hwnd']})")
                        continue
                    except Exception as e:
                        ColorPrint.yellow(f"[CACHE] Error updating cached window position: {e}")

                # Cache invalid or not found, need to search
                ColorPrint.blue(f"[SEARCH] Cache miss or invalid for '{search_title}', searching...")

        # Search for windows
        def enum_windows_callback(hwnd, lparam):
            if win32gui.IsWindowVisible(hwnd):
                try:
                    window_title = win32gui.GetWindowText(hwnd)
                    if window_title:
                        window_title_lower = window_title.lower()
                        for search_title in titles:
                            search_title_lower = search_title.lower()

                            # Apply match mode
                            matched = False
                            if self.match_mode == "in":
                                matched = search_title_lower in window_title_lower
                            elif self.match_mode == "startswith":
                                matched = window_title_lower.startswith(search_title_lower)
                            elif self.match_mode == "endswith":
                                matched = window_title_lower.endswith(search_title_lower)

                            if matched:
                                rect = win32gui.GetWindowRect(hwnd)
                                window_info = {
                                    "hwnd": hwnd,
                                    "title": window_title,
                                    "rect": rect,
                                    "left": rect[0],
                                    "top": rect[1],
                                    "right": rect[2],
                                    "bottom": rect[3],
                                    "width": rect[2] - rect[0],
                                    "height": rect[3] - rect[1],
                                    "class_name": win32gui.GetClassName(hwnd)
                                }

                                # Check if not already in matching_windows (from cache)
                                if not any(w["hwnd"] == hwnd for w in matching_windows):
                                    matching_windows.append(window_info)
                                    ColorPrint.green(f"[FOUND] Window: '{window_title}' (Handle: {hwnd})")

                                    # Cache the window info
                                    cache_key = f"window_cache_{search_title_lower}"
                                    ENCYCLOPEDIA.add(cache_key, window_info)
                                    ColorPrint.blue(f"[CACHE] Cached window info for '{search_title}'")

                                break
                except Exception as e:
                    ColorPrint.yellow(f"[WARN] Error checking window: {e}")
            return True

        try:
            win32gui.EnumWindows(enum_windows_callback, None)
            ColorPrint.blue(f"[SEARCH] Found {len(matching_windows)} matching window(s)")
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error enumerating windows: {e}")

        return matching_windows

    def activate_window(self, hwnd: int, title: str) -> bool:
        """
        Activate a window by its handle

        Args:
            hwnd: Window handle
            title: Window title (for logging)

        Returns:
            True if activation was successful
        """
        try:
            # Check if window is minimized
            if win32gui.IsIconic(hwnd):
                ColorPrint.blue(f"[RESTORE] Restoring minimized window: '{title}'")
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                time.sleep(0.5)

            # Bring window to foreground
            ColorPrint.blue(f"[ACTIVATE] Activating window: '{title}'")
            win32gui.SetForegroundWindow(hwnd)
            time.sleep(0.5)  # Wait for activation

            # Verify activation
            active_hwnd = win32gui.GetForegroundWindow()
            if active_hwnd == hwnd:
                ColorPrint.green(f"[SUCCESS] Window activated: '{title}'")
                return True
            else:
                ColorPrint.yellow(f"[WARN] Window activation uncertain: '{title}'")
                return True  # Continue anyway

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error activating window '{title}': {e}")
            return False

    def capture_window_screenshot(self, window_info: Dict, filename_prefix: str = "window") -> Optional[Path]:
        """
        Capture screenshot of a window

        Args:
            window_info: Dictionary containing window information (from find_windows_by_titles)
            filename_prefix: Prefix for the screenshot filename

        Returns:
            Path to the saved screenshot file, or None if failed
        """
        try:
            hwnd = window_info["hwnd"]
            title = window_info["title"]
            rect = window_info["rect"]

            # Activate window first
            if not self.activate_window(hwnd, title):
                ColorPrint.yellow(f"[WARN] Proceeding with screenshot despite activation issues")

            # Generate timestamp filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]  # Remove last 3 digits of microseconds
            safe_title = "".join(c if c.isalnum() or c in (' ', '-', '_') else '_' for c in title)[:50]
            filename = f"{filename_prefix}_{safe_title}_{timestamp}.png"
            filepath = self.tmp_dir / filename

            ColorPrint.blue(f"[CAPTURE] Capturing screenshot: '{title}'")
            ColorPrint.gray(f"          Region: {rect}")

            # Capture screenshot using PIL
            try:
                screenshot = ImageGrab.grab(bbox=rect)
                screenshot.save(filepath)
                ColorPrint.green(f"[SAVED] Screenshot saved: {filepath}")
                return filepath
            except Exception as e:
                ColorPrint.yellow(f"[WARN] PIL capture failed: {e}, trying pyautogui")
                # Fallback to pyautogui
                left, top, width, height = rect[0], rect[1], rect[2] - rect[0], rect[3] - rect[1]
                screenshot = pyautogui.screenshot(region=(left, top, width, height))
                screenshot.save(filepath)
                ColorPrint.green(f"[SAVED] Screenshot saved (pyautogui): {filepath}")
                return filepath

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error capturing screenshot: {e}")
            return None

    def screenshot_by_titles(self, titles: List[str], filename_prefix: str = "window") -> List[Path]:
        """
        Find windows by titles and capture screenshots of all matching windows

        Args:
            titles: List of window titles or partial titles to search for
            filename_prefix: Prefix for screenshot filenames

        Returns:
            List of paths to saved screenshot files
        """
        ColorPrint.blue(f"[START] Searching for windows matching: {titles}")

        # Find matching windows
        windows = self.find_windows_by_titles(titles)

        if not windows:
            ColorPrint.yellow(f"[RESULT] No windows found matching: {titles}")
            return []

        # Capture screenshots
        screenshots = []
        for i, window_info in enumerate(windows, 1):
            ColorPrint.blue(f"[PROGRESS] Processing window {i}/{len(windows)}")
            screenshot_path = self.capture_window_screenshot(window_info, filename_prefix)
            if screenshot_path:
                screenshots.append(screenshot_path)
            time.sleep(0.5)  # Brief pause between screenshots

        ColorPrint.green(f"[COMPLETE] Captured {len(screenshots)} screenshot(s)")
        return screenshots

    def screenshot_single_by_title(self, title: str, filename_prefix: str = "window") -> Optional[Path]:
        """
        Find a single window by title and capture its screenshot

        Args:
            title: Window title or partial title to search for
            filename_prefix: Prefix for screenshot filename

        Returns:
            Path to saved screenshot file, or None if not found
        """
        screenshots = self.screenshot_by_titles([title], filename_prefix)
        return screenshots[0] if screenshots else None

    def list_all_visible_windows(self) -> List[Dict]:
        """
        List all visible windows (for debugging/exploration)

        Returns:
            List of dictionaries containing window information
        """
        all_windows = []

        def enum_windows_callback(hwnd, lparam):
            if win32gui.IsWindowVisible(hwnd):
                try:
                    window_title = win32gui.GetWindowText(hwnd)
                    if window_title:  # Only include windows with titles
                        rect = win32gui.GetWindowRect(hwnd)
                        window_info = {
                            "hwnd": hwnd,
                            "title": window_title,
                            "class_name": win32gui.GetClassName(hwnd),
                            "rect": rect,
                            "width": rect[2] - rect[0],
                            "height": rect[3] - rect[1]
                        }
                        all_windows.append(window_info)
                except Exception:
                    pass
            return True

        try:
            win32gui.EnumWindows(enum_windows_callback, None)
            ColorPrint.blue(f"[LIST] Found {len(all_windows)} visible windows")
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error listing windows: {e}")

        return all_windows

    def cleanup_old_screenshots(self, minutes: int = 10) -> int:
        """
        Clean up screenshots older than specified minutes in the same directory

        Args:
            minutes: Number of minutes to keep screenshots (default: 10)

        Returns:
            Number of files deleted
        """
        try:
            import time
            current_time = time.time()
            max_age = minutes * 60  # Convert minutes to seconds

            deleted_count = 0
            for file_path in self.tmp_dir.glob("*.png"):
                file_age = current_time - file_path.stat().st_mtime
                if file_age > max_age:
                    file_path.unlink()
                    deleted_count += 1
                    ColorPrint.gray(f"[CLEANUP] Deleted old screenshot: {file_path.name} (age: {int(file_age/60)} minutes)")

            if deleted_count > 0:
                ColorPrint.green(f"[CLEANUP] Deleted {deleted_count} old screenshot(s) (older than {minutes} minutes)")
            else:
                ColorPrint.blue(f"[CLEANUP] No screenshots older than {minutes} minutes to delete")

            return deleted_count

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error during cleanup: {e}")
            return 0


def main():
    """Test function for WindowScreenshot"""
    screenshot_manager = WindowScreenshot()

    # Example: List all visible windows
    ColorPrint.blue("\n[TEST] Listing all visible windows:")
    windows = screenshot_manager.list_all_visible_windows()
    for window in windows[:10]:  # Show first 10
        ColorPrint.gray(f"  - {window['title']}")

    # Example: Take screenshot of windows with specific titles
    # Uncomment to test:
    # ColorPrint.blue("\n[TEST] Taking screenshots of specific windows:")
    # screenshots = screenshot_manager.screenshot_by_titles(["notepad", "chrome"])
    # for screenshot in screenshots:
    #     ColorPrint.green(f"  - {screenshot}")


if __name__ == "__main__":
    main()