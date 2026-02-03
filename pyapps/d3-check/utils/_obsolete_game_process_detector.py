#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Game Process Detector
Detects Diablo III game process by checking window titles
"""

import os
import sys
import time
import win32gui
from typing import List, Optional, Dict

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

# Add ncore path

from providor.providor_second import DIABLO_III_WINDOW_TITLES
from pycore.pyfoundations.color_print import ColorPrint

class GameProcessDetector:
    """Detects Diablo III game process by checking window titles"""
    
    def __init__(self):
        self.diablo_window_titles = DIABLO_III_WINDOW_TITLES
        ColorPrint.green("[INIT] GameProcessDetector initialized")

    def detect_diablo_process(self) -> Optional[Dict]:
        """Detect Diablo III process - alias for check_diablo_process_running"""
        return self.check_diablo_process_running()

    def detect_rosbot_process(self) -> Optional[Dict]:
        """Detect RoS-BoT process"""
        try:
            all_windows = self.get_all_window_titles()

            for window in all_windows:
                window_title = window['title']

                # Check for RoS-BoT related titles
                if ('ros-bot' in window_title.lower() or
                    'rosbot' in window_title.lower() or
                    'RoS-BoT' in window_title):

                    # Get process ID
                    try:
                        import win32process
                        _, pid = win32process.GetWindowThreadProcessId(window['hwnd'])

                        return {
                            'hwnd': window['hwnd'],
                            'title': window_title,
                            'pid': pid,
                            'found': True
                        }
                    except:
                        return {
                            'hwnd': window['hwnd'],
                            'title': window_title,
                            'pid': 0,
                            'found': True
                        }

            return None

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error detecting RoS-BoT process: {e}")
            return None

    def detect_other_exe_processes(self) -> Dict[str, Dict]:
        """Detect other exe processes"""
        try:
            # This is a simplified implementation
            # In practice, you would scan for specific exe files
            return {}

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error detecting other exe processes: {e}")
            return {}

    def get_all_window_titles(self) -> List[Dict]:
        """Get all visible window titles and handles"""
        windows = []
        
        def enum_windows_callback(hwnd, lparam):
            if win32gui.IsWindowVisible(hwnd):
                try:
                    window_title = win32gui.GetWindowText(hwnd)
                    if window_title.strip():  # Only include windows with non-empty titles
                        windows.append({
                            'hwnd': hwnd,
                            'title': window_title
                        })
                except Exception:
                    pass
            return True
        
        try:
            win32gui.EnumWindows(enum_windows_callback, None)
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error enumerating windows: {e}")
        
        return windows
    
    def check_diablo_process_running(self) -> Optional[Dict]:
        """
        Check if Diablo III process is running by checking window titles
        
        Returns:
            Dict with process info if found, None otherwise
        """
        try:
            ColorPrint.blue("[DETECT] Checking for Diablo III process...")
            
            # Get all window titles
            all_windows = self.get_all_window_titles()
            ColorPrint.gray(f"[INFO] Found {len(all_windows)} visible windows")
            
            # Check each window title against Diablo III titles
            for window in all_windows:
                window_title = window['title']
                
                # Check if any Diablo III title matches the end of this window title
                for diablo_title in self.diablo_window_titles:
                    if window_title.endswith(diablo_title):
                        ColorPrint.green(f"[FOUND] Diablo III process detected!")
                        ColorPrint.green(f"[MATCH] Window title: '{window_title}'")
                        ColorPrint.green(f"[MATCH] Matched pattern: '{diablo_title}'")
                        ColorPrint.green(f"[HANDLE] Window handle: {window['hwnd']}")
                        
                        return {
                            'hwnd': window['hwnd'],
                            'title': window_title,
                            'matched_pattern': diablo_title,
                            'found': True
                        }
            
            ColorPrint.yellow("[NOT_FOUND] Diablo III process not detected")
            return None
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error checking Diablo III process: {e}")
            return None
    
    def wait_for_diablo_process(self, timeout_seconds: int = 30, check_interval: float = 2.0) -> Optional[Dict]:
        """
        Wait for Diablo III process to start
        
        Args:
            timeout_seconds: Maximum time to wait in seconds
            check_interval: Time between checks in seconds
            
        Returns:
            Dict with process info if found, None if timeout
        """
        try:
            ColorPrint.blue(f"[WAIT] Waiting for Diablo III process (timeout: {timeout_seconds}s)...")
            
            start_time = time.time()
            check_count = 0
            
            while time.time() - start_time < timeout_seconds:
                check_count += 1
                ColorPrint.gray(f"[CHECK] Process check #{check_count}")
                
                # Check if Diablo III is running
                process_info = self.check_diablo_process_running()
                if process_info:
                    elapsed_time = time.time() - start_time
                    ColorPrint.green(f"[SUCCESS] Diablo III detected after {elapsed_time:.1f} seconds")
                    return process_info
                
                # Wait before next check
                time.sleep(check_interval)
            
            # Timeout reached
            ColorPrint.red(f"[TIMEOUT] Diablo III process not detected within {timeout_seconds} seconds")
            return None
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error waiting for Diablo III process: {e}")
            return None
    
    def print_all_windows_debug(self):
        """Print all window titles for debugging purposes"""
        try:
            ColorPrint.blue("[DEBUG] Listing all visible windows:")
            all_windows = self.get_all_window_titles()
            
            for i, window in enumerate(all_windows, 1):
                ColorPrint.gray(f"[{i:3d}] Handle: {window['hwnd']:8d} | Title: '{window['title']}'")
            
            ColorPrint.blue(f"[DEBUG] Total windows: {len(all_windows)}")
            
        except Exception as e:
            ColorPrint.red(f"[ERROR] Error printing debug info: {e}")

def main():
    """Main function for testing"""
    detector = GameProcessDetector()
    
    print("[TEST] Testing GameProcessDetector...")
    
    # Print all windows for debugging
    detector.print_all_windows_debug()
    
    # Check if Diablo III is currently running
    result = detector.check_diablo_process_running()
    if result:
        print(f"[RESULT] Diablo III found: {result['title']}")
    else:
        print("[RESULT] Diablo III not found")

if __name__ == "__main__":
    main()
