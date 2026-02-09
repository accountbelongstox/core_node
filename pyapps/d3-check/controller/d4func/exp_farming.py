#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EXP Farming Manager for D4 Controller
Manages the complete EXP farming process
"""

import sys
import time
from pathlib import Path

# Add project paths
current_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(current_dir))

from pycore.pyfoundations.color_print import ColorPrint
from providor.constants.d4 import D4_SCREENSHOT_DIR, D4_ANNOTATED_DIR
from share.game_interface_data import get_d4_interface_data
# D4State functionality now integrated into D4InterfaceData
from .screenshot_handler import ScreenshotHandler
from .region_detector import RegionDetector
from .image_annotator import ImageAnnotator


class ExpFarmingManager:
    """
    Manages the complete EXP farming process for D4
    
    Responsibilities:
    - Coordinate the two-step EXP farming process
    - Manage screenshot capture, region detection, and annotation
    - Handle error recovery and logging
    """

    def __init__(self):
        """Initialize EXP farming manager"""
        self.d4_data = get_d4_interface_data()
        self.screenshot_handler = ScreenshotHandler()
        self.region_detector = RegionDetector()
        self.image_annotator = ImageAnnotator()
        ColorPrint.blue("[ExpFarmingManager] Initialized")

    def start_exp_farming_process(self, d4_data) -> bool:
        """
        Start the complete EXP farming process

        Args:
            d4_data: D4 interface data instance

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Step 1: Capture screenshot and collect information
            step1_success = self._step1_screenshot_and_collect_info(d4_data)
            if not step1_success:
                return False

            # Step 2: Detect region information
            step2_success = self._step2_region_detection()
            if not step2_success:
                return False

            # Step 3: Detect map switching and recognize map name
            self._step3_map_switching_and_recognition()

            # Save screenshot and generate annotated image
            self._save_screenshot_and_annotate()

            return True

        except Exception as e:
            ColorPrint.red(f"[ExpFarmingManager] Error in EXP farming process: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _step1_screenshot_and_collect_info(self, d4_data) -> bool:
        """
        Step 1: Capture screenshot and collect information

        Args:
            d4_data: D4 interface data instance

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            success = self.screenshot_handler.capture_and_collect_info(d4_data)
            return success

        except Exception as e:
            ColorPrint.red(f"[ExpFarmingManager] Error in Step 1: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _step2_region_detection(self) -> bool:
        """
        Step 2: Detect region information from shared data

        Returns:
            bool: True if successful, False otherwise
        """
        try:
            success = self.region_detector.detect_regions_from_shared_data()
            return success

        except Exception as e:
            ColorPrint.red(f"[ExpFarmingManager] Error in Step 2: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _step3_map_switching_and_recognition(self):
        """
        Step 3: Detect map switching and recognize map name
        """
        try:
            # Detect map switching (monitors Map Name region for black screen)
            from .map_switch_detector import get_map_switch_detector
            map_switch_detector = get_map_switch_detector()
            map_switch_detector.detect_map_switch()
            
            # Attempt map name recognition if in post-switch idle state
            from .map_name_recognizer import get_map_name_recognizer
            map_recognizer = get_map_name_recognizer()
            map_recognizer.recognize_map_name()

        except Exception as e:
            ColorPrint.red(f"[ExpFarmingManager] Error in Step 3: {e}")
            import traceback
            traceback.print_exc()

    def _save_screenshot_and_annotate(self):
        """Save screenshot and generate annotated image for debugging"""
        try:
            # Get screenshot data from shared memory
            screenshot_data = self.d4_data.screenshot_data
            if not screenshot_data or not screenshot_data.game_window_image:
                ColorPrint.yellow("[ExpFarmingManager] No screenshot data available for saving")
                return

            # Save screenshot to disk
            screenshot_path = self.screenshot_handler.save_screenshot_to_disk(
                screenshot_data, D4_SCREENSHOT_DIR
            )
            
            if screenshot_path:
                # Update D4 interface data with screenshot info
                self.d4_data.last_screenshot_path = screenshot_path
                self.d4_data.last_screenshot_time = time.time()

            # Check if D4WindowRegionDetector already generated an annotated image
            annotated_image = None
            if not (hasattr(self.d4_data, 'last_annotated_screenshot_path') and self.d4_data.last_annotated_screenshot_path):
                # Generate annotated image for debugging using ImageAnnotator
                is_windowed = self.d4_data.is_windowed_mode()
                annotated_image = self.image_annotator.annotate_screenshot_with_coordinates(
                    screenshot_data.game_window_image,
                    screenshot_data.game_window_size,
                    is_windowed
                )

                # Save annotated image
                if annotated_image:
                    annotated_path = self.image_annotator.save_annotated_image(
                        annotated_image, D4_ANNOTATED_DIR
                    )

                    if annotated_path:
                        # Update D4 interface data
                        self.d4_data.last_annotated_screenshot_path = annotated_path

        except Exception as e:
            ColorPrint.red(f"[ExpFarmingManager] Error saving screenshot and annotating: {e}")
            import traceback
            traceback.print_exc()
