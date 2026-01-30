#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Battle.net template match debug: run all methods (SIFT, ORB, AKAZE, TM_*), save one debug image per method.
Controller only calls debug_all_match_methods().
"""

from pathlib import Path
from typing import Optional, List, Any

from providor.common_imports import ColorPrint
from providor.providor_index import BATTLE_NET_WINDOW_TITLES, BATTLENET_TEMPLATE_CONFIGS
from config.constants import BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME
from config.screenshot_categories import get_screenshot_category_manager, MATCH_DEBUG_DIR
from d3utils.screenshot_provider import get_screenshot_provider
from d3utils.battlenet_template_matcher import match_battlenet_template, get_best_attempt_tm
from d3utils.d3u_common.image_annotator_helper import (
    save_match_debug_image,
    save_no_match_debug_image,
)

ALL_MATCH_METHODS = [
    "SIFT",
    "ORB",
    "AKAZE",
    "TM_CCOEFF",
    "TM_CCOEFF_NORMED",
    "TM_CCORR",
    "TM_CCORR_NORMED",
    "TM_SQDIFF",
    "TM_SQDIFF_NORMED",
]


def debug_all_match_methods(
    pil_image: Optional[Any] = None,
    template_name: Optional[str] = None,
    window_width: Optional[int] = None,
    window_height: Optional[int] = None,
    output_dir: Optional[Path] = None,
) -> List[Path]:
    """
    Run all matching methods on the Battle.net D3 small map template, save one debug image per method.
    If pil_image is None, capture Battle.net window first.
    Returns list of saved file paths.
    """
    if pil_image is None:
        provider = get_screenshot_provider()
        screenshot_data = provider.gen(
            use_optimized_capture=True,
            window_titles=BATTLE_NET_WINDOW_TITLES,
        )
        if screenshot_data is None or screenshot_data.game_window_image is None:
            ColorPrint.yellow("[BattlenetMatchDebug] Battle.net window not found")
            return []
        pil_image = screenshot_data.game_window_image
        w, h = screenshot_data.game_window_size or (pil_image.width, pil_image.height)
    else:
        w = window_width or (pil_image.width if hasattr(pil_image, "width") else pil_image.size[0])
        h = window_height or (pil_image.height if hasattr(pil_image, "height") else pil_image.size[1])

    template_name = template_name or BATTLE_NET_D3_SMALL_MAP_TEMPLATE_NAME
    cfg = BATTLENET_TEMPLATE_CONFIGS.get(template_name)
    tpath = str(cfg["path"]) if cfg and cfg.get("path") else None
    out_dir = output_dir or MATCH_DEBUG_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    saved_paths: List[Path] = []

    for method in ALL_MATCH_METHODS:
        try:
            result = match_battlenet_template(
                pil_image, template_name, w, h, match_method=method
            )
            if result:
                result.setdefault("match_score", 0.0)
                p = save_match_debug_image(
                    pil_image,
                    result,
                    f"d3_small_map_{method}_ok",
                    out_dir,
                    template_path=tpath,
                    color=(0, 255, 0),
                    filename_prefix="login_try_match_debug",
                )
                if p:
                    saved_paths.append(p)
                ColorPrint.green(f"[BattlenetMatchDebug] {method}: match ok")
            else:
                if method.startswith("TM_"):
                    best = get_best_attempt_tm(pil_image, template_name, w, h, tm_method=method)
                    if best:
                        p = save_match_debug_image(
                            pil_image,
                            best,
                            f"d3_small_map_{method}_fail",
                            out_dir,
                            template_path=tpath,
                            color=(0, 165, 255),
                            filename_prefix="login_try_match_debug",
                        )
                        if p:
                            saved_paths.append(p)
                        ColorPrint.yellow(
                            f"[BattlenetMatchDebug] {method}: fail best_score={best.get('match_score', 0):.3f}"
                        )
                    else:
                        ColorPrint.yellow(f"[BattlenetMatchDebug] {method}: no best attempt")
                else:
                    p = save_no_match_debug_image(
                        pil_image,
                        method,
                        out_dir,
                        template_path=tpath,
                        filename_prefix="login_try_match_debug_d3_small_map",
                    )
                    if p:
                        saved_paths.append(p)
                    ColorPrint.yellow(f"[BattlenetMatchDebug] {method}: no match")
        except Exception as e:
            ColorPrint.red(f"[BattlenetMatchDebug] {method} error: {e}")

    get_screenshot_category_manager().clean_older_than("match_debug")
    ColorPrint.blue(f"[BattlenetMatchDebug] Saved {len(saved_paths)} images to {out_dir}")
    return saved_paths
