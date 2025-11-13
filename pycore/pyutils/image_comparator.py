#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image Comparison Utility
Provides image similarity comparison functionality
"""

import sys
from typing import Union, Tuple
from pathlib import Path

from pycore.pyfoundations.third_party import numpy, PIL, cv2
import numpy as np
from PIL import Image as PILImage


class ImageComparator:
    """
    Utility class for comparing images

    Supports:
    - Structural Similarity (SSIM)
    - Mean Squared Error (MSE)
    - Histogram comparison
    - Perceptual hash comparison
    """

    @staticmethod
    def load_image(image_path: Union[str, Path]) -> np.ndarray:
        """
        Load image from file path (handles Chinese characters)

        Args:
            image_path: Path to image file

        Returns:
            Image as numpy array (BGR format)
        """
        image_path = str(image_path)

        try:
            pil_image = PILImage.open(image_path)
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            image_array = np.array(pil_image)
            return cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        except Exception as e:
            raise ValueError(f"Failed to load image: {image_path}. Error: {e}")

    @staticmethod
    def calculate_mse(image1: np.ndarray, image2: np.ndarray) -> float:
        """
        Calculate Mean Squared Error between two images

        Args:
            image1: First image (BGR or grayscale)
            image2: Second image (BGR or grayscale)

        Returns:
            MSE value (lower is more similar, 0 = identical)
        """
        # Ensure images have same dimensions
        if image1.shape != image2.shape:
            # Resize image2 to match image1
            image2 = cv2.resize(image2, (image1.shape[1], image1.shape[0]))

        # Convert to grayscale if color images
        if len(image1.shape) == 3:
            image1 = cv2.cvtColor(image1, cv2.COLOR_BGR2GRAY)
        if len(image2.shape) == 3:
            image2 = cv2.cvtColor(image2, cv2.COLOR_BGR2GRAY)

        # Calculate MSE
        mse = np.mean((image1.astype(float) - image2.astype(float)) ** 2)
        return mse

    @staticmethod
    def calculate_ssim(image1: np.ndarray, image2: np.ndarray) -> float:
        """
        Calculate Structural Similarity Index (SSIM) between two images

        Args:
            image1: First image (BGR or grayscale)
            image2: Second image (BGR or grayscale)

        Returns:
            SSIM value (range: -1 to 1, 1 = identical)
        """
        try:
            from skimage.metrics import structural_similarity as ssim
        except ImportError:
            raise ImportError("scikit-image is required for SSIM. Install with: pip install scikit-image")

        # Ensure images have same dimensions
        if image1.shape != image2.shape:
            image2 = cv2.resize(image2, (image1.shape[1], image1.shape[0]))

        # Convert to grayscale if color images
        if len(image1.shape) == 3:
            image1 = cv2.cvtColor(image1, cv2.COLOR_BGR2GRAY)
        if len(image2.shape) == 3:
            image2 = cv2.cvtColor(image2, cv2.COLOR_BGR2GRAY)

        # Calculate SSIM
        score = ssim(image1, image2)
        return score

    @staticmethod
    def compare_histograms(image1: np.ndarray, image2: np.ndarray) -> float:
        """
        Compare histograms of two images

        Args:
            image1: First image (BGR)
            image2: Second image (BGR)

        Returns:
            Correlation value (range: 0 to 1, 1 = identical)
        """
        # Ensure images have same dimensions
        if image1.shape != image2.shape:
            image2 = cv2.resize(image2, (image1.shape[1], image1.shape[0]))

        # Convert to HSV for better color comparison
        if len(image1.shape) == 3:
            image1_hsv = cv2.cvtColor(image1, cv2.COLOR_BGR2HSV)
            image2_hsv = cv2.cvtColor(image2, cv2.COLOR_BGR2HSV)
        else:
            image1_hsv = image1
            image2_hsv = image2

        # Calculate histograms
        hist1 = cv2.calcHist([image1_hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])
        hist2 = cv2.calcHist([image2_hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])

        # Normalize histograms
        cv2.normalize(hist1, hist1, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
        cv2.normalize(hist2, hist2, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)

        # Compare using correlation method
        correlation = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
        return correlation

    @staticmethod
    def are_images_similar(
        image1: np.ndarray,
        image2: np.ndarray,
        method: str = "mse",
        threshold: float = None
    ) -> Tuple[bool, float]:
        """
        Check if two images are similar

        Args:
            image1: First image (BGR or grayscale)
            image2: Second image (BGR or grayscale)
            method: Comparison method ("mse", "histogram")
            threshold: Similarity threshold (method-dependent)
                - For "mse": lower is more similar, default=1000
                - For "histogram": higher is more similar, default=0.9

        Returns:
            Tuple of (is_similar, similarity_score)
        """
        if method == "mse":
            score = ImageComparator.calculate_mse(image1, image2)
            if threshold is None:
                threshold = 1000  # Default MSE threshold
            is_similar = score < threshold
            return is_similar, score

        elif method == "histogram":
            score = ImageComparator.compare_histograms(image1, image2)
            if threshold is None:
                threshold = 0.9  # Default correlation threshold
            is_similar = score >= threshold
            return is_similar, score

        else:
            raise ValueError(f"Unknown comparison method: {method}")

    @staticmethod
    def find_template_in_image(
        target_image: np.ndarray,
        template_image: np.ndarray,
        threshold: float = 0.8
    ) -> Tuple[bool, float, Tuple[int, int]]:
        """
        Find template image in target image using template matching

        Args:
            target_image: Target image to search in
            template_image: Template image to find
            threshold: Match threshold (0-1, higher = more strict)

        Returns:
            Tuple of (found, max_score, (x, y))
        """
        # Convert to grayscale
        if len(target_image.shape) == 3:
            target_gray = cv2.cvtColor(target_image, cv2.COLOR_BGR2GRAY)
        else:
            target_gray = target_image

        if len(template_image.shape) == 3:
            template_gray = cv2.cvtColor(template_image, cv2.COLOR_BGR2GRAY)
        else:
            template_gray = template_image

        # Perform template matching
        result = cv2.matchTemplate(target_gray, template_gray, cv2.TM_CCOEFF_NORMED)
        min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(result)

        found = max_val >= threshold
        return found, max_val, max_loc


# Example usage
if __name__ == "__main__":
    from pyfoundations.color_print import ColorPrint

    try:
        # Load two images
        image1 = ImageComparator.load_image("image1.png")
        image2 = ImageComparator.load_image("image2.png")

        # Compare using MSE
        mse = ImageComparator.calculate_mse(image1, image2)
        ColorPrint.blue(f"MSE: {mse}")

        # Compare using histogram
        hist_corr = ImageComparator.compare_histograms(image1, image2)
        ColorPrint.blue(f"Histogram Correlation: {hist_corr}")

        # Check similarity
        is_similar, score = ImageComparator.are_images_similar(
            image1, image2, method="mse", threshold=1000
        )
        ColorPrint.green(f"Similar: {is_similar}, Score: {score}")

    except Exception as e:
        ColorPrint.red(f"Error: {e}")
