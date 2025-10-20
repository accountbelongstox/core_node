#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Team Formation Checker Operation
Checks if player has formed a team using OCR
"""

import sys
from pathlib import Path
from typing import Optional

# Add project paths
current_dir = Path(__file__).parent.parent
sys.path.insert(0, str(current_dir))

from d4utils.d4_operation_base import D4OperationBase
from providor.common_imports import ColorPrint
from share.game_interface_data import get_d4_interface_data
from controller.d4func.ocr_config import get_ocr_config_for_task

# Add pycore path for OCR
pycore_path = Path(current_dir).parent / "pycore"
sys.path.insert(0, str(pycore_path))

try:
    from pyutils.ocr_cnocr_engine import CnOCREngine
    OCR_AVAILABLE = True
except ImportError as e:
    ColorPrint.yellow(f"[TeamFormationChecker] CnOCR engine not available: {e}")
    OCR_AVAILABLE = False


class TeamFormationChecker(D4OperationBase):
    """
    Team Formation Checker Operation

    Workflow:
    1. Press 'O' key to open team panel
    2. Wait for next tick
    3. OCR recognize "Find Team" region
    4. If text starts with "寻找" (Find), player has no team
    5. Update shared data with result
    """

    def __init__(self):
        """Initialize team formation checker"""
        super().__init__()
        self.ocr_engine = None
        self._init_ocr_engine()
        ColorPrint.green("[TeamFormationChecker] Initialized")

    def _init_ocr_engine(self):
        """Initialize OCR engine"""
        if not OCR_AVAILABLE:
            ColorPrint.yellow("[TeamFormationChecker] OCR not available, team checking disabled")
            return

        try:
            # Get OCR configuration for general text recognition
            ocr_config = get_ocr_config_for_task('quest_text')  # Use general model

            if ocr_config is None:
                ColorPrint.yellow("[TeamFormationChecker] No OCR config found, using default")
                from controller.d4func.ocr_config import OCRConfig
                ocr_config = OCRConfig.get_default_config()

            ColorPrint.blue("[TeamFormationChecker] Initializing OCR engine...")
            ColorPrint.blue(f"[TeamFormationChecker] Using model: {ocr_config.rec_model_name}")

            self.ocr_engine = CnOCREngine(
                det_model_name=ocr_config.det_model_name,
                rec_model_name=ocr_config.rec_model_name
            )

            if self.ocr_engine.init():
                ColorPrint.green("[TeamFormationChecker] OCR engine initialized")
            else:
                ColorPrint.yellow("[TeamFormationChecker] OCR engine initialization failed")
                self.ocr_engine = None

        except Exception as e:
            ColorPrint.red(f"[TeamFormationChecker] Error initializing OCR: {e}")
            self.ocr_engine = None

    def execute(self) -> bool:
        """
        Execute team formation check and auto-formation if needed

        Workflow:
        1. Press 'O' to open team panel
        2. Wait for next tick
        3. OCR recognize "Find Team" region
        4. If "寻找" detected (no team), trigger auto team formation
        5. Otherwise, update status and close panel

        Returns:
            bool: True if check completed successfully
        """
        try:
            ColorPrint.blue("[TeamFormationChecker] Starting team formation check...")

            # Step 1: Press 'O' key to open team panel
            ColorPrint.blue("[TeamFormationChecker] Pressing 'O' key to open team panel")
            if not self._press_key('o', delay=0.2):
                ColorPrint.yellow("[TeamFormationChecker] Failed to press 'O' key")
                return False

            # Step 2: Wait for next tick (allow UI to update)
            ColorPrint.blue("[TeamFormationChecker] Waiting for UI to update...")
            self._wait_for_next_tick()

            # Step 3: Get "Find Team" region image from detected_regions
            if not self._has_find_team_region():
                ColorPrint.yellow("[TeamFormationChecker] Find Team region not available")
                return False

            find_team_image = self._get_find_team_region_image()

            if find_team_image is None:
                ColorPrint.yellow("[TeamFormationChecker] Find Team region image is None")
                return False

            # Step 4: OCR recognize text
            recognized_text = self._recognize_text(find_team_image)

            if recognized_text is None:
                ColorPrint.yellow("[TeamFormationChecker] OCR recognition failed")
                # Set unknown state
                self.d4_data.has_team = None
                return False

            # Step 5: Check if text starts with "寻找" (Find)
            has_team = not recognized_text.startswith("寻找")

            # Update shared data
            self.d4_data.has_team = has_team

            if has_team:
                ColorPrint.green(f"[TeamFormationChecker] ✓ Player HAS team (text: '{recognized_text}')")

                # Step 6a: Close panel by pressing 'O' again
                ColorPrint.blue("[TeamFormationChecker] Closing team panel")
                self._press_key('o', delay=0.1)

                return True
            else:
                ColorPrint.yellow(f"[TeamFormationChecker] ✗ Player has NO team (text: '{recognized_text}')")

                # Step 6b: Trigger automatic team formation
                ColorPrint.blue("[TeamFormationChecker] Triggering automatic team formation...")

                from d4utils.auto_team_formation import get_auto_team_formation
                auto_team = get_auto_team_formation()

                # Note: Panel is already open from step 1, no need to press 'O' again
                # Execute auto team formation (which will handle all subsequent steps)
                formation_result = auto_team.execute()

                if formation_result:
                    ColorPrint.green("[TeamFormationChecker] ✓ Auto team formation completed")
                    # Update shared data - now has team
                    self.d4_data.has_team = True
                else:
                    ColorPrint.yellow("[TeamFormationChecker] ⚠ Auto team formation failed")

                # Close panel after auto formation
                ColorPrint.blue("[TeamFormationChecker] Closing team panel")
                self._press_key('o', delay=0.1)

                return formation_result

        except Exception as e:
            ColorPrint.red(f"[TeamFormationChecker] Error executing check: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _has_find_team_region(self) -> bool:
        """Check if Find Team region is available in detected_regions"""
        if not hasattr(self.d4_data, 'detected_regions') or self.d4_data.detected_regions is None:
            return False

        if 'region_images' not in self.d4_data.detected_regions:
            return False

        return 'Find Team' in self.d4_data.detected_regions['region_images']

    def _get_find_team_region_image(self):
        """Get Find Team region image from detected_regions"""
        try:
            return self.d4_data.detected_regions['region_images']['Find Team']
        except Exception as e:
            ColorPrint.red(f"[TeamFormationChecker] Error getting Find Team image: {e}")
            return None

    def _recognize_text(self, image) -> Optional[str]:
        """
        Recognize text from image using OCR

        Args:
            image: PIL Image

        Returns:
            Recognized text or None if failed
        """
        if self.ocr_engine is None:
            ColorPrint.yellow("[TeamFormationChecker] OCR engine not available")
            return None

        try:
            # Save image to temp file for OCR
            import tempfile
            import os
            from PIL import Image

            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')

            # Create temporary file
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                temp_path = temp_file.name
                image.save(temp_path)

            try:
                # Perform OCR recognition
                result = self.ocr_engine.ocr(temp_path)

                if result and 'text' in result:
                    recognized_text = result['text'].strip()
                    ColorPrint.blue(f"[TeamFormationChecker] OCR result: '{recognized_text}'")
                    return recognized_text
                else:
                    return None

            finally:
                # Clean up temporary file
                try:
                    os.unlink(temp_path)
                except:
                    pass

        except Exception as e:
            ColorPrint.red(f"[TeamFormationChecker] Error in OCR recognition: {e}")
            return None


# Global singleton instance
_team_formation_checker = None


def get_team_formation_checker() -> TeamFormationChecker:
    """
    Get global team formation checker instance (singleton)

    Returns:
        Global TeamFormationChecker instance
    """
    global _team_formation_checker

    if _team_formation_checker is None:
        _team_formation_checker = TeamFormationChecker()
        ColorPrint.green("[Global] Team formation checker initialized")

    return _team_formation_checker
