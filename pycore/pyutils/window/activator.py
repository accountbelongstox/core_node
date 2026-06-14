#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window Activator
Handles window activation and focus management
"""

import sys
import time
from pathlib import Path

from pycore.pyfoundations.third_party import get_third_package_win32gui, get_third_package_win32con

win32gui = get_third_package_win32gui()
win32con = get_third_package_win32con()
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA


class WindowActivator:
    """Activates and manages window focus"""
    
    def __init__(self):
        """Initialize window activator"""
        ColorPrint.print_min_interval("[INIT] WindowActivator initialized", "5min", "green")
    
    def activate_window_by_title(self, window_title: str) -> bool:
        """
        Activate window by title
        
        Args:
            window_title: Title of window to activate
            
        Returns:
            True if window was activated successfully
        """
        try:
            # Find window by title
            hwnd = win32gui.FindWindow(None, window_title)
            if not hwnd:
                ColorPrint.print_min_interval(f"[WARN] Window not found: {window_title}", "5min", "yellow")
                return False
            
            # Check if window is visible
            if not win32gui.IsWindowVisible(hwnd):
                ColorPrint.print_min_interval(f"[WARN] Window is not visible: {window_title}", "5min", "yellow")
                return False
            
            # Check if window is minimized
            if win32gui.IsIconic(hwnd):
                ColorPrint.print_min_interval(f"[RESTORE] Restoring minimized window: {window_title}", "5min", "blue")
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                time.sleep(0.5)
            
            # Bring window to foreground
            ColorPrint.print_min_interval(f"[ACTIVATE] Activating window: {window_title}", "5min", "blue")
            win32gui.SetForegroundWindow(hwnd)
            
            # Wait a bit for activation to take effect
            time.sleep(0.5)
            
            # Verify window is now active
            active_hwnd = win32gui.GetForegroundWindow()
            if active_hwnd == hwnd:
                ColorPrint.print_min_interval(f"[SUCCESS] Window activated: {window_title}", "5min", "green")
                return True
            else:
                ColorPrint.print_min_interval(f"[WARN] Window activation may have failed: {window_title}", "5min", "yellow")
                return False
                
        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] Error activating window {window_title}: {e}", "5min", "red")
            return False
    
    def activate_window_by_partial_title(self, partial_title: str, use_cache: bool = True) -> bool:
        """
        Activate window by partial title match
        First tries to get from encyclopedia cache, then searches if needed

        Args:
            partial_title: Partial title to match
            use_cache: Whether to use cached window information

        Returns:
            True if window was activated successfully
        """
        try:
            found_hwnd = None
            window_info = None

            # Try to get from cache first
            if use_cache:
                cache_key = f"window_cache_{partial_title.lower()}"
                cached_info = ENCYCLOPEDIA.get(cache_key)

                if cached_info:
                    hwnd = cached_info.get("hwnd")
                    # Validate cached window
                    if hwnd and win32gui.IsWindow(hwnd) and win32gui.IsWindowVisible(hwnd):
                        found_hwnd = hwnd
                        window_info = cached_info
                        ColorPrint.print_min_interval(f"[CACHE] Using cached window: '{cached_info.get('title')}' (Handle: {hwnd})", "5min", "green")
                    else:
                        ColorPrint.print_min_interval(f"[CACHE] Cached window invalid, searching...", "5min", "yellow")

            # If not found in cache or cache invalid, search for window
            if not found_hwnd:
                def enum_windows_callback(hwnd, lparam):
                    nonlocal found_hwnd, window_info
                    if win32gui.IsWindowVisible(hwnd):
                        window_title = win32gui.GetWindowText(hwnd)
                        if window_title and partial_title.lower() in window_title.lower():
                            found_hwnd = hwnd
                            # Get window position info
                            try:
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
                                # Cache the window info
                                cache_key = f"window_cache_{partial_title.lower()}"
                                ENCYCLOPEDIA.add(cache_key, window_info)
                                ColorPrint.print_min_interval(f"[CACHE] Cached window info for '{partial_title}'", "5min", "blue")
                            except Exception as e:
                                ColorPrint.print_min_interval(f"[WARN] Error caching window info: {e}", "5min", "yellow")
                            return False  # Stop enumeration
                    return True

                win32gui.EnumWindows(enum_windows_callback, None)

            if found_hwnd:
                result = self.activate_window_by_handle(found_hwnd)

                # Update position in cache after activation (window might have moved)
                if result and window_info:
                    try:
                        rect = win32gui.GetWindowRect(found_hwnd)
                        window_info.update({
                            "rect": rect,
                            "left": rect[0],
                            "top": rect[1],
                            "right": rect[2],
                            "bottom": rect[3],
                            "width": rect[2] - rect[0],
                            "height": rect[3] - rect[1]
                        })
                        cache_key = f"window_cache_{partial_title.lower()}"
                        ENCYCLOPEDIA.add(cache_key, window_info)
                    except Exception as e:
                        ColorPrint.print_min_interval(f"[WARN] Error updating cached position: {e}", "5min", "yellow")

                return result
            else:
                ColorPrint.print_min_interval(f"[WARN] No window found with partial title: {partial_title}", "5min", "yellow")
                return False

        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] Error finding window with partial title {partial_title}: {e}", "5min", "red")
            return False
    
    def activate_window_by_handle(self, hwnd: int) -> bool:
        """
        Activate window by handle
        
        Args:
            hwnd: Window handle
            
        Returns:
            True if window was activated successfully
        """
        try:
            if not win32gui.IsWindow(hwnd):
                ColorPrint.print_min_interval(f"[ERROR] Invalid window handle: {hwnd}", "5min", "red")
                return False
            
            if not win32gui.IsWindowVisible(hwnd):
                ColorPrint.print_min_interval(f"[WARN] Window is not visible (handle: {hwnd})", "5min", "yellow")
                return False
            
            # Check if window is minimized
            if win32gui.IsIconic(hwnd):
                ColorPrint.print_min_interval(f"[RESTORE] Restoring minimized window (handle: {hwnd})", "5min", "blue")
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                time.sleep(0.5)
            
            # Bring window to foreground (SetForegroundWindow can fail with foreground lock from other process)
            ColorPrint.print_min_interval(f"[ACTIVATE] Activating window (handle: {hwnd})", "5min", "blue")
            try:
                win32gui.SetForegroundWindow(hwnd)
            except Exception as e:
                ColorPrint.print_min_interval(f"[WARN] SetForegroundWindow failed (handle: {hwnd}): {e}", "5min", "yellow")
                # Window is visible/restored; allow caller to proceed (clicks may still work)
                return True

            time.sleep(0.5)
            active_hwnd = win32gui.GetForegroundWindow()
            if active_hwnd == hwnd:
                ColorPrint.print_min_interval(f"[SUCCESS] Window activated (handle: {hwnd})", "5min", "green")
                return True
            ColorPrint.print_min_interval(f"[WARN] Window activation may have failed (handle: {hwnd})", "5min", "yellow")
            return False
                
        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] Error activating window (handle: {hwnd}): {e}", "5min", "red")
            return False
    
    def get_active_window_info(self) -> dict:
        """
        Get information about the currently active window
        
        Returns:
            Dictionary with window information
        """
        try:
            active_hwnd = win32gui.GetForegroundWindow()
            if active_hwnd:
                window_title = win32gui.GetWindowText(active_hwnd)
                window_class = win32gui.GetClassName(active_hwnd)
                rect = win32gui.GetWindowRect(active_hwnd)
                
                return {
                    "handle": active_hwnd,
                    "title": window_title,
                    "class": window_class,
                    "rect": rect,
                    "width": rect[2] - rect[0],
                    "height": rect[3] - rect[1]
                }
            else:
                return {"handle": None, "title": None, "class": None, "rect": None}
                
        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] Error getting active window info: {e}", "5min", "red")
            return {"handle": None, "title": None, "class": None, "rect": None}
    
    def get_window_info(
        self,
        titles: list,
        search_process: bool = False,
        match_mode: str = "exact",
        title_mode: str = "startwith"
    ) -> dict:
        """
        Get window information from encyclopedia cache or search process

        Args:
            titles: List of window titles to search for
            search_process: If True, search process when not found in cache (default: False)
            match_mode: How to match titles - "exact", "startwith", "include", "endwith" (default: "exact")
            title_mode: DEPRECATED - use match_mode instead (kept for backward compatibility)

        Returns:
            Dictionary with window information:
            {
                "found": bool,
                "hwnd": int or None,
                "title": str or None,
                "x": int or None,
                "y": int or None,
                "width": int or None,
                "height": int or None,
                "left": int or None,
                "top": int or None,
                "right": int or None,
                "bottom": int or None,
                "class_name": str or None,
                "source": "cache" or "process" or None
            }
        """
        try:
            # Use title_mode if match_mode is default (for backward compatibility)
            if match_mode == "exact" and title_mode != "startwith":
                match_mode = title_mode

            ColorPrint.print_min_interval(f"[GetWindowInfo] Searching for windows: {titles}", "5min", "blue")
            ColorPrint.print_min_interval(f"[GetWindowInfo] Match mode: {match_mode}, Search process: {search_process}", "5min", "blue")

            # Step 1: Try to get from encyclopedia cache
            for title in titles:
                cache_key = f"window_cache_{title.lower()}"
                cached_info = ENCYCLOPEDIA.get(cache_key)

                if cached_info:
                    hwnd = cached_info.get("hwnd")
                    # Validate cached window
                    if hwnd and win32gui.IsWindow(hwnd) and win32gui.IsWindowVisible(hwnd):
                        ColorPrint.green(f"[Cache] Found valid cached window: '{cached_info.get('title')}'")
                        ColorPrint.print_min_interval(f"[Cache] Found valid cached window: '{cached_info.get('title')}'", "5min", "green")

                        # Update position from current window state
                        try:
                            rect = win32gui.GetWindowRect(hwnd)
                            return {
                                "found": True,
                                "hwnd": hwnd,
                                "title": cached_info.get("title"),
                                "x": rect[0],
                                "y": rect[1],
                                "width": rect[2] - rect[0],
                                "height": rect[3] - rect[1],
                                "left": rect[0],
                                "top": rect[1],
                                "right": rect[2],
                                "bottom": rect[3],
                                "class_name": cached_info.get("class_name"),
                                "source": "cache"
                            }
                        except Exception as e:
                            ColorPrint.print_min_interval(f"[Cache] Error reading window rect: {e}", "5min", "yellow")
                    else:
                        ColorPrint.print_min_interval(f"[Cache] Cached window invalid for '{title}'", "5min", "yellow")

            # Step 2: If search_process is True and not found in cache, search process
            if search_process:
                ColorPrint.print_min_interval("[Process] Searching through visible windows...", "5min", "blue")

                found_window = None

                def enum_windows_callback(hwnd, lparam):
                    nonlocal found_window
                    if win32gui.IsWindowVisible(hwnd):
                        try:
                            window_title = win32gui.GetWindowText(hwnd)
                            if window_title:
                                # Check if window title matches any of the provided titles
                                for target_title in titles:
                                    match_found = False

                                    if match_mode == "exact":
                                        match_found = window_title == target_title
                                    elif match_mode == "startwith":
                                        match_found = window_title.startswith(target_title)
                                    elif match_mode == "include":
                                        match_found = target_title.lower() in window_title.lower()
                                    elif match_mode == "endwith":
                                        match_found = window_title.endswith(target_title)

                                    if match_found:
                                        rect = win32gui.GetWindowRect(hwnd)
                                        found_window = {
                                            "found": True,
                                            "hwnd": hwnd,
                                            "title": window_title,
                                            "x": rect[0],
                                            "y": rect[1],
                                            "width": rect[2] - rect[0],
                                            "height": rect[3] - rect[1],
                                            "left": rect[0],
                                            "top": rect[1],
                                            "right": rect[2],
                                            "bottom": rect[3],
                                            "class_name": win32gui.GetClassName(hwnd),
                                            "source": "process"
                                        }

                                        # Cache the found window
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
                                        ColorPrint.print_min_interval(f"[Process] Cached found window '{target_title}'", "5min", "blue")

                                        return False  # Stop enumeration
                        except Exception as e:
                            ColorPrint.print_min_interval(f"[Process] Error checking window: {e}", "5min", "yellow")
                    return True

                win32gui.EnumWindows(enum_windows_callback, None)

                if found_window:
                    ColorPrint.print_min_interval(f"[Process] Found window: '{found_window['title']}'", "5min", "green")
                    return found_window

            # Step 3: Not found
            ColorPrint.print_min_interval("[GetWindowInfo] No matching window found", "5min", "yellow")
            return {
                "found": False,
                "hwnd": None,
                "title": None,
                "x": None,
                "y": None,
                "width": None,
                "height": None,
                "left": None,
                "top": None,
                "right": None,
                "bottom": None,
                "class_name": None,
                "source": None
            }

        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] Error in get_window_info: {e}", "5min", "red")
            import traceback
            traceback.print_exc()
            return {
                "found": False,
                "hwnd": None,
                "title": None,
                "x": None,
                "y": None,
                "width": None,
                "height": None,
                "left": None,
                "top": None,
                "right": None,
                "bottom": None,
                "class_name": None,
                "source": None
            }

    def list_visible_windows(self) -> list:
        """
        List all visible windows

        Returns:
            List of window information dictionaries
        """
        windows = []

        def enum_windows_callback(hwnd, lparam):
            if win32gui.IsWindowVisible(hwnd):
                try:
                    window_title = win32gui.GetWindowText(hwnd)
                    if window_title:  # Only include windows with titles
                        window_class = win32gui.GetClassName(hwnd)
                        rect = win32gui.GetWindowRect(hwnd)

                        windows.append({
                            "handle": hwnd,
                            "title": window_title,
                            "class": window_class,
                            "rect": rect,
                            "width": rect[2] - rect[0],
                            "height": rect[3] - rect[1]
                        })
                except Exception:
                    pass
            return True

        try:
            win32gui.EnumWindows(enum_windows_callback, None)
            return windows
        except Exception as e:
            ColorPrint.print_min_interval(f"[ERROR] Error listing windows: {e}", "5min", "red")
            return []
