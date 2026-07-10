#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image split / crop operations for ImageTools.

Extracted from image_processor.py to keep modules under 800 lines. These are
free functions that receive the ImageTools instance (``tools``) so they can
reuse its helpers (_validate_image_path, _get_output_path) and constants
(DEFAULT_QUALITY). The ImageTools facade in image_processor.py delegates to
these functions, preserving the public method API.

Public functions (called via ImageTools methods):
    split_image_equal, split_image_custom, create_image_grid,
    crop_image, split_image_grid, split_sprite_sheet
"""

import math
import logging
from typing import Tuple, Optional, Dict, Any, List, Union
from pathlib import Path

from pycore.pyfoundations.third_party import get_third_package_PIL_Image

Image = get_third_package_PIL_Image()

logger = logging.getLogger(__name__)


def split_image_equal(
    tools,
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
        img_path = tools._validate_image_path(image_path)
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
                    part.save(output_path, quality=tools.DEFAULT_QUALITY)
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
                    part.save(output_path, quality=tools.DEFAULT_QUALITY)
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
    tools,
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
        img_path = tools._validate_image_path(image_path)
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
                part.save(output_path, quality=tools.DEFAULT_QUALITY)
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
    tools,
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
        grid.save(output_path, quality=tools.DEFAULT_QUALITY)

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
    tools,
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
        img_path = tools._validate_image_path(image_path)
        output = tools._get_output_path(image_path, output_path, "_cropped")

        with Image.open(img_path) as img:
            img_width, img_height = img.size

            # Validate coordinates
            if x < 0 or y < 0 or x + width > img_width or y + height > img_height:
                raise ValueError(f"Crop area ({x},{y},{width},{height}) exceeds image bounds ({img_width}x{img_height})")

            # Crop
            cropped = img.crop((x, y, x + width, y + height))
            cropped.save(output, quality=tools.DEFAULT_QUALITY)

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
    tools,
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
        img_path = tools._validate_image_path(image_path)
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
                    tile.save(output_path, quality=tools.DEFAULT_QUALITY)
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
    tools,
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
        img_path = tools._validate_image_path(image_path)
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
                    sprite.save(output_path, quality=tools.DEFAULT_QUALITY)
                    output_files.append(output_path)

            elif direction == "vertical":
                count = img_height // sprite_height
                for i in range(count):
                    y = i * sprite_height
                    sprite = img.crop((0, y, sprite_width, y + sprite_height))
                    filename = name_pattern.format(index=i) + img_path.suffix
                    output_path = str(out_dir / filename)
                    sprite.save(output_path, quality=tools.DEFAULT_QUALITY)
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
