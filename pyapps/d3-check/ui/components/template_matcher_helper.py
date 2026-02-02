#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Template Matcher Helper Component
Handles template image matching and visualization on screenshots
"""

import tkinter as tk
from typing import Optional, List, Dict, Tuple
from pathlib import Path
import sys
import copy

from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageDraw

Image = get_third_package_PIL_Image()
ImageDraw = get_third_package_PIL_ImageDraw()

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from providor.common_imports import ColorPrint, ImageMatcher
from providor.providor_index import (
    D3_TEMPLATE_CONFIGS,
    D4_TEMPLATE_CONFIGS,
    BATTLENET_TEMPLATE_CONFIGS,
    # Client type constants
    CLIENT_TYPE_BATTLENET,
    CLIENT_TYPE_D3_GAME,
    CLIENT_TYPE_D4_GAME
)


class TemplateMatcherHelper:
    """
    Helper class for template matching visualization
    Manages template selection, matching, and drawing
    """

    def __init__(self):
        """Initialize template matcher helper"""
        self.original_image: Optional[Image.Image] = None
        self.display_image: Optional[Image.Image] = None
        self.backup_image: Optional[Image.Image] = None
        self.matches: List[Dict] = []
        self.selected_templates: List[str] = []
        self.match_modes: Dict[str, bool] = {
            'point': False,
            'rect': False,
            'circle': False
        }
        self.image_matcher = ImageMatcher()

    def set_image(self, image: Image.Image):
        """Set the main image and create backups"""
        self.original_image = image.copy()
        self.display_image = image.copy()
        self.backup_image = image.copy()
        ColorPrint.green("[TEMPLATE_MATCHER] Image set and backups created")

    def get_available_templates(self, client_type: str = CLIENT_TYPE_BATTLENET) -> Dict[str, List[str]]:
        """
        Get available templates grouped by category

        Args:
            client_type: CLIENT_TYPE_BATTLENET, CLIENT_TYPE_D3_GAME, or CLIENT_TYPE_D4_GAME

        Returns:
            Dict with categories and template names
        """
        # Select config based on client_type (use constants for comparison)
        if client_type == CLIENT_TYPE_D4_GAME:
            configs = D4_TEMPLATE_CONFIGS
        elif client_type == CLIENT_TYPE_D3_GAME:
            configs = D3_TEMPLATE_CONFIGS
        else:  # CLIENT_TYPE_BATTLENET (default)
            configs = BATTLENET_TEMPLATE_CONFIGS

        templates_by_category = {}

        for template_name, config in configs.items():
            category = config.get('category', 'other')
            if category not in templates_by_category:
                templates_by_category[category] = []
            templates_by_category[category].append(template_name)

        return templates_by_category

    def select_template(self, template_name: str, selected: bool):
        """
        Select or deselect a template

        Args:
            template_name: Name of the template
            selected: True to select, False to deselect
        """
        if selected:
            if template_name not in self.selected_templates:
                self.selected_templates.append(template_name)
                ColorPrint.blue(f"[TEMPLATE_MATCHER] Template selected: {template_name}")
        else:
            if template_name in self.selected_templates:
                self.selected_templates.remove(template_name)
                ColorPrint.blue(f"[TEMPLATE_MATCHER] Template deselected: {template_name}")

    def set_match_modes(self, point: bool = False, rect: bool = False, circle: bool = False):
        """Set which match modes to use"""
        self.match_modes['point'] = point
        self.match_modes['rect'] = rect
        self.match_modes['circle'] = circle
        ColorPrint.blue(f"[TEMPLATE_MATCHER] Match modes set: {self.match_modes}")

    def match_templates(self, client_type: str = CLIENT_TYPE_BATTLENET) -> bool:
        """
        Match selected templates on the image

        Args:
            client_type: CLIENT_TYPE_BATTLENET, CLIENT_TYPE_D3_GAME, or CLIENT_TYPE_D4_GAME

        Returns:
            True if matching succeeded
        """
        if not self.original_image or not self.selected_templates:
            ColorPrint.yellow("[TEMPLATE_MATCHER] No image or templates selected")
            return False

        # Select config based on client_type (use constants for comparison)
        if client_type == CLIENT_TYPE_D4_GAME:
            configs = D4_TEMPLATE_CONFIGS
        elif client_type == CLIENT_TYPE_D3_GAME:
            configs = D3_TEMPLATE_CONFIGS
        else:  # CLIENT_TYPE_BATTLENET (default)
            configs = BATTLENET_TEMPLATE_CONFIGS

        self.matches = []

        for template_name in self.selected_templates:
            if template_name not in configs:
                ColorPrint.yellow(f"[TEMPLATE_MATCHER] Template not found: {template_name}")
                continue

            config = configs[template_name]
            template_path = config['path']

            if not Path(template_path).exists():
                ColorPrint.yellow(f"[TEMPLATE_MATCHER] Template file not found: {template_path}")
                continue

            try:
                template_image = Image.open(template_path)
                match_method = config.get('match_method', 'ORB')

                matches = self.image_matcher.find_all_matches(
                    self.original_image,
                    template_image,
                    threshold=config.get('threshold', 0.7),
                    match_method=match_method
                )

                for match in matches:
                    self.matches.append({
                        'template_name': template_name,
                        'location': match,
                        'config': config,
                        'template_size': template_image.size
                    })

                ColorPrint.green(f"[TEMPLATE_MATCHER] Found {len(matches)} matches for {template_name}")

            except Exception as e:
                ColorPrint.red(f"[TEMPLATE_MATCHER] Error matching {template_name}: {e}")
                continue

        return len(self.matches) > 0

    def draw_matches_on_image(self) -> bool:
        """
        Draw all matches on the display image

        Returns:
            True if drawing succeeded
        """
        if not self.display_image or not self.matches:
            ColorPrint.yellow("[TEMPLATE_MATCHER] No image or matches to draw")
            return False

        try:
            draw = ImageDraw.Draw(self.display_image)
            colors = ['red', 'green', 'blue', 'yellow', 'cyan', 'magenta', 'white', 'orange']

            for idx, match in enumerate(self.matches):
                color = colors[idx % len(colors)]
                location = match['location']
                template_size = match['template_size']

                if self.match_modes['rect']:
                    x, y = location
                    width, height = template_size
                    draw.rectangle(
                        [(x, y), (x + width, y + height)],
                        outline=color,
                        width=2
                    )
                    draw.text((x, y - 15), match['template_name'], fill=color)

                elif self.match_modes['circle']:
                    x, y = location
                    radius = max(template_size) // 2
                    draw.ellipse(
                        [(x - radius, y - radius), (x + radius, y + radius)],
                        outline=color,
                        width=2
                    )
                    draw.text((x, y - 15), match['template_name'], fill=color)

                else:
                    x, y = location
                    draw.ellipse(
                        [(x - 5, y - 5), (x + 5, y + 5)],
                        outline=color,
                        width=2,
                        fill=color
                    )
                    draw.text((x + 10, y), match['template_name'], fill=color)

            ColorPrint.green(f"[TEMPLATE_MATCHER] Drew {len(self.matches)} matches on image")
            return True

        except Exception as e:
            ColorPrint.red(f"[TEMPLATE_MATCHER] Error drawing matches: {e}")
            return False

    def reset_image(self):
        """Reset display image to original state"""
        if self.backup_image:
            self.display_image = self.backup_image.copy()
            ColorPrint.blue("[TEMPLATE_MATCHER] Image reset to original state")
            return True
        return False

    def clear_matches(self):
        """Clear all matches"""
        self.matches = []
        self.selected_templates = []
        ColorPrint.blue("[TEMPLATE_MATCHER] Matches and templates cleared")

    def get_matches_data(self) -> List[Dict]:
        """
        Get match data for export or analysis

        Returns:
            List of match dictionaries with location and template info
        """
        return [
            {
                'template': match['template_name'],
                'location': match['location'],
                'size': match['template_size'],
                'threshold': match['config'].get('threshold', 0.7),
                'method': match['config'].get('match_method', 'ORB')
            }
            for match in self.matches
        ]
