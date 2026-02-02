#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Battle.net template matcher: load+scale template, match or best-attempt (TM).
Shared by LoginTryScreenshotController and battlenet_match_debug.
复用 share.scaled_template_matcher_base.load_template_and_scale_by_resolution。
"""

from typing import Optional, Dict, Any, Tuple

from share.scaled_template_matcher_base import load_template_and_scale_by_resolution, cv2, np
from providor.common_imports import ColorPrint, ImageMatcher
from providor.providor_index import (
    BATTLENET_TEMPLATE_CONFIGS,
    BATTLENET_STANDARD_RESOLUTION_WIDTH,
    BATTLENET_STANDARD_RESOLUTION_HEIGHT,
)
from d3utils.d3u_common.image_utils import convert_pil_to_bgr

TM_MAP = {
    "TM_CCOEFF": cv2.TM_CCOEFF,
    "TM_CCOEFF_NORMED": cv2.TM_CCOEFF_NORMED,
    "TM_CCORR": cv2.TM_CCORR,
    "TM_CCORR_NORMED": cv2.TM_CCORR_NORMED,
    "TM_SQDIFF": cv2.TM_SQDIFF,
    "TM_SQDIFF_NORMED": cv2.TM_SQDIFF_NORMED,
}


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
        BATTLENET_STANDARD_RESOLUTION_WIDTH,
        BATTLENET_STANDARD_RESOLUTION_HEIGHT,
        log_prefix="[BattlenetTemplateMatcher]",
    )
    if template_bgr is None:
        ColorPrint.yellow(f"[BattlenetTemplateMatcher] Template file not found or failed to load: {path}")
        return None, None
    if window_width != BATTLENET_STANDARD_RESOLUTION_WIDTH or window_height != BATTLENET_STANDARD_RESOLUTION_HEIGHT:
        ColorPrint.gray(
            f"[BattlenetTemplateMatcher] Scaled {template_name}: "
            f"{BATTLENET_STANDARD_RESOLUTION_WIDTH}x{BATTLENET_STANDARD_RESOLUTION_HEIGHT} -> "
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
    matcher = ImageMatcher(standard_width=window_width, standard_height=window_height)
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
    return result if (result and result.get("success")) else None


def get_best_attempt_tm(
    game_window_image,
    template_name: str,
    window_width: int,
    window_height: int,
    tm_method: str = "TM_CCORR_NORMED",
) -> Optional[Dict]:
    """
    Same load+scale as match_battlenet_template, but run cv2.matchTemplate and return best location
    (center, polygon, match_score) for debug even when below threshold.
    """
    target_bgr = convert_pil_to_bgr(game_window_image)
    if target_bgr is None:
        return None
    template_bgr, config = load_scaled_battlenet_template(template_name, window_width, window_height)
    if template_bgr is None or config is None:
        return None
    if len(template_bgr.shape) == 3 and template_bgr.shape[2] == 4:
        template_bgr = template_bgr[:, :, :3]
    cv_method = TM_MAP.get(tm_method.upper(), cv2.TM_CCORR_NORMED)
    gray_target = cv2.cvtColor(target_bgr, cv2.COLOR_BGR2GRAY)
    gray_template = cv2.cvtColor(template_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray_template.shape
    res = cv2.matchTemplate(gray_target, gray_template, cv_method)
    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)
    if cv_method == cv2.TM_SQDIFF_NORMED:
        top_left = min_loc
        match_val = float(1 - min_val)
    elif cv_method == cv2.TM_SQDIFF:
        top_left = min_loc
        match_val = float(min_val)
    else:
        top_left = max_loc
        match_val = float(max_val)
    bottom_right = (top_left[0] + w, top_left[1] + h)
    polygon = np.array([
        [top_left[0], top_left[1]],
        [bottom_right[0], top_left[1]],
        [bottom_right[0], bottom_right[1]],
        [top_left[0], bottom_right[1]]
    ], dtype=np.float32)
    center = np.array([(top_left[0] + bottom_right[0]) / 2, (top_left[1] + bottom_right[1]) / 2])
    return {
        "polygon": polygon,
        "center": center,
        "match_score": match_val,
        "success": False,
    }
