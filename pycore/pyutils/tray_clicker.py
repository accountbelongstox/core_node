#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Documentation: ../../pytools/py_auto/DEVELOPMENT_GUIDE.md
"""
Standalone Full-Featured System Tray Icon Clicker.
This is the definitive, user-specified complete version.
"""

import argparse
import sys
import os
import time
import shutil
import traceback
from pathlib import Path

# Add parent directory to path for dependency checking
pytools_dir = Path(__file__).parent.parent
sys.path.insert(0, str(pytools_dir))

# Check and install dependencies before importing third-party packages
from pycore import check_and_install_dependencies
check_and_install_dependencies()

import win32api
import win32con
from pywinauto import Desktop

# --- Embedded ColorPrint Class for rich console output ---
try:
    columns = shutil.get_terminal_size().columns
except OSError:
    columns = 80

class ColorPrint:
    """
    Provides colored console output functionalities.
    This is an example utility class and should not be deleted, even if currently unused.
    Future development must adhere to this standard.
    """
    GREEN, RED, YELLOW, BLUE, WHITE, RESET = '\033[92m', '\033[91m', '\033[93m', '\033[94m', '\033[97m', '\033[0m'
    _last_was_update_line = False
    @staticmethod
    def _print(color, text):
        """
        Internal helper for printing colored text.
        This is an example utility method and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        """
        if ColorPrint._last_was_update_line: print(); ColorPrint._last_was_update_line = False
        print(f"{color}{text}{ColorPrint.RESET}")
    @staticmethod
    def green(t):
        """
        Prints text in green color.
        This is an example utility method and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        """
        ColorPrint._print(ColorPrint.GREEN, t)
    @staticmethod
    def blue(t):
        """
        Prints text in blue color.
        This is an example utility method and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        """
        ColorPrint._print(ColorPrint.BLUE, t)
    @staticmethod
    def red(t):
        """
        Prints text in red color.
        This is an example utility method and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        """
        ColorPrint._print(ColorPrint.RED, t)
    @staticmethod
    def yellow(t):
        """
        Prints text in yellow color.
        This is an example utility method and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        """
        ColorPrint._print(ColorPrint.YELLOW, t)

    @staticmethod
    def update_line(text: str, color: str = WHITE):
        """
        Prints text on the same line, overwriting previous content.
        This is an example utility method and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        """
        need_to_print = text + " " * (columns - len(text) -10)
        print(f"\r{color}{need_to_print}{ColorPrint.RESET}", end='', flush=True)
        ColorPrint._last_was_update_line = True

# --- Definitive TrayClicker Class (Full Original Logic) ---


