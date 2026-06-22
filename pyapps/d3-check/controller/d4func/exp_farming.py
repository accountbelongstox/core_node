#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EXP Farming Manager for D4 Controller
Manages the complete EXP farming process
"""

import time

from pycore.pyfoundations.color_print import ColorPrint
from providor.constants.d4 import D4_SCREENSHOT_DIR, D4_ANNOTATED_DIR
from share.game_interface_data import get_d4_interface_data
# D4State functionality now integrated into D4InterfaceData
from .screenshot_handler import ScreenshotHandler, get_screenshot_handler
from .region_detector import RegionDetector, get_region_detector
from .image_annotator import ImageAnnotator, get_image_annotator


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
        self.screenshot_handler = get_screenshot_handler()
        self.region_detector = get_region_detector()
        self.image_annotator = get_image_annotator()
        ColorPrint.blue("[ExpFarmingManager] Initialized")

    def start_exp_farming_process(self, d4_data) -> bool:
        """
        Start the complete EXP farming process

        Args:
            d4_data: D4 interface data instance

        Returns:
            bool: True if successful, False otherwise
        """
        step1_success = self._step1_screenshot_and_collect_info(d4_data)
        if not step1_success:
            return False
        step2_success = self._step2_region_detection()
        if not step2_success:
            return False
        self._step3_map_switching_and_recognition()
        self._save_screenshot_and_annotate()
        return True

    def _step1_screenshot_and_collect_info(self, d4_data) -> bool:
        """
        Step 1: Capture screenshot and collect information

        Args:
            d4_data: D4 interface data instance

        Returns:
            bool: True if successful, False otherwise
        """
        success = self.screenshot_handler.capture_and_collect_info(d4_data)
        return success

    def _step2_region_detection(self) -> bool:
        """
        Step 2: Detect region information from shared data

        Returns:
            bool: True if successful, False otherwise
        """
        success = self.region_detector.detect_regions_from_shared_data()
        return success

    def _step3_map_switching_and_recognition(self):
        """
        Step 3: Detect map switching and recognize map name
        """
        from .map_switch_detector import get_map_switch_detector
        map_switch_detector = get_map_switch_detector()
        map_switch_detector.detect_map_switch()
        from .map_name_recognizer import get_map_name_recognizer
        map_recognizer = get_map_name_recognizer()
        map_recognizer.recognize_map_name()

    def _save_screenshot_and_annotate(self):
        """Save screenshot and generate annotated image for debugging"""
        screenshot_data = self.d4_data.screenshot_data
        if not screenshot_data or not screenshot_data.game_window_image:
            ColorPrint.yellow("[ExpFarmingManager] No screenshot data available for saving")
            return
        screenshot_path = self.screenshot_handler.save_screenshot_to_disk(
            screenshot_data, D4_SCREENSHOT_DIR
        )
        if screenshot_path:
            self.d4_data.last_screenshot_path = screenshot_path
            self.d4_data.last_screenshot_time = time.time()
        annotated_image = None
        if not self.d4_data.last_annotated_screenshot_path:
            is_windowed = self.d4_data.is_windowed_mode()
            annotated_image = self.image_annotator.annotate_screenshot_with_coordinates(
                screenshot_data.game_window_image,
                screenshot_data.game_window_size,
                is_windowed
            )
            if annotated_image:
                annotated_path = self.image_annotator.save_annotated_image(
                    annotated_image, D4_ANNOTATED_DIR
                )
                if annotated_path:
                    self.d4_data.last_annotated_screenshot_path = annotated_path


_exp_farming_manager_instance = None


def get_exp_farming_manager() -> ExpFarmingManager:
    """Return the global ExpFarmingManager instance (singleton). Instantiate before use."""
    global _exp_farming_manager_instance
    if _exp_farming_manager_instance is None:
        _exp_farming_manager_instance = ExpFarmingManager()
    return _exp_farming_manager_instance
