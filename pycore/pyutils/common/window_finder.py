#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window Finder - Shared Window Search Utility
Provides centralized window searching with encyclopedia caching
Used by window_screenshot, window_activator, and window_analyzer
"""

from typing import List, Dict, Callable, Optional

from pycore.pyfoundations.third_party import get_third_package_win32gui

win32gui = get_third_package_win32gui()

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA

# Last lookup result per cache_key (found or not). Log only on state change.
_window_finder_last_found: Dict[str, bool] = {}


class WindowFinder:
    """
    Centralized window finder with encyclopedia caching

    Provides consistent window searching across all window-related utilities
    """

    @staticmethod
    def find_windows_by_titles(
        titles: List[str],
        match_mode: str = "endswith",
        use_cache: bool = True,
        skip_browser_if: Optional[Callable[[int, str], bool]] = None
    ) -> List[Dict]:
        """
        Find windows by titles with encyclopedia caching

        This is the SINGLE SOURCE OF TRUTH for window searching.
        All window-related utilities should use this method.

        Args:
            titles: List of window titles to search for
            match_mode: Window title matching mode - "in", "startswith", "endswith", or "exact"
            use_cache: Whether to use encyclopedia cache (default: True)
            skip_browser_if: Optional callable(hwnd, window_title) -> bool; when True, window is skipped (e.g. exe-based browser detection). Core does not implement browser logic; pass from auxiliary (e.g. BrowserWindowDetector).

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
        found_windows = []

        # Single canonical cache key per search list so all callers share one entry (e.g. D3 window)
        canonical_label = titles[0] if titles else ""
        cache_key = f"window_cache_{canonical_label.lower()}" if canonical_label else None

        # Step 1: Try to get from encyclopedia cache first (one key per title list)
        if use_cache and cache_key:
            cached_info = ENCYCLOPEDIA.get(cache_key)

            if cached_info:
                hwnd = cached_info.get("hwnd")
                title = cached_info.get("title")
                if hwnd and win32gui.IsWindow(hwnd) and win32gui.IsWindowVisible(hwnd):
                    if skip_browser_if is not None and skip_browser_if(hwnd, title or ""):
                        ENCYCLOPEDIA.remove(cache_key)
                        ColorPrint.print_min_interval(f"[Cache] Cached window skipped by filter for '{canonical_label}', re-searching", "1min", "yellow")
                    else:
                        try:
                            rect = win32gui.GetWindowRect(hwnd)
                            window_info = {
                                "hwnd": hwnd,
                                "title": title,
                                "class_name": cached_info.get("class_name"),
                                "rect": rect,
                                "width": rect[2] - rect[0],
                                "height": rect[3] - rect[1]
                            }
                            found_windows.append(window_info)
                        except Exception as e:
                            ColorPrint.print_min_interval(f"[Cache] Error reading cached window: {e}", "1min", "yellow")
                else:
                    ENCYCLOPEDIA.remove(cache_key)
                    ColorPrint.print_min_interval(f"[Cache] Cached window invalid for '{canonical_label}', removed", "1min", "yellow")

        # Step 2: If not found in cache (or cache disabled), search all windows
        if not found_windows:

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

                            # Optional: skip when caller-provided filter says so (e.g. exe-based browser detection)
                            if match_found and skip_browser_if is not None and skip_browser_if(hwnd, window_title):
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

                                # Cache under canonical key (titles[0]) so all callers share one entry
                                if use_cache and cache_key and len(found_windows) == 1:
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

                                break
                    except Exception as e:
                        ColorPrint.print_min_interval(f"[WindowFinder] Error checking window: {e}", "1min", "yellow")
                return True

            try:
                win32gui.EnumWindows(enum_windows_callback, None)
            except Exception as e:
                ColorPrint.print_min_interval(f"[WindowFinder] Error enumerating windows: {e}", "1min", "red")

        # Log only on state change: not found -> found, or found -> lost
        if cache_key is not None:
            current_found = bool(found_windows)
            last_found = _window_finder_last_found.get(cache_key)
            if last_found is False and current_found:
                ColorPrint.print_min_interval(f"[WindowFinder] Window found: {canonical_label}", "1min", "green")
            elif last_found is True and not current_found:
                ColorPrint.print_min_interval(f"[WindowFinder] Window lost: {canonical_label}", "1min", "yellow")
            _window_finder_last_found[cache_key] = current_found

        return found_windows

    @staticmethod
    def invalidate_window_cache(titles: List[str]) -> bool:
        """
        Remove encyclopedia cache entry for the given title list so the next
        find_windows_by_titles(use_cache=True) or screenshot capture gets fresh window rect.
        Call this after window resize so window_offset is recalculated from current position.

        Args:
            titles: Same list as used for find_windows_by_titles (e.g. DIABLO_III_WINDOW_TITLES).

        Returns:
            True if a cache key was removed, False if no key existed.
        """
        canonical_label = titles[0] if titles else ""
        cache_key = f"window_cache_{canonical_label.lower()}" if canonical_label else None
        if not cache_key:
            return False
        try:
            if ENCYCLOPEDIA.get(cache_key) is not None:
                ENCYCLOPEDIA.remove(cache_key)
                ColorPrint.blue(f"[WindowFinder] Invalidated cache for '{canonical_label}' (use fresh offset after resize)")
                return True
        except Exception:
            pass
        return False
