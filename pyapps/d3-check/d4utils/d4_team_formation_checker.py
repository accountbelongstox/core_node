#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Team Formation Checker Operation
Checks if player has formed a team using OCR
"""

import sys
from pathlib import Path
from typing import Optional

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.third_party import get_third_package_PIL_Image
from pycore.pyfoundations.color_print import ColorPrint
from d4utils.d4_operation_base import D4OperationBase

Image = get_third_package_PIL_Image()
from share.game_interface_data import get_d4_interface_data
from d3utils.cnocr_engine_registry import get_cnocr_engine_for_task


class D4TeamFormationChecker(D4OperationBase):
    """
    Team Formation Checker Operation

    Workflow:
    1. Press 'O' key to open team panel
    2. Wait for next tick
    3. OCR recognize "Find Team" region
    4. If OCR text indicates Find Team (no team), player has no team
    5. Update shared data with result
    """

    def __init__(self):
        """Initialize team formation checker (OCR engine from registry)."""
        super().__init__()
        self.ocr_engine = get_cnocr_engine_for_task('quest_text')
        ColorPrint.green("[D4TeamFormationChecker] Initialized")

    def execute(self) -> bool:
        """
        Execute team formation check and auto-formation if needed

        Workflow:
        1. Press 'O' to open team panel
        2. Wait for next tick
        3. OCR recognize "Find Team" region
        4. If Find Team detected (no team), trigger auto team formation
        5. Otherwise, update status and close panel

        Returns:
            bool: True if check completed successfully
        """
        ColorPrint.blue("[D4TeamFormationChecker] Starting team formation check...")

        # Step 1: Press 'O' key to open team panel
        ColorPrint.blue("[D4TeamFormationChecker] Pressing 'O' key to open team panel")
        if not self._press_key('o', delay=0.2):
            ColorPrint.yellow("[D4TeamFormationChecker] Failed to press 'O' key")
            return False

        # Step 2: Wait for next tick (allow UI to update)
        ColorPrint.blue("[D4TeamFormationChecker] Waiting for UI to update...")
        self._wait_for_next_tick()

        # Step 3: Get "Find Team" region image from detected_regions
        if not self._has_find_team_region():
            ColorPrint.yellow("[D4TeamFormationChecker] Find Team region not available")
            return False

        find_team_image = self._get_find_team_region_image()

        if find_team_image is None:
            ColorPrint.yellow("[D4TeamFormationChecker] Find Team region image is None")
            return False

        # Step 4: OCR recognize text
        recognized_text = self._recognize_text(find_team_image)

        if recognized_text is None:
            ColorPrint.yellow("[D4TeamFormationChecker] OCR recognition failed")
            # Set unknown state
            self.d4_data.has_team = None
            return False

        # Step 5: Check if OCR text indicates no team (e.g. Find Team)
        has_team = not recognized_text.startswith("寻找")

        # Update shared data
        self.d4_data.has_team = has_team

        if has_team:
            ColorPrint.green(f"[D4TeamFormationChecker] ✓ Player HAS team (text: '{recognized_text}')")

            # Step 6a: Close panel by pressing 'O' again
            ColorPrint.blue("[D4TeamFormationChecker] Closing team panel")
            self._press_key('o', delay=0.1)

            return True
        else:
            ColorPrint.yellow(f"[D4TeamFormationChecker] ✗ Player has NO team (text: '{recognized_text}')")

            # Step 6b: Trigger automatic team formation
            ColorPrint.blue("[D4TeamFormationChecker] Triggering automatic team formation...")

            from d4utils.d4_auto_team_formation import get_d4_auto_team_formation
            auto_team = get_d4_auto_team_formation()

            # Note: Panel is already open from step 1, no need to press 'O' again
            # Execute auto team formation (which will handle all subsequent steps)
            formation_result = auto_team.execute()

            if formation_result:
                ColorPrint.green("[D4TeamFormationChecker] ✓ Auto team formation completed")
                # Update shared data - now has team
                self.d4_data.has_team = True
            else:
                ColorPrint.yellow("[D4TeamFormationChecker] ⚠ Auto team formation failed")

            # Close panel after auto formation
            ColorPrint.blue("[D4TeamFormationChecker] Closing team panel")
            self._press_key('o', delay=0.1)

            return formation_result

    def _has_find_team_region(self) -> bool:
        """Check if Find Team region is available in detected_regions"""
        if self.d4_data.detected_regions is None:
            return False

        if 'region_images' not in self.d4_data.detected_regions:
            return False

        return 'Find Team' in self.d4_data.detected_regions['region_images']

    def _get_find_team_region_image(self):
        """Get Find Team region image from detected_regions"""
        return self.d4_data.detected_regions['region_images'].get('Find Team')

    def _recognize_text(self, image) -> Optional[str]:
        """
        Recognize text from image using OCR

        Args:
            image: PIL Image

        Returns:
            Recognized text or None if failed
        """
        if self.ocr_engine is None:
            ColorPrint.yellow("[D4TeamFormationChecker] OCR engine not available")
            return None
        import os
        import tempfile
        if Image is None:
            return None
        if image.mode != 'RGB':
            image = image.convert('RGB')
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
            temp_path = temp_file.name
            image.save(temp_path)
        try:
            result = self.ocr_engine.ocr(temp_path)
            if result and 'text' in result:
                return result['text'].strip()
            return None
        finally:
            os.unlink(temp_path)


# Global singleton instance
_team_formation_checker = None


def get_d4_team_formation_checker() -> D4TeamFormationChecker:
    """
    Get global team formation checker instance (singleton)

    Returns:
        Global D4TeamFormationChecker instance
    """
    global _team_formation_checker

    if _team_formation_checker is None:
        _team_formation_checker = D4TeamFormationChecker()
        ColorPrint.green("[Global] Team formation checker initialized")

    return _team_formation_checker
