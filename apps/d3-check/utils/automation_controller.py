#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Automation Controller
Handles automated operations on UI elements based on operation IDs
"""

import time
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import win32gui
import win32con
import win32api
from utils.color_print import ColorPrint


class AutomationController:
    """Controls automated operations on UI elements"""
    
    def __init__(self):
        """Initialize automation controller"""
        self.operation_delay = 1.0  # Default delay between operations
        ColorPrint.green("✅ AutomationController initialized")
    
    def execute_operations(self, window_title: str, operation_ids: List[str], 
                          ui_elements: List[Dict] = None, json_path: str = None) -> Dict:
        """
        Execute automated operations based on operation IDs
        
        Args:
            window_title: Title of target window
            operation_ids: List of operation IDs to execute
            ui_elements: UI elements data (optional)
            json_path: Path to UI elements JSON file (optional)
            
        Returns:
            Dictionary with execution results
        """
        try:
            if not operation_ids:
                ColorPrint.yellow("⚠️  No operation IDs provided")
                return {"success": True, "message": "No operations to execute"}
            
            # Find target window
            hwnd = win32gui.FindWindow(None, window_title)
            if not hwnd:
                hwnd = self._find_window_by_partial_title(window_title)
            
            if not hwnd:
                ColorPrint.red(f"❌ Target window not found: {window_title}")
                return {
                    "success": False,
                    "error": f"Target window not found: {window_title}"
                }
            
            # Load UI elements if not provided
            if not ui_elements and json_path:
                ui_elements = self._load_ui_elements_from_json(json_path)
            
            if not ui_elements:
                ColorPrint.yellow("⚠️  No UI elements data available")
                return {
                    "success": False,
                    "error": "No UI elements data available for automation"
                }
            
            ColorPrint.blue(f"🤖 Starting automation on: {window_title}")
            ColorPrint.blue(f"🎯 Operations to execute: {operation_ids}")
            
            # Bring window to foreground
            self._bring_window_to_foreground(hwnd)
            
            executed_operations = []
            failed_operations = []
            
            # Execute each operation
            for op_id in operation_ids:
                try:
                    ColorPrint.blue(f"🔄 Executing operation: {op_id}")
                    
                    # Parse operation ID and execute
                    result = self._execute_single_operation(hwnd, op_id, ui_elements)
                    
                    if result["success"]:
                        executed_operations.append({
                            "operation_id": op_id,
                            "result": result
                        })
                        ColorPrint.green(f"✅ Operation completed: {op_id}")
                    else:
                        failed_operations.append({
                            "operation_id": op_id,
                            "error": result.get("error", "Unknown error")
                        })
                        ColorPrint.red(f"❌ Operation failed: {op_id} - {result.get('error', 'Unknown error')}")
                    
                    # Delay between operations
                    if self.operation_delay > 0:
                        time.sleep(self.operation_delay)
                        
                except Exception as e:
                    failed_operations.append({
                        "operation_id": op_id,
                        "error": str(e)
                    })
                    ColorPrint.red(f"❌ Operation exception: {op_id} - {e}")
            
            result = {
                "success": len(failed_operations) == 0,
                "total_operations": len(operation_ids),
                "executed_operations": executed_operations,
                "failed_operations": failed_operations,
                "success_count": len(executed_operations),
                "failure_count": len(failed_operations)
            }
            
            ColorPrint.blue(f"📊 Automation completed: {len(executed_operations)}/{len(operation_ids)} successful")
            
            return result
            
        except Exception as e:
            ColorPrint.red(f"❌ Error executing operations: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def _execute_single_operation(self, hwnd: int, operation_id: str, ui_elements: List[Dict]) -> Dict:
        """
        Execute a single operation
        
        Args:
            hwnd: Window handle
            operation_id: Operation ID (format: "action:element_id" or "action:x,y")
            ui_elements: UI elements data
            
        Returns:
            Dictionary with operation result
        """
        try:
            # Parse operation ID
            if ':' not in operation_id:
                return {"success": False, "error": f"Invalid operation format: {operation_id}"}
            
            action, target = operation_id.split(':', 1)
            action = action.lower().strip()
            target = target.strip()
            
            # Determine target coordinates
            if ',' in target:
                # Direct coordinates
                try:
                    x, y = map(int, target.split(','))
                    # Convert to window-relative coordinates
                    window_rect = win32gui.GetWindowRect(hwnd)
                    abs_x = window_rect[0] + x
                    abs_y = window_rect[1] + y
                except ValueError:
                    return {"success": False, "error": f"Invalid coordinates: {target}"}
            else:
                # Element ID
                try:
                    element_id = int(target)
                    element = self._find_element_by_id(ui_elements, element_id)
                    if not element:
                        return {"success": False, "error": f"Element not found: {element_id}"}
                    
                    # Get element center coordinates
                    window_rect = win32gui.GetWindowRect(hwnd)
                    abs_x = window_rect[0] + element['center']['x']
                    abs_y = window_rect[1] + element['center']['y']
                    
                except ValueError:
                    return {"success": False, "error": f"Invalid element ID: {target}"}
            
            # Execute action
            if action == 'click':
                return self._perform_click(abs_x, abs_y)
            elif action == 'double_click':
                return self._perform_double_click(abs_x, abs_y)
            elif action == 'right_click':
                return self._perform_right_click(abs_x, abs_y)
            elif action.startswith('key'):
                # Key press operation (e.g., "key:enter", "key:f7")
                key_name = target.upper()
                return self._perform_key_press(key_name)
            elif action == 'type':
                # Type text operation (e.g., "type:hello world")
                return self._perform_type_text(target)
            else:
                return {"success": False, "error": f"Unknown action: {action}"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _perform_click(self, x: int, y: int) -> Dict:
        """Perform left mouse click"""
        try:
            win32api.SetCursorPos((x, y))
            time.sleep(0.1)
            win32api.mouse_event(win32con.MOUSEEVENTF_LEFTDOWN, x, y, 0, 0)
            win32api.mouse_event(win32con.MOUSEEVENTF_LEFTUP, x, y, 0, 0)
            return {"success": True, "action": "click", "coordinates": (x, y)}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _perform_double_click(self, x: int, y: int) -> Dict:
        """Perform double click"""
        try:
            win32api.SetCursorPos((x, y))
            time.sleep(0.1)
            win32api.mouse_event(win32con.MOUSEEVENTF_LEFTDOWN, x, y, 0, 0)
            win32api.mouse_event(win32con.MOUSEEVENTF_LEFTUP, x, y, 0, 0)
            time.sleep(0.05)
            win32api.mouse_event(win32con.MOUSEEVENTF_LEFTDOWN, x, y, 0, 0)
            win32api.mouse_event(win32con.MOUSEEVENTF_LEFTUP, x, y, 0, 0)
            return {"success": True, "action": "double_click", "coordinates": (x, y)}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _perform_right_click(self, x: int, y: int) -> Dict:
        """Perform right mouse click"""
        try:
            win32api.SetCursorPos((x, y))
            time.sleep(0.1)
            win32api.mouse_event(win32con.MOUSEEVENTF_RIGHTDOWN, x, y, 0, 0)
            win32api.mouse_event(win32con.MOUSEEVENTF_RIGHTUP, x, y, 0, 0)
            return {"success": True, "action": "right_click", "coordinates": (x, y)}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _perform_key_press(self, key_name: str) -> Dict:
        """Perform key press"""
        try:
            # Map key names to virtual key codes
            key_map = {
                'ENTER': win32con.VK_RETURN,
                'SPACE': win32con.VK_SPACE,
                'TAB': win32con.VK_TAB,
                'ESC': win32con.VK_ESCAPE,
                'F1': win32con.VK_F1,
                'F2': win32con.VK_F2,
                'F3': win32con.VK_F3,
                'F4': win32con.VK_F4,
                'F5': win32con.VK_F5,
                'F6': win32con.VK_F6,
                'F7': win32con.VK_F7,
                'F8': win32con.VK_F8,
                'F9': win32con.VK_F9,
                'F10': win32con.VK_F10,
                'F11': win32con.VK_F11,
                'F12': win32con.VK_F12,
            }
            
            if key_name in key_map:
                vk_code = key_map[key_name]
                win32api.keybd_event(vk_code, 0, 0, 0)
                time.sleep(0.05)
                win32api.keybd_event(vk_code, 0, win32con.KEYEVENTF_KEYUP, 0)
                return {"success": True, "action": "key_press", "key": key_name}
            else:
                return {"success": False, "error": f"Unknown key: {key_name}"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _perform_type_text(self, text: str) -> Dict:
        """Type text"""
        try:
            for char in text:
                if char == ' ':
                    win32api.keybd_event(win32con.VK_SPACE, 0, 0, 0)
                    win32api.keybd_event(win32con.VK_SPACE, 0, win32con.KEYEVENTF_KEYUP, 0)
                else:
                    # Convert character to virtual key code
                    vk_code = win32api.VkKeyScan(char)
                    if vk_code != -1:
                        win32api.keybd_event(vk_code & 0xFF, 0, 0, 0)
                        win32api.keybd_event(vk_code & 0xFF, 0, win32con.KEYEVENTF_KEYUP, 0)
                time.sleep(0.05)
            
            return {"success": True, "action": "type_text", "text": text}
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    def _find_window_by_partial_title(self, partial_title: str) -> Optional[int]:
        """Find window by partial title match"""
        found_hwnd = None
        
        def enum_windows_callback(hwnd, lparam):
            nonlocal found_hwnd
            if win32gui.IsWindowVisible(hwnd):
                window_title = win32gui.GetWindowText(hwnd)
                if window_title and partial_title.lower() in window_title.lower():
                    found_hwnd = hwnd
                    return False
            return True
        
        win32gui.EnumWindows(enum_windows_callback, None)
        return found_hwnd
    
    def _bring_window_to_foreground(self, hwnd: int):
        """Bring window to foreground"""
        try:
            win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
            win32gui.SetForegroundWindow(hwnd)
            time.sleep(0.5)
        except Exception as e:
            ColorPrint.yellow(f"⚠️  Could not bring window to foreground: {e}")
    
    def _find_element_by_id(self, ui_elements: List[Dict], element_id: int) -> Optional[Dict]:
        """Find UI element by ID"""
        for element in ui_elements:
            if element.get('id') == element_id:
                return element
        return None
    
    def _load_ui_elements_from_json(self, json_path: str) -> List[Dict]:
        """Load UI elements from JSON file"""
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('elements', [])
        except Exception as e:
            ColorPrint.red(f"❌ Error loading UI elements JSON: {e}")
            return []
    
    def set_operation_delay(self, delay: float):
        """Set delay between operations"""
        self.operation_delay = delay
        ColorPrint.blue(f"⏱️  Operation delay set to: {delay} seconds")
