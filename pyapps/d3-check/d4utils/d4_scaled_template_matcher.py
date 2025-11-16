#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D4 Scaled Template Matcher
Automatically scales templates based on actual game window resolution vs D4 standard resolution
Unified template matching interface for D4

Workflow:
1. Get actual game window size from screenshot_provider
2. Calculate scale factors: actual_size / D4_STANDARD_RESOLUTION
3. Auto-scale templates from D4_TEMPLATE_CONFIGS based on scale factors
4. Cache scaled templates in memory for performance
5. Call image_matcher with scaled templates
6. Return results

Usage:
    from d4utils.d4_scaled_template_matcher import D4ScaledTemplateMatcher

    matcher = D4ScaledTemplateMatcher()
    result = matcher.match_template(
        target_image=game_window_image,  # PIL Image or path
        template_name="d4_small_map",    # Name from D4_TEMPLATE_CONFIGS
        output_dir=None                  # Optional output directory
    )
"""

import os
import sys
from typing import Optional, Union, Dict, List, Tuple
from pathlib import Path

from pycore.pyfoundations.third_party import PIL, cv2, numpy
from PIL import Image
import numpy as np

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)

sys.path.insert(0, project_root)

from providor.common_imports import ColorPrint, ImageMatcher
from providor.providor_index import (
    D4_TEMPLATE_CONFIGS,
    D4_STANDARD_RESOLUTION_WIDTH,
    D4_STANDARD_RESOLUTION_HEIGHT,
    SCALED_TEMPLATES_CACHE_DIR,
    DEBUG,
    TMP_DIR
)
from share import get_global_scale
from share.game_interface_data import get_d4_interface_data


class D4ScaledTemplateMatcher:
    """
    D4 Scaled Template Matcher

    Automatically handles template scaling based on resolution differences
    between actual game window and D4 standard resolution (1763x1126).

    Features:
    - Auto-calculates scale factors from screenshot_provider
    - Scales templates in memory (cached for performance)
    - Delegates to ImageMatcher for actual matching
    - Supports single and multiple template matching
    - Supports multiple match methods (SIFT, ORB, TM_CCOEFF_NORMED, etc.)
    - Uses D4_TEMPLATE_CONFIGS for template configuration
    """

    def __init__(self):
        """Initialize D4 scaled template matcher"""
        # Create ImageMatcher instances for different feature detectors
        # We'll create them on-demand to save memory
        self._matchers = {}  # {detector_type: ImageMatcher instance}

        # In-memory cache for original templates
        # Format: {template_name: numpy.ndarray}
        self._original_template_cache = {}

        # In-memory cache for scaled templates
        # Format: {(template_name, scale_x, scale_y): numpy.ndarray}
        self._template_cache = {}

        # Get shared D4 data for team region access
        self.d4_data = get_d4_interface_data()

        ColorPrint.green("[D4ScaledTemplateMatcher] Initialized")

    def _get_matcher(self, match_method: str = "ORB") -> ImageMatcher:
        """
        Get or create ImageMatcher instance for specified match method

        Args:
            match_method: "ORB", "SIFT", "AKAZE", "TM_CCOEFF", "TM_CCORR", or other template matching methods

        Returns:
            ImageMatcher instance
        """
        method_type = match_method.upper()

        # Map match_method to actual CV2 constants and feature detector types
        # For feature-based methods (SIFT, ORB, AKAZE)
        feature_methods = ["SIFT", "ORB", "AKAZE"]

        # For template matching methods
        template_method_map = {
            "TM_CCOEFF": cv2.TM_CCOEFF,
            "TM_CCOEFF_NORMED": cv2.TM_CCOEFF_NORMED,
            "TM_CCORR": cv2.TM_CCORR,
            "TM_CCORR_NORMED": cv2.TM_CCORR_NORMED,
            "TM_SQDIFF": cv2.TM_SQDIFF,
            "TM_SQDIFF_NORMED": cv2.TM_SQDIFF_NORMED
        }

        # Determine if this is feature-based or template-based matching
        if method_type in feature_methods:
            # Feature-based matching
            cache_key = method_type
            if cache_key not in self._matchers:
                ColorPrint.blue(f"[D4ScaledMatcher] Creating {method_type} feature matcher")
                self._matchers[cache_key] = ImageMatcher(
                    ratio_thresh=0.80,
                    min_inliers=4,
                    nfeatures=10000
                    # Note: No standard_width/height to disable auto-scaling
                    # D4ScaledTemplateMatcher handles scaling manually
                )
        else:
            # Template matching - use ORB as feature detector, but with custom template method
            cv_method = template_method_map.get(method_type, cv2.TM_CCORR_NORMED)
            cache_key = method_type

            if cache_key not in self._matchers:
                ColorPrint.blue(f"[D4ScaledMatcher] Creating {method_type} template matcher")
                self._matchers[cache_key] = ImageMatcher(
                    ratio_thresh=0.80,
                    min_inliers=4,
                    nfeatures=10000
                    # Note: No standard_width/height to disable auto-scaling
                    # D4ScaledTemplateMatcher handles scaling manually
                )

        return self._matchers[cache_key]

    def _get_scale_factors(self) -> Tuple[float, float]:
        """
        Get current scale factors from global scale

        Returns:
            Tuple of (scale_x, scale_y)
        """
        scale_x, scale_y = get_global_scale()
        ColorPrint.gray(f"[D4ScaledMatcher] Current scale factors: X={scale_x:.4f}, Y={scale_y:.4f}")
        return scale_x, scale_y

    def _load_target_image(self, target_image: Union[str, Path, Image.Image, np.ndarray]) -> Optional[np.ndarray]:
        """
        Load target image to numpy array (in memory)

        Args:
            target_image: Target image (path, PIL Image, or numpy array)

        Returns:
            Target image as numpy array (BGR) or None if failed
        """
        if isinstance(target_image, np.ndarray):
            # Already numpy array
            return target_image
        elif isinstance(target_image, Image.Image):
            # Convert PIL Image to numpy array (RGB -> BGR)
            rgb_array = np.array(target_image)
            if len(rgb_array.shape) == 3 and rgb_array.shape[2] == 3:
                return cv2.cvtColor(rgb_array, cv2.COLOR_RGB2BGR)
            elif len(rgb_array.shape) == 3 and rgb_array.shape[2] == 4:
                return cv2.cvtColor(rgb_array, cv2.COLOR_RGBA2BGRA)
            else:
                return rgb_array
        else:
            # Load from file path
            img = cv2.imread(str(target_image), cv2.IMREAD_UNCHANGED)
            if img is None:
                ColorPrint.red(f"[D4ScaledMatcher] Failed to load image from path: {target_image}")
            return img

    def _load_original_template(self, template_name: str) -> Optional[np.ndarray]:
        """
        Load original template image from disk (cached)

        Args:
            template_name: Template name from D4_TEMPLATE_CONFIGS

        Returns:
            Original template as numpy array (BGR or BGRA) or None if failed
        """
        # Check cache first
        if template_name in self._original_template_cache:
            ColorPrint.gray(f"[D4ScaledMatcher] Using cached original template: {template_name}")
            return self._original_template_cache[template_name]

        # Get original template path from D4_TEMPLATE_CONFIGS
        template_config = D4_TEMPLATE_CONFIGS.get(template_name)
        if not template_config:
            ColorPrint.yellow(f"[D4ScaledMatcher] D4 template not found: {template_name}")
            return None
        
        original_path = template_config["path"]
        
        if not Path(original_path).exists():
            ColorPrint.yellow(f"[D4ScaledMatcher] Template file not found: {original_path}")
            return None

        # Load original template from disk
        ColorPrint.blue(f"[D4ScaledMatcher] Loading original template from disk: {template_name}")
        template_img = cv2.imread(str(original_path), cv2.IMREAD_UNCHANGED)
        if template_img is None:
            ColorPrint.red(f"[D4ScaledMatcher] Failed to load template: {original_path}")
            return None

        # Cache the original template
        self._original_template_cache[template_name] = template_img
        ColorPrint.green(f"[D4ScaledMatcher] Cached original template: {template_name}")

        return template_img

    def _get_scaled_template_image(
        self,
        template_name: str,
        scale_x: float,
        scale_y: float,
        force_refresh: bool = False
    ) -> Optional[np.ndarray]:
        """
        Get scaled template image data in memory (creates if not cached)

        Args:
            template_name: Template name from D4_TEMPLATE_CONFIGS
            scale_x: X scale factor
            scale_y: Y scale factor
            force_refresh: Force re-scaling even if cached

        Returns:
            Scaled template as numpy array (BGR or BGRA) or None if failed
        """
        # Check scaled template cache first
        cache_key = (template_name, round(scale_x, 4), round(scale_y, 4))

        if not force_refresh and cache_key in self._template_cache:
            ColorPrint.gray(f"[D4ScaledMatcher] Using cached scaled template: {template_name}")
            return self._template_cache[cache_key]

        # Load original template (from cache or disk)
        template_img = self._load_original_template(template_name)
        if template_img is None:
            return None

        original_height, original_width = template_img.shape[:2]
        ColorPrint.gray(f"[D4ScaledMatcher] Original size: {original_width}x{original_height}")

        # If scale is 1.0 x 1.0, no scaling needed
        if abs(scale_x - 1.0) < 0.001 and abs(scale_y - 1.0) < 0.001:
            ColorPrint.gray(f"[D4ScaledMatcher] No scaling needed for {template_name}")
            self._template_cache[cache_key] = template_img
            return template_img

        # Calculate new dimensions
        new_width = int(original_width * scale_x)
        new_height = int(original_height * scale_y)

        # Ensure minimum size
        new_width = max(1, new_width)
        new_height = max(1, new_height)

        ColorPrint.blue(f"[D4ScaledMatcher] Scaling {template_name}: {original_width}x{original_height} -> {new_width}x{new_height}")

        # Scale template
        scaled_template = cv2.resize(template_img, (new_width, new_height), interpolation=cv2.INTER_AREA)

        # Cache the scaled template
        self._template_cache[cache_key] = scaled_template
        ColorPrint.green(f"[D4ScaledMatcher] Cached scaled template: {template_name}")

        return scaled_template

    def match_template(
        self,
        target_image: Union[str, Path, Image.Image, np.ndarray],
        template_name: str,
        output_dir: Optional[Path] = None,
        force_refresh_scale: bool = False
    ) -> Dict:
        """
        Match a single template with automatic scaling

        Args:
            target_image: Target image (path, PIL Image, or numpy array)
            template_name: Template name from D4_TEMPLATE_CONFIGS
            output_dir: Optional output directory for debug images
            force_refresh_scale: Force re-scaling template even if cached

        Returns:
            Match result dict with single match:
            {
                "total_matches": int,
                "matches": [match_result_dict],
                "error": str (optional)
            }
        """
        ColorPrint.blue(f"\n[D4ScaledMatcher] Matching template: {template_name}")

        # Get scale factors
        scale_x, scale_y = self._get_scale_factors()

        # Get scaled template image (in memory)
        scaled_template_img = self._get_scaled_template_image(
            template_name=template_name,
            scale_x=scale_x,
            scale_y=scale_y,
            force_refresh=force_refresh_scale
        )

        if scaled_template_img is None:
            ColorPrint.red(f"[D4ScaledMatcher] Failed to get scaled template: {template_name}")
            return {
                "total_matches": 0,
                "matches": [],
                "error": "Failed to scale template"
            }

        # Convert target image to numpy array if needed
        target_img_array = self._load_target_image(target_image)
        if target_img_array is None:
            ColorPrint.red(f"[D4ScaledMatcher] Failed to load target image")
            return {
                "total_matches": 0,
                "matches": [],
                "error": "Failed to load target image"
            }

        # Get template config from D4_TEMPLATE_CONFIGS
        template_config = D4_TEMPLATE_CONFIGS.get(template_name)
        if not template_config:
            ColorPrint.red(f"[D4ScaledMatcher] D4 template config not found: {template_name}")
            return {
                "total_matches": 0,
                "matches": [],
                "error": f"D4 template config not found: {template_name}"
            }
        
        threshold = template_config["threshold"]
        use_alpha = template_config.get("use_alpha", False)
        match_method = template_config.get("match_method", "ORB")

        # Get appropriate matcher for this template
        matcher = self._get_matcher(match_method)

        # Call ImageMatcher with in-memory images
        ColorPrint.gray(f"[D4ScaledMatcher] Calling {match_method} matcher (threshold: {threshold}, alpha: {use_alpha})")
        match_result = matcher.match_single_template(
            target_image=target_img_array,
            template_image=scaled_template_img,
            template_name=template_name,
            custom_threshold=threshold,
            use_alpha=use_alpha,
            detection_method=match_method
        )

        # Format result
        if match_result:
            ColorPrint.green(f"[D4ScaledMatcher] Match found: {template_name}")
            return {
                "total_matches": 1,
                "matches": [match_result],
                "error": None
            }
        else:
            ColorPrint.yellow(f"[D4ScaledMatcher] No match found: {template_name}")
            return {
                "total_matches": 0,
                "matches": [],
                "error": None
            }

    def match_multiple_templates(
        self,
        target_image: Union[str, Path, Image.Image, np.ndarray],
        template_names: List[str],
        output_dir: Optional[Path] = None,
        force_refresh_scale: bool = False
    ) -> Dict:
        """
        Match multiple templates with automatic scaling

        Args:
            target_image: Target image (path, PIL Image, or numpy array)
            template_names: List of template names from D4_TEMPLATE_CONFIGS
            output_dir: Optional output directory for debug images
            force_refresh_scale: Force re-scaling templates even if cached

        Returns:
            Match result dict with multiple matches:
            {
                "total_matches": int,
                "matches": [match_result_dict, ...],
                "error": str (optional)
            }
        """
        ColorPrint.blue(f"\n[D4ScaledMatcher] Matching {len(template_names)} templates")

        all_matches = []
        total_matches = 0

        for template_name in template_names:
            result = self.match_template(
                target_image=target_image,
                template_name=template_name,
                output_dir=output_dir,
                force_refresh_scale=force_refresh_scale
            )

            if result["total_matches"] > 0:
                all_matches.extend(result["matches"])
                total_matches += result["total_matches"]

        ColorPrint.blue(f"[D4ScaledMatcher] Multiple template matching complete: {total_matches} matches found")
        return {
            "total_matches": total_matches,
            "matches": all_matches,
            "error": None
        }

    def match_template_in_region(
        self,
        template_name: str,
        region_name: str,
        use_shared_region: bool = True,
        output_dir: Optional[Path] = None,
        force_refresh_scale: bool = False
    ) -> Dict:
        """
        Match template in a specific region (e.g., minimap, team_count, etc.)
        
        Args:
            template_name: Template name from D4_TEMPLATE_CONFIGS
            region_name: Region name (e.g., 'minimap', 'team_count', 'team_vote')
            use_shared_region: If True, use region from shared D4 data; if False, extract from full image
            output_dir: Optional output directory for debug images
            force_refresh_scale: Force re-scaling template even if cached
            
        Returns:
            Match result dict with single match:
            {
                "total_matches": int,
                "matches": [match_result_dict],
                "error": str (optional),
                "region_used": str,
                "region_source": str
            }
        """
        ColorPrint.blue(f"\n[D4ScaledMatcher] Matching template '{template_name}' in region '{region_name}'")
        
        try:
            # Get region image
            if use_shared_region:
                region_image = self._get_shared_region_image(region_name)
                region_source = "shared_data"
            else:
                region_image = self._extract_region_from_full_image(region_name)
                region_source = "full_image"
            
            if region_image is None:
                return {
                    "total_matches": 0,
                    "matches": [],
                    "error": f"Failed to get region image for '{region_name}'",
                    "region_used": region_name,
                    "region_source": region_source
                }
            
            # Get scale factors
            scale_x, scale_y = self._get_scale_factors()
            
            # Get scaled template image (in memory)
            scaled_template_img = self._get_scaled_template_image(
                template_name=template_name,
                scale_x=scale_x,
                scale_y=scale_y,
                force_refresh=force_refresh_scale
            )
            
            if scaled_template_img is None:
                return {
                    "total_matches": 0,
                    "matches": [],
                    "error": f"Failed to get scaled template: {template_name}",
                    "region_used": region_name,
                    "region_source": region_source
                }
            
            # Get template config from D4_TEMPLATE_CONFIGS
            template_config = D4_TEMPLATE_CONFIGS.get(template_name)
            if not template_config:
                return {
                    "total_matches": 0,
                    "matches": [],
                    "error": f"D4 template config not found: {template_name}",
                    "region_used": region_name,
                    "region_source": region_source
                }
            
            threshold = template_config["threshold"]
            use_alpha = template_config.get("use_alpha", False)
            match_method = template_config.get("match_method", "ORB")
            
            # Get appropriate matcher for this template
            matcher = self._get_matcher(match_method)
            
            # Convert region image to numpy array if needed
            if isinstance(region_image, Image.Image):
                region_array = np.array(region_image)
            else:
                region_array = region_image
            
            # Call ImageMatcher with region image
            ColorPrint.gray(f"[D4ScaledMatcher] Calling {match_method} matcher in region (threshold: {threshold}, alpha: {use_alpha})")
            match_result = matcher.match_single_template(
                target_image=region_array,
                template_image=scaled_template_img,
                template_name=template_name,
                custom_threshold=threshold,
                use_alpha=use_alpha,
                detection_method=match_method
            )
            
            # Save debug image if enabled
            if DEBUG and match_result:
                self._save_region_debug_image(region_array, scaled_template_img, match_result, template_name, region_name, output_dir)
            
            # Format result
            if match_result and match_result.get("success"):
                ColorPrint.green(f"[D4ScaledMatcher] Region match found: {template_name} in {region_name}")
                return {
                    "total_matches": 1,
                    "matches": [match_result],
                    "error": None,
                    "region_used": region_name,
                    "region_source": region_source
                }
            else:
                ColorPrint.yellow(f"[D4ScaledMatcher] No match found: {template_name} in {region_name}")
                return {
                    "total_matches": 0,
                    "matches": [],
                    "error": None,
                    "region_used": region_name,
                    "region_source": region_source
                }
                
        except Exception as e:
            error_msg = f"Error matching template in region: {e}"
            ColorPrint.red(f"[D4ScaledMatcher] {error_msg}")
            return {
                "total_matches": 0,
                "matches": [],
                "error": error_msg,
                "region_used": region_name,
                "region_source": "error"
            }

    def _get_shared_region_image(self, region_name: str) -> Optional[np.ndarray]:
        """
        Get region image from shared D4 data
        
        Args:
            region_name: Name of the region (e.g., 'minimap', 'team_count', 'team_vote')
            
        Returns:
            Region image as numpy array or None if not available
        """
        try:
            # Map region names to shared data attributes
            region_mapping = {
                'minimap': 'minimap_region_image',
                'team_count': 'team_count_region_image', 
                'team_vote': 'team_vote_region_image',
                'bag': 'bag_region_image',
                'blacksmith': 'blacksmith_region_image',
                'equipment_left': 'equipment_left_region_image',
                'equipment_right': 'equipment_right_region_image',
                'exp_bar': 'exp_bar_region_image',
                'map_name': 'map_name_region_image',
                'quest_text': 'quest_text_region_image'
            }
            
            attribute_name = region_mapping.get(region_name)
            if not attribute_name:
                ColorPrint.yellow(f"[D4ScaledMatcher] Unknown region name: {region_name}")
                return None
            
            # Get region image from shared data
            region_image = getattr(self.d4_data, attribute_name, None)
            if region_image is None:
                ColorPrint.yellow(f"[D4ScaledMatcher] No {region_name} region image in shared data")
                return None
            
            # Convert PIL Image to numpy array if needed
            if isinstance(region_image, Image.Image):
                return np.array(region_image)
            else:
                return region_image
                
        except Exception as e:
            ColorPrint.red(f"[D4ScaledMatcher] Error getting shared region image: {e}")
            return None

    def _extract_region_from_full_image(self, region_name: str) -> Optional[np.ndarray]:
        """
        Extract region from full game window image
        
        Args:
            region_name: Name of the region to extract
            
        Returns:
            Extracted region as numpy array or None if failed
        """
        try:
            # Get screenshot data from shared memory
            screenshot_data = self.d4_data.screenshot_data
            if not screenshot_data or not screenshot_data.game_window_image:
                ColorPrint.yellow("[D4ScaledMatcher] No screenshot data available")
                return None

            game_window_image = screenshot_data.game_window_image
            game_window_size = screenshot_data.game_window_size
            is_windowed = self.d4_data.is_windowed_mode()
            
            # Map region names to D4StandardCoordinates
            from share.game_interface_data import D4_STANDARD_COORDS, calculate_unified_scaled_coordinate
            
            region_coords = {
                'minimap': (D4_STANDARD_COORDS.minimap_region_start, D4_STANDARD_COORDS.minimap_region_end),
                'team_count': (D4_STANDARD_COORDS.team_count_region_start, D4_STANDARD_COORDS.team_count_region_end),
                'team_vote': (D4_STANDARD_COORDS.team_vote_region_start, D4_STANDARD_COORDS.team_vote_region_end),
                'bag': (D4_STANDARD_COORDS.bag_top_left, D4_STANDARD_COORDS.bag_bottom_right),
                'blacksmith': (D4_STANDARD_COORDS.blacksmith_menu_start, D4_STANDARD_COORDS.blacksmith_menu_end),
                'equipment_left': (D4_STANDARD_COORDS.equipment_left_region_start, D4_STANDARD_COORDS.equipment_left_region_end),
                'equipment_right': (D4_STANDARD_COORDS.equipment_right_region_start, D4_STANDARD_COORDS.equipment_right_region_end),
                'exp_bar': (D4_STANDARD_COORDS.exp_bar_region_start, D4_STANDARD_COORDS.exp_bar_region_end),
                'map_name': (D4_STANDARD_COORDS.map_name_region_start, D4_STANDARD_COORDS.map_name_region_end),
                'quest_text': (D4_STANDARD_COORDS.quest_text_region_start, D4_STANDARD_COORDS.quest_text_region_end)
            }
            
            if region_name not in region_coords:
                ColorPrint.yellow(f"[D4ScaledMatcher] Unknown region name: {region_name}")
                return None
            
            start_coord, end_coord = region_coords[region_name]
            
            # Calculate scaled coordinates
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
            
            # Extract region using ImageCrop library
            from pycore.pyutils.image_crop import ImageCrop
            region_crop = ImageCrop.crop_region(
                game_window_image,
                scaled_start,
                scaled_end,
                output_format="numpy"
            )
            
            return region_crop
            
        except Exception as e:
            ColorPrint.red(f"[D4ScaledMatcher] Error extracting region from full image: {e}")
            return None

    def _save_region_debug_image(
        self, 
        region_image: np.ndarray, 
        template_image: np.ndarray, 
        match_result: Dict, 
        template_name: str, 
        region_name: str,
        output_dir: Optional[Path] = None
    ):
        """
        Save debug image for region template matching
        
        Args:
            region_image: Region image as numpy array
            template_image: Template image as numpy array
            match_result: Match result dictionary
            template_name: Name of the template
            region_name: Name of the region
            output_dir: Optional output directory
        """
        try:
            if not DEBUG:
                return
                
            # Create debug directory
            if output_dir:
                debug_dir = output_dir
            else:
                debug_dir = TMP_DIR / "d4_annotated"
            debug_dir.mkdir(parents=True, exist_ok=True)
            
            # Create annotated image
            debug_image = region_image.copy()
            
            # Add match result information
            if match_result and match_result.get("success"):
                # Draw bounding box if match found
                if "polygon" in match_result:
                    polygon = match_result["polygon"]
                    cv2.polylines(debug_image, [polygon.astype(np.int32)], True, (0, 255, 0), 2)
                
                # Add text information
                text = f"Template: {template_name}"
                region_text = f"Region: {region_name}"
                status_text = "MATCH FOUND"
                confidence_text = f"Confidence: {match_result.get('match_score', 0):.3f}"
                
                cv2.putText(debug_image, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                cv2.putText(debug_image, region_text, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                cv2.putText(debug_image, status_text, (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                cv2.putText(debug_image, confidence_text, (10, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
            else:
                # No match found
                text = f"Template: {template_name}"
                region_text = f"Region: {region_name}"
                status_text = "NO MATCH"
                
                cv2.putText(debug_image, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                cv2.putText(debug_image, region_text, (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                cv2.putText(debug_image, status_text, (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
            
            # Save debug image
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
            debug_filename = f"region_match_{region_name}_{template_name}_{timestamp}.png"
            debug_path = debug_dir / debug_filename
            
            cv2.imwrite(str(debug_path), debug_image)
            ColorPrint.green(f"[D4ScaledMatcher] Region debug image saved: {debug_path}")
            
        except Exception as e:
            ColorPrint.red(f"[D4ScaledMatcher] Error saving region debug image: {e}")


# Global D4 scaled template matcher instance (singleton)
_d4_scaled_template_matcher = None


def get_d4_scaled_template_matcher() -> D4ScaledTemplateMatcher:
    """
    Get global D4 scaled template matcher instance (singleton)

    Returns:
        Global D4ScaledTemplateMatcher instance
    """
    global _d4_scaled_template_matcher

    if _d4_scaled_template_matcher is None:
        _d4_scaled_template_matcher = D4ScaledTemplateMatcher()

    return _d4_scaled_template_matcher
