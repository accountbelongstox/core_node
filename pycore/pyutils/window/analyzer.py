#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window Analyzer
Analyzes window interface and extracts UI elements using UI Automation
"""

import json
import os
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.pygvar import PYTOOLS_TMP_DIR
from pycore.pyfoundations.third_party.api import (
    get_third_package_PIL_Image,
    get_third_package_PIL_ImageDraw,
    get_third_package_PIL_ImageFont,
    get_third_package_pyautogui,
    get_third_package_uiautomation,
    get_third_package_win32api,
    get_third_package_win32con,
    get_third_package_win32gui,
    get_third_package_win32process,
)

win32gui = get_third_package_win32gui()
win32con = get_third_package_win32con()
win32api = get_third_package_win32api()
win32process = get_third_package_win32process()
Image = get_third_package_PIL_Image()
ImageDraw = get_third_package_PIL_ImageDraw()
ImageFont = get_third_package_PIL_ImageFont()
pyautogui = get_third_package_pyautogui()
auto = get_third_package_uiautomation()

WINDOW_CACHE_KEY_PREFIX = "window_cache_"
ANNOTATION_FONT_FILE = "arial.ttf"
ANNOTATION_FONT_SIZE = 12
WINDOW_ACTIVATION_WAIT_SECONDS = 1


def _win32_error() -> type:
    return win32gui.error if win32gui is not None else OSError


class AnalyzedWindow:
    """Minimal window handle wrapper (hwnd + title + geometry) used by the analyzer."""

    def __init__(self, hwnd: int, title: str, left: int = 0, top: int = 0, width: int = 0, height: int = 0):
        self._hWnd = int(hwnd)
        self.title = title
        self.left = left
        self.top = top
        self.width = width
        self.height = height
        self.isActive = False
        self.isMaximized = False
        self.isMinimized = False

    @classmethod
    def from_rect(cls, hwnd: int, title: str, rect) -> "AnalyzedWindow":
        return cls(hwnd, title, rect[0], rect[1], rect[2] - rect[0], rect[3] - rect[1])

    def activate(self) -> bool:
        try:
            win32gui.SetForegroundWindow(self._hWnd)
            win32gui.ShowWindow(self._hWnd, win32con.SW_RESTORE)
        except _win32_error() as exc:
            ColorPrint.yellow(f"[WindowAnalyzer] activate failed hwnd={self._hWnd}: {exc}")
            return False
        return True


def _window_cache_record(hwnd: int, title: str, rect) -> Dict[str, Any]:
    return {
        "hwnd": hwnd,
        "title": title,
        "rect": rect,
        "left": rect[0],
        "top": rect[1],
        "right": rect[2],
        "bottom": rect[3],
        "width": rect[2] - rect[0],
        "height": rect[3] - rect[1],
        "class_name": win32gui.GetClassName(hwnd),
    }


class WindowAnalyzer:
    """Analyzes window interface and extracts UI elements using UI Automation"""

    def __init__(self):
        self.debug_dir = PYTOOLS_TMP_DIR
        self.elements = []
        self.window_handle = None
        self.target_window = None

    def _window_from_cache(self, window_titles: List[str]) -> Optional[AnalyzedWindow]:
        for title in window_titles:
            cache_key = f"{WINDOW_CACHE_KEY_PREFIX}{title.lower()}"
            cached_info = ENCYCLOPEDIA.get(cache_key)
            if not cached_info:
                continue
            hwnd = cached_info.get("hwnd")
            if not (hwnd and win32gui.IsWindow(hwnd) and win32gui.IsWindowVisible(hwnd)):
                ColorPrint.yellow(f"[CACHE] Cached window invalid for '{title}', searching...")
                continue
            window = self._window_from_handle(hwnd, cached_info.get("title"))
            if window is None:
                continue
            ENCYCLOPEDIA.add(cache_key, _window_cache_record(hwnd, window.title, (
                window.left, window.top, window.left + window.width, window.top + window.height)))
            ColorPrint.green(f"[CACHE] Using cached window: '{window.title}' (Handle: {hwnd})")
            return window
        return None

    def get_window_by_titles(self, window_titles: List[str], use_cache: bool = True) -> Optional[AnalyzedWindow]:
        """Find a visible top-level window whose title contains any of ``window_titles`` (cache first)."""
        if win32gui is None:
            ColorPrint.yellow("[WindowAnalyzer] win32gui unavailable on this platform")
            return None
        if use_cache:
            cached = self._window_from_cache(window_titles)
            if cached is not None:
                return cached

        matches: List[tuple] = []

        def enum_windows_callback(hwnd, _lparam):
            if not win32gui.IsWindowVisible(hwnd):
                return True
            window_title = win32gui.GetWindowText(hwnd)
            for title in window_titles:
                if title in window_title:
                    matches.append((hwnd, title, window_title))
                    return False
            return True

        try:
            win32gui.EnumWindows(enum_windows_callback, None)
        except _win32_error() as enum_error:
            # EnumWindows reports an error when the callback stops enumeration early.
            if not matches:
                ColorPrint.yellow(f"[WindowAnalyzer] EnumWindows failed titles={window_titles}: {enum_error}")
        if not matches:
            ColorPrint.red(f"[WindowAnalyzer] Window not found titles={window_titles}")
            return None

        hwnd, title, window_title = matches[0]
        window = self._window_from_handle(hwnd, window_title)
        if window is not None:
            ENCYCLOPEDIA.add(f"{WINDOW_CACHE_KEY_PREFIX}{title.lower()}", _window_cache_record(hwnd, window_title, (
                window.left, window.top, window.left + window.width, window.top + window.height)))
            ColorPrint.blue(f"[CACHE] Cached window info for '{title}'")
        return window

    def get_window_info(self, window) -> Dict:
        """Get detailed information about a window"""
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

    @staticmethod
    def _control_info(control, control_id: int, parent_id: Optional[int], level: int) -> Dict[str, Any]:
        rect = control.BoundingRectangle
        return {
            "id": control_id,
            "parent_id": parent_id,
            "type": control.ControlTypeName,
            "name": control.Name,
            "automation_id": control.AutomationId,
            "class_name": control.ClassName,
            "value": getattr(control, "CurrentValue", None),
            "help_text": getattr(control, "CurrentHelpText", None),
            "patterns": [pattern.ProgrammaticName for pattern in control.GetSupportedPatterns()]
            if hasattr(control, "GetSupportedPatterns") else [],
            "rect": {
                "left": rect.left,
                "top": rect.top,
                "right": rect.right,
                "bottom": rect.bottom,
                "width": rect.width(),
                "height": rect.height()
            },
            "is_enabled": getattr(control, "IsEnabled", None),
            "is_visible": control.IsVisible() if hasattr(control, "IsVisible") else None,
            "level": level
        }

    def enumerate_controls_ui_automation(self, window) -> List[Dict]:
        """Enumerate all controls using UI Automation"""
        controls: List[Dict] = []
        if auto is None:
            ColorPrint.yellow("[WindowAnalyzer] uiautomation unavailable on this platform")
            return controls

        def walk_controls(control, parent_id=None, level=0):
            control_id = len(controls)
            controls.append(self._control_info(control, control_id, parent_id, level))
            for child in control.GetChildren():
                walk_controls(child, control_id, level + 1)

        try:
            self.target_window = auto.ControlFromHandle(int(window._hWnd))
            if not self.target_window.Exists():
                ColorPrint.red(f"[WindowAnalyzer] No UI Automation control for hwnd={window._hWnd}")
                return controls
            ColorPrint.green("[WindowAnalyzer] Enumerating UI Automation controls...")
            walk_controls(self.target_window)
        except Exception as e:  # UIA/COM failures surface as assorted comtypes/uiautomation exception types
            ColorPrint.red(f"[WindowAnalyzer] UI Automation enumeration failed hwnd={window._hWnd}: {e}")
            return controls
        ColorPrint.green(f"[WindowAnalyzer] Found {len(controls)} UI Automation controls")
        return controls

    def enumerate_child_windows_legacy(self, parent_hwnd: int) -> List[Dict]:
        """Enumerate all child windows using legacy Win32 API"""
        child_windows = []

        def enum_child_windows_callback(hwnd, _lparam):
            if win32gui.IsWindowVisible(hwnd):
                window_info = self.get_legacy_window_info(hwnd)
                if window_info:
                    child_windows.append(window_info)
            return True

        try:
            win32gui.EnumChildWindows(parent_hwnd, enum_child_windows_callback, None)
        except _win32_error() as e:
            ColorPrint.yellow(f"[WindowAnalyzer] EnumChildWindows failed parent={parent_hwnd}: {e}")
        return child_windows

    def get_legacy_window_info(self, hwnd: int) -> Dict:
        """Get detailed information about a window using Win32 API"""
        try:
            rect = win32gui.GetWindowRect(hwnd)
            client_rect = win32gui.GetClientRect(hwnd)
            title = win32gui.GetWindowText(hwnd)
            class_name = win32gui.GetClassName(hwnd)
            _, pid = win32process.GetWindowThreadProcessId(hwnd)
        except _win32_error() as e:
            ColorPrint.yellow(f"[WindowAnalyzer] legacy window info failed hwnd={hwnd}: {e}")
            return {}
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

    def take_screenshot(self, window, output_path: str) -> bool:
        """Take a screenshot of the specified window"""
        if pyautogui is None:
            ColorPrint.yellow("[WindowAnalyzer] pyautogui unavailable (headless/no DISPLAY); cannot take screenshot")
            return False
        window.activate()
        time.sleep(WINDOW_ACTIVATION_WAIT_SECONDS)
        try:
            screenshot = pyautogui.screenshot(region=(window.left, window.top, window.width, window.height))
            screenshot.save(output_path)
        except (pyautogui.PyAutoGUIException, OSError) as e:
            ColorPrint.red(f"[WindowAnalyzer] screenshot failed path={output_path}: {e}")
            return False
        ColorPrint.green(f"[WindowAnalyzer] Screenshot saved to: {output_path}")
        return True

    @staticmethod
    def _annotation_font():
        try:
            return ImageFont.truetype(ANNOTATION_FONT_FILE, ANNOTATION_FONT_SIZE)
        except OSError:
            return ImageFont.load_default()

    def draw_element_numbers(self, image_path: str, controls: List[Dict], output_path: str, window):
        """Draw element numbers on the screenshot"""
        if not window:
            ColorPrint.red("[WindowAnalyzer] Cannot get window for annotation")
            return
        try:
            img = Image.open(image_path)
        except OSError as e:
            ColorPrint.red(f"[WindowAnalyzer] open screenshot failed path={image_path}: {e}")
            return
        draw = ImageDraw.Draw(img)
        font = self._annotation_font()
        window_left, window_top = window.left, window.top

        for control in controls:
            rect = control.get('rect', {})
            if not rect or rect.get('width', 0) == 0 or rect.get('height', 0) == 0:
                continue
            left = rect['left'] - window_left
            top = rect['top'] - window_top
            right = rect['right'] - window_left
            bottom = rect['bottom'] - window_top
            if left < 0 or top < 0 or right > img.width or bottom > img.height:
                continue

            draw.rectangle([left, top, right, bottom], outline="red", width=1)
            text = str(control['id'])
            bbox = font.getbbox(text)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]
            text_x = left + (right - left - text_width) / 2
            text_y = top + (bottom - top - text_height) / 2
            draw.rectangle(
                [text_x - 2, text_y - 2, text_x + text_width + 2, text_y + text_height + 2],
                fill="white"
            )
            draw.text((text_x, text_y), text, fill="red", font=font)

        try:
            img.save(output_path)
        except OSError as e:
            ColorPrint.red(f"[WindowAnalyzer] save annotated screenshot failed path={output_path}: {e}")
            return
        ColorPrint.green(f"[WindowAnalyzer] Annotated screenshot saved to: {output_path}")

    def create_timestamp_dir(self) -> str:
        """Create a timestamped directory in the debug folder"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = os.path.join(self.debug_dir, f"window_analysis_{timestamp}")
        try:
            os.makedirs(output_dir, exist_ok=True)
        except OSError as e:
            ColorPrint.red(f"[WindowAnalyzer] create output directory failed path={output_dir}: {e}")
            return self.debug_dir
        ColorPrint.green(f"[WindowAnalyzer] Created output directory: {output_dir}")
        return output_dir

    def _window_from_handle(self, hwnd: int, window_title: str) -> Optional[AnalyzedWindow]:
        """Build a window wrapper from hwnd (current geometry)."""
        try:
            rect = win32gui.GetWindowRect(hwnd)
        except _win32_error() as e:
            ColorPrint.red(f"[WindowAnalyzer] GetWindowRect failed hwnd={hwnd}: {e}")
            return None
        return AnalyzedWindow.from_rect(hwnd, window_title, rect)

    def analyze_window_by_handle(self, hwnd: int, window_title: str, program_name: str = "Unknown") -> Dict:
        """Analyze window by handle (e.g. ROSBOT found by PID, not by title). Same output as analyze_window."""
        ColorPrint.yellow(f"[WindowAnalyzer] Analyzing window: {program_name} (by handle)")
        window = self._window_from_handle(hwnd, window_title or "Unknown")
        if not window:
            return {"success": False, "error": "Invalid window handle"}
        return self._analyze_window_impl(window, program_name)

    def analyze_window(self, window_titles: List[str], program_name: str = "Unknown") -> Dict:
        """Analyze window and generate screenshots, position info, and JSON"""
        ColorPrint.yellow(f"[WindowAnalyzer] Analyzing window: {program_name}")
        window = self.get_window_by_titles(window_titles)
        if not window:
            return {"success": False, "error": "Window not found"}
        return self._analyze_window_impl(window, program_name)

    def _analyze_window_impl(self, window, program_name: str) -> Dict:
        """Shared implementation: output_dir, screenshot, controls, JSON."""
        output_dir = self.create_timestamp_dir()
        window_info = self.get_window_info(window)

        screenshot_path = os.path.join(output_dir, f"{program_name}_screenshot.png")
        if not self.take_screenshot(window, screenshot_path):
            return {"success": False, "error": "Failed to take screenshot"}

        controls = self.enumerate_controls_ui_automation(window)
        annotated_path = os.path.join(output_dir, f"{program_name}_annotated.png")
        self.draw_element_numbers(screenshot_path, controls, annotated_path, window)

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

        json_path = os.path.join(output_dir, f"{program_name}_analysis.json")
        try:
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(analysis_data, f, indent=2, ensure_ascii=False)
        except OSError as e:
            ColorPrint.red(f"[WindowAnalyzer] save JSON failed path={json_path}: {e}")
            return {"success": False, "error": f"Failed to save JSON: {e}"}
        ColorPrint.green(f"[WindowAnalyzer] JSON data saved to: {json_path}")

        analysis_data["files"]["json"] = json_path
        analysis_data["success"] = True
        ColorPrint.green(f"[WindowAnalyzer] Window analysis completed for {program_name}")
        return analysis_data
