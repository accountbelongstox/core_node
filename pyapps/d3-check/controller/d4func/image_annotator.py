#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image Annotator for D4 Controller. 通过 get_image_annotator() 获取单例，禁止各处自行 new。
"""

import sys
from pathlib import Path

# Add project paths
current_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(current_dir))

from pycore.pyfoundations.color_print import ColorPrint
from providor.constants.d4 import D4_ANNOTATED_DIR
from share.game_interface_data import (
    D4_STANDARD_COORDS,
    D4_STANDARD_RESOLUTION_WIDTH,
    D4_STANDARD_RESOLUTION_HEIGHT,
    calculate_unified_scaled_coordinate,
)
from d3utils.d3u_common.image_annotator_helper import create_annotator, get_image_pil, ANNOTATION_COLORS


class ImageAnnotator:
    """
    Handles image annotation and visualization for D4
    
    Responsibilities:
    - Annotate screenshots with coordinate points
    - Draw regions, points, and lines
    - Save annotated images for debugging
    """

    def __init__(self):
        """Initialize image annotator"""
        ColorPrint.blue("[ImageAnnotator] Initialized")

    def _calculate_d4_scaled_coordinate(self, standard_coord, game_window_size, is_windowed):
        """
        Calculate scaled coordinate using original D4 logic
        
        Args:
            standard_coord: Standard coordinate (x, y)
            game_window_size: Tuple (width, height) of game window
            is_windowed: True if running in windowed mode
            
        Returns:
            Scaled coordinate (x, y)
        """
        actual_width, actual_height = game_window_size
        std_x, std_y = standard_coord
        
        # Calculate effective dimensions for scaling (original logic)
        if is_windowed:
            effective_actual_width = actual_width
            effective_actual_height = actual_height
            effective_standard_width = D4_STANDARD_RESOLUTION_WIDTH
            effective_standard_height = D4_STANDARD_RESOLUTION_HEIGHT
        else:
            # Fullscreen: add 31px threshold (original logic)
            effective_actual_width = actual_width + 31
            effective_actual_height = actual_height + 31
            effective_standard_width = D4_STANDARD_RESOLUTION_WIDTH + 31
            effective_standard_height = D4_STANDARD_RESOLUTION_HEIGHT + 31

        # Calculate scale factors
        scale_x = effective_actual_width / effective_standard_width
        scale_y = effective_actual_height / effective_standard_height
        
        # Apply scaling
        scaled_x = int(std_x * scale_x)
        scaled_y = int(std_y * scale_y)
        
        return (scaled_x, scaled_y)

    def annotate_screenshot_with_coordinates(self, screenshot_image, game_window_size, is_windowed):
        """
        Annotate screenshot with D4 coordinate points

        Args:
            screenshot_image: PIL Image object (game window screenshot)
            game_window_size: Tuple (width, height) of game window
            is_windowed: True if running in windowed mode

        Returns:
            PIL Image with annotations, or None on error
        """
        ColorPrint.blue("[ImageAnnotator] Annotating screenshot with D4 coordinates...")

        # Create annotator from PIL Image (directly from memory, no disk I/O)
        annotator = create_annotator(screenshot_image)

        # Get actual window size
        actual_width, actual_height = game_window_size

        # Calculate effective dimensions for scaling (original logic)
        if is_windowed:
            effective_actual_width = actual_width
            effective_actual_height = actual_height
            effective_standard_width = D4_STANDARD_RESOLUTION_WIDTH
            effective_standard_height = D4_STANDARD_RESOLUTION_HEIGHT
        else:
            # Fullscreen: add 31px threshold (original logic)
            effective_actual_width = actual_width + 31
            effective_actual_height = actual_height + 31
            effective_standard_width = D4_STANDARD_RESOLUTION_WIDTH + 31
            effective_standard_height = D4_STANDARD_RESOLUTION_HEIGHT + 31

        # Calculate scale factors (original logic)
        scale_x = effective_actual_width / effective_standard_width
        scale_y = effective_actual_height / effective_standard_height

        # Log window mode and scale factors
        ColorPrint.blue(f"[ImageAnnotator] Window mode: {'Windowed' if is_windowed else 'Fullscreen'}")
        ColorPrint.blue(f"[ImageAnnotator] Actual size: {actual_width}x{actual_height}")
        ColorPrint.blue(f"[ImageAnnotator] Standard size: {D4_STANDARD_RESOLUTION_WIDTH}x{D4_STANDARD_RESOLUTION_HEIGHT}")
        ColorPrint.blue(f"[ImageAnnotator] Scale factors: X={scale_x:.4f}, Y={scale_y:.4f}")

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

            # Dungeon progress bar
            ("Dungeon Progress", D4_STANDARD_COORDS.dungeon_progress_start, D4_STANDARD_COORDS.dungeon_progress_end, ANNOTATION_COLORS["cyan"]),

            # Team search and formation interface
            ("Find Team", D4_STANDARD_COORDS.find_team_region_start, D4_STANDARD_COORDS.find_team_region_end, ANNOTATION_COLORS["lime"]),
            ("Form Team", D4_STANDARD_COORDS.form_team_region_start, D4_STANDARD_COORDS.form_team_region_end, ANNOTATION_COLORS["pink"]),
            ("Activity Selection", D4_STANDARD_COORDS.activity_selection_region_start, D4_STANDARD_COORDS.activity_selection_region_end, ANNOTATION_COLORS["teal"]),
            ("Min Tier Input", D4_STANDARD_COORDS.min_tier_input_region_start, D4_STANDARD_COORDS.min_tier_input_region_end, ANNOTATION_COLORS["indigo"]),
            ("Max Tier Input", D4_STANDARD_COORDS.max_tier_input_region_start, D4_STANDARD_COORDS.max_tier_input_region_end, ANNOTATION_COLORS["maroon"]),
            ("Confirm Team", D4_STANDARD_COORDS.confirm_team_button_start, D4_STANDARD_COORDS.confirm_team_button_end, ANNOTATION_COLORS["brown"]),
            ("Panel Close", D4_STANDARD_COORDS.panel_close_button_start, D4_STANDARD_COORDS.panel_close_button_end, ANNOTATION_COLORS["crimson"]),
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

            # Team formation interface points
            ("Min Tier Click", D4_STANDARD_COORDS.min_tier_input_point, ANNOTATION_COLORS["orange"]),
        ]

        # Define lines to visualize (start, end, label, color)
        lines_to_draw = [
            # Dungeon progress bar
            ("Dungeon Progress", D4_STANDARD_COORDS.dungeon_progress_start, D4_STANDARD_COORDS.dungeon_progress_end, ANNOTATION_COLORS["olive"]),
        ]

        # Draw all regions as rectangles
        for label, start_coord, end_coord, color in regions_to_draw:
            # Calculate scaled coordinates using original D4 logic
            scaled_start = self._calculate_d4_scaled_coordinate(start_coord, game_window_size, is_windowed)
            scaled_end = self._calculate_d4_scaled_coordinate(end_coord, game_window_size, is_windowed)

            # Log region details
            ColorPrint.green(
                f"[ImageAnnotator] {label}: "
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
            # Calculate scaled coordinates using original D4 logic
            scaled_start = self._calculate_d4_scaled_coordinate(start_coord, game_window_size, is_windowed)
            scaled_end = self._calculate_d4_scaled_coordinate(end_coord, game_window_size, is_windowed)

            # Log line details
            ColorPrint.green(
                f"[ImageAnnotator] {label}: "
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
            # Calculate scaled coordinate using original D4 logic
            scaled_coord = self._calculate_d4_scaled_coordinate(standard_coord, game_window_size, is_windowed)
            scaled_x, scaled_y = scaled_coord

            # Log calculation details (original format)
            ColorPrint.green(
                f"[ImageAnnotator] {label}: "
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

        ColorPrint.green("[ImageAnnotator] Screenshot annotation completed")

        return annotated_image_pil

    def save_annotated_image(self, annotated_image, annotated_dir) -> str:
        """
        Save annotated image to disk
        
        Args:
            annotated_image: PIL Image object with annotations
            annotated_dir: Directory to save annotated image
            
        Returns:
            str: Path to saved annotated image, empty string if failed
        """
        if not annotated_image:
            return ""
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        annotated_filename = f"d4_annotated_{timestamp}.png"
        annotated_path = annotated_dir / annotated_filename
        annotated_image.save(annotated_path)
        ColorPrint.green(f"[ImageAnnotator] Annotated screenshot saved: {annotated_path}")
        return str(annotated_path)


_image_annotator_instance = None


def get_image_annotator() -> ImageAnnotator:
    """Return the global ImageAnnotator instance (singleton). 导出前实例化."""
    global _image_annotator_instance
    if _image_annotator_instance is None:
        _image_annotator_instance = ImageAnnotator()
    return _image_annotator_instance
