#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI Analyzer
Analyzes UI elements, takes screenshots, and generates JSON data with annotations
"""

import json
import os
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
import win32gui
import win32con
import win32ui
from PIL import Image, ImageDraw, ImageFont
from utils.color_print import ColorPrint


class UIAnalyzer:
    """Analyzes UI elements and generates annotated screenshots"""
    
    def __init__(self, output_dir: str):
        """
        Initialize UI analyzer
        
        Args:
            output_dir: Directory to save analysis results
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        ColorPrint.green("✅ UIAnalyzer initialized")
    
    def analyze_window_ui(self, window_title: str, process_name: str = "") -> Dict:
        """
        Analyze UI elements of a window and generate annotated screenshot
        
        Args:
            window_title: Title of window to analyze
            process_name: Name of process (for filename)
            
        Returns:
            Dictionary with analysis results
        """
        try:
            # Find window by title
            hwnd = win32gui.FindWindow(None, window_title)
            if not hwnd:
                # Try partial match
                hwnd = self._find_window_by_partial_title(window_title)
            
            if not hwnd:
                ColorPrint.yellow(f"⚠️  Window not found: {window_title}")
                return {
                    "success": False,
                    "error": f"Window not found: {window_title}",
                    "screenshot_path": None,
                    "json_path": None,
                    "annotated_path": None
                }
            
            ColorPrint.blue(f"🔍 Analyzing window: {window_title}")
            
            # Generate timestamp-based filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            base_name = f"{process_name}_{timestamp}" if process_name else f"window_{timestamp}"
            
            # Take screenshot
            screenshot_path = self._take_window_screenshot(hwnd, base_name)
            if not screenshot_path:
                return {
                    "success": False,
                    "error": "Failed to take screenshot",
                    "screenshot_path": None,
                    "json_path": None,
                    "annotated_path": None
                }
            
            # Analyze UI elements
            ui_elements = self._analyze_ui_elements(hwnd)
            
            # Save JSON data
            json_path = self._save_ui_elements_json(ui_elements, base_name)
            
            # Create annotated screenshot
            annotated_path = self._create_annotated_screenshot(screenshot_path, ui_elements, base_name)
            
            result = {
                "success": True,
                "window_title": window_title,
                "window_handle": hwnd,
                "screenshot_path": str(screenshot_path),
                "json_path": str(json_path),
                "annotated_path": str(annotated_path),
                "ui_elements_count": len(ui_elements),
                "ui_elements": ui_elements
            }
            
            ColorPrint.green(f"✅ UI analysis completed for: {window_title}")
            ColorPrint.blue(f"📸 Screenshot: {screenshot_path}")
            ColorPrint.blue(f"📄 JSON data: {json_path}")
            ColorPrint.blue(f"🎨 Annotated: {annotated_path}")
            ColorPrint.blue(f"🔢 UI elements found: {len(ui_elements)}")
            
            return result
            
        except Exception as e:
            ColorPrint.red(f"❌ Error analyzing UI: {e}")
            return {
                "success": False,
                "error": str(e),
                "screenshot_path": None,
                "json_path": None,
                "annotated_path": None
            }
    
    def _find_window_by_partial_title(self, partial_title: str) -> Optional[int]:
        """Find window by partial title match"""
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
        return found_hwnd
    
    def _take_window_screenshot(self, hwnd: int, base_name: str) -> Optional[Path]:
        """Take screenshot of window"""
        try:
            # Get window rectangle
            left, top, right, bottom = win32gui.GetWindowRect(hwnd)
            width = right - left
            height = bottom - top
            
            # Create device context
            hwndDC = win32gui.GetWindowDC(hwnd)
            mfcDC = win32ui.CreateDCFromHandle(hwndDC)
            saveDC = mfcDC.CreateCompatibleDC()
            
            # Create bitmap
            saveBitMap = win32ui.CreateBitmap()
            saveBitMap.CreateCompatibleBitmap(mfcDC, width, height)
            saveDC.SelectObject(saveBitMap)
            
            # Copy window content
            result = saveDC.BitBlt((0, 0), (width, height), mfcDC, (0, 0), win32con.SRCCOPY)
            
            # Save to file
            screenshot_path = self.output_dir / f"{base_name}_screenshot.png"
            saveBitMap.SaveBitmapFile(saveDC, str(screenshot_path))
            
            # Cleanup
            win32gui.DeleteObject(saveBitMap.GetHandle())
            saveDC.DeleteDC()
            mfcDC.DeleteDC()
            win32gui.ReleaseDC(hwnd, hwndDC)
            
            if result:
                ColorPrint.green(f"📸 Screenshot saved: {screenshot_path}")
                return screenshot_path
            else:
                ColorPrint.red("❌ Failed to capture window content")
                return None
                
        except Exception as e:
            ColorPrint.red(f"❌ Error taking screenshot: {e}")
            return None
    
    def _analyze_ui_elements(self, hwnd: int) -> List[Dict]:
        """Analyze UI elements in window"""
        ui_elements = []
        element_id = 1
        
        def enum_child_windows_callback(child_hwnd, lparam):
            nonlocal element_id
            try:
                if win32gui.IsWindowVisible(child_hwnd):
                    # Get element properties
                    class_name = win32gui.GetClassName(child_hwnd)
                    window_text = win32gui.GetWindowText(child_hwnd)
                    rect = win32gui.GetWindowRect(child_hwnd)
                    
                    # Convert to relative coordinates
                    parent_rect = win32gui.GetWindowRect(hwnd)
                    rel_left = rect[0] - parent_rect[0]
                    rel_top = rect[1] - parent_rect[1]
                    rel_right = rect[2] - parent_rect[0]
                    rel_bottom = rect[3] - parent_rect[1]
                    
                    element = {
                        "id": element_id,
                        "handle": child_hwnd,
                        "class_name": class_name,
                        "text": window_text,
                        "rect": {
                            "left": rel_left,
                            "top": rel_top,
                            "right": rel_right,
                            "bottom": rel_bottom,
                            "width": rel_right - rel_left,
                            "height": rel_bottom - rel_top
                        },
                        "center": {
                            "x": rel_left + (rel_right - rel_left) // 2,
                            "y": rel_top + (rel_bottom - rel_top) // 2
                        },
                        "type": self._determine_element_type(class_name, window_text)
                    }
                    
                    ui_elements.append(element)
                    element_id += 1
                    
            except Exception as e:
                ColorPrint.yellow(f"⚠️  Error analyzing child window: {e}")
            
            return True
        
        try:
            win32gui.EnumChildWindows(hwnd, enum_child_windows_callback, None)
        except Exception as e:
            ColorPrint.yellow(f"⚠️  Error enumerating child windows: {e}")
        
        return ui_elements
    
    def _determine_element_type(self, class_name: str, text: str) -> str:
        """Determine UI element type based on class name and text"""
        class_name_lower = class_name.lower()
        
        if 'button' in class_name_lower:
            return 'button'
        elif 'edit' in class_name_lower:
            return 'textbox'
        elif 'static' in class_name_lower:
            return 'label'
        elif 'listbox' in class_name_lower:
            return 'listbox'
        elif 'combobox' in class_name_lower:
            return 'combobox'
        elif 'scrollbar' in class_name_lower:
            return 'scrollbar'
        elif text and len(text.strip()) > 0:
            return 'text_element'
        else:
            return 'unknown'
    
    def _save_ui_elements_json(self, ui_elements: List[Dict], base_name: str) -> Path:
        """Save UI elements data to JSON file"""
        try:
            json_path = self.output_dir / f"{base_name}_ui_elements.json"
            
            # Prepare JSON data (remove non-serializable handle)
            json_data = []
            for element in ui_elements:
                element_copy = element.copy()
                element_copy.pop('handle', None)  # Remove handle as it's not JSON serializable
                json_data.append(element_copy)
            
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump({
                    "timestamp": datetime.now().isoformat(),
                    "total_elements": len(json_data),
                    "elements": json_data
                }, f, indent=2, ensure_ascii=False)
            
            ColorPrint.green(f"📄 JSON data saved: {json_path}")
            return json_path
            
        except Exception as e:
            ColorPrint.red(f"❌ Error saving JSON: {e}")
            return None
    
    def _create_annotated_screenshot(self, screenshot_path: Path, ui_elements: List[Dict], base_name: str) -> Optional[Path]:
        """Create annotated screenshot with element IDs"""
        try:
            # Open screenshot
            image = Image.open(screenshot_path)
            draw = ImageDraw.Draw(image)
            
            # Try to load a font
            try:
                font = ImageFont.truetype("arial.ttf", 12)
            except:
                font = ImageFont.load_default()
            
            # Draw annotations
            for element in ui_elements:
                rect = element['rect']
                element_id = element['id']
                
                # Draw rectangle around element
                draw.rectangle([
                    rect['left'], rect['top'],
                    rect['right'], rect['bottom']
                ], outline='red', width=2)
                
                # Draw element ID
                center = element['center']
                text_bbox = draw.textbbox((0, 0), str(element_id), font=font)
                text_width = text_bbox[2] - text_bbox[0]
                text_height = text_bbox[3] - text_bbox[1]
                
                # Draw background for text
                draw.rectangle([
                    center['x'] - text_width//2 - 2,
                    center['y'] - text_height//2 - 2,
                    center['x'] + text_width//2 + 2,
                    center['y'] + text_height//2 + 2
                ], fill='yellow', outline='red')
                
                # Draw text
                draw.text((center['x'] - text_width//2, center['y'] - text_height//2),
                         str(element_id), fill='black', font=font)
            
            # Save annotated image
            annotated_path = self.output_dir / f"{base_name}_annotated.png"
            image.save(annotated_path)
            
            ColorPrint.green(f"🎨 Annotated screenshot saved: {annotated_path}")
            return annotated_path
            
        except Exception as e:
            ColorPrint.red(f"❌ Error creating annotated screenshot: {e}")
            return None
