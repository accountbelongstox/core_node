#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3 Interface Manager
Manages game interface information collection
Coordinates collectors and provides unified API
"""

import os
import sys
from typing import Optional, Tuple, Dict

# Import from common_imports (unified public library imports)
from providor.common_imports import ColorPrint
from share import get_game_interface_data, BagCoordinates, UIRegion
# Import both UI region collectors
from d3utils.collectors import UIRegionCollectorOptimized, UIRegionCollectorAnchor, BagInfoCollector

class D3InterfaceManager:
    """
    D3 Interface Manager

    Manages game interface information collection through collectors

    Public Methods:
    - collect_ui_info(): Collect UI region information (optimized, window cache)
    - collect_ui_info_anchor(): Collect UI region information (anchor-based, fullscreen)
    - collect_bag_info_quik(): Collect bag information (optimized)
    - collect_bag_info_anchor(): Collect bag information (anchor-based)
    """

    def __init__(self):
        """Initialize interface manager"""
        self._ui_collector: Optional[UIRegionCollectorOptimized] = None
        self._ui_collector_anchor: Optional[UIRegionCollectorAnchor] = None
        self._bag_collector: Optional[BagInfoCollector] = None
        ColorPrint.green("[D3InterfaceManager] Initialized")

    def collect_ui_info(
        self,
        force_new_capture: bool = True,
        save_screenshot: bool = False
    ) -> Optional[UIRegion]:
        """
        Collect UI region information (Test 1)

        This method:
        1. Captures screenshot (optimized with cache)
        2. Detects UI region (window position, offset, size)
        3. Updates shared data with UI region
        4. Returns UI region

        Args:
            force_new_capture: Force capture new screenshot (default: True)
            save_screenshot: Save screenshot to disk (default: False)

        Returns:
            UIRegion or None if failed
        """
        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue("[InterfaceManager] Collecting UI Information (Test 1)")
        ColorPrint.blue("=" * 60)

        # Create collector if needed
        if self._ui_collector is None:
            self._ui_collector = UIRegionCollectorOptimized()

        # Call collector to detect UI region
        ui_region = self._ui_collector.collect(
            force_new_capture=force_new_capture,
            save_screenshot=save_screenshot
        )

        if not ui_region:
            ColorPrint.red(f"[InterfaceManager] Failed to collect UI info")
            return None
        ColorPrint.green("[InterfaceManager] UI information collected successfully")
        ColorPrint.green(f"  Position: ({ui_region.x}, {ui_region.y})")
        ColorPrint.green(f"  Size: {ui_region.width}x{ui_region.height}")
        ColorPrint.green(f"  Offset: ({ui_region.ui_offset_x}, {ui_region.ui_offset_y})")

        return ui_region

    def collect_bag_info_quik(
        self,
        force_refresh: bool = False,
        save_screenshot: bool = False,
        force_new_capture: bool = True  # Always True to refresh screen data
    ) -> Optional[BagCoordinates]:
        """
        Collect bag information using optimized detection

        Uses UIRegionCollectorOptimized for fast window cache-based detection.

        This method ALWAYS refreshes screen data first, then detects bag:
        1. Calls collect_ui_info to refresh screenshot and UI region (ALWAYS)
        2. BagInfoCollector extracts data from shared data (NO parameters needed)
        3. Detects bag border and layout
        4. Updates shared data with bag coordinates and layout
        5. Returns bag coordinates

        Args:
            force_refresh: Force re-detection even if bag data exists (default: False)
            save_screenshot: Save annotated screenshot (default: False)
            force_new_capture: Force new screenshot capture (default: True, always enabled)

        Returns:
            BagCoordinates or None if failed
        """
        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue("[InterfaceManager] Collecting Bag Information (Optimized)")
        ColorPrint.blue("=" * 60)

        # ALWAYS refresh screen data and UI region first
        ColorPrint.yellow("[InterfaceManager] Refreshing screen data and UI region...")
        ui_region = self.collect_ui_info(
            force_new_capture=True,  # Always capture new screenshot
            save_screenshot=save_screenshot
        )
        if not ui_region:
            ColorPrint.red("[InterfaceManager] Failed to collect UI region")
            return None

        # Create bag collector if needed
        if self._bag_collector is None:
            self._bag_collector = BagInfoCollector()

        # Collect bag information (same as regular method)
        # If force_new_capture is True, also force bag refresh to ensure fresh detection
        bag_coords = self._bag_collector.collect(
            force_refresh=force_refresh or force_new_capture,  # Force refresh if new capture
            save_screenshot=save_screenshot
        )

        if not bag_coords:
            ColorPrint.red("[InterfaceManager] Failed to collect bag info")
            return None

        ColorPrint.green("[InterfaceManager] Quick bag detection completed successfully")
        ColorPrint.green(f"  Top-left: {bag_coords.top_left}")
        ColorPrint.green(f"  Bottom-right: {bag_coords.bottom_right}")
        ColorPrint.green(f"  Grid: {bag_coords.rows}x{bag_coords.cols} ({bag_coords.total_slots} slots)")

        return bag_coords

    def collect_ui_info_anchor(
        self,
        force_new_capture: bool = True,
        save_screenshot: bool = False
    ) -> Optional[UIRegion]:
        """
        Collect UI region information using anchor-based detection

        Uses UIRegionCollectorAnchor for accurate anchor point matching.
        This method captures fullscreen and detects UI region using anchor templates.

        This method:
        1. Captures fullscreen screenshot
        2. Detects UI region using anchor point template matching
        3. Updates shared data with UI region and game window image
        4. Returns UI region

        Args:
            force_new_capture: Force capture new screenshot (default: True)
            save_screenshot: Save screenshot to disk (default: False)

        Returns:
            UIRegion or None if failed
        """
        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue("[InterfaceManager] Collecting UI Information (Anchor-based)")
        ColorPrint.blue("=" * 60)

        # Create anchor collector if needed
        if self._ui_collector_anchor is None:
            self._ui_collector_anchor = UIRegionCollectorAnchor()

        # Call collector to detect UI region
        ui_region = self._ui_collector_anchor.collect(
            force_new_capture=force_new_capture,
            save_screenshot=save_screenshot
        )

        if not ui_region:
            ColorPrint.red(f"[InterfaceManager] Failed to collect UI info (anchor)")
            return None

        ColorPrint.green("[InterfaceManager] UI information collected successfully (anchor)")
        ColorPrint.green(f"  Position: ({ui_region.x}, {ui_region.y})")
        ColorPrint.green(f"  Size: {ui_region.width}x{ui_region.height}")
        ColorPrint.green(f"  Offset: ({ui_region.ui_offset_x}, {ui_region.ui_offset_y})")
        ColorPrint.green(f"  Fullscreen: {ui_region.is_fullscreen}")

        return ui_region

    def collect_bag_info_anchor(
        self,
        force_refresh: bool = False,
        save_screenshot: bool = False,
        force_new_capture: bool = True
    ) -> Optional[BagCoordinates]:
        """
        Collect bag information using anchor-based detection

        Uses UIRegionCollectorAnchor for accurate fullscreen capture and anchor matching.

        This method ALWAYS refreshes screen data first, then detects bag:
        1. Calls collect_ui_info_anchor to refresh screenshot and UI region (ALWAYS)
        2. BagInfoCollector extracts data from shared data (NO parameters needed)
        3. Detects bag border and layout
        4. Updates shared data with bag coordinates and layout
        5. Returns bag coordinates

        Args:
            force_refresh: Force re-detection even if bag data exists (default: False)
            save_screenshot: Save annotated screenshot (default: False)
            force_new_capture: Force new screenshot capture (default: True, always enabled)

        Returns:
            BagCoordinates or None if failed
        """
        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue("[InterfaceManager] Collecting Bag Information (Anchor-based)")
        ColorPrint.blue("=" * 60)

        # ALWAYS refresh screen data and UI region first using anchor collector
        ColorPrint.yellow("[InterfaceManager] Refreshing screen data and UI region (anchor)...")
        ui_region = self.collect_ui_info_anchor(
            force_new_capture=True,  # Always capture new screenshot
            save_screenshot=save_screenshot
        )
        if not ui_region:
            ColorPrint.red("[InterfaceManager] Failed to collect UI region (anchor)")
            return None

        # Create bag collector if needed
        if self._bag_collector is None:
            self._bag_collector = BagInfoCollector()

        # Collect bag information from shared data (NO parameters needed for data)
        # BagInfoCollector will extract game_window_image from shared data
        ColorPrint.blue("[InterfaceManager] Detecting bag from shared data...")
        bag_coords = self._bag_collector.collect(
            force_refresh=force_refresh or force_new_capture,  # Force refresh if new capture
            save_screenshot=save_screenshot
        )

        if not bag_coords:
            ColorPrint.red("[InterfaceManager] Failed to collect bag info")
            return None

        ColorPrint.green("[InterfaceManager] Bag detection completed successfully (anchor)")
        ColorPrint.green(f"  Top-left: {bag_coords.top_left}")
        ColorPrint.green(f"  Bottom-right: {bag_coords.bottom_right}")
        ColorPrint.green(f"  Grid: {bag_coords.rows}x{bag_coords.cols} ({bag_coords.total_slots} slots)")

        return bag_coords

    def get_window_offset(self) -> Tuple[int, int]:
        """
        Get combined window offset from shared data

        This includes:
        - UI region offset (from UI collector)
        - Bag offset (if bag is detected)

        Returns:
            Tuple (total_offset_x, total_offset_y)
        """
        shared_data = get_game_interface_data()

        offset_x = 0
        offset_y = 0

        # Add UI offset
        if shared_data.ui_region:
            offset_x += shared_data.ui_region.ui_offset_x
            offset_y += shared_data.ui_region.ui_offset_y

        # Bag offset is already included in bag coordinates
        # No additional offset needed

        return (offset_x, offset_y)

    def print_summary(self) -> None:
        """Print summary of shared data"""
        shared_data = get_game_interface_data()
        summary = shared_data.get_summary()

        ColorPrint.blue("\n" + "=" * 60)
        ColorPrint.blue("[D3 Interface Manager Summary]")
        ColorPrint.blue("=" * 60)

        ColorPrint.blue(f"Timestamp: {summary['timestamp']}")

        if summary['error']:
            ColorPrint.red(f"Error: {summary['error']}")
        else:
            ColorPrint.green("Error: None")

        # UI Region
        if summary['has_ui_region']:
            ui = shared_data.ui_region
            ColorPrint.green(f"\nUI Region: Available")
            ColorPrint.green(f"  Position: ({ui.x}, {ui.y})")
            ColorPrint.green(f"  Size: {ui.width}x{ui.height}")
            ColorPrint.green(f"  Offset: ({ui.ui_offset_x}, {ui.ui_offset_y})")
            ColorPrint.green(f"  Fullscreen: {ui.is_fullscreen}")
            ColorPrint.green(f"  Source: {ui.source}")
        else:
            ColorPrint.yellow("\nUI Region: Not available")

        # Bag Coordinates
        if summary['has_bag_coordinates']:
            bag = shared_data.bag_coordinates
            ColorPrint.green(f"\nBag Coordinates: Available")
            ColorPrint.green(f"  Top-left: {bag.top_left}")
            ColorPrint.green(f"  Bottom-right: {bag.bottom_right}")
            ColorPrint.green(f"  Size: {bag.width}x{bag.height}")
            ColorPrint.green(f"  Grid: {bag.rows}x{bag.cols} ({bag.total_slots} slots)")
        else:
            ColorPrint.yellow("\nBag Coordinates: Not available")

        # Bag Layout
        if summary['has_bag_layout']:
            ColorPrint.green("\nBag Layout: Available")
        else:
            ColorPrint.gray("\nBag Layout: Not available")

        # Other info - Button coordinates now use fixed coordinate system
        # Note: Button coordinates are calculated via get_scaled_*() methods, not stored in shared_data
        if shared_data.interface_type == "kanai_cube":
            from share.game_interface_data import get_scaled_conversion_button, get_scaled_kanai_put_material_button
            ColorPrint.green(f"\nConversion Button (coordinate system): {get_scaled_conversion_button()}")
            ColorPrint.green(f"Put Material Button (coordinate system): {get_scaled_kanai_put_material_button()}")

        if summary['functional_interface']:
            ColorPrint.blue(f"Functional Interface: {summary['functional_interface']}")

        ColorPrint.blue("=" * 60)

# Example usage
if __name__ == "__main__":
    manager = D3InterfaceManager()

    # Collect UI info
    ui_region = manager.collect_ui_info()

    # Collect bag info (optimized)
    if ui_region:
        bag_coords = manager.collect_bag_info_quik()

    # Print summary
    manager.print_summary()
