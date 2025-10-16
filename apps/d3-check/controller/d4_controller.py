#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Controller
Main controller for Diablo IV operations

Registered to timer_manager for periodic execution
Uses interceptor pattern to control task execution without starting/stopping timers
"""

import os
import sys
import time
from pathlib import Path
from datetime import datetime

# Add project paths
current_dir = Path(__file__).parent.parent
sys.path.insert(0, str(current_dir))

from providor.common_imports import ColorPrint
from providor.providor_index import DIABLO_IV_WINDOW_TITLES, TMP_DIR
from d4utils.d4_state import get_d4_state
from d3utils.screenshot_provider import get_screenshot_provider
from share.game_interface_data import (
    D4_STANDARD_COORDS,
    D4_STANDARD_RESOLUTION_WIDTH,
    D4_STANDARD_RESOLUTION_HEIGHT,
    calculate_d4_scaled_coordinate,
    get_d4_interface_data
)
from d3utils.d3u_common.image_annotator_helper import create_annotator, get_image_pil, ANNOTATION_COLORS


class D4Controller:
    """
    D4 Main Controller

    Registered to timer_manager with 3-second interval
    Uses interceptor pattern: timer always runs but checks state before executing
    """

    def __init__(self):
        """Initialize D4 controller"""
        # Get state manager
        self.state = get_d4_state()

        # Get D4 interface data (independent shared data)
        self.d4_data = get_d4_interface_data()

        # Get screenshot provider (shared with D3)
        self.screenshot_provider = get_screenshot_provider()

        # D4-specific screenshot directory
        self.screenshot_dir = TMP_DIR / "d4_screenshots"
        self.screenshot_dir.mkdir(parents=True, exist_ok=True)

        # D4 annotated screenshots directory
        self.annotated_dir = TMP_DIR / "d4_annotated"
        self.annotated_dir.mkdir(parents=True, exist_ok=True)

        ColorPrint.green("[D4Controller] Initialized")
        ColorPrint.blue(f"[D4Controller] Screenshot directory: {self.screenshot_dir}")
        ColorPrint.blue(f"[D4Controller] Annotated directory: {self.annotated_dir}")

    def process(self):
        """
        Main processing method called by timer

        This method is called every 3 seconds by timer_manager
        Uses state to determine what operations to perform
        """
        try:
            # Check if EXP farming is running
            if not self.state.is_exp_farming_running():
                return  # Skip execution if not running

            ColorPrint.blue("[D4Controller] Processing EXP farming...")

            # Capture screenshot
            self._capture_screenshot()

        except Exception as e:
            ColorPrint.red(f"[D4Controller] Error in process: {e}")
            import traceback
            traceback.print_exc()

    def _annotate_screenshot_with_coordinates(self, screenshot_image, game_window_size, is_windowed):
        """
        Annotate screenshot with D4 coordinate points

        Args:
            screenshot_image: PIL Image object (game window screenshot)
            game_window_size: Tuple (width, height) of game window
            is_windowed: True if running in windowed mode

        Returns:
            PIL Image with annotations, or None on error
        """
        try:
            ColorPrint.blue("[D4Controller] Annotating screenshot with D4 coordinates...")

            # Create annotator from PIL Image (directly from memory, no disk I/O)
            annotator = create_annotator(screenshot_image)

            # Get actual window size
            actual_width, actual_height = game_window_size

            # Calculate effective dimensions for scaling
            if is_windowed:
                effective_actual_width = actual_width
                effective_actual_height = actual_height
                effective_standard_width = D4_STANDARD_RESOLUTION_WIDTH
                effective_standard_height = D4_STANDARD_RESOLUTION_HEIGHT
            else:
                # Fullscreen: add 31px threshold
                effective_actual_width = actual_width + 31
                effective_actual_height = actual_height + 31
                effective_standard_width = D4_STANDARD_RESOLUTION_WIDTH + 31
                effective_standard_height = D4_STANDARD_RESOLUTION_HEIGHT + 31

            # Calculate scale factors
            scale_x = effective_actual_width / effective_standard_width
            scale_y = effective_actual_height / effective_standard_height

            # Log window mode and scale factors
            ColorPrint.blue(f"[D4Coordinate] Window mode: {'Windowed' if is_windowed else 'Fullscreen'}")
            ColorPrint.blue(f"[D4Coordinate] Actual size: {actual_width}x{actual_height}")
            ColorPrint.blue(f"[D4Coordinate] Standard size: {D4_STANDARD_RESOLUTION_WIDTH}x{D4_STANDARD_RESOLUTION_HEIGHT}")
            ColorPrint.blue(f"[D4Coordinate] Scale factors: X={scale_x:.4f}, Y={scale_y:.4f}")

            # Define regions (rectangles) to visualize
            regions_to_draw = [
                # Bag region
                ("Bag", D4_STANDARD_COORDS.bag_top_left, D4_STANDARD_COORDS.bag_bottom_right, ANNOTATION_COLORS["red"]),

                # Blacksmith menu
                ("Blacksmith Menu", D4_STANDARD_COORDS.blacksmith_menu_start, D4_STANDARD_COORDS.blacksmith_menu_end, ANNOTATION_COLORS["orange"]),

                # Currency (Whispering Obols)
                ("Whisper Obols", D4_STANDARD_COORDS.whisper_obols_region_start, D4_STANDARD_COORDS.whisper_obols_region_end, ANNOTATION_COLORS["purple"]),

                # Equipment regions
                ("Equipment Left", D4_STANDARD_COORDS.equipment_left_region_start, D4_STANDARD_COORDS.equipment_left_region_end, ANNOTATION_COLORS["spring_green"]),
                ("Equipment Right", D4_STANDARD_COORDS.equipment_right_region_start, D4_STANDARD_COORDS.equipment_right_region_end, ANNOTATION_COLORS["sky_blue"]),

                # Blacksmith function region
                ("Blacksmith Function", D4_STANDARD_COORDS.blacksmith_function_region_start, D4_STANDARD_COORDS.blacksmith_function_region_end, ANNOTATION_COLORS["violet"]),

                # Experience bar
                ("EXP Bar", D4_STANDARD_COORDS.exp_bar_region_start, D4_STANDARD_COORDS.exp_bar_region_end, ANNOTATION_COLORS["green"]),

                # Minimap
                ("Minimap", D4_STANDARD_COORDS.minimap_region_start, D4_STANDARD_COORDS.minimap_region_end, ANNOTATION_COLORS["blue"]),

                # Map name
                ("Map Name", D4_STANDARD_COORDS.map_name_region_start, D4_STANDARD_COORDS.map_name_region_end, ANNOTATION_COLORS["gold"]),

                # Quest text
                ("Quest Text", D4_STANDARD_COORDS.quest_text_region_start, D4_STANDARD_COORDS.quest_text_region_end, ANNOTATION_COLORS["yellow"]),

                # Team count region
                ("Team Count", D4_STANDARD_COORDS.team_count_region_start, D4_STANDARD_COORDS.team_count_region_end, ANNOTATION_COLORS["magenta"]),

                # Team vote region
                ("Team Vote", D4_STANDARD_COORDS.team_vote_region_start, D4_STANDARD_COORDS.team_vote_region_end, ANNOTATION_COLORS["coral"]),
            ]

            # Define points to visualize
            points_to_draw = [
                # Team management buttons
                ("Edit Team", D4_STANDARD_COORDS.edit_team_button, ANNOTATION_COLORS["turquoise"]),
                ("Confirm Edit", D4_STANDARD_COORDS.confirm_edit_team, ANNOTATION_COLORS["salmon"]),
                ("Idle Min Tier", D4_STANDARD_COORDS.idle_team_min_tier, ANNOTATION_COLORS["khaki"]),
                ("Idle Max Tier", D4_STANDARD_COORDS.idle_team_max_tier, ANNOTATION_COLORS["mint"]),
                ("Idle Activity", D4_STANDARD_COORDS.idle_activity_selection, ANNOTATION_COLORS["peach"]),
                ("Add Idle Team", D4_STANDARD_COORDS.add_idle_team, ANNOTATION_COLORS["aqua"]),

                # Health orb
                ("Health Orb", D4_STANDARD_COORDS.health_orb_point, ANNOTATION_COLORS["red"]),

                # Team vote confirm (corrected position)
                ("Accept Vote", D4_STANDARD_COORDS.team_vote_confirm_point, ANNOTATION_COLORS["rose"]),

                # Game start button
                ("Start Game", D4_STANDARD_COORDS.start_game_button, ANNOTATION_COLORS["navy"]),
            ]

            # Define lines to visualize (start, end, label, color)
            lines_to_draw = [
                # Dungeon progress bar
                ("Dungeon Progress", D4_STANDARD_COORDS.dungeon_progress_start, D4_STANDARD_COORDS.dungeon_progress_end, ANNOTATION_COLORS["olive"]),
            ]

            # Draw all regions as rectangles
            for label, start_coord, end_coord, color in regions_to_draw:
                # Calculate scaled coordinates
                scaled_start = calculate_d4_scaled_coordinate(start_coord, game_window_size, is_windowed)
                scaled_end = calculate_d4_scaled_coordinate(end_coord, game_window_size, is_windowed)

                # Log region details
                ColorPrint.green(
                    f"[D4Region] {label}: "
                    f"Std({start_coord[0]},{start_coord[1]})-({end_coord[0]},{end_coord[1]}) → "
                    f"Actual({scaled_start[0]},{scaled_start[1]})-({scaled_end[0]},{scaled_end[1]})"
                )

                # Draw rectangle
                annotator.draw_rectangle(
                    top_left=scaled_start,
                    bottom_right=scaled_end,
                    color=color,
                    thickness=2,
                    label=label
                )

            # Draw all lines
            for label, start_coord, end_coord, color in lines_to_draw:
                # Calculate scaled coordinates
                scaled_start = calculate_d4_scaled_coordinate(start_coord, game_window_size, is_windowed)
                scaled_end = calculate_d4_scaled_coordinate(end_coord, game_window_size, is_windowed)

                # Log line details
                ColorPrint.green(
                    f"[D4Line] {label}: "
                    f"Std({start_coord[0]},{start_coord[1]})-({end_coord[0]},{end_coord[1]}) → "
                    f"Actual({scaled_start[0]},{scaled_start[1]})-({scaled_end[0]},{scaled_end[1]})"
                )

                # Draw line
                annotator.draw_line(
                    start=scaled_start,
                    end=scaled_end,
                    color=color,
                    thickness=3
                )

                # Draw label at midpoint
                mid_x = (scaled_start[0] + scaled_end[0]) // 2
                mid_y = (scaled_start[1] + scaled_end[1]) // 2
                annotator.draw_text(
                    text=label,
                    position=(mid_x, mid_y - 10),
                    color=(255, 255, 255),
                    font_scale=0.4,
                    thickness=1,
                    background_color=color
                )

            # Draw all points
            for label, standard_coord, color in points_to_draw:
                # Calculate scaled coordinate
                scaled_coord = calculate_d4_scaled_coordinate(
                    standard_coord,
                    game_window_size,
                    is_windowed
                )
                scaled_x, scaled_y = scaled_coord

                # Log calculation details
                ColorPrint.green(
                    f"[D4Point] {label}: "
                    f"Std({standard_coord[0]},{standard_coord[1]}) → "
                    f"Scale({scale_x:.4f},{scale_y:.4f}) → "
                    f"Actual({scaled_x},{scaled_y})"
                )

                # Draw point (filled circle)
                annotator.draw_circle(
                    center=scaled_coord,
                    radius=8,
                    color=color,
                    thickness=-1  # Filled
                )

                # Draw crosshair (two perpendicular lines)
                crosshair_size = 20
                annotator.draw_line(
                    start=(scaled_x - crosshair_size, scaled_y),
                    end=(scaled_x + crosshair_size, scaled_y),
                    color=(255, 255, 255),  # White crosshair
                    thickness=2
                )
                annotator.draw_line(
                    start=(scaled_x, scaled_y - crosshair_size),
                    end=(scaled_x, scaled_y + crosshair_size),
                    color=(255, 255, 255),  # White crosshair
                    thickness=2
                )

                # Draw label with coordinate
                annotator.draw_text(
                    text=f"{label} ({scaled_x},{scaled_y})",
                    position=(scaled_x + 15, scaled_y - 10),
                    color=(255, 255, 255),
                    font_scale=0.4,
                    thickness=1,
                    background_color=color
                )

            # Get annotated image as PIL Image (helper handles BGR→RGB conversion)
            annotated_image_pil = get_image_pil(annotator)

            ColorPrint.green("[D4Controller] Screenshot annotation completed")

            return annotated_image_pil

        except Exception as e:
            ColorPrint.red(f"[D4Controller] Error annotating screenshot: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _capture_screenshot(self):
        """Capture D4 game screenshot"""
        try:
            ColorPrint.blue("[D4Controller] Capturing D4 screenshot...")

            # Generate new screenshot using optimized capture
            screenshot_data = self.screenshot_provider.gen(
                use_optimized_capture=True,
                window_titles=DIABLO_IV_WINDOW_TITLES
            )

            if screenshot_data is None:
                ColorPrint.yellow("[D4Controller] Failed to capture screenshot")
                self.state.set_window_info(False, None, "", (0, 0), (0, 0))
                return

            # Update window state
            if screenshot_data.game_window_size:
                self.state.set_window_info(
                    detected=True,
                    hwnd=None,  # hwnd not available from screenshot_data
                    title="",   # title not available from screenshot_data
                    size=screenshot_data.game_window_size,
                    position=screenshot_data.window_offset
                )

                # Update D4 interface data
                self.d4_data.game_window_size = screenshot_data.game_window_size
                self.d4_data.fullscreen_size = screenshot_data.fullscreen_size
                self.d4_data.window_offset = screenshot_data.window_offset
                self.d4_data.game_window_image = screenshot_data.game_window_image
                self.d4_data.fullscreen_image = screenshot_data.fullscreen_image
                self.d4_data.timestamp = datetime.now().isoformat()
            else:
                self.state.set_window_info(False, None, "", (0, 0), (0, 0))

            # Save screenshot to D4-specific directory
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            screenshot_filename = f"d4_exp_farming_{timestamp}.png"
            screenshot_path = self.screenshot_dir / screenshot_filename

            # Save game window image
            if screenshot_data.game_window_image:
                screenshot_data.game_window_image.save(screenshot_path)
                ColorPrint.green(f"[D4Controller] Screenshot saved: {screenshot_path}")

                # Update state with screenshot info
                self.state.set_last_screenshot(str(screenshot_path), time.time())

                # Annotate screenshot with coordinate points (from memory, not disk)
                is_windowed = self.d4_data.is_windowed_mode()
                annotated_image = self._annotate_screenshot_with_coordinates(
                    screenshot_data.game_window_image,  # Pass PIL Image directly from memory
                    screenshot_data.game_window_size,
                    is_windowed
                )

                # Save annotated image
                if annotated_image:
                    annotated_filename = f"d4_annotated_{timestamp}.png"
                    annotated_path = self.annotated_dir / annotated_filename
                    annotated_image.save(annotated_path)
                    ColorPrint.green(f"[D4Controller] Annotated screenshot saved: {annotated_path}")

                    # Update D4 interface data
                    self.d4_data.last_annotated_screenshot_path = str(annotated_path)
                    ColorPrint.blue(f"[D4Controller] Recognition result saved: {annotated_path}")
            else:
                ColorPrint.yellow("[D4Controller] No game window image to save")

        except Exception as e:
            ColorPrint.red(f"[D4Controller] Error capturing screenshot: {e}")
            import traceback
            traceback.print_exc()

    def start_exp_farming(self):
        """
        Start EXP farming

        Sets state to trigger screenshot capture in timer callback
        """
        self.state.set_exp_farming_running(True)
        ColorPrint.green("[D4Controller] EXP farming started")

    def stop_exp_farming(self):
        """
        Stop EXP farming

        Sets state to skip screenshot capture in timer callback
        """
        self.state.set_exp_farming_running(False)
        ColorPrint.green("[D4Controller] EXP farming stopped")

    def is_exp_farming_running(self) -> bool:
        """
        Check if EXP farming is running

        Returns:
            True if running, False otherwise
        """
        return self.state.is_exp_farming_running()

    def get_state_dict(self) -> dict:
        """
        Get current D4 state

        Returns:
            Dictionary with current state
        """
        return self.state.get_state_dict()


# Global D4 controller instance (singleton)
_d4_controller = None


def get_d4_controller() -> D4Controller:
    """
    Get global D4 controller instance (singleton)

    Returns:
        Global D4Controller instance
    """
    global _d4_controller

    if _d4_controller is None:
        _d4_controller = D4Controller()
        ColorPrint.green("[Global] D4 controller initialized")

    return _d4_controller


# Example usage
if __name__ == "__main__":
    # Get controller instance
    controller = get_d4_controller()

    # Start EXP farming
    controller.start_exp_farming()

    # Simulate timer calls
    print("\nSimulating timer calls...")
    for i in range(3):
        print(f"\n--- Timer call #{i+1} ---")
        controller.process()
        time.sleep(3)

    # Stop EXP farming
    controller.stop_exp_farming()

    # One more call (should be skipped)
    print("\n--- Timer call #4 (should be skipped) ---")
    controller.process()

    print(f"\nFinal state: {controller.get_state_dict()}")
