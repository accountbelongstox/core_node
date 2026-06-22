#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Window Region Detector
Detects and analyzes D4 game window regions and coordinates
"""

import sys
from pathlib import Path
from typing import Tuple, List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

from pycore.pyfoundations.third_party import get_third_package_PIL_Image

Image = get_third_package_PIL_Image()

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from providor.constants.d4 import D4_ANNOTATED_DIR
from share.game_interface_data import (
    D4_STANDARD_COORDS,
    D4_STANDARD_RESOLUTION_WIDTH,
    D4_STANDARD_RESOLUTION_HEIGHT,
    calculate_unified_scaled_coordinate,
    get_d4_interface_data,
    D4RegionInfo,
    D4PointInfo,
)
from pycore.pyfoundations.color_print import ColorPrint
from providor.constants.common import DEBUG
from d3utils.d3u_common.image_annotator_helper import create_annotator, get_image_pil, ANNOTATION_COLORS


class D4WindowRegionDetector:
    """
    D4 Window Region Detector
    
    Detects and analyzes D4 game window regions and coordinates
    """

    def __init__(self):
        """Initialize D4 window region detector"""
        ColorPrint.green("[D4WindowRegionDetector] Initialized")

    def detect_regions(
        self, 
        game_window_size: Tuple[int, int], 
        is_windowed: bool,
        screenshot_image: Optional[Image.Image] = None
    ) -> Dict[str, Any]:
        """
        Detect all D4 game window regions

        Args:
            game_window_size: Tuple (width, height) of game window
            is_windowed: True if running in windowed mode
            screenshot_image: Optional PIL Image for annotation (if DEBUG mode)

        Returns:
            Dictionary containing detected regions and points
        """
        actual_width, actual_height = game_window_size
        regions_to_detect = [
            ("Bag", D4_STANDARD_COORDS.bag_top_left, D4_STANDARD_COORDS.bag_bottom_right),
            ("Blacksmith Menu", D4_STANDARD_COORDS.blacksmith_menu_start, D4_STANDARD_COORDS.blacksmith_menu_end),
            ("Whisper Obols", D4_STANDARD_COORDS.whisper_obols_region_start, D4_STANDARD_COORDS.whisper_obols_region_end),
            ("Equipment Left", D4_STANDARD_COORDS.equipment_left_region_start, D4_STANDARD_COORDS.equipment_left_region_end),
            ("Equipment Right", D4_STANDARD_COORDS.equipment_right_region_start, D4_STANDARD_COORDS.equipment_right_region_end),
            ("Blacksmith Function", D4_STANDARD_COORDS.blacksmith_function_region_start, D4_STANDARD_COORDS.blacksmith_function_region_end),
            ("EXP Bar", D4_STANDARD_COORDS.exp_bar_region_start, D4_STANDARD_COORDS.exp_bar_region_end),
            ("Minimap", D4_STANDARD_COORDS.minimap_region_start, D4_STANDARD_COORDS.minimap_region_end),
            ("Map Name", D4_STANDARD_COORDS.map_name_region_start, D4_STANDARD_COORDS.map_name_region_end),
            ("Quest Text", D4_STANDARD_COORDS.quest_text_region_start, D4_STANDARD_COORDS.quest_text_region_end),
            ("Team Count", D4_STANDARD_COORDS.team_count_region_start, D4_STANDARD_COORDS.team_count_region_end),
            ("Team Vote", D4_STANDARD_COORDS.team_vote_region_start, D4_STANDARD_COORDS.team_vote_region_end),
            ("Dungeon Progress", D4_STANDARD_COORDS.dungeon_progress_start, D4_STANDARD_COORDS.dungeon_progress_end),
        ]
        points_to_detect = [
            ("Edit Team", D4_STANDARD_COORDS.edit_team_button),
            ("Confirm Edit", D4_STANDARD_COORDS.confirm_edit_team),
            ("Idle Min Tier", D4_STANDARD_COORDS.idle_team_min_tier),
            ("Idle Max Tier", D4_STANDARD_COORDS.idle_team_max_tier),
            ("Idle Activity", D4_STANDARD_COORDS.idle_activity_selection),
            ("Add Idle Team", D4_STANDARD_COORDS.add_idle_team),
            ("Health Orb", D4_STANDARD_COORDS.health_orb_point),
            ("Accept Vote", D4_STANDARD_COORDS.team_vote_confirm_point),
            ("Start Game", D4_STANDARD_COORDS.start_game_button),
        ]
        detected_regions = {}
        for name, start_coord, end_coord in regions_to_detect:
            scaled_start = calculate_unified_scaled_coordinate(
                start_coord, game_window_size,
                (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT), is_windowed
            )
            scaled_end = calculate_unified_scaled_coordinate(
                end_coord, game_window_size,
                (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT), is_windowed
            )
            width = scaled_end[0] - scaled_start[0]
            height = scaled_end[1] - scaled_start[1]
            center = ((scaled_start[0] + scaled_end[0]) // 2, (scaled_start[1] + scaled_end[1]) // 2)
            region_info = D4RegionInfo(
                name=name,
                standard_start=start_coord,
                standard_end=end_coord,
                scaled_start=scaled_start,
                scaled_end=scaled_end,
                width=width,
                height=height,
                center=center
            )
            detected_regions[name] = region_info
        detected_points = {}
        for name, standard_coord in points_to_detect:
            scaled_coord = calculate_unified_scaled_coordinate(
                standard_coord, game_window_size,
                (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT), is_windowed
            )
            point_info = D4PointInfo(
                name=name,
                standard_coord=standard_coord,
                scaled_coord=scaled_coord
            )
            detected_points[name] = point_info
        result = {
            "window_info": {
                "game_window_size": game_window_size,
                "is_windowed": is_windowed,
                "standard_resolution": (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT)
            },
            "regions": detected_regions,
            "points": detected_points
        }
        result["debug_mode"] = DEBUG
        result["annotated_path"] = None
        if DEBUG and screenshot_image is not None:
            annotated_image = self._annotate_screenshot_with_coordinates(
                screenshot_image, detected_regions, detected_points
            )
            if annotated_image:
                result["annotated_image"] = annotated_image
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
                annotated_filename = f"d4_annotated_{timestamp}.png"
                annotated_path = D4_ANNOTATED_DIR / annotated_filename
                annotated_image.save(annotated_path)
                d4_data = get_d4_interface_data()
                d4_data.last_annotated_screenshot_path = str(annotated_path)
                result["annotated_path"] = str(annotated_path)
        return result

    def update_interface_data(self, detection_result: Dict[str, Any]) -> bool:
        """
        Update D4InterfaceData with detection results

        Args:
            detection_result: Result from detect_regions()

        Returns:
            True if update successful, False otherwise
        """
        if not detection_result:
            ColorPrint.yellow("[D4WindowRegionDetector] No detection result to update")
            return False
        d4_data = get_d4_interface_data()
        window_info = detection_result.get("window_info", {})
        d4_data.game_window_size = window_info.get("game_window_size", (0, 0))
        existing_region_images = (d4_data.detected_regions or {}).get('region_images', {})
        d4_data.detected_regions = detection_result.get("regions", {})
        if existing_region_images:
            d4_data.detected_regions['region_images'] = existing_region_images
            ColorPrint.blue(f"[D4WindowRegionDetector] Preserved {len(existing_region_images)} region images")
        d4_data.detected_points = detection_result.get("points", {})
        return True

    def _annotate_screenshot_with_coordinates(
        self, 
        screenshot_image: Image.Image, 
        detected_regions: Dict[str, D4RegionInfo], 
        detected_points: Dict[str, D4PointInfo]
    ) -> Optional[Image.Image]:
        """
        Annotate screenshot with detected regions and points (DEBUG mode only)

        Args:
            screenshot_image: PIL Image object (game window screenshot)
            detected_regions: Dictionary of detected regions
            detected_points: Dictionary of detected points

        Returns:
            PIL Image with annotations, or None on error
        """
        annotator = create_annotator(screenshot_image)

        for region_index, (name, region_info) in enumerate(detected_regions.items(), start=1):
            color = ANNOTATION_COLORS.get("red", (0, 0, 255))
            annotator.draw_rectangle(
                top_left=region_info.scaled_start,
                bottom_right=region_info.scaled_end,
                color=color,
                thickness=2,
                label=name
            )
            annotator.draw_text(
                text=str(region_index),
                position=(region_info.scaled_start[0] + 5, region_info.scaled_start[1] + 20),
                color=(255, 255, 255),
                font_scale=0.6,
                thickness=2,
                background_color=color
            )
            annotator.draw_text(
                text=f"({region_info.scaled_start[0]},{region_info.scaled_start[1]})",
                position=(region_info.scaled_start[0] + 5, region_info.scaled_start[1] + 45),
                color=(255, 255, 255),
                font_scale=0.4,
                thickness=1,
                background_color=(0, 0, 0)
            )
            annotator.draw_text(
                text=f"({region_info.scaled_end[0]},{region_info.scaled_end[1]})",
                position=(region_info.scaled_end[0] - 80, region_info.scaled_end[1] - 10),
                color=(255, 255, 255),
                font_scale=0.4,
                thickness=1,
                background_color=(0, 0, 0)
            )
        for point_index, (name, point_info) in enumerate(detected_points.items(), start=1):
            color = ANNOTATION_COLORS.get("blue", (255, 0, 0))
            scaled_coord = point_info.scaled_coord
            scaled_x, scaled_y = scaled_coord
            annotator.draw_circle(
                center=scaled_coord,
                radius=8,
                color=color,
                thickness=-1
            )
            crosshair_size = 20
            annotator.draw_line(
                start=(scaled_x - crosshair_size, scaled_y),
                end=(scaled_x + crosshair_size, scaled_y),
                color=(255, 255, 255),
                thickness=2
            )
            annotator.draw_line(
                start=(scaled_x, scaled_y - crosshair_size),
                end=(scaled_x, scaled_y + crosshair_size),
                color=(255, 255, 255),
                thickness=2
            )
            annotator.draw_text(
                text=str(point_index),
                position=(scaled_x - 5, scaled_y + 5),
                color=(0, 0, 0),
                font_scale=0.5,
                thickness=2
            )
            annotator.draw_text(
                text=f"{name} ({scaled_x},{scaled_y})",
                position=(scaled_x + 15, scaled_y - 10),
                color=(255, 255, 255),
                font_scale=0.4,
                thickness=1,
                background_color=color
            )
        annotated_image_pil = get_image_pil(annotator)
        return annotated_image_pil


# Global instance
_d4_window_region_detector = None


def get_d4_window_region_detector() -> D4WindowRegionDetector:
    """
    Get global D4 window region detector instance (singleton)
    
    Returns:
        Global D4WindowRegionDetector instance
    """
    global _d4_window_region_detector
    
    if _d4_window_region_detector is None:
        _d4_window_region_detector = D4WindowRegionDetector()
        ColorPrint.green("[Global] D4 window region detector initialized")
    
    return _d4_window_region_detector
