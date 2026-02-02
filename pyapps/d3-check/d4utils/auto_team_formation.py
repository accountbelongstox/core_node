#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auto Team Formation Manager
Automatically creates team when "寻找队伍" (Find Team) is detected
"""

import sys
import time
from pathlib import Path
from typing import Optional

from share.project_path import ensure_d3_check_in_sys_path, get_project_root
ensure_d3_check_in_sys_path()

# Add pycore path
pycore_path = get_project_root().parent / "pycore"
sys.path.insert(0, str(pycore_path))

from pycore.pyfoundations.color_print import ColorPrint
from d4utils.d4_operation_base import D4OperationBase


class D4_AutoTeamFormation(D4OperationBase):
    """
    Automatic Team Formation Manager

    Implements complete auto-team formation workflow:
    1. Check if team formation is needed (OCR "寻找" detection)
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
        ColorPrint.green("[D4_AutoTeamFormation] Initialized")

    def execute(self, panel_already_open: bool = True) -> bool:
        """
        Execute automatic team formation workflow

        Args:
            panel_already_open: True if team panel is already open (default)

        Returns:
            bool: True if team formation completed or not needed
        """
        try:
            ColorPrint.blue("\n" + "="*80)
            ColorPrint.blue("[D4_AutoTeamFormation] Starting auto team formation workflow...")
            ColorPrint.blue("="*80)

            # Step 1: Check if team formation is needed
            if not self._need_team_formation():
                ColorPrint.green("[D4_AutoTeamFormation] ✓ Team already formed, skipping")
                return True

            ColorPrint.blue("[D4_AutoTeamFormation] Team formation needed, starting process...")

            # Note: Panel is already open by TeamFormationChecker, no need to press 'O'

            # Step 2: Click "Find Team" / "寻找队伍" region
            if not self._click_find_team():
                ColorPrint.red("[D4_AutoTeamFormation] ✗ Failed to click Find Team")
                return False

            # Step 3: Set minimum level
            if not self._set_min_level(80):
                ColorPrint.red("[D4_AutoTeamFormation] ✗ Failed to set min level")
                return False

            # Step 4: Set maximum level
            if not self._set_max_level(120):
                ColorPrint.red("[D4_AutoTeamFormation] ✗ Failed to set max level")
                return False

            # Step 5: Select party activity (row 5 of 7 - 倒数第3行)
            if not self._select_party_activity(row=5):
                ColorPrint.red("[D4_AutoTeamFormation] ✗ Failed to select party activity")
                return False

            # Step 6: Confirm activity levels
            if not self._confirm_activity_levels(80, 120):
                ColorPrint.red("[D4_AutoTeamFormation] ✗ Failed to confirm activity levels")
                return False

            # Step 7: Submit party
            if not self._submit_party():
                ColorPrint.red("[D4_AutoTeamFormation] ✗ Failed to submit party")
                return False

            # Success!
            print("\n" + "="*80)
            ColorPrint.green("[D4_AutoTeamFormation] ✓ 自动挂机准备完毕")
            print("="*80 + "\n")

            return True

        except Exception as e:
            ColorPrint.red(f"[D4_AutoTeamFormation] Error in execute: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _need_team_formation(self) -> bool:
        """
        Check if team formation is needed

        Checks OCR result of "Find Team" region.
        If text starts with "寻找" (Find), team formation is needed.

        Returns:
            bool: True if needs team formation
        """
        try:
            ColorPrint.blue("[D4_AutoTeamFormation] Checking if team formation is needed...")

            # Check if detected_regions has OCR data
            if not hasattr(self.d4_data, 'detected_regions') or not self.d4_data.detected_regions:
                ColorPrint.yellow("[D4_AutoTeamFormation] No detected_regions available, assuming team needed")
                return True

            if 'ocr_results' not in self.d4_data.detected_regions:
                ColorPrint.yellow("[D4_AutoTeamFormation] No OCR results available, assuming team needed")
                return True

            ocr_results = self.d4_data.detected_regions['ocr_results']

            # Check "Find Team" region OCR result
            if 'Find Team' not in ocr_results:
                ColorPrint.yellow("[D4_AutoTeamFormation] No 'Find Team' OCR result, assuming team needed")
                return True

            find_team_text = ocr_results['Find Team']
            ColorPrint.blue(f"[D4_AutoTeamFormation] Find Team OCR result: '{find_team_text}'")

            # If text starts with "寻找", team formation is needed
            if find_team_text.startswith("寻找"):
                ColorPrint.blue("[D4_AutoTeamFormation] Detected '寻找' - team formation needed")
                return True
            else:
                ColorPrint.blue("[D4_AutoTeamFormation] Team already formed")
                return False

        except Exception as e:
            ColorPrint.red(f"[D4_AutoTeamFormation] Error checking team formation need: {e}")
            # On error, assume team is needed to continue the workflow
            return True

    def _click_find_team(self) -> bool:
        """
        Click "Find Team" / "寻找队伍" region

        Returns:
            bool: True if successful
        """
        try:
            ColorPrint.blue("[D4_AutoTeamFormation] Step 2: Clicking Find Team region...")

            # Click region center with random offset
            result = self.click_region_center_random(
                "Find Team",
                margin=5,
                delay_ms=(100, 300)
            )

            if result:
                ColorPrint.green("[D4_AutoTeamFormation] ✓ Find Team clicked")

            return result

        except Exception as e:
            ColorPrint.red(f"[D4_AutoTeamFormation] Error clicking Find Team: {e}")
            return False

    def _set_min_level(self, level: int) -> bool:
        """
        Set minimum level

        Args:
            level: Minimum level to set

        Returns:
            bool: True if successful
        """
        try:
            ColorPrint.blue(f"[D4_AutoTeamFormation] Step 3: Setting min level to {level}...")

            # Click min level input point (410, 550)
            min_level_point = self.REGION_COORDS['Min Level Input']
            if not self._click_point(min_level_point, use_standard_resolution=True, duration=0.2):
                return False

            # Small delay after click
            time.sleep(0.1)

            # Type the number
            if not self.type_number(level, char_delay_ms=(50, 100)):
                return False

            ColorPrint.green(f"[D4_AutoTeamFormation] ✓ Min level set to {level}")
            return True

        except Exception as e:
            ColorPrint.red(f"[D4_AutoTeamFormation] Error setting min level: {e}")
            return False

    def _set_max_level(self, level: int) -> bool:
        """
        Set maximum level

        Args:
            level: Maximum level to set

        Returns:
            bool: True if successful
        """
        try:
            ColorPrint.blue(f"[D4_AutoTeamFormation] Step 4: Setting max level to {level}...")

            # Click max level input point (805, 550)
            max_level_point = self.REGION_COORDS['Max Level Input']
            if not self._click_point(max_level_point, use_standard_resolution=True, duration=0.2):
                return False

            # Small delay after click
            time.sleep(0.1)

            # Type the number
            if not self.type_number(level, char_delay_ms=(50, 100)):
                return False

            ColorPrint.green(f"[D4_AutoTeamFormation] ✓ Max level set to {level}")
            return True

        except Exception as e:
            ColorPrint.red(f"[D4_AutoTeamFormation] Error setting max level: {e}")
            return False

    def _select_party_activity(self, row: int) -> bool:
        """
        Select party activity from dropdown (倒数第3行 = row 5 of 7)

        Args:
            row: Target row number (1-based, row 5 = 倒数第3行)

        Returns:
            bool: True if successful
        """
        try:
            ColorPrint.blue(f"[D4_AutoTeamFormation] Step 5: Selecting party activity (row {row}/7)...")

            # Step 5a: Click dropdown point (375, 456) to open menu
            ColorPrint.blue("[D4_AutoTeamFormation] Clicking Activity Dropdown...")
            activity_dropdown_point = self.REGION_COORDS['Activity Dropdown']
            if not self._click_point(activity_dropdown_point, use_standard_resolution=True, duration=0.2):
                return False

            # Wait for dropdown to expand
            ColorPrint.blue("[D4_AutoTeamFormation] Waiting for dropdown to expand...")
            time.sleep(0.3)

            # Step 5b: Calculate and click target row in Activity Selection Area
            ColorPrint.blue(f"[D4_AutoTeamFormation] Calculating row {row} position...")

            # Use Activity Selection Area coordinates: (315, 445, 640, 700)
            x1, y1, x2, y2 = self.REGION_COORDS['Activity Selection Area']

            # Calculate row height
            region_height = y2 - y1  # 700 - 445 = 255
            row_height = region_height / 7  # 255 / 7 = 36.43 per row

            # Calculate target row center Y (1-based, so row 5 = 4.5 * row_height from top)
            target_y = y1 + (row - 0.5) * row_height
            center_x = (x1 + x2) // 2

            # Add random offset
            import random
            offset_x = random.randint(-5, 5)
            offset_y = random.randint(-5, 5)

            click_x = int(center_x + offset_x)
            click_y = int(target_y + offset_y)

            ColorPrint.blue(f"[D4_AutoTeamFormation] Clicking row {row} at ({click_x}, {click_y})...")

            # Click the calculated point
            point = (click_x, click_y)
            if not self._click_point(point, use_standard_resolution=True, duration=0.2):
                return False

            # Random delay after selection
            delay_seconds = random.uniform(100, 200) / 1000.0
            time.sleep(delay_seconds)

            ColorPrint.green(f"[D4_AutoTeamFormation] ✓ Party activity row {row} selected")
            return True

        except Exception as e:
            ColorPrint.red(f"[D4_AutoTeamFormation] Error selecting party activity: {e}")
            import traceback
            traceback.print_exc()
            return False

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
        try:
            ColorPrint.blue(f"[D4_AutoTeamFormation] Step 6: Confirming activity levels ({min_level}-{max_level})...")

            # Set activity min level (reuse Min Level Input: 410, 550)
            ColorPrint.blue(f"[D4_AutoTeamFormation] Setting activity min level to {min_level}...")
            min_level_point = self.REGION_COORDS['Min Level Input']
            if not self._click_point(min_level_point, use_standard_resolution=True, duration=0.2):
                return False

            time.sleep(0.1)

            if not self.type_number(min_level, char_delay_ms=(50, 100)):
                return False

            # Set activity max level (reuse Max Level Input: 805, 550)
            ColorPrint.blue(f"[D4_AutoTeamFormation] Setting activity max level to {max_level}...")
            max_level_point = self.REGION_COORDS['Max Level Input']
            if not self._click_point(max_level_point, use_standard_resolution=True, duration=0.2):
                return False

            time.sleep(0.1)

            if not self.type_number(max_level, char_delay_ms=(50, 100)):
                return False

            ColorPrint.green(f"[D4_AutoTeamFormation] ✓ Activity levels confirmed ({min_level}-{max_level})")
            return True

        except Exception as e:
            ColorPrint.red(f"[D4_AutoTeamFormation] Error confirming activity levels: {e}")
            return False

    def _submit_party(self) -> bool:
        """
        Submit party formation

        Uses Confirm Team Button region: (728, 861, 831, 879)

        Returns:
            bool: True if successful
        """
        try:
            ColorPrint.blue("[D4_AutoTeamFormation] Step 7: Submitting party...")

            # Get Confirm Team Button region
            x1, y1, x2, y2 = self.REGION_COORDS['Confirm Team Button']

            # Calculate center point
            center_x = (x1 + x2) // 2
            center_y = (y1 + y2) // 2

            # Add small random offset
            import random
            offset_x = random.randint(-3, 3)
            offset_y = random.randint(-3, 3)

            click_point = (center_x + offset_x, center_y + offset_y)

            ColorPrint.blue(f"[D4_AutoTeamFormation] Clicking submit button at {click_point}...")

            # Click submit button
            if not self._click_point(click_point, use_standard_resolution=True, duration=0.2):
                return False

            # Wait for submission to complete
            ColorPrint.blue("[D4_AutoTeamFormation] Waiting for submission to complete...")
            time.sleep(0.5)

            ColorPrint.green("[D4_AutoTeamFormation] ✓ Party submitted")
            return True

        except Exception as e:
            ColorPrint.red(f"[D4_AutoTeamFormation] Error submitting party: {e}")
            return False


# Global instance (singleton)
_auto_team_formation = None


def get_d4_auto_team_formation() -> D4_AutoTeamFormation:
    """
    Get global D4_AutoTeamFormation instance (singleton)

    Returns:
        Global D4_AutoTeamFormation instance
    """
    global _auto_team_formation

    if _auto_team_formation is None:
        _auto_team_formation = D4_AutoTeamFormation()
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
