#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image Matcher
Feature-based image matching to locate template images within a larger image
Uses ORB features for fast, robust matching with perspective transformation
"""

import os
import sys
from typing import List, Tuple, Dict, Optional, Union
from pathlib import Path
from datetime import datetime

from pycore.pyfoundations.third_party import get_third_package_numpy, get_third_package_cv2

numpy = get_third_package_numpy()
np = numpy
cv2 = get_third_package_cv2()
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class ImageMatcher:
    """
    Feature-based image matcher for locating template images in a target image

    Features:
    - ORB feature detection (fast, license-free)
    - RANSAC homography estimation
    - Multi-template matching support
    - PNG alpha channel support (transparency handling)
    - Visual result output with bounding boxes
    """

    def __init__(
        self,
        ratio_thresh: float = 0.75,
        min_inliers: int = 8,
        nfeatures: int = 5000,
        ransac_threshold: float = 5.0,
        standard_width: Optional[int] = None,
        standard_height: Optional[int] = None
    ):
        """
        Initialize image matcher

        Args:
            ratio_thresh: Lowe's ratio test threshold (0.7-0.8 typical)
            min_inliers: Minimum number of good matches required
            nfeatures: Maximum features to detect (ORB/SIFT)
            ransac_threshold: RANSAC reprojection error threshold
            standard_width: Standard reference width for auto-scaling (None = use target image width)
            standard_height: Standard reference height for auto-scaling (None = use target image height)
        """
        self.ratio_thresh = ratio_thresh
        self.min_inliers = min_inliers
        self.ransac_threshold = ransac_threshold
        self.standard_width = standard_width
        self.standard_height = standard_height
        self.nfeatures = nfeatures
        self._silent = False

        ColorPrint.blue(f"[ImageMatcher] Feature ratio threshold: {ratio_thresh}")
        ColorPrint.blue(f"[ImageMatcher] Minimum inliers: {min_inliers}")
        ColorPrint.blue(f"[ImageMatcher] Max features: {nfeatures}")
        ColorPrint.blue(f"[ImageMatcher] RANSAC threshold: {ransac_threshold}px")

        if standard_width is not None and standard_height is not None:
            ColorPrint.blue(f"[ImageMatcher] Standard resolution: {standard_width}x{standard_height}")

    @staticmethod
    def _get_method_name(method: int) -> str:
        """Get template matching method name"""
        method_names = {
            cv2.TM_CCOEFF: "TM_CCOEFF",
            cv2.TM_CCOEFF_NORMED: "TM_CCOEFF_NORMED",
            cv2.TM_CCORR: "TM_CCORR",
            cv2.TM_CCORR_NORMED: "TM_CCORR_NORMED",
            cv2.TM_SQDIFF: "TM_SQDIFF",
            cv2.TM_SQDIFF_NORMED: "TM_SQDIFF_NORMED"
        }
        return method_names.get(method, f"UNKNOWN({method})")

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
            if not self._silent:
                ColorPrint.debug(f"[ImageMatcher] Auto-scale: Using target size as standard ({target_w}x{target_h})")
            return 1.0, 1.0

        # Calculate scale factors (non-proportional)
        scale_x = target_w / self.standard_width
        scale_y = target_h / self.standard_height

        if not self._silent:
            ColorPrint.debug(f"[ImageMatcher] Auto-scale: Target {target_w}x{target_h} vs Standard {self.standard_width}x{self.standard_height}")
            ColorPrint.debug(f"[ImageMatcher] Auto-scale: scale_x={scale_x:.4f}, scale_y={scale_y:.4f}")

        return scale_x, scale_y

    def match_single_template(
        self,
        target_image: np.ndarray,
        template_image: np.ndarray,
        template_name: str = "template",
        custom_threshold: float = None,
        use_alpha: bool = None,
        detection_method: str = "ORB",
        silent: bool = False
    ) -> Optional[Dict]:
        """
        Match a single template image in the target image with auto-scaling support

        Args:
            target_image: Large image to search in (BGR format)
            template_image: Small template image to find (BGR or BGRA format)
            template_name: Name identifier for this template
            custom_threshold: Custom matching threshold (default: uses self.ratio_thresh)
                            - For feature matching (SIFT/ORB/AKAZE): Used as Lowe's ratio test threshold
                              Typical range: 0.6-0.9 (higher = stricter matching)
                            - For template matching: Used as correlation threshold
                              Typical range: 0.7-0.95 (higher = stricter matching)
            use_alpha: Whether to use alpha channel (None = use self.support_alpha)
            method: Matching method to use (None = auto-detect based on feature_detector)
                   - Feature methods: "SIFT", "ORB", "AKAZE"
                   - Template methods: "TM_CCOEFF", "TM_CCORR", "TM_CCORR_NORMED", etc.
                   If None, will use the configured feature_detector type

        Returns:
            Dictionary with match results or None if no match found:
            {
                "template_name": str,
                "polygon": np.ndarray,  # 4 corner points in target image
                "center": np.ndarray,   # Center point (x, y)
                "num_matches": int,     # Number of good feature matches
                "match_threshold": float, # Threshold used for matching
                "auto_scale_x": float,  # Auto-scale factor X
                "auto_scale_y": float,  # Auto-scale factor Y
                "success": bool
            }
        """
        prev_silent = self._silent
        self._silent = silent
        try:
            return self._match_single_template_impl(
                target_image, template_image, template_name,
                custom_threshold, use_alpha, detection_method
            )
        finally:
            self._silent = prev_silent

    def _match_single_template_impl(
        self,
        target_image: np.ndarray,
        template_image: np.ndarray,
        template_name: str,
        custom_threshold: float,
        use_alpha: bool,
        detection_method: str
    ) -> Optional[Dict]:
        """Internal implementation; _silent must be set by caller."""
        # Calculate auto-scale factors based on target vs standard resolution
        scale_x, scale_y = self._calculate_auto_scale(target_image)

        # Apply auto-scaling to template if needed (non-proportional)
        scaled_template = template_image
        if scale_x != 1.0 or scale_y != 1.0:
            template_h, template_w = template_image.shape[:2]
            scaled_w = int(template_w * scale_x)
            scaled_h = int(template_h * scale_y)

            if not self._silent:
                ColorPrint.debug(f"[ImageMatcher] Auto-scaling template from {template_w}x{template_h} to {scaled_w}x{scaled_h}")

            scaled_template = cv2.resize(template_image, (scaled_w, scaled_h), interpolation=cv2.INTER_LINEAR)

        # Initialize the appropriate feature detector for this call
        detection_method_upper = detection_method.upper()

        if detection_method_upper == "SIFT":
            detector = cv2.SIFT_create(nfeatures=self.nfeatures)
            matcher = cv2.BFMatcher(cv2.NORM_L2, crossCheck=False)
            if not self._silent:
                ColorPrint.blue(f"[ImageMatcher] Using SIFT feature detector")
        elif detection_method_upper == "AKAZE":
            detector = cv2.AKAZE_create()
            matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
            if not self._silent:
                ColorPrint.blue(f"[ImageMatcher] Using AKAZE feature detector")
        else:  # Default to ORB
            detector = cv2.ORB_create(nfeatures=self.nfeatures)
            matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
            if not self._silent:
                ColorPrint.blue(f"[ImageMatcher] Using ORB feature detector")

        # Feature-based methods
        feature_methods = ["SIFT", "ORB", "AKAZE"]

        # Template matching methods map
        template_method_map = {
            "TM_CCOEFF": cv2.TM_CCOEFF,
            "TM_CCOEFF_NORMED": cv2.TM_CCOEFF_NORMED,
            "TM_CCORR": cv2.TM_CCORR,
            "TM_CCORR_NORMED": cv2.TM_CCORR_NORMED,
            "TM_SQDIFF": cv2.TM_SQDIFF,
            "TM_SQDIFF_NORMED": cv2.TM_SQDIFF_NORMED
        }

        if detection_method_upper in feature_methods:
            # Use feature-based matching
            ratio_thresh = custom_threshold if custom_threshold is not None else self.ratio_thresh
            if not self._silent:
                ColorPrint.debug(f"[ImageMatcher] Using {detection_method_upper} feature matching with threshold {ratio_thresh}")
            result = self._match_with_features(target_image, scaled_template, template_name, ratio_thresh, detector, matcher)

            if result is not None:
                result["auto_scale_x"] = scale_x
                result["auto_scale_y"] = scale_y
                result["match_threshold"] = ratio_thresh
                result["matching_method"] = detection_method_upper
            return result

        elif detection_method_upper in template_method_map:
            # Use template-based matching
            threshold = custom_threshold if custom_threshold is not None else 0.8
            cv_method = template_method_map[detection_method_upper]
            if not self._silent:
                ColorPrint.debug(f"[ImageMatcher] Using {detection_method_upper} template matching with threshold {threshold}")
            result = self._match_with_template(target_image, scaled_template, template_name, threshold, use_alpha, cv_method)

            if result is not None:
                result["auto_scale_x"] = scale_x
                result["auto_scale_y"] = scale_y
                result["match_threshold"] = threshold
                result["matching_method"] = detection_method_upper
            return result

        else:
            # Unknown method - let it fail naturally as requested
            if not self._silent:
                ColorPrint.red(f"[ImageMatcher] Unknown matching method: {detection_method}")
            # Deliberately not providing fallback - let the program fail as requested
            raise ValueError(f"Unknown matching method: {detection_method}. Supported methods are: {feature_methods + list(template_method_map.keys())}")

    def _match_with_features(
        self,
        target_image: np.ndarray,
        template_image: np.ndarray,
        template_name: str,
        ratio_thresh: float = None,
        detector=None,
        matcher=None
    ) -> Optional[Dict]:
        """
        Feature-based matching using configured feature detector (SIFT/ORB/AKAZE)

        Args:
            target_image: Large image to search in
            template_image: Template to find
            template_name: Name for logging
            ratio_thresh: Custom Lowe's ratio test threshold (if None, uses self.ratio_thresh)
        """
        # Use custom ratio_thresh if provided, otherwise use instance default
        effective_ratio_thresh = ratio_thresh if ratio_thresh is not None else self.ratio_thresh

        # Convert to grayscale
        gray_target = cv2.cvtColor(target_image, cv2.COLOR_BGR2GRAY)
        gray_template = cv2.cvtColor(template_image, cv2.COLOR_BGR2GRAY)

        # Detect features and compute descriptors
        kp_template, des_template = detector.detectAndCompute(gray_template, None)
        kp_target, des_target = detector.detectAndCompute(gray_target, None)

        if not self._silent:
            ColorPrint.debug(f"[DEBUG] {template_name}: Found {len(kp_template) if kp_template else 0} keypoints in template")
            ColorPrint.debug(f"[DEBUG] {template_name}: Found {len(kp_target) if kp_target else 0} keypoints in target")

        if des_template is None or des_target is None:
            if not self._silent:
                ColorPrint.yellow(f"[DEBUG] {template_name}: No descriptors found")
            return None

        # Match features using k-NN
        try:
            matches = matcher.knnMatch(des_template, des_target, k=2)
            if not self._silent:
                ColorPrint.debug(f"[DEBUG] {template_name}: knnMatch returned {len(matches)} match pairs")
        except cv2.error:
            if not self._silent:
                ColorPrint.red(f"[DEBUG] {template_name}: knnMatch failed")
            return None

        # Apply Lowe's ratio test with custom or default ratio_thresh
        good_matches = []
        for match_pair in matches:
            if len(match_pair) == 2:
                m, n = match_pair
                if m.distance < effective_ratio_thresh * n.distance:
                    good_matches.append(m)

        if not self._silent:
            ColorPrint.debug(f"[DEBUG] {template_name}: {len(good_matches)} good matches after ratio test (ratio_thresh={effective_ratio_thresh:.3f}, min required: {self.min_inliers})")

        if len(good_matches) < self.min_inliers:
            if not self._silent:
                ColorPrint.yellow(f"[DEBUG] {template_name}: Not enough good matches")
            return None

        # Extract point coordinates
        src_pts = np.float32([kp_template[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
        dst_pts = np.float32([kp_target[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

        # Find homography using RANSAC
        homography, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, self.ransac_threshold)

        if homography is None:
            if not self._silent:
                ColorPrint.red(f"[DEBUG] {template_name}: Homography estimation failed")
            return None

        if not self._silent:
            ColorPrint.green(f"[DEBUG] {template_name}: Homography found successfully!")

        # Transform template corners to target image space
        h, w = gray_template.shape
        corners = np.float32([[0, 0], [w, 0], [w, h], [0, h]]).reshape(-1, 1, 2)
        transformed_corners = cv2.perspectiveTransform(corners, homography)

        polygon = transformed_corners.reshape(4, 2)
        center = polygon.mean(axis=0)

        return {
            "template_name": template_name,
            "polygon": polygon,
            "center": center,
            "num_matches": len(good_matches),
            "success": True
        }

    def _match_with_template(
        self,
        target_image: np.ndarray,
        template_image: np.ndarray,
        template_name: str,
        threshold: float = 0.8,
        use_alpha: bool = None,
        cv_method: int = None
    ) -> Optional[Dict]:
        """Template matching using normalized cross-correlation

        Args:
            target_image: Target image (BGR)
            template_image: Template image (BGR or BGRA)
            template_name: Template identifier
            threshold: Matching threshold
            use_alpha: Whether to use alpha channel (None = use self.support_alpha)
            cv_method: OpenCV template matching method (None = use self.default_method)
        """
        # Determine if alpha channel should be used
        if use_alpha is None:
            use_alpha = self.support_alpha

        # Handle alpha channel
        mask = None
        if use_alpha and len(template_image.shape) == 3 and template_image.shape[2] == 4:
            mask = template_image[:, :, 3]  # Extract alpha channel as mask
            template_image = template_image[:, :, :3]  # Use only BGR channels
            if not self._silent:
                ColorPrint.debug(f"[DEBUG] {template_name}: Using alpha channel as mask")

        # Convert to grayscale
        gray_target = cv2.cvtColor(target_image, cv2.COLOR_BGR2GRAY)
        gray_template = cv2.cvtColor(template_image, cv2.COLOR_BGR2GRAY)

        h, w = gray_template.shape

        # Use provided method or default method
        if cv_method is not None:
            effective_method = cv_method
        else:
            # Convert string default to OpenCV constant
            if isinstance(self.default_method, str):
                template_method_map = {
                    "TM_CCOEFF": cv2.TM_CCOEFF,
                    "TM_CCOEFF_NORMED": cv2.TM_CCOEFF_NORMED,
                    "TM_CCORR": cv2.TM_CCORR,
                    "TM_CCORR_NORMED": cv2.TM_CCORR_NORMED,
                    "TM_SQDIFF": cv2.TM_SQDIFF,
                    "TM_SQDIFF_NORMED": cv2.TM_SQDIFF_NORMED
                }
                effective_method = template_method_map.get(self.default_method, cv2.TM_CCORR_NORMED)
            else:
                effective_method = self.default_method

        result = cv2.matchTemplate(gray_target, gray_template, effective_method, mask=mask)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

        # For SQDIFF methods, lower is better
        if effective_method in [cv2.TM_SQDIFF, cv2.TM_SQDIFF_NORMED]:
            match_val = 1 - min_val
            best_match = min_loc
        else:
            match_val = max_val
            best_match = max_loc

        method_name = self._get_method_name(effective_method)
        if not self._silent:
            ColorPrint.debug(f"[DEBUG] {template_name}: Template matching score: {match_val:.3f} (threshold: {threshold}, method: {method_name})")

        if match_val < threshold:
            if not self._silent:
                ColorPrint.yellow(f"[DEBUG] {template_name}: Template matching score too low")
            return None

        # Calculate bounding box
        top_left = best_match
        bottom_right = (top_left[0] + w, top_left[1] + h)

        # Create polygon (rectangle)
        polygon = np.array([
            [top_left[0], top_left[1]],
            [bottom_right[0], top_left[1]],
            [bottom_right[0], bottom_right[1]],
            [top_left[0], bottom_right[1]]
        ], dtype=np.float32)

        center = np.array([(top_left[0] + bottom_right[0]) / 2,
                          (top_left[1] + bottom_right[1]) / 2])

        if not self._silent:
            ColorPrint.green(f"[DEBUG] {template_name}: Template matching found match at {center}")

        return {
            "template_name": template_name,
            "polygon": polygon,
            "center": center,
            "num_matches": int(match_val * 100),  # Convert to percentage-like number
            "match_score": match_val,  # Add match score
            "match_threshold": threshold,  # Add threshold used
            "success": True
        }

    def match_multiple_templates(
        self,
        target_image_path: Union[str, Path],
        template_paths: List[Union[str, Path]],
        output_dir: Optional[Union[str, Path]] = None,
        output_filename: Optional[str] = None,
        template_thresholds: Optional[Dict[str, float]] = None
    ) -> Dict:
        """
        Match multiple template images in a target image and draw results

        Args:
            target_image_path: Path to the large image to search in
            template_paths: List of paths to template images
            output_dir: Directory to save annotated output image
            output_filename: Custom filename for output (auto-generated if None)
            template_thresholds: Dict mapping template names to custom thresholds

        Returns:
            Dictionary containing match results and output path:
            {
                "target_image": str,
                "matches": List[Dict],  # List of match results
                "output_image_path": str or None,
                "total_matches": int
            }
        """
        # Load target image - handle Chinese characters in path
        try:
            from PIL import Image as PILImage

            # Load with PIL to handle Chinese characters
            pil_target = PILImage.open(str(target_image_path))
            if pil_target.mode != 'RGB':
                pil_target = pil_target.convert('RGB')
            target_array = np.array(pil_target)
            # Convert RGB to BGR for OpenCV
            target_image = cv2.cvtColor(target_array, cv2.COLOR_RGB2BGR)
        except Exception as e:
            raise ValueError(f"Failed to load target image: {target_image_path}. Error: {e}")

        if target_image is None:
            raise ValueError(f"Failed to load target image: {target_image_path}")

        # Ensure template_paths is a list
        if not isinstance(template_paths, list):
            template_paths = [template_paths]

        matches = []
        output_image = target_image.copy()

        # Process each template
        for idx, template_path in enumerate(template_paths):
            template_name = Path(template_path).stem
            ColorPrint.blue(f"[DEBUG] Processing template {idx+1}/{len(template_paths)}: {template_name}")

            try:
                # Load template with PIL to handle Chinese characters
                # Check if template needs alpha channel support
                template_config = template_thresholds.get(template_name, {}) if isinstance(template_thresholds, dict) else {}
                use_alpha = template_config.get('use_alpha', self.support_alpha) if isinstance(template_config, dict) else self.support_alpha

                pil_template = PILImage.open(str(template_path))

                # Load with alpha channel if PNG and alpha is supported
                if use_alpha and pil_template.mode in ['RGBA', 'LA']:
                    # Keep alpha channel
                    if pil_template.mode != 'RGBA':
                        pil_template = pil_template.convert('RGBA')
                    template_array = np.array(pil_template)
                    # Convert RGBA to BGRA for OpenCV
                    template_image = cv2.cvtColor(template_array, cv2.COLOR_RGBA2BGRA)
                    ColorPrint.debug(f"[DEBUG] Template loaded with alpha: {template_name}, size: {template_image.shape}")
                else:
                    # Load without alpha
                    if pil_template.mode != 'RGB':
                        pil_template = pil_template.convert('RGB')
                    template_array = np.array(pil_template)
                    # Convert RGB to BGR for OpenCV
                    template_image = cv2.cvtColor(template_array, cv2.COLOR_RGB2BGR)
                    ColorPrint.debug(f"[DEBUG] Template loaded: {template_name}, size: {template_image.shape}")

            except Exception as e:
                ColorPrint.red(f"[WARN] Failed to load template: {template_path}. Error: {e}")
                continue

            if template_image is None:
                ColorPrint.red(f"[WARN] Failed to load template: {template_path}")
                continue

            # Match template
            ColorPrint.debug(f"[DEBUG] Attempting to match template: {template_name}")

            # Get custom threshold if provided
            custom_threshold = None
            if template_thresholds:
                if isinstance(template_thresholds, dict):
                    # Check if it's the new format {name: {threshold: x, use_alpha: y}}
                    if template_name in template_thresholds:
                        config = template_thresholds[template_name]
                        if isinstance(config, dict):
                            custom_threshold = config.get('threshold')
                            use_alpha = config.get('use_alpha', use_alpha)
                        else:
                            custom_threshold = config
                if custom_threshold is not None:
                    ColorPrint.debug(f"[DEBUG] Using custom threshold {custom_threshold} for {template_name}")

            match_result = self.match_single_template(
                target_image,
                template_image,
                template_name=template_name,
                custom_threshold=custom_threshold,
                use_alpha=use_alpha
            )

            if match_result:
                ColorPrint.green(f"[DEBUG] Match found for {template_name}!")
                matches.append(match_result)

                # Draw bounding polygon (red)
                polygon = np.int32(match_result["polygon"])
                cv2.polylines(output_image, [polygon], True, (0, 0, 255), 3)

                # Draw center point (blue)
                center = tuple(np.int32(match_result["center"]))
                cv2.circle(output_image, center, 8, (255, 0, 0), -1)

                # Add text label
                label = f"{template_name}"
                label_pos = (polygon[0][0], polygon[0][1] - 10)
                cv2.putText(
                    output_image,
                    label,
                    label_pos,
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 0),
                    2
                )

        # Save output image if output_dir is provided
        output_path = None
        if output_dir:
            output_dir = Path(output_dir)
            output_dir.mkdir(parents=True, exist_ok=True)

            if output_filename is None:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_filename = f"matched_{timestamp}.png"

            output_path = output_dir / output_filename

            # Use PIL to save to handle Chinese path
            try:
                output_rgb = cv2.cvtColor(output_image, cv2.COLOR_BGR2RGB)
                pil_output = PILImage.fromarray(output_rgb)
                pil_output.save(str(output_path))
            except Exception as e:
                ColorPrint.red(f"[ERROR] Failed to save output image: {e}")
                output_path = None

        return {
            "target_image": str(target_image_path),
            "matches": matches,
            "output_image_path": str(output_path) if output_path else None,
            "total_matches": len(matches)
        }

    def draw_match_visualization(
        self,
        target_image: np.ndarray,
        match_results: List[Dict],
        output_path: Union[str, Path]
    ) -> None:
        """
        Draw match results on target image and save to file

        Args:
            target_image: Original target image
            match_results: List of match result dictionaries
            output_path: Path to save annotated image
        """
        output_image = target_image.copy()

        for match in match_results:
            if not match.get("success"):
                continue

            # Draw polygon
            polygon = np.int32(match["polygon"])
            cv2.polylines(output_image, [polygon], True, (0, 0, 255), 3)

            # Draw center
            center = tuple(np.int32(match["center"]))
            cv2.circle(output_image, center, 8, (255, 0, 0), -1)

            # Add label
            label = match["template_name"]
            label_pos = (polygon[0][0], polygon[0][1] - 10)
            cv2.putText(
                output_image,
                label,
                label_pos,
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2
            )

        cv2.imwrite(str(output_path), output_image)


# Example usage
if __name__ == "__main__":
    matcher = ImageMatcher()

    result = matcher.match_multiple_templates(
        target_image_path="big_image.jpg",
        template_paths=["template1.jpg", "template2.jpg"],
        output_dir="./output"
    )

    ColorPrint.green(f"Found {result['total_matches']} matches")
    for match in result['matches']:
        ColorPrint.blue(f"  - {match['template_name']} at center: {match['center']}")
