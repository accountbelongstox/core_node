#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Screen Monitor Application

Monitors the bottom-right corner (500x500px) of the screen every 10 seconds.
Uses OCR to detect text and triggers Windows click when "keep review" is found.

Developed according to PYTHON_PYCORE.md standards:
- Use tools from pycore.pyutils
- Absolute imports
- All imports at file top
"""

import time
import sys
from pathlib import Path
from typing import Optional, Dict, Any

from pycore.pyfoundations.third_party.api import get_third_package_mss, get_third_package_PIL_Image
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.ocr import ocr_manager
from pycore.pyutils.window.ops import WindowOps
from pycore.pyutils.image_comparator import ImageComparator
from pycore.pyutils.window.analyzer import WindowAnalyzer
from pycore.pyfoundations.pygvar.global_var_manager import PYTOOLS_TMP_DIR

mss = get_third_package_mss()
PIL_Image = get_third_package_PIL_Image()


class ScreenMonitor:
    """
    Screen monitoring application

    Monitors bottom-right 500x500px region of screen
    Performs OCR every 10 seconds
    Clicks when "keep review" is detected
    """

    def __init__(self):
        """Initialize screen monitor"""
        self.region_width = 503  # Right edge width
        self.region_height = None  # Auto-detect from window
        self.interval_seconds = 10
        self.target_text = "undo keep review"  # Text to detect (case-insensitive)
        self.click_word = "keep"  # Word to click when target detected
        self.target_window_name = "Cursor"  # Window process name to monitor
        self.running = False

        # Initialize utilities
        self.window_ops = WindowOps()
        self.window_analyzer = WindowAnalyzer()
        self.image_comparator = ImageComparator()
        self.screenshot_dir = Path(PYTOOLS_TMP_DIR) / "screen_monitor"
        self.screenshot_dir.mkdir(parents=True, exist_ok=True)

        # Track last screenshot for similarity comparison
        self.last_screenshot_path = None

        ColorPrint.green("[INIT] Screen Monitor initialized")
        ColorPrint.blue(f"[CONFIG] Target window: '{self.target_window_name}'")
        ColorPrint.blue(f"[CONFIG] Monitoring region: Right {self.region_width}px (height: auto-detect)")
        ColorPrint.blue(f"[CONFIG] Interval: {self.interval_seconds} seconds")
        ColorPrint.blue(f"[CONFIG] Target text: '{self.target_text}' (case-insensitive)")
        ColorPrint.blue(f"[CONFIG] Click word: '{self.click_word}'")
        ColorPrint.blue(f"[CONFIG] Screenshot dir: {self.screenshot_dir}")

    def get_cursor_window_region(self) -> Optional[Dict[str, int]]:
        """
        Get Cursor window region

        Returns:
            Dictionary with left, top, width, height of window, or None if not found
        """
        try:
            # Find Cursor window (try cache first, then fresh search)
            window = None

            # Try with cache
            try:
                window = self.window_analyzer.get_window_by_titles([self.target_window_name], use_cache=True)
            except Exception as cache_error:
                ColorPrint.yellow(f"[CACHE] Cache error: {cache_error}, trying fresh search...")

            # If cache failed, try without cache
            if not window:
                try:
                    window = self.window_analyzer.get_window_by_titles([self.target_window_name], use_cache=False)
                except Exception as search_error:
                    ColorPrint.red(f"[SEARCH] Search error: {search_error}")
                    return None

            if window:
                ColorPrint.green(f"[WINDOW] Found '{window.title}' window")
                ColorPrint.blue(f"[WINDOW] Position: ({window.left}, {window.top})")
                ColorPrint.blue(f"[WINDOW] Size: {window.width}x{window.height}")

                return {
                    "left": window.left,
                    "top": window.top,
                    "width": window.width,
                    "height": window.height
                }
            else:
                ColorPrint.yellow(f"[WARN] Window '{self.target_window_name}' not found")
                return None

        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to get window region: {e}")
            import traceback
            ColorPrint.red(traceback.format_exc())
            return None

    def get_screen_dimensions(self) -> tuple:
        """
        Get screen dimensions

        Returns:
            tuple: (width, height)
        """
        with mss.mss() as sct:
            monitor = sct.monitors[1]  # Primary monitor
            return monitor["width"], monitor["height"]

    def capture_cursor_window_right_edge(self) -> Optional[Path]:
        """
        Capture right edge region of Cursor window

        Returns:
            Path to saved screenshot, or None if failed
        """
        try:
            # Get Cursor window region
            window_region = self.get_cursor_window_region()

            if not window_region:
                ColorPrint.yellow("[WARN] Cannot capture - Cursor window not found")
                return None

            # Calculate right edge region (503px from right, full window height)
            window_left = window_region["left"]
            window_top = window_region["top"]
            window_width = window_region["width"]
            window_height = window_region["height"]

            # Right edge capture region
            capture_width = min(self.region_width, window_width)  # Don't exceed window width
            capture_left = window_left + window_width - capture_width
            capture_top = window_top
            capture_height = window_height

            ColorPrint.blue(f"[CAPTURE] Window: ({window_left}, {window_top}) size: {window_width}x{window_height}")
            ColorPrint.blue(f"[CAPTURE] Region: ({capture_left}, {capture_top}) size: {capture_width}x{capture_height}")

            # Capture screenshot using mss
            with mss.mss() as sct:
                monitor = {
                    "left": capture_left,
                    "top": capture_top,
                    "width": capture_width,
                    "height": capture_height
                }

                screenshot = sct.grab(monitor)

                # Convert to PIL Image
                img = PIL_Image.frombytes("RGB", screenshot.size, screenshot.bgra, "raw", "BGRX")

                # Save to file
                timestamp = time.strftime("%Y%m%d_%H%M%S")
                screenshot_path = self.screenshot_dir / f"capture_{timestamp}.png"
                img.save(str(screenshot_path))

                ColorPrint.green(f"[SUCCESS] Screenshot saved: {screenshot_path}")
                return screenshot_path

        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to capture screenshot: {e}")
            return None

    def compare_with_last_screenshot(self, current_screenshot_path: Path) -> Optional[Dict[str, Any]]:
        """
        Compare current screenshot with last screenshot

        Args:
            current_screenshot_path: Path to current screenshot

        Returns:
            Dictionary with similarity info, or None if no last screenshot
        """
        if not self.last_screenshot_path or not self.last_screenshot_path.exists():
            ColorPrint.blue("[SIMILARITY] No previous screenshot for comparison")
            return None

        try:
            # Load both images
            img_current = self.image_comparator.load_image(current_screenshot_path)
            img_last = self.image_comparator.load_image(self.last_screenshot_path)

            # Calculate histogram similarity (0-1, 1 = identical)
            hist_similarity = self.image_comparator.compare_histograms(img_current, img_last)

            # Calculate MSE (lower is more similar, 0 = identical)
            mse_value = self.image_comparator.calculate_mse(img_current, img_last)

            ColorPrint.blue("[SIMILARITY] Comparison with last screenshot:")
            ColorPrint.blue(f"  - Histogram similarity: {hist_similarity:.4f} (1.0 = identical)")
            ColorPrint.blue(f"  - MSE value: {mse_value:.2f} (0 = identical)")

            # Determine if significantly different
            is_different = hist_similarity < 0.95  # Less than 95% similar = different
            is_identical = hist_similarity >= 0.999 and mse_value < 10  # Virtually identical

            if is_identical:
                ColorPrint.yellow("=" * 70)
                ColorPrint.yellow("[IDENTICAL] Screenshot IDENTICAL to previous - Software may be paused!")
                ColorPrint.yellow("=" * 70)
                ColorPrint.yellow("[TODO] Possible actions:")
                ColorPrint.yellow("  1. Check if Cursor is frozen or unresponsive")
                ColorPrint.yellow("  2. Try clicking in the Cursor window to activate it")
                ColorPrint.yellow("  3. Check if any dialog boxes are blocking the window")
                ColorPrint.yellow("  4. Verify that 'Undo Keep Review' text is visible")
                ColorPrint.yellow("  5. Consider restarting Cursor if it's stuck")
                ColorPrint.yellow("=" * 70)
            elif is_different:
                ColorPrint.yellow(f"[SIMILARITY] Screenshot changed significantly (similarity: {hist_similarity:.2%})")
            else:
                ColorPrint.green(f"[SIMILARITY] Screenshot similar to previous (similarity: {hist_similarity:.2%})")

            return {
                "histogram_similarity": hist_similarity,
                "mse": mse_value,
                "is_different": is_different,
                "is_identical": is_identical,
                "last_screenshot": str(self.last_screenshot_path)
            }

        except Exception as e:
            ColorPrint.red(f"[ERROR] Failed to compare screenshots: {e}")
            return None

    def recognize_text(self, image_path: Path) -> Dict[str, Any]:
        """
        Recognize text from image using OCR

        Args:
            image_path: Path to image file

        Returns:
            OCR result dictionary
        """
        try:
            ColorPrint.blue(f"[OCR] Recognizing text from: {image_path.name}")

            # Try general model first (better for mixed content)
            result = ocr_manager.recognize_image(
                str(image_path),
                model_type="general"
            )

            if result.get("success"):
                text = result.get("text", "")
                confidence = result.get("confidence", 0.0)
                words = result.get("words", [])

                ColorPrint.green(f"[OCR] Recognized text (confidence: {confidence:.2f}): {text}")
                ColorPrint.blue(f"[OCR] Found {len(words)} words")

                # Debug: print ALL recognized words (no folding)
                if words:
                    ColorPrint.blue("[OCR] Recognized words (ALL):")
                    for i, word in enumerate(words):  # Show ALL words
                        word_text = word.get("text", "")
                        word_conf = word.get("score", 0.0)
                        ColorPrint.blue(f"  [{i+1}] '{word_text}' (confidence: {word_conf:.2f})")
                        # Debug: show full word structure
                        ColorPrint.blue(f"       Full word data: {word}")
            else:
                error = result.get("error", "Unknown error")
                ColorPrint.red(f"[OCR] Recognition failed: {error}")

                # Try with english model as fallback
                ColorPrint.yellow("[OCR] Retrying with English model...")
                result = ocr_manager.recognize_image(
                    str(image_path),
                    model_type="english"
                )

                if result.get("success"):
                    text = result.get("text", "")
                    confidence = result.get("confidence", 0.0)
                    words = result.get("words", [])
                    ColorPrint.green(f"[OCR] English model succeeded (confidence: {confidence:.2f}): {text}")
                    ColorPrint.blue(f"[OCR] Found {len(words)} words")

            return result

        except Exception as e:
            ColorPrint.red(f"[ERROR] OCR recognition failed: {e}")
            return {"success": False, "error": str(e)}

    def check_and_click_target(self, ocr_result: Dict[str, Any]) -> bool:
        """
        Check if target text exists and perform click on specific word

        Args:
            ocr_result: OCR result dictionary

        Returns:
            True if target found and clicked
        """
        if not ocr_result.get("success"):
            return False

        text = ocr_result.get("text", "").lower()

        # Check if target text exists (normalized, case-insensitive)
        target_normalized = self.target_text.lower().replace(" ", "")
        text_normalized = text.replace(" ", "").replace("\n", "")

        if target_normalized in text_normalized:
            ColorPrint.yellow(f"[DETECT] Found target text: '{self.target_text}'")

            # Get word positions
            words = ocr_result.get("words", [])

            # Find the specific click word position
            click_position = self._find_click_word_position(words, self.click_word)

            if click_position:
                x, y = click_position
                ColorPrint.yellow(f"[CLICK] Clicking '{self.click_word}' at position: ({x}, {y})")

                # Perform click
                self.window_ops.click_at_position(x, y)
                ColorPrint.green("[SUCCESS] Click performed")
                return True
            else:
                ColorPrint.yellow(f"[WARN] Target found but '{self.click_word}' word position not available")
                return False

        return False

    def _find_click_word_position(self, words: list, click_word: str) -> Optional[tuple]:
        """
        Find position of specific word to click

        Args:
            words: List of word dictionaries with text and bbox
            click_word: The word to click (case-insensitive)

        Returns:
            (x, y) center position of word, or None
        """
        if not words or not click_word:
            return None

        click_word_lower = click_word.lower()

        # Find the word to click
        for word_info in words:
            word_text = word_info.get("text", "").lower()

            # Check if this word matches (case-insensitive)
            if click_word_lower in word_text or word_text in click_word_lower:
                bbox = word_info.get("bbox", None)

                ColorPrint.blue(f"[DEBUG] Found word '{word_text}', bbox type: {type(bbox)}")
                ColorPrint.blue(f"[DEBUG] bbox content: {bbox}")

                if not bbox:
                    ColorPrint.yellow(f"[WARN] Word '{word_text}' has no bbox")
                    continue

                # Handle bbox as dictionary (CnOCR format)
                if isinstance(bbox, dict):
                    left = bbox.get("left")
                    top = bbox.get("top")
                    width = bbox.get("width")
                    height = bbox.get("height")

                    if left is None or top is None or width is None or height is None:
                        ColorPrint.yellow(f"[WARN] Incomplete bbox dict: {bbox}")
                        continue

                    # Calculate center position within captured region
                    region_x = int(left + width / 2)
                    region_y = int(top + height / 2)

                    ColorPrint.blue(f"[DEBUG] Word bbox (dict): left={left}, top={top}, width={width}, height={height}")
                    ColorPrint.blue(f"[DEBUG] Region center: ({region_x}, {region_y})")

                # Handle bbox as array [x1, y1, x2, y2]
                elif isinstance(bbox, (list, tuple)) and len(bbox) >= 4:
                    region_x = int(bbox[0] + (bbox[2] - bbox[0]) / 2)
                    region_y = int(bbox[1] + (bbox[3] - bbox[1]) / 2)

                    ColorPrint.blue(f"[DEBUG] Word bbox (array): {bbox}")
                    ColorPrint.blue(f"[DEBUG] Region center: ({region_x}, {region_y})")

                else:
                    ColorPrint.yellow(f"[WARN] Unknown bbox format: {type(bbox)}, {bbox}")
                    continue

                # Get Cursor window region to calculate screen offset
                window_region = self.get_cursor_window_region()

                if not window_region:
                    ColorPrint.yellow("[WARN] Cannot calculate screen position - window not found")
                    return None

                # Calculate right edge region offset (where the capture was taken)
                window_left = window_region["left"]
                window_top = window_region["top"]
                window_width = window_region["width"]

                # Right edge starts at: window_left + window_width - capture_width
                capture_width = min(self.region_width, window_width)
                capture_left = window_left + window_width - capture_width
                capture_top = window_top

                # Convert region coordinates to screen coordinates
                screen_x = capture_left + region_x
                screen_y = capture_top + region_y

                ColorPrint.blue(f"[DEBUG] Window: left={window_left}, top={window_top}, width={window_width}")
                ColorPrint.blue(f"[DEBUG] Capture region: left={capture_left}, top={capture_top}, width={capture_width}")
                ColorPrint.blue(f"[DEBUG] Screen position: ({screen_x}, {screen_y})")

                return (screen_x, screen_y)

        return None

    def monitor_once(self) -> bool:
        """
        Perform one monitoring cycle

        Returns:
            True if target was found and clicked
        """
        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue("[MONITOR] Starting monitoring cycle")
        ColorPrint.blue("=" * 60)

        # 1. Capture screenshot from Cursor window right edge
        screenshot_path = self.capture_cursor_window_right_edge()
        if not screenshot_path:
            return False

        # 2. Compare with last screenshot
        similarity_info = self.compare_with_last_screenshot(screenshot_path)

        # 3. Update last screenshot path
        self.last_screenshot_path = screenshot_path

        # 4. Perform OCR
        ocr_result = self.recognize_text(screenshot_path)

        # 5. If OCR failed or no text found, remind user to check screenshot
        if not ocr_result.get("success") or not ocr_result.get("text"):
            ColorPrint.yellow(f"[DEBUG] No text detected. Check screenshot at:")
            ColorPrint.yellow(f"[DEBUG] {screenshot_path}")
            ColorPrint.yellow(f"[DEBUG] Open this file to see what was captured")

        # 6. Check for target and click
        found = self.check_and_click_target(ocr_result)

        # 7. Cleanup old screenshots (keep last 10)
        self._cleanup_old_screenshots(keep_count=10)

        return found

    def _cleanup_old_screenshots(self, keep_count: int = 10):
        """
        Remove old screenshots, keeping only recent ones

        Args:
            keep_count: Number of screenshots to keep
        """
        try:
            screenshots = sorted(
                self.screenshot_dir.glob("capture_*.png"),
                key=lambda p: p.stat().st_mtime,
                reverse=True
            )

            # Remove old screenshots
            for screenshot in screenshots[keep_count:]:
                screenshot.unlink()

        except Exception as e:
            ColorPrint.yellow(f"[WARN] Cleanup failed: {e}")

    def start(self):
        """Start monitoring loop"""
        ColorPrint.green("\n" + "=" * 60)
        ColorPrint.green("[START] Screen Monitor started")
        ColorPrint.green("=" * 60)
        ColorPrint.yellow("[INFO] Press Ctrl+C to stop")

        self.running = True

        try:
            while self.running:
                # Perform monitoring cycle
                found = self.monitor_once()

                if found:
                    ColorPrint.green(f"[RESULT] Target found and clicked!")
                else:
                    ColorPrint.blue(f"[RESULT] Target not found")

                # Wait for next cycle
                ColorPrint.blue(f"[WAIT] Waiting {self.interval_seconds} seconds for next cycle...")
                time.sleep(self.interval_seconds)

        except KeyboardInterrupt:
            ColorPrint.yellow("\n[STOP] Received interrupt signal")
        except Exception as e:
            ColorPrint.red(f"[ERROR] Monitor error: {e}")
        finally:
            self.running = False
            ColorPrint.green("[EXIT] Screen Monitor stopped")

    def stop(self):
        """Stop monitoring loop"""
        self.running = False


def start():
    """
    Main entry point for screen monitor application
    According to PYTHON_PYCORE.md standards, applications must define start() function
    """
    monitor = ScreenMonitor()
    monitor.start()


def main():
    """Fallback entry point"""
    start()


if __name__ == "__main__":
    start()
