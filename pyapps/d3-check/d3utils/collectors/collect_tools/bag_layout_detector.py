#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bag Layout Detector
Detects bag slot usage by analyzing separator lines and empty slots.
Singleton: instantiate before export; get via get_bag_layout_detector() for default 6x10 grid. Do not instantiate elsewhere.
"""

from typing import List, Dict, Tuple, Optional, Set
from pathlib import Path
import sys
import os

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy, get_third_package_PIL_Image
cv2 = get_third_package_cv2()
np = get_third_package_numpy()
Image = get_third_package_PIL_Image()

current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)

from pycore.pyfoundations.color_print import ColorPrint
from d3utils.d3u_common.image_annotator_helper import (
    create_annotator,
    draw_grid_overlay,
    get_annotation_color
)
from share.game_interface_data import (
    get_interference_colors,
    get_color_references,
    SEPARATOR_COLOR_TOLERANCE,
    SEPARATOR_SCAN_HEIGHT_PERCENT,
    SEPARATOR_SCAN_WIDTH_PERCENT
)
from providor.providor_index import CONFIG
from providor.constants.common import FLOW_IMAGES_IN_MEMORY_ONLY
from share.game_interface_data import get_global_scale

class BagLayoutDetector:
    """
    Detects bag slot usage without moving mouse or capturing multiple screenshots

    Strategy:
    1. Scan column by column (column 0 top to bottom, column 1 top to bottom, ...)
    2. For each two adjacent slots, check if there's a separator line between them
    3. If no separator line found, they belong to the same item (2-slot item)
    4. For confirmed single-slot items, check if empty by color uniformity
    """

    # Color analysis region ratios (based on 150x150 slot)
    # Single slot: extract 85x125 region (85/150 ≈ 0.567, 125/150 ≈ 0.833)
    COLOR_ANALYSIS_WIDTH_RATIO_1SLOT = 85.0 / 150.0
    COLOR_ANALYSIS_HEIGHT_RATIO_1SLOT = 125.0 / 150.0

    # Double slot: extract 90x250 region (90/150 ≈ 0.6, 250/308 ≈ 0.812)
    COLOR_ANALYSIS_WIDTH_RATIO_2SLOT = 90.0 / 150.0
    COLOR_ANALYSIS_HEIGHT_RATIO_2SLOT = 250.0 / 308.0

    # Bottom edge inset ratios (shrink from bottom to avoid border)
    # 1-slot item: shrink bottom edge by 10% of slot height
    COLOR_ANALYSIS_BOTTOM_INSET_1SLOT = 0.10

    # 2-slot item: shrink bottom edge by 8% of total height (2 slots)
    COLOR_ANALYSIS_BOTTOM_INSET_2SLOT = 0.08

    # Black threshold: pixels darker than this are considered "black" and excluded
    BLACK_THRESHOLD = 30

    # Color reference values (BGR format) with 5% tolerance

    # Color tolerance (2% of 255)
    COLOR_TOLERANCE = int(255 * 0.02)

    def __init__(self, rows: int = 6, cols: int = 10):
        """
        Initialize bag layout detector

        Args:
            rows: Number of rows in bag grid (default: 6)
            cols: Number of columns in bag grid (default: 10)
        """
        self.rows = rows
        self.cols = cols
        self.original_bag_image: Optional[np.ndarray] = None

        # Load shared color data once on initialization
        self.color_refs = get_color_references()
        self.interference_colors = get_interference_colors()

        ColorPrint.green("[BagLayoutDetector] Initialized")

    def _match_color_with_tolerance(self, pixel_bgr: Tuple[int, int, int], ref_colors: Set[Tuple[int, int, int]]) -> bool:
        """
        Check if pixel matches any reference color within tolerance

        Args:
            pixel_bgr: Pixel BGR values (b, g, r)
            ref_colors: Set of reference BGR color tuples

        Returns:
            True if pixel matches any reference color within tolerance
        """
        b, g, r = pixel_bgr
        for ref_b, ref_g, ref_r in ref_colors:
            if (abs(int(b) - int(ref_b)) <= self.COLOR_TOLERANCE and
                abs(int(g) - int(ref_g)) <= self.COLOR_TOLERANCE and
                abs(int(r) - int(ref_r)) <= self.COLOR_TOLERANCE):
                return True
        return False

    def detect_layout(
        self,
        bag_image: np.ndarray,
        bag_coords: Dict[str, Tuple[int, int]]
    ) -> Dict:
        """
        Detect bag slot usage from bag region image

        Args:
            bag_image: Cropped bag region image (BGR format)
            bag_coords: Dictionary with 'top_left' and 'bottom_right' coordinates

        Returns:
            Dictionary containing:
            - 'layout': 2D array (rows x cols) with slot usage
            - 'items': Dictionary mapping (row, col) to item info:
                {
                    'type': 'empty' | 'item_1slot' | 'item_2slot',
                    'quality': 'empty' | 'legendary_set' | 'legendary' | 'rare' | 'magic' | 'unknown',
                    'color_analysis': {...}
                }
        """
        ColorPrint.blue("\n[Layout] Detecting bag slot usage...")

        height, width = bag_image.shape[:2]
        slot_height = height / self.rows
        slot_width = width / self.cols

        ColorPrint.blue(f"[Layout] Bag size: {width}x{height}")
        ColorPrint.blue(f"[Layout] Slot size: {slot_width:.1f}x{slot_height:.1f}")

        # Store original bag image for visualization
        self.original_bag_image = bag_image.copy()

        # Initialize result grid
        layout = [['unknown' for _ in range(self.cols)] for _ in range(self.rows)]

        # Step 1: Detect item placement by checking separator lines
        # Scan column by column, checking each pair of adjacent slots
        for col in range(self.cols):
            ColorPrint.gray(f"[Layout] Scanning column {col + 1}/{self.cols}...")
            row = 0

            while row < self.rows:
                # If already processed (part of 2-slot item), skip
                if layout[row][col] != 'unknown':
                    row += 1
                    continue

                # Check if this slot and next slot belong to same item
                if row + 1 < self.rows and layout[row + 1][col] == 'unknown':
                    # Check for separator line between current and next slot
                    has_separator = self._has_separator_line(
                        bag_image, row, col, slot_width, slot_height
                    )

                    if has_separator:
                        # Has separator line → different items
                        ColorPrint.gray(f"[Separator] Found between ({row},{col}) and ({row+1},{col})")
                        layout[row][col] = 'item_or_empty'
                        # Continue to next slot (row+1) to check [row+1, row+2]
                        row += 1
                    else:
                        # No separator line → same item occupies 2 slots
                        ColorPrint.green(f"[2-slot] Slots ({row},{col})-({row+1},{col}) have same item")
                        layout[row][col] = 'item_2slot_top'
                        layout[row + 1][col] = 'item_2slot_bottom'
                        # Skip to slot after the 2-slot item (row+2)
                        row += 2
                else:
                    # Last row or next slot already processed
                    layout[row][col] = 'item_or_empty'
                    row += 1

        # Step 2: Detect empty slots
        # Only check slots that are 'item_or_empty' (have separator lines or last row)
        for row in range(self.rows):
            for col in range(self.cols):
                if layout[row][col] == 'item_or_empty':
                    if self._is_slot_empty(bag_image, row, col, slot_width, slot_height):
                        ColorPrint.gray(f"[Empty] Slot ({row},{col}) is empty")
                        layout[row][col] = 'empty'
                    else:
                        ColorPrint.gray(f"[Item] Slot ({row},{col}) has 1-slot item")
                        layout[row][col] = 'item_1slot'

        # Step 3: Analyze colors for all items (1-slot and 2-slot)
        color_analysis = self._analyze_item_colors(bag_image, layout, slot_width, slot_height)

        # Step 4: Build item information dictionary with quality mapping
        items = {}
        for row in range(self.rows):
            for col in range(self.cols):
                slot_type = layout[row][col]

                if slot_type == 'empty':
                    items[(row, col)] = {
                        'type': 'empty',
                        'quality': 'empty',
                        'color_analysis': None
                    }
                elif slot_type == 'item_1slot':
                    quality = self._determine_item_quality(color_analysis.get((row, col)), False)
                    items[(row, col)] = {
                        'type': 'item_1slot',
                        'quality': quality,
                        'color_analysis': color_analysis.get((row, col))
                    }
                elif slot_type == 'item_2slot_top':
                    quality = self._determine_item_quality(color_analysis.get((row, col)), True)
                    items[(row, col)] = {
                        'type': 'item_2slot',
                        'quality': quality,
                        'color_analysis': color_analysis.get((row, col))
                    }
                elif slot_type == 'item_2slot_bottom':
                    # Bottom part references the top part
                    items[(row, col)] = {
                        'type': 'item_2slot_bottom',
                        'quality': 'see_top',
                        'color_analysis': None
                    }

        self._print_layout(layout, color_analysis, items)

        return {
            'layout': layout,
            'items': items,
            'color_analysis': color_analysis
        }

    def _has_separator_line(
        self,
        bag_image: np.ndarray,
        row: int,
        col: int,
        slot_width: float,
        slot_height: float
    ) -> bool:
        """
        Check if there's a separator line between two slots

        Strategy:
        1. Take the middle 20% height range between the two slots, 80% width
        2. For each pixel row in this range:
           - Take the first pixel of the row as reference
           - Scan the entire row width (80%)
           - If all pixels are within 2% tolerance of first pixel → uniform row → separator line
        3. If any row is uniform → separator exists → different items
        4. If no uniform row found → no separator → same item

        Args:
            bag_image: Bag region image
            row: Row index of current slot
            col: Column index
            slot_width: Width of one slot
            slot_height: Height of one slot

        Returns:
            True if separator line found
        """
        # Boundary between current slot and next slot
        boundary_y = int((row + 1) * slot_height)

        # Scan range: 20% of slot height centered on boundary
        scan_height_range = int(slot_height * SEPARATOR_SCAN_HEIGHT_PERCENT)
        y1 = max(0, boundary_y - scan_height_range // 2)
        y2 = min(bag_image.shape[0], boundary_y + scan_height_range // 2)

        # Scan width: 80% of slot width, centered
        slot_center_x = int(col * slot_width + slot_width / 2)
        scan_width = int(slot_width * SEPARATOR_SCAN_WIDTH_PERCENT)
        x1 = max(0, int(slot_center_x - scan_width / 2))
        x2 = min(bag_image.shape[1], int(slot_center_x + scan_width / 2))

        scan_region = bag_image[y1:y2, x1:x2]

        if scan_region.size == 0:
            return False

        # Convert to grayscale
        if len(scan_region.shape) == 3:
            gray = cv2.cvtColor(scan_region, cv2.COLOR_BGR2GRAY)
        else:
            gray = scan_region

        # Scan each row in the region
        for scan_row_idx in range(gray.shape[0]):
            row_pixels = gray[scan_row_idx, :]

            if len(row_pixels) == 0:
                continue

            # Take first pixel as reference
            first_pixel = float(row_pixels[0])

            # Check if all pixels in the row are within 2% tolerance of first pixel
            tolerance = 255 * SEPARATOR_COLOR_TOLERANCE  # 2% of 255

            all_similar = True
            for pixel_val in row_pixels:
                if abs(float(pixel_val) - first_pixel) > tolerance:
                    all_similar = False
                    break

            # If this row has uniform color, it's a separator line
            if all_similar:
                ColorPrint.gray(f"[Separator] Found uniform row at ({row},{col})->({row+1},{col}), "
                              f"first_pixel={first_pixel:.1f}, row_width={len(row_pixels)}")
                return True

        return False

    def _is_slot_empty(
        self,
        bag_image: np.ndarray,
        row: int,
        col: int,
        slot_width: float,
        slot_height: float
    ) -> bool:
        """
        Check if a slot is empty by analyzing color uniformity

        Strategy:
        Check if single color occupies 90% or more of the slot pixels

        Args:
            bag_image: Bag region image
            row: Row index
            col: Column index
            slot_width: Width of one slot
            slot_height: Height of one slot

        Returns:
            True if slot is empty (uniform color)
        """
        # Extract slot region
        x1 = int(col * slot_width)
        x2 = int((col + 1) * slot_width)
        y1 = int(row * slot_height)
        y2 = int((row + 1) * slot_height)

        slot_region = bag_image[y1:y2, x1:x2]

        if slot_region.size == 0:
            return False

        # Extract center scan region (height 10%, width 60%)
        slot_h, slot_w = slot_region.shape[:2]

        # Height: center 10%
        height_ratio = 0.10
        margin_h = int(slot_h * (1 - height_ratio) / 2)

        # Width: center 60%
        width_ratio = 0.60
        margin_w = int(slot_w * (1 - width_ratio) / 2)

        scan_region = slot_region[
            margin_h:slot_h - margin_h,
            margin_w:slot_w - margin_w
        ]

        if scan_region.size == 0 or scan_region.shape[0] < 2:
            return False

        # Convert to grayscale for easier comparison
        if len(scan_region.shape) == 3:
            gray = cv2.cvtColor(scan_region, cv2.COLOR_BGR2GRAY)
        else:
            gray = scan_region

        # Scan each row and collect first pixel values
        row_first_pixels = []
        for scan_row_idx in range(gray.shape[0]):
            first_pixel = gray[scan_row_idx, 0]
            row_first_pixels.append(first_pixel)

        # Count how many rows have exactly the same first pixel (difference <= 1)
        # Group pixels by exact/near-exact match
        pixel_counts = {}
        for pixel_val in row_first_pixels:
            # Round to nearest integer to handle minor variations
            pixel_key = round(pixel_val)
            pixel_counts[pixel_key] = pixel_counts.get(pixel_key, 0) + 1

        # Find the most common pixel value
        if not pixel_counts:
            return False

        max_count = max(pixel_counts.values())
        most_common_pixel = max(pixel_counts.keys(), key=lambda k: pixel_counts[k])

        # Empty slot criteria:
        # 1. At least 2 rows with exactly the same pixel value
        # 2. That pixel value is dark (< 20)
        if max_count >= 2 and most_common_pixel < 20:
            return True

        return False

    def _analyze_item_colors(
        self,
        bag_image: np.ndarray,
        layout: List[List[str]],
        slot_width: float,
        slot_height: float
    ) -> Dict:
        """
        Analyze color composition for all items in the bag

        For each item (1-slot or 2-slot):
        - Extract center region (bottom-aligned, center-aligned)
        - Calculate color percentages (yellow, blue, dark-gold, green, black excluded)
        - Return sorted color ratios

        Args:
            bag_image: Bag region image
            layout: 2D array of slot usage
            slot_width: Width of one slot
            slot_height: Height of one slot

        Returns:
            Dictionary mapping (row, col) to color analysis results
        """
        ColorPrint.blue("\n[ColorAnalysis] Analyzing item colors...")

        color_results = {}
        processed = set()

        for row in range(self.rows):
            for col in range(self.cols):
                if (row, col) in processed:
                    continue

                slot_type = layout[row][col]

                # Only analyze items (not empty slots)
                if slot_type == 'item_1slot':
                    # Analyze 1-slot item
                    colors = self._analyze_single_slot_color(
                        bag_image, row, col, slot_width, slot_height
                    )
                    color_results[(row, col)] = colors
                    processed.add((row, col))

                elif slot_type == 'item_2slot_top':
                    # Analyze 2-slot item
                    colors = self._analyze_double_slot_color(
                        bag_image, row, col, slot_width, slot_height
                    )
                    color_results[(row, col)] = colors
                    processed.add((row, col))
                    processed.add((row + 1, col))

        return color_results

    def _analyze_single_slot_color(
        self,
        bag_image: np.ndarray,
        row: int,
        col: int,
        slot_width: float,
        slot_height: float
    ) -> Dict:
        """
        Analyze color for a single-slot item

        Extract 85x125 region (bottom-aligned, center-aligned)
        """
        # Get slot region
        x1 = int(col * slot_width)
        x2 = int((col + 1) * slot_width)
        y1 = int(row * slot_height)
        y2 = int((row + 1) * slot_height)

        slot_region = bag_image[y1:y2, x1:x2]
        slot_h, slot_w = slot_region.shape[:2]

        # Calculate extract region size
        extract_w = int(slot_w * self.COLOR_ANALYSIS_WIDTH_RATIO_1SLOT)
        extract_h = int(slot_h * self.COLOR_ANALYSIS_HEIGHT_RATIO_1SLOT)

        # Bottom-aligned, center-aligned
        center_x = slot_w // 2
        start_x = max(0, center_x - extract_w // 2)
        end_x = min(slot_w, start_x + extract_w)

        # Bottom edge: inset by 10% of slot height to avoid border
        bottom_inset = int(slot_h * self.COLOR_ANALYSIS_BOTTOM_INSET_1SLOT)
        end_y = slot_h - bottom_inset
        start_y = max(0, end_y - extract_h)

        extract_region = slot_region[start_y:end_y, start_x:end_x]

        # Store extraction coordinates for visualization
        abs_start_x = x1 + start_x
        abs_start_y = y1 + start_y
        abs_end_x = x1 + end_x
        abs_end_y = y1 + end_y

        # Analyze colors
        colors = self._calculate_color_percentages(extract_region, is_2slot=False)
        colors['extract_region'] = (abs_start_x, abs_start_y, abs_end_x, abs_end_y)

        return colors

    def _analyze_double_slot_color(
        self,
        bag_image: np.ndarray,
        row: int,
        col: int,
        slot_width: float,
        slot_height: float
    ) -> Dict:
        """
        Analyze color for a double-slot item (2 rows)

        Extract 90x250 region (bottom-aligned, center-aligned)
        """
        # Get 2-slot region (row and row+1)
        x1 = int(col * slot_width)
        x2 = int((col + 1) * slot_width)
        y1 = int(row * slot_height)
        y2 = int((row + 2) * slot_height)  # Spans 2 rows

        slot_region = bag_image[y1:y2, x1:x2]
        slot_h, slot_w = slot_region.shape[:2]

        # Calculate extract region size
        extract_w = int(slot_w * self.COLOR_ANALYSIS_WIDTH_RATIO_2SLOT)
        extract_h = int(slot_h * self.COLOR_ANALYSIS_HEIGHT_RATIO_2SLOT)

        # Bottom-aligned, center-aligned
        center_x = slot_w // 2
        start_x = max(0, center_x - extract_w // 2)
        end_x = min(slot_w, start_x + extract_w)

        # Bottom edge: inset by 8% of total height (2 slots) to avoid border
        bottom_inset = int(slot_h * self.COLOR_ANALYSIS_BOTTOM_INSET_2SLOT)
        end_y = slot_h - bottom_inset
        start_y = max(0, end_y - extract_h)

        extract_region = slot_region[start_y:end_y, start_x:end_x]

        # Store extraction coordinates for visualization
        abs_start_x = x1 + start_x
        abs_start_y = y1 + start_y
        abs_end_x = x1 + end_x
        abs_end_y = y1 + end_y

        # Analyze colors (double slot item)
        colors = self._calculate_color_percentages(extract_region, is_2slot=True)
        colors['extract_region'] = (abs_start_x, abs_start_y, abs_end_x, abs_end_y)

        return colors

    def _calculate_color_percentages(self, region: np.ndarray, is_2slot: bool = False) -> Dict:
        """
        Calculate color percentages in a region using reference colors

        Args:
            region: Image region (BGR format)
            is_2slot: Whether this is a 2-slot item (affects dark_gold detection)

        Returns:
            Dictionary with color percentages sorted by value
        """
        if region.size == 0:
            return {'colors': []}

        # Flatten region to list of pixels
        pixels = region.reshape(-1, 3)  # BGR format

        # Filter out interference colors (exact match, no tolerance)
        if self.interference_colors:
            # Create mask for non-interference pixels
            interference_mask = np.ones(len(pixels), dtype=bool)
            for i, pixel in enumerate(pixels):
                pixel_tuple = tuple(pixel)
                if pixel_tuple in self.interference_colors:
                    interference_mask[i] = False
            pixels = pixels[interference_mask]

        if len(pixels) == 0:
            return {'colors': []}

        # Filter out very dark pixels (black background)
        non_black_mask = np.max(pixels, axis=1) > self.BLACK_THRESHOLD
        non_black_pixels = pixels[non_black_mask]

        if len(non_black_pixels) == 0:
            return {'colors': []}

        total_pixels = len(non_black_pixels)

        # Count each color by matching to reference colors
        color_counts = {
            'blue': 0,
            'yellow': 0,
            'dark_gold': 0,
            'green': 0,
            'black': 0,
        }

        for pixel in non_black_pixels:
            pixel_tuple = tuple(pixel)

            # Check ALL color categories for each pixel (don't break after first match)
            # Blue
            if self._match_color_with_tolerance(pixel_tuple, self.color_refs['blue']):
                color_counts['blue'] += 1

            # Yellow
            if self._match_color_with_tolerance(pixel_tuple, self.color_refs['yellow']):
                color_counts['yellow'] += 1

            # Green
            if self._match_color_with_tolerance(pixel_tuple, self.color_refs['green']):
                color_counts['green'] += 1

            # Dark gold (check both 1-slot and 2-slot references)
            dark_gold_refs = self.color_refs['dark_gold_2slot'] if is_2slot else set()
            dark_gold_refs = dark_gold_refs | self.color_refs['dark_gold_1slot']
            if self._match_color_with_tolerance(pixel_tuple, dark_gold_refs):
                color_counts['dark_gold'] += 1

            # Black
            if self._match_color_with_tolerance(pixel_tuple, self.color_refs['black']):
                color_counts['black'] += 1

        # Calculate percentages
        color_percentages = {}
        for color_name, count in color_counts.items():
            percentage = (count / total_pixels) * 100 if total_pixels > 0 else 0
            if percentage > 0:
                color_percentages[color_name] = percentage

        # Sort by percentage (descending)
        sorted_colors = sorted(color_percentages.items(), key=lambda x: x[1], reverse=True)

        return {'colors': sorted_colors, 'total_pixels': total_pixels}

    def _determine_item_quality(self, color_data: Dict, is_2slot: bool) -> str:
        """
        Determine item quality based on dominant color

        Quality mapping:
        - green -> legendary_set (set legendary)
        - dark_gold -> legendary (legendary)
        - yellow -> rare (rare)
        - blue -> magic (magic)
        - black -> empty (empty slot)

        Args:
            color_data: Color analysis data
            is_2slot: Whether this is a 2-slot item

        Returns:
            Quality string: 'empty', 'legendary_set', 'legendary', 'rare', 'magic', 'unknown'
        """
        if not color_data or 'colors' not in color_data or not color_data['colors']:
            return 'unknown'

        # Get dominant color (highest percentage)
        dominant_color, dominant_pct = color_data['colors'][0]

        # Map color to quality
        quality_map = {
            'green': 'legendary_set',    # set legendary (green)
            'dark_gold': 'legendary',     # legendary (orange)
            'yellow': 'rare',             # rare (yellow)
            'blue': 'magic',              # magic (blue)
            'black': 'empty',             # empty slot
        }

        return quality_map.get(dominant_color, 'unknown')

    def _print_layout(self, layout: List[List[str]], color_analysis: Dict = None, items: Dict = None) -> None:
        """
        Print layout in formatted table and save visualization image

        Args:
            layout: 2D array of slot usage
            color_analysis: Color analysis results for items
            items: Dictionary mapping (row, col) to item info with quality
        """
        ColorPrint.blue("\n" + "=" * 80)
        ColorPrint.blue("Bag Layout Detection Results")
        ColorPrint.blue("=" * 80)

        # Count slot types
        empty_count = 0
        item_1slot_count = 0
        item_2slot_count = 0

        for row in range(self.rows):
            for col in range(self.cols):
                slot_type = layout[row][col]
                if slot_type == 'empty':
                    empty_count += 1
                elif slot_type == 'item_1slot':
                    item_1slot_count += 1
                elif slot_type == 'item_2slot_top':
                    item_2slot_count += 1

        ColorPrint.green(f"\nEmpty slots: {empty_count}")
        ColorPrint.green(f"1-slot items: {item_1slot_count}")
        ColorPrint.green(f"2-slot items: {item_2slot_count}")
        ColorPrint.green(f"Total occupied: {item_1slot_count + item_2slot_count * 2}/{self.rows * self.cols}")

        # Count by quality
        if items:
            quality_count = {
                'legendary_set': 0,
                'legendary': 0,
                'rare': 0,
                'magic': 0,
                'empty': 0,
                'unknown': 0
            }

            for (row, col), item_info in items.items():
                if item_info['type'] in ['item_1slot', 'item_2slot']:
                    quality = item_info.get('quality', 'unknown')
                    quality_count[quality] = quality_count.get(quality, 0) + 1

            ColorPrint.blue("\nItem Quality Statistics (color-based; 4 types: empty, magic, rare, legendary):")
            ColorPrint.green(f"  Legendary Set (Green): {quality_count['legendary_set']}")
            ColorPrint.green(f"  Legendary (Ancient): {quality_count['legendary']}")
            ColorPrint.gray("  (Legendary tier normal/ancient/primal requires hover to detect ancient/primal line)")
            ColorPrint.green(f"  Rare (Yellow): {quality_count['rare']}")
            ColorPrint.green(f"  Magic (Blue): {quality_count['magic']}")
            if quality_count['unknown'] > 0:
                ColorPrint.yellow(f"  Unknown: {quality_count['unknown']}")

        # Print grid
        ColorPrint.blue("\nGrid Layout:")
        ColorPrint.gray("  " + "".join(f"C{c:2d} " for c in range(self.cols)))

        for row in range(self.rows):
            row_str = f"R{row} "
            for col in range(self.cols):
                slot_type = layout[row][col]
                if slot_type == 'empty':
                    symbol = " .  "
                elif slot_type == 'item_1slot':
                    symbol = " O  "
                elif slot_type == 'item_2slot_top':
                    symbol = " ^  "
                elif slot_type == 'item_2slot_bottom':
                    symbol = " v  "
                else:
                    symbol = " ?  "

                row_str += symbol

            ColorPrint.gray(row_str)

        ColorPrint.blue("=" * 80 + "\n")
        ColorPrint.gray("Legend: . = Empty, O = 1-slot item, ^ = Top of 2-slot item, v = Bottom of 2-slot item")

        # Print color analysis results
        if color_analysis:
            ColorPrint.blue("\n" + "=" * 80)
            ColorPrint.blue("Color Analysis Results")
            ColorPrint.blue("=" * 80 + "\n")

            for (row, col), colors in sorted(color_analysis.items()):
                slot_type = layout[row][col]
                type_str = "2-slot" if slot_type == 'item_2slot_top' else "1-slot"

                ColorPrint.green(f"[{type_str}] Slot ({row},{col}):")
                if 'colors' in colors and colors['colors']:
                    for color_name, percentage in colors['colors']:
                        if percentage > 0.1:  # Only show colors with > 0.1%
                            ColorPrint.gray(f"  {color_name:12s}: {percentage:5.2f}%")
                else:
                    ColorPrint.gray("  No colors detected")

            ColorPrint.blue("=" * 80 + "\n")

        # Draw and save visualization image
        self._save_layout_visualization(layout, empty_count, item_1slot_count, item_2slot_count, color_analysis)

    def build_visualization_image(self, layout_result: Dict) -> Optional[np.ndarray]:
        """
        Build bag layout visualization image in memory (same content as bag_layout_*.png).
        Must be called after detect_layout() so self.original_bag_image is set.

        Args:
            layout_result: Dict from detect_layout with 'layout', 'items', optional 'color_analysis'

        Returns:
            Combined BGR image (grid + bag screenshot + extraction + color table), or None on error.
        """
        if not layout_result or self.original_bag_image is None:
            return None
        layout = layout_result.get("layout")
        if not layout or len(layout) != self.rows or (len(layout[0]) != self.cols):
            return None
        empty_count = sum(1 for r in range(self.rows) for c in range(self.cols) if layout[r][c] == "empty")
        item_1slot_count = sum(1 for r in range(self.rows) for c in range(self.cols) if layout[r][c] == "item_1slot")
        item_2slot_count = sum(1 for r in range(self.rows) for c in range(self.cols) if layout[r][c] == "item_2slot_top")
        color_analysis = layout_result.get("color_analysis")
        return self._build_layout_visualization_image(
            layout, empty_count, item_1slot_count, item_2slot_count, color_analysis
        )

    def _build_layout_visualization_image(
        self,
        layout: List[List[str]],
        empty_count: int,
        item_1slot_count: int,
        item_2slot_count: int,
        color_analysis: Dict = None
    ) -> Optional[np.ndarray]:
        """
        Build combined visualization image (grid + bag + extraction + color table).
        Returns BGR numpy array; does not save to file.
        """
        try:
            # --- Part 1: Detection Result Grid ---
            cell_size = 60  # Size of each slot
            margin = 20
            legend_height = 150
            title_height = 60

            grid_width = self.cols * cell_size + 2 * margin
            grid_height = self.rows * cell_size + 2 * margin + title_height + legend_height

            # Create detection result image (white background)
            grid_image = np.ones((grid_height, grid_width, 3), dtype=np.uint8) * 255

            # Colors (BGR format)
            color_empty = (200, 200, 200)        # Gray
            color_1slot = (100, 200, 100)        # Green
            color_2slot_top = (200, 150, 100)    # Blue-ish
            color_2slot_bottom = (150, 100, 200) # Purple-ish
            color_border = (50, 50, 50)          # Dark gray
            color_text = (0, 0, 0)               # Black

            # Get offset information
            scale_x, scale_y = get_global_scale()
            bag_offset = CONFIG.get('system_settings', {}).get('bag_offset', {})
            bag_offset_left = bag_offset.get('left', 9)
            bag_offset_right = bag_offset.get('right', 22)
            bag_offset_top = bag_offset.get('top', 0)
            bag_offset_bottom = bag_offset.get('bottom', 0)

            scaled_offset_left = int(bag_offset_left * scale_x)
            scaled_offset_right = int(bag_offset_right * scale_x)
            scaled_offset_top = int(bag_offset_top * scale_y)
            scaled_offset_bottom = int(bag_offset_bottom * scale_y)

            # Draw title
            title = "Bag Layout Detection Result"
            cv2.putText(
                grid_image, title,
                (margin, 25),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7, color_text, 2
            )

            # Draw offset info
            offset_info = f"Offset: L={scaled_offset_left}px R={scaled_offset_right}px T={scaled_offset_top}px B={scaled_offset_bottom}px (Scale: {scale_x:.2f}x{scale_y:.2f})"
            cv2.putText(
                grid_image, offset_info,
                (margin, 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.45, (100, 100, 100), 1
            )

            # Draw grid
            grid_start_y = title_height + margin

            for row in range(self.rows):
                for col in range(self.cols):
                    x1 = margin + col * cell_size
                    y1 = grid_start_y + row * cell_size
                    x2 = x1 + cell_size
                    y2 = y1 + cell_size

                    slot_type = layout[row][col]

                    # Choose color based on slot type
                    if slot_type == 'empty':
                        fill_color = color_empty
                        label = "."
                    elif slot_type == 'item_1slot':
                        fill_color = color_1slot
                        label = "O"
                    elif slot_type == 'item_2slot_top':
                        fill_color = color_2slot_top
                        label = "^"
                    elif slot_type == 'item_2slot_bottom':
                        fill_color = color_2slot_bottom
                        label = "v"
                    else:
                        fill_color = (255, 255, 255)
                        label = "?"

                    # Fill cell
                    cv2.rectangle(grid_image, (x1, y1), (x2, y2), fill_color, -1)

                    # Draw cell border
                    cv2.rectangle(grid_image, (x1, y1), (x2, y2), color_border, 1)

                    # Draw label
                    label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)[0]
                    label_x = x1 + (cell_size - label_size[0]) // 2
                    label_y = y1 + (cell_size + label_size[1]) // 2
                    cv2.putText(
                        grid_image, label,
                        (label_x, label_y),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.8, color_text, 2
                    )

            # Draw legend
            legend_start_y = grid_start_y + self.rows * cell_size + margin

            legend_items = [
                ("Empty slot", color_empty, "."),
                ("1-slot item", color_1slot, "O"),
                ("2-slot top", color_2slot_top, "^"),
                ("2-slot bottom", color_2slot_bottom, "v")
            ]

            for i, (text, color, symbol) in enumerate(legend_items):
                y = legend_start_y + i * 30

                # Draw color box
                cv2.rectangle(grid_image, (margin, y), (margin + 25, y + 20), color, -1)
                cv2.rectangle(grid_image, (margin, y), (margin + 25, y + 20), color_border, 1)

                # Draw symbol
                cv2.putText(
                    grid_image, symbol,
                    (margin + 5, y + 16),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6, color_text, 2
                )

                # Draw text
                cv2.putText(
                    grid_image, text,
                    (margin + 35, y + 16),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5, color_text, 1
                )

            # Draw statistics
            stats_y = legend_start_y + len(legend_items) * 30 + 10
            stats_text = f"Empty: {empty_count}  |  1-slot: {item_1slot_count}  |  2-slot: {item_2slot_count}"
            cv2.putText(
                grid_image, stats_text,
                (margin, stats_y),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.5, color_text, 1
            )

            # --- Part 2: Actual Bag Screenshot ---
            # Resize bag screenshot to match grid width
            bag_screenshot = self.original_bag_image.copy()

            # Ensure image is contiguous for OpenCV operations
            bag_screenshot = np.ascontiguousarray(bag_screenshot)

            # Draw grid lines using helper
            bag_annotator = create_annotator(bag_screenshot)
            draw_grid_overlay(bag_annotator, rows=self.rows, cols=self.cols, grid_color="green", thickness=2)
            bag_screenshot = bag_annotator.get_image()

            bag_height, bag_width = bag_screenshot.shape[:2]

            # Calculate resize ratio to match grid width
            resize_ratio = grid_width / bag_width
            new_bag_width = grid_width
            new_bag_height = int(bag_height * resize_ratio)

            bag_screenshot_resized = cv2.resize(bag_screenshot, (new_bag_width, new_bag_height))

            # Add title to bag screenshot
            bag_title_height = 40
            bag_with_title = np.ones((new_bag_height + bag_title_height, new_bag_width, 3), dtype=np.uint8) * 255

            # Draw title
            cv2.putText(
                bag_with_title, "Actual Bag Screenshot",
                (margin, 28),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8, color_text, 2
            )

            # Place bag screenshot below title
            bag_with_title[bag_title_height:, :] = bag_screenshot_resized

            # --- Part 3: Bag with Extraction Regions ---
            extraction_image = None
            if color_analysis:
                # Create image showing extraction regions
                extraction_bag = self.original_bag_image.copy()

                # Draw grid lines and extraction regions using helper
                extraction_annotator = create_annotator(extraction_bag)
                draw_grid_overlay(extraction_annotator, rows=self.rows, cols=self.cols, grid_color="cyan", thickness=2)

                # Draw rectangles for each extraction region
                for (row, col), colors in color_analysis.items():
                    if 'extract_region' in colors:
                        x1, y1, x2, y2 = colors['extract_region']
                        # Draw green rectangle for extraction region
                        extraction_annotator.draw_rectangle(
                            top_left=(x1, y1),
                            bottom_right=(x2, y2),
                            color=get_annotation_color("green"),
                            thickness=2
                        )

                extraction_bag = extraction_annotator.get_image()

                # Resize to match grid width
                extraction_resized = cv2.resize(extraction_bag, (new_bag_width, new_bag_height))

                # Add title
                extraction_title_height = 40
                extraction_with_title = np.ones((new_bag_height + extraction_title_height, new_bag_width, 3), dtype=np.uint8) * 255

                cv2.putText(
                    extraction_with_title, "Color Analysis Regions",
                    (margin, 28),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8, color_text, 2
                )

                extraction_with_title[extraction_title_height:, :] = extraction_resized
                extraction_image = extraction_with_title

            # --- Part 4: Color Analysis Table with Pie Charts ---
            color_table_image = None
            if color_analysis:
                # Create color analysis table
                cell_size = 60
                table_width = self.cols * cell_size + 2 * margin
                table_height = self.rows * cell_size + 2 * margin + title_height
                color_table = np.ones((table_height, table_width, 3), dtype=np.uint8) * 255

                # Draw title
                cv2.putText(
                    color_table, "Color Analysis Table",
                    (margin, 35),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.8, color_text, 2
                )

                table_start_y = title_height + margin

                # Color mapping for pie charts
                color_map = {
                    'yellow': (0, 255, 255),
                    'blue': (255, 0, 0),
                    'dark_gold': (0, 140, 180),
                    'green': (0, 255, 0),
                }

                # Track which cells have been processed (for 2-slot items)
                processed_cells = set()

                for row in range(self.rows):
                    for col in range(self.cols):
                        if (row, col) in processed_cells:
                            continue

                        x1 = margin + col * cell_size
                        y1 = table_start_y + row * cell_size
                        x2 = x1 + cell_size
                        y2 = y1 + cell_size

                        slot_type = layout[row][col]

                        # Check if this is a 2-slot item
                        is_2slot = slot_type == 'item_2slot_top'
                        if is_2slot:
                            # Merge two cells vertically
                            y2 = y1 + cell_size * 2
                            processed_cells.add((row, col))
                            processed_cells.add((row + 1, col))

                        # Draw cell border
                        cv2.rectangle(color_table, (x1, y1), (x2, y2), color_border, 2 if is_2slot else 1)

                        # Draw "2-slot" label for merged cells
                        if is_2slot:
                            label_text = "2-slot"
                            text_size = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.3, 1)[0]
                            text_x = x1 + (cell_size - text_size[0]) // 2
                            text_y = y1 + 10
                            cv2.putText(
                                color_table, label_text,
                                (text_x, text_y),
                                cv2.FONT_HERSHEY_SIMPLEX,
                                0.3, (255, 0, 0), 1
                            )

                        # Check if this slot has color analysis
                        colors_data = color_analysis.get((row, col))
                        if colors_data and 'colors' in colors_data and colors_data['colors']:
                            # Calculate pie center (adjust for 2-slot items)
                            pie_center_y = y1 + (y2 - y1) // 2
                            pie_center = (x1 + cell_size // 2, pie_center_y)
                            pie_radius = min(cell_size // 3, 18)

                            # Prepare percentages dictionary - include ALL colors
                            percentages = {}
                            for color_name, percentage in colors_data['colors']:
                                percentages[color_name] = percentage

                            if percentages:
                                # Draw pie chart
                                self._draw_pie_chart_on_image(
                                    color_table, pie_center, pie_radius, percentages, color_map
                                )

                                # Draw dominant color name below pie chart
                                dominant_color = colors_data['colors'][0][0]
                                dominant_pct = colors_data['colors'][0][1]

                                if dominant_pct > 0.01:
                                    text = f"{dominant_color}"
                                    text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.3, 1)[0]
                                    text_x = x1 + (cell_size - text_size[0]) // 2
                                    text_y = y2 - 5

                                    cv2.putText(
                                        color_table, text,
                                        (text_x, text_y),
                                        cv2.FONT_HERSHEY_SIMPLEX,
                                        0.3, color_text, 1
                                    )

                color_table_image = color_table

            # --- Part 5: Combine All Images Vertically ---
            images_to_combine = [grid_image, bag_with_title]
            if extraction_image is not None:
                images_to_combine.append(extraction_image)
            if color_table_image is not None:
                images_to_combine.append(color_table_image)

            combined_height = sum(img.shape[0] for img in images_to_combine)
            combined_image = np.ones((combined_height, grid_width, 3), dtype=np.uint8) * 255

            # Place images vertically
            current_y = 0
            for img in images_to_combine:
                combined_image[current_y:current_y + img.shape[0], :] = img
                current_y += img.shape[0]

            return combined_image

        except Exception as e:
            ColorPrint.red(f"[Visualization] Error creating visualization: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _save_layout_visualization(
        self,
        layout: List[List[str]],
        empty_count: int,
        item_1slot_count: int,
        item_2slot_count: int,
        color_analysis: Dict = None
    ) -> None:
        """Create and save bag_layout_*.png; uses _build_layout_visualization_image. No-op when FLOW_IMAGES_IN_MEMORY_ONLY."""
        if FLOW_IMAGES_IN_MEMORY_ONLY:
            return
        from datetime import datetime
        ColorPrint.blue("[Visualization] Creating bag layout visualization...")
        combined = self._build_layout_visualization_image(
            layout, empty_count, item_1slot_count, item_2slot_count, color_analysis
        )
        if combined is None:
            return
        output_dir = Path.home() / ".core_node" / "pytools" / "tmp"
        output_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = output_dir / f"bag_layout_{timestamp}.png"
        cv2.imwrite(str(output_path), combined)
        ColorPrint.green(f"[Visualization] Saved bag layout visualization: {output_path}")

    def _draw_pie_chart_on_image(
        self,
        image: np.ndarray,
        center: Tuple[int, int],
        radius: int,
        percentages: Dict[str, float],
        color_map: Dict[str, Tuple[int, int, int]]
    ) -> None:
        """
        Draw a pie chart on an image

        Args:
            image: Image to draw on
            center: Center point (x, y)
            radius: Radius in pixels
            percentages: Dictionary mapping color names to percentages
            color_map: Dictionary mapping color names to BGR colors
        """
        # Draw background circle
        cv2.circle(image, center, radius, (255, 255, 255), -1)

        # Draw pie segments
        start_angle = 0
        for color_name, percentage in percentages.items():
            if percentage <= 0:
                continue

            # Convert percentage to angle (360 degrees = 100%)
            angle = int(percentage * 3.6)

            # Get color
            color = color_map.get(color_name, (200, 200, 200))

            # Draw pie segment
            end_angle = start_angle + angle
            cv2.ellipse(
                image,
                center,
                (radius, radius),
                0,  # rotation
                start_angle,
                end_angle,
                color,
                -1  # filled
            )

            start_angle = end_angle

        # Draw border
        cv2.circle(image, center, radius, (100, 100, 100), 1)

    def print_bag_memory_state(self, bag_data: Dict) -> None:
        """
        Print bag memory state showing items and their qualities

        Args:
            bag_data: Dictionary containing 'layout' and 'items'
        """
        if not bag_data or 'items' not in bag_data:
            ColorPrint.yellow("[BagMemory] No bag data available")
            return

        ColorPrint.blue("\n" + "=" * 80)
        ColorPrint.blue("Bag Memory State")
        ColorPrint.blue("=" * 80 + "\n")

        items = bag_data['items']

        # Print each item with its quality
        for row in range(self.rows):
            for col in range(self.cols):
                item_info = items.get((row, col))
                if item_info and item_info['type'] in ['item_1slot', 'item_2slot']:
                    quality = item_info.get('quality', 'unknown')
                    item_type = item_info['type']

                    ColorPrint.green(f"Slot ({row},{col}): {item_type} - {quality}")

        ColorPrint.blue("\n" + "=" * 80 + "\n")

# Example usage
if __name__ == "__main__":
    if Image is None:
        raise RuntimeError("PIL Image not available")
    test_image_path = "test_bag.png"
    pil_img = Image.open(test_image_path)
    bag_image = np.array(pil_img)
    bag_image = cv2.cvtColor(bag_image, cv2.COLOR_RGB2BGR)
    bag_coords = {
        "top_left": (0, 0),
        "bottom_right": (bag_image.shape[1], bag_image.shape[0])
    }
    detector = get_bag_layout_detector()
    layout = detector.detect_layout(bag_image, bag_coords)


_bag_layout_detector_default: Optional[BagLayoutDetector] = None


def get_bag_layout_detector(rows: int = 6, cols: int = 10) -> BagLayoutDetector:
    """Return the global BagLayoutDetector instance for default grid (6x10). Instantiated before export."""
    global _bag_layout_detector_default
    if _bag_layout_detector_default is None:
        _bag_layout_detector_default = BagLayoutDetector(rows=rows, cols=cols)
    return _bag_layout_detector_default
