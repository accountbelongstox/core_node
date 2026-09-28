#!/usr/bin/env python3

import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Error: PIL/Pillow is not installed.")
    print("Please install it using: pip install Pillow")
    sys.exit(1)

def split_sprite_image():
    script_dir = Path(__file__).parent
    flutter_root = script_dir.parent

    sprite_path = flutter_root / "assets" / "apps" / "app_travel" / "images" / "nav" / "home-fivemain-sprite2x@v7.15.png"
    output_dir = flutter_root / "assets" / "apps" / "app_travel" / "images" / "nav"

    if not sprite_path.exists():
        print(f"Error: Sprite image not found at {sprite_path}")
        sys.exit(1)

    print(f"Reading sprite image from: {sprite_path}")
    img = Image.open(sprite_path)
    width, height = img.size
    print(f"Image size: {width}x{height}")

    icon_height = height // 5
    print(f"Each icon will be: {width}x{icon_height}")

    icon_names = [
        "local_nav_hotel@2x.png",
        "local_nav_flight@2x.png",
        "local_nav_train@2x.png",
        "local_nav_package@2x.png",
        "local_nav_scenic@2x.png"
    ]

    for i in range(5):
        y_start = i * icon_height
        y_end = (i + 1) * icon_height

        icon_img = img.crop((0, y_start, width, y_end))

        output_path = output_dir / icon_names[i]
        icon_img.save(output_path, "PNG")
        print(f"Saved icon {i+1}/5: {output_path.name}")

    print("\nAll icons extracted successfully!")
    print(f"Output directory: {output_dir}")

if __name__ == "__main__":
    split_sprite_image()
