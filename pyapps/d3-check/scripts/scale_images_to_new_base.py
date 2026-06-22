#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Scale all images under pyapps/d3-check/images to new base resolution.

Old base: 1826 x 1301 (D3 reference)
New base: 1300 x 800 (1080P-friendly)

Each image is scaled by:
  new_width  = round(old_width  * 1300 / 1826)
  new_height = round(old_height * 800  / 1301)

Usage:
  python scale_images_to_new_base.py [--dry-run]
  From repo root or from pyapps/d3-check: run with Python path including pyapps/d3-check.
"""

import argparse
from pathlib import Path

from pycore.pyfoundations.third_party import get_third_package_PIL_Image

Image = get_third_package_PIL_Image()

# Resolve images dir relative to this script: scripts/ -> pyapps/d3-check -> images
_SCRIPT_DIR = Path(__file__).resolve().parent
_D3_CHECK_ROOT = _SCRIPT_DIR.parent
IMAGES_DIR = _D3_CHECK_ROOT / "images"

OLD_BASE_WIDTH = 1826
OLD_BASE_HEIGHT = 1301
NEW_BASE_WIDTH = 1300
NEW_BASE_HEIGHT = 800

SCALE_X = NEW_BASE_WIDTH / OLD_BASE_WIDTH
SCALE_Y = NEW_BASE_HEIGHT / OLD_BASE_HEIGHT

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp"}


def scale_images(dry_run: bool = False) -> None:
    if Image is None:
        print("PIL/Pillow required. pip install Pillow")
        return

    if not IMAGES_DIR.is_dir():
        print(f"Images dir not found: {IMAGES_DIR}")
        return

    count = 0
    for path in sorted(IMAGES_DIR.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        img = Image.open(path).convert("RGBA" if path.suffix.lower() == ".png" else "RGB")
        w, h = img.size
        new_w = max(1, round(w * SCALE_X))
        new_h = max(1, round(h * SCALE_Y))
        if (new_w, new_h) == (w, h):
            print(f"Skip (unchanged) {path.relative_to(IMAGES_DIR)}")
            continue
        if dry_run:
            print(f"[dry-run] {path.relative_to(IMAGES_DIR)}: {w}x{h} -> {new_w}x{new_h}")
            count += 1
            continue
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        resized.save(path)
        print(f"Scaled {path.relative_to(IMAGES_DIR)}: {w}x{h} -> {new_w}x{new_h}")
        count += 1
    print(f"Done. Processed {count} image(s).")


def main() -> None:
    parser = argparse.ArgumentParser(description="Scale images from old base 1826x1301 to new base 1300x800")
    parser.add_argument("--dry-run", action="store_true", help="Only print what would be done")
    args = parser.parse_args()
    scale_images(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
