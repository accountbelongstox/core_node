#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image Crop Utility
Provides image cropping and region extraction functionality
"""

import sys
import uuid
from typing import Tuple, Union, Optional, Dict
from pathlib import Path
from collections import OrderedDict

from pycore.pyfoundations.third_party import get_third_package_numpy, get_third_package_PIL_Image, get_third_package_cv2

numpy = get_third_package_numpy()
np = numpy
cv2 = get_third_package_cv2()
PILImage = get_third_package_PIL_Image()

# Import ColorPrint for logging
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


# Constants
MAX_CACHED_GROUPS = 5  # Maximum number of cached image groups


class ImageCrop:
    """
    Utility class for cropping images

    Supports:
    - Crop by absolute coordinates
    - Crop by percentage
    - Crop around center point
    - Save cropped regions
    - Lazy grid generation with group management
    """

    # Class-level cache for image groups (OrderedDict maintains insertion order)
    _image_groups: OrderedDict = OrderedDict()

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

        # Use PIL to handle Chinese characters in path
        try:
            pil_image = PILImage.open(image_path)
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            image_array = np.array(pil_image)
            # Convert RGB to BGR for OpenCV
            return cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
        except Exception as e:
            raise ValueError(f"Failed to load image: {image_path}. Error: {e}")

    @staticmethod
    def crop_region(
        image: Union[np.ndarray, PILImage.Image, str, Path],
        top_left: Tuple[int, int],
        bottom_right: Tuple[int, int],
        output_format: str = "same"
    ) -> Union[np.ndarray, PILImage.Image]:
        """
        Crop rectangular region from image

        Args:
            image: Source image (BGR format numpy array, PIL Image, or file path)
            top_left: Top-left corner (x, y)
            bottom_right: Bottom-right corner (x, y)
            output_format: Output format ("same", "numpy", "pil")

        Returns:
            Cropped image region in specified format
        """
        # Handle different input types
        if isinstance(image, (str, Path)):
            # Load from file path
            pil_image = ImageCrop._load_pil_image(image)
        elif isinstance(image, np.ndarray):
            # Convert numpy array to PIL
            if len(image.shape) == 3 and image.shape[2] == 3:
                # BGR to RGB
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                pil_image = PILImage.fromarray(image_rgb)
            else:
                pil_image = PILImage.fromarray(image)
        elif isinstance(image, PILImage.Image):
            pil_image = image
        else:
            raise ValueError(f"Unsupported image type: {type(image)}")

        x1, y1 = top_left
        x2, y2 = bottom_right

        # Ensure coordinates are within image bounds
        width, height = pil_image.size
        x1 = max(0, min(x1, width))
        x2 = max(0, min(x2, width))
        y1 = max(0, min(y1, height))
        y2 = max(0, min(y2, height))

        # Crop using PIL
        cropped_pil = pil_image.crop((x1, y1, x2, y2))

        # Return in requested format
        if output_format == "numpy" or (output_format == "same" and isinstance(image, np.ndarray)):
            # Convert back to numpy array (BGR format)
            cropped_array = np.array(cropped_pil)
            if len(cropped_array.shape) == 3 and cropped_array.shape[2] == 3:
                return cv2.cvtColor(cropped_array, cv2.COLOR_RGB2BGR)
            else:
                return cropped_array
        else:
            # Return PIL Image
            return cropped_pil

    @staticmethod
    def _load_pil_image(image_path: Union[str, Path]) -> PILImage.Image:
        """
        Load image from file path using PIL (handles Chinese characters)

        Args:
            image_path: Path to image file

        Returns:
            PIL Image object
        """
        image_path = str(image_path)
        try:
            pil_image = PILImage.open(image_path)
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
            return pil_image
        except Exception as e:
            raise ValueError(f"Failed to load image: {image_path}. Error: {e}")

    @staticmethod
    def crop_around_center(
        image: np.ndarray,
        center_x: int,
        center_y: int,
        width_percentage: float = 0.25,
        direction: str = "left"
    ) -> Tuple[np.ndarray, Tuple[int, int, int, int]]:
        """
        Crop region around center point

        Args:
            image: Source image (BGR format)
            center_x: Center X coordinate
            center_y: Center Y coordinate
            width_percentage: Width of crop region as percentage of image width (e.g., 0.25 = 25%)
            direction: Direction to crop ("left", "right", "up", "down", "center")

        Returns:
            Tuple of (cropped_image, (x1, y1, x2, y2))
        """
        height, width = image.shape[:2]

        # Calculate crop width
        crop_width = int(width * width_percentage)

        # Calculate crop region based on direction
        if direction == "left":
            # Crop to the left of center
            x1 = max(0, center_x - crop_width)
            x2 = center_x
            y1 = 0
            y2 = height
        elif direction == "right":
            # Crop to the right of center
            x1 = center_x
            x2 = min(width, center_x + crop_width)
            y1 = 0
            y2 = height
        elif direction == "up":
            # Crop upward from center
            x1 = 0
            x2 = width
            y1 = max(0, center_y - crop_width)
            y2 = center_y
        elif direction == "down":
            # Crop downward from center
            x1 = 0
            x2 = width
            y1 = center_y
            y2 = min(height, center_y + crop_width)
        else:  # "center"
            # Crop centered around point
            half_width = crop_width // 2
            x1 = max(0, center_x - half_width)
            x2 = min(width, center_x + half_width)
            y1 = max(0, center_y - half_width)
            y2 = min(height, center_y + half_width)

        cropped = image[y1:y2, x1:x2]
        return cropped, (x1, y1, x2, y2)

    @staticmethod
    def save_image(image: np.ndarray, output_path: Union[str, Path]) -> None:
        """
        Save image to file (handles Chinese characters)

        Args:
            image: Image to save (BGR format)
            output_path: Output file path
        """
        output_path = str(output_path)

        # Convert BGR to RGB for PIL
        image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        pil_image = PILImage.fromarray(image_rgb)
        pil_image.save(output_path)

    @staticmethod
    def split_into_9_grids(image: Union[np.ndarray, PILImage.Image]) -> list:
        """
        Split image into 9 grids (3x3)

        Grid layout:
        1  2  3
        4  5  6
        7  8  9

        Args:
            image: Source image (np.ndarray or PIL Image)

        Returns:
            List of 9 PIL Image objects [grid1, grid2, ..., grid9]
        """
        ColorPrint.blue("[ImageCrop] split_into_9_grids started")

        # Convert to PIL if needed
        if isinstance(image, np.ndarray):
            ColorPrint.blue(f"[ImageCrop] Converting numpy array to PIL, shape: {image.shape}")

            if len(image.shape) == 3 and image.shape[2] == 3:
                # BGR to RGB
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                pil_img = PILImage.fromarray(image_rgb)
            else:
                pil_img = PILImage.fromarray(image)
        else:
            pil_img = image
            ColorPrint.blue(f"[ImageCrop] Image already PIL, size: {pil_img.size}")

        width, height = pil_img.size
        grid_width = width // 3
        grid_height = height // 3

        ColorPrint.blue(f"[ImageCrop] Image size: {width}x{height}, grid size: {grid_width}x{grid_height}")

        grids = []
        for row in range(3):
            for col in range(3):
                left = col * grid_width
                top = row * grid_height
                right = left + grid_width
                bottom = top + grid_height

                grid = pil_img.crop((left, top, right, bottom))
                grids.append(grid)

                ColorPrint.gray(f"[ImageCrop] Created grid {len(grids)}: ({left}, {top}, {right}, {bottom})")

        ColorPrint.green(f"[ImageCrop] split_into_9_grids completed, created {len(grids)} grids")

        return grids

    @staticmethod
    def split_grid_into_36_subgrids(grid_image: PILImage.Image) -> list:
        """
        Split a grid image into 36 subgrids (6x6)

        Args:
            grid_image: Grid image (PIL Image)

        Returns:
            List of 36 PIL Image objects [subgrid1, subgrid2, ..., subgrid36]
        """
        ColorPrint.blue(f"[ImageCrop] split_grid_into_36_subgrids started, grid size: {grid_image.size}")

        width, height = grid_image.size
        subgrid_width = width // 6
        subgrid_height = height // 6

        ColorPrint.blue(f"[ImageCrop] Subgrid size: {subgrid_width}x{subgrid_height}")

        subgrids = []
        for row in range(6):
            for col in range(6):
                left = col * subgrid_width
                top = row * subgrid_height
                right = left + subgrid_width
                bottom = top + subgrid_height

                subgrid = grid_image.crop((left, top, right, bottom))
                subgrids.append(subgrid)

        ColorPrint.green(f"[ImageCrop] split_grid_into_36_subgrids completed, created {len(subgrids)} subgrids")

        return subgrids

    @staticmethod
    def split_image_hierarchical(image: Union[np.ndarray, PILImage.Image]) -> list:
        """
        Split image into 9 grids, each grid into 36 subgrids
        Creates a 2D array structure: 9 grids x 36 subgrids

        Args:
            image: Source image (np.ndarray or PIL Image)

        Returns:
            List of lists: [[grid1_subgrids...], [grid2_subgrids...], ...]
            Total: 9 lists, each containing 36 PIL Image objects
        """
        # Split into 9 grids
        grids = ImageCrop.split_into_9_grids(image)

        # Split each grid into 36 subgrids
        hierarchical_grids = []
        for grid in grids:
            subgrids = ImageCrop.split_grid_into_36_subgrids(grid)
            hierarchical_grids.append(subgrids)

        return hierarchical_grids

    @staticmethod
    def get_subgrid_coordinates(grid_index: int, subgrid_index: int,
                                image_width: int, image_height: int) -> Tuple[int, int, int, int]:
        """
        Get absolute coordinates of a subgrid in the original image

        Args:
            grid_index: Grid index (0-8)
            subgrid_index: Subgrid index within grid (0-35)
            image_width: Original image width
            image_height: Original image height

        Returns:
            Tuple (left, top, right, bottom) in original image coordinates
        """
        # Calculate grid position
        grid_row = grid_index // 3
        grid_col = grid_index % 3
        grid_width = image_width // 3
        grid_height = image_height // 3

        # Calculate grid offset
        grid_left = grid_col * grid_width
        grid_top = grid_row * grid_height

        # Calculate subgrid position within grid
        subgrid_row = subgrid_index // 6
        subgrid_col = subgrid_index % 6
        subgrid_width = grid_width // 6
        subgrid_height = grid_height // 6

        # Calculate absolute coordinates
        left = grid_left + subgrid_col * subgrid_width
        top = grid_top + subgrid_row * subgrid_height
        right = left + subgrid_width
        bottom = top + subgrid_height

        return (left, top, right, bottom)

    @staticmethod
    def get_subgrid_center(grid_index: int, subgrid_index: int,
                          image_width: int, image_height: int) -> Tuple[int, int]:
        """
        Get center coordinates of a subgrid in the original image

        Args:
            grid_index: Grid index (0-8)
            subgrid_index: Subgrid index within grid (0-35)
            image_width: Original image width
            image_height: Original image height

        Returns:
            Tuple (center_x, center_y) in original image coordinates
        """
        left, top, right, bottom = ImageCrop.get_subgrid_coordinates(
            grid_index, subgrid_index, image_width, image_height
        )
        center_x = (left + right) // 2
        center_y = (top + bottom) // 2
        return (center_x, center_y)

    # ========================================================================
    # Group-based Lazy Grid Generation
    # ========================================================================

    @staticmethod
    def create_group() -> str:
        """
        Create a new image group and return its UUID

        Returns:
            str: UUID of the created group
        """
        group_id = str(uuid.uuid4())
        ImageCrop._image_groups[group_id] = {
            'image': None,
            'grids_cache': {},  # Cache for generated grids
            'width': 0,
            'height': 0
        }

        # Auto-cleanup old groups if exceeds limit
        if len(ImageCrop._image_groups) > MAX_CACHED_GROUPS:
            # Remove oldest group (first item in OrderedDict)
            oldest_group_id = next(iter(ImageCrop._image_groups))
            ImageCrop.destroy_group(oldest_group_id)

        return group_id

    @staticmethod
    def cache_image(group_id: str, image: Union[np.ndarray, PILImage.Image]) -> bool:
        """
        Cache an image in the specified group

        Args:
            group_id: Group UUID
            image: Source image (np.ndarray or PIL Image)

        Returns:
            bool: Success status
        """
        if group_id not in ImageCrop._image_groups:
            raise ValueError(f"Group '{group_id}' does not exist. Create group first using create_group()")

        # Convert to PIL if needed
        if isinstance(image, np.ndarray):
            if len(image.shape) == 3 and image.shape[2] == 3:
                # BGR to RGB
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                pil_img = PILImage.fromarray(image_rgb)
            else:
                pil_img = PILImage.fromarray(image)
        else:
            pil_img = image

        # Cache image
        width, height = pil_img.size
        ImageCrop._image_groups[group_id]['image'] = pil_img
        ImageCrop._image_groups[group_id]['width'] = width
        ImageCrop._image_groups[group_id]['height'] = height
        ImageCrop._image_groups[group_id]['grids_cache'] = {}  # Clear any existing cache

        return True

    @staticmethod
    def get_grid_lazy(group_id: str, grid_index: int) -> PILImage.Image:
        """
        Get a specific grid from cached image (lazy generation)

        Args:
            group_id: Group UUID
            grid_index: Grid index (0-8)

        Returns:
            PIL Image of the grid

        Raises:
            ValueError: If group doesn't exist or grid index is invalid
        """
        if group_id not in ImageCrop._image_groups:
            raise ValueError(f"Group '{group_id}' does not exist")

        if not 0 <= grid_index <= 8:
            raise ValueError(f"Grid index must be 0-8, got {grid_index}")

        group_data = ImageCrop._image_groups[group_id]

        if group_data['image'] is None:
            raise ValueError(f"No image cached in group '{group_id}'")

        # Check if already cached
        if grid_index in group_data['grids_cache']:
            return group_data['grids_cache'][grid_index]

        # Generate grid on-demand
        pil_img = group_data['image']
        width = group_data['width']
        height = group_data['height']

        grid_width = width // 3
        grid_height = height // 3

        grid_row = grid_index // 3
        grid_col = grid_index % 3

        left = grid_col * grid_width
        top = grid_row * grid_height
        right = left + grid_width
        bottom = top + grid_height

        grid_img = pil_img.crop((left, top, right, bottom))

        # Cache the grid
        group_data['grids_cache'][grid_index] = grid_img

        return grid_img

    @staticmethod
    def get_subgrid_lazy(group_id: str, grid_index: int, subgrid_index: int) -> PILImage.Image:
        """
        Get a specific subgrid from cached image (lazy generation)

        Args:
            group_id: Group UUID
            grid_index: Grid index (0-8)
            subgrid_index: Subgrid index within grid (0-35)

        Returns:
            PIL Image of the subgrid

        Raises:
            ValueError: If group doesn't exist or indices are invalid
        """
        if not 0 <= subgrid_index <= 35:
            raise ValueError(f"Subgrid index must be 0-35, got {subgrid_index}")

        # Get the grid (may be cached or generated)
        grid_img = ImageCrop.get_grid_lazy(group_id, grid_index)

        # Generate subgrid from the grid
        width, height = grid_img.size
        subgrid_width = width // 6
        subgrid_height = height // 6

        subgrid_row = subgrid_index // 6
        subgrid_col = subgrid_index % 6

        left = subgrid_col * subgrid_width
        top = subgrid_row * subgrid_height
        right = left + subgrid_width
        bottom = top + subgrid_height

        subgrid_img = grid_img.crop((left, top, right, bottom))

        return subgrid_img

    @staticmethod
    def get_subgrid_coordinates_from_group(group_id: str, grid_index: int, subgrid_index: int) -> Tuple[int, int, int, int]:
        """
        Get absolute coordinates of a subgrid from a cached group

        Args:
            group_id: Group UUID
            grid_index: Grid index (0-8)
            subgrid_index: Subgrid index within grid (0-35)

        Returns:
            Tuple (left, top, right, bottom) in original image coordinates

        Raises:
            ValueError: If group doesn't exist
        """
        if group_id not in ImageCrop._image_groups:
            raise ValueError(f"Group '{group_id}' does not exist")

        group_data = ImageCrop._image_groups[group_id]
        return ImageCrop.get_subgrid_coordinates(
            grid_index, subgrid_index,
            group_data['width'], group_data['height']
        )

    @staticmethod
    def get_subgrid_center_from_group(group_id: str, grid_index: int, subgrid_index: int) -> Tuple[int, int]:
        """
        Get center coordinates of a subgrid from a cached group

        Args:
            group_id: Group UUID
            grid_index: Grid index (0-8)
            subgrid_index: Subgrid index within grid (0-35)

        Returns:
            Tuple (center_x, center_y) in original image coordinates

        Raises:
            ValueError: If group doesn't exist
        """
        if group_id not in ImageCrop._image_groups:
            raise ValueError(f"Group '{group_id}' does not exist")

        group_data = ImageCrop._image_groups[group_id]
        return ImageCrop.get_subgrid_center(
            grid_index, subgrid_index,
            group_data['width'], group_data['height']
        )

    @staticmethod
    def destroy_group(group_id: str) -> bool:
        """
        Destroy a group and free its resources

        Args:
            group_id: Group UUID

        Returns:
            bool: True if destroyed, False if group didn't exist
        """
        if group_id in ImageCrop._image_groups:
            del ImageCrop._image_groups[group_id]
            return True
        return False

    @staticmethod
    def get_active_groups() -> list:
        """
        Get list of active group IDs

        Returns:
            List of group UUID strings
        """
        return list(ImageCrop._image_groups.keys())

    @staticmethod
    def clear_all_groups() -> None:
        """
        Clear all cached groups
        """
        ImageCrop._image_groups.clear()


# Example usage
if __name__ == "__main__":
    from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

    # Example: Load and crop image
    try:
        # Load image
        image_path = "test_image.png"
        image = ImageCrop.load_image(image_path)
        ColorPrint.green(f"Loaded image: {image.shape}")

        # Crop region
        cropped = ImageCrop.crop_region(image, (100, 100), (300, 300))
        ColorPrint.green(f"Cropped region: {cropped.shape}")

        # Crop around center (25% width to the left)
        center_x, center_y = 500, 500
        cropped_center, coords = ImageCrop.crop_around_center(
            image, center_x, center_y, width_percentage=0.25, direction="left"
        )
        ColorPrint.green(f"Cropped around center: {cropped_center.shape}, coords: {coords}")

    except Exception as e:
        ColorPrint.red(f"Error: {e}")
