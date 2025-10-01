#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window Activator
Handles window activation and focus management
"""

import sys
import time
from pathlib import Path

# Add parent directory to path for dependency checking
pytools_dir = Path(__file__).parent.parent
sys.path.insert(0, str(pytools_dir))

# Check and install dependencies before importing third-party packages
from pytools import check_and_install_dependencies
check_and_install_dependencies()

import win32gui
import win32con

from pyfoundations.color_print import ColorPrint
from pyfoundations.encyclopedia import ENCYCLOPEDIA


class WindowActivator:
    """Activates and manages window focus"""
    
    def __init__(self):
        """Initialize window activator"""
        ColorPrint.green("[INIT] WindowActivator initialized")
    
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
                ColorPrint.yellow(f"[WARN] Window not found: {window_title}")
                return False
            
            # Check if window is visible
            if not win32gui.IsWindowVisible(hwnd):
                ColorPrint.yellow(f"[WARN] Window is not visible: {window_title}")
                return False
            
            # Check if window is minimized
            if win32gui.IsIconic(hwnd):
                ColorPrint.blue(f"[RESTORE] Restoring minimized window: {window_title}")
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                time.sleep(0.5)
            
            # Bring window to foreground
            ColorPrint.blue(f"[ACTIVATE] Activating window: {window_title}")
            win32gui.SetForegroundWindow(hwnd)
            
            # Wait a bit for activation to take effect
            time.sleep(0.5)
            
            # Verify window is now active
            active_hwnd = win32gui.GetForegroundWindow()
            if active_hwnd == hwnd:
                ColorPrint.green(f"[SUCCESS] Window activated: {window_title}")
                return True
            else:
                ColorPrint.yellow(f"[WARN] Window activation may have failed: {window_title}")
                return False
                
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error activating window {window_title}: {e}")
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
                        ColorPrint.green(f"[CACHE] Using cached window: '{cached_info.get('title')}' (Handle: {hwnd})")
                    else:
                        ColorPrint.yellow(f"[CACHE] Cached window invalid, searching...")

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
                                ColorPrint.blue(f"[CACHE] Cached window info for '{partial_title}'")
                            except Exception as e:
                                ColorPrint.yellow(f"[WARN] Error caching window info: {e}")
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
                        ColorPrint.yellow(f"[WARN] Error updating cached position: {e}")

                return result
            else:
                ColorPrint.yellow(f"[WARN] No window found with partial title: {partial_title}")
                return False

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error finding window with partial title {partial_title}: {e}")
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
                ColorPrint.red(f"[ERROR] Invalid window handle: {hwnd}")
                return False
            
            if not win32gui.IsWindowVisible(hwnd):
                ColorPrint.yellow(f"[WARN] Window is not visible (handle: {hwnd})")
                return False
            
            # Check if window is minimized
            if win32gui.IsIconic(hwnd):
                ColorPrint.blue(f"[RESTORE] Restoring minimized window (handle: {hwnd})")
                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                time.sleep(0.5)
            
            # Bring window to foreground
            ColorPrint.blue(f"[ACTIVATE] Activating window (handle: {hwnd})")
            win32gui.SetForegroundWindow(hwnd)
            
            # Wait a bit for activation to take effect
            time.sleep(0.5)
            
            # Verify window is now active
            active_hwnd = win32gui.GetForegroundWindow()
            if active_hwnd == hwnd:
                ColorPrint.green(f"[SUCCESS] Window activated (handle: {hwnd})")
                return True
            else:
                ColorPrint.yellow(f"[WARN] Window activation may have failed (handle: {hwnd})")
                return False
                
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error activating window (handle: {hwnd}): {e}")
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
            ColorPrint.red(f"[ERROR] Error getting active window info: {e}")
            return {"handle": None, "title": None, "class": None, "rect": None}
    
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
            ColorPrint.red(f"[ERROR] Error listing windows: {e}")
            return []
