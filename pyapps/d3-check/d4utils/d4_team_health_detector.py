#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Team Health Detector for Diablo 4

Detects team member health bars by scanning the team count region
and identifying health bar colors for different team groups.
"""

import sys
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional, Union
from datetime import datetime

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy, get_third_package_PIL_Image

numpy = get_third_package_numpy()
np = numpy
cv2 = get_third_package_cv2()
Image = get_third_package_PIL_Image()

# Add project paths
from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.color_print import ColorPrint
from providor.constants.common import DEBUG, TMP_DIR
from providor.i18n_manager import i18n_manager
from d3utils.d3u_common.image_conversion import normalize_image_to_bgr
from d3utils.d3u_common.image_annotator_helper import (
    create_annotator,
    get_image_pil,
    get_annotation_color
)
# D4State functionality now integrated into D4InterfaceData
from providor.constants.d4 import D4_ANNOTATED_DIR
from share.game_interface_data import (
    D4_STANDARD_COORDS,
    D4_STANDARD_RESOLUTION_WIDTH,
    D4_STANDARD_RESOLUTION_HEIGHT,
    calculate_unified_scaled_coordinate,
    get_d4_interface_data,
)


class D4TeamHealthDetector:
    """
    Team Health Detector for Diablo 4
    
    Detects team member health bars by scanning the team count region
    and identifying health bar colors for different team groups.
    """

    def __init__(self):
        """Initialize team health detector"""
        self.d4_data = get_d4_interface_data()
        self.i18n = i18n_manager
        # D4State functionality now integrated into D4InterfaceData
        
        # Team health color groups (BGR format for OpenCV)
        # Group 1: Same map team members HP
        self.group1_colors = [
            (12, 20, 123),  # 7b140c
            (2, 5, 116),    # 740502
            (3, 5, 112),    # 700503
            (12, 15, 107),  # 6b0f0c
            (8, 11, 115),   # 730b08
        ]
        
        # Group 2: Different map team members HP
        self.group2_colors = [
            (16, 23, 25),   # 191710
            (15, 20, 22),   # 16140f
            (15, 22, 23),   # 17160f
            (15, 21, 23),   # 17150f
            (16, 22, 24),   # 181610
            (17, 24, 26),   # 1a1811
        ]
        
        # Color tolerance for matching
        self.color_tolerance = 0.1  # 10% tolerance
        
        # Minimum pixels per row to consider as health bar
        self.min_pixels_per_row = 20
        
        ColorPrint.blue("[D4TeamHealthDetector] Initialized")

    def detect_team_health(self, image_input: Union[str, Image.Image, np.ndarray]) -> Dict[str, Any]:
        """
        Detect team member health bars in the team count region
        
        Args:
            image_input: Image as file path (str), PIL Image, or numpy array (BGR)
            
        Returns:
            Dictionary with team health detection results
        """
        ColorPrint.blue("[D4TeamHealthDetector] Starting team health detection...")
        image_bgr = self._normalize_input_to_bgr(image_input)
            
        current_height, current_width = image_bgr.shape[:2]
        game_window_size = (current_width, current_height)
        team_count_start = calculate_unified_scaled_coordinate(
                D4_STANDARD_COORDS.team_count_region_start,
                game_window_size,
                (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT),
                self.d4_data.is_windowed_mode()
        )
        team_count_end = calculate_unified_scaled_coordinate(
            D4_STANDARD_COORDS.team_count_region_end,
            game_window_size,
            (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT),
            self.d4_data.is_windowed_mode()
        )
        ColorPrint.green(f"[D4TeamHealthDetector] Team count region: {team_count_start} -> {team_count_end}")
        x1, y1 = team_count_start
        x2, y2 = team_count_end
        x1 = max(0, min(x1, current_width))
        y1 = max(0, min(y1, current_height))
        x2 = max(0, min(x2, current_width))
        y2 = max(0, min(y2, current_height))
        if x1 >= x2 or y1 >= y2:
            ColorPrint.yellow("[D4TeamHealthDetector] Invalid region coordinates")
            return {"error": "Invalid region coordinates"}
        team_region = image_bgr[y1:y2, x1:x2]
        ColorPrint.green(f"[D4TeamHealthDetector] Extracted region size: {team_region.shape}")
        health_detection_result = self._scan_health_bars(team_region, (x1, y1))
        annotated_image = None
        if DEBUG:
            annotated_image = self._create_annotated_image(
                team_region, health_detection_result, (x1, y1)
            )
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            annotated_filename = f"team_health_detection_{timestamp}.png"
            annotated_path = D4_ANNOTATED_DIR / annotated_filename
            annotated_path.parent.mkdir(parents=True, exist_ok=True)
            if annotated_image:
                annotated_image.save(annotated_path)
                ColorPrint.green(f"[D4TeamHealthDetector] Annotated image saved: {annotated_path}")
        self.d4_data.team_health_info = health_detection_result
        self.d4_data.team_health_detection_timestamp = datetime.now().isoformat()
        ColorPrint.green("[D4TeamHealthDetector] Team health detection completed")
        return health_detection_result

    def _normalize_input_to_bgr(self, image_input: Union[str, Image.Image, np.ndarray]) -> np.ndarray:
        """
        Normalize input to BGR numpy array (uses shared utility)

        Args:
            image_input: Image as file path (str), PIL Image, or numpy array

        Returns:
            BGR numpy array
        """
        return normalize_image_to_bgr(image_input)

    def _scan_health_bars(self, region: np.ndarray, region_offset: Tuple[int, int]) -> Dict[str, Any]:
        """
        Scan region for health bars by row with 40-pixel jump after each detection
        
        Args:
            region: BGR image region to scan
            region_offset: Offset of region in original image (x, y)
            
        Returns:
            Dictionary with health bar detection results
        """
        height, width = region.shape[:2]
        detected_members = []  # Array of team members
        row_jump = 40  # Jump 40 pixels after each detection
        
        # Scanning region for health bars (detailed logging moved to UIStatusUpdater)
        
        # Scan rows with optimized jumping logic
        row_idx = 0
        while row_idx < height:
            row = region[row_idx, :]  # Get entire row
            
            # First, try to detect local map (Group 1) - scan from left to right
            local_map_detected = self._scan_row_for_group(row, 1, "left_to_right")
            
            if local_map_detected:
                # Local map detected, create team member info
                matching_pixels = local_map_detected["matching_pixels"]
                member_info = {
                    "member_index": len(detected_members) + 1,  # 1-based index
                    "row_index": row_idx,
                    "matching_pixels": matching_pixels,
                    "total_pixels": width,
                    "match_percentage": (matching_pixels / width) * 100,
                    "first_pixel": local_map_detected["first_pixel"].tolist(),
                    "group": 1,
                    "group_name": "Same Map",
                    "is_local_map": True,  # True for local map
                    "scan_direction": "left_to_right",
                    "hp_screen_offset": {
                        "x": 0,  # Will be calculated relative to team region
                        "y": row_idx,  # Row position within team region
                        "absolute_x": 0,  # Will be calculated as absolute screen position
                        "absolute_y": 0   # Will be calculated as absolute screen position
                    }
                }
                
                detected_members.append(member_info)
                
                # Member detected (detailed logging moved to UIStatusUpdater)
                
                # Jump 40 pixels down after detection
                row_idx += row_jump
                
            else:
                # No local map detected, try non-local map (Group 2) - scan from right to left
                non_local_map_detected = self._scan_row_for_group(row, 2, "right_to_left")
                
                if non_local_map_detected:
                    # Non-local map detected, create team member info
                    matching_pixels = non_local_map_detected["matching_pixels"]
                    member_info = {
                        "member_index": len(detected_members) + 1,  # 1-based index
                        "row_index": row_idx,
                        "matching_pixels": matching_pixels,
                        "total_pixels": width,
                        "match_percentage": (matching_pixels / width) * 100,
                        "first_pixel": non_local_map_detected["first_pixel"].tolist(),
                        "group": 2,
                        "group_name": "Different Map",
                        "is_local_map": False,  # False for non-local map
                        "scan_direction": "right_to_left",
                        "hp_screen_offset": {
                            "x": 0,  # Will be calculated relative to team region
                            "y": row_idx,  # Row position within team region
                            "absolute_x": 0,  # Will be calculated as absolute screen position
                            "absolute_y": 0   # Will be calculated as absolute screen position
                        }
                    }
                    
                    detected_members.append(member_info)
                    
                    # Member detected (detailed logging moved to UIStatusUpdater)
                    
                    # Jump 40 pixels down after detection
                    row_idx += row_jump
                    
                else:
                    # No health bar detected in this row, continue to next row
                    row_idx += 1
        
        # Calculate absolute screen offsets for each member
        self._calculate_absolute_offsets(detected_members, region_offset)
        
        # Analyze results
        group1_members = [member for member in detected_members if member["group"] == 1]
        group2_members = [member for member in detected_members if member["group"] == 2]
        local_map_members = [member for member in detected_members if member["is_local_map"]]
        non_local_map_members = [member for member in detected_members if not member["is_local_map"]]
        
        result = {
            "total_members": len(detected_members),
            "group1_members": len(group1_members),
            "group2_members": len(group2_members),
            "local_map_members": len(local_map_members),
            "non_local_map_members": len(non_local_map_members),
            "team_members": detected_members,  # Array of all detected members
            "scan_timestamp": datetime.now().isoformat(),
            "region_size": (width, height),
            "scan_method": f"40px_jump_after_detection"
        }
        
        # Summary printing moved to UIStatusUpdater
        
        return result

    def _calculate_absolute_offsets(self, detected_members: List[Dict], region_offset: Tuple[int, int]):
        """
        Calculate absolute screen offsets for each detected team member
        
        Args:
            detected_members: List of detected team member info
            region_offset: Offset of team region in original image (x, y)
        """
        x_offset, y_offset = region_offset
        
        for member in detected_members:
            # Calculate absolute screen position
            member["hp_screen_offset"]["absolute_x"] = x_offset
            member["hp_screen_offset"]["absolute_y"] = y_offset + member["row_index"]
            
            # HP offset calculation completed (printing moved to UIStatusUpdater)

    def _pixel_matches_any_color(self, pixel: np.ndarray) -> bool:
        """
        Check if pixel matches any target color within tolerance
        
        Args:
            pixel: BGR pixel value
            
        Returns:
            True if pixel matches any target color
        """
        all_colors = self.group1_colors + self.group2_colors
        
        for target_color in all_colors:
            if self._pixel_matches_color(pixel, target_color):
                return True
        return False

    def _pixel_matches_color(self, pixel: np.ndarray, target_color: Tuple[int, int, int]) -> bool:
        """
        Check if pixel matches target color within tolerance
        
        Args:
            pixel: BGR pixel value
            target_color: Target BGR color tuple
            
        Returns:
            True if pixel matches within tolerance
        """
        b, g, r = pixel
        target_b, target_g, target_r = target_color
        
        # Calculate color difference
        diff_b = abs(b - target_b)
        diff_g = abs(g - target_g)
        diff_r = abs(r - target_r)
        
        # Check if all channels are within tolerance
        tolerance = int(255 * self.color_tolerance)
        
        return (diff_b <= tolerance and 
                diff_g <= tolerance and 
                diff_r <= tolerance)

    def _count_matching_pixels_in_row(self, row: np.ndarray) -> int:
        """
        Count pixels in row that match any target color
        
        Args:
            row: Row of BGR pixels
            
        Returns:
            Number of matching pixels
        """
        matching_count = 0
        
        for pixel in row:
            if self._pixel_matches_any_color(pixel):
                matching_count += 1
        
        return matching_count

    def _scan_row_for_group(self, row: np.ndarray, group_id: int, scan_direction: str) -> Optional[Dict]:
        """
        Scan a row for a specific group with specified direction
        
        Args:
            row: Row of BGR pixels
            group_id: Group ID (1 for local map, 2 for non-local map)
            scan_direction: "left_to_right" or "right_to_left"
            
        Returns:
            Dictionary with detection info if found, None otherwise
        """
        if group_id == 1:
            target_colors = self.group1_colors
        elif group_id == 2:
            target_colors = self.group2_colors
        else:
            return None
        
        matching_pixels = 0
        first_matching_pixel = None
        
        if scan_direction == "left_to_right":
            # Scan from left to right
            for i, pixel in enumerate(row):
                for target_color in target_colors:
                    if self._pixel_matches_color(pixel, target_color):
                        matching_pixels += 1
                        if first_matching_pixel is None:
                            first_matching_pixel = pixel
                        break
        elif scan_direction == "right_to_left":
            # Scan from right to left
            for i in range(len(row) - 1, -1, -1):
                pixel = row[i]
                for target_color in target_colors:
                    if self._pixel_matches_color(pixel, target_color):
                        matching_pixels += 1
                        if first_matching_pixel is None:
                            first_matching_pixel = pixel
                        break
        else:
            return None
        
        # Check if we have enough matching pixels
        if matching_pixels >= self.min_pixels_per_row:
            return {
                "matching_pixels": matching_pixels,
                "first_pixel": first_matching_pixel,
                "group_id": group_id,
                "scan_direction": scan_direction
            }
        
        return None

    def _identify_health_group(self, pixel: np.ndarray) -> int:
        """
        Identify which health group the pixel belongs to
        
        Args:
            pixel: BGR pixel value
            
        Returns:
            1 for group1 (same map), 2 for group2 (different map), 0 for unknown
        """
        # Check group1 colors
        for target_color in self.group1_colors:
            if self._pixel_matches_color(pixel, target_color):
                return 1
        
        # Check group2 colors
        for target_color in self.group2_colors:
            if self._pixel_matches_color(pixel, target_color):
                return 2
        
        return 0

    def _create_annotated_image(self, region: np.ndarray,
                              detection_result: Dict[str, Any], region_offset: Tuple[int, int]) -> Optional[Image.Image]:
        """
        Create annotated image showing detected team members and pixel counts for all rows (using ImageAnnotator)

        Args:
            region: Extracted region (BGR numpy array)
            detection_result: Detection results
            region_offset: Offset of region in original image

        Returns:
            Annotated PIL Image or None
        """
        annotator = create_annotator(region)
        team_members = detection_result.get("team_members", [])
        height, width = region.shape[:2]
        detected_rows = {member["row_index"] for member in team_members}
        for row_idx in range(height):
            row = region[row_idx, :]
            matching_pixels = self._count_matching_pixels_in_row(row)
            total_pixels = width
            match_percentage = (matching_pixels / total_pixels) * 100
            if row_idx in detected_rows:
                if matching_pixels >= self.min_pixels_per_row:
                    color = get_annotation_color("green")
                else:
                    color = get_annotation_color("yellow")
            else:
                if matching_pixels > 0:
                    color = get_annotation_color("gray")
                else:
                    color = get_annotation_color("dark_gray")
            y1 = row_idx
            x1 = 0
            x2 = width
            annotator.draw_line(
                start=(x1, y1),
                end=(x2, y1),
                color=color,
                thickness=1
            )
            pixel_text = f"R{row_idx}: {matching_pixels}/{total_pixels} ({match_percentage:.1f}%)"
            annotator.draw_text(
                text=pixel_text,
                position=(x1, y1 - 2),
                color=color,
                font_scale=0.25,
                thickness=1
            )
        for member_info in team_members:
            row_idx = member_info["row_index"]
            group = member_info["group"]
            member_index = member_info["member_index"]
            if group == 1:
                color = get_annotation_color("green")
            elif group == 2:
                color = get_annotation_color("red")
            else:
                color = get_annotation_color("yellow")
            y1 = row_idx
            y2 = y1 + 1
            x1 = 0
            x2 = width
            annotator.draw_rectangle(
                top_left=(x1, y1),
                bottom_right=(x2, y2),
                color=color,
                thickness=2
            )
            label = f"M{member_index} G{group} ({member_info['matching_pixels']}px)"
            annotator.draw_text(
                text=label,
                position=(x1, y1 - 25),
                color=(255, 255, 255),
                font_scale=0.4,
                thickness=1,
                background_color=color
            )
            group_label = member_info.get("group_name", f"Group{group}")
            local_status = "Local" if member_info.get("is_local_map", False) else "Non-Local"
            scan_direction = member_info.get("scan_direction", "unknown")
            annotator.draw_text(
                text=f"{group_label} ({local_status}) {scan_direction}",
                position=(x1, y1 + 15),
                color=(255, 255, 255),
                font_scale=0.3,
                thickness=1,
                background_color=color
            )
            hp_offset = member_info.get("hp_screen_offset", {})
            offset_text = f"HP:({hp_offset.get('absolute_x', 0)},{hp_offset.get('absolute_y', 0)})"
            annotator.draw_text(
                text=offset_text,
                position=(x1, y1 + 30),
                color=(255, 255, 255),
                font_scale=0.25,
                thickness=1,
                background_color=color
            )
        total_members = detection_result.get("total_members", 0)
        group1_count = detection_result.get("group1_members", 0)
        group2_count = detection_result.get("group2_members", 0)
        local_map_count = detection_result.get("local_map_members", 0)
        non_local_map_count = detection_result.get("non_local_map_members", 0)
        summary_text = f"Team: {total_members} total (G1:{group1_count}, G2:{group2_count})"
        annotator.draw_text(
            text=summary_text,
            position=(0, 15),
            color=(255, 255, 255),
            font_scale=0.5,
            thickness=1,
            background_color=get_annotation_color("green")
        )
        map_text = f"Map: Local:{local_map_count}, Non-Local:{non_local_map_count}"
        annotator.draw_text(
            text=map_text,
            position=(0, 35),
            color=(255, 255, 255),
            font_scale=0.5,
            thickness=1,
            background_color=get_annotation_color("blue")
        )
        return get_image_pil(annotator)


# Global team health detector instance (singleton)
_team_health_detector = None


def get_d4_team_health_detector() -> D4TeamHealthDetector:
    """
    Get global team health detector instance (singleton)
    
    Returns:
        Global D4TeamHealthDetector instance
    """
    global _team_health_detector

    if _team_health_detector is None:
        _team_health_detector = D4TeamHealthDetector()
        ColorPrint.green("[Global] Team health detector initialized")
    
    return _team_health_detector


# Example usage
if __name__ == "__main__":
    # Get detector instance
    detector = get_d4_team_health_detector()
    
    # Test with a sample image (if provided)
    import sys
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        result = detector.detect_team_health(image_path)
        print(f"Detection result: {result}")
    else:
        print("Usage: python team_health_detector.py <image_path>")
