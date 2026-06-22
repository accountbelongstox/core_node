#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Battle.net template matcher: load+scale template, match or best-attempt (TM).
Shared by LoginTryScreenshotController and battlenet_match_debug.
Uses share.scaled_template_matcher_base.load_template_and_scale_by_resolution.
"""

from typing import Optional, Dict, Any, Tuple

from share.scaled_template_matcher_base import load_template_and_scale_by_resolution, format_match_schematic
from pycore.pyfoundations.color_print import ColorPrint
from d3utils.image_matcher_registry import get_image_matcher_for_resolution, get_image_matcher_for_method
from providor.constants.d3 import D3_BATTLENET_STANDARD_RESOLUTION_WIDTH, D3_BATTLENET_STANDARD_RESOLUTION_HEIGHT
from providor.providor_index import BATTLENET_TEMPLATE_CONFIGS
from d3utils.d3u_common.image_conversion import convert_pil_to_bgr


def load_scaled_battlenet_template(
    template_name: str,
    window_width: int,
    window_height: int,
) -> Tuple[Optional[Any], Optional[Dict]]:
    """
    Load Battle.net template and scale by window size vs standard resolution.
    Returns (template_bgr, config) or (None, None). template_bgr may have 3 or 4 channels.
    """
    config = BATTLENET_TEMPLATE_CONFIGS.get(template_name)
    if not config:
        return None, None
    path = config.get("path")
    if not path:
        return None, None
    template_bgr = load_template_and_scale_by_resolution(
        path,
        window_width,
        window_height,
        D3_BATTLENET_STANDARD_RESOLUTION_WIDTH,
        D3_BATTLENET_STANDARD_RESOLUTION_HEIGHT,
        log_prefix="[BattlenetTemplateMatcher]",
    )
    if template_bgr is None:
        ColorPrint.yellow(f"[BattlenetTemplateMatcher] Template file not found or failed to load: {path}")
        return None, None
    if window_width != D3_BATTLENET_STANDARD_RESOLUTION_WIDTH or window_height != D3_BATTLENET_STANDARD_RESOLUTION_HEIGHT:
        ColorPrint.gray(
            f"[BattlenetTemplateMatcher] Scaled {template_name}: "
            f"{D3_BATTLENET_STANDARD_RESOLUTION_WIDTH}x{D3_BATTLENET_STANDARD_RESOLUTION_HEIGHT} -> "
            f"{window_width}x{window_height}"
        )
    return template_bgr, config


def match_battlenet_template(
    game_window_image,
    template_name: str,
    window_width: int,
    window_height: int,
    match_method: Optional[str] = None,
) -> Optional[Dict]:
    """
    Match Battle.net template on game window image. Uses config match_method if match_method is None.
    Returns match dict on success or None.
    """
    target_bgr = convert_pil_to_bgr(game_window_image)
    if target_bgr is None:
        return None
    template_bgr, config = load_scaled_battlenet_template(template_name, window_width, window_height)
    if template_bgr is None or config is None:
        return None
    method = match_method or config.get("match_method", "TM_CCOEFF_NORMED")
    threshold = config.get("threshold", 0.75)
    use_alpha = config.get("use_alpha", False)
    matcher = get_image_matcher_for_resolution(window_width, window_height)
    result = matcher.match_single_template(
        target_image=target_bgr,
        template_image=template_bgr,
        template_name=template_name,
        custom_threshold=threshold,
        use_alpha=use_alpha,
        detection_method=method,
    )
    if result and result.get("success"):
        if "match_score" not in result and "num_matches" in result:
            result["match_score"] = result["num_matches"] / 100.0
        center = result.get("center")
        if center is not None:
            h, w = target_bgr.shape[:2]
            schematic = format_match_schematic(w, h, center, template_name=template_name)
            ColorPrint.gray(schematic)
    return result if (result and result.get("success")) else None


def get_best_attempt_tm(
    game_window_image,
    template_name: str,
    window_width: int,
    window_height: int,
    tm_method: str = "TM_CCORR_NORMED",
) -> Optional[Dict]:
    """
    Same load+scale as match_battlenet_template; uses unified matcher with threshold=0 to return
    best location (center, polygon, match_score) for debug even when below config threshold.
    """
    target_bgr = convert_pil_to_bgr(game_window_image)
    if target_bgr is None:
        return None
    template_bgr, config = load_scaled_battlenet_template(template_name, window_width, window_height)
    if template_bgr is None or config is None:
        return None
    use_alpha = config.get("use_alpha", False)
    method = tm_method.upper() if tm_method else "TM_CCORR_NORMED"
    matcher = get_image_matcher_for_method(method, window_width, window_height)
    result = matcher.match_single_template(
        target_image=target_bgr,
        template_image=template_bgr,
        template_name=template_name,
        custom_threshold=0.0,
        use_alpha=use_alpha,
        detection_method=method,
    )
    if not result:
        return None
    result = dict(result)
    result["success"] = False
    center = result.get("center")
    if center is not None:
        h, w = target_bgr.shape[:2]
        schematic = format_match_schematic(w, h, center, template_name=template_name)
        ColorPrint.gray(schematic)
    return result
