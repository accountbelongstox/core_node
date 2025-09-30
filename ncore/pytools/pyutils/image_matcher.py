#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image Matcher
Feature-based image matching to locate template images within a larger image
Uses ORB features for fast, robust matching with perspective transformation
"""

import os
import cv2
import numpy as np
from typing import List, Tuple, Dict, Optional, Union
from pathlib import Path
from datetime import datetime


class ImageMatcher:
    """
    Feature-based image matcher for locating template images in a target image

    Features:
    - ORB feature detection (fast, license-free)
    - RANSAC homography estimation
    - Multi-template matching support
    - Visual result output with bounding boxes
    """

    def __init__(
        self,
        ratio_thresh: float = 0.75,
        min_inliers: int = 8,
        nfeatures: int = 5000,
        ransac_threshold: float = 5.0
    ):
        """
        Initialize image matcher

        Args:
            ratio_thresh: Lowe's ratio test threshold (0.7-0.8 typical)
            min_inliers: Minimum number of good matches required
            nfeatures: Maximum ORB features to detect
            ransac_threshold: RANSAC reprojection error threshold
        """
        self.ratio_thresh = ratio_thresh
        self.min_inliers = min_inliers
        self.ransac_threshold = ransac_threshold

        # Initialize ORB detector
        self.orb = cv2.ORB_create(nfeatures=nfeatures)

        # Initialize BFMatcher with Hamming distance for ORB
        self.matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

    def match_single_template(
        self,
        target_image: np.ndarray,
        template_image: np.ndarray,
        template_name: str = "template"
    ) -> Optional[Dict]:
        """
        Match a single template image in the target image

        Args:
            target_image: Large image to search in (BGR format)
            template_image: Small template image to find (BGR format)
            template_name: Name identifier for this template

        Returns:
            Dictionary with match results or None if no match found:
            {
                "template_name": str,
                "polygon": np.ndarray,  # 4 corner points in target image
                "center": np.ndarray,   # Center point (x, y)
                "num_matches": int,     # Number of good feature matches
                "success": bool
            }
        """
        # First try feature-based matching
        result = self._match_with_features(target_image, template_image, template_name)

        if result is not None:
            return result

        # If feature matching fails, try template matching for simple templates
        print(f"[DEBUG] {template_name}: Feature matching failed, trying template matching...")
        return self._match_with_template(target_image, template_image, template_name)

    def _match_with_features(
        self,
        target_image: np.ndarray,
        template_image: np.ndarray,
        template_name: str
    ) -> Optional[Dict]:
        """Feature-based matching using ORB"""
        # Convert to grayscale
        gray_target = cv2.cvtColor(target_image, cv2.COLOR_BGR2GRAY)
        gray_template = cv2.cvtColor(template_image, cv2.COLOR_BGR2GRAY)

        # Detect features and compute descriptors
        kp_template, des_template = self.orb.detectAndCompute(gray_template, None)
        kp_target, des_target = self.orb.detectAndCompute(gray_target, None)

        print(f"[DEBUG] {template_name}: Found {len(kp_template) if kp_template else 0} keypoints in template")
        print(f"[DEBUG] {template_name}: Found {len(kp_target) if kp_target else 0} keypoints in target")

        if des_template is None or des_target is None:
            print(f"[DEBUG] {template_name}: No descriptors found")
            return None

        # Match features using k-NN
        try:
            matches = self.matcher.knnMatch(des_template, des_target, k=2)
            print(f"[DEBUG] {template_name}: knnMatch returned {len(matches)} match pairs")
        except cv2.error:
            print(f"[DEBUG] {template_name}: knnMatch failed")
            return None

        # Apply Lowe's ratio test
        good_matches = []
        for match_pair in matches:
            if len(match_pair) == 2:
                m, n = match_pair
                if m.distance < self.ratio_thresh * n.distance:
                    good_matches.append(m)

        print(f"[DEBUG] {template_name}: {len(good_matches)} good matches after ratio test (min required: {self.min_inliers})")

        if len(good_matches) < self.min_inliers:
            print(f"[DEBUG] {template_name}: Not enough good matches")
            return None

        # Extract point coordinates
        src_pts = np.float32([kp_template[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
        dst_pts = np.float32([kp_target[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)

        # Find homography using RANSAC
        homography, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, self.ransac_threshold)

        if homography is None:
            print(f"[DEBUG] {template_name}: Homography estimation failed")
            return None

        print(f"[DEBUG] {template_name}: Homography found successfully!")

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
        threshold: float = 0.8
    ) -> Optional[Dict]:
        """Template matching using normalized cross-correlation"""
        # Convert to grayscale
        gray_target = cv2.cvtColor(target_image, cv2.COLOR_BGR2GRAY)
        gray_template = cv2.cvtColor(template_image, cv2.COLOR_BGR2GRAY)

        h, w = gray_template.shape

        # Try multiple methods and pick the best
        methods = [cv2.TM_CCOEFF_NORMED, cv2.TM_CCORR_NORMED]
        best_match = None
        best_val = -1

        for method in methods:
            result = cv2.matchTemplate(gray_target, gray_template, method)
            min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

            if max_val > best_val:
                best_val = max_val
                best_match = max_loc

        print(f"[DEBUG] {template_name}: Template matching score: {best_val:.3f} (threshold: {threshold})")

        if best_val < threshold:
            print(f"[DEBUG] {template_name}: Template matching score too low")
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

        print(f"[DEBUG] {template_name}: Template matching found match at {center}")

        return {
            "template_name": template_name,
            "polygon": polygon,
            "center": center,
            "num_matches": int(best_val * 100),  # Convert to percentage-like number
            "success": True
        }

    def match_multiple_templates(
        self,
        target_image_path: Union[str, Path],
        template_paths: List[Union[str, Path]],
        output_dir: Optional[Union[str, Path]] = None,
        output_filename: Optional[str] = None
    ) -> Dict:
        """
        Match multiple template images in a target image and draw results

        Args:
            target_image_path: Path to the large image to search in
            template_paths: List of paths to template images
            output_dir: Directory to save annotated output image
            output_filename: Custom filename for output (auto-generated if None)

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
            import numpy as np

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
            print(f"[DEBUG] Processing template {idx+1}/{len(template_paths)}: {template_name}")

            try:
                # Load template with PIL to handle Chinese characters
                pil_template = PILImage.open(str(template_path))
                if pil_template.mode != 'RGB':
                    pil_template = pil_template.convert('RGB')
                template_array = np.array(pil_template)
                # Convert RGB to BGR for OpenCV
                template_image = cv2.cvtColor(template_array, cv2.COLOR_RGB2BGR)
                print(f"[DEBUG] Template loaded: {template_name}, size: {template_image.shape}")
            except Exception as e:
                print(f"[WARN] Failed to load template: {template_path}. Error: {e}")
                continue

            if template_image is None:
                print(f"[WARN] Failed to load template: {template_path}")
                continue

            # Match template
            print(f"[DEBUG] Attempting to match template: {template_name}")
            match_result = self.match_single_template(
                target_image,
                template_image,
                template_name=template_name
            )

            if match_result:
                print(f"[DEBUG] Match found for {template_name}!")
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
                print(f"[ERROR] Failed to save output image: {e}")
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

    print(f"Found {result['total_matches']} matches")
    for match in result['matches']:
        print(f"  - {match['template_name']} at center: {match['center']}")
