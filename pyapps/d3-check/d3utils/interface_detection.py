# -*- coding: utf-8 -*-
"""
Single implementation for interface type detection from full game window image.
Used by game_assistant_controller and bag_info_collector; rules (left 30%, template names) maintained here only.
"""

from typing import Optional, Any, Dict, Tuple

from pycore.pyfoundations.third_party import get_third_package_numpy, get_third_package_PIL_Image

np = get_third_package_numpy()
PIL_Image = get_third_package_PIL_Image()

from d3utils.d3_scaled_template_matcher import get_d3_scaled_template_matcher
from share.scaled_template_matcher_base import is_match_center_in_left_region
from providor.constants.d3 import (
    BAG_OPENED_INDICATOR_TEMPLATE_NAME,
    KANAI_CUBE_LEFT_PANEL_INDICATOR_TEMPLATE_NAME,
)

def _image_width(full_image: Any) -> int:
    """Return width of full_image (PIL Image or ndarray). Type-checked at code level."""
    if full_image is None:
        return 0
    if isinstance(full_image, np.ndarray) and len(full_image.shape) >= 2:
        return int(full_image.shape[1])
    if isinstance(full_image, PIL_Image.Image) and isinstance(full_image.size, (tuple, list)) and len(full_image.size) >= 1:
        return int(full_image.size[0])
    return 0


def detect_interface_type_from_full_window(
    full_image: Any,
    want_blacksmith: bool = False,
    matcher: Optional[Any] = None,
) -> Tuple[Optional[str], Dict[str, Any]]:
    """
    Detect interface type from full game window image.
    - When want_blacksmith: bag_opened_indicator match center in left 30% -> "blacksmith"
    - kanai_cube_left_panel_indicator match center in left 30% -> "kanai_cube"
    Returns (interface_type, match_details). match_details: template_name -> match dict for reuse (e.g. button_detections).
    """
    details: Dict[str, Any] = {}
    if not full_image:
        return (None, details)
    if matcher is None:
        matcher = get_d3_scaled_template_matcher()
    w = _image_width(full_image)
    if w <= 0:
        return (None, details)

    if want_blacksmith:
        r = matcher.match_template(
            target_image=full_image, template_name=BAG_OPENED_INDICATOR_TEMPLATE_NAME, output_dir=None
        )
        if r.get("total_matches", 0) > 0:
            match = r.get("matches", [None])[0]
            if match and match.get("success") and is_match_center_in_left_region(match, w):
                details[BAG_OPENED_INDICATOR_TEMPLATE_NAME] = match
                return ("blacksmith", details)

    r = matcher.match_template(
        target_image=full_image, template_name=KANAI_CUBE_LEFT_PANEL_INDICATOR_TEMPLATE_NAME, output_dir=None
    )
    if r.get("total_matches", 0) > 0:
        match = r.get("matches", [None])[0]
        if match and match.get("success") and is_match_center_in_left_region(match, w):
            details[KANAI_CUBE_LEFT_PANEL_INDICATOR_TEMPLATE_NAME] = match
            return ("kanai_cube", details)

    return (None, details)


__all__ = ["detect_interface_type_from_full_window"]
