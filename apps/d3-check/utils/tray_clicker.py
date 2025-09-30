#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
System Tray Icon Clicker - Utility Class
"""

import time
import os
import win32api
import win32con
from pywinauto import Desktop


class TrayIconClicker:
    """System tray icon clicker utility class"""
    
    def __init__(self):
        """Initialize the tray icon clicker"""
        self.desktop = None
        
    def _custom_double_click(self, x, y):
        """Custom double-click function using win32api to avoid tuple errors"""
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
        """Get desktop object with error handling"""
        if self.desktop is None:
            try:
                self.desktop = Desktop(backend="uia")
            except Exception as e:
                print(f"Error creating desktop object: {e}")
                return None
        return self.desktop
    
    def print_tray_info(self):
        """Print all system tray icons information"""
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
        """Print detailed information about tray icons"""
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
        """Normalize keyword for searching - handle paths, exe files, etc."""
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
        """Click on system tray icon that contains the specified keyword"""
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