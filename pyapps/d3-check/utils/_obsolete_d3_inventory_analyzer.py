"""
Diablo 3 Inventory Analyzer
Fully implemented based on d3keyhelper.ahk logic
"""

import cv2
import numpy as np
import json
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class ItemQuality(Enum):
    """Item quality enumeration"""
    EMPTY = 0  # Empty slot
    NORMAL_LEGENDARY = 2  # Normal legendary (orange)
    ANCIENT = 3  # Ancient legendary
    ETHEREAL = 4  # Ethereal item
    PRIMAL = 5  # Primal ancient
    RARE = 6  # Rare (yellow)
    MAGIC = 7  # Magic (blue)
    WHITE = 8  # White
    OCCUPIED = 9  # Slot occupied by large item


@dataclass
class ItemInfo:
    """Item information"""
    slot_id: int  # Slot ID (1-60)
    quality: ItemQuality  # Item quality
    slots: List[int]  # List of occupied slots
    is_large: bool  # Whether it's a 2-slot large item
    border_color: Tuple[int, int, int]  # Border color RGB


class D3InventoryAnalyzer:
    """
    Diablo 3 Inventory Analyzer
    Implemented following AHK code logic
    """

    # Static constants: based on 1440p (2560x1440) resolution standard coordinates
    # AHK code uses 3440x1440 (21:9 ultrawide) as reference resolution
    _SPACE_SIZE_INNER_W = 64  # Inner width of slot
    _SPACE_SIZE_INNER_H = 63  # Inner height of slot
    _SPACE_SIZE_W = 67  # Total width of slot (with spacing)
    _SPACE_SIZE_H = 66  # Total height of slot (with spacing)

    # Bag slot X coordinates (from right side, 10 columns)
    # Original coordinates based on 3440 width, need to convert to right-aligned
    _SPACE_BAG_X = [2753, 2820, 2887, 2954, 3021, 3089, 3156, 3223, 3290, 3357]
    _SPACE_BAG_Y = [747, 813, 880, 946, 1013, 1079]  # 6 rows

    # Detection point positions (relative to slot inner area)
    # AHK: static _e:=[[0.65625,0.71429], [0.375,0.36508], [0.725,0.251]]
    _EMPTY_CHECK_POINTS = [
        (0.65625, 0.71429),
        (0.375, 0.36508),
        (0.725, 0.251)
    ]

    # Bottom slot check point (for detecting large items)
    _BOTTOM_CHECK_POINT = (0.08, 0.7)  # AHK: [md[3]+_spaceSizeInnerW*0.08, md[4]+_spaceSizeInnerH*0.7]

    # Border check point (for quality detection, offset from top-left corner)
    _BORDER_CHECK_OFFSET = (-10, 0)  # AHK: Round(m[3]-1-10*D3H/1440), m[2]
    _BORDER_CHECK_WIDTH = 3  # Get max value of 3 pixels

    def __init__(self, reference_height: int = 1440):
        """
        Initialize analyzer

        Args:
            reference_height: Reference resolution height, default 1440 (for coordinate scaling)
        """
        self.reference_height = reference_height
        self.image = None
        self.img_height = 0
        self.img_width = 0
        self.inventory = {}  # Store all slot information
        self.bottom_colors = {}  # Store initial bottom color of each slot

    def load_image(self, image_path: str):
        """Load image"""
        self.image = cv2.imread(image_path)
        if self.image is None:
            raise ValueError(f"Failed to load image: {image_path}")
        self.img_height, self.img_width = self.image.shape[:2]

    def _scale_coord(self, coord: int) -> int:
        """Scale coordinate based on image height"""
        return round(coord * self.img_height / self.reference_height)

    def _get_inventory_space_xy(self, slot_id: int) -> Tuple[int, int, int, int]:
        """
        Get bag slot coordinates
        Fully following AHK's getInventorySpaceXY function logic

        Args:
            slot_id: Slot ID (1-60)

        Returns:
            (center_x, center_y, left_top_x, left_top_y)
        """
        # Calculate column (1-10)
        target_column = 10 if slot_id % 10 == 0 else slot_id % 10
        # Calculate row (1-6)
        target_row = (slot_id - 1) // 10 + 1

        # AHK logic: calculate from right side
        # Return [Round(D3W-((3440-_spaceBagX[targetColumn]-_spaceSizeInnerW/2)*D3H/1440))
        bag_x = self._SPACE_BAG_X[target_column - 1]
        bag_y = self._SPACE_BAG_Y[target_row - 1]

        # Convert to current image coordinates (right-aligned)
        scaled_offset = self._scale_coord(3440 - bag_x - self._SPACE_SIZE_INNER_W / 2)
        center_x = self.img_width - scaled_offset
        center_y = self._scale_coord(bag_y + self._SPACE_SIZE_INNER_H / 2)

        left_top_x = self.img_width - self._scale_coord(3440 - bag_x)
        left_top_y = self._scale_coord(bag_y)

        return (int(center_x), int(center_y), int(left_top_x), int(left_top_y))

    def _get_pixel_rgb(self, x: int, y: int) -> Tuple[int, int, int]:
        """Get pixel RGB value (convert BGR to RGB)"""
        if 0 <= x < self.img_width and 0 <= y < self.img_height:
            b, g, r = self.image[y, x]
            return (int(r), int(g), int(b))
        return (0, 0, 0)

    def _get_pixels_rgb_max(self, x: int, y: int, width: int, height: int) -> Tuple[int, int, int]:
        """
        Get maximum RGB value in region
        AHK: getPixelsRGB(..., "Max", ...)
        """
        if x < 0 or y < 0 or x + width > self.img_width or y + height > self.img_height:
            return (0, 0, 0)

        region = self.image[y:y+height, x:x+width]
        max_b = int(np.max(region[:, :, 0]))
        max_g = int(np.max(region[:, :, 1]))
        max_r = int(np.max(region[:, :, 2]))
        return (max_r, max_g, max_b)

    def _is_slot_empty(self, slot_id: int) -> bool:
        """
        Check if slot is empty
        AHK: logic in scanInventorySpaceGDIP
        Check if 3 specific points are all dark color (bag background color)
        """
        _, _, left_top_x, left_top_y = self._get_inventory_space_xy(slot_id)

        # Check 3 specific points
        for px, py in self._EMPTY_CHECK_POINTS:
            check_x = left_top_x + self._scale_coord(self._SPACE_SIZE_INNER_W * px)
            check_y = left_top_y + self._scale_coord(self._SPACE_SIZE_INNER_H * py)
            r, g, b = self._get_pixel_rgb(check_x, check_y)

            # AHK: if !(c[1]<22 and c[2]<20 and c[3]<15 and c[1]>c[3] and c[2]>c[3])
            # If any point is not dark color, there's an item
            if not (r < 22 and g < 20 and b < 15 and r > b and g > b):
                return False

        return True

    def _get_bottom_color(self, slot_id: int) -> Tuple[int, int, int]:
        """
        Get bottom color of slot (for detecting large items)
        AHK: cInventorySpace[A_Index]:=splitRGB(...)
        """
        _, _, left_top_x, left_top_y = self._get_inventory_space_xy(slot_id)
        check_x = left_top_x + self._scale_coord(self._SPACE_SIZE_INNER_W * self._BOTTOM_CHECK_POINT[0])
        check_y = left_top_y + self._scale_coord(self._SPACE_SIZE_INNER_H * self._BOTTOM_CHECK_POINT[1])
        return self._get_pixel_rgb(check_x, check_y)

    def _identify_item_quality(self, slot_id: int) -> Tuple[ItemQuality, Tuple[int, int, int]]:
        """
        Identify item quality
        AHK: smart salvage logic in oneButtonSalvageHelper (line 1394-1412)

        Returns:
            (quality, border RGB color)
        """
        center_x, center_y, left_top_x, left_top_y = self._get_inventory_space_xy(slot_id)

        # Get item border color (left border upper area, get max of 3 pixels)
        border_x = left_top_x + self._scale_coord(self._BORDER_CHECK_OFFSET[0])
        border_y = center_y
        border_width = self._scale_coord(self._BORDER_CHECK_WIDTH)

        # AHK: c:=getPixelsRGB(Round(m[3]-1-10*D3H/1440), m[2], 3, 1, "Max", False)
        r, g, b = self._get_pixels_rgb_max(border_x, border_y, border_width, 1)

        # Quality determination logic (fully following AHK code)
        # if ((c[1]>=70 or c[3]<=20) and Max(Abs(c[1]-c[2]), Abs(c[1]-c[3]), Abs(c[3]-c[2]))>20 and (c[1]+c[2]+c[3]<410))
        max_diff = max(abs(r - g), abs(r - b), abs(b - g))

        if (r >= 70 or b <= 20) and max_diff > 20 and (r + g + b < 410):
            # Primal or Ancient
            # q:=(c[2]<35) ? 5:3
            if g < 35:
                return (ItemQuality.PRIMAL, (r, g, b))
            else:
                return (ItemQuality.ANCIENT, (r, g, b))
        elif b > 100 and b > g and g > r:
            # Ethereal item (blue dominant)
            # else if (c[3]>100 and c[3]>c[2] and c[2]>c[1])
            return (ItemQuality.ETHEREAL, (r, g, b))
        else:
            # Normal legendary
            return (ItemQuality.NORMAL_LEGENDARY, (r, g, b))

    def _is_large_item(self, slot_id: int) -> bool:
        """
        Check if it's a large item (occupies 2 slots)
        AHK: line 1414-1433
        Determine by comparing color change of bottom slot
        """
        if slot_id > 50:  # Last row has no bottom slot
            return False

        bottom_slot_id = slot_id + 10

        # Get previously saved color of bottom slot
        if bottom_slot_id not in self.bottom_colors:
            return False

        old_color = self.bottom_colors[bottom_slot_id]

        # Get current color of bottom slot
        current_color = self._get_bottom_color(bottom_slot_id)

        # AHK: if !(c_b[1]=c_a[1] and c_b[2]=c_a[2] and c_b[3]=c_a[3])
        # If color changed, current item covers the bottom slot
        if old_color != current_color:
            return True

        return False

    def scan_inventory(self) -> Dict[int, ItemInfo]:
        """
        Scan all 60 slots
        Fully following AHK's scanInventorySpaceGDIP and oneButtonSalvageHelper logic

        Returns:
            Dictionary, key is slot_id, value is ItemInfo
        """
        if self.image is None:
            raise ValueError("Please load image first using load_image()")

        self.inventory = {}
        self.bottom_colors = {}

        # First scan: save bottom color of all slots
        for i in range(1, 61):
            self.bottom_colors[i] = self._get_bottom_color(i)

        # Second scan: identify items
        occupied_slots = set()  # Slots occupied by large items

        for i in range(1, 61):
            if i in occupied_slots:
                # This slot is occupied by large item, skip
                continue

            # Check if slot is empty
            if self._is_slot_empty(i):
                self.inventory[i] = ItemInfo(
                    slot_id=i,
                    quality=ItemQuality.EMPTY,
                    slots=[i],
                    is_large=False,
                    border_color=(0, 0, 0)
                )
                continue

            # Slot has item, identify quality
            quality, border_color = self._identify_item_quality(i)

            # Check if it's a large item
            is_large = self._is_large_item(i)

            if is_large and i <= 50:
                # Mark bottom slot as occupied
                bottom_slot = i + 10
                occupied_slots.add(bottom_slot)
                slots = [i, bottom_slot]
            else:
                slots = [i]

            self.inventory[i] = ItemInfo(
                slot_id=i,
                quality=quality,
                slots=slots,
                is_large=is_large,
                border_color=border_color
            )

        # Mark occupied slots
        for slot_id in occupied_slots:
            self.inventory[slot_id] = ItemInfo(
                slot_id=slot_id,
                quality=ItemQuality.OCCUPIED,
                slots=[slot_id],
                is_large=False,
                border_color=(0, 0, 0)
            )

        return self.inventory

    def visualize_result(self, output_path: str):
        """
        Visualize recognition results
        Annotate item information on image
        """
        if self.image is None or not self.inventory:
            raise ValueError("Please scan inventory first")

        result_img = self.image.copy()

        # Quality corresponding colors (BGR format for OpenCV)
        quality_colors = {
            ItemQuality.EMPTY: (50, 50, 50),  # Gray
            ItemQuality.NORMAL_LEGENDARY: (0, 165, 255),  # Orange
            ItemQuality.ANCIENT: (0, 215, 255),  # Bright orange
            ItemQuality.ETHEREAL: (255, 180, 0),  # Cyan
            ItemQuality.PRIMAL: (0, 255, 255),  # Yellow
            ItemQuality.RARE: (0, 255, 255),  # Yellow
            ItemQuality.MAGIC: (255, 0, 0),  # Blue
            ItemQuality.WHITE: (255, 255, 255),  # White
            ItemQuality.OCCUPIED: (128, 128, 128)  # Dark gray
        }

        quality_names = {
            ItemQuality.EMPTY: "Empty",
            ItemQuality.NORMAL_LEGENDARY: "Legendary",
            ItemQuality.ANCIENT: "Ancient",
            ItemQuality.ETHEREAL: "Ethereal",
            ItemQuality.PRIMAL: "Primal",
            ItemQuality.RARE: "Rare",
            ItemQuality.MAGIC: "Magic",
            ItemQuality.WHITE: "White",
            ItemQuality.OCCUPIED: "Occupied"
        }

        for slot_id, item in self.inventory.items():
            if item.quality == ItemQuality.OCCUPIED:
                continue  # Skip occupied slots

            center_x, center_y, left_top_x, left_top_y = self._get_inventory_space_xy(slot_id)

            # Draw slot border
            slot_w = self._scale_coord(self._SPACE_SIZE_INNER_W)
            slot_h = self._scale_coord(self._SPACE_SIZE_INNER_H)

            if item.quality != ItemQuality.EMPTY:
                color = quality_colors[item.quality]

                # Draw rectangle
                if item.is_large:
                    # Large item draws 2-slot box
                    cv2.rectangle(result_img, (left_top_x, left_top_y),
                                  (left_top_x + slot_w, left_top_y + slot_h * 2 + self._scale_coord(self._SPACE_SIZE_H - self._SPACE_SIZE_INNER_H)),
                                  color, 2)
                else:
                    cv2.rectangle(result_img, (left_top_x, left_top_y),
                                  (left_top_x + slot_w, left_top_y + slot_h), color, 2)

                # Add text annotation
                text = f"{slot_id}:{quality_names[item.quality]}"
                if item.is_large:
                    text += " (2x)"

                # Adjust text position to avoid going out of image bounds
                text_y = max(left_top_y - 5, 15)
                cv2.putText(result_img, text, (left_top_x, text_y),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

                # Display RGB values
                rgb_text = f"RGB:{item.border_color}"
                cv2.putText(result_img, rgb_text, (left_top_x, text_y + 15),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.3, color, 1)

        cv2.imwrite(output_path, result_img)
        print(f"Visualization result saved to: {output_path}")

    def export_json(self, output_path: str):
        """Export recognition results in JSON format"""
        if not self.inventory:
            raise ValueError("Please scan inventory first")

        result = {
            "image_size": {"width": self.img_width, "height": self.img_height},
            "total_items": len([item for item in self.inventory.values()
                                if item.quality not in [ItemQuality.EMPTY, ItemQuality.OCCUPIED]]),
            "items": []
        }

        for slot_id, item in self.inventory.items():
            if item.quality == ItemQuality.OCCUPIED:
                continue

            item_dict = {
                "slot_id": item.slot_id,
                "quality": item.quality.name,
                "quality_value": item.quality.value,
                "slots": item.slots,
                "is_large": item.is_large,
                "border_color": {
                    "r": item.border_color[0],
                    "g": item.border_color[1],
                    "b": item.border_color[2]
                }
            }
            result["items"].append(item_dict)

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        print(f"JSON result saved to: {output_path}")


def main():
    """Example usage"""
    # Create analyzer
    analyzer = D3InventoryAnalyzer(reference_height=1440)

    # Load image
    image_path = "inventory_screenshot.png"
    analyzer.load_image(image_path)

    # Scan inventory
    print("Scanning inventory...")
    inventory = analyzer.scan_inventory()

    # Statistics
    item_count = len([item for item in inventory.values()
                      if item.quality not in [ItemQuality.EMPTY, ItemQuality.OCCUPIED]])
    print(f"Found {item_count} items")

    # Output visualization result
    analyzer.visualize_result("result_annotated.png")

    # Export JSON
    analyzer.export_json("result.json")

    print("\nItem details:")
    for slot_id, item in inventory.items():
        if item.quality not in [ItemQuality.EMPTY, ItemQuality.OCCUPIED]:
            print(f"Slot {item.slots}: {item.quality.name} "
                  f"{'(Large item)' if item.is_large else ''} "
                  f"RGB: {item.border_color}")


if __name__ == "__main__":
    main()