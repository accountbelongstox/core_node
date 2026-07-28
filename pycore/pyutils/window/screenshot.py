#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window Screenshot Manager (facade)

Handles window searching, activation, and screenshot capture. This module is the
SOLE public surface of the window-screenshot subsystem (imported by
pycore/pyctl/desktop/background_services.py and re-exported via the window
package). It delegates the heavy lifting to sibling sub-modules:

- pycore.pyutils.window.screen_capture : mss fullscreen/region capture + 720p scaling
- pycore.pyutils.window.grid_capture  : window-region resolution + grid sub-region capture
- pycore.pyutils.window.activator     : window activation (WindowActivator)
- pycore.pyutils.common.window_finder : cache-backed window search (WindowFinder)

Dependency direction is one-way: this facade imports the sub-modules; the
sub-modules never import back into screenshot.py (no circular import).

Windows-heavy import pattern (win32gui/win32con at top) is preserved verbatim
from the original; this module is not intended to import on a headless Linux host.
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
)

import traceback


win32gui = get_third_package_win32gui()
win32con = get_third_package_win32con()
pyautogui = get_third_package_pyautogui()  # May be None on Linux without X11 display access

ImageGrab = get_third_package_PIL_ImageGrab()
Image = get_third_package_PIL_Image()
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.window.activator import WindowActivator
from pycore.pyutils.common.window_finder import WindowFinder
from pycore.pyutils.common.browser_window_detector import get_default_skip_browser_callable
from pycore.pyfoundations.pygvar.global_var_manager import PYTOOLS_TMP_DIR
from pycore.pyutils.window import screen_capture, grid_capture
from pycore.pyutils.window.grid_capture import is_rect_minimized_or_offscreen

