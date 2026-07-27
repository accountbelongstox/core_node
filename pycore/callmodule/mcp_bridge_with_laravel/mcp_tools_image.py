#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image-manipulation MCP tool wrappers for the File Processor MCP Server.

Extracted from main.py. 14 thin wrappers that delegate to the sibling
image_tools module (already >800 lines, kept unchanged). analyze_image_pixels
is NOT here -- it lives in image_pixel_analysis.py and is registered by server.py.
"""

import logging
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def register_image_tools(mcp):
    """Register image manipulation MCP tools (thin wrappers over image_tools)."""

    @mcp.tool()
    def split_image_equal(
        image_path: str,
        count: int,
        direction: str = "vertical",
        output_dir: Optional[str] = None,
        name_pattern: str = "part_{index}"
    ) -> Dict[str, Any]:
        """
        Split image into equal parts (auto-calculate part size)

        Args:
            image_path: Input image path
            count: Number of equal parts
            direction: Split direction ('horizontal' or 'vertical', default: 'vertical')
            output_dir: Output directory (default: same as input)
            name_pattern: Naming pattern with {index} placeholder

        Returns:
            Result dictionary with output files list

        Example:
            Split a 56x560 image into 10 equal parts vertically:
            split_image_equal("sprite.png", 10, "vertical")
            Result: 10 images of 56x56 each
        """
        try:
            return image_tools.split_image_equal(
                image_path, count, direction, output_dir, name_pattern
            )
        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def split_image_custom(
        image_path: str,
        split_points: List[int],
        direction: str = "vertical",
        output_dir: Optional[str] = None,
        name_pattern: str = "part_{index}"
    ) -> Dict[str, Any]:
        """
        Split image at custom pixel positions

        Args:
            image_path: Input image path
            split_points: List of split positions in pixels
            direction: Split direction ('horizontal' or 'vertical', default: 'vertical')
            output_dir: Output directory (default: same as input)
            name_pattern: Naming pattern with {index} placeholder

        Returns:
            Result dictionary with output files list

        Example:
            split_points=[100, 250, 400] creates parts at:
            Part 0: 0-100px, Part 1: 100-250px, Part 2: 250-400px, Part 3: 400-end
        """
        try:
            return image_tools.split_image_custom(
                image_path, split_points, direction, output_dir, name_pattern
            )
        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def create_image_grid(
        image_paths: List[str],
        cols: int,
        output_path: str,
        spacing: int = 0,
        background_color: str = "white",
        cell_width: Optional[int] = None,
        cell_height: Optional[int] = None,
        resize_mode: str = "fit"
    ) -> Dict[str, Any]:
        """
        Create image grid/collage from multiple images

        Args:
            image_paths: List of image paths to arrange
            cols: Number of columns
            output_path: Output path for the grid image
            spacing: Space between images in pixels (default: 0)
            background_color: Background color (default: "white")
            cell_width: Fixed cell width (optional, auto-detect from images if not set)
            cell_height: Fixed cell height (optional, auto-detect from images if not set)
            resize_mode: How to resize images in cells:
                - 'fit': Fit inside cell, maintain aspect (default)
                - 'fill': Fill cell, crop if needed, maintain aspect
                - 'stretch': Stretch to fill cell exactly

        Returns:
            Result dictionary with grid info

        Example:
            Create 3-column grid from 9 images:
            create_image_grid(["img1.png", "img2.png", ...], 3, "grid.png")
        """
        try:
            return image_tools.create_image_grid(
                image_paths, cols, output_path, spacing,
                background_color, cell_width, cell_height, resize_mode
            )
        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def crop_image(
        image_path: str,
        x: int,
        y: int,
        width: int,
        height: int,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Crop image to specified rectangle

        Args:
            image_path: Input image path
            x: Left coordinate
            y: Top coordinate
            width: Crop width
            height: Crop height
            output_path: Output path (optional)

        Returns:
            Result dictionary with output path and metadata
        """
        try:
            return image_tools.crop_image(image_path, x, y, width, height, output_path)
        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def split_sprite_sheet(
        image_path: str,
        sprite_width: int,
        sprite_height: int,
        output_dir: Optional[str] = None,
        name_pattern: str = "sprite_{index}",
        direction: str = "vertical"
    ) -> Dict[str, Any]:
        """
        Split sprite sheet into individual sprites

        Args:
            image_path: Input sprite sheet path
            sprite_width: Width of each sprite
            sprite_height: Height of each sprite
            output_dir: Output directory (default: same as input)
            name_pattern: Naming pattern with {index} placeholder
            direction: Split direction ('horizontal' or 'vertical', default: 'vertical')

        Returns:
            Result dictionary with sprite files list

        Example:
            Split a 80x400 vertical sprite sheet (5 sprites of 80x80 each):
            split_sprite_sheet("sprite.png", 80, 80, direction="vertical")
        """
        try:
            return image_tools.split_sprite_sheet(
                image_path, sprite_width, sprite_height,
                output_dir, name_pattern, direction
            )
        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def split_image_grid(
        image_path: str,
        rows: int,
        cols: int,
        output_dir: Optional[str] = None,
        name_pattern: str = "tile_{row}_{col}"
    ) -> Dict[str, Any]:
        """
        Split image into grid (rows x cols)

        Args:
            image_path: Input image path
            rows: Number of rows
            cols: Number of columns
            output_dir: Output directory (default: same as input)
            name_pattern: Naming pattern with {row} and {col} placeholders

        Returns:
            Result dictionary with output files list
        """
        try:
            return image_tools.split_image_grid(image_path, rows, cols, output_dir, name_pattern)
        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def resize_image(
        image_path: str,
        width: Optional[int] = None,
        height: Optional[int] = None,
        max_size: Optional[int] = None,
        keep_aspect: bool = True,
        resample: str = "LANCZOS",
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Resize image with various options

        Args:
            image_path: Input image path
            width: Target width
            height: Target height
            max_size: Max dimension (used if width/height not specified)
            keep_aspect: Keep aspect ratio (default: True)
            resample: Resampling method (LANCZOS, BILINEAR, BICUBIC, NEAREST)
            output_path: Output path (optional)

        Returns:
            Result dictionary
        """
        try:
            return image_tools.resize_image(
                image_path, width, height, max_size,
                keep_aspect, resample, output_path
            )
        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def rotate_image(
        image_path: str,
        angle: float,
        expand: bool = True,
        fill_color: str = "white",
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Rotate image by angle

        Args:
            image_path: Input image path
            angle: Rotation angle in degrees (counter-clockwise)
            expand: Expand canvas to fit rotated image (default: True)
            fill_color: Background color for expanded area
            output_path: Output path (optional)

        Returns:
            Result dictionary
        """
        try:
            return image_tools.rotate_image(image_path, angle, expand, fill_color, output_path)
        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def flip_image(
        image_path: str,
        direction: str = "horizontal",
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Flip image horizontally or vertically

        Args:
            image_path: Input image path
            direction: 'horizontal' or 'vertical'
            output_path: Output path (optional)

        Returns:
            Result dictionary
        """
        try:
            return image_tools.flip_image(image_path, direction, output_path)
        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def compress_image(
        image_path: str,
        quality: int = 85,
        max_width: Optional[int] = None,
        max_height: Optional[int] = None,
        output_format: Optional[str] = None,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Compress image with quality and size control

        Args:
            image_path: Input image path
            quality: JPEG quality (1-100, default: 85)
            max_width: Maximum width (optional)
            max_height: Maximum height (optional)
            output_format: Output format (JPEG, PNG, WEBP, optional)
            output_path: Output path (optional)

        Returns:
            Result dictionary with compression ratio
        """
        try:
            return image_tools.compress_image(
                image_path, quality, max_width, max_height,
                output_format, output_path
            )
        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def merge_images_horizontal(
        image_paths: List[str],
        output_path: str,
        spacing: int = 0,
        align: str = "center"
    ) -> Dict[str, Any]:
        """
        Merge images horizontally

        Args:
            image_paths: List of image paths to merge
            output_path: Output path for merged image
            spacing: Space between images in pixels (default: 0)
            align: Vertical alignment ('top', 'center', 'bottom', default: 'center')

        Returns:
            Result dictionary
        """
        try:
            return image_tools.merge_images_horizontal(image_paths, output_path, spacing, align)
        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def merge_images_vertical(
        image_paths: List[str],
        output_path: str,
        spacing: int = 0,
        align: str = "center"
    ) -> Dict[str, Any]:
        """
        Merge images vertically

        Args:
            image_paths: List of image paths to merge
            output_path: Output path for merged image
            spacing: Space between images in pixels (default: 0)
            align: Horizontal alignment ('left', 'center', 'right', default: 'center')

        Returns:
            Result dictionary
        """
        try:
            return image_tools.merge_images_vertical(image_paths, output_path, spacing, align)
        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def add_text_to_image(
        image_path: str,
        text: str,
        position: Tuple[int, int] = (10, 10),
        font_size: int = 24,
        font_color: str = "black",
        font_path: Optional[str] = None,
        background_color: Optional[str] = None,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add text overlay to image

        Args:
            image_path: Input image path
            text: Text to add
            position: (x, y) position tuple (default: (10, 10))
            font_size: Font size in pixels (default: 24)
            font_color: Text color (default: "black")
            font_path: Custom font file path (TTF, optional)
            background_color: Text background color (optional)
            output_path: Output path (optional)

        Returns:
            Result dictionary
        """
        try:
            return image_tools.add_text_to_image(
                image_path, text, position, font_size,
                font_color, font_path, background_color, output_path
            )
        except Exception as e:
            return {"error": str(e)}

    @mcp.tool()
    def apply_image_filter(
        image_path: str,
        filter_type: str,
        intensity: float = 1.0,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Apply image filter/effect

        Args:
            image_path: Input image path
            filter_type: Filter type (blur, sharpen, brightness, contrast, grayscale, sepia)
            intensity: Filter intensity (0.0 - 2.0, default: 1.0)
            output_path: Output path (optional)

        Returns:
            Result dictionary

        Example filters:
            - blur: Gaussian blur
            - sharpen: Sharpen image
            - brightness: Adjust brightness
            - contrast: Adjust contrast
            - grayscale: Convert to grayscale
            - sepia: Sepia tone effect
        """
        try:
            return image_tools.apply_filter(image_path, filter_type, intensity, output_path)
        except Exception as e:
            return {"error": str(e)}
