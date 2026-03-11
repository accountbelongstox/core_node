# -*- coding: utf-8 -*-
"""
Kanai Cube UI detection only. No blacksmith logic. Reuses d3_scaled_template_matcher and providor template keys.
"""
from typing import Optional

from d3utils.d3_scaled_template_matcher import get_d3_scaled_template_matcher
from providor.constants.d3 import (
    KANAI_CUBE_LEFT_PANEL_INDICATOR_TEMPLATE_NAME,
    KANAI_RIGHT_PAGE_INDICATOR_TEMPLATE_NAME,
)


def detect_kanai_left_panel(game_window_image) -> bool:
    """Detect Kanai Cube left panel. Returns True if match success."""
    if game_window_image is None:
        return False
    matcher = get_d3_scaled_template_matcher()
    r = matcher.match_template(
        target_image=game_window_image,
        template_name=KANAI_CUBE_LEFT_PANEL_INDICATOR_TEMPLATE_NAME,
        output_dir=None,
    )
    match = (r.get("matches") or [None])[0]
    return match is not None and match.get("success", False)


def detect_kanai_right_page_opened(game_window_image) -> Optional[bool]:
    """Detect if Kanai right page is opened. Returns True or None."""
    if game_window_image is None:
        return None
    matcher = get_d3_scaled_template_matcher()
    r = matcher.match_template(
        target_image=game_window_image,
        template_name=KANAI_RIGHT_PAGE_INDICATOR_TEMPLATE_NAME,
        output_dir=None,
    )
    match = (r.get("matches") or [None])[0]
    if match is None or not match.get("success", False):
        return None
    return True
