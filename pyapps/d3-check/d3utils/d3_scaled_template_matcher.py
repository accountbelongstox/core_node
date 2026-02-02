#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3 Scaled Template Matcher
D3-specific scaled template matching. All D3 constants and config live here (or from providor D3_TEMPLATE_CONFIGS).
Uses shared base share.scaled_template_matcher_base.ScaledTemplateMatcherBase for common logic only.
"""

import sys
from pathlib import Path
from typing import Optional, Dict, Tuple, Union

current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
sys.path.insert(0, str(project_root))

from providor.common_imports import ColorPrint
from providor.providor_index import (
    STANDARD_RESOLUTION_WIDTH as D3_STANDARD_RESOLUTION_WIDTH,
    STANDARD_RESOLUTION_HEIGHT as D3_STANDARD_RESOLUTION_HEIGHT,
    get_template_path,
    get_template_threshold,
    get_template_use_alpha,
    get_template_match_method,
)
from share import get_global_scale
from share.scaled_template_matcher_base import ScaledTemplateMatcherBase


# D3 built-in constants (this module owns D3 standard resolution for scaling)
D3_STANDARD_WIDTH = D3_STANDARD_RESOLUTION_WIDTH
D3_STANDARD_HEIGHT = D3_STANDARD_RESOLUTION_HEIGHT


def _d3_get_template_config(template_name: str) -> Optional[Dict]:
    path = get_template_path(template_name)
    if not path:
        return None
    return {
        "path": path,
        "threshold": get_template_threshold(template_name),
        "use_alpha": get_template_use_alpha(template_name),
        "match_method": get_template_match_method(template_name),
    }


class D3ScaledTemplateMatcher(ScaledTemplateMatcherBase):
    """
    D3 scaled template matcher. All D3 constants (D3_STANDARD_WIDTH/HEIGHT) and template config live here.
    Uses base for common logic; implements match_template_auto_scale using D3 standard resolution.
    """

    def __init__(self):
        super().__init__(
            standard_width=D3_STANDARD_WIDTH,
            standard_height=D3_STANDARD_HEIGHT,
            get_scale_factors=get_global_scale,
            get_template_config=_d3_get_template_config,
            log_prefix="[D3ScaledMatcher]",
        )
        ColorPrint.green("[D3ScaledTemplateMatcher] Initialized")

    def match_template_auto_scale(
        self,
        target_image: Union[str, Path, object],
        template_name: str,
    ) -> Dict:
        """
        Match one template with scale derived from target image size using D3 standard resolution.
        scale = (target_w / D3_STANDARD_WIDTH, target_h / D3_STANDARD_HEIGHT). Used e.g. by d3_status_provider.
        """
        target_img_array = self._load_target_image(target_image)
        if target_img_array is None:
            return {"total_matches": 0, "matches": [], "error": "Failed to load target image"}
        h, w = target_img_array.shape[:2]
        scale_x = w / D3_STANDARD_WIDTH
        scale_y = h / D3_STANDARD_HEIGHT
        ColorPrint.gray(
            f"{self.log_prefix} Auto scale from image {w}x{h} (D3 std {D3_STANDARD_WIDTH}x{D3_STANDARD_HEIGHT}): "
            f"({scale_x:.4f}, {scale_y:.4f})"
        )
        return self._match_single_with_scale(target_img_array, template_name, scale_x, scale_y)


_d3_scaled_matcher_instance: Optional[D3ScaledTemplateMatcher] = None


def get_d3_scaled_template_matcher() -> D3ScaledTemplateMatcher:
    """D3 专用 scale matcher 单例。"""
    global _d3_scaled_matcher_instance
    if _d3_scaled_matcher_instance is None:
        _d3_scaled_matcher_instance = D3ScaledTemplateMatcher()
    return _d3_scaled_matcher_instance
