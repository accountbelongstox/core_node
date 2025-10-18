#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window Finder - Shared Window Search Utility
Provides centralized window searching with encyclopedia caching
Used by window_screenshot, window_activator, and window_analyzer
"""

import sys
from pathlib import Path
from typing import List, Dict, Optional

# Add parent directory to path for dependency checking
pytools_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(pytools_dir))

# Check and install dependencies before importing third-party packages
from pycore import check_and_install_dependencies
check_and_install_dependencies()

import win32gui

from pyfoundations.color_print import ColorPrint
from pyfoundations.encyclopedia import ENCYCLOPEDIA


class WindowFinder:
    """
    Centralized window finder with encyclopedia caching

    Provides consistent window searching across all window-related utilities
    """

    @staticmethod
    def find_windows_by_titles(
        titles: List[str],
        match_mode: str = "endswith",
        use_cache: bool = True
    ) -> List[Dict]:
        """
        Find windows by titles with encyclopedia caching

        This is the SINGLE SOURCE OF TRUTH for window searching.
        All window-related utilities should use this method.

        Args:
            titles: List of window titles to search for
            match_mode: Window title matching mode - "in", "startswith", "endswith", or "exact"
            use_cache: Whether to use encyclopedia cache (default: True)

        Returns:
            List of window information dictionaries:
            [
                {
                    "hwnd": int,
                    "title": str,
                    "class_name": str,
                    "rect": tuple,  # (left, top, right, bottom)
                    "width": int,
                    "height": int
                },
                ...
            ]
        """
        ColorPrint.blue(f"\n[WindowFinder] Searching for windows: {titles}")
        ColorPrint.blue(f"[WindowFinder] Match mode: {match_mode}, Use cache: {use_cache}")

        found_windows = []

        # Step 1: Try to get from encyclopedia cache first
        if use_cache:
            ColorPrint.blue("[WindowFinder] Checking encyclopedia cache...")

            for title in titles:
                cache_key = f"window_cache_{title.lower()}"
                cached_info = ENCYCLOPEDIA.get(cache_key)

                if cached_info:
                    hwnd = cached_info.get("hwnd")
                    # Validate cached window
                    if hwnd and win32gui.IsWindow(hwnd) and win32gui.IsWindowVisible(hwnd):
                        try:
                            # Update rect from current window state
                            rect = win32gui.GetWindowRect(hwnd)
                            window_info = {
                                "hwnd": hwnd,
                                "title": cached_info.get("title"),
                                "class_name": cached_info.get("class_name"),
                                "rect": rect,
                                "width": rect[2] - rect[0],
                                "height": rect[3] - rect[1]
                            }
                            found_windows.append(window_info)
                            ColorPrint.green(f"[Cache] Found cached window: '{window_info['title']}'")

                            # Found at least one - can return early if only need first match
                            # But continue to check all titles for completeness
                        except Exception as e:
                            ColorPrint.yellow(f"[Cache] Error reading cached window: {e}")
                    else:
                        ColorPrint.yellow(f"[Cache] Cached window invalid for '{title}'")

        # Step 2: If not found in cache (or cache disabled), search all windows
        if not found_windows:
            ColorPrint.blue("[WindowFinder] Searching through visible windows...")

            def enum_windows_callback(hwnd, lparam):
                if win32gui.IsWindowVisible(hwnd):
                    try:
                        window_title = win32gui.GetWindowText(hwnd)
                        if not window_title:
                            return True

                        # Check if window title matches any of the provided titles
                        for target_title in titles:
                            match_found = False

                            if match_mode == "exact":
                                match_found = window_title == target_title
                            elif match_mode == "startswith":
                                match_found = window_title.startswith(target_title)
                            elif match_mode == "in":
                                match_found = target_title.lower() in window_title.lower()
                            elif match_mode == "endswith":
                                match_found = window_title.endswith(target_title)

                            # Additional validation: avoid browser windows
                            if match_found and WindowFinder._is_browser_window(window_title):
                                ColorPrint.yellow(f"[WindowFinder] Skipping browser window: '{window_title}'")
                                match_found = False

                            if match_found:
                                rect = win32gui.GetWindowRect(hwnd)
                                window_info = {
                                    "hwnd": hwnd,
                                    "title": window_title,
                                    "class_name": win32gui.GetClassName(hwnd),
                                    "rect": rect,
                                    "width": rect[2] - rect[0],
                                    "height": rect[3] - rect[1]
                                }
                                found_windows.append(window_info)
                                ColorPrint.green(f"[Found] Window: '{window_title}'")

                                # Cache the found window
                                if use_cache:
                                    cache_key = f"window_cache_{target_title.lower()}"
                                    cache_data = {
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
                                    ENCYCLOPEDIA.add(cache_key, cache_data)
                                    ColorPrint.blue(f"[Cache] Cached window info for '{target_title}'")

                                # Don't break - continue searching for other matching windows
                                break
                    except Exception as e:
                        ColorPrint.yellow(f"[WindowFinder] Error checking window: {e}")
                return True

            try:
                win32gui.EnumWindows(enum_windows_callback, None)
            except Exception as e:
                ColorPrint.red(f"[WindowFinder] Error enumerating windows: {e}")

        if found_windows:
            ColorPrint.green(f"[WindowFinder] Found {len(found_windows)} window(s)")
        else:
            ColorPrint.yellow(f"[WindowFinder] No windows found matching: {titles}")

        return found_windows

    @staticmethod
    def _is_browser_window(window_title: str) -> bool:
        """
        Check if window title indicates a browser window

        Args:
            window_title: Window title to check

        Returns:
            True if window appears to be a browser window
        """
        import re
        
        browser_indicators = [
            "Chrome", "Firefox", "Edge", "Safari", "Opera", "Brave",
            "Google Chrome", "Mozilla Firefox", "Microsoft Edge",
            "- Google Chrome", "- Mozilla Firefox", "- Microsoft Edge"
        ]

        # Check for browser indicators
        for indicator in browser_indicators:
            if indicator.lower() in window_title.lower():
                return True

        # Check for website pattern (xxx.xxx format)
        website_pattern = r'\b[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.([a-zA-Z]{2,})\b'
        if re.search(website_pattern, window_title):
            return True

        return False


# Example usage
if __name__ == "__main__":
    # Test window finder
    finder = WindowFinder()

    # Search for windows
    windows = finder.find_windows_by_titles(
        titles=["Diablo III", "暗黑破坏神 III"],
        match_mode="in",
        use_cache=True
    )

    if windows:
        print(f"\nFound {len(windows)} window(s):")
        for window in windows:
            print(f"  Title: {window['title']}")
            print(f"  Handle: {window['hwnd']}")
            print(f"  Size: {window['width']}x{window['height']}")
            print(f"  Position: {window['rect']}")
    else:
        print("No windows found")
