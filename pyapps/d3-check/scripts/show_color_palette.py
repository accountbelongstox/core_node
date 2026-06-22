#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Color Palette Viewer
Display all target colors with their tolerance ranges
"""

import sys
from pathlib import Path

# Add project paths
current_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(current_dir))
from share.project_path import get_project_root
sys.path.insert(0, str(get_project_root().parent.parent))

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy
cv2 = get_third_package_cv2()
np = get_third_package_numpy()

from scripts.color_region_detector import TARGET_COLORS, COLOR_TOLERANCE, calculate_color_range


def create_color_palette():
    """Create a visual palette showing all target colors"""
    # Calculate image dimensions
    num_colors = len(TARGET_COLORS)
    color_width = 150
    color_height = 80
    label_height = 60

    total_width = color_width * 4  # 4 columns
    rows = (num_colors + 3) // 4  # Ceiling division
    total_height = rows * (color_height + label_height)

    # Create white background
    palette = np.ones((total_height, total_width, 3), dtype=np.uint8) * 255

    # Draw each color
    for idx, color in enumerate(TARGET_COLORS):
        row = idx // 4
        col = idx % 4

        x_start = col * color_width
        y_start = row * (color_height + label_height)

        # Calculate color range
        lower, upper = calculate_color_range(color, COLOR_TOLERANCE)

        # Draw color rectangle
        palette[y_start:y_start+color_height, x_start:x_start+color_width] = color

        # Convert BGR to RGB for display label
        b, g, r = color
        rgb_hex = f"#{r:02X}{g:02X}{b:02X}"

        # Draw labels
        label_y = y_start + color_height + 15

        # Color number
        cv2.putText(
            palette,
            f"Color {idx+1}",
            (x_start + 5, label_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.4,
            (0, 0, 0),
            1,
            cv2.LINE_AA
        )

        # RGB hex code
        cv2.putText(
            palette,
            rgb_hex,
            (x_start + 5, label_y + 15),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.35,
            (0, 0, 0),
            1,
            cv2.LINE_AA
        )

        # BGR values
        cv2.putText(
            palette,
            f"BGR:{b},{g},{r}",
            (x_start + 5, label_y + 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.3,
            (100, 100, 100),
            1,
            cv2.LINE_AA
        )

        # Tolerance range
        cv2.putText(
            palette,
            f"±{COLOR_TOLERANCE*100:.0f}%",
            (x_start + 5, label_y + 45),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.3,
            (150, 150, 150),
            1,
            cv2.LINE_AA
        )

    return palette


def main():
    """Main function"""
    print("Creating color palette...")
    palette = create_color_palette()

    # Save palette
    output_dir = Path(__file__).resolve().parent / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / "color_palette.png"
    cv2.imwrite(str(output_path), palette)

    print(f"Color palette saved: {output_path}")
    print(f"\nTotal colors: {len(TARGET_COLORS)}")
    print(f"Color tolerance: ±{COLOR_TOLERANCE*100:.1f}%")

    # Print all colors in detail
    print("\nColor Details:")
    print("=" * 70)
    for idx, color in enumerate(TARGET_COLORS, 1):
        b, g, r = color
        lower, upper = calculate_color_range(color, COLOR_TOLERANCE)
        rgb_hex = f"#{r:02X}{g:02X}{b:02X}"

        print(f"Color {idx:2d}: {rgb_hex}")
        print(f"  BGR: ({b:3d}, {g:3d}, {r:3d})")
        print(f"  Range: [{lower[0]:3d},{lower[1]:3d},{lower[2]:3d}] to [{upper[0]:3d},{upper[1]:3d},{upper[2]:3d}]")
        print("-" * 70)


if __name__ == "__main__":
    main()
