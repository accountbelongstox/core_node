#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PNG Matcher
Enhanced image matching specifically for PNG images with transparency (alpha channel)
"""

import os
import sys
from typing import List, Tuple, Dict, Optional, Union
from pathlib import Path

from pycore.pyfoundations.third_party.api import get_third_package_numpy, get_third_package_cv2

numpy = get_third_package_numpy()
cv2 = get_third_package_cv2()
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class PNGMatcher:
    """
    Enhanced matcher for PNG images with alpha channel (transparency)

    Features:
    - Alpha-aware template matching
    - Mask-based matching (ignore transparent areas)
    - Multi-scale matching for better accuracy
    - Fallback to standard matching
    """

    def __init__(
        self,
        match_method: int = cv2.TM_CCOEFF_NORMED,
        threshold: float = 0.8,
        use_alpha_mask: bool = True,
        multi_scale: bool = False,
        scale_range: Tuple[float, float] = (0.8, 1.2),
        scale_steps: int = 5,
        standard_width: Optional[int] = None,
        standard_height: Optional[int] = None
    ):
        """
        Initialize PNG matcher

        Args:
            match_method: OpenCV template matching method
            threshold: Matching threshold (0.0-1.0)
            use_alpha_mask: Whether to use alpha channel as mask
            multi_scale: Whether to try multiple scales
            scale_range: Scale range for multi-scale matching (min, max)
            scale_steps: Number of scale steps to try
            standard_width: Standard reference width for auto-scaling (None = use target image width)
            standard_height: Standard reference height for auto-scaling (None = use target image height)
        """
        self.match_method = match_method
        self.threshold = threshold
        self.use_alpha_mask = use_alpha_mask
        self.multi_scale = multi_scale
        self.scale_range = scale_range
        self.scale_steps = scale_steps
        self.standard_width = standard_width
        self.standard_height = standard_height

        ColorPrint.green("[PNGMatcher] Initialized")
        ColorPrint.blue(f"[PNGMatcher] Method: {self._get_method_name(match_method)}")
        ColorPrint.blue(f"[PNGMatcher] Threshold: {threshold}")
        ColorPrint.blue(f"[PNGMatcher] Alpha mask: {use_alpha_mask}")
        ColorPrint.blue(f"[PNGMatcher] Multi-scale: {multi_scale}")
        if standard_width is not None and standard_height is not None:
            ColorPrint.blue(f"[PNGMatcher] Standard resolution: {standard_width}x{standard_height}")

    def _get_method_name(self, method: int) -> str:
        """Get method name for display"""
        method_names = {
            cv2.TM_CCOEFF_NORMED: "TM_CCOEFF_NORMED",
            cv2.TM_CCORR_NORMED: "TM_CCORR_NORMED",
            cv2.TM_SQDIFF_NORMED: "TM_SQDIFF_NORMED"
        }
        return method_names.get(method, f"Method_{method}")

    def load_image_with_alpha(self, image_path: Union[str, Path]) -> Tuple[np.ndarray, Optional[np.ndarray]]:
        """
        Load image and extract alpha channel if present

        Args:
            image_path: Path to image file

        Returns:
            Tuple of (BGR image, alpha mask or None)
        """
        # Load image with alpha channel
        image = cv2.imread(str(image_path), cv2.IMREAD_UNCHANGED)

        if image is None:
            ColorPrint.red(f"[PNGMatcher] Failed to load image: {image_path}")
            return None, None

        # Check if image has alpha channel
        if image.shape[2] == 4:
            # Extract alpha channel
            alpha = image[:, :, 3]
            # Convert BGRA to BGR
            bgr = cv2.cvtColor(image, cv2.COLOR_BGRA2BGR)
            ColorPrint.gray(f"[PNGMatcher] Loaded PNG with alpha: {image_path}")
            return bgr, alpha
        else:
            # No alpha channel
            ColorPrint.gray(f"[PNGMatcher] Loaded image without alpha: {image_path}")
            return image, None

    def create_mask_from_alpha(self, alpha: np.ndarray, threshold: int = 10) -> np.ndarray:
        """
        Create binary mask from alpha channel

        Args:
            alpha: Alpha channel (0-255)
            threshold: Threshold for mask creation (pixels > threshold are considered opaque)

        Returns:
            Binary mask (0 or 255)
        """
        # Create binary mask: pixels with alpha > threshold are 255, others are 0
        mask = np.where(alpha > threshold, 255, 0).astype(np.uint8)
        return mask

    def match_template_with_mask(
        self,
        target_image: np.ndarray,
        template: np.ndarray,
        mask: Optional[np.ndarray] = None,
        threshold: Optional[float] = None
    ) -> Tuple[Optional[Tuple[int, int]], float]:
        """
        Match template in target image with optional mask

        Args:
            target_image: Target image (BGR)
            template: Template image (BGR)
            mask: Optional mask (255 = use, 0 = ignore)
            threshold: Optional threshold (if None, use instance default)

        Returns:
            Tuple of (match_location, match_score) or (None, 0.0)
        """
        # Use provided threshold or instance default
        if threshold is None:
            threshold = self.threshold

        # Convert to grayscale for matching
        gray_target = cv2.cvtColor(target_image, cv2.COLOR_BGR2GRAY)
        gray_template = cv2.cvtColor(template, cv2.COLOR_BGR2GRAY)

        # Perform template matching
        if mask is not None and self.use_alpha_mask:
            # Use mask for matching (OpenCV 3.0+)
            ColorPrint.gray("[PNGMatcher] Using alpha mask for matching")
            try:
                result = cv2.matchTemplate(gray_target, gray_template, self.match_method, mask=mask)
            except Exception as e:
                ColorPrint.yellow(f"[PNGMatcher] Masked matching failed, falling back: {e}")
                result = cv2.matchTemplate(gray_target, gray_template, self.match_method)
        else:
            result = cv2.matchTemplate(gray_target, gray_template, self.match_method)

        # Find best match location
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

        # For SQDIFF methods, minimum is best; for others, maximum is best
        if self.match_method in [cv2.TM_SQDIFF, cv2.TM_SQDIFF_NORMED]:
            match_loc = min_loc
            match_score = 1.0 - min_val  # Invert for consistency
        else:
            match_loc = max_loc
            match_score = max_val

        ColorPrint.gray(f"[PNGMatcher] Match score: {match_score:.4f} (threshold: {threshold:.3f})")

        if match_score < threshold:
            return None, match_score

        return match_loc, match_score

    def match_template_multi_scale(
        self,
        target_image: np.ndarray,
        template: np.ndarray,
        mask: Optional[np.ndarray] = None
    ) -> Tuple[Optional[Tuple[int, int]], float, float]:
        """
        Match template at multiple scales

        Args:
            target_image: Target image (BGR)
            template: Template image (BGR)
            mask: Optional mask

        Returns:
            Tuple of (match_location, match_score, best_scale)
        """
        best_match = None
        best_score = 0.0
        best_scale = 1.0

        h_orig, w_orig = template.shape[:2]

        # Generate scale factors
        scales = np.linspace(self.scale_range[0], self.scale_range[1], self.scale_steps)

        ColorPrint.blue(f"[PNGMatcher] Trying {len(scales)} scales: {scales}")

        for scale in scales:
            # Resize template and mask
            new_w = int(w_orig * scale)
            new_h = int(h_orig * scale)

            if new_w < 10 or new_h < 10:
                continue

            scaled_template = cv2.resize(template, (new_w, new_h), interpolation=cv2.INTER_CUBIC)

            scaled_mask = None
            if mask is not None:
                scaled_mask = cv2.resize(mask, (new_w, new_h), interpolation=cv2.INTER_NEAREST)

            # Try matching at this scale
            match_loc, match_score = self.match_template_with_mask(
                target_image,
                scaled_template,
                scaled_mask
            )

            ColorPrint.gray(f"[PNGMatcher] Scale {scale:.2f}: score={match_score:.4f}")

            if match_score > best_score:
                best_score = match_score
                best_match = match_loc
                best_scale = scale

        if best_match is not None:
            ColorPrint.green(f"[PNGMatcher] Best match at scale {best_scale:.2f} with score {best_score:.4f}")

        return best_match, best_score, best_scale

    def _calculate_auto_scale(self, target_image: np.ndarray) -> Tuple[float, float]:
        """
        Calculate auto-scale factors based on target image vs standard resolution

        Args:
            target_image: Target image (BGR)

        Returns:
            Tuple (scale_x, scale_y) - non-proportional scaling factors
        """
        target_h, target_w = target_image.shape[:2]

        # If no standard resolution set, return 1.0 (100% - no scaling)
        if self.standard_width is None or self.standard_height is None:
            ColorPrint.blue(f"[PNGMatcher] Auto-scale: Using target size as standard ({target_w}x{target_h})")
            return 1.0, 1.0

        # Calculate scale factors (non-proportional)
        scale_x = target_w / self.standard_width
        scale_y = target_h / self.standard_height

        ColorPrint.blue(f"[PNGMatcher] Auto-scale: Target {target_w}x{target_h} vs Standard {self.standard_width}x{self.standard_height}")
        ColorPrint.blue(f"[PNGMatcher] Auto-scale: scale_x={scale_x:.4f}, scale_y={scale_y:.4f}")

        return scale_x, scale_y

    def find_template(
        self,
        target_image_path: Union[str, Path],
        template_path: Union[str, Path],
        template_name: Optional[str] = None,
        custom_threshold: Optional[float] = None,
        use_alpha: Optional[bool] = None
    ) -> Optional[Dict]:
        """
        Find template in target image with auto-scaling support

        Args:
            target_image_path: Path to target image
            template_path: Path to template image
            template_name: Optional name for template
            custom_threshold: Custom threshold for this specific template (overrides default)
            use_alpha: Whether to use alpha channel (None = use self.use_alpha_mask)

        Returns:
            Match result dictionary or None
        """
        if template_name is None:
            template_name = Path(template_path).stem

        # Determine if alpha should be used
        if use_alpha is None:
            use_alpha = self.use_alpha_mask

        # Use custom threshold if provided, otherwise use instance default
        threshold = custom_threshold if custom_threshold is not None else self.threshold

        ColorPrint.blue(f"\n[PNGMatcher] Finding template: {template_name}")
        ColorPrint.blue(f"[PNGMatcher] Using threshold: {threshold:.3f}")
        ColorPrint.blue(f"[PNGMatcher] Using alpha mask: {use_alpha}")

        # Load target image (no alpha needed)
        target_bgr, _ = self.load_image_with_alpha(target_image_path)
        if target_bgr is None:
            return None

        # Load template with alpha
        template_bgr, template_alpha = self.load_image_with_alpha(template_path)
        if template_bgr is None:
            return None

        # Calculate auto-scale factors based on target vs standard resolution
        scale_x, scale_y = self._calculate_auto_scale(target_bgr)

        # Apply auto-scaling to template if needed (non-proportional)
        if scale_x != 1.0 or scale_y != 1.0:
            template_h, template_w = template_bgr.shape[:2]
            scaled_w = int(template_w * scale_x)
            scaled_h = int(template_h * scale_y)

            ColorPrint.blue(f"[PNGMatcher] Auto-scaling template from {template_w}x{template_h} to {scaled_w}x{scaled_h}")

            template_bgr = cv2.resize(template_bgr, (scaled_w, scaled_h), interpolation=cv2.INTER_LINEAR)

            if template_alpha is not None:
                template_alpha = cv2.resize(template_alpha, (scaled_w, scaled_h), interpolation=cv2.INTER_LINEAR)

        # Create mask from alpha if available and enabled
        mask = None
        if template_alpha is not None and use_alpha:
            mask = self.create_mask_from_alpha(template_alpha)
            ColorPrint.blue(f"[PNGMatcher] Created mask from alpha channel")

        # Perform matching
        if self.multi_scale:
            match_loc, match_score, scale = self.match_template_multi_scale(
                target_bgr,
                template_bgr,
                mask,
                threshold
            )
        else:
            match_loc, match_score = self.match_template_with_mask(
                target_bgr,
                template_bgr,
                mask,
                threshold
            )
            scale = 1.0

        if match_loc is None:
            ColorPrint.yellow(f"[PNGMatcher] No match found for {template_name}")
            return None

        # Calculate bounding box
        h, w = template_bgr.shape[:2]
        h_scaled = int(h * scale)
        w_scaled = int(w * scale)

        top_left = match_loc
        bottom_right = (top_left[0] + w_scaled, top_left[1] + h_scaled)

        # Create polygon (rectangle)
        polygon = np.array([
            [top_left[0], top_left[1]],
            [bottom_right[0], top_left[1]],
            [bottom_right[0], bottom_right[1]],
            [top_left[0], bottom_right[1]]
        ], dtype=np.float32)

        center = np.array([(top_left[0] + bottom_right[0]) / 2,
                          (top_left[1] + bottom_right[1]) / 2])

        ColorPrint.green(f"[PNGMatcher] Match found: {template_name} at {center} (score: {match_score:.4f}, threshold: {threshold:.3f})")

        return {
            "template_name": template_name,
            "polygon": polygon,
            "center": center,
            "match_score": match_score,
            "match_threshold": threshold,  # Store the threshold used
            "scale": scale,
            "auto_scale_x": scale_x,
            "auto_scale_y": scale_y,
            "top_left": top_left,
            "bottom_right": bottom_right,
            "success": True
        }

    def find_multiple_templates(
        self,
        target_image_path: Union[str, Path],
        template_paths: List[Union[str, Path]]
    ) -> List[Dict]:
        """
        Find multiple templates in target image

        Args:
            target_image_path: Path to target image
            template_paths: List of template paths

        Returns:
            List of match results
        """
        results = []

        for template_path in template_paths:
            result = self.find_template(target_image_path, template_path)
            if result is not None:
                results.append(result)

        ColorPrint.green(f"\n[PNGMatcher] Found {len(results)}/{len(template_paths)} templates")

        return results


# Example usage
if __name__ == "__main__":
    matcher = PNGMatcher(
        threshold=0.7,
        use_alpha_mask=True,
        multi_scale=True
    )

    result = matcher.find_template(
        target_image_path="screenshot.png",
        template_path="template.png"
    )

    if result:
        print(f"Found at: {result['center']}")
        print(f"Score: {result['match_score']:.4f}")
