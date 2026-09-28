#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auto Team Formation Manager
Automatically creates team when Find Team is detected (OCR text locale-specific, e.g. CN "寻找队伍")
"""

import random
import time
from typing import Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from d4utils.d4_operation_base import D4OperationBase


class D4AutoTeamFormation(D4OperationBase):
    """
    Automatic Team Formation Manager

    Implements complete auto-team formation workflow:
    1. Check if team formation is needed (OCR Find-Team detection)
    2. Click "Find Team" region
    3. Set min level (80)
    4. Set max level (120)
    5. Select party activity (row 5 of 7)
    6. Confirm activity levels (80/120)
    7. Submit party
    """

    # Region coordinates mapping (from D4StandardCoordinates)
    # These coordinates are in standard resolution (1763x1126) and will be scaled automatically
    REGION_COORDS = {
        # Team search and formation interface (from D4StandardCoordinates)
        'Find Team': (155, 94, 275, 129),  # find_team_region
        'Form Team': (292, 73, 406, 126),  # form_team_region
        'Activity Selection': (360, 414, 591, 426),  # activity_selection_region

        # Team management (from D4StandardCoordinates)
        'Min Level Input': (410, 550),  # idle_team_min_tier (point)
        'Max Level Input': (805, 550),  # idle_team_max_tier (point)
        'Activity Dropdown': (375, 456),  # idle_activity_selection (point)

        # Activity selection dropdown menu (7 rows - user provided)
        'Activity Selection Area': (315, 445, 640, 700),

        # Submission buttons (from D4StandardCoordinates)
        'Confirm Team Button': (728, 861, 831, 879),  # confirm_team_button_region
        'Edit Team Button': (950, 265),  # edit_team_button (point)
        'Confirm Edit Team': (730, 950),  # confirm_edit_team (point)
    }

    def __init__(self):
        """Initialize auto team formation manager"""
        super().__init__()
        ColorPrint.green("[D4AutoTeamFormation] Initialized")

    def execute(self, panel_already_open: bool = True) -> bool:
        """
        Execute automatic team formation workflow

        Args:
            panel_already_open: True if team panel is already open (default)

        Returns:
            bool: True if team formation completed or not needed
        """
        ColorPrint.blue("\n" + "="*80)
        ColorPrint.blue("[D4AutoTeamFormation] Starting auto team formation workflow...")
        ColorPrint.blue("="*80)
        if not self._need_team_formation():
            ColorPrint.green("[D4AutoTeamFormation] ✓ Team already formed, skipping")
            return True
        ColorPrint.blue("[D4AutoTeamFormation] Team formation needed, starting process...")
        if not self._click_find_team():
            ColorPrint.red("[D4AutoTeamFormation] ✗ Failed to click Find Team")
            return False
        if not self._set_min_level(80):
            ColorPrint.red("[D4AutoTeamFormation] ✗ Failed to set min level")
            return False
        if not self._set_max_level(120):
            ColorPrint.red("[D4AutoTeamFormation] ✗ Failed to set max level")
            return False
        if not self._select_party_activity(row=5):
            ColorPrint.red("[D4AutoTeamFormation] ✗ Failed to select party activity")
            return False
        if not self._confirm_activity_levels(80, 120):
            ColorPrint.red("[D4AutoTeamFormation] ✗ Failed to confirm activity levels")
            return False
        if not self._submit_party():
            ColorPrint.red("[D4AutoTeamFormation] ✗ Failed to submit party")
            return False
        print("\n" + "="*80)
        ColorPrint.green("[D4AutoTeamFormation] ✓ Auto team formation ready")
        print("="*80 + "\n")
        return True

    def _need_team_formation(self) -> bool:
        """
        Check if team formation is needed

        Checks OCR result of "Find Team" region.
        If OCR text indicates Find Team, team formation is needed.

        Returns:
            bool: True if needs team formation
        """
        ColorPrint.blue("[D4AutoTeamFormation] Checking if team formation is needed...")
        if not self.d4_data.detected_regions:
            ColorPrint.yellow("[D4AutoTeamFormation] No detected_regions available, assuming team needed")
            return True
        if 'ocr_results' not in self.d4_data.detected_regions:
            ColorPrint.yellow("[D4AutoTeamFormation] No OCR results available, assuming team needed")
            return True
        ocr_results = self.d4_data.detected_regions['ocr_results']
        if 'Find Team' not in ocr_results:
            ColorPrint.yellow("[D4AutoTeamFormation] No 'Find Team' OCR result, assuming team needed")
            return True
        find_team_text = ocr_results['Find Team']
        ColorPrint.blue(f"[D4AutoTeamFormation] Find Team OCR result: '{find_team_text}'")
        if find_team_text.startswith("寻找"):
            ColorPrint.blue("[D4AutoTeamFormation] Detected Find Team - team formation needed")
            return True
        ColorPrint.blue("[D4AutoTeamFormation] Team already formed")
        return False

    def _click_find_team(self) -> bool:
        """
        Click Find Team region

        Returns:
            bool: True if successful
        """
        ColorPrint.blue("[D4AutoTeamFormation] Step 2: Clicking Find Team region...")
        result = self.click_region_center_random(
            "Find Team",
            margin=5,
            delay_ms=(100, 300)
        )
        if result:
            ColorPrint.green("[D4AutoTeamFormation] ✓ Find Team clicked")
        return result

    def _set_min_level(self, level: int) -> bool:
        """
        Set minimum level

        Args:
            level: Minimum level to set

        Returns:
            bool: True if successful
        """
        ColorPrint.blue(f"[D4AutoTeamFormation] Step 3: Setting min level to {level}...")
        min_level_point = self.REGION_COORDS['Min Level Input']
        if not self._click_point(min_level_point, use_standard_resolution=True, duration=0.2):
            return False
        time.sleep(0.1)
        if not self.type_number(level, char_delay_ms=(50, 100)):
            return False
        ColorPrint.green(f"[D4AutoTeamFormation] ✓ Min level set to {level}")
        return True

    def _set_max_level(self, level: int) -> bool:
        """
        Set maximum level

        Args:
            level: Maximum level to set

        Returns:
            bool: True if successful
        """
        ColorPrint.blue(f"[D4AutoTeamFormation] Step 4: Setting max level to {level}...")
        max_level_point = self.REGION_COORDS['Max Level Input']
        if not self._click_point(max_level_point, use_standard_resolution=True, duration=0.2):
            return False
        time.sleep(0.1)
        if not self.type_number(level, char_delay_ms=(50, 100)):
            return False
        ColorPrint.green(f"[D4AutoTeamFormation] ✓ Max level set to {level}")
        return True

    def _select_party_activity(self, row: int) -> bool:
        """
        Select party activity from dropdown (row 5 of 7, 3rd from bottom)

        Args:
            row: Target row number (1-based, row 5 = 3rd from bottom)

        Returns:
            bool: True if successful
        """
        ColorPrint.blue(f"[D4AutoTeamFormation] Step 5: Selecting party activity (row {row}/7)...")
        ColorPrint.blue("[D4AutoTeamFormation] Clicking Activity Dropdown...")
        activity_dropdown_point = self.REGION_COORDS['Activity Dropdown']
        if not self._click_point(activity_dropdown_point, use_standard_resolution=True, duration=0.2):
            return False
        ColorPrint.blue("[D4AutoTeamFormation] Waiting for dropdown to expand...")
        time.sleep(0.3)
        ColorPrint.blue(f"[D4AutoTeamFormation] Calculating row {row} position...")
        x1, y1, x2, y2 = self.REGION_COORDS['Activity Selection Area']
        region_height = y2 - y1
        row_height = region_height / 7
        target_y = y1 + (row - 0.5) * row_height
        center_x = (x1 + x2) // 2
        offset_x = random.randint(-5, 5)
        offset_y = random.randint(-5, 5)
        click_x = int(center_x + offset_x)
        click_y = int(target_y + offset_y)
        ColorPrint.blue(f"[D4AutoTeamFormation] Clicking row {row} at ({click_x}, {click_y})...")
        point = (click_x, click_y)
        if not self._click_point(point, use_standard_resolution=True, duration=0.2):
            return False
        delay_seconds = random.uniform(100, 200) / 1000.0
        time.sleep(delay_seconds)
        ColorPrint.green(f"[D4AutoTeamFormation] ✓ Party activity row {row} selected")
        return True

    def _confirm_activity_levels(self, min_level: int, max_level: int) -> bool:
        """
        Confirm activity minimum and maximum levels

        NOTE: After selecting activity, the same input fields may be reused.
        If separate fields appear, coordinates need to be added to REGION_COORDS.
        For now, reusing the same min/max level input points.

        Args:
            min_level: Activity minimum level
            max_level: Activity maximum level

        Returns:
            bool: True if successful
        """
        ColorPrint.blue(f"[D4AutoTeamFormation] Step 6: Confirming activity levels ({min_level}-{max_level})...")
        ColorPrint.blue(f"[D4AutoTeamFormation] Setting activity min level to {min_level}...")
        min_level_point = self.REGION_COORDS['Min Level Input']
        if not self._click_point(min_level_point, use_standard_resolution=True, duration=0.2):
            return False
        time.sleep(0.1)
        if not self.type_number(min_level, char_delay_ms=(50, 100)):
            return False
        ColorPrint.blue(f"[D4AutoTeamFormation] Setting activity max level to {max_level}...")
        max_level_point = self.REGION_COORDS['Max Level Input']
        if not self._click_point(max_level_point, use_standard_resolution=True, duration=0.2):
            return False
        time.sleep(0.1)
        if not self.type_number(max_level, char_delay_ms=(50, 100)):
            return False
        ColorPrint.green(f"[D4AutoTeamFormation] ✓ Activity levels confirmed ({min_level}-{max_level})")
        return True

    def _submit_party(self) -> bool:
        """
        Submit party formation

        Uses Confirm Team Button region: (728, 861, 831, 879)

        Returns:
            bool: True if successful
        """
        ColorPrint.blue("[D4AutoTeamFormation] Step 7: Submitting party...")
        x1, y1, x2, y2 = self.REGION_COORDS['Confirm Team Button']
        center_x = (x1 + x2) // 2
        center_y = (y1 + y2) // 2
        offset_x = random.randint(-3, 3)
        offset_y = random.randint(-3, 3)
        click_point = (center_x + offset_x, center_y + offset_y)
        ColorPrint.blue(f"[D4AutoTeamFormation] Clicking submit button at {click_point}...")
        if not self._click_point(click_point, use_standard_resolution=True, duration=0.2):
            return False
        ColorPrint.blue("[D4AutoTeamFormation] Waiting for submission to complete...")
        time.sleep(0.5)
        ColorPrint.green("[D4AutoTeamFormation] ✓ Party submitted")
        return True


# Global instance (singleton)
_auto_team_formation = None


def get_d4_auto_team_formation() -> D4AutoTeamFormation:
    """
    Get global D4AutoTeamFormation instance (singleton)

    Returns:
        Global D4AutoTeamFormation instance
    """
    global _auto_team_formation

    if _auto_team_formation is None:
        _auto_team_formation = D4AutoTeamFormation()
        ColorPrint.green("[Global] Auto team formation initialized")

    return _auto_team_formation


# Example usage
if __name__ == "__main__":
    # Get instance
    team_formation = get_d4_auto_team_formation()

    # Run team formation
    print("\nTesting auto team formation...")
    result = team_formation.run()

    if result:
        ColorPrint.green("\n✓ Auto team formation completed successfully")
    else:
        ColorPrint.red("\n✗ Auto team formation failed")
