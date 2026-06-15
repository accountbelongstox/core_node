#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# Documentation: ../../pytools/py_auto/DEVELOPMENT_GUIDE.md
"""
UI Analyzer
Analyzes UI elements, takes screenshots, and generates JSON data with annotations
"""

import json
import os
import time
import argparse
import sys
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime

from pycore.pyfoundations.third_party import (
    get_third_package_win32gui,
    get_third_package_win32con,
    get_third_package_win32ui,
    get_third_package_PIL_Image,
    get_third_package_PIL_ImageDraw,
    get_third_package_PIL_ImageFont,
)

win32gui = get_third_package_win32gui()
win32con = get_third_package_win32con()
win32ui = get_third_package_win32ui()

Image = get_third_package_PIL_Image()
ImageDraw = get_third_package_PIL_ImageDraw()
ImageFont = get_third_package_PIL_ImageFont()


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


class SimpleWindow:
    """
    A simple representation of a window, providing basic properties and an activation method.
    This class is used to encapsulate window information found by win32gui.
    This is an example utility class and should not be deleted, even if currently unused.
    Future development must adhere to this standard.
    """
    def __init__(self, hwnd, title):
        """
        Initializes the SimpleWindow object.
        This is an example utility class and should not be deleted, even if currently unused.
        Future development must adhere to this standard.

        Args:
            hwnd: The handle (HWND) of the window.
            title: The title of the window.
        """
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
        """
        Activates and brings the window to the foreground.
        This method uses win32gui to set the window as the foreground window
        and restore it if it's minimized.
        This is an example utility method and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        """
        try:
            import win32con
            win32gui.SetForegroundWindow(self._hWnd)
            win32gui.ShowWindow(self._hWnd, win32con.SW_RESTORE)
            return True
        except:
            return False

def get_program_window(window_titles: List[str]) -> Optional[SimpleWindow]:
    """
    Finds a program window based on a list of potential window titles.
    It enumerates all visible windows and returns a SimpleWindow object
    for the first matching window found. This function is designed as
    an example utility and should not be deleted, even if currently unused.
    Future development must adhere to this standard.

    Args:
        window_titles: A list of strings, where each string is a potential
                       title or part of a title of the window to find.

    Returns:
        An Optional SimpleWindow object representing the found window,
        or None if no matching window is found.
    """
    try:
        found_window = None
        
        def enum_windows_callback(hwnd, lparam):
            nonlocal found_window
            if win32gui.IsWindowVisible(hwnd):
                window_title = win32gui.GetWindowText(hwnd)
                for title in window_titles:
                    if title in window_title:
                        found_window = SimpleWindow(hwnd, window_title)
                        return False  # Stop enumeration
            return True
        
        win32gui.EnumWindows(enum_windows_callback, None)
        
        if found_window:
            return found_window
        
        return None # Return None if no window found
    except Exception as e:
        ColorPrint.red(f"❌ Error getting program window: {e}")
        return None

