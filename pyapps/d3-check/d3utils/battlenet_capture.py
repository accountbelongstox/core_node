#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Battle.net window capture and save to category directory (with cleanup).
"""

from pathlib import Path
from typing import Optional, Tuple, Any

from pycore.pyfoundations.color_print import ColorPrint

from providor.constants.common import LOGIN_TRY_SCREENSHOT_PREFIX
from config.screenshot_categories import get_screenshot_category_manager
from d3utils.screenshot_provider import get_screenshot_provider
from d3utils.battlenet_manager import get_battlenet_manager


def capture_battlenet_and_save_to_category(
    category: str = "login_try",
) -> Tuple[Optional[Any], Optional[Path]]:
    """
    Capture Battle.net window (find by exe via BattleNetManager), save to category directory, clean older files.
    Returns (screenshot_data, path) or (None, None) on failure.
    """
    if not get_battlenet_manager().prime_window_cache_for_capture():
        ColorPrint.yellow("[BattlenetCapture] Battle.net window not found")
        return None, None
    provider = get_screenshot_provider()
    screenshot_data = provider.gen(
        use_optimized_capture=True,
        window_titles=["Battle.net"],
    )
    if screenshot_data is None or screenshot_data.game_window_image is None:
        ColorPrint.yellow("[BattlenetCapture] Battle.net window not found")
        return None, None
    img = screenshot_data.game_window_image
    out_dir = get_screenshot_category_manager().get_dir(category)
    if out_dir is None:
        ColorPrint.yellow(f"[BattlenetCapture] Unknown category: {category}")
        return None, None
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    prefix = LOGIN_TRY_SCREENSHOT_PREFIX if category == "login_try" else "battlenet"
    ts = screenshot_data.timestamp
    path = out_dir / f"{prefix}_battlenet_{ts}.png"
    img.save(str(path))
    get_screenshot_category_manager().clean_older_than(category)
    ColorPrint.blue(f"[BattlenetCapture] Saved: {path}")
    return screenshot_data, path
