#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Region Detector for D4 Controller
Handles region detection and extraction
"""

import sys
from pathlib import Path
from datetime import datetime

# Add project paths
current_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(current_dir))

from providor.common_imports import ColorPrint
from d3utils.i18n_manager import I18nManager
# D4State functionality now integrated into D4InterfaceData
from share.game_interface_data import (
    D4_STANDARD_COORDS,
    D4_STANDARD_RESOLUTION_WIDTH,
    D4_STANDARD_RESOLUTION_HEIGHT,
    calculate_unified_scaled_coordinate,
    get_d4_interface_data,
    D4_ANNOTATED_DIR
)
from d4utils.window_region_detector import get_d4_window_region_detector
from d4utils.team_health_detector import get_team_health_detector
from d4utils.small_map_detector import get_small_map_detector
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
        self.team_health_detector = get_team_health_detector()
        self.small_map_detector = get_small_map_detector()
        self.i18n = I18nManager()
        # D4State functionality now integrated into D4InterfaceData
        ColorPrint.blue("[RegionDetector] Initialized")

    def detect_regions_from_shared_data(self) -> bool:
        """
        Detect regions from shared screenshot data
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            ColorPrint.blue("[RegionDetector] Detecting regions from shared data...")

            # Get screenshot_data from shared memory
            screenshot_data = self.d4_data.screenshot_data
            if screenshot_data is None:
                ColorPrint.yellow("[RegionDetector] No screenshot data in shared memory")
                return False

            # Extract team count and team vote region images from shared data
            self._extract_team_regions(screenshot_data)

            # Detect team health bars
            self._detect_team_health(screenshot_data)

            # Detect small map (town vs dungeon)
            self._detect_small_map(screenshot_data)

            # Detect regions and update interface data
            is_windowed = self.d4_data.is_windowed_mode()
            detection_success = self._detect_and_update_regions(
                screenshot_data.game_window_size,
                is_windowed,
                screenshot_data.game_window_image  # Pass screenshot for annotation
            )

            if detection_success:
                ColorPrint.green("[RegionDetector] Region detection successful")
            else:
                ColorPrint.yellow("[RegionDetector] Region detection failed")
            
            return detection_success

        except Exception as e:
            ColorPrint.red(f"[RegionDetector] Error detecting regions: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _extract_team_regions(self, screenshot_data):
        """Extract team count and team vote region images and save them"""
        try:
            ColorPrint.blue("[RegionDetector] Extracting team regions...")

            if not screenshot_data.game_window_image:
                ColorPrint.yellow("[RegionDetector] No game window image available")
                return

            game_window_image = screenshot_data.game_window_image
            game_window_size = screenshot_data.game_window_size
            is_windowed = self.d4_data.is_windowed_mode()

            # Calculate scaled coordinates for team count region
            team_count_start = calculate_unified_scaled_coordinate(
                D4_STANDARD_COORDS.team_count_region_start, 
                game_window_size, 
                (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT), 
                is_windowed
            )
            team_count_end = calculate_unified_scaled_coordinate(
                D4_STANDARD_COORDS.team_count_region_end, 
                game_window_size, 
                (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT), 
                is_windowed
            )

            # Calculate scaled coordinates for team vote region
            team_vote_start = calculate_unified_scaled_coordinate(
                D4_STANDARD_COORDS.team_vote_region_start, 
                game_window_size, 
                (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT), 
                is_windowed
            )
            team_vote_end = calculate_unified_scaled_coordinate(
                D4_STANDARD_COORDS.team_vote_region_end, 
                game_window_size, 
                (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT), 
                is_windowed
            )

            # Extract team count region using ImageCrop library
            team_count_crop = ImageCrop.crop_region(
                game_window_image,
                team_count_start,
                team_count_end,
                output_format="pil"
            )

            # Extract team vote region using ImageCrop library
            team_vote_crop = ImageCrop.crop_region(
                game_window_image,
                team_vote_start,
                team_vote_end,
                output_format="pil"
            )

            # Save cropped images to annotated directory
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            
            team_count_path = D4_ANNOTATED_DIR / f"team_count_{timestamp}.png"
            team_vote_path = D4_ANNOTATED_DIR / f"team_vote_{timestamp}.png"
            
            team_count_crop.save(team_count_path)
            team_vote_crop.save(team_vote_path)
            
            ColorPrint.green(f"[RegionDetector] Team regions extracted and saved:")
            ColorPrint.green(f"  Team Count: {team_count_path}")
            ColorPrint.green(f"  Team Vote: {team_vote_path}")

        except Exception as e:
            ColorPrint.red(f"[RegionDetector] Error extracting team regions: {e}")
            import traceback
            traceback.print_exc()

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
        try:
            ColorPrint.blue("[RegionDetector] Detecting regions and updating data...")

            # Use region detector to detect regions
            detection_result = self.region_detector.detect_regions(
                game_window_size, is_windowed, screenshot_image
            )
            
            if detection_result:
                success = self.region_detector.update_interface_data(detection_result)
                if success:
                    if "annotated_image" in detection_result:
                        annotated_image = detection_result["annotated_image"]
                        # Save annotated image path to interface data
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

        except Exception as e:
            ColorPrint.red(f"[RegionDetector] Error in region detection: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _detect_team_health(self, screenshot_data) -> bool:
        """
        Detect team health bars from screenshot data
        
        Args:
            screenshot_data: Screenshot data from screenshot provider
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            ColorPrint.blue("[RegionDetector] Detecting team health bars...")
            
            if not screenshot_data or not screenshot_data.game_window_image:
                ColorPrint.yellow("[RegionDetector] No game window image available for team health detection")
                return False
            
            # Use team health detector to detect health bars
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
                
        except Exception as e:
            ColorPrint.red(f"[RegionDetector] Error in team health detection: {e}")
            import traceback
            traceback.print_exc()
            return False

    def _detect_small_map(self, screenshot_data) -> bool:
        """
        Detect small map (town vs dungeon) from screenshot data
        
        Args:
            screenshot_data: Screenshot data from screenshot provider
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            ColorPrint.blue("[RegionDetector] Detecting small map...")
            
            if not screenshot_data or not screenshot_data.game_window_image:
                ColorPrint.yellow("[RegionDetector] No game window image available for small map detection")
                return False
            
            # Use small map detector to detect location type
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
                
        except Exception as e:
            ColorPrint.red(f"[RegionDetector] Error detecting small map: {e}")
            return False
