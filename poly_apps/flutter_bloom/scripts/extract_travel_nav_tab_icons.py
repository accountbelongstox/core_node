#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extract 5 bottom nav tab icons from travel app screenshot and copy/rename for:
首页, 行程, 客服, 看世界, 我的
Uses icon_extractor (big-image small-icon detector) from scripts/pytools/images_tools.
"""

import sys
import shutil
from pathlib import Path
from datetime import datetime

if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

script_dir = Path(__file__).resolve().parent
project_root = script_dir.parent.parent.parent
icon_extractor_dir = project_root / "scripts" / "pytools" / "images_tools"
sys.path.insert(0, str(icon_extractor_dir))
from icon_extractor import extract_icons_auto_detect

NAV_TAB_NAMES = [
    "nav_tab_home",      # 首页
    "nav_tab_journey",   # 行程
    "nav_tab_service",   # 客服
    "nav_tab_explore",   # 看世界
    "nav_tab_mine",      # 我的
]

def main():
    input_image = project_root / "poly_apps" / "flutter_bloom" / "assets" / "ScreenShot_2026-02-28_144341_077.png"
    if not input_image.exists():
        print(f"Error: file not found: {input_image}")
        return

    target_dir = project_root / "poly_apps" / "flutter_bloom" / "assets" / "apps" / "app_travel" / "images"
    target_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_dir = input_image.parent / f"extracted_nav_tabs_{timestamp}"
    temp_dir.mkdir(parents=True, exist_ok=True)

    icon_names = [f"{n}.png" for n in NAV_TAB_NAMES]
    extract_icons_auto_detect(
        input_image_path=str(input_image),
        output_dir=str(temp_dir),
        icon_names=icon_names,
        threshold_percent=2,
        open_dir=False,
    )

    for name in NAV_TAB_NAMES:
        src = temp_dir / f"{name}.png"
        if src.exists():
            dest = target_dir / f"{name}.png"
            shutil.copy2(src, dest)
            print(f"Copied: {dest.name}")
        else:
            print(f"Missing: {src.name}")

    print(f"Done. Nav tab images in: {target_dir}")

if __name__ == "__main__":
    main()
