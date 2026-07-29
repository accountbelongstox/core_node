#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image Annotator
Draw geometric shapes and annotations on images
Supports rectangles, circles, polygons, lines, and text labels
"""

import sys
from typing import List, Tuple, Dict, Optional, Union
from pathlib import Path

from pycore.pyfoundations.third_party.api import get_third_package_numpy, get_third_package_PIL_Image, get_third_package_cv2

numpy = get_third_package_numpy()
np = numpy
cv2 = get_third_package_cv2()
PILImage = get_third_package_PIL_Image()


class ImageAnnotator:
    """
    Utility class for drawing annotations on images

    Supports:
    - Rectangles
    - Circles
    - Polygons
    - Lines
    - Text labels
    - Multiple colors and styles
    """

    def __init__(self, image_input: Optional[Union[str, Path, np.ndarray, PILImage.Image]] = None):
        """
        Initialize annotator

        Args:
            image_input: Optional image source - can be:
                - str/Path: path to image file
                - np.ndarray: image array (BGR format)
                - PILImage.Image: PIL Image object
                - None: no image (load later)
        """
        self.image = None
        self.image_path = None

        if image_input is not None:
            # Check if input is numpy array
            if isinstance(image_input, np.ndarray):
                self.set_image(image_input)
            # Check if input is PIL Image
            elif isinstance(image_input, PILImage.Image):
                self.set_image_from_pil(image_input)
            else:
                # Treat as path
                self.load_image(image_input)

    def load_image(self, image_path: Union[str, Path]) -> None:
        """
        Load image from file path (handles Chinese characters)

        Args:
            image_path: Path to image file
        """
        self.image_path = str(image_path)

        # Use PIL to handle Chinese characters in path
        try:
            pil_image = PILImage.open(self.image_path)
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            image_array = np.array(pil_image)
            # Convert RGB to BGR for OpenCV
            self.image = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        except Exception as e:
            raise ValueError(f"Failed to load image: {image_path}. Error: {e}")

    def set_image(self, image: Union[np.ndarray, PILImage.Image]) -> None:
        """
        Set image from numpy array or PIL Image

        Args:
            image: Image as numpy array (BGR format) or PIL Image
        """
        if isinstance(image, PILImage.Image):
            self.set_image_from_pil(image)
        elif isinstance(image, np.ndarray):
            # Ensure the array is contiguous in memory for OpenCV
            self.image = np.ascontiguousarray(image.copy())
        else:
            raise TypeError(f"Unsupported image type: {type(image)}")

    def set_image_from_pil(self, pil_image: PILImage.Image) -> None:
        """
        Set image from PIL Image

        Args:
            pil_image: PIL Image object
        """
        # Convert PIL Image to numpy array
        if pil_image.mode == 'RGB':
            image_array = np.array(pil_image)
            # Convert RGB to BGR for OpenCV
            self.image = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        elif pil_image.mode == 'RGBA':
            image_array = np.array(pil_image)
            # Convert RGBA to BGRA for OpenCV
            self.image = cv2.cvtColor(image_array, cv2.COLOR_RGBA2BGRA)
        elif pil_image.mode == 'L':
            # Grayscale
            self.image = np.array(pil_image)
        else:
            # Convert to RGB first, then to BGR
            pil_image = pil_image.convert('RGB')
            image_array = np.array(pil_image)
            self.image = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)

        # Ensure the array is contiguous in memory for OpenCV
        self.image = np.ascontiguousarray(self.image)

    def _ensure_contiguous(self) -> None:
        """Ensure self.image is contiguous in memory for OpenCV operations"""
        if self.image is not None and not self.image.flags['C_CONTIGUOUS']:
            self.image = np.ascontiguousarray(self.image)

    def draw_rectangle(
        self,
        top_left: Tuple[int, int],
        bottom_right: Tuple[int, int],
        color: Tuple[int, int, int] = (0, 0, 255),  # Red in BGR
        thickness: int = 2,
        label: Optional[str] = None,
        label_color: Tuple[int, int, int] = (0, 255, 0)  # Green in BGR
    ) -> None:
        """
        Draw rectangle on image

        Args:
            top_left: Top-left corner (x, y)
            bottom_right: Bottom-right corner (x, y)
            color: Line color in BGR format
            thickness: Line thickness in pixels
            label: Optional text label
            label_color: Label text color in BGR format
        """
        if self.image is None:
            raise ValueError("No image loaded. Use load_image() or set_image() first.")

        self._ensure_contiguous()
        cv2.rectangle(self.image, top_left, bottom_right, color, thickness)

        if label:
            # Draw label background
            label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            label_pos = (top_left[0], top_left[1] - 10)
            cv2.rectangle(
                self.image,
                (label_pos[0], label_pos[1] - label_size[1] - 5),
                (label_pos[0] + label_size[0], label_pos[1] + 5),
                color,
                -1
            )
            # Draw label text
            cv2.putText(
                self.image,
                label,
                label_pos,
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                label_color,
                2
            )

    def draw_circle(
        self,
        center: Tuple[int, int],
        radius: int,
        color: Tuple[int, int, int] = (255, 0, 0),  # Blue in BGR
        thickness: int = 2,
        filled: bool = False
    ) -> None:
        """
        Draw circle on image

        Args:
            center: Circle center (x, y)
            radius: Circle radius in pixels
            color: Circle color in BGR format
            thickness: Line thickness (ignored if filled=True)
            filled: Fill the circle if True
        """
        if self.image is None:
            raise ValueError("No image loaded. Use load_image() or set_image() first.")

        self._ensure_contiguous()
        thickness_val = -1 if filled else thickness
        cv2.circle(self.image, center, radius, color, thickness_val)

    def draw_polygon(
        self,
        points: np.ndarray,
        color: Tuple[int, int, int] = (0, 255, 255),  # Yellow in BGR
        thickness: int = 2,
        filled: bool = False
    ) -> None:
        """
        Draw polygon on image

        Args:
            points: Array of polygon vertices, shape (N, 2)
            color: Line color in BGR format
            thickness: Line thickness (ignored if filled=True)
            filled: Fill the polygon if True
        """
        if self.image is None:
            raise ValueError("No image loaded. Use load_image() or set_image() first.")

        self._ensure_contiguous()
        points = np.int32(points).reshape((-1, 1, 2))

        if filled:
            cv2.fillPoly(self.image, [points], color)
        else:
            cv2.polylines(self.image, [points], True, color, thickness)

    def draw_line(
        self,
        start: Tuple[int, int],
        end: Tuple[int, int],
        color: Tuple[int, int, int] = (255, 255, 0),  # Cyan in BGR
        thickness: int = 2
    ) -> None:
        """
        Draw line on image

        Args:
            start: Start point (x, y)
            end: End point (x, y)
            color: Line color in BGR format
            thickness: Line thickness in pixels
        """
        if self.image is None:
            raise ValueError("No image loaded. Use load_image() or set_image() first.")

        self._ensure_contiguous()
        cv2.line(self.image, start, end, color, thickness)

    def draw_text(
        self,
        text: str,
        position: Tuple[int, int],
        color: Tuple[int, int, int] = (255, 255, 255),  # White in BGR
        font_scale: float = 0.7,
        thickness: int = 2,
        background_color: Optional[Tuple[int, int, int]] = None
    ) -> None:
        """
        Draw text on image

        Args:
            text: Text string to draw
            position: Text position (x, y) - bottom-left corner
            color: Text color in BGR format
            font_scale: Font scale factor
            thickness: Text thickness
            background_color: Optional background color for text
        """
        if self.image is None:
            raise ValueError("No image loaded. Use load_image() or set_image() first.")

        self._ensure_contiguous()

        if background_color:
            # Draw background rectangle
            text_size, _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
            cv2.rectangle(
                self.image,
                (position[0] - 5, position[1] - text_size[1] - 5),
                (position[0] + text_size[0] + 5, position[1] + 5),
                background_color,
                -1
            )

        cv2.putText(
            self.image,
            text,
            position,
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale,
            color,
            thickness
        )

    def draw_image(
        self,
        image: np.ndarray,
        position: Tuple[int, int],
        alpha: float = 1.0
    ) -> None:
        """
        Draw another image on top of the current image

        Args:
            image: Image to draw (BGR format numpy array)
            position: Top-left position (x, y) where to place the image
            alpha: Opacity (0.0 to 1.0), 1.0 is fully opaque
        """
        if self.image is None:
            raise ValueError("No image loaded. Use load_image() or set_image() first.")

        x, y = position
        h, w = image.shape[:2]

        # Check bounds
        if x < 0 or y < 0:
            return
        if x + w > self.image.shape[1] or y + h > self.image.shape[0]:
            # Crop image if it goes out of bounds
            w = min(w, self.image.shape[1] - x)
            h = min(h, self.image.shape[0] - y)
            image = image[:h, :w]

        # Blend images if alpha < 1.0
        if alpha < 1.0:
            roi = self.image[y:y+h, x:x+w]
            blended = cv2.addWeighted(image, alpha, roi, 1 - alpha, 0)
            self.image[y:y+h, x:x+w] = blended
        else:
            # Direct copy
            self.image[y:y+h, x:x+w] = image

    def draw_grid(
        self,
        top_left: Tuple[int, int],
        bottom_right: Tuple[int, int],
        rows: int,
        cols: int,
        color: Tuple[int, int, int] = (128, 128, 128),  # Gray in BGR
        thickness: int = 1
    ) -> None:
        """
        Draw grid on image

        Args:
            top_left: Top-left corner of grid
            bottom_right: Bottom-right corner of grid
            rows: Number of rows
            cols: Number of columns
            color: Grid color in BGR format
            thickness: Line thickness
        """
        if self.image is None:
            raise ValueError("No image loaded. Use load_image() or set_image() first.")

        # Ensure array is contiguous for OpenCV
        self._ensure_contiguous()

        x1, y1 = top_left
        x2, y2 = bottom_right

        # Calculate cell dimensions
        cell_width = (x2 - x1) / cols
        cell_height = (y2 - y1) / rows

        # Draw vertical lines
        for i in range(cols + 1):
            x = int(x1 + i * cell_width)
            cv2.line(self.image, (x, y1), (x, y2), color, thickness)

        # Draw horizontal lines
        for i in range(rows + 1):
            y = int(y1 + i * cell_height)
            cv2.line(self.image, (x1, y), (x2, y), color, thickness)

    def draw_grid_full(
        self,
        rows: int,
        cols: int,
        color: Tuple[int, int, int] = (0, 255, 0),  # Green in BGR
        thickness: int = 1
    ) -> None:
        """
        Draw grid covering the entire image

        Args:
            rows: Number of rows
            cols: Number of columns
            color: Grid color in BGR format (default: green)
            thickness: Line thickness
        """
        if self.image is None:
            raise ValueError("No image loaded. Use load_image() or set_image() first.")

        height, width = self.image.shape[:2]

        # Call draw_grid with full image dimensions
        self.draw_grid(
            top_left=(0, 0),
            bottom_right=(width, height),
            rows=rows,
            cols=cols,
            color=color,
            thickness=thickness
        )

    def save(self, output_path: Union[str, Path]) -> None:
        """
        Save annotated image to file (handles Chinese characters)

        Args:
            output_path: Output file path
        """
        if self.image is None:
            raise ValueError("No image to save. Load or annotate an image first.")

        # Use PIL to save (handles Chinese characters)
        try:
            output_rgb = cv2.cvtColor(self.image, cv2.COLOR_BGR2RGB)
            pil_image = PILImage.fromarray(output_rgb)
            pil_image.save(str(output_path))
        except Exception as e:
            raise ValueError(f"Failed to save image: {output_path}. Error: {e}")

    def get_image(self) -> np.ndarray:
        """
        Get annotated image as numpy array

        Returns:
            Image as numpy array (BGR format)
        """
        if self.image is None:
            raise ValueError("No image loaded.")

        return self.image

    def draw_pie_chart(
        self,
        center: Tuple[int, int],
        radius: int,
        percentages: Dict[str, float],
        colors: Dict[str, Tuple[int, int, int]] = None,
        background_color: Tuple[int, int, int] = (255, 255, 255)
    ) -> None:
        """
        Draw a pie chart on the image

        Args:
            center: Center point (x, y) of the pie chart
            radius: Radius of the pie chart in pixels
            percentages: Dictionary mapping labels to percentage values (0-100)
            colors: Optional dictionary mapping labels to BGR colors
            background_color: Background color for the pie chart area
        """
        if self.image is None:
            raise ValueError("No image loaded. Use load_image() or set_image() first.")

        # Default colors if not provided
        if colors is None:
            default_colors = {
                'yellow': (0, 255, 255),      # Cyan in BGR
                'blue': (255, 0, 0),          # Blue in BGR
                'dark_gold': (0, 140, 180),   # Dark gold in BGR
                'green': (0, 255, 0),         # Green in BGR
                'black': (50, 50, 50),        # Dark gray in BGR
                'other': (200, 200, 200),     # Light gray in BGR
            }
            colors = default_colors

        # Draw background circle
        cv2.circle(self.image, center, radius, background_color, -1)

        # Calculate start angle for each segment
        start_angle = 0
        for label, percentage in percentages.items():
            if percentage <= 0:
                continue

            # Convert percentage to angle (360 degrees = 100%)
            angle = int(percentage * 3.6)

            # Get color for this label
            color = colors.get(label, (200, 200, 200))

            # Draw pie segment using ellipse
            end_angle = start_angle + angle
            cv2.ellipse(
                self.image,
                center,
                (radius, radius),
                0,  # rotation angle
                start_angle,
                end_angle,
                color,
                -1  # filled
            )

            start_angle = end_angle

        # Draw border circle
        cv2.circle(self.image, center, radius, (100, 100, 100), 1).copy()

    def clear(self) -> None:
        """Clear all annotations (reload original image)"""
        if self.image_path:
            self.load_image(self.image_path)
        else:
            raise ValueError("Cannot clear - no original image path stored.")


# Example usage
if __name__ == "__main__":
    # Create annotator
    annotator = ImageAnnotator("test_image.png")

    # Draw rectangle
    annotator.draw_rectangle((100, 100), (300, 200), color=(0, 0, 255), label="Box 1")

    # Draw circle
    annotator.draw_circle((400, 150), 50, color=(255, 0, 0), filled=True)

    # Draw grid
    annotator.draw_grid((500, 100), (700, 300), rows=6, cols=10, color=(0, 255, 0))

    # Save result
    annotator.save("annotated_output.png")
