#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scaled Template Matcher
Automatically scales templates based on actual game window resolution vs standard resolution
Unified template matching interface for the entire application

Workflow:
1. Get actual game window size from screenshot_provider
2. Calculate scale factors: actual_size / STANDARD_RESOLUTION
3. Auto-scale templates from TEMPLATE_CONFIGS based on scale factors
4. Cache scaled templates in memory for performance
5. Call image_matcher with scaled templates
6. Return results

Usage:
    from d3utils.scaled_template_matcher import ScaledTemplateMatcher

    matcher = ScaledTemplateMatcher()
    result = matcher.match_template(
        target_image=game_window_image,  # PIL Image or path
        template_name="bag_left",        # Name from TEMPLATE_CONFIGS
        output_dir=None                  # Optional output directory
    )
"""

import os
import sys
import cv2
import numpy as np
from typing import Optional, Union, Dict, List, Tuple
from pathlib import Path
from PIL import Image

# Add project paths
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)

sys.path.insert(0, project_root)

from providor.common_imports import ColorPrint, ImageMatcher
from providor.providor_index import (
    TEMPLATE_CONFIGS,
    STANDARD_RESOLUTION_WIDTH,
    STANDARD_RESOLUTION_HEIGHT,
    SCALED_TEMPLATES_CACHE_DIR,
    get_template_path,
    get_template_threshold,
    get_template_use_alpha,
    get_template_match_method
)
from d3utils.share import get_global_scale

class ScaledTemplateMatcher:
    """
    Scaled Template Matcher

    Automatically handles template scaling based on resolution differences
    between actual game window and standard resolution.

    Features:
    - Auto-calculates scale factors from screenshot_provider
    - Scales templates in memory (cached for performance)
    - Delegates to ImageMatcher for actual matching
    - Supports single and multiple template matching
    """

    def __init__(self):
        """Initialize scaled template matcher"""
        # Create ImageMatcher instances for different feature detectors
        # We'll create them on-demand to save memory
        self._matchers = {}  # {detector_type: ImageMatcher instance}

        # In-memory cache for original templates
        # Format: {template_name: numpy.ndarray}
        self._original_template_cache = {}

        # In-memory cache for scaled templates
        # Format: {(template_name, scale_x, scale_y): numpy.ndarray}
        self._template_cache = {}

        ColorPrint.green("[ScaledTemplateMatcher] Initialized")

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
                ColorPrint.blue(f"[ScaledMatcher] Creating {method_type} feature matcher")
                self._matchers[cache_key] = ImageMatcher(
                    ratio_thresh=0.80,
                    min_inliers=4,
                    nfeatures=10000,
                    standard_width=STANDARD_RESOLUTION_WIDTH,
                    standard_height=STANDARD_RESOLUTION_HEIGHT,
                    default_method=cv2.TM_CCORR_NORMED,  # Default for fallback template matching
                    support_alpha=False,  # Alpha controlled per-template via config
                    feature_detector=method_type
                )
        else:
            # Template matching - use ORB as feature detector, but with custom template method
            cv_method = template_method_map.get(method_type, cv2.TM_CCORR_NORMED)
            cache_key = method_type

            if cache_key not in self._matchers:
                ColorPrint.blue(f"[ScaledMatcher] Creating {method_type} template matcher")
                self._matchers[cache_key] = ImageMatcher(
                    ratio_thresh=0.80,
                    min_inliers=4,
                    nfeatures=10000,
                    standard_width=STANDARD_RESOLUTION_WIDTH,
                    standard_height=STANDARD_RESOLUTION_HEIGHT,
                    default_method=cv_method,  # Use the specified template matching method
                    support_alpha=False,  # Alpha controlled per-template via config
                    feature_detector="ORB"  # Use ORB for feature fallback
                )

        return self._matchers[cache_key]

    def _get_scale_factors(self) -> Tuple[float, float]:
        """
        Get current scale factors from global scale

        Returns:
            Tuple of (scale_x, scale_y)
        """
        scale_x, scale_y = get_global_scale()
        ColorPrint.gray(f"[ScaledMatcher] Current scale factors: X={scale_x:.4f}, Y={scale_y:.4f}")
        return scale_x, scale_y

    def _load_target_image(self, target_image: Union[str, Path, Image.Image, np.ndarray]) -> Optional[np.ndarray]:
        """
        Load target image to numpy array (in memory)

        Args:
            target_image: Target image (path, PIL Image, or numpy array)

        Returns:
            Target image as numpy array (BGR) or None if failed
        """
        try:
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
                    ColorPrint.red(f"[ScaledMatcher] Failed to load image from path: {target_image}")
                return img
        except Exception as e:
            ColorPrint.red(f"[ScaledMatcher] Error loading target image: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _load_original_template(self, template_name: str) -> Optional[np.ndarray]:
        """
        Load original template image from disk (cached)

        Args:
            template_name: Template name from TEMPLATE_CONFIGS

        Returns:
            Original template as numpy array (BGR or BGRA) or None if failed
        """
        # Check cache first
        if template_name in self._original_template_cache:
            ColorPrint.gray(f"[ScaledMatcher] Using cached original template: {template_name}")
            return self._original_template_cache[template_name]

        # Get original template path
        original_path = get_template_path(template_name)
        if not original_path or not Path(original_path).exists():
            ColorPrint.yellow(f"[ScaledMatcher] Template not found: {template_name}")
            return None

        # Load original template from disk
        try:
            ColorPrint.blue(f"[ScaledMatcher] Loading original template from disk: {template_name}")
            template_img = cv2.imread(str(original_path), cv2.IMREAD_UNCHANGED)
            if template_img is None:
                ColorPrint.red(f"[ScaledMatcher] Failed to load template: {original_path}")
                return None

            # Cache the original template
            self._original_template_cache[template_name] = template_img
            ColorPrint.green(f"[ScaledMatcher] Cached original template: {template_name}")

            return template_img

        except Exception as e:
            ColorPrint.red(f"[ScaledMatcher] Error loading template {template_name}: {e}")
            import traceback
            traceback.print_exc()
            return None

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
            template_name: Template name from TEMPLATE_CONFIGS
            scale_x: X scale factor
            scale_y: Y scale factor
            force_refresh: Force re-scaling even if cached

        Returns:
            Scaled template as numpy array (BGR or BGRA) or None if failed
        """
        # Check scaled template cache first
        cache_key = (template_name, round(scale_x, 4), round(scale_y, 4))

        if not force_refresh and cache_key in self._template_cache:
            ColorPrint.gray(f"[ScaledMatcher] Using cached scaled template: {template_name}")
            return self._template_cache[cache_key]

        # Load original template (from cache or disk)
        template_img = self._load_original_template(template_name)
        if template_img is None:
            return None

        try:
            original_height, original_width = template_img.shape[:2]
            ColorPrint.gray(f"[ScaledMatcher] Original size: {original_width}x{original_height}")

            # If scale is 1.0 x 1.0, no scaling needed
            if abs(scale_x - 1.0) < 0.001 and abs(scale_y - 1.0) < 0.001:
                ColorPrint.gray(f"[ScaledMatcher] No scaling needed for {template_name} (scale = 1.0)")
                # Cache using the same key for consistency
                self._template_cache[cache_key] = template_img
                return template_img

            # Calculate new size
            new_width = int(original_width * scale_x)
            new_height = int(original_height * scale_y)
            ColorPrint.blue(f"[ScaledMatcher] Scaling template {template_name}: ({scale_x:.3f}x, {scale_y:.3f}y) -> {new_width}x{new_height}")

            # Scale template using INTER_AREA for downscaling, INTER_CUBIC for upscaling
            if scale_x < 1.0 or scale_y < 1.0:
                interpolation = cv2.INTER_AREA
            else:
                interpolation = cv2.INTER_CUBIC

            scaled_template = cv2.resize(template_img, (new_width, new_height), interpolation=interpolation)

            # Cache the scaled image in memory
            self._template_cache[cache_key] = scaled_template
            ColorPrint.green(f"[ScaledMatcher] Cached scaled template in memory: {template_name}")

            return scaled_template

        except Exception as e:
            ColorPrint.red(f"[ScaledMatcher] Error scaling template {template_name}: {e}")
            import traceback
            traceback.print_exc()
            return None

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
            template_name: Template name from TEMPLATE_CONFIGS
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
        ColorPrint.blue(f"\n[ScaledMatcher] Matching template: {template_name}")

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
            ColorPrint.red(f"[ScaledMatcher] Failed to get scaled template: {template_name}")
            return {
                "total_matches": 0,
                "matches": [],
                "error": "Failed to scale template"
            }

        # Convert target image to numpy array if needed
        target_img_array = self._load_target_image(target_image)
        if target_img_array is None:
            ColorPrint.red(f"[ScaledMatcher] Failed to load target image")
            return {
                "total_matches": 0,
                "matches": [],
                "error": "Failed to load target image"
            }

        # Get template config
        threshold = get_template_threshold(template_name)
        use_alpha = get_template_use_alpha(template_name)
        match_method = get_template_match_method(template_name)

        # Get appropriate matcher for this template
        matcher = self._get_matcher(match_method)

        # Call ImageMatcher with in-memory images
        ColorPrint.gray(f"[ScaledMatcher] Calling {match_method} matcher (threshold: {threshold}, alpha: {use_alpha})")
        match_result = matcher.match_single_template(
            target_image=target_img_array,
            template_image=scaled_template_img,
            template_name=template_name,
            custom_threshold=threshold,
            use_alpha=use_alpha
        )

        # Format result to match expected output format
        if match_result and match_result.get("success"):
            ColorPrint.green(f"[ScaledMatcher] Match complete: 1 match found")
            return {
                "total_matches": 1,
                "matches": [match_result]
            }
        else:
            ColorPrint.yellow(f"[ScaledMatcher] Match complete: 0 matches found")
            return {
                "total_matches": 0,
                "matches": []
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
            template_names: List of template names from TEMPLATE_CONFIGS
            output_dir: Optional output directory for debug images
            force_refresh_scale: Force re-scaling templates even if cached

        Returns:
            Combined match result dict:
            {
                "total_matches": int,
                "matches": [match_result_dict, ...]
            }
        """
        ColorPrint.blue(f"\n[ScaledMatcher] Matching {len(template_names)} templates")

        # Convert target image to numpy array
        target_img_array = self._load_target_image(target_image)
        if target_img_array is None:
            ColorPrint.red(f"[ScaledMatcher] Failed to load target image")
            return {
                "total_matches": 0,
                "matches": [],
                "error": "Failed to load target image"
            }

        # Get scale factors
        scale_x, scale_y = self._get_scale_factors()

        # Collect all matches
        all_matches = []

        # Match each template
        for template_name in template_names:
            # Get scaled template image (in memory)
            scaled_template_img = self._get_scaled_template_image(
                template_name=template_name,
                scale_x=scale_x,
                scale_y=scale_y,
                force_refresh=force_refresh_scale
            )

            if scaled_template_img is None:
                ColorPrint.yellow(f"[ScaledMatcher] Skipping template: {template_name}")
                continue

            # Get template config
            threshold = get_template_threshold(template_name)
            use_alpha = get_template_use_alpha(template_name)
            match_method = get_template_match_method(template_name)

            # Get appropriate matcher for this template
            matcher = self._get_matcher(match_method)

            # Call ImageMatcher with in-memory images
            ColorPrint.gray(f"[ScaledMatcher] Matching {template_name} with {match_method} (threshold: {threshold}, alpha: {use_alpha})")
            match_result = matcher.match_single_template(
                target_image=target_img_array,
                template_image=scaled_template_img,
                template_name=template_name,
                custom_threshold=threshold,
                use_alpha=use_alpha
            )

            # Collect match if found
            if match_result and match_result.get("success"):
                all_matches.append(match_result)
                ColorPrint.green(f"[ScaledMatcher] Match found for {template_name}")

        # Return combined results
        total_matches = len(all_matches)
        ColorPrint.green(f"[ScaledMatcher] Match complete: {total_matches} total matches")

        return {
            "total_matches": total_matches,
            "matches": all_matches
        }

    def match_template_in_region(
        self,
        target_image: Union[str, Path, Image.Image, np.ndarray],
        template_name: str,
        output_dir: Optional[Path] = None
    ) -> Dict:
        """
        Match a template in a cropped region without scaling

        This method is used when searching in a small cropped region from a full-resolution screenshot.
        Since the region is already at full resolution, no scaling is needed.

        Args:
            target_image: Target region image (path, PIL Image, or numpy array)
            template_name: Template name from TEMPLATE_CONFIGS
            output_dir: Optional output directory for debug images

        Returns:
            Match result dict:
            {
                "total_matches": int,
                "matches": [match_result_dict],
                "error": str (optional)
            }
        """
        ColorPrint.blue(f"\n[ScaledMatcher] Matching template in region: {template_name}")

        # Convert target image to numpy array
        target_img_array = self._load_target_image(target_image)
        if target_img_array is None:
            ColorPrint.red(f"[ScaledMatcher] Failed to load target region image")
            return {
                "total_matches": 0,
                "matches": [],
                "error": "Failed to load target image"
            }

        # Load original template (from cache or disk)
        template_img = self._load_original_template(template_name)
        if template_img is None:
            ColorPrint.red(f"[ScaledMatcher] Failed to load template: {template_name}")
            return {
                "total_matches": 0,
                "matches": [],
                "error": "Failed to load template"
            }

        threshold = get_template_threshold(template_name)
        use_alpha = get_template_use_alpha(template_name)
        match_method = get_template_match_method(template_name)

        # Get appropriate matcher for this template
        matcher = self._get_matcher(match_method)

        # Call ImageMatcher with in-memory images (no scaling)
        ColorPrint.gray(f"[ScaledMatcher] Calling {match_method} matcher for region (threshold: {threshold}, alpha: {use_alpha})")
        match_result = matcher.match_single_template(
            target_image=target_img_array,
            template_image=template_img,
            template_name=template_name,
            custom_threshold=threshold,
            use_alpha=use_alpha
        )

        # Format result
        if match_result and match_result.get("success"):
            ColorPrint.green(f"[ScaledMatcher] Region match complete: 1 match found")
            return {
                "total_matches": 1,
                "matches": [match_result]
            }
        else:
            ColorPrint.yellow(f"[ScaledMatcher] Region match complete: 0 matches found")
            return {
                "total_matches": 0,
                "matches": []
            }

    def clear_cache(self):
        """Clear all in-memory template caches"""
        self._original_template_cache.clear()
        self._template_cache.clear()
        ColorPrint.blue("[ScaledMatcher] All template caches cleared")

# Singleton instance
_scaled_matcher_instance = None

def get_scaled_template_matcher() -> ScaledTemplateMatcher:
    """
    Get singleton ScaledTemplateMatcher instance

    Returns:
        ScaledTemplateMatcher instance
    """
    global _scaled_matcher_instance

    if _scaled_matcher_instance is None:
        _scaled_matcher_instance = ScaledTemplateMatcher()

    return _scaled_matcher_instance

# Example usage
if __name__ == "__main__":
    matcher = get_scaled_template_matcher()

    # Example: Match bag_left template
    result = matcher.match_template(
        target_image="path/to/screenshot.png",
        template_name="bag_left"
    )

    print(f"Matches found: {result['total_matches']}")
