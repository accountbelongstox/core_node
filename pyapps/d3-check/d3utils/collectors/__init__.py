#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Information Collectors Package
Collectors for gathering game interface information

Available Collectors:
- UIRegionCollectorOptimized: Fast detection using window cache (default)
- UIRegionCollectorAnchor: Template matching on anchor points
- UIRegionCollectorUltralytics: AI-based detection using YOLO
- GridScreenshotCollector: Grid-based screenshot capture for pathfinding
- BagInfoCollector: Bag coordinates and layout detection
"""

# UI Region Collectors (three versions)
from .ui_region_collector_optimized import UIRegionCollectorOptimized
from .ui_region_collector_anchor import UIRegionCollectorAnchor
from .ui_region_collector_ultralytics import UIRegionCollectorUltralytics

# Grid Screenshot Collector
from .grid_screenshot_collector import GridScreenshotCollector

# Bag collector
from .bag_info_collector import BagInfoCollector

__all__ = [
    # UI Region Collectors
    'UIRegionCollectorOptimized',
    'UIRegionCollectorAnchor',
    'UIRegionCollectorUltralytics',

    # Grid Screenshot Collector
    'GridScreenshotCollector',

    # Bag Collector
    'BagInfoCollector'
]