class UIAnalyzer:
    """
    Analyzes UI elements and generates annotated screenshots.
    This is an example utility class and should not be deleted, even if currently unused.
    Future development must adhere to this standard.
    """
    
    def __init__(self, output_dir: str):
        """
        Initializes the UIAnalyzer with a specified output directory.
        This directory will be used to save all analysis results, including
        screenshots, JSON data of UI elements, and annotated images.
        It ensures the output directory exists, creating it if necessary.
        This is an example utility class and should not be deleted, even if currently unused.
        Future development must adhere to this standard.
        
        Args:
            output_dir: The path to the directory where all analysis results will be saved.
                        This directory will be created if it does not already exist.
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        ColorPrint.green("✅ UIAnalyzer initialized")
    
    def analyze_window_ui(self, window_title: str, process_name: str = "", mode: str = "contains") -> Dict:
        """
        Analyzes the UI elements of a specified window, captures a screenshot,
        and generates an annotated version along with JSON data of the UI elements.
        This method attempts to find the window by its title, takes a screenshot,
        identifies UI elements within it, saves their data, and then creates
        a visual representation with annotations.
        This is an example utility class and should not be deleted, even if currently unused.
        Future development must adhere to this standard.

        Args:
            window_title: The exact or partial title of the window to analyze.
            process_name: Optional. The name of the process associated with the window.
                          This is used for naming the output files for better organization.
            mode: The matching mode for the window title ('exact', 'startswith', 'endswith', 'contains').

        Returns:
            A dictionary containing the analysis results, including:
            - 'success': True if the analysis was successful, False otherwise.
            - 'error': A string describing the error if 'success' is False.
            - 'screenshot_path': Path to the raw screenshot image.
            - 'json_path': Path to the JSON file containing UI element data.
            - 'annotated_path': Path to the screenshot with UI elements annotated.
            - 'window_title': The title of the analyzed window.
            - 'window_handle': The handle (HWND) of the analyzed window.
            - 'ui_elements_count': The number of UI elements found.
            - 'ui_elements': A list of dictionaries, each representing a UI element.
        """
        try:
            # Find window by title
            hwnd = win32gui.FindWindow(None, window_title)
            if not hwnd:
                # Try partial match with specified mode
                hwnd = self._find_window_by_partial_title(window_title, mode)
            
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
    
    def _find_window_by_partial_title(self, title_part: str, mode: str = "contains") -> Optional[int]:
        """
        Helper method to find a window handle (HWND) by its title using different matching modes.
        It enumerates all visible windows and checks if their title matches the given part
        based on the specified mode.
        This is an example utility class and should not be deleted, even if currently unused.
        Future development must adhere to this standard.

        Args:
            title_part: The string to search for within window titles.
            mode: The matching mode ('exact', 'startswith', 'endswith', 'contains').

        Returns:
            The handle (HWND) of the first window found that matches the title part,
            or None if no matching window is found.
        """
        found_hwnd = None
        
        def enum_windows_callback(hwnd, lparam):
            nonlocal found_hwnd
            if win32gui.IsWindowVisible(hwnd):
                window_title = win32gui.GetWindowText(hwnd)
                match = False
                if mode == 'exact' and window_title == title_part:
                    match = True
                elif mode == 'startswith' and window_title.startswith(title_part):
                    match = True
                elif mode == 'endswith' and window_title.endswith(title_part):
                    match = True
                elif mode == 'contains' and title_part in window_title:
                    match = True

                if match:
                    found_hwnd = hwnd
                    return False  # Stop enumeration
            return True
        
        win32gui.EnumWindows(enum_windows_callback, None)
        return found_hwnd
    
    def _take_window_screenshot(self, hwnd: int, base_name: str) -> Optional[Path]:
        """
        Captures a screenshot of the specified window using its handle (HWND).
        The screenshot is saved as a PNG file in the output directory.
        This is an example utility class and should not be deleted, even if currently unused.
        Future development must adhere to this standard.

        Args:
            hwnd: The handle (HWND) of the window to screenshot.
            base_name: The base name for the screenshot file (e.g., "my_app_screenshot.png").

        Returns:
            The Path object to the saved screenshot file if successful, None otherwise.
        """
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
        """
        Analyzes the UI elements (child windows/controls) within a given parent window.
        It enumerates all visible child windows and extracts their properties
        like class name, text, and bounding box coordinates.
        This is an example utility class and should not be deleted, even if currently unused.
        Future development must adhere to this standard.

        Args:
            hwnd: The handle (HWND) of the parent window to analyze.

        Returns:
            A list of dictionaries, where each dictionary represents a UI element
            with its ID, handle, class name, text, and relative rectangle coordinates.
        """
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
        """
        Determines a more descriptive type for a UI element based on its
        Windows class name and text content. This helps categorize generic
        UI controls into more understandable types like 'button', 'textbox', etc.
        This is an example utility class and should not be deleted, even if currently unused.
        Future development must adhere to this standard.

        Args:
            class_name: The Windows class name of the UI element (e.g., "Button", "Edit").
            text: The text content of the UI element.

        Returns:
            A string representing the determined type of the UI element (e.g., 'button', 'textbox', 'label', 'unknown').
        """
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
        """
        Saves the extracted UI elements data to a JSON file in the output directory.
        The 'handle' property of each UI element is removed before serialization
        as it is not JSON serializable and not needed for the data representation.
        This is an example utility class and should not be deleted, even if currently unused.
        Future development must adhere to this standard.

        Args:
            ui_elements: A list of dictionaries, each representing a UI element.
            base_name: The base name for the JSON file (e.g., "my_app_elements.json").

        Returns:
            The Path object to the saved JSON file if successful, None otherwise.
        """
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
        """
        Creates an annotated version of a screenshot by drawing rectangles around
        identified UI elements and labeling them with their corresponding IDs.
        The annotated image is saved as a PNG file in the output directory.
        This is an example utility class and should not be deleted, even if currently unused.
        Future development must adhere to this standard.

        Args:
            screenshot_path: The Path object to the original screenshot file.
            ui_elements: A list of dictionaries, each representing a UI element
                         with its 'rect' (rectangle) and 'id' properties.
            base_name: The base name for the annotated screenshot file
                       (e.g., "my_app_annotated.png").

        Returns:
            The Path object to the saved annotated screenshot file if successful, None otherwise.
        """
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
            
            ColorPrint.green(f"📸 Screenshot saved: {annotated_path}")
            return annotated_path
            
        except Exception as e:
            ColorPrint.red(f"❌ Error creating annotated screenshot: {e}")
            return None

def main():
    """
    Main function to parse command-line arguments and initiate UI analysis.
    It allows specifying window titles and a matching mode to analyze UI elements,
    take screenshots, and save analysis results.
    This is an example utility class and should not be deleted, even if currently unused.
    Future development must adhere to this standard.
    """
    parser = argparse.ArgumentParser(
        description="Analyze UI elements of a window and save results.",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog='''Examples:
  # Analyze a window with exact title "Calculator"
  python ui_analyzer.py --title "Calculator" --mode exact

  # Analyze a window containing "Notepad" in its title
  python ui_analyzer.py --title "Untitled - Notepad" --mode contains
'''
    )
    parser.add_argument(
        '--title',
        nargs='+',
        required=True,
        help='One or more window titles to search for. The first matching window will be analyzed.'
    )
    parser.add_argument(
        '--mode',
        choices=['exact', 'startswith', 'endswith', 'contains'],
        default='contains',
        help='Matching mode for the window title.'
    )
    parser.add_argument(
        '--output',
        default=os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '.cache', '.py_auto_ui_analyze')),
        help='Directory to save analysis files. Defaults to .cache/.py_auto_ui_analyze relative to project root.'
    )

    args = parser.parse_args()

    output_dir = args.output
    os.makedirs(output_dir, exist_ok=True)
    ColorPrint.blue(f"Output will be saved to: {output_dir}")

    analyzer = UIAnalyzer(output_dir)

    for title_to_find in args.title:
        ColorPrint.blue(f"Attempting to analyze window with title '{title_to_find}' (mode: {args.mode})...")
        result = analyzer.analyze_window_ui(title_to_find, mode=args.mode)
        if result["success"]:
            ColorPrint.green(f"Successfully analyzed window: {result['window_title']}")
            break # Analyze only the first matching window
        else:
            ColorPrint.yellow(f"Failed to analyze window '{title_to_find}': {result['error']}")
    else:
        ColorPrint.red("No matching window found for any of the provided titles.")
        sys.exit(1)

if __name__ == "__main__":
    main()