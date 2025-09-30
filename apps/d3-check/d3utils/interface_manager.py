#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3 Interface Manager
Manages Diablo III game interface properties including bag coordinates,
button positions, and functional interface states
"""

import os
import sys
from typing import Optional, Tuple, Dict, Union
from pathlib import Path

# Add ncore path
ncore_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "ncore")
sys.path.insert(0, ncore_path)

from pytools.pyfoundations.color_print import ColorPrint
from d3utils.interface_property_detector import InterfacePropertyDetector


class D3InterfaceManager:
    """
    Manages Diablo III game interface properties

    Properties managed:
    - Bag coordinates (60-slot inventory grid)
    - Material placement button coordinates
    - Conversion button coordinates
    - Conversion button clickable state
    - Current functional interface type
    - Functional interface property (reforge/upgrade)
    """

    # Functional interface types
    FUNC_TYPE_NONE = None
    FUNC_TYPE_REFORGE = "reforge"  # 重铸 (Kanai's Cube - Reforge)
    FUNC_TYPE_UPGRADE = "upgrade"  # 升级黄装 (Kanai's Cube - Upgrade Rare)

    def __init__(self):
        """Initialize interface manager with empty properties"""
        # Bag coordinates
        self._bag_top_left: Optional[Tuple[int, int]] = None
        self._bag_bottom_right: Optional[Tuple[int, int]] = None
        self._bag_grid_rows: int = 6
        self._bag_grid_cols: int = 10
        self._bag_total_slots: int = 60

        # Button coordinates
        self._put_material_button: Optional[Tuple[int, int]] = None
        self._conversion_button: Optional[Tuple[int, int]] = None

        # Interface states (refreshed every time)
        self._conversion_clickable: Optional[bool] = None
        self._functional_interface: Optional[str] = None

        # Detector instance
        self._detector: Optional[InterfacePropertyDetector] = None

        ColorPrint.green("[D3InterfaceManager] Initialized")

    # === Initialization Method ===

    def initialize(
        self,
        screenshot_path: Optional[Union[str, Path]] = None,
        force_refresh: bool = False
    ) -> bool:
        """
        Initialize or refresh interface properties from screenshot

        This method:
        1. Captures a new screenshot (if screenshot_path not provided)
        2. Detects bag coordinates (if not already set or force_refresh=True)
        3. Detects button positions (if not already set or force_refresh=True)
        4. Always refreshes: conversion clickable state and functional interface type

        Args:
            screenshot_path: Optional path to screenshot (if None, captures new screenshot)
            force_refresh: Force re-detection of all properties (default: False)

        Returns:
            True if initialization successful, False otherwise
        """
        ColorPrint.blue("\n[Initialize] Starting interface detection...")

        # Create detector if needed
        if self._detector is None:
            self._detector = InterfacePropertyDetector()

        # Auto-detect template directory
        template_dir = Path(__file__).parent.parent / "images"

        # Perform detection (will auto-capture if screenshot_path is None)
        try:
            matches = self._detector.initialize(
                screenshot_path=screenshot_path,
                template_dir=template_dir
            )

            if not matches:
                ColorPrint.yellow("[Initialize] No templates detected")
                return False

            # 1. Update bag coordinates (skip if already set and not force_refresh)
            if force_refresh or not self.is_bag_initialized():
                bag_coords = self._detector.get_bag_coordinates()
                if bag_coords:
                    self.set_bag_coordinates(
                        bag_coords["top_left"],
                        bag_coords["bottom_right"]
                    )
                else:
                    ColorPrint.yellow("[Initialize] Bag coordinates not detected")

            # 2. Update button positions (skip if already set and not force_refresh)
            if force_refresh or not self.is_put_material_button_initialized():
                material_btn = self._detector.get_put_material_button()
                if material_btn:
                    self.set_put_material_button(material_btn)

            if force_refresh or not self.is_conversion_button_initialized():
                conversion_btn = self._detector.get_conversion_button()
                if conversion_btn:
                    self.set_conversion_button(conversion_btn)

            # 3. Always refresh: conversion clickable state
            conversion_clickable = self._detector.get_conversion_clickable()
            if conversion_clickable is not None:
                self.set_conversion_clickable(conversion_clickable)

            # 4. Always refresh: functional interface type
            func_interface = self._detector.get_functional_interface()
            self.set_functional_interface(func_interface)

            ColorPrint.green("[Initialize] Interface detection complete")
            return True

        except Exception as e:
            ColorPrint.red(f"[Initialize] Error during detection: {e}")
            import traceback
            traceback.print_exc()
            return False

    # === Bag Property Methods ===

    def get_bag_coordinates(self) -> Optional[Dict]:
        """
        Get bag coordinates

        Returns:
            Dictionary with bag coordinates or None if not set:
            {
                "top_left": (x, y),
                "bottom_right": (x, y),
                "width": int,
                "height": int,
                "rows": int,
                "cols": int,
                "total_slots": int
            }
        """
        if self._bag_top_left is None or self._bag_bottom_right is None:
            return None

        return {
            "top_left": self._bag_top_left,
            "bottom_right": self._bag_bottom_right,
            "width": self._bag_bottom_right[0] - self._bag_top_left[0],
            "height": self._bag_bottom_right[1] - self._bag_top_left[1],
            "rows": self._bag_grid_rows,
            "cols": self._bag_grid_cols,
            "total_slots": self._bag_total_slots
        }

    def set_bag_coordinates(
        self,
        top_left: Tuple[int, int],
        bottom_right: Tuple[int, int]
    ) -> None:
        """
        Set bag coordinates

        Args:
            top_left: Top-left corner (x, y)
            bottom_right: Bottom-right corner (x, y)
        """
        self._bag_top_left = top_left
        self._bag_bottom_right = bottom_right
        ColorPrint.green(f"[Bag] Set coordinates: {top_left} -> {bottom_right}")

    def is_bag_initialized(self) -> bool:
        """Check if bag coordinates are set"""
        return self._bag_top_left is not None and self._bag_bottom_right is not None

    # === Button Property Methods ===

    def get_put_material_button(self) -> Optional[Tuple[int, int]]:
        """
        Get material placement button coordinates

        Returns:
            Button center coordinates (x, y) or None if not set
        """
        return self._put_material_button

    def set_put_material_button(self, center: Tuple[int, int]) -> None:
        """
        Set material placement button coordinates

        Args:
            center: Button center coordinates (x, y)
        """
        self._put_material_button = center
        ColorPrint.green(f"[Button] Set material placement button: {center}")

    def is_put_material_button_initialized(self) -> bool:
        """Check if material placement button is set"""
        return self._put_material_button is not None

    def get_conversion_button(self) -> Optional[Tuple[int, int]]:
        """
        Get conversion button coordinates

        Returns:
            Button center coordinates (x, y) or None if not set
        """
        return self._conversion_button

    def set_conversion_button(self, center: Tuple[int, int]) -> None:
        """
        Set conversion button coordinates

        Args:
            center: Button center coordinates (x, y)
        """
        self._conversion_button = center
        ColorPrint.green(f"[Button] Set conversion button: {center}")

    def is_conversion_button_initialized(self) -> bool:
        """Check if conversion button is set"""
        return self._conversion_button is not None

    # === Interface State Methods (Always Refreshed) ===

    def get_conversion_clickable(self) -> Optional[bool]:
        """
        Get conversion button clickable state

        Returns:
            True if clickable, False if not, None if unknown
        """
        return self._conversion_clickable

    def set_conversion_clickable(self, clickable: bool) -> None:
        """
        Set conversion button clickable state

        Args:
            clickable: True if button is clickable
        """
        self._conversion_clickable = clickable
        ColorPrint.blue(f"[State] Conversion clickable: {clickable}")

    def get_functional_interface(self) -> Optional[str]:
        """
        Get current functional interface type

        Returns:
            Interface type (FUNC_TYPE_REFORGE, FUNC_TYPE_UPGRADE) or None
        """
        return self._functional_interface

    def get_bag_layout(self) -> Optional[Dict]:
        """
        Get bag layout data including item information

        Returns:
            Dictionary containing:
            - 'layout': 2D array of slot usage
            - 'items': Dictionary mapping (row, col) to item info with quality
            Returns None if bag layout not detected
        """
        if self._detector and hasattr(self._detector, 'bag_layout'):
            return self._detector.bag_layout
        return None

    def get_window_offset(self) -> tuple:
        """
        Get window offset for converting screenshot coordinates to screen coordinates

        Returns:
            Tuple (offset_x, offset_y) representing window position on screen
        """
        if self._detector:
            return self._detector.get_window_offset()
        return (0, 0)

    def set_functional_interface(self, func_type: Optional[str]) -> None:
        """
        Set functional interface type

        Args:
            func_type: Interface type (FUNC_TYPE_REFORGE, FUNC_TYPE_UPGRADE, or None)
        """
        self._functional_interface = func_type
        ColorPrint.blue(f"[State] Functional interface: {func_type}")

    # === Validation Methods ===

    def needs_initialization(self) -> bool:
        """
        Check if initialization is needed

        Returns:
            True if any persistent property is missing
        """
        needs_init = (
            not self.is_bag_initialized() or
            not self.is_put_material_button_initialized() or
            not self.is_conversion_button_initialized()
        )

        if needs_init:
            missing = []
            if not self.is_bag_initialized():
                missing.append("bag_coordinates")
            if not self.is_put_material_button_initialized():
                missing.append("put_material_button")
            if not self.is_conversion_button_initialized():
                missing.append("conversion_button")

            ColorPrint.yellow(f"[Init Required] Missing properties: {', '.join(missing)}")

        return needs_init

    def get_summary(self) -> Dict:
        """
        Get summary of all interface properties

        Returns:
            Dictionary with all current properties
        """
        return {
            "bag_coordinates": self.get_bag_coordinates(),
            "put_material_button": self.get_put_material_button(),
            "conversion_button": self.get_conversion_button(),
            "conversion_clickable": self.get_conversion_clickable(),
            "functional_interface": self.get_functional_interface(),
            "needs_initialization": self.needs_initialization()
        }

    def print_summary(self) -> None:
        """Print summary of all interface properties"""
        ColorPrint.blue("\n[D3 Interface Manager Summary]")
        ColorPrint.blue("=" * 50)

        bag = self.get_bag_coordinates()
        if bag:
            ColorPrint.green(f"Bag: {bag['top_left']} -> {bag['bottom_right']} ({bag['rows']}x{bag['cols']})")
        else:
            ColorPrint.yellow("Bag: Not initialized")

        put_btn = self.get_put_material_button()
        if put_btn:
            ColorPrint.green(f"Material Button: {put_btn}")
        else:
            ColorPrint.yellow("Material Button: Not initialized")

        conv_btn = self.get_conversion_button()
        if conv_btn:
            ColorPrint.green(f"Conversion Button: {conv_btn}")
        else:
            ColorPrint.yellow("Conversion Button: Not initialized")

        conv_click = self.get_conversion_clickable()
        if conv_click is not None:
            ColorPrint.blue(f"Conversion Clickable: {conv_click}")
        else:
            ColorPrint.gray("Conversion Clickable: Unknown")

        func_int = self.get_functional_interface()
        if func_int:
            ColorPrint.blue(f"Functional Interface: {func_int}")
        else:
            ColorPrint.gray("Functional Interface: None")

        ColorPrint.blue("=" * 50)


# Example usage
if __name__ == "__main__":
    manager = D3InterfaceManager()

    # Check if initialization needed
    if manager.needs_initialization():
        print("Initialization required!")

    # Set bag coordinates
    manager.set_bag_coordinates((100, 200), (500, 600))

    # Set button coordinates
    manager.set_put_material_button((300, 400))
    manager.set_conversion_button((400, 500))

    # Set interface states
    manager.set_conversion_clickable(True)
    manager.set_functional_interface(D3InterfaceManager.FUNC_TYPE_REFORGE)

    # Print summary
    manager.print_summary()
