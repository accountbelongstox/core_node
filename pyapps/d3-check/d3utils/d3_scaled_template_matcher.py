#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3 Scaled Template Matcher
D3-specific scaled template matching. All D3 constants and config live here (or from providor D3_TEMPLATE_CONFIGS).
Uses shared base share.scaled_template_matcher_base.ScaledTemplateMatcherBase for common logic only.
"""

import sys
from pathlib import Path
from typing import Optional, Dict, Tuple, Union, List

current_dir = Path(__file__).resolve().parent
project_root = current_dir.parent
sys.path.insert(0, str(project_root))

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from providor.constants.d3 import (
    D3_STANDARD_RESOLUTION_WIDTH,
    D3_STANDARD_RESOLUTION_HEIGHT,
    D3_DISCONNECTED_TEMPLATE_NAME,
    D3_DISCONNECTED_MIN_GOOD_MATCHES,
    D3_START_GAME_BUTTON_TEMPLATE_NAME,
    D3_GAME_TOOL_TEMPLATE_NAME,
    D3_CONNECTING_TEMPLATE_NAME,
    D3_CONNECTING_ALT_TEMPLATE_NAME,
)
from providor.providor_index import get_template_path, get_template_threshold, get_template_use_alpha, get_template_match_method
from share.game_interface_data import get_global_scale
from share.scaled_template_matcher_base import ScaledTemplateMatcherBase
from d3utils.image_matcher_registry import get_image_matcher_for_method
from d3utils.match_debug_notify import notify_match


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
            get_matcher=lambda method: get_image_matcher_for_method(
                method, D3_STANDARD_WIDTH, D3_STANDARD_HEIGHT,
                ratio_thresh=0.80, min_inliers=4, nfeatures=10000,
            ),
            log_prefix="[D3ScaledMatcher]",
            on_after_match=notify_match,
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

    def match_all_d3_states(
        self,
        target_image: Union[str, Path, object],
        template_names: Optional[List[str]] = None,
    ) -> Dict[str, bool]:
        """
        C3 template match: branch by doc priority. If disconnected/start/game_tool -> branch; if connecting -> wait; else no match.
        Priority: disconnected -> game_tool -> start_game_button -> connecting -> no match.
        Each template above threshold counts as match (disconnected >= D3_DISCONNECTED_MIN_GOOD_MATCHES, others >= 4).
        """
        names = template_names or [
            D3_DISCONNECTED_TEMPLATE_NAME,
            D3_START_GAME_BUTTON_TEMPLATE_NAME,
            D3_GAME_TOOL_TEMPLATE_NAME,
            D3_CONNECTING_TEMPLATE_NAME,
            D3_CONNECTING_ALT_TEMPLATE_NAME,
        ]
        target_img_array = self._load_target_image(target_image)
        if target_img_array is None:
            ColorPrint.gray(
                f"{self.log_prefix} C3 match: no image | disconnected=- start=- game_tool=- connecting=- | export: no_match"
            )
            return {"disconnected": False, "start_game_button": False, "game_tool": False, "connecting": False}
        scale_x = target_img_array.shape[1] / D3_STANDARD_WIDTH
        scale_y = target_img_array.shape[0] / D3_STANDARD_HEIGHT
        values: Dict[str, int] = {}
        for template_name in names:
            r = self._match_single_with_scale(
                target_img_array, template_name, scale_x, scale_y, silent=True
            )
            num = 0
            if r.get("total_matches", 0) >= 1 and r.get("matches"):
                num = r["matches"][0].get("num_matches", 0)
            values[template_name] = num
        connecting_val = max(
            values.get(D3_CONNECTING_TEMPLATE_NAME, 0),
            values.get(D3_CONNECTING_ALT_TEMPLATE_NAME, 0),
        )
        d_val = values.get(D3_DISCONNECTED_TEMPLATE_NAME, 0)
        s_val = values.get(D3_START_GAME_BUTTON_TEMPLATE_NAME, 0)
        g_val = values.get(D3_GAME_TOOL_TEMPLATE_NAME, 0)
        # Priority: disconnected -> game_tool -> start -> connecting -> no match
        # If connecting count > game_tool during load, treat as connecting wait to avoid teleport before in game
        d_ok = d_val >= D3_DISCONNECTED_MIN_GOOD_MATCHES
        s_ok = s_val >= 4
        g_ok = g_val >= 4
        c_ok = connecting_val >= 4
        if g_ok and c_ok and connecting_val > g_val:
            g_ok = False  # Still loading, do not treat as game_tool
        if d_ok:
            export_name = "disconnected"
        elif g_ok:
            export_name = "game_tool"
        elif s_ok:
            export_name = "start_game_button"
        elif c_ok:
            export_name = "connecting"
        else:
            export_name = "no_match"
        parts = [
            "disconnected=%d%s" % (d_val, "✓" if d_ok else ""),
            "start=%d%s" % (s_val, "✓" if s_ok else ""),
            "game_tool=%d%s" % (g_val, "✓" if g_ok else ""),
            "connecting=%d%s" % (connecting_val, "✓" if c_ok else ""),
        ]
        ColorPrint.gray(
            f"{self.log_prefix} C3 match: %s | export: %s"
            % (" ".join(parts), export_name)
        )
        return {
            "disconnected": d_ok,
            "start_game_button": s_ok,
            "game_tool": g_ok,
            "connecting": c_ok,
        }


_d3_scaled_matcher_instance: Optional[D3ScaledTemplateMatcher] = None


def get_d3_scaled_template_matcher() -> D3ScaledTemplateMatcher:
    """Return D3-specific scaled template matcher singleton."""
    global _d3_scaled_matcher_instance
    if _d3_scaled_matcher_instance is None:
        _d3_scaled_matcher_instance = D3ScaledTemplateMatcher()
    return _d3_scaled_matcher_instance
