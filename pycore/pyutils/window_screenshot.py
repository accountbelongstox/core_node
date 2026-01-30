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

from pycore.pyfoundations.third_party import (
    get_third_package_win32gui,
    get_third_package_win32con,
    get_third_package_PIL_Image,
    get_third_package_PIL_ImageGrab,
    get_third_package_pyautogui,
    get_third_package_mss,
)

win32gui = get_third_package_win32gui()
win32con = get_third_package_win32con()
pyautogui = get_third_package_pyautogui()  # May be None on Linux without X11 display access
mss = get_third_package_mss()

ImageGrab = get_third_package_PIL_ImageGrab()
Image = get_third_package_PIL_Image()
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from pycore.pyutils.window_activator import WindowActivator
from pycore.pyutils.common.window_finder import WindowFinder
from pycore.pyutils.common.browser_window_detector import get_default_skip_browser_callable
from pycore.pygvar.global_var_manager import PYTOOLS_TMP_DIR

# Exe-based browser skip filter for WindowFinder (no app-specific logic in core)
_skip_browser_if = get_default_skip_browser_callable()

# Off-screen rect threshold (Windows uses ~-32000 for minimized windows)
_OFFSCREEN_THRESHOLD = -30000


def _is_rect_minimized_or_offscreen(rect: Tuple[int, int, int, int]) -> bool:
    """True if rect is off-screen (e.g. minimized window)."""
    if not rect or len(rect) < 4:
        return True
    left, top = rect[0], rect[1]
    return left < _OFFSCREEN_THRESHOLD or top < _OFFSCREEN_THRESHOLD


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
            ColorPrint.print_min_interval(f"[WARN] Invalid match_mode '{match_mode}', using 'endswith'", "1min", "yellow")
            self.match_mode = "endswith"

        ColorPrint.print_min_interval(f"[INIT] WindowScreenshot initialized", "1min", "green")
        ColorPrint.print_min_interval(f"[TMP_DIR] Screenshot directory: {self.tmp_dir}", "1min", "blue")
        ColorPrint.print_min_interval(f"[MATCH_MODE] Title matching mode: {self.match_mode}", "1min", "blue")


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
                ColorPrint.print_min_interval(f"[RESTORE] Restoring minimized window: '{title}'", "1min", "blue")
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                time.sleep(0.5)

            # Bring window to foreground
            ColorPrint.print_min_interval(f"[ACTIVATE] Activating window: '{title}'", "1min", "blue")
            win32gui.SetForegroundWindow(hwnd)
            time.sleep(0.5)  # Wait for activation

            # Verify activation
            active_hwnd = win32gui.GetForegroundWindow()
            if active_hwnd == hwnd:
                ColorPrint.print_min_interval(f"[SUCCESS] Window activated: '{title}'", "1min", "green")
                return True
            else:
                ColorPrint.print_min_interval(f"[WARN] Window activation uncertain: '{title}'", "1min", "yellow")
                return True  # Continue anyway

        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] Error activating window '{title}': {e}", "1min", "red")
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
                ColorPrint.print_min_interval(f"[WARN] Proceeding with screenshot despite activation issues", "1min", "yellow")

            # Generate timestamp filename (use only prefix, no window title)
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]  # Remove last 3 digits of microseconds
            filename = f"{filename_prefix}_{timestamp}.png"
            filepath = self.tmp_dir / filename

            ColorPrint.print_min_interval(f"[CAPTURE] Capturing screenshot: '{title}'", "1min", "blue")
            ColorPrint.print_min_interval(f"          Region: {rect}", "1min", "gray")

            # Capture screenshot using PIL
            try:
                screenshot = ImageGrab.grab(bbox=rect)
                screenshot.save(filepath)
                ColorPrint.print_min_interval(f"[SAVED] Screenshot saved: {filepath}", "1min", "green")
                return filepath
            except Exception as e:
                ColorPrint.print_min_interval(f"[WARN] PIL capture failed: {e}, trying pyautogui", "1min", "yellow")
                # Fallback to pyautogui
                left, top, width, height = rect[0], rect[1], rect[2] - rect[0], rect[3] - rect[1]
                screenshot = pyautogui.screenshot(region=(left, top, width, height))
                screenshot.save(filepath)
                ColorPrint.print_min_interval(f"[SAVED] Screenshot saved (pyautogui): {filepath}", "1min", "green")
                return filepath

        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] Error capturing screenshot: {e}", "1min", "red")
            return None

    def screenshot_first_window_by_titles(
        self,
        titles: List[str],
        filename_prefix: str = "window_fast",
        use_cache: bool = True
    ) -> Optional[Dict]:
        """
        Find and screenshot FIRST matching window (optimized with encyclopedia cache)

        This method finds the FIRST window matching any of the provided titles.
        It uses encyclopedia cache for fast lookups and captures using the
        fast fullscreen + crop method when cached.

        Algorithm:
        1. Check ENCYCLOPEDIA cache for any of the titles
        2. If cached and valid: capture fullscreen + crop using cached rect (fast path)
        3. If not cached: search window, cache it, then capture
        4. No time.sleep delays

        Args:
            titles: List of window titles to search (finds FIRST match)
            filename_prefix: Prefix for screenshot filename
            use_cache: Whether to use encyclopedia cache

        Returns:
            Same structure as capture_window_fast() for consistency:
            {
                "screenshot_path": Path,
                "window_title": str or None,
                "window_rect": tuple or None,
                "window_offset": tuple,  # (offset_x, offset_y)
                "window_size": tuple,  # (width, height)
                "scaled_screenshot_path": None,
                "scaled_offset": None,
                "scale_ratio": None
            }
        """
        ColorPrint.print_min_interval(f"\n[FAST_SINGLE] Starting optimized single window capture...", "1min", "blue")
        ColorPrint.print_min_interval(f"[FAST_SINGLE] Searching for titles: {titles}", "1min", "blue")

        try:
            window_info = None
            found_from_cache = False

            # Step 1: Try to get from encyclopedia cache first (same canonical key as WindowFinder)
            canonical_label = titles[0] if titles else ""
            cache_key = f"window_cache_{canonical_label.lower()}" if canonical_label else None
            if use_cache and cache_key:
                ColorPrint.print_min_interval("[FAST_SINGLE] Checking encyclopedia cache...", "1min", "blue")
                cached_info = ENCYCLOPEDIA.get(cache_key)

                if cached_info:
                    hwnd = cached_info.get("hwnd")
                    if hwnd and win32gui.IsWindow(hwnd) and win32gui.IsWindowVisible(hwnd):
                        try:
                            rect = win32gui.GetWindowRect(hwnd)
                            window_info = {
                                "hwnd": hwnd,
                                "title": cached_info.get("title"),
                                "rect": rect,
                                "class_name": cached_info.get("class_name")
                            }
                            found_from_cache = True
                            ColorPrint.print_min_interval(f"[CACHE] Found cached window: '{canonical_label}'", "1min", "green")
                        except Exception as e:
                            ColorPrint.print_min_interval(f"[CACHE] Error reading cached window rect: {e}", "1min", "yellow")
                    else:
                        ENCYCLOPEDIA.remove(cache_key)
                        ColorPrint.print_min_interval(f"[CACHE] Cached window invalid for '{canonical_label}', removed", "1min", "yellow")

            # Step 2: If not found in cache, search for window using WindowFinder
            if not window_info:
                ColorPrint.print_min_interval("[FAST_SINGLE] Searching for window in process list...", "1min", "blue")
                windows = WindowFinder.find_windows_by_titles(
                    titles=titles,
                    match_mode=self.match_mode,
                    use_cache=use_cache,
                    skip_browser_if=_skip_browser_if
                )

                if not windows:
                    ColorPrint.yellow(f"[FAST_SINGLE] No windows found matching: {titles}")
                    return None

                # Take FIRST match only
                window_info = windows[0]
                ColorPrint.print_min_interval(f"[FAST_SINGLE] Found window: '{window_info['title']}'", "1min", "green")

            # Step 3: If window is minimized or off-screen, activate and refresh rect before capture
            hwnd = window_info["hwnd"]
            title = window_info["title"]
            rect = window_info["rect"]
            if win32gui.IsIconic(hwnd) or _is_rect_minimized_or_offscreen(rect):
                ColorPrint.print_min_interval(f"[FAST_SINGLE] Window minimized/off-screen, activating: '{title}'", "1min", "blue")
                if not self.activate_window(hwnd, title):
                    ColorPrint.print_min_interval(f"[FAST_SINGLE] Proceeding after activation attempt", "1min", "yellow")
                time.sleep(1)
                try:
                    rect = win32gui.GetWindowRect(hwnd)
                    window_info["rect"] = rect
                except Exception as e:
                    ColorPrint.print_min_interval(f"[FAST_SINGLE] Could not refresh rect after activate: {e}", "1min", "yellow")

            left, top, right, bottom = rect
            window_width = right - left
            window_height = bottom - top

            ColorPrint.print_min_interval(f"[FAST_SINGLE] Window rect: {rect}", "1min", "blue")
            ColorPrint.print_min_interval(f"[FAST_SINGLE] Capturing fullscreen...", "1min", "blue")

            start_time = time.time()

            with mss.mss() as sct:
                # Get primary monitor
                monitor = sct.monitors[1]

                # Capture full screen
                screenshot_mss = sct.grab(monitor)

                # Convert to PIL Image
                screenshot_full = Image.frombytes(
                    "RGB",
                    screenshot_mss.size,
                    screenshot_mss.rgb
                )

            capture_time = time.time() - start_time
            ColorPrint.print_min_interval(f"[FAST_SINGLE] Screen captured in {capture_time*1000:.2f}ms", "1min", "green")

            # Crop to window region
            window_screenshot = screenshot_full.crop((left, top, right, bottom))
            ColorPrint.print_min_interval(f"[FAST_SINGLE] Cropped window region: {window_width}x{window_height}", "1min", "blue")

            # Save screenshot
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            filename = f"{filename_prefix}_{timestamp}.png"
            filepath = self.tmp_dir / filename

            window_screenshot.save(filepath)
            ColorPrint.print_min_interval(f"[FAST_SINGLE] Saved: {filepath}", "1min", "green")

            result = {
                "screenshot_path": filepath,
                "window_title": title,
                "window_rect": rect,
                "window_offset": (left, top),
                "window_size": (window_width, window_height),
                "scaled_screenshot_path": None,
                "scaled_offset": None,
                "scale_ratio": None
            }

            total_time = time.time() - start_time
            ColorPrint.print_min_interval(f"[FAST_SINGLE] Total time: {total_time*1000:.2f}ms", "1min", "green")

            return result

        except Exception as e:
            ColorPrint.red(f"[FAST_SINGLE] Error in single window capture: {e}")
            import traceback
            traceback.print_exc()
            return None

    def capture_window_fast(
        self,
        titles: Optional[List[str]] = None,
        filename_prefix: str = "window_fast",
        scale_to_720p: bool = False,
        use_cache: bool = True
    ) -> Optional[Dict]:
        """
        Fast window screenshot method - optimized for performance

        This method:
        1. Uses cached window info (skips window search if cached)
        2. Captures FULL SCREEN (no window activation needed)
        3. Crops to window region after capture (if titles provided)
        4. Optionally scales to 720p in memory
        5. Returns offset values for both original and scaled coordinates

        Performance improvements:
        - Skips window title search (if cached)
        - Skips window activation/focus change
        - Uses faster full-screen capture (mss)
        - Optional memory scaling reduces downstream processing

        Args:
            titles: List of window titles to search for (if None, captures full screen)
            filename_prefix: Prefix for screenshot filename
            scale_to_720p: If True, scales image to 720p in memory
            use_cache: Whether to use cached window information (default: True)

        Returns:
            Dictionary with screenshot info or None if failed:
            {
                "screenshot_path": Path,
                "window_title": str or None,
                "window_rect": tuple or None,  # Original window rect (left, top, right, bottom)
                "window_offset": tuple,  # (offset_x, offset_y) for original resolution
                "scaled_screenshot_path": Path or None,  # If scale_to_720p=True
                "scaled_offset": tuple or None,  # (offset_x, offset_y) for 720p resolution
                "scale_ratio": tuple or None  # (scale_x, scale_y) if scaled
            }
        """
        ColorPrint.print_min_interval(f"\n[FAST] Starting fast screenshot capture...", "1min", "blue")

        try:
            # Step 1: Find window (try cache first) or use full screen
            if titles is None or len(titles) == 0:
                # No titles provided - capture full screen directly
                ColorPrint.print_min_interval("[FAST] No window titles provided, capturing full screen", "1min", "yellow")
                windows = []
                window_info = None
            else:
                windows = WindowFinder.find_windows_by_titles(
                    titles=titles,
                    match_mode=self.match_mode,
                    use_cache=use_cache,
                    skip_browser_if=_skip_browser_if
                )

            if titles and not windows:
                ColorPrint.yellow(f"[FAST] No windows found matching: {titles}")
                return None

            # Get window info if available
            if windows:
                window_info = windows[0]
                hwnd = window_info["hwnd"]
                title = window_info["title"]
                rect = window_info["rect"]
                if win32gui.IsIconic(hwnd) or _is_rect_minimized_or_offscreen(rect):
                    ColorPrint.print_min_interval(f"[FAST] Window minimized/off-screen, activating: '{title}'", "1min", "blue")
                    if not self.activate_window(hwnd, title):
                        ColorPrint.print_min_interval(f"[FAST] Proceeding after activation attempt", "1min", "yellow")
                    time.sleep(1)
                    try:
                        rect = win32gui.GetWindowRect(hwnd)
                        window_info["rect"] = rect
                    except Exception as e:
                        ColorPrint.print_min_interval(f"[FAST] Could not refresh rect after activate: {e}", "1min", "yellow")
                ColorPrint.print_min_interval(f"[FAST] Found window: '{title}' (Handle: {hwnd})", "1min", "green")
                ColorPrint.print_min_interval(f"[FAST] Window rect: {rect}", "1min", "blue")
            else:
                # Full screen mode
                window_info = None
                hwnd = None
                title = None
                rect = None

            # Step 2: Capture FULL SCREEN using mss (fastest method)
            ColorPrint.print_min_interval(f"[FAST] Capturing full screen...", "1min", "blue")
            start_time = time.time()

            with mss.mss() as sct:
                # Get primary monitor
                monitor = sct.monitors[1]

                # Capture full screen
                screenshot_mss = sct.grab(monitor)

                # Convert to PIL Image
                screenshot_full = Image.frombytes(
                    "RGB",
                    screenshot_mss.size,
                    screenshot_mss.rgb
                )

            capture_time = time.time() - start_time
            ColorPrint.print_min_interval(f"[FAST] Screen captured in {capture_time*1000:.2f}ms", "1min", "green")

            # Step 3: Crop to window region (if window specified) or use full screen
            if rect:
                left, top, right, bottom = rect
                window_width = right - left
                window_height = bottom - top

                # Crop the window region from full screen
                window_screenshot = screenshot_full.crop((left, top, right, bottom))
                ColorPrint.print_min_interval(f"[FAST] Cropped window region: {window_width}x{window_height}", "1min", "blue")
            else:
                # Use full screen
                left, top = 0, 0
                window_screenshot = screenshot_full
                window_width = screenshot_full.width
                window_height = screenshot_full.height
                ColorPrint.print_min_interval(f"[FAST] Using full screen: {window_width}x{window_height}", "1min", "blue")

            # Step 4: Save original screenshot
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            filename = f"{filename_prefix}_{timestamp}.png"
            filepath = self.tmp_dir / filename

            window_screenshot.save(filepath)
            ColorPrint.print_min_interval(f"[FAST] Saved original: {filepath}", "1min", "green")

            result = {
                "screenshot_path": filepath,
                "window_title": title if title else "fullscreen",
                "window_rect": rect if rect else (0, 0, window_width, window_height),
                "window_offset": (left, top),
                "window_size": (window_width, window_height),
                "scaled_screenshot_path": None,
                "scaled_offset": None,
                "scale_ratio": None
            }

            # Step 5: Optional 720p scaling
            if scale_to_720p:
                ColorPrint.print_min_interval(f"[FAST] Scaling to 720p...", "1min", "blue")
                scale_start = time.time()

                # Calculate 720p scaling (1280x720)
                target_width = 1280
                target_height = 720

                scale_x = target_width / window_width
                scale_y = target_height / window_height
                scale = min(scale_x, scale_y)  # Maintain aspect ratio

                new_width = int(window_width * scale)
                new_height = int(window_height * scale)

                # Resize using high-quality LANCZOS
                scaled_screenshot = window_screenshot.resize(
                    (new_width, new_height),
                    Image.Resampling.LANCZOS
                )

                # Save scaled screenshot
                scaled_filename = f"{filename_prefix}_720p_{timestamp}.png"
                scaled_filepath = self.tmp_dir / scaled_filename
                scaled_screenshot.save(scaled_filepath)

                # Calculate scaled offset
                scaled_offset_x = int(left * scale)
                scaled_offset_y = int(top * scale)

                scale_time = time.time() - scale_start
                ColorPrint.print_min_interval(f"[FAST] Scaled to {new_width}x{new_height} in {scale_time*1000:.2f}ms", "1min", "green")
                ColorPrint.print_min_interval(f"[FAST] Saved scaled: {scaled_filepath}", "1min", "green")

                result.update({
                    "scaled_screenshot_path": scaled_filepath,
                    "scaled_offset": (scaled_offset_x, scaled_offset_y),
                    "scaled_size": (new_width, new_height),
                    "scale_ratio": (scale, scale)
                })

            total_time = time.time() - start_time
            ColorPrint.print_min_interval(f"[FAST] Total time: {total_time*1000:.2f}ms", "1min", "green")

            return result

        except Exception as e:
            ColorPrint.red(f"[FAST] Error in fast capture: {e}")
            import traceback
            traceback.print_exc()
            return None

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
            ColorPrint.print_min_interval(f"[LIST] Found {len(all_windows)} visible windows", "1min", "blue")
        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] Error listing windows: {e}", "1min", "red")

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
                    ColorPrint.print_min_interval(f"[CLEANUP] Deleted old screenshot: {file_path.name} (age: {int(file_age/60)} minutes)", "1min", "gray")

            if deleted_count > 0:
                ColorPrint.print_min_interval(f"[CLEANUP] Deleted {deleted_count} old screenshot(s) (older than {minutes} minutes)", "1min", "green")
            else:
                ColorPrint.print_min_interval(f"[CLEANUP] No screenshots older than {minutes} minutes to delete", "1min", "blue")

            return deleted_count

        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] Error during cleanup: {e}", "1min", "red")
            return 0

    def _get_window_region(
        self,
        titles: Optional[List[str]] = None,
        use_cache: bool = True
    ) -> Optional[Tuple[int, int, int, int, Optional[str]]]:
        """
        Get window region coordinates (left, top, width, height, title)

        Args:
            titles: Window titles to search for (None for full screen)
            use_cache: Use cached window list

        Returns:
            Tuple of (left, top, width, height, title) or None if window not found
        """
        try:
            if titles:
                windows = WindowFinder.find_windows_by_titles(
                    titles=titles,
                    match_mode=self.match_mode,
                    use_cache=use_cache,
                    skip_browser_if=_skip_browser_if
                )

                if not windows:
                    ColorPrint.print_min_interval(f"[WindowRegion] No windows found matching: {titles}", "1min", "yellow")
                    return None

                window_info = windows[0]
                hwnd = window_info["hwnd"]
                title = window_info["title"]
                rect = window_info["rect"]
                if win32gui.IsIconic(hwnd) or _is_rect_minimized_or_offscreen(rect):
                    ColorPrint.print_min_interval(f"[WindowRegion] Window minimized/off-screen, activating: '{title}'", "1min", "blue")
                    if not self.activate_window(hwnd, title):
                        ColorPrint.print_min_interval(f"[WindowRegion] Proceeding after activation attempt", "1min", "yellow")
                    time.sleep(1)
                    try:
                        rect = win32gui.GetWindowRect(hwnd)
                        window_info["rect"] = rect
                    except Exception as e:
                        ColorPrint.print_min_interval(f"[WindowRegion] Could not refresh rect: {e}", "1min", "yellow")
                left, top, right, bottom = rect
                width = right - left
                height = bottom - top
                ColorPrint.print_min_interval(f"[WindowRegion] Found window: '{title}' ({width}x{height})", "1min", "gray")
                return (left, top, width, height, title)
            else:
                # Full screen mode
                with mss.mss() as sct:
                    monitor = sct.monitors[1]
                    left, top = 0, 0
                    width = monitor['width']
                    height = monitor['height']
                ColorPrint.print_min_interval(f"[WindowRegion] Using full screen: {width}x{height}", "1min", "gray")
                return (left, top, width, height, None)

        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] Failed to get window region: {e}", "1min", "red")
            return None

    def capture_window_grid_region(
        self,
        titles: Optional[List[str]] = None,
        grid_type: str = '9grid',
        grid_index: Optional[int] = None,
        row_range: Optional[Tuple[int, int]] = None,
        col_range: Optional[Tuple[int, int]] = None,
        use_cache: bool = True
    ) -> Optional[Image.Image]:
        """
        Capture a specific grid region of a window

        Args:
            titles: Window titles to search for (None for full screen)
            grid_type: '9grid' (3x3) or '18x18grid' (18x18)
            grid_index: Grid index for 9grid mode (0-8)
            row_range: Row range for 18x18grid mode (start, end) inclusive
            col_range: Column range for 18x18grid mode (start, end) inclusive
            use_cache: Use cached window list

        Returns:
            PIL Image of the region or None if failed
        """
        try:
            # Step 1: Get window region using common method
            region_info = self._get_window_region(titles, use_cache)
            if not region_info:
                return None

            left, top, width, height, title = region_info
            ColorPrint.print_min_interval(f"[GridCapture] Capturing {grid_type} from window: '{title or 'fullscreen'}'", "1min", "blue")

            if grid_type == '9grid':
                if grid_index is None:
                    ColorPrint.print_min_interval("[ERROR] grid_index required for 9grid mode", "1min", "red")
                    return None

                if not 0 <= grid_index <= 8:
                    ColorPrint.print_min_interval(f"[ERROR] grid_index must be 0-8, got {grid_index}", "1min", "red")
                    return None

                # Calculate 3x3 grid
                grid_width = width // 3
                grid_height = height // 3

                grid_row = grid_index // 3
                grid_col = grid_index % 3

                region_left = left + grid_col * grid_width
                region_top = top + grid_row * grid_height
                region_right = region_left + grid_width
                region_bottom = region_top + grid_height

                ColorPrint.print_min_interval(f"[9Grid] Capturing grid {grid_index} at ({region_left},{region_top},{region_right},{region_bottom})", "1min", "blue")

            elif grid_type == '18x18grid':
                if row_range is None and col_range is None:
                    ColorPrint.red("[ERROR] row_range or col_range required for 18x18grid mode")
                    return None

                # Calculate 18x18 grid cell size
                cell_width = width // 18
                cell_height = height // 18

                if row_range:
                    start_row, end_row = row_range
                    region_top = top + start_row * cell_height
                    region_bottom = top + (end_row + 1) * cell_height
                    region_left = left
                    region_right = left + width
                    ColorPrint.print_min_interval(f"[18x18Grid] Capturing rows {start_row}-{end_row}", "1min", "blue")

                elif col_range:
                    start_col, end_col = col_range
                    region_left = left + start_col * cell_width
                    region_right = left + (end_col + 1) * cell_width
                    region_top = top
                    region_bottom = top + height
                    ColorPrint.print_min_interval(f"[18x18Grid] Capturing cols {start_col}-{end_col}", "1min", "blue")

            else:
                ColorPrint.print_min_interval(f"[ERROR] Unknown grid_type: {grid_type}", "1min", "red")
                return None

            # Capture the region
            with mss.mss() as sct:
                monitor = {
                    "left": region_left,
                    "top": region_top,
                    "width": region_right - region_left,
                    "height": region_bottom - region_top
                }
                screenshot = sct.grab(monitor)
                img = Image.frombytes("RGB", screenshot.size, screenshot.rgb)

            ColorPrint.print_min_interval(f"[SUCCESS] Captured grid region: {img.size}", "1min", "green")
            return img

        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] Failed to capture grid region: {e}", "1min", "red")
            return None

    def capture_window_grid_cell(
        self,
        cell_row: int,
        cell_col: int,
        titles: Optional[List[str]] = None,
        grid_rows: int = 18,
        grid_cols: int = 18,
        use_cache: bool = True
    ) -> Optional[Image.Image]:
        """
        Capture a single cell from multi-row multi-column grid

        Args:
            cell_row: Row index (zero-based)
            cell_col: Column index (zero-based)
            titles: Window titles to search for (None for full screen)
            grid_rows: Total number of rows (default: eighteen)
            grid_cols: Total number of columns (default: eighteen)
            use_cache: Use cached window list

        Returns:
            PIL Image of the cell or None
        """
        try:
            max_row = grid_rows - 1
            max_col = grid_cols - 1

            if not (0 <= cell_row <= max_row and 0 <= cell_col <= max_col):
                ColorPrint.print_min_interval(f"[ERROR] Cell indices must be zero to {max_row}, got row={cell_row}, col={cell_col}", "1min", "red")
                return None

            # Get window region using common method
            region_info = self._get_window_region(titles, use_cache)
            if not region_info:
                return None

            left, top, width, height, title = region_info

            cell_width = width // grid_cols
            cell_height = height // grid_rows

            region_left = left + cell_col * cell_width
            region_top = top + cell_row * cell_height
            region_right = region_left + cell_width
            region_bottom = region_top + cell_height

            with mss.mss() as sct:
                monitor = {
                    "left": region_left,
                    "top": region_top,
                    "width": cell_width,
                    "height": cell_height
                }
                screenshot = sct.grab(monitor)
                img = Image.frombytes("RGB", screenshot.size, screenshot.rgb)

            ColorPrint.print_min_interval(f"[GridCell] Captured cell ({cell_row},{cell_col}) from {grid_rows}x{grid_cols} grid: {img.size}", "1min", "gray")
            return img

        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] Failed to capture grid cell ({cell_row},{cell_col}): {e}", "1min", "red")
            return None


if __name__ == "__main__":
    main()