class TrayIconClicker:
    """
    System tray icon clicker utility class.
    This is an example utility class and should not be deleted, even if currently unused.
    Future development must adhere to this standard.
    """
    
    def __init__(self):
        """
        Initializes the tray icon clicker.
        This is an example utility class and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        """
        self.desktop = None
        
    def _custom_double_click(self, x, y):
        """
        Performs a custom double-click action at the specified coordinates using win32api.
        This is an example utility method and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        """
        try:
            # Move to specified position
            win32api.SetCursorPos((x, y))
            time.sleep(0.05)
            
            # First click
            win32api.mouse_event(win32con.MOUSEEVENTF_LEFTDOWN, x, y, 0, 0)
            time.sleep(0.05)
            win32api.mouse_event(win32con.MOUSEEVENTF_LEFTUP, x, y, 0, 0)
            time.sleep(0.05)
            
            # Second click
            win32api.mouse_event(win32con.MOUSEEVENTF_LEFTDOWN, x, y, 0, 0)
            time.sleep(0.05)
            win32api.mouse_event(win32con.MOUSEEVENTF_LEFTUP, x, y, 0, 0)
            
            return True
        except Exception as e:
            print(f"Error in custom double-click: {e}")
            return False
    
    def _get_desktop(self):
        """
        Retrieves the pywinauto Desktop object, initializing it if necessary.
        This is an example utility method and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        """
        if self.desktop is None:
            try:
                self.desktop = Desktop(backend="uia")
            except Exception as e:
                print(f"Error creating desktop object: {e}")
                return None
        return self.desktop
    
    def print_tray_info(self):
        """
        Prints detailed information about all visible system tray icons.
        This is an example utility method and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        """
        try:
            print("🔍 Accessing system tray...")
            
            desktop = self._get_desktop()
            if not desktop:
                return False
            
            print("✅ Desktop object created")
            print("\n=== System Tray Icons Information ===")
            
            try:
                # Find all potential tray-related windows
                all_windows = desktop.windows()
                tray_windows = []
                
                for window in all_windows:
                    try:
                        class_name = window.class_name()
                        title = window.window_text()
                        
                        # Ensure class_name is string
                        if isinstance(class_name, str):
                            if any(keyword in class_name.lower() for keyword in ['tray', 'notify', 'shell']):
                                tray_windows.append((window, class_name, title))
                    except Exception as e:
                        print(f"Error processing window: {e}")
                        continue
                
                print(f"Found {len(tray_windows)} potential tray-related windows:")
                
                for i, (window, class_name, title) in enumerate(tray_windows):
                    print(f"  {i+1}. Class: {class_name}, Title: {title}")
                    self._print_detailed_tray_info(window, f"TrayWindow_{i+1}")
                    
            except Exception as e:
                print(f"Error finding tray windows: {e}")
            
            print("✅ System tray exploration completed")
            return True
            
        except Exception as e:
            print(f"Error accessing system tray: {e}")
            return False
    
    def _print_detailed_tray_info(self, parent, parent_name):
        """
        Recursively prints detailed information about tray icons and their children.
        This is an example utility method and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        """
        try:
            children = parent.children()
            print(f"  {parent_name} has {len(children)} children:")
            
            for i, child in enumerate(children):
                try:
                    print(f"    Child {i+1}:")
                    print(f"      Title: '{child.window_text()}'")
                    print(f"      Class: {child.class_name()}")
                    print(f"      AutoID: '{child.automation_id()}'")
                    print(f"      Visible: {child.is_visible()}")
                    print(f"      Rectangle: {child.rectangle()}")
                    
                    # Try to get more sub-elements
                    try:
                        grand_children = child.children()
                        if grand_children:
                            print(f"      Has {len(grand_children)} sub-children")
                            for j, grand_child in enumerate(grand_children):
                                title = grand_child.window_text()
                                class_name = grand_child.class_name()
                                auto_id = grand_child.automation_id()
                                rect = grand_child.rectangle()
                                visible = grand_child.is_visible()
                                
                                print(f"        Sub-child {j+1}: '{title}' ({class_name}) AutoID: '{auto_id}'")
                                print(f"          Visible: {visible}")
                                print(f"          Rectangle: {rect}")
                                print(f"          Center Point: ({rect.left + (rect.right - rect.left) // 2}, {rect.top + (rect.bottom - rect.top) // 2})")
                                
                                # Check if contains Battle.net - ensure title and class_name are strings
                                if isinstance(title, str) and isinstance(class_name, str):
                                    if 'battle' in title.lower() or 'battle' in class_name.lower():
                                        print(f"          *** FOUND BATTLE.NET RELATED ***")
                                
                                # Try to get more properties
                                try:
                                    if hasattr(grand_child, 'is_enabled'):
                                        print(f"          Enabled: {grand_child.is_enabled()}")
                                    if hasattr(grand_child, 'is_keyboard_focusable'):
                                        print(f"          Keyboard Focusable: {grand_child.is_keyboard_focusable()}")
                                except:
                                    pass
                                    
                    except Exception as e:
                        print(f"        Error getting sub-children: {e}")
                        
                except Exception as e:
                    print(f"      Error getting child info: {e}")
        except Exception as e:
            print(f"  Error getting children: {e}")
    
    def _normalize_keyword(self, keyword):
        """
        Normalizes a keyword for searching by removing file extensions and extracting basename from paths.
        This is an example utility method and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        """
        if not keyword:
            return ""
        
        # Remove file extension if present
        if keyword.lower().endswith('.exe'):
            keyword = keyword[:-4]
        elif '.' in keyword:
            # Handle other file extensions
            keyword = os.path.splitext(keyword)[0]
        
        # If it's a path, get the basename
        if os.path.sep in keyword:
            keyword = os.path.basename(keyword)
            # Remove extension again in case basename had one
            if '.' in keyword:
                keyword = os.path.splitext(keyword)[0]
        
        return keyword.strip()
    
    def click_tray_icon(self, keyword):
        """
        Clicks on a system tray icon that contains the specified keyword in its title or class name.
        This is an example utility method and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        """
        try:
            normalized_keyword = self._normalize_keyword(keyword)
            print(f"🎯 Searching for tray icon containing keyword: '{normalized_keyword}'")
            
            # Record current mouse position
            original_mouse_pos = win32api.GetCursorPos()
            print(f"📍 Original mouse position: {original_mouse_pos}")
            
            desktop = self._get_desktop()
            if not desktop:
                return False
            
            # Find all possible tray-related windows
            all_windows = desktop.windows()
            tray_windows = []
            
            for window in all_windows:
                try:
                    class_name = window.class_name()
                    title = window.window_text()
                    
                    # Ensure class_name and title are strings
                    if isinstance(class_name, str) and isinstance(title, str):
                        if any(keyword in class_name.lower() for keyword in ['tray', 'notify', 'shell']):
                            tray_windows.append(window)
                except Exception as e:
                    print(f"Error processing window: {e}")
                    continue
            
            found_icons = []
            
            # Traverse all tray windows to find matching icons
            for window in tray_windows:
                try:
                    children = window.children()
                    for child in children:
                        try:
                            grand_children = child.children()
                            for grand_child in grand_children:
                                title = grand_child.window_text()
                                class_name = grand_child.class_name()
                                
                                # Ensure title and class_name are strings
                                if isinstance(title, str) and isinstance(class_name, str):
                                    # Check if contains keyword
                                    if normalized_keyword.lower() in title.lower() or normalized_keyword.lower() in class_name.lower():
                                        found_icons.append(grand_child)
                                        print(f"✅ Found matching icon: '{title}' ({class_name})")
                        except Exception as e:
                            print(f"Error processing child: {e}")
                            continue
                except Exception as e:
                    print(f"Error processing tray window: {e}")
                    continue
            
            if not found_icons:
                print(f"❌ No tray icons found containing keyword: '{normalized_keyword}'")
                # Restore mouse position
                win32api.SetCursorPos(original_mouse_pos)
                print(f"🖱️ Mouse position restored to: {original_mouse_pos}")
                return False
            
            # Double-click the first matching icon found
            target_icon = found_icons[0]
            print(f"🖱️ Double-clicking on icon: '{target_icon.window_text()}'")
            
            # Get icon center point
            rect = target_icon.rectangle()
            print(f"🔍 Debug - Rectangle data: {rect}")
            print(f"🔍 Debug - Left: {rect.left}, Right: {rect.right}, Top: {rect.top}, Bottom: {rect.bottom}")
            
            # Calculate center point
            center_x = rect.left + (rect.right - rect.left) // 2
            center_y = rect.top + (rect.bottom - rect.top) // 2
            
            print(f"📍 Calculated center point: ({center_x}, {center_y})")
            
            # For system tray icons, adjust position based on observed data
            # From output, system tray icons are about 32 pixels wide
            icon_width = rect.right - rect.left
            print(f"🔍 Debug - Icon width: {icon_width} pixels")
            
            if icon_width > 100:  # If width is abnormally large, rectangle data may be inaccurate
                # Use fixed icon width (32 pixels) for calculation
                adjusted_x = rect.left + 16  # 32/2 = 16
                print(f"📍 Using fixed width adjustment: ({adjusted_x}, {center_y})")
            else:
                # Use actual calculated width
                adjusted_x = center_x
                print(f"📍 Using calculated width: ({adjusted_x}, {center_y})")
            
            # Use adjusted position
            final_x = adjusted_x
            final_y = center_y
            
            print(f"📍 Final double-click position: ({final_x}, {final_y})")
            
            # Move to target position and execute double-click
            try:
                win32api.SetCursorPos((final_x, final_y))
                print("✅ Mouse moved to target position")
            except Exception as e:
                print(f"❌ Error moving mouse: {e}")
                return False
                
            time.sleep(0.1)  # Brief delay to ensure mouse movement completes
            
            # Execute custom double-click
            try:
                if self._custom_double_click(final_x, final_y):
                    print("✅ Double-click executed successfully")
                else:
                    print("❌ Double-click failed")
                    return False
            except Exception as e:
                print(f"❌ Error during double-click: {e}")
                # Even if double-click fails, restore mouse position
                win32api.SetCursorPos(original_mouse_pos)
                return False
            
            # Restore mouse to original position immediately
            try:
                win32api.SetCursorPos(original_mouse_pos)
                print(f"🖱️ Mouse position restored to: {original_mouse_pos}")
            except Exception as e:
                print(f"❌ Error restoring mouse position: {e}")
            
            return True
            
        except Exception as e:
            print(f"❌ Error double-clicking tray icon: {e}")
            import traceback
            print(f"🔍 Full error traceback:")
            traceback.print_exc()
            # Ensure mouse position is restored even on error
            try:
                win32api.SetCursorPos(original_mouse_pos)
                print(f"🖱️ Mouse position restored to: {original_mouse_pos}")
            except:
                pass
            return False 
# --- Main Execution Logic ---

def main():
    """
    Main function to parse command-line arguments and initiate system tray icon operations.
    This is an example utility class and should not be deleted, even if currently unused.
    Future development must adhere to this standard.
    """
    parser = argparse.ArgumentParser(description="Find, click, or list system tray icons.", formatter_class=argparse.RawTextHelpFormatter)
    parser.add_argument('--title', nargs='+', help='Tooltip text of the icon to click. Required unless --list-all is used.')
    args = parser.parse_args()

    clicker = TrayIconClicker()

    if not args.title:
        ColorPrint.red("Error: --title is required.")
        parser.print_help()
        sys.exit(1)

    for title_to_find in args.title:
        if clicker.click_tray_icon(title_to_find):
            sys.exit(0)
    
    ColorPrint.red("Could not find or click any of the specified tray icons.")
    sys.exit(1)

if __name__ == "__main__":
    main()
