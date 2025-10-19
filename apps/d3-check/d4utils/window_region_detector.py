#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Window Region Detector
Detects and analyzes D4 game window regions and coordinates
"""

import sys
from pathlib import Path
from typing import Tuple, List, Dict, Any, Optional
from PIL import Image
from dataclasses import dataclass
from datetime import datetime

# Add project paths
current_dir = Path(__file__).parent.parent
sys.path.insert(0, str(current_dir))

from share.game_interface_data import (
    D4_STANDARD_COORDS,
    D4_STANDARD_RESOLUTION_WIDTH,
    D4_STANDARD_RESOLUTION_HEIGHT,
    calculate_unified_scaled_coordinate,
    get_d4_interface_data,
    D4_ANNOTATED_DIR
)
from providor.common_imports import ColorPrint
from providor.providor_index import DEBUG
from d3utils.d3u_common.image_annotator_helper import create_annotator, get_image_pil, ANNOTATION_COLORS


@dataclass
class D4RegionInfo:
    """D4 region detection information"""
    name: str
    standard_start: Tuple[int, int]
    standard_end: Tuple[int, int]
    scaled_start: Tuple[int, int]
    scaled_end: Tuple[int, int]
    width: int
    height: int
    center: Tuple[int, int]


@dataclass
class D4PointInfo:
    """D4 point detection information"""
    name: str
    standard_coord: Tuple[int, int]
    scaled_coord: Tuple[int, int]


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
        try:
            # Get actual window size
            actual_width, actual_height = game_window_size

            # Define regions to detect
            regions_to_detect = [
                # Bag region
                ("Bag", D4_STANDARD_COORDS.bag_top_left, D4_STANDARD_COORDS.bag_bottom_right),

                # Blacksmith menu
                ("Blacksmith Menu", D4_STANDARD_COORDS.blacksmith_menu_start, D4_STANDARD_COORDS.blacksmith_menu_end),

                # Currency (Whispering Obols)
                ("Whisper Obols", D4_STANDARD_COORDS.whisper_obols_region_start, D4_STANDARD_COORDS.whisper_obols_region_end),

                # Equipment regions
                ("Equipment Left", D4_STANDARD_COORDS.equipment_left_region_start, D4_STANDARD_COORDS.equipment_left_region_end),
                ("Equipment Right", D4_STANDARD_COORDS.equipment_right_region_start, D4_STANDARD_COORDS.equipment_right_region_end),

                # Blacksmith function region
                ("Blacksmith Function", D4_STANDARD_COORDS.blacksmith_function_region_start, D4_STANDARD_COORDS.blacksmith_function_region_end),

                # Experience bar
                ("EXP Bar", D4_STANDARD_COORDS.exp_bar_region_start, D4_STANDARD_COORDS.exp_bar_region_end),

                # Minimap
                ("Minimap", D4_STANDARD_COORDS.minimap_region_start, D4_STANDARD_COORDS.minimap_region_end),

                # Map name
                ("Map Name", D4_STANDARD_COORDS.map_name_region_start, D4_STANDARD_COORDS.map_name_region_end),

                # Quest text
                ("Quest Text", D4_STANDARD_COORDS.quest_text_region_start, D4_STANDARD_COORDS.quest_text_region_end),

                # Team count region
                ("Team Count", D4_STANDARD_COORDS.team_count_region_start, D4_STANDARD_COORDS.team_count_region_end),

                # Team vote region
                ("Team Vote", D4_STANDARD_COORDS.team_vote_region_start, D4_STANDARD_COORDS.team_vote_region_end),

                # Dungeon progress bar
                ("Dungeon Progress", D4_STANDARD_COORDS.dungeon_progress_start, D4_STANDARD_COORDS.dungeon_progress_end),
            ]

            # Define points to detect
            points_to_detect = [
                # Team management buttons
                ("Edit Team", D4_STANDARD_COORDS.edit_team_button),
                ("Confirm Edit", D4_STANDARD_COORDS.confirm_edit_team),
                ("Idle Min Tier", D4_STANDARD_COORDS.idle_team_min_tier),
                ("Idle Max Tier", D4_STANDARD_COORDS.idle_team_max_tier),
                ("Idle Activity", D4_STANDARD_COORDS.idle_activity_selection),
                ("Add Idle Team", D4_STANDARD_COORDS.add_idle_team),

                # Health orb
                ("Health Orb", D4_STANDARD_COORDS.health_orb_point),

                # Team vote confirm
                ("Accept Vote", D4_STANDARD_COORDS.team_vote_confirm_point),

                # Game start button
                ("Start Game", D4_STANDARD_COORDS.start_game_button),
            ]

            # Detect regions
            detected_regions = {}
            for name, start_coord, end_coord in regions_to_detect:
                # Calculate scaled coordinates using unified function
                scaled_start = calculate_unified_scaled_coordinate(
                    start_coord, game_window_size, 
                    (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT), is_windowed
                )
                scaled_end = calculate_unified_scaled_coordinate(
                    end_coord, game_window_size, 
                    (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT), is_windowed
                )

                # Calculate region properties
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

            # Detect points
            detected_points = {}
            for name, standard_coord in points_to_detect:
                # Calculate scaled coordinate using unified function
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

            # Prepare result
            result = {
                "window_info": {
                    "game_window_size": game_window_size,
                    "is_windowed": is_windowed,
                    "standard_resolution": (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT)
                },
                "regions": detected_regions,
                "points": detected_points
            }

            # Store DEBUG mode in result
            result["debug_mode"] = DEBUG
            result["annotated_path"] = None

            # Add annotation if DEBUG mode and screenshot provided
            if DEBUG and screenshot_image is not None:
                annotated_image = self._annotate_screenshot_with_coordinates(
                    screenshot_image, detected_regions, detected_points
                )
                if annotated_image:
                    result["annotated_image"] = annotated_image

                    # Save annotated image and update interface data
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
                    annotated_filename = f"d4_annotated_{timestamp}.png"
                    annotated_path = D4_ANNOTATED_DIR / annotated_filename
                    annotated_image.save(annotated_path)

                    # Update D4 interface data with annotated image path
                    d4_data = get_d4_interface_data()
                    d4_data.last_annotated_screenshot_path = str(annotated_path)
                    result["annotated_path"] = str(annotated_path)

            return result

        except Exception as e:
            ColorPrint.red(f"[D4WindowRegionDetector] Error detecting regions: {e}")
            import traceback
            traceback.print_exc()
            return {}

    def update_interface_data(self, detection_result: Dict[str, Any]) -> bool:
        """
        Update D4InterfaceData with detection results

        Args:
            detection_result: Result from detect_regions()

        Returns:
            True if update successful, False otherwise
        """
        try:
            if not detection_result:
                ColorPrint.yellow("[D4WindowRegionDetector] No detection result to update")
                return False

            # Get D4 interface data
            d4_data = get_d4_interface_data()

            # Update window info
            window_info = detection_result.get("window_info", {})
            d4_data.game_window_size = window_info.get("game_window_size", (0, 0))
            
            # Update regions and points (we'll add these fields to D4InterfaceData)
            # For now, we'll store them in a custom field
            if not hasattr(d4_data, 'detected_regions'):
                d4_data.detected_regions = {}
            if not hasattr(d4_data, 'detected_points'):
                d4_data.detected_points = {}

            # Preserve existing region_images data when updating detected_regions
            existing_region_images = d4_data.detected_regions.get('region_images', {})
            
            # Update detected_regions with new detection results
            d4_data.detected_regions = detection_result.get("regions", {})
            
            # Restore region_images data if it existed
            if existing_region_images:
                d4_data.detected_regions['region_images'] = existing_region_images
                ColorPrint.blue(f"[D4WindowRegionDetector] Preserved {len(existing_region_images)} region images")
            
            d4_data.detected_points = detection_result.get("points", {})

            return True

        except Exception as e:
            ColorPrint.red(f"[D4WindowRegionDetector] Error updating interface data: {e}")
            import traceback
            traceback.print_exc()
            return False

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
        try:
            # Create annotator from PIL Image
            annotator = create_annotator(screenshot_image)

            # Draw all regions as rectangles
            for region_index, (name, region_info) in enumerate(detected_regions.items(), start=1):
                # Get color for region
                color = ANNOTATION_COLORS.get("red", (0, 0, 255))  # Default to red
                
                # Draw rectangle
                annotator.draw_rectangle(
                    top_left=region_info.scaled_start,
                    bottom_right=region_info.scaled_end,
                    color=color,
                    thickness=2,
                    label=name
                )

                # Draw region index number at top-left corner
                annotator.draw_text(
                    text=str(region_index),
                    position=(region_info.scaled_start[0] + 5, region_info.scaled_start[1] + 20),
                    color=(255, 255, 255),  # White text
                    font_scale=0.6,
                    thickness=2,
                    background_color=color
                )

                # Draw start coordinate at top-left corner
                annotator.draw_text(
                    text=f"({region_info.scaled_start[0]},{region_info.scaled_start[1]})",
                    position=(region_info.scaled_start[0] + 5, region_info.scaled_start[1] + 45),
                    color=(255, 255, 255),
                    font_scale=0.4,
                    thickness=1,
                    background_color=(0, 0, 0)
                )

                # Draw end coordinate at bottom-right corner
                annotator.draw_text(
                    text=f"({region_info.scaled_end[0]},{region_info.scaled_end[1]})",
                    position=(region_info.scaled_end[0] - 80, region_info.scaled_end[1] - 10),
                    color=(255, 255, 255),
                    font_scale=0.4,
                    thickness=1,
                    background_color=(0, 0, 0)
                )

            # Draw all points
            for point_index, (name, point_info) in enumerate(detected_points.items(), start=1):
                # Get color for point
                color = ANNOTATION_COLORS.get("blue", (255, 0, 0))  # Default to blue
                
                scaled_coord = point_info.scaled_coord
                scaled_x, scaled_y = scaled_coord

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

                # Draw number label inside the point
                annotator.draw_text(
                    text=str(point_index),
                    position=(scaled_x - 5, scaled_y + 5),
                    color=(0, 0, 0),  # Black text for contrast
                    font_scale=0.5,
                    thickness=2
                )

                # Draw label with coordinate
                annotator.draw_text(
                    text=f"{name} ({scaled_x},{scaled_y})",
                    position=(scaled_x + 15, scaled_y - 10),
                    color=(255, 255, 255),
                    font_scale=0.4,
                    thickness=1,
                    background_color=color
                )

            # Get annotated image as PIL Image
            annotated_image_pil = get_image_pil(annotator)

            return annotated_image_pil

        except Exception as e:
            ColorPrint.red(f"[D4WindowRegionDetector] Error annotating screenshot: {e}")
            import traceback
            traceback.print_exc()
            return None


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
