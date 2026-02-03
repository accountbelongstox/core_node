#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window Activator
Handles window activation and focus management
"""

import os
import sys
import time
import win32gui
import win32con

# Add ncore path

from pycore.pyfoundations.color_print import ColorPrint

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
    
    def activate_window_by_partial_title(self, partial_title: str) -> bool:
        """
        Activate window by partial title match
        
        Args:
            partial_title: Partial title to match
            
        Returns:
            True if window was activated successfully
        """
        try:
            found_hwnd = None
            
            def enum_windows_callback(hwnd, lparam):
                nonlocal found_hwnd
                if win32gui.IsWindowVisible(hwnd):
                    window_title = win32gui.GetWindowText(hwnd)
                    if window_title and partial_title.lower() in window_title.lower():
                        found_hwnd = hwnd
                        return False  # Stop enumeration
                return True
            
            win32gui.EnumWindows(enum_windows_callback, None)
            
            if found_hwnd:
                return self.activate_window_by_handle(found_hwnd)
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