# Exe-based browser skip filter for WindowFinder (no app-specific logic in core)
_skip_browser_if = get_default_skip_browser_callable()


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
        Activate a window by its handle.

        Delegates to self.window_activator.activate_window_by_handle(hwnd) instead of
        re-implementing restore/SetForegroundWindow/verify inline.

        Args:
            hwnd: Window handle
            title: Window title (for logging only)

        Returns:
            True if activation was successful
        """
        try:
            ColorPrint.print_min_interval(f"[ACTIVATE] Activating window: '{title}' (handle: {hwnd})", "1min", "blue")
            return self.window_activator.activate_window_by_handle(hwnd)
        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] Error activating window '{title}': {e}", "1min", "red")
            return False

    def capture_first_window_to_memory(
        self,
        titles: List[str],
        use_cache: bool = True
    ) -> Optional[Tuple[Image.Image, Dict]]:
        """
        Find first matching window, activate it (bring to front), then capture to memory.
        No file path; returns (PIL Image, info_dict) or None. info_dict has window_title, window_offset, window_size.

        Window lookup delegates to WindowFinder (cache-first), no inline re-validation.
        """
        try:
            windows = WindowFinder.find_windows_by_titles(
                titles=titles,
                match_mode=self.match_mode,
                use_cache=use_cache,
                skip_browser_if=_skip_browser_if
            )
            if not windows:
                return None
            window_info = windows[0]

            hwnd = window_info["hwnd"]
            title = window_info.get("title") or ""
            self.activate_window(hwnd, title)
            time.sleep(0.35)
            try:
                rect = win32gui.GetWindowRect(hwnd)
            except Exception:
                rect = window_info.get("rect")
            if not rect or len(rect) < 4:
                return None
            left, top, right, bottom = rect
            width, height = right - left, bottom - top
            if width <= 0 or height <= 0:
                return None
            img = self.capture_screen_region(left, top, width, height)
            if img is None:
                return None
            info = {
                "window_title": title,
                "window_offset": (left, top),
                "window_size": (width, height),
            }
            return (img, info)
        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] capture_first_window_to_memory: {e}", "1min", "red")
            return None

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
                # Fallback to pyautogui (None on a headless host without DISPLAY)
                if pyautogui is None:
                    ColorPrint.print_min_interval(f"[WARN] PIL capture failed: {e}; pyautogui unavailable (headless/no DISPLAY), cannot capture", "1min", "yellow")
                    return None
                ColorPrint.print_min_interval(f"[WARN] PIL capture failed: {e}, trying pyautogui", "1min", "yellow")
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
        use_cache: bool = True,
        save_to_disk: bool = True
    ) -> Optional[Dict]:
        """
        Find and screenshot FIRST matching window (optimized with encyclopedia cache)

        This method finds the FIRST window matching any of the provided titles.
        It uses encyclopedia cache for fast lookups (via WindowFinder) and captures
        using the fast fullscreen + crop method.

        Algorithm:
        1. WindowFinder resolves first match (cache-first, no inline re-validation)
        2. If window is minimized/off-screen: activate and refresh rect
        3. Capture fullscreen (mss) and crop to window region
        4. No time.sleep delays beyond activation settle

        Args:
            titles: List of window titles to search (finds FIRST match)
            filename_prefix: Prefix for screenshot filename (ignored when save_to_disk=False)
            use_cache: Whether to use encyclopedia cache
            save_to_disk: If False, keep image in memory only (result["image"]), no temp file

        Returns:
            Dict with window_title, window_rect, window_offset, window_size; when save_to_disk
            also screenshot_path; when save_to_disk=False has "image" (PIL Image) and screenshot_path=None.
        """
        ColorPrint.print_min_interval(f"\n[FAST_SINGLE] Starting optimized single window capture...", "1min", "blue")
        ColorPrint.print_min_interval(f"[FAST_SINGLE] Searching for titles: {titles}", "1min", "blue")

        try:
            # Step 1: Resolve first matching window via WindowFinder (cache-first)
            ColorPrint.print_min_interval("[FAST_SINGLE] Searching for window (cache-first)...", "1min", "blue")
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

            # Step 2: If window is minimized or off-screen, activate and refresh rect before capture
            hwnd = window_info["hwnd"]
            title = window_info["title"]
            rect = window_info["rect"]
            if win32gui.IsIconic(hwnd) or is_rect_minimized_or_offscreen(rect):
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

            # Step 3: Capture full screen (mss) via screen_capture engine
            start_time = time.time()
            screenshot_full = screen_capture.grab_fullscreen_pil()
            if screenshot_full is None:
                ColorPrint.red(f"[FAST_SINGLE] Failed to capture fullscreen")
                return None
            capture_time = time.time() - start_time
            ColorPrint.print_min_interval(f"[FAST_SINGLE] Screen captured in {capture_time*1000:.2f}ms", "1min", "green")

            # Crop to window region
            window_screenshot = screenshot_full.crop((left, top, right, bottom))
            ColorPrint.print_min_interval(f"[FAST_SINGLE] Cropped window region: {window_width}x{window_height}", "1min", "blue")

            result = {
                "window_title": title,
                "window_rect": rect,
                "window_offset": (left, top),
                "window_size": (window_width, window_height),
                "scaled_screenshot_path": None,
                "scaled_offset": None,
                "scale_ratio": None
            }
            if save_to_disk:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
                filename = f"{filename_prefix}_{timestamp}.png"
                filepath = self.tmp_dir / filename
                window_screenshot.save(filepath)
                ColorPrint.print_min_interval(f"[FAST_SINGLE] Saved: {filepath}", "1min", "green")
                result["screenshot_path"] = filepath
            else:
                result["screenshot_path"] = None
                result["image"] = window_screenshot

            total_time = time.time() - start_time
            ColorPrint.print_min_interval(f"[FAST_SINGLE] Total time: {total_time*1000:.2f}ms", "1min", "green")

            return result

        except Exception as e:
            ColorPrint.red(f"[FAST_SINGLE] Error in single window capture: {e}")
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
                if win32gui.IsIconic(hwnd) or is_rect_minimized_or_offscreen(rect):
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

            # Step 2: Capture FULL SCREEN using mss (fastest method) via screen_capture engine
            ColorPrint.print_min_interval(f"[FAST] Capturing full screen...", "1min", "blue")
            start_time = time.time()
            screenshot_full = screen_capture.grab_fullscreen_pil()
            if screenshot_full is None:
                ColorPrint.red(f"[FAST] Failed to capture full screen")
                return None
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

            # Step 5: Optional 720p scaling (via screen_capture engine)
            if scale_to_720p:
                ColorPrint.print_min_interval(f"[FAST] Scaling to 720p...", "1min", "blue")
                scale_start = time.time()

                scaled_result = screen_capture.scale_image_to_720p(window_screenshot, left, top)
                if scaled_result is not None:
                    scaled_screenshot, scaled_offset, scaled_size, scale_ratio = scaled_result

                    # Save scaled screenshot
                    scaled_filename = f"{filename_prefix}_720p_{timestamp}.png"
                    scaled_filepath = self.tmp_dir / scaled_filename
                    scaled_screenshot.save(scaled_filepath)

                    scale_time = time.time() - scale_start
                    ColorPrint.print_min_interval(f"[FAST] Scaled to {scaled_size[0]}x{scaled_size[1]} in {scale_time*1000:.2f}ms", "1min", "green")
                    ColorPrint.print_min_interval(f"[FAST] Saved scaled: {scaled_filepath}", "1min", "green")

                    result.update({
                        "scaled_screenshot_path": scaled_filepath,
                        "scaled_offset": scaled_offset,
                        "scaled_size": scaled_size,
                        "scale_ratio": scale_ratio
                    })

            total_time = time.time() - start_time
            ColorPrint.print_min_interval(f"[FAST] Total time: {total_time*1000:.2f}ms", "1min", "green")

            return result

        except Exception as e:
            ColorPrint.red(f"[FAST] Error in fast capture: {e}")
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

        Delegates to grid_capture.get_window_region.

        Args:
            titles: Window titles to search for (None for full screen)
            use_cache: Use cached window list

        Returns:
            Tuple of (left, top, width, height, title) or None if window not found
        """
        return grid_capture.get_window_region(
            titles=titles,
            match_mode=self.match_mode,
            window_activator=self.window_activator,
            use_cache=use_cache,
            skip_browser_if=_skip_browser_if
        )

    def capture_screen_region(
        self,
        left: int,
        top: int,
        width: int,
        height: int
    ) -> Optional[Image.Image]:
        """
        Native screen region capture: grab only the given screen rect (no fullscreen then crop).
        Uses mss sct.grab(monitor) with monitor = {left, top, width, height}.

        Delegates to screen_capture.capture_screen_region.

        Args:
            left: Screen X of region top-left
            top: Screen Y of region top-left
            width: Region width in pixels
            height: Region height in pixels

        Returns:
            PIL Image of the region or None if failed
        """
        return screen_capture.capture_screen_region(left, top, width, height)

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

        Delegates to grid_capture.capture_grid_region.

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
        return grid_capture.capture_grid_region(
            titles=titles,
            grid_type=grid_type,
            grid_index=grid_index,
            row_range=row_range,
            col_range=col_range,
            match_mode=self.match_mode,
            window_activator=self.window_activator,
            use_cache=use_cache,
            skip_browser_if=_skip_browser_if
        )

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

        Delegates to grid_capture.capture_grid_cell.

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
        return grid_capture.capture_grid_cell(
            cell_row=cell_row,
            cell_col=cell_col,
            titles=titles,
            grid_rows=grid_rows,
            grid_cols=grid_cols,
            match_mode=self.match_mode,
            window_activator=self.window_activator,
            use_cache=use_cache,
            skip_browser_if=_skip_browser_if
        )


if __name__ == "__main__":
    main()
