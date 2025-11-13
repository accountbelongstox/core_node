#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Advanced Image Processing Tools
Comprehensive image manipulation: crop, split, transform, compress, merge, text overlay
"""

import os
import io
import logging
import tempfile
import math
from typing import Tuple, Optional, Dict, Any, List, Union
from pathlib import Path

from pycore.pyfoundations.third_party import PIL
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter, ImageOps

logger = logging.getLogger(__name__)

class ImageTools:
    """Advanced image processing toolkit"""

    SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.tif', '.webp', '.gif'}
    DEFAULT_QUALITY = 85
    DEFAULT_FORMAT = 'PNG'

    def __init__(self):
        self.temp_files = []

    def _cleanup_temp_files(self):
        """Clean up temporary files"""
        for temp_file in self.temp_files:
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
                    logger.debug(f"Cleaned up temp file: {temp_file}")
            except Exception as e:
                logger.warning(f"Failed to clean temp file {temp_file}: {e}")
        self.temp_files.clear()

    def _validate_image_path(self, path: str) -> Path:
        """Validate image path and format"""
        img_path = Path(path)
        if not img_path.exists():
            raise FileNotFoundError(f"Image not found: {path}")
        if img_path.suffix.lower() not in self.SUPPORTED_FORMATS:
            raise ValueError(f"Unsupported format: {img_path.suffix}. Supported: {self.SUPPORTED_FORMATS}")
        return img_path

    def _get_output_path(self, input_path: str, output_path: Optional[str], suffix: str = "") -> str:
        """Generate output path"""
        if output_path:
            return output_path

        input_p = Path(input_path)
        if suffix:
            return str(input_p.parent / f"{input_p.stem}{suffix}{input_p.suffix}")
        else:
            return str(input_p.parent / f"{input_p.stem}_processed{input_p.suffix}")

    # ==================== CROP & SPLIT ====================

    def split_image_equal(
        self,
        image_path: str,
        count: int,
        direction: str = "vertical",
        output_dir: Optional[str] = None,
        name_pattern: str = "part_{index}"
    ) -> Dict[str, Any]:
        """
        Split image into equal parts (auto-detect sprite size)

        Args:
            image_path: Input image path
            count: Number of equal parts
            direction: Split direction ('horizontal' or 'vertical')
            output_dir: Output directory (default: same as input)
            name_pattern: Naming pattern with {index} placeholder

        Returns:
            Result dictionary with output files list
        """
        try:
            img_path = self._validate_image_path(image_path)
            out_dir = Path(output_dir) if output_dir else img_path.parent
            out_dir.mkdir(parents=True, exist_ok=True)

            with Image.open(img_path) as img:
                img_width, img_height = img.size
                output_files = []

                if direction == "vertical":
                    if img_height % count != 0:
                        logger.warning(f"Image height {img_height} not evenly divisible by {count}")

                    part_height = img_height // count
                    part_width = img_width

                    for i in range(count):
                        y = i * part_height
                        # Last part gets any remaining pixels
                        h = part_height if i < count - 1 else img_height - y

                        part = img.crop((0, y, part_width, y + h))
                        filename = name_pattern.format(index=i) + img_path.suffix
                        output_path = str(out_dir / filename)
                        part.save(output_path, quality=self.DEFAULT_QUALITY)
                        output_files.append(output_path)

                elif direction == "horizontal":
                    if img_width % count != 0:
                        logger.warning(f"Image width {img_width} not evenly divisible by {count}")

                    part_width = img_width // count
                    part_height = img_height

                    for i in range(count):
                        x = i * part_width
                        # Last part gets any remaining pixels
                        w = part_width if i < count - 1 else img_width - x

                        part = img.crop((x, 0, x + w, part_height))
                        filename = name_pattern.format(index=i) + img_path.suffix
                        output_path = str(out_dir / filename)
                        part.save(output_path, quality=self.DEFAULT_QUALITY)
                        output_files.append(output_path)
                else:
                    raise ValueError(f"Invalid direction: {direction}. Use 'horizontal' or 'vertical'")

            logger.info(f"Split into {count} equal parts ({direction})")
            return {
                'success': True,
                'output_files': output_files,
                'part_count': count,
                'direction': direction,
                'part_size': f"{part_width}x{part_height}" if direction == "vertical" else f"{part_width}x{part_height}"
            }

        except Exception as e:
            logger.error(f"Equal split failed: {e}")
            return {'success': False, 'error': str(e)}

    def split_image_custom(
        self,
        image_path: str,
        split_points: List[int],
        direction: str = "vertical",
        output_dir: Optional[str] = None,
        name_pattern: str = "part_{index}"
    ) -> Dict[str, Any]:
        """
        Split image at custom points

        Args:
            image_path: Input image path
            split_points: List of split positions (pixels)
            direction: Split direction ('horizontal' or 'vertical')
            output_dir: Output directory (default: same as input)
            name_pattern: Naming pattern with {index} placeholder

        Returns:
            Result dictionary with output files list

        Example:
            split_points=[100, 250, 400] creates parts:
            - Part 0: 0-100
            - Part 1: 100-250
            - Part 2: 250-400
            - Part 3: 400-end
        """
        try:
            img_path = self._validate_image_path(image_path)
            out_dir = Path(output_dir) if output_dir else img_path.parent
            out_dir.mkdir(parents=True, exist_ok=True)

            with Image.open(img_path) as img:
                img_width, img_height = img.size
                output_files = []

                # Add start and end points
                points = [0] + sorted(split_points) + [img_height if direction == "vertical" else img_width]

                for i in range(len(points) - 1):
                    start = points[i]
                    end = points[i + 1]

                    if direction == "vertical":
                        part = img.crop((0, start, img_width, end))
                    else:
                        part = img.crop((start, 0, end, img_height))

                    filename = name_pattern.format(index=i) + img_path.suffix
                    output_path = str(out_dir / filename)
                    part.save(output_path, quality=self.DEFAULT_QUALITY)
                    output_files.append(output_path)

            logger.info(f"Split at {len(split_points)} custom points ({direction})")
            return {
                'success': True,
                'output_files': output_files,
                'part_count': len(output_files),
                'split_points': split_points,
                'direction': direction
            }

        except Exception as e:
            logger.error(f"Custom split failed: {e}")
            return {'success': False, 'error': str(e)}

    def create_image_grid(
        self,
        image_paths: List[str],
        cols: int,
        output_path: str,
        spacing: int = 0,
        background_color: Union[str, Tuple[int, int, int]] = "white",
        cell_width: Optional[int] = None,
        cell_height: Optional[int] = None,
        resize_mode: str = "fit"
    ) -> Dict[str, Any]:
        """
        Create image grid/collage from multiple images

        Args:
            image_paths: List of image paths
            cols: Number of columns
            output_path: Output path
            spacing: Space between images in pixels
            background_color: Background color
            cell_width: Fixed cell width (optional, auto if not specified)
            cell_height: Fixed cell height (optional, auto if not specified)
            resize_mode: How to resize images ('fit', 'fill', 'stretch')

        Returns:
            Result dictionary
        """
        try:
            if not image_paths:
                raise ValueError("No images provided")

            # Load all images
            images = [Image.open(p) for p in image_paths]

            # Calculate grid dimensions
            rows = math.ceil(len(images) / cols)

            # Determine cell size
            if cell_width is None or cell_height is None:
                widths, heights = zip(*(img.size for img in images))
                cell_width = cell_width or max(widths)
                cell_height = cell_height or max(heights)

            # Calculate output size
            grid_width = cols * cell_width + (cols - 1) * spacing
            grid_height = rows * cell_height + (rows - 1) * spacing

            # Create output image
            grid = Image.new('RGB', (grid_width, grid_height), background_color)

            # Place images
            for idx, img in enumerate(images):
                row = idx // cols
                col = idx % cols

                # Resize image based on mode
                if resize_mode == "fit":
                    # Fit inside cell, maintain aspect ratio
                    img.thumbnail((cell_width, cell_height), Image.Resampling.LANCZOS)
                    resized = img
                elif resize_mode == "fill":
                    # Fill cell, crop if needed, maintain aspect ratio
                    img_ratio = img.width / img.height
                    cell_ratio = cell_width / cell_height

                    if img_ratio > cell_ratio:
                        # Image is wider
                        new_height = cell_height
                        new_width = int(cell_height * img_ratio)
                    else:
                        # Image is taller
                        new_width = cell_width
                        new_height = int(cell_width / img_ratio)

                    resized = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

                    # Crop to cell size
                    left = (new_width - cell_width) // 2
                    top = (new_height - cell_height) // 2
                    resized = resized.crop((left, top, left + cell_width, top + cell_height))
                else:  # stretch
                    resized = img.resize((cell_width, cell_height), Image.Resampling.LANCZOS)

                # Calculate position
                x = col * (cell_width + spacing)
                y = row * (cell_height + spacing)

                # Center image in cell if it's smaller
                if resized.width < cell_width:
                    x += (cell_width - resized.width) // 2
                if resized.height < cell_height:
                    y += (cell_height - resized.height) // 2

                grid.paste(resized, (x, y))

            # Save
            grid.save(output_path, quality=self.DEFAULT_QUALITY)

            # Cleanup
            for img in images:
                img.close()

            logger.info(f"Created {rows}x{cols} grid with {len(images)} images")
            return {
                'success': True,
                'output_path': output_path,
                'grid_size': f"{rows}x{cols}",
                'cell_size': f"{cell_width}x{cell_height}",
                'image_count': len(images),
                'output_size': f"{grid_width}x{grid_height}"
            }

        except Exception as e:
            logger.error(f"Grid creation failed: {e}")
            return {'success': False, 'error': str(e)}

    def crop_image(
        self,
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
            img_path = self._validate_image_path(image_path)
            output = self._get_output_path(image_path, output_path, "_cropped")

            with Image.open(img_path) as img:
                img_width, img_height = img.size

                # Validate coordinates
                if x < 0 or y < 0 or x + width > img_width or y + height > img_height:
                    raise ValueError(f"Crop area ({x},{y},{width},{height}) exceeds image bounds ({img_width}x{img_height})")

                # Crop
                cropped = img.crop((x, y, x + width, y + height))
                cropped.save(output, quality=self.DEFAULT_QUALITY)

            logger.info(f"Cropped image saved to: {output}")
            return {
                'success': True,
                'output_path': output,
                'original_size': f"{img_width}x{img_height}",
                'crop_area': f"{x},{y},{width},{height}",
                'cropped_size': f"{width}x{height}"
            }

        except Exception as e:
            logger.error(f"Crop failed: {e}")
            return {'success': False, 'error': str(e)}

    def split_image_grid(
        self,
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
            img_path = self._validate_image_path(image_path)
            out_dir = Path(output_dir) if output_dir else img_path.parent
            out_dir.mkdir(parents=True, exist_ok=True)

            with Image.open(img_path) as img:
                img_width, img_height = img.size
                tile_width = img_width // cols
                tile_height = img_height // rows

                output_files = []

                for row in range(rows):
                    for col in range(cols):
                        x = col * tile_width
                        y = row * tile_height
                        w = tile_width if col < cols - 1 else img_width - x
                        h = tile_height if row < rows - 1 else img_height - y

                        tile = img.crop((x, y, x + w, y + h))
                        filename = name_pattern.format(row=row, col=col) + img_path.suffix
                        output_path = str(out_dir / filename)
                        tile.save(output_path, quality=self.DEFAULT_QUALITY)
                        output_files.append(output_path)

            logger.info(f"Split into {rows}x{cols} grid, {len(output_files)} files")
            return {
                'success': True,
                'output_files': output_files,
                'grid_size': f"{rows}x{cols}",
                'tile_size': f"{tile_width}x{tile_height}",
                'total_tiles': len(output_files)
            }

        except Exception as e:
            logger.error(f"Grid split failed: {e}")
            return {'success': False, 'error': str(e)}

    def split_sprite_sheet(
        self,
        image_path: str,
        sprite_width: int,
        sprite_height: int,
        output_dir: Optional[str] = None,
        name_pattern: str = "sprite_{index}",
        direction: str = "horizontal"
    ) -> Dict[str, Any]:
        """
        Split sprite sheet into individual sprites

        Args:
            image_path: Input sprite sheet path
            sprite_width: Width of each sprite
            sprite_height: Height of each sprite
            output_dir: Output directory
            name_pattern: Naming pattern with {index} placeholder
            direction: Split direction ('horizontal' or 'vertical')

        Returns:
            Result dictionary with sprite files list
        """
        try:
            img_path = self._validate_image_path(image_path)
            out_dir = Path(output_dir) if output_dir else img_path.parent
            out_dir.mkdir(parents=True, exist_ok=True)

            with Image.open(img_path) as img:
                img_width, img_height = img.size
                output_files = []

                if direction == "horizontal":
                    count = img_width // sprite_width
                    for i in range(count):
                        x = i * sprite_width
                        sprite = img.crop((x, 0, x + sprite_width, sprite_height))
                        filename = name_pattern.format(index=i) + img_path.suffix
                        output_path = str(out_dir / filename)
                        sprite.save(output_path, quality=self.DEFAULT_QUALITY)
                        output_files.append(output_path)

                elif direction == "vertical":
                    count = img_height // sprite_height
                    for i in range(count):
                        y = i * sprite_height
                        sprite = img.crop((0, y, sprite_width, y + sprite_height))
                        filename = name_pattern.format(index=i) + img_path.suffix
                        output_path = str(out_dir / filename)
                        sprite.save(output_path, quality=self.DEFAULT_QUALITY)
                        output_files.append(output_path)
                else:
                    raise ValueError(f"Invalid direction: {direction}. Use 'horizontal' or 'vertical'")

            logger.info(f"Split sprite sheet: {len(output_files)} sprites extracted")
            return {
                'success': True,
                'output_files': output_files,
                'sprite_size': f"{sprite_width}x{sprite_height}",
                'sprite_count': len(output_files),
                'direction': direction
            }

        except Exception as e:
            logger.error(f"Sprite split failed: {e}")
            return {'success': False, 'error': str(e)}

    # ==================== GEOMETRY TRANSFORMS ====================

    def resize_image(
        self,
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
            keep_aspect: Keep aspect ratio
            resample: Resampling method (LANCZOS, BILINEAR, BICUBIC, NEAREST)
            output_path: Output path

        Returns:
            Result dictionary
        """
        try:
            img_path = self._validate_image_path(image_path)
            output = self._get_output_path(image_path, output_path, "_resized")

            resample_filter = getattr(Image.Resampling, resample, Image.Resampling.LANCZOS)

            with Image.open(img_path) as img:
                orig_width, orig_height = img.size

                if max_size:
                    img.thumbnail((max_size, max_size), resample_filter)
                    new_size = img.size
                elif width and height:
                    if keep_aspect:
                        img.thumbnail((width, height), resample_filter)
                        new_size = img.size
                    else:
                        img = img.resize((width, height), resample_filter)
                        new_size = (width, height)
                elif width:
                    ratio = width / orig_width
                    new_height = int(orig_height * ratio)
                    img = img.resize((width, new_height), resample_filter)
                    new_size = (width, new_height)
                elif height:
                    ratio = height / orig_height
                    new_width = int(orig_width * ratio)
                    img = img.resize((new_width, height), resample_filter)
                    new_size = (new_width, height)
                else:
                    raise ValueError("Must specify width, height, or max_size")

                img.save(output, quality=self.DEFAULT_QUALITY)

            logger.info(f"Resized from {orig_width}x{orig_height} to {new_size[0]}x{new_size[1]}")
            return {
                'success': True,
                'output_path': output,
                'original_size': f"{orig_width}x{orig_height}",
                'new_size': f"{new_size[0]}x{new_size[1]}"
            }

        except Exception as e:
            logger.error(f"Resize failed: {e}")
            return {'success': False, 'error': str(e)}

    def rotate_image(
        self,
        image_path: str,
        angle: float,
        expand: bool = True,
        fill_color: Union[str, Tuple[int, int, int]] = "white",
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Rotate image by angle

        Args:
            image_path: Input image path
            angle: Rotation angle in degrees (counter-clockwise)
            expand: Expand canvas to fit rotated image
            fill_color: Background color for expanded area
            output_path: Output path

        Returns:
            Result dictionary
        """
        try:
            img_path = self._validate_image_path(image_path)
            output = self._get_output_path(image_path, output_path, "_rotated")

            with Image.open(img_path) as img:
                rotated = img.rotate(angle, expand=expand, fillcolor=fill_color)
                rotated.save(output, quality=self.DEFAULT_QUALITY)

            logger.info(f"Rotated image by {angle} degrees")
            return {
                'success': True,
                'output_path': output,
                'angle': angle,
                'expand': expand
            }

        except Exception as e:
            logger.error(f"Rotate failed: {e}")
            return {'success': False, 'error': str(e)}

    def flip_image(
        self,
        image_path: str,
        direction: str = "horizontal",
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Flip image horizontally or vertically

        Args:
            image_path: Input image path
            direction: 'horizontal' or 'vertical'
            output_path: Output path

        Returns:
            Result dictionary
        """
        try:
            img_path = self._validate_image_path(image_path)
            output = self._get_output_path(image_path, output_path, f"_flip_{direction}")

            with Image.open(img_path) as img:
                if direction == "horizontal":
                    flipped = img.transpose(Image.FLIP_LEFT_RIGHT)
                elif direction == "vertical":
                    flipped = img.transpose(Image.FLIP_TOP_BOTTOM)
                else:
                    raise ValueError(f"Invalid direction: {direction}")

                flipped.save(output, quality=self.DEFAULT_QUALITY)

            logger.info(f"Flipped image {direction}")
            return {
                'success': True,
                'output_path': output,
                'direction': direction
            }

        except Exception as e:
            logger.error(f"Flip failed: {e}")
            return {'success': False, 'error': str(e)}

    # ==================== COMPRESSION ====================

    def compress_image(
        self,
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
            quality: JPEG quality (1-100)
            max_width: Maximum width
            max_height: Maximum height
            output_format: Output format (JPEG, PNG, WEBP)
            output_path: Output path

        Returns:
            Result dictionary with compression ratio
        """
        try:
            img_path = self._validate_image_path(image_path)

            # Determine output format
            if output_format:
                fmt = output_format.upper()
                ext = f".{output_format.lower()}"
            else:
                fmt = None
                ext = img_path.suffix

            output = output_path or self._get_output_path(image_path, None, "_compressed")
            if output_format and not output.endswith(ext):
                output = str(Path(output).with_suffix(ext))

            original_size = os.path.getsize(img_path)

            with Image.open(img_path) as img:
                orig_width, orig_height = img.size

                # Resize if needed
                if max_width or max_height:
                    max_w = max_width or orig_width
                    max_h = max_height or orig_height
                    img.thumbnail((max_w, max_h), Image.Resampling.LANCZOS)

                # Convert RGBA to RGB if saving as JPEG
                if (fmt == 'JPEG' or ext.lower() in ['.jpg', '.jpeg']) and img.mode == 'RGBA':
                    rgb_img = Image.new('RGB', img.size, (255, 255, 255))
                    rgb_img.paste(img, mask=img.split()[3])
                    img = rgb_img

                # Save with compression
                save_kwargs = {'quality': quality, 'optimize': True}
                if fmt:
                    save_kwargs['format'] = fmt
                img.save(output, **save_kwargs)

            compressed_size = os.path.getsize(output)
            ratio = (1 - compressed_size / original_size) * 100

            logger.info(f"Compressed: {original_size} -> {compressed_size} bytes ({ratio:.1f}% reduction)")
            return {
                'success': True,
                'output_path': output,
                'original_size': original_size,
                'compressed_size': compressed_size,
                'compression_ratio': f"{ratio:.1f}%",
                'quality': quality
            }

        except Exception as e:
            logger.error(f"Compression failed: {e}")
            return {'success': False, 'error': str(e)}

    # ==================== MERGE ====================

    def merge_images_horizontal(
        self,
        image_paths: List[str],
        output_path: str,
        spacing: int = 0,
        align: str = "center"
    ) -> Dict[str, Any]:
        """
        Merge images horizontally

        Args:
            image_paths: List of image paths
            output_path: Output path
            spacing: Space between images
            align: Vertical alignment ('top', 'center', 'bottom')

        Returns:
            Result dictionary
        """
        try:
            if not image_paths:
                raise ValueError("No images provided")

            images = [Image.open(p) for p in image_paths]
            widths, heights = zip(*(img.size for img in images))

            total_width = sum(widths) + spacing * (len(images) - 1)
            max_height = max(heights)

            merged = Image.new('RGB', (total_width, max_height), (255, 255, 255))

            x_offset = 0
            for img in images:
                if align == "top":
                    y_offset = 0
                elif align == "center":
                    y_offset = (max_height - img.height) // 2
                elif align == "bottom":
                    y_offset = max_height - img.height
                else:
                    y_offset = 0

                merged.paste(img, (x_offset, y_offset))
                x_offset += img.width + spacing

            merged.save(output_path, quality=self.DEFAULT_QUALITY)

            for img in images:
                img.close()

            logger.info(f"Merged {len(images)} images horizontally")
            return {
                'success': True,
                'output_path': output_path,
                'image_count': len(images),
                'final_size': f"{total_width}x{max_height}",
                'align': align
            }

        except Exception as e:
            logger.error(f"Horizontal merge failed: {e}")
            return {'success': False, 'error': str(e)}

    def merge_images_vertical(
        self,
        image_paths: List[str],
        output_path: str,
        spacing: int = 0,
        align: str = "center"
    ) -> Dict[str, Any]:
        """
        Merge images vertically

        Args:
            image_paths: List of image paths
            output_path: Output path
            spacing: Space between images
            align: Horizontal alignment ('left', 'center', 'right')

        Returns:
            Result dictionary
        """
        try:
            if not image_paths:
                raise ValueError("No images provided")

            images = [Image.open(p) for p in image_paths]
            widths, heights = zip(*(img.size for img in images))

            max_width = max(widths)
            total_height = sum(heights) + spacing * (len(images) - 1)

            merged = Image.new('RGB', (max_width, total_height), (255, 255, 255))

            y_offset = 0
            for img in images:
                if align == "left":
                    x_offset = 0
                elif align == "center":
                    x_offset = (max_width - img.width) // 2
                elif align == "right":
                    x_offset = max_width - img.width
                else:
                    x_offset = 0

                merged.paste(img, (x_offset, y_offset))
                y_offset += img.height + spacing

            merged.save(output_path, quality=self.DEFAULT_QUALITY)

            for img in images:
                img.close()

            logger.info(f"Merged {len(images)} images vertically")
            return {
                'success': True,
                'output_path': output_path,
                'image_count': len(images),
                'final_size': f"{max_width}x{total_height}",
                'align': align
            }

        except Exception as e:
            logger.error(f"Vertical merge failed: {e}")
            return {'success': False, 'error': str(e)}

    # ==================== TEXT OVERLAY ====================

    def add_text_to_image(
        self,
        image_path: str,
        text: str,
        position: Tuple[int, int] = (10, 10),
        font_size: int = 24,
        font_color: Union[str, Tuple[int, int, int]] = "black",
        font_path: Optional[str] = None,
        background_color: Optional[Union[str, Tuple[int, int, int, int]]] = None,
        output_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Add text overlay to image

        Args:
            image_path: Input image path
            text: Text to add
            position: (x, y) position
            font_size: Font size
            font_color: Text color
            font_path: Custom font file path (TTF)
            background_color: Text background color (with alpha)
            output_path: Output path

        Returns:
            Result dictionary
        """
        try:
            img_path = self._validate_image_path(image_path)
            output = self._get_output_path(image_path, output_path, "_text")

            with Image.open(img_path) as img:
                # Convert to RGBA for transparency support
                if img.mode != 'RGBA':
                    img = img.convert('RGBA')

                # Create drawing layer
                overlay = Image.new('RGBA', img.size, (255, 255, 255, 0))
                draw = ImageDraw.Draw(overlay)

                # Load font
                try:
                    if font_path:
                        font = ImageFont.truetype(font_path, font_size)
                    else:
                        # Try to load default font
                        font = ImageFont.truetype("arial.ttf", font_size)
                except:
                    font = ImageFont.load_default()
                    logger.warning("Using default font")

                # Draw background if specified
                if background_color:
                    bbox = draw.textbbox(position, text, font=font)
                    padding = 5
                    draw.rectangle(
                        [bbox[0] - padding, bbox[1] - padding, bbox[2] + padding, bbox[3] + padding],
                        fill=background_color
                    )

                # Draw text
                draw.text(position, text, font=font, fill=font_color)

                # Composite
                result = Image.alpha_composite(img, overlay)

                # Convert back if needed
                if img_path.suffix.lower() in ['.jpg', '.jpeg']:
                    result = result.convert('RGB')

                result.save(output, quality=self.DEFAULT_QUALITY)

            logger.info(f"Added text to image: {text}")
            return {
                'success': True,
                'output_path': output,
                'text': text,
                'position': position,
                'font_size': font_size
            }

        except Exception as e:
            logger.error(f"Add text failed: {e}")
            return {'success': False, 'error': str(e)}

    # ==================== FILTERS & EFFECTS ====================

    def apply_filter(
        self,
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
            intensity: Filter intensity (0.0 - 2.0)
            output_path: Output path

        Returns:
            Result dictionary
        """
        try:
            img_path = self._validate_image_path(image_path)
            output = self._get_output_path(image_path, output_path, f"_{filter_type}")

            with Image.open(img_path) as img:
                if filter_type == "blur":
                    result = img.filter(ImageFilter.GaussianBlur(radius=intensity * 5))
                elif filter_type == "sharpen":
                    enhancer = ImageEnhance.Sharpness(img)
                    result = enhancer.enhance(intensity)
                elif filter_type == "brightness":
                    enhancer = ImageEnhance.Brightness(img)
                    result = enhancer.enhance(intensity)
                elif filter_type == "contrast":
                    enhancer = ImageEnhance.Contrast(img)
                    result = enhancer.enhance(intensity)
                elif filter_type == "grayscale":
                    result = ImageOps.grayscale(img)
                elif filter_type == "sepia":
                    result = ImageOps.grayscale(img).convert('RGB')
                    pixels = result.load()
                    for y in range(result.height):
                        for x in range(result.width):
                            r, g, b = pixels[x, y]
                            tr = int(r * 0.393 + g * 0.769 + b * 0.189)
                            tg = int(r * 0.349 + g * 0.686 + b * 0.168)
                            tb = int(r * 0.272 + g * 0.534 + b * 0.131)
                            pixels[x, y] = (min(tr, 255), min(tg, 255), min(tb, 255))
                else:
                    raise ValueError(f"Unknown filter: {filter_type}")

                result.save(output, quality=self.DEFAULT_QUALITY)

            logger.info(f"Applied {filter_type} filter")
            return {
                'success': True,
                'output_path': output,
                'filter_type': filter_type,
                'intensity': intensity
            }

        except Exception as e:
            logger.error(f"Filter failed: {e}")
            return {'success': False, 'error': str(e)}

    def __del__(self):
        """Cleanup on deletion"""
        self._cleanup_temp_files()


# Singleton instance
image_tools = ImageTools()
