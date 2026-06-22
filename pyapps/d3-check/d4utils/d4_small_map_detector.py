#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Small Map Detector

Detects if player is in town (city) or dungeon by matching small map template
in the minimap region of the game interface.
"""

import sys
from pathlib import Path
from typing import Tuple, Dict, Any, Optional
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
from providor.providor_index import D4_TEMPLATE_CONFIGS
from providor.i18n_manager import i18n_manager
from d4utils.d4_scaled_template_matcher import get_d4_scaled_template_matcher
# D4State functionality now integrated into D4InterfaceData
from share.game_interface_data import (
    D4_STANDARD_COORDS,
    D4_STANDARD_RESOLUTION_WIDTH,
    D4_STANDARD_RESOLUTION_HEIGHT,
    calculate_unified_scaled_coordinate,
    get_d4_interface_data
)


class D4SmallMapDetector:
    """
    D4 Small Map Detector
    
    Detects if player is in town (city) or dungeon by matching small map template
    in the minimap region of the game interface.
    """

    def __init__(self):
        """Initialize small map detector"""
        self.d4_data = get_d4_interface_data()
        self.i18n = i18n_manager
        # D4State functionality now integrated into D4InterfaceData
        
        # Get template configuration
        self.template_config = D4_TEMPLATE_CONFIGS.get("d4_small_map")
        if not self.template_config:
            ColorPrint.red("[D4SmallMapDetector] Template configuration not found for d4_small_map")
            return
        
        self.template_path = self.template_config["path"]
        self.threshold = self.template_config["threshold"]
        self.match_method = self.template_config["match_method"]
        
        # Initialize D4 scaled template matcher
        self.template_matcher = get_d4_scaled_template_matcher()
        
        ColorPrint.blue("[D4SmallMapDetector] Initialized")
        ColorPrint.blue(f"[D4SmallMapDetector] Template: {self.template_path}")
        ColorPrint.blue(f"[D4SmallMapDetector] Threshold: {self.threshold}")
        ColorPrint.blue(f"[D4SmallMapDetector] Method: {self.match_method}")

    def detect_small_map(self) -> Dict[str, Any]:
        """
        Detect small map in minimap region
        
        Returns:
            Dictionary with detection results
        """
        screenshot_data = self.d4_data.screenshot_data
        if not screenshot_data or not screenshot_data.game_window_image:
            ColorPrint.yellow("[D4SmallMapDetector] No screenshot data available")
            return self._create_detection_result(False, "No screenshot data")
        minimap_start = D4_STANDARD_COORDS.minimap_region_start
        minimap_end = D4_STANDARD_COORDS.minimap_region_end
        game_window_size = screenshot_data.game_window_size
        is_windowed = self.d4_data.is_windowed_mode()
        scaled_start = calculate_unified_scaled_coordinate(
            minimap_start,
            game_window_size,
            (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT),
            is_windowed
        )
        scaled_end = calculate_unified_scaled_coordinate(
            minimap_end,
            game_window_size,
            (D4_STANDARD_RESOLUTION_WIDTH, D4_STANDARD_RESOLUTION_HEIGHT),
            is_windowed
        )
        minimap_region = self._extract_minimap_region(
            screenshot_data.game_window_image,
            scaled_start,
            scaled_end
        )
        if minimap_region is None:
            return self._create_detection_result(False, "Failed to extract minimap region")
        match_result = self._match_small_map_template(minimap_region)
        is_in_town = match_result["found"]
        location_type = "Town" if is_in_town else "Dungeon"
        result = self._create_detection_result(
            is_in_town,
            f"Location: {location_type}",
            match_result
        )
        self._update_shared_data(result)
        if DEBUG:
            self._save_debug_image(minimap_region, match_result, result)
        ColorPrint.green(f"[D4SmallMapDetector] Detection result: {location_type} (confidence: {match_result.get('confidence', 0):.3f})")
        return result

    def _extract_minimap_region(self, screenshot: Image.Image, start: Tuple[int, int], end: Tuple[int, int]) -> Optional[np.ndarray]:
        """
        Extract minimap region from screenshot
        
        Args:
            screenshot: PIL Image of game window
            start: Start coordinates (x, y)
            end: End coordinates (x, y)
            
        Returns:
            NumPy array of minimap region or None
        """
        # Convert PIL to numpy array
        screenshot_array = np.array(screenshot)
        
        # Extract region
        x1, y1 = start
        x2, y2 = end
        
        # Ensure coordinates are within bounds
        height, width = screenshot_array.shape[:2]
        x1 = max(0, min(x1, width))
        y1 = max(0, min(y1, height))
        x2 = max(x1, min(x2, width))
        y2 = max(y1, min(y2, height))
        
        # Extract region
        minimap_region = screenshot_array[y1:y2, x1:x2]
        
        if minimap_region.size == 0:
            ColorPrint.yellow("[D4SmallMapDetector] Extracted minimap region is empty")
            return None
        
        return minimap_region

    def _match_small_map_template(self, minimap_region: np.ndarray = None) -> Dict[str, Any]:
        """
        Match small map template in minimap region using D4ScaledTemplateMatcher
        
        Args:
            minimap_region: NumPy array of minimap region (optional, for backward compatibility)
            
        Returns:
            Dictionary with match results
        """
        # Use D4ScaledTemplateMatcher for region-based matching
        # This will automatically use shared minimap region data if available
        match_result = self.template_matcher.match_template_in_region(
            template_name="d4_small_map",
            region_name="minimap",
            use_shared_region=True,  # Use shared region data from D4InterfaceData
            output_dir=None
        )
        
        # Check if we got matches
        if match_result and match_result.get("total_matches", 0) > 0:
            first_match = match_result["matches"][0]
            confidence = first_match.get("match_score", 0.0)
            found = confidence >= self.threshold
            
            return {
                "found": found,
                "confidence": confidence,
                "match_result": first_match,
                "threshold": self.threshold,
                "region_source": match_result.get("region_source", "unknown")
            }
        else:
            # No matches found
            return {
                "found": False,
                "confidence": 0.0,
                "match_result": None,
                "threshold": self.threshold,
                "error": match_result.get("error", "No matches found") if match_result else "No result",
                "region_source": match_result.get("region_source", "unknown") if match_result else "error"
            }

    def _create_detection_result(self, is_in_town: bool, message: str, match_result: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Create detection result dictionary
        
        Args:
            is_in_town: Whether player is in town
            message: Detection message
            match_result: Optional match result details
            
        Returns:
            Dictionary with detection results
        """
        return {
            "is_in_town": is_in_town,
            "location_type": "Town" if is_in_town else "Dungeon",
            "message": message,
            "timestamp": datetime.now().isoformat(),
            "match_result": match_result or {},
            "template_path": self.template_path,
            "threshold": self.threshold
        }

    def _update_shared_data(self, result: Dict[str, Any]):
        """
        Update shared data with detection results
        
        Args:
            result: Detection result dictionary
        """
        # Update D4InterfaceData with small map detection results
        self.d4_data.small_map_detection = {
            "is_in_town": result["is_in_town"],
            "location_type": result["location_type"],
            "detection_timestamp": result["timestamp"],
            "confidence": result.get("match_result", {}).get("confidence", 0.0)
        }
        
        # Update detection timestamp
        self.d4_data.small_map_detection_timestamp = result["timestamp"]
        
        # Update detected regions with location info
        self.d4_data.detected_regions = {
            "location_type": result["location_type"],
            "is_in_town": result["is_in_town"]
        }

    def _save_debug_image(self, minimap_region: np.ndarray, match_result: Dict[str, Any], result: Dict[str, Any]):
        """
        Save debug image with detection results - always save minimap region with annotations
        
        Args:
            minimap_region: NumPy array of minimap region
            match_result: Match result details
            result: Detection result
        """
        # Create debug directory
        debug_dir = TMP_DIR / "d4_annotated"
        debug_dir.mkdir(parents=True, exist_ok=True)
        
        # Create annotated image from minimap region
        debug_image = minimap_region.copy()
        
        # Add detection result text
        location_type = result["location_type"]
        confidence = match_result.get("confidence", 0.0)
        found = match_result.get("found", False)
        
        # Draw detection result
        text = f"Small Map: {location_type}"
        confidence_text = f"Confidence: {confidence:.3f}"
        threshold_text = f"Threshold: {self.threshold}"
        status_text = "FOUND" if found else "NOT FOUND"
        
        # Choose colors based on detection result
        status_color = (0, 255, 0) if found else (0, 0, 255)  # Green if found, red if not found
        text_color = (255, 255, 255)  # White for info text
        
        # Draw text on image
        cv2.putText(debug_image, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2)
        cv2.putText(debug_image, confidence_text, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, text_color, 1)
        cv2.putText(debug_image, threshold_text, (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.6, text_color, 1)
        cv2.putText(debug_image, status_text, (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, status_color, 2)
        
        # Add template path info
        template_info = f"Template: {Path(self.template_path).name}"
        cv2.putText(debug_image, template_info, (10, 150), cv2.FONT_HERSHEY_SIMPLEX, 0.5, text_color, 1)
        
        # Draw a border around the minimap region to highlight it
        height, width = debug_image.shape[:2]
        border_color = status_color
        cv2.rectangle(debug_image, (0, 0), (width-1, height-1), border_color, 2)
        
        # Save debug image
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        debug_filename = f"small_map_detection_{timestamp}.png"
        debug_path = debug_dir / debug_filename
        
        cv2.imwrite(str(debug_path), debug_image)
        
        # Update shared data with debug image path
        self.d4_data.last_small_map_debug_path = str(debug_path)
        
        ColorPrint.green(f"[D4SmallMapDetector] Debug image saved: {debug_path}")
        
        # Also save the minimap region without annotations for reference
        region_filename = f"minimap_region_{timestamp}.png"
        region_path = debug_dir / region_filename
        cv2.imwrite(str(region_path), minimap_region)
        ColorPrint.blue(f"[D4SmallMapDetector] Raw minimap region saved: {region_path}")


# Global small map detector instance (singleton)
_small_map_detector = None


def get_d4_small_map_detector() -> D4SmallMapDetector:
    """
    Get global small map detector instance (singleton)

    Returns:
        Global D4SmallMapDetector instance
    """
    global _small_map_detector

    if _small_map_detector is None:
        _small_map_detector = D4SmallMapDetector()
        ColorPrint.green("[Global] Small map detector initialized")
    
    return _small_map_detector
