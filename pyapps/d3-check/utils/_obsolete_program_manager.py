#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Program Manager
Generic program management utility for starting and activating applications
"""

import os
import sys
import time
import subprocess
import psutil
from typing import List, Optional
import win32gui
import win32con
import pyautogui

current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

from utils.color_print import ColorPrint


class ProgramManager:
    """Generic program manager for starting and activating applications"""
    
    def __init__(self, program_path: str, window_titles: Optional[List[str]] = None):
        """
        Initialize ProgramManager
        
        Args:
            program_path: Path to the program executable
            window_titles: Optional list of window titles to look for. 
                         If None, uses basename of program_path
        """
        self.program_path = program_path
        if window_titles is None:
            # Use basename of program_path as default title
            basename = os.path.basename(program_path)
            self.window_titles = [basename]
        else:
            self.window_titles = window_titles
        self.was_just_started = False  # Track if program was just started
    
    def is_program_running(self) -> bool:
        """Check if the program is already running"""
        try:
            program_name = os.path.basename(self.program_path)
            for proc in psutil.process_iter(['pid', 'name', 'exe']):
                if proc.info['name'] and program_name in proc.info['name']:
                    return True
        except Exception as e:
            ColorPrint.yellow(f"⚠️  Error checking program process: {e}")
        return False
    
    def start_program(self) -> bool:
        """Start the program if not already running"""
        if self.is_program_running():
            ColorPrint.yellow("🔄 Program is already running, skipping startup")
            self.was_just_started = False
            return True
        
        if not os.path.exists(self.program_path):
            ColorPrint.red(f"❌ Program executable not found at: {self.program_path}")
            return False
        
        try:
            ColorPrint.green(f"🚀 Starting program from: {self.program_path}")
            subprocess.Popen([self.program_path], shell=True)
            
            # Wait for program to start
            for i in range(30):  # Wait up to 30 seconds
                time.sleep(1)
                if self.is_program_running():
                    ColorPrint.green("✅ Program started successfully")
                    self.was_just_started = True  # Mark as just started
                    return True
                ColorPrint.gray(f"   Waiting for program to start... ({i+1}/30)")
            
            ColorPrint.red("❌ Program failed to start within 30 seconds")
            return False
            
        except Exception as e:
            ColorPrint.red(f"❌ Error starting program: {e}")
            return False
    
    def get_program_window(self):
        """Get program window using win32gui"""
        try:
            import win32gui
            found_window = None
            
            def enum_windows_callback(hwnd, lparam):
                nonlocal found_window
                if win32gui.IsWindowVisible(hwnd):
                    window_title = win32gui.GetWindowText(hwnd)
                    for title in self.window_titles:
                        if title in window_title:
                            # Create a simple window object
                            class SimpleWindow:
                                def __init__(self, hwnd, title):
                                    self._hWnd = int(hwnd)  # Ensure it's an integer
                                    self.title = title
                                    # Get window rect
                                    try:
                                        rect = win32gui.GetWindowRect(hwnd)
                                        self.left = rect[0]
                                        self.top = rect[1]
                                        self.width = rect[2] - rect[0]
                                        self.height = rect[3] - rect[1]
                                    except:
                                        self.left = 0
                                        self.top = 0
                                        self.width = 0
                                        self.height = 0
                                    self.isActive = False
                                    self.isMaximized = False
                                    self.isMinimized = False
                                
                                def activate(self):
                                    try:
                                        import win32con
                                        win32gui.SetForegroundWindow(self._hWnd)
                                        win32gui.ShowWindow(self._hWnd, win32con.SW_RESTORE)
                                        return True
                                    except:
                                        return False
                            
                            found_window = SimpleWindow(hwnd, window_title)
                            return False  # Stop enumeration
                return True
            
            win32gui.EnumWindows(enum_windows_callback, None)
            if found_window:
                return found_window
            
            # If no window found but program is running, it's likely minimized to tray
            if self.is_program_running():
                ColorPrint.yellow("⚠️  Program is running but window not found - likely minimized to tray")
                return None  # Return None to indicate tray activation needed
            
            raise Exception("Program window not found")
        except Exception as e:
            ColorPrint.red(f"❌ Error getting program window: {e}")
            return None
    
    def activate_program_window(self) -> bool:
        """Activate and bring program window to front using win32gui"""
        ColorPrint.yellow("🔄 Activating program window...")
        
        try:
            import win32gui
            import win32con
            
            def enum_windows_callback(hwnd, lparam):
                if win32gui.IsWindowVisible(hwnd):
                    window_title = win32gui.GetWindowText(hwnd)
                    for title in self.window_titles:
                        if title in window_title:
                            try:
                                win32gui.SetForegroundWindow(hwnd)
                                win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
                                ColorPrint.green(f"✅ Program window activated: {window_title}")
                                return False  # Stop enumeration
                            except Exception as e:
                                ColorPrint.yellow(f"⚠️  Error activating window: {e}")
                                # Continue trying other windows
                return True
            
            win32gui.EnumWindows(enum_windows_callback, None)
            
            # Adjust wait time based on whether program was just started
            if self.was_just_started:
                ColorPrint.gray("   Program was just started, waiting longer for window to fully load...")
                time.sleep(10)  # Longer wait for newly started programs
            else:
                time.sleep(2)  # Normal wait time
            
            return True
            
        except Exception as e:
            ColorPrint.red(f"❌ Error activating program window: {e}")
            return False
    
    def ensure_program_running_and_activated(self) -> bool:
        """Ensure program is running and activated - returns True if program is running, False if not"""
        ColorPrint.yellow(f"🎮 Ensuring program is running and activated...")
        
        # Start program if not running
        if not self.start_program():
            ColorPrint.red("❌ Failed to start program")
            return False
        
        # Adjust wait time based on whether program was just started
        if self.was_just_started:
            ColorPrint.gray("   Program was just started, waiting longer for full initialization...")
            time.sleep(10)  # Longer wait for newly started programs
        else:
            time.sleep(5)  # Normal wait time
        
        # Check if program window is visible
        window = self.get_program_window()
        if window:
            # Window found, try to activate it
            if self.activate_program_window():
                ColorPrint.green(f"✅ Program is running and activated: {window.title}")
                return True
            else:
                ColorPrint.yellow("⚠️  Could not activate program window, but program is running")
                return True  # Still return True since program is running
        else:
            # Window not found but program is running - likely minimized to tray
            ColorPrint.yellow("🔄 Program is running but window not found - likely minimized to tray")
            return True  # Return True to indicate program is running but needs tray activation 