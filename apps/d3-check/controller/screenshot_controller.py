#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Screenshot Controller
Handles screenshot operations for Diablo III windows
"""

import os
import sys
from typing import List, Optional, Union, Dict
from pathlib import Path

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

# Add ncore path for pytools
ncore_path = os.path.join(os.path.dirname(os.path.dirname(current_dir)), "ncore")
sys.path.insert(0, ncore_path)

from base.color_print import ColorPrint
from providor.providor_index import DIABLO_III_WINDOW_TITLES
from pytools.pyutils.window_screenshot import WindowScreenshot
from pytools.pyutils.paddle_ocr import PaddleOCREngine
from pytools.pyutils.image_matcher import ImageMatcher


class ScreenshotController:
    """Controller for capturing Diablo III window screenshots with OCR"""

    def __init__(self, enable_ocr: bool = True, ocr_lang: str = "chinese_cht", enable_matching: bool = True):
        """
        Initialize screenshot controller

        Args:
            enable_ocr: Whether to enable OCR text recognition
            ocr_lang: OCR language (chinese_cht, ch, en)
            enable_matching: Whether to enable template image matching
        """
        # Use "in" match mode for flexible title matching
        self.screenshot_manager = WindowScreenshot(match_mode="in")

        # Initialize OCR if enabled
        self.enable_ocr = enable_ocr
        self.ocr = None
        if enable_ocr:
            ColorPrint.blue("[INIT] Initializing PaddleOCR engine...")
            self.ocr = PaddleOCREngine(lang=ocr_lang, auto_init=True)
            if self.ocr.is_ready():
                ColorPrint.green("[INIT] PaddleOCR engine ready")
            else:
                ColorPrint.yellow("[WARN] PaddleOCR engine not ready, text recognition disabled")
                self.enable_ocr = False

        # Initialize image matcher if enabled
        self.enable_matching = enable_matching
        self.matcher = None
        if enable_matching:
            ColorPrint.blue("[INIT] Initializing ImageMatcher...")
            self.matcher = ImageMatcher(
                ratio_thresh=0.80,  # More lenient ratio test
                min_inliers=4,      # Lower minimum matches for small templates
                nfeatures=10000     # More features for better detection
            )
            ColorPrint.green("[INIT] ImageMatcher ready")

        ColorPrint.green("[INIT] ScreenshotController initialized")

    def capture_diablo_screenshots(self, perform_ocr: bool = None) -> List[dict]:
        """
        Capture screenshots of all Diablo III windows and optionally perform OCR

        Args:
            perform_ocr: Whether to perform OCR on screenshots (None = use default)

        Returns:
            List of dictionaries with screenshot info and OCR results:
            [
                {
                    "screenshot_path": Path,
                    "ocr_results": [
                        {
                            "text": str,
                            "confidence": float,
                            "box": [[x,y], ...],
                            "center": (x, y),
                            "bbox": (left, top, right, bottom)
                        },
                        ...
                    ]
                },
                ...
            ]
        """
        ColorPrint.blue("[SCREENSHOT] Starting Diablo III screenshot capture...")

        # Determine if OCR should be performed
        do_ocr = perform_ocr if perform_ocr is not None else self.enable_ocr

        try:
            # Use predefined Diablo III window titles
            screenshots = self.screenshot_manager.screenshot_by_titles(
                titles=DIABLO_III_WINDOW_TITLES,
                filename_prefix="diablo3"
            )

            if not screenshots:
                ColorPrint.yellow("[WARN] No Diablo III windows found to screenshot")
                return []

            ColorPrint.green(f"[SUCCESS] Captured {len(screenshots)} Diablo III screenshot(s)")

            results = []

            # Process each screenshot
            for screenshot_path in screenshots:
                ColorPrint.blue(f"[PROCESSING] {screenshot_path}")

                result_item = {
                    "screenshot_path": screenshot_path,
                    "ocr_results": None
                }

                # Perform OCR if enabled
                if do_ocr and self.ocr and self.ocr.is_ready():
                    ColorPrint.blue(f"[OCR] Recognizing text in screenshot...")
                    ocr_results = self.ocr.recognize_text(str(screenshot_path))

                    if ocr_results:
                        result_item["ocr_results"] = ocr_results
                        ColorPrint.green(f"[OCR] Found {len(ocr_results)} text region(s)")

                        # Display summary
                        for i, text_info in enumerate(ocr_results[:5], 1):  # Show first 5
                            ColorPrint.gray(f"   [{i}] '{text_info['text']}' at {text_info['center']}")
                        if len(ocr_results) > 5:
                            ColorPrint.gray(f"   ... and {len(ocr_results) - 5} more")
                    else:
                        ColorPrint.yellow("[OCR] No text detected in screenshot")
                        result_item["ocr_results"] = []

                results.append(result_item)

            ColorPrint.green(f"[COMPLETE] Processed {len(results)} screenshot(s)")
            return results

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error capturing Diablo III screenshots: {e}")
            return []

    def check_diablo_running(self) -> bool:
        """
        Check if any Diablo III window is currently running

        Returns:
            True if at least one Diablo III window is found
        """
        try:
            windows = self.screenshot_manager.find_windows_by_titles(DIABLO_III_WINDOW_TITLES)
            if windows:
                ColorPrint.green(f"[CHECK] Found {len(windows)} Diablo III window(s)")
                return True
            else:
                ColorPrint.yellow("[CHECK] No Diablo III windows found")
                return False

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error checking Diablo III windows: {e}")
            return False

    def cleanup_old_screenshots(self, days: int = 7) -> int:
        """
        Clean up old screenshots

        Args:
            days: Number of days to keep screenshots

        Returns:
            Number of screenshots deleted
        """
        try:
            deleted_count = self.screenshot_manager.cleanup_old_screenshots(days)
            ColorPrint.green(f"[CLEANUP] Cleaned up {deleted_count} old screenshot(s)")
            return deleted_count

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error during cleanup: {e}")
            return 0

    def match_templates_in_screenshot(
        self,
        screenshot_path: Union[str, Path],
        template_paths: List[Union[str, Path]],
        output_dir: Optional[Union[str, Path]] = None
    ) -> Dict:
        """
        Match template images in a screenshot and draw results

        Args:
            screenshot_path: Path to the screenshot to analyze
            template_paths: List of template image paths to find
            output_dir: Directory to save annotated output (default: C:\\Users\\<username>\\.core_node\\pytools\\tmp)

        Returns:
            Dictionary with match results:
            {
                "target_image": str,
                "matches": List[Dict],
                "output_image_path": str or None,
                "total_matches": int
            }
        """
        if not self.matcher:
            ColorPrint.yellow("[WARN] ImageMatcher not initialized")
            return {
                "target_image": str(screenshot_path),
                "matches": [],
                "output_image_path": None,
                "total_matches": 0
            }

        try:
            # Use default output directory if not specified
            if output_dir is None:
                output_dir = Path.home() / ".core_node" / "pytools" / "tmp"

            ColorPrint.blue(f"[MATCHING] Searching for {len(template_paths)} template(s) in screenshot...")

            # Perform matching
            result = self.matcher.match_multiple_templates(
                target_image_path=screenshot_path,
                template_paths=template_paths,
                output_dir=output_dir
            )

            # Display results
            if result["total_matches"] > 0:
                ColorPrint.green(f"[MATCHING] Found {result['total_matches']} match(es)")
                for match in result["matches"]:
                    center_x, center_y = match["center"]
                    ColorPrint.white(f"   - {match['template_name']}: center=({int(center_x)}, {int(center_y)})")
                ColorPrint.green(f"[OUTPUT] Annotated image saved: {result['output_image_path']}")
            else:
                ColorPrint.yellow("[MATCHING] No matches found")

            return result

        except Exception as e:
            ColorPrint.red(f"[ERROR] Error matching templates: {e}")
            import traceback
            traceback.print_exc()
            return {
                "target_image": str(screenshot_path),
                "matches": [],
                "output_image_path": None,
                "total_matches": 0
            }


def main():
    """Main function for testing"""
    # Initialize with Traditional Chinese OCR and image matching
    controller = ScreenshotController(
        enable_ocr=True,
        ocr_lang="chinese_cht",
        enable_matching=True
    )

    # Check if Diablo III is running
    ColorPrint.blue("\n[TEST] Checking if Diablo III is running...")
    is_running = controller.check_diablo_running()

    if is_running:
        # Capture screenshots with OCR
        ColorPrint.blue("\n[TEST] Capturing Diablo III screenshots with OCR...")
        results = controller.capture_diablo_screenshots(perform_ocr=True)

        if results:
            ColorPrint.green(f"\n[TEST] Successfully processed {len(results)} screenshot(s)")

            # Display OCR results
            for i, result in enumerate(results, 1):
                ColorPrint.blue(f"\n[RESULT {i}] Screenshot: {result['screenshot_path']}")
                if result['ocr_results']:
                    ColorPrint.green(f"   Found {len(result['ocr_results'])} text(s)")
                    for j, text_info in enumerate(result['ocr_results'], 1):  # Show all
                        ColorPrint.white(f"      [{j}] '{text_info['text']}'")
                        ColorPrint.gray(f"          Position: {text_info['center']}, Confidence: {text_info['confidence']:.2f}")
                else:
                    ColorPrint.yellow("   No text detected")

            # Test template matching with predefined templates
            ColorPrint.blue("\n[TEST] Testing template matching...")

            # Define template paths relative to project root
            templates_dir = Path(__file__).parent.parent / "images"
            template_files = [
                templates_dir / "bag_left.png",
                templates_dir / "bag_right.png",
                templates_dir / "bag_buttom.png"
            ]

            # Filter only existing template files
            existing_templates = [t for t in template_files if t.exists()]

            if existing_templates and results:
                ColorPrint.blue(f"[TEST] Found {len(existing_templates)} template(s), matching against first screenshot...")
                screenshot_path = results[0]['screenshot_path']

                # Perform template matching
                match_result = controller.match_templates_in_screenshot(
                    screenshot_path=screenshot_path,
                    template_paths=existing_templates
                )

                if match_result["total_matches"] > 0:
                    ColorPrint.green(f"\n[MATCH RESULT] Found {match_result['total_matches']} template match(es)")
                    for match in match_result["matches"]:
                        ColorPrint.white(f"   Template: {match['template_name']}")
                        ColorPrint.gray(f"      Center: ({int(match['center'][0])}, {int(match['center'][1])})")
                        ColorPrint.gray(f"      Matches: {match['num_matches']}")
                    ColorPrint.green(f"   Annotated output: {match_result['output_image_path']}")
                else:
                    ColorPrint.yellow("[MATCH RESULT] No template matches found")
            else:
                if not existing_templates:
                    ColorPrint.yellow("[TEST] Template files not found:")
                    for t in template_files:
                        ColorPrint.yellow(f"   - {t}")
                else:
                    ColorPrint.yellow("[TEST] No screenshots available for matching")

        else:
            ColorPrint.yellow("\n[TEST] No screenshots captured")
    else:
        ColorPrint.yellow("\n[TEST] Diablo III is not running, skipping screenshot capture")


if __name__ == "__main__":
    main()