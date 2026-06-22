#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Region Detector for D4 Controller. Singleton via get_region_detector(); do not instantiate elsewhere.
"""

from datetime import datetime

from pycore.pyfoundations.color_print import ColorPrint
from providor.i18n_manager import i18n_manager
# D4State functionality now integrated into D4InterfaceData
from providor.constants.d4 import D4_ANNOTATED_DIR
from share.game_interface_data import (
    D4_STANDARD_COORDS,
    D4_STANDARD_RESOLUTION_WIDTH,
    D4_STANDARD_RESOLUTION_HEIGHT,
    calculate_unified_scaled_coordinate,
    get_d4_interface_data,
)
from d4utils.d4_window_region_detector import get_d4_window_region_detector
from d4utils.d4_team_health_detector import get_d4_team_health_detector
from d4utils.d4_small_map_detector import get_d4_small_map_detector
from pycore.pyutils.image_crop import ImageCrop


class RegionDetector:
    """
    Handles region detection and extraction for D4
    
    Responsibilities:
    - Detect regions from shared screenshot data
    - Extract specific region images (team count, team vote)
    - Update interface data with detection results
    """

    def __init__(self):
        """Initialize region detector"""
        self.d4_data = get_d4_interface_data()
        self.region_detector = get_d4_window_region_detector()
        self.team_health_detector = get_d4_team_health_detector()
        self.small_map_detector = get_d4_small_map_detector()
        self.i18n = i18n_manager
        # D4State functionality now integrated into D4InterfaceData
        ColorPrint.blue("[RegionDetector] Initialized")

    def detect_regions_from_shared_data(self) -> bool:
        """
        Detect regions from shared screenshot data
        
        Returns:
            bool: True if successful, False otherwise
        """
        ColorPrint.blue("[RegionDetector] Detecting regions from shared data...")
        screenshot_data = self.d4_data.screenshot_data
        ColorPrint.blue(f"[RegionDetector] Screenshot data from shared memory: {screenshot_data is not None}")
        if screenshot_data is None:
            ColorPrint.yellow("[RegionDetector] No screenshot data in shared memory")
            return False
        self._detect_team_health(screenshot_data)
        self._detect_small_map(screenshot_data)
        is_windowed = self.d4_data.is_windowed_mode()
        detection_success = self._detect_and_update_regions(
            screenshot_data.game_window_size,
            is_windowed,
            screenshot_data.game_window_image
        )
        ColorPrint.blue("[RegionDetector] About to extract all regions to share...")
        self._extract_all_regions_to_share(screenshot_data)
        ColorPrint.blue("[RegionDetector] Finished extracting all regions to share")
        if detection_success:
            ColorPrint.green("[RegionDetector] Region detection successful")
        else:
            ColorPrint.yellow("[RegionDetector] Region detection failed")
        return detection_success

    def _extract_all_regions_to_share(self, screenshot_data):
        """
        Extract all regions defined in image_annotator and store in detected_regions

        This extracts ALL regions from image_annotator.regions_to_draw once per tick,
        storing the cropped images in detected_regions for sharing across the application.

        Note: Respects debug_window_paused flag - if paused, skips extraction to freeze current view.
        """
        if self.d4_data.debug_window_paused:
            ColorPrint.gray("[RegionDetector] Debug window paused - skipping region extraction")
            return
        ColorPrint.blue("[RegionDetector] Extracting all regions to share...")
        ColorPrint.blue(f"[RegionDetector] Screenshot data type: {type(screenshot_data)}")
        ColorPrint.blue(f"[RegionDetector] Game window image: {screenshot_data.game_window_image is not None}")
        if not screenshot_data.game_window_image:
            ColorPrint.yellow("[RegionDetector] No game window image available")
            return
        game_window_image = screenshot_data.game_window_image
        game_window_size = screenshot_data.game_window_size
        is_windowed = self.d4_data.is_windowed_mode()

        # DEBUG: Print critical values for offset troubleshooting
        ColorPrint.blue(f"[RegionDetector] 🔍 DEBUG - game_window_size: {game_window_size}")
        ColorPrint.blue(f"[RegionDetector] 🔍 DEBUG - fullscreen_size: {screenshot_data.fullscreen_size}")
        ColorPrint.blue(f"[RegionDetector] 🔍 DEBUG - is_windowed: {is_windowed}")
        ColorPrint.blue(f"[RegionDetector] 🔍 DEBUG - d4_data.fullscreen_size: {self.d4_data.fullscreen_size}")
        ColorPrint.blue(f"[RegionDetector] 🔍 DEBUG - d4_data.game_window_size: {self.d4_data.game_window_size}")

        # Initialize detected_regions if not exists
        if self.d4_data.detected_regions is None:
            self.d4_data.detected_regions = {}

            # Add 'region_images' key to store all cropped region images
            if 'region_images' not in self.d4_data.detected_regions:
                self.d4_data.detected_regions['region_images'] = {}

            # Define all regions to extract (from image_annotator.py)
            regions_to_extract = [
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
                ("Find Team", D4_STANDARD_COORDS.find_team_region_start, D4_STANDARD_COORDS.find_team_region_end),
                ("Form Team", D4_STANDARD_COORDS.form_team_region_start, D4_STANDARD_COORDS.form_team_region_end),
                ("Activity Selection", D4_STANDARD_COORDS.activity_selection_region_start, D4_STANDARD_COORDS.activity_selection_region_end),
                ("Min Tier Input", D4_STANDARD_COORDS.min_tier_input_region_start, D4_STANDARD_COORDS.min_tier_input_region_end),
                ("Max Tier Input", D4_STANDARD_COORDS.max_tier_input_region_start, D4_STANDARD_COORDS.max_tier_input_region_end),
                ("Confirm Team", D4_STANDARD_COORDS.confirm_team_button_start, D4_STANDARD_COORDS.confirm_team_button_end),
                ("Panel Close", D4_STANDARD_COORDS.panel_close_button_start, D4_STANDARD_COORDS.panel_close_button_end),
            ]

            # Define single-point regions (displayed as small squares)
            point_regions_to_extract = [
                ("Min Tier Click", D4_STANDARD_COORDS.min_tier_input_point),
            ]

            # Extract each region
            for label, start_coord, end_coord in regions_to_extract:
                scaled_start = calculate_unified_scaled_coordinate(
                    start_coord,
                    game_window_size,
                    (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT),
                    is_windowed
                )
                scaled_end = calculate_unified_scaled_coordinate(
                    end_coord,
                    game_window_size,
                    (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT),
                    is_windowed
                )

                # DEBUG: Print first region's coordinate transformation
                if label == "Team Count":
                    ColorPrint.blue(f"[RegionDetector] 🔍 DEBUG '{label}':")
                    ColorPrint.blue(f"  Standard: {start_coord} -> {end_coord}")
                    ColorPrint.blue(f"  Scaled:   {scaled_start} -> {scaled_end}")
                    ColorPrint.blue(f"  Image size: {game_window_image.size}")

                # Extract region using ImageCrop
                region_crop = ImageCrop.crop_region(
                    game_window_image,
                    scaled_start,
                    scaled_end,
                    output_format="pil"
                )

                self.d4_data.detected_regions['region_images'][label] = region_crop.copy()
                ColorPrint.green(f"[RegionDetector] ✓ Extracted '{label}' - Size: {region_crop.size}")

            # Extract point regions (create small 10x10 squares around points)
            for label, point_coord in point_regions_to_extract:
                scaled_point = calculate_unified_scaled_coordinate(
                    point_coord,
                    game_window_size,
                    (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT),
                    is_windowed
                )

                # Create a small 10x10 region around the point
                square_size = 10
                half_size = square_size // 2
                region_start = (scaled_point[0] - half_size, scaled_point[1] - half_size)
                region_end = (scaled_point[0] + half_size, scaled_point[1] + half_size)

                # Ensure coordinates are within image bounds
                img_width, img_height = game_window_image.size
                region_start = (max(0, region_start[0]), max(0, region_start[1]))
                region_end = (min(img_width, region_end[0]), min(img_height, region_end[1]))

                # Extract region using ImageCrop
                region_crop = ImageCrop.crop_region(
                    game_window_image,
                    region_start,
                    region_end,
                    output_format="pil"
                )

                # Store in detected_regions['region_images']
                self.d4_data.detected_regions['region_images'][label] = region_crop.copy()
                ColorPrint.green(f"[RegionDetector] ✓ Extracted point '{label}' - Size: {region_crop.size}")

            total_regions = len(regions_to_extract) + len(point_regions_to_extract)
            region_count = len(self.d4_data.detected_regions.get('region_images', {}))
            ColorPrint.green(f"[RegionDetector] Extracted {region_count}/{total_regions} regions to detected_regions")
            ColorPrint.green(f"[RegionDetector] Region keys: {list(self.d4_data.detected_regions.get('region_images', {}).keys())}")

    def _detect_and_update_regions(self, game_window_size, is_windowed, screenshot_image=None):
        """
        Detect regions and update interface data
        
        Args:
            game_window_size: Tuple (width, height) of game window
            is_windowed: True if running in windowed mode
            screenshot_image: Optional screenshot image for annotation
            
        Returns:
            bool: True if successful, False otherwise
        """
        ColorPrint.blue("[RegionDetector] Detecting regions and updating data...")
        detection_result = self.region_detector.detect_regions(
            game_window_size, is_windowed, screenshot_image
        )
        if detection_result:
            success = self.region_detector.update_interface_data(detection_result)
            if success:
                if "annotated_image" in detection_result:
                    annotated_image = detection_result["annotated_image"]
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
                    annotated_filename = f"d4_annotated_{timestamp}.png"
                    annotated_path = D4_ANNOTATED_DIR / annotated_filename
                    annotated_image.save(annotated_path)
                    self.d4_data.last_annotated_screenshot_path = str(annotated_path)
                    ColorPrint.blue("[RegionDetector] Annotated screenshot saved for DEBUG mode")
                return True
            else:
                ColorPrint.yellow("[RegionDetector] Region detection completed but data update failed")
                return False
        else:
            ColorPrint.yellow("[RegionDetector] Region detection failed")
            return False

    def _detect_team_health(self, screenshot_data) -> bool:
        """
        Detect team health bars from screenshot data
        
        Args:
            screenshot_data: Screenshot data from screenshot provider
            
        Returns:
            bool: True if successful, False otherwise
        """
        ColorPrint.blue("[RegionDetector] Detecting team health bars...")
        if not screenshot_data or not screenshot_data.game_window_image:
            ColorPrint.yellow("[RegionDetector] No game window image available for team health detection")
            return False
        health_result = self.team_health_detector.detect_team_health(
            screenshot_data.game_window_image
        )
        if health_result and "error" not in health_result:
            total_members = health_result.get('total_members', 0)
            group1_count = health_result.get('group1_members', 0)
            group2_count = health_result.get('group2_members', 0)
            local_map_count = health_result.get('local_map_members', 0)
            non_local_map_count = health_result.get('non_local_map_members', 0)
            ColorPrint.green(f"[RegionDetector] Team health detection successful: {total_members} members detected")
            ColorPrint.green(f"[RegionDetector] Groups: G1:{group1_count}, G2:{group2_count}")
            local_map_text = self.i18n.translate("team_health.local_map")
            non_local_map_text = self.i18n.translate("team_health.non_local_map")
            ColorPrint.green(f"[RegionDetector] Maps: {local_map_text}:{local_map_count}, {non_local_map_text}:{non_local_map_count}")
            return True
        else:
            error_msg = health_result.get("error", "Unknown error") if health_result else "No result"
            ColorPrint.yellow(f"[RegionDetector] Team health detection failed: {error_msg}")
            return False

    def _detect_small_map(self, screenshot_data) -> bool:
        """
        Detect small map (town vs dungeon) from screenshot data
        
        Args:
            screenshot_data: Screenshot data from screenshot provider
            
        Returns:
            bool: True if successful, False otherwise
        """
        ColorPrint.blue("[RegionDetector] Detecting small map...")
        if not screenshot_data or not screenshot_data.game_window_image:
            ColorPrint.yellow("[RegionDetector] No game window image available for small map detection")
            return False
        small_map_result = self.small_map_detector.detect_small_map()
        if small_map_result and "error" not in small_map_result:
            is_in_town = small_map_result.get('is_in_town', False)
            location_type = small_map_result.get('location_type', 'Unknown')
            confidence = small_map_result.get('match_result', {}).get('confidence', 0.0)
            ColorPrint.green(f"[RegionDetector] Small map detection successful: {location_type} (confidence: {confidence:.3f})")
            return True
        else:
            error_msg = small_map_result.get('error', 'Unknown error') if small_map_result else 'No result'
            ColorPrint.yellow(f"[RegionDetector] Small map detection failed: {error_msg}")
            return False


_region_detector_instance = None


def get_region_detector() -> RegionDetector:
    """Return the global RegionDetector instance (singleton). Instantiate before use."""
    global _region_detector_instance
    if _region_detector_instance is None:
        _region_detector_instance = RegionDetector()
    return _region_detector_instance
