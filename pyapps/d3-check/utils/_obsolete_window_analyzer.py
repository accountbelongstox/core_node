#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window Analyzer
Analyzes window interface and extracts UI elements using UI Automation
"""

import os
import sys
import json
import time
from datetime import datetime
from typing import List, Dict, Optional
import win32gui
import win32con
import win32api
import win32process
from PIL import Image, ImageDraw, ImageFont
import pyautogui
import uiautomation as auto

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

from providor.providor_second import DEBUG_DIR
from utils.color_print import ColorPrint


class WindowAnalyzer:
    """Analyzes window interface and extracts UI elements using UI Automation"""
    
    def __init__(self):
        self.debug_dir = DEBUG_DIR
        self.elements = []
        self.window_handle = None
        self.target_window = None
        
    def get_window_by_titles(self, window_titles: List[str]):
        """Get window using win32gui with multiple possible titles"""
        try:
            import win32gui
            found_window = None
            
            def enum_windows_callback(hwnd, lparam):
                nonlocal found_window
                if win32gui.IsWindowVisible(hwnd):
                    window_title = win32gui.GetWindowText(hwnd)
                    for title in window_titles:
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
            
            raise Exception("Window not found with any of the provided titles")
        except Exception as e:
            ColorPrint.red(f"❌ Error getting window: {e}")
            return None
    
    def get_window_info(self, window) -> Dict:
        """Get detailed information about a window"""
        try:
            return {
                'hwnd': window._hWnd,
                'title': window.title,
                'left': window.left,
                'top': window.top,
                'width': window.width,
                'height': window.height,
                'is_active': window.isActive,
                'is_maximized': window.isMaximized,
                'is_minimized': window.isMinimized
            }
        except Exception as e:
            ColorPrint.yellow(f"⚠️  Error getting window info: {e}")
            return {}
    
    def enumerate_controls_ui_automation(self, window) -> List[Dict]:
        """Enumerate all controls using UI Automation"""
        controls = []
        
        try:
            # Get UI Automation control from window handle
            window_handle = int(window._hWnd)
            self.target_window = auto.ControlFromHandle(window_handle)
            
            if not self.target_window.Exists():
                raise Exception("Cannot get window UI Automation controls")
            
            ColorPrint.green("🔍 Enumerating UI Automation controls...")
            
            # Recursively traverse all child controls
            def walk_controls(control, parent_id=None, level=0):
                control_id = len(controls)
                
                # Try to get visibility status
                try:
                    is_visible = control.IsVisible()
                except (AttributeError, Exception):
                    is_visible = None
                
                # Try to get enabled status
                try:
                    is_enabled = control.IsEnabled
                except (AttributeError, Exception):
                    is_enabled = None
                
                # Try to get value
                try:
                    value = control.CurrentValue
                except (AttributeError, Exception):
                    value = None
                
                # Try to get help text
                try:
                    help_text = control.CurrentHelpText
                except (AttributeError, Exception):
                    help_text = None
                
                # Try to get pattern support
                try:
                    patterns = []
                    for pattern in control.GetSupportedPatterns():
                        patterns.append(pattern.ProgrammaticName)
                except (AttributeError, Exception):
                    patterns = []
                
                control_info = {
                    "id": control_id,
                    "parent_id": parent_id,
                    "type": control.ControlTypeName,
                    "name": control.Name,
                    "automation_id": control.AutomationId,
                    "class_name": control.ClassName,
                    "value": value,
                    "help_text": help_text,
                    "patterns": patterns,
                    "rect": {
                        "left": control.BoundingRectangle.left,
                        "top": control.BoundingRectangle.top,
                        "right": control.BoundingRectangle.right,
                        "bottom": control.BoundingRectangle.bottom,
                        "width": control.BoundingRectangle.width(),
                        "height": control.BoundingRectangle.height()
                    },
                    "is_enabled": is_enabled,
                    "is_visible": is_visible,
                    "level": level
                }
                controls.append(control_info)
                
                # Traverse child controls
                try:
                    for child in control.GetChildren():
                        walk_controls(child, control_id, level + 1)
                except Exception as e:
                    ColorPrint.yellow(f"⚠️  Error traversing child controls: {e}")
            
            walk_controls(self.target_window)
            ColorPrint.green(f"✅ Found {len(controls)} UI Automation controls")
            
        except Exception as e:
            ColorPrint.red(f"❌ Error enumerating UI Automation controls: {e}")
        
        return controls
    
    def enumerate_child_windows_legacy(self, parent_hwnd: int) -> List[Dict]:
        """Enumerate all child windows using legacy Win32 API"""
        child_windows = []
        
        def enum_child_windows_callback(hwnd, lparam):
            try:
                if win32gui.IsWindowVisible(hwnd):
                    window_info = self.get_legacy_window_info(hwnd)
                    if window_info:
                        child_windows.append(window_info)
            except Exception as e:
                ColorPrint.yellow(f"⚠️  Error enumerating child window: {e}")
            return True
        
        try:
            win32gui.EnumChildWindows(parent_hwnd, enum_child_windows_callback, None)
        except Exception as e:
            ColorPrint.yellow(f"⚠️  Error enumerating child windows: {e}")
        
        return child_windows
    
    def get_legacy_window_info(self, hwnd: int) -> Dict:
        """Get detailed information about a window using Win32 API"""
        try:
            rect = win32gui.GetWindowRect(hwnd)
            client_rect = win32gui.GetClientRect(hwnd)
            title = win32gui.GetWindowText(hwnd)
            class_name = win32gui.GetClassName(hwnd)
            
            # Get process info
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
            
            return {
                'hwnd': hwnd,
                'title': title,
                'class_name': class_name,
                'pid': pid,
                'rect': rect,
                'client_rect': client_rect,
                'width': rect[2] - rect[0],
                'height': rect[3] - rect[1],
                'client_width': client_rect[2] - client_rect[0],
                'client_height': client_rect[3] - client_rect[1]
            }
        except Exception as e:
            ColorPrint.yellow(f"⚠️  Error getting legacy window info: {e}")
            return {}
    
    def take_screenshot(self, window, output_path: str) -> bool:
        """Take a screenshot of the specified window"""
        try:
            # Activate window
            window.activate()
            time.sleep(1)  # Wait for window activation
            
            # Get window position and size
            left, top, width, height = window.left, window.top, window.width, window.height
            
            # Take screenshot
            screenshot = pyautogui.screenshot(region=(left, top, width, height))
            screenshot.save(output_path)
            
            ColorPrint.green(f"📸 Screenshot saved to: {output_path}")
            return True
            
        except Exception as e:
            ColorPrint.red(f"❌ Error taking screenshot: {e}")
            return False
    
    def draw_element_numbers(self, image_path: str, controls: List[Dict], output_path: str, window):
        """Draw element numbers on the screenshot"""
        try:
            # Load image
            img = Image.open(image_path)
            draw = ImageDraw.Draw(img)
            
            try:
                font = ImageFont.truetype("arial.ttf", 12)
            except:
                font = ImageFont.load_default()
            
            # Get window position
            if not window:
                ColorPrint.red("❌ Cannot get window for annotation")
                return
            
            window_left, window_top = window.left, window.top
            
            # Annotate each control
            for control in controls:
                rect = control.get('rect', {})
                if not rect or rect.get('width', 0) == 0 or rect.get('height', 0) == 0:
                    continue
                
                # Calculate coordinates relative to window
                left = rect['left'] - window_left
                top = rect['top'] - window_top
                right = rect['right'] - window_left
                bottom = rect['bottom'] - window_top
                
                # Skip if coordinates are outside image bounds
                if left < 0 or top < 0 or right > img.width or bottom > img.height:
                    continue
                
                # Draw rectangle
                draw.rectangle([left, top, right, bottom], outline="red", width=1)
                
                # Draw ID text
                text = str(control['id'])
                try:
                    # For newer PIL versions
                    bbox = font.getbbox(text)
                    text_width = bbox[2] - bbox[0]
                    text_height = bbox[3] - bbox[1]
                except AttributeError:
                    # Fallback for older PIL versions
                    text_width, text_height = draw.textsize(text, font=font)
                
                text_x = left + (right - left - text_width) / 2
                text_y = top + (bottom - top - text_height) / 2
                
                # Add text background
                draw.rectangle(
                    [text_x - 2, text_y - 2, text_x + text_width + 2, text_y + text_height + 2],
                    fill="white"
                )
                draw.text((text_x, text_y), text, fill="red", font=font)
            
            # Save annotated image
            img.save(output_path)
            ColorPrint.green(f"🎨 Annotated screenshot saved to: {output_path}")
            
        except Exception as e:
            ColorPrint.red(f"❌ Error drawing element numbers: {e}")
    
    def create_timestamp_dir(self) -> str:
        """Create a timestamped directory in .debug folder"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = os.path.join(self.debug_dir, f"window_analysis_{timestamp}")
        
        try:
            os.makedirs(output_dir, exist_ok=True)
            ColorPrint.green(f"📁 Created output directory: {output_dir}")
            return output_dir
        except Exception as e:
            ColorPrint.red(f"❌ Error creating output directory: {e}")
            return self.debug_dir
    
    def analyze_window(self, window_titles: List[str], program_name: str = "Unknown") -> Dict:
        """Analyze window and generate screenshots, position info, and JSON"""
        ColorPrint.yellow(f"🔍 Analyzing window: {program_name}")
        
        # Get window
        window = self.get_window_by_titles(window_titles)
        if not window:
            ColorPrint.red("❌ Window not found")
            return {"success": False, "error": "Window not found"}
        
        # Create output directory
        output_dir = self.create_timestamp_dir()
        
        # Get window info
        window_info = self.get_window_info(window)
        
        # Take screenshot
        screenshot_path = os.path.join(output_dir, f"{program_name}_screenshot.png")
        if not self.take_screenshot(window, screenshot_path):
            ColorPrint.red("❌ Failed to take screenshot")
            return {"success": False, "error": "Failed to take screenshot"}
        
        # Enumerate controls
        controls = self.enumerate_controls_ui_automation(window)
        
        # Draw element numbers on screenshot
        annotated_path = os.path.join(output_dir, f"{program_name}_annotated.png")
        self.draw_element_numbers(screenshot_path, controls, annotated_path, window)
        
        # Generate JSON data
        analysis_data = {
            "timestamp": datetime.now().isoformat(),
            "program_name": program_name,
            "window_info": window_info,
            "controls": controls,
            "files": {
                "screenshot": screenshot_path,
                "annotated_screenshot": annotated_path
            }
        }
        
        # Save JSON
        json_path = os.path.join(output_dir, f"{program_name}_analysis.json")
        try:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(analysis_data, f, indent=2, ensure_ascii=False)
            ColorPrint.green(f"📄 JSON data saved to: {json_path}")
        except Exception as e:
            ColorPrint.red(f"❌ Error saving JSON: {e}")
            return {"success": False, "error": f"Failed to save JSON: {e}"}
        
        analysis_data["files"]["json"] = json_path
        analysis_data["success"] = True
        
        ColorPrint.green(f"✅ Window analysis completed for {program_name}")
        return analysis_data


def main():
    """Main function for testing"""
    analyzer = WindowAnalyzer()
    print("WindowAnalyzer initialized successfully")


if __name__ == "__main__":
    main() 