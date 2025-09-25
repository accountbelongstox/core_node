#!/usr/bin/env python3
"""
Numbered Image Generator

This script generates PNG images with numbers drawn on them.
Each image has a transparent background with black text showing the number.
Images are named as {number}.png (e.g., 1.png, 2.png, etc.)

Usage:
    python generate_numbered_images.py [--min MIN] [--max MAX] [--output OUTPUT_DIR]

Arguments:
    --min: Minimum number to generate (default: 1)
    --max: Maximum number to generate (default: 100)
    --output: Output directory path (default: ./numbered_images)
"""

import argparse
import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def create_numbered_image(number, output_dir, image_size=(200, 200), font_size=72):
    """
    Create a PNG image with a number drawn on transparent background.

    Args:
        number (int): The number to draw on the image
        output_dir (str): Directory to save the image
        image_size (tuple): Width and height of the image in pixels
        font_size (int): Size of the font for the number
    """
    # Create image with transparent background (RGBA mode)
    img = Image.new('RGBA', image_size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    # Try to use a system font, fallback to default if not available
    try:
        # Windows font path
        font = ImageFont.truetype("arial.ttf", font_size)
    except OSError:
        try:
            # Linux font path
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except OSError:
            # Fallback to default font
            font = ImageFont.load_default()

    # Get text dimensions for centering
    text = str(number)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Calculate position to center the text
    x = (image_size[0] - text_width) // 2
    y = (image_size[1] - text_height) // 2

    # Draw the number in black color
    draw.text((x, y), text, fill=(0, 0, 0, 255), font=font)

    # Save the image
    filename = f"{number}.png"
    filepath = os.path.join(output_dir, filename)
    img.save(filepath, "PNG")
    print(f"Generated: {filepath}")


def resolve_output_path(output_path):
    """
    Resolve the output path with proper handling for Windows/Linux and relative paths.

    Args:
        output_path (str): The output path provided by user

    Returns:
        Path: Resolved absolute path
    """
    # Get the script directory
    script_dir = Path(__file__).parent.absolute()

    # Convert to Path object for cross-platform handling
    path = Path(output_path)

    # If it's an absolute path, use it as-is
    if path.is_absolute():
        return path

    # If it's a relative path, combine with ../../.cache/numbered_images/
    cache_dir = script_dir.parent.parent / ".cache" / "numbered_images"
    resolved_path = cache_dir / path

    return resolved_path


def main():
    """Main function to parse arguments and generate images."""
    parser = argparse.ArgumentParser(
        description="Generate numbered PNG images with transparent backgrounds"
    )
    parser.add_argument(
        "--min",
        type=int,
        default=1,
        help="Minimum number to generate (default: 1)"
    )
    parser.add_argument(
        "--max",
        type=int,
        default=100,
        help="Maximum number to generate (default: 100)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="default",
        help="Output directory path. Use absolute path or relative path from script's ../../.cache/numbered_images/ (default: 'default')"
    )
    parser.add_argument(
        "--size",
        type=int,
        nargs=2,
        default=[200, 200],
        metavar=("WIDTH", "HEIGHT"),
        help="Image size in pixels (default: 200 200)"
    )
    parser.add_argument(
        "--font-size",
        type=int,
        default=72,
        help="Font size for the numbers (default: 72)"
    )

    args = parser.parse_args()

    # Validate arguments
    if args.min > args.max:
        print("Error: --min cannot be greater than --max")
        return

    if args.min < 0 or args.max < 0:
        print("Error: --min and --max must be non-negative")
        return

    # Resolve the output path
    output_path = resolve_output_path(args.output)

    # Create output directory if it doesn't exist
    output_path.mkdir(parents=True, exist_ok=True)
    print(f"Output directory: {output_path.absolute()}")
    print(f"Generating images for numbers {args.min} to {args.max}")
    print(f"Image size: {args.size[0]}x{args.size[1]} pixels")
    print(f"Font size: {args.font_size}")
    print("-" * 50)

    # Generate images for each number in the range
    for number in range(args.min, args.max + 1):
        create_numbered_image(
            number,
            str(output_path),
            image_size=tuple(args.size),
            font_size=args.font_size
        )

    total_images = args.max - args.min + 1
    print("-" * 50)
    print(f"Successfully generated {total_images} images in '{output_path.absolute()}'")


if __name__ == "__main__":
    main()