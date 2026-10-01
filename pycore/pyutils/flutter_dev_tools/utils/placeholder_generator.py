#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Placeholder Image Generator

- Generates an example image when an images/ directory has no actual designs.
- Removes example images once actual images are added.
- Provides the Markdown placeholder comment for image directories.
"""

from pathlib import Path
from typing import List, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import (
    get_third_package_PIL_Image,
    get_third_package_PIL_ImageDraw,
    get_third_package_PIL_ImageFont,
)

Image = get_third_package_PIL_Image()
ImageDraw = get_third_package_PIL_ImageDraw()
ImageFont = get_third_package_PIL_ImageFont()

# Example image names by layer (not fixed "_placeholder.png")
EXAMPLE_IMAGE_NAMES = {
    "1_concept_designs": "example_architecture.png",
    "2_page_designs_rough": "example_home_wireframe.png",
    "3_page_designs_detailed": "example_mockup.png",
    "home_page": "example_home_mockup.png",
    "profile_page": "example_profile_mockup.png",
    "settings_page": "example_settings_mockup.png",
}

# Default example image name
DEFAULT_EXAMPLE_NAME = "example_design.png"

# Supported image formats
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'}


def _placeholder_font(size: int):
    try:
        return ImageFont.truetype("arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


def generate_placeholder(
    image_path: Path,
    directory_name: str,
    size: Tuple[int, int] = (800, 600)
) -> bool:
    img = Image.new('RGB', size, color='#F0F0F0')
    draw = ImageDraw.Draw(img)
    text_lines = [
        "Design Images Placeholder",
        "",
        f"Directory: {directory_name}",
        "",
        "Please place your design images here",
        "",
        "Supported formats: PNG, JPG, SVG, GIF",
        "",
        "This placeholder will be auto-removed",
        "when actual images are added"
    ]
    font_large = _placeholder_font(24)
    font_small = _placeholder_font(16)

    y_offset = 100
    for i, line in enumerate(text_lines):
        font = font_large if i == 0 else font_small
        bbox = draw.textbbox((0, 0), line, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        color = '#333333' if i == 0 else '#666666'
        draw.text(((size[0] - text_width) // 2, y_offset), line, fill=color, font=font)
        y_offset += text_height + 10

    try:
        image_path.parent.mkdir(parents=True, exist_ok=True)
        img.save(image_path, 'PNG')
    except OSError as e:
        ColorPrint.red(f"[PlaceholderGen] Failed to save placeholder: path={image_path} error={e}")
        return False
    ColorPrint.plain(f"[PlaceholderGen] Generated: {image_path}")
    return True


def get_example_image_name(directory_label: str) -> str:
    """
    Get example image name based on directory context

    Args:
        directory_label: Directory label (e.g., "1_concept_designs/images")

    Returns:
        Example image filename
    """
    # Extract layer or page name from label
    for key in EXAMPLE_IMAGE_NAMES:
        if key in directory_label:
            return EXAMPLE_IMAGE_NAMES[key]

    return DEFAULT_EXAMPLE_NAME


def is_example_image(filename: str) -> bool:
    """Check if filename is an example/placeholder image"""
    return filename.startswith("example_") and filename.endswith((".png", ".jpg", ".jpeg"))


def get_actual_images(images_dir: Path) -> List[Path]:
    """
    Get actual images in directory (excluding example placeholders)

    Args:
        images_dir: Images directory

    Returns:
        List of actual image files
    """
    if not images_dir.exists():
        return []

    actual_images = []
    for file_path in images_dir.iterdir():
        if (file_path.is_file()
            and file_path.suffix.lower() in IMAGE_EXTENSIONS
            and not is_example_image(file_path.name)):
            actual_images.append(file_path)

    return actual_images


def get_example_images(images_dir: Path) -> List[Path]:
    """Get all example placeholder images in directory"""
    if not images_dir.exists():
        return []

    return [
        f for f in images_dir.iterdir()
        if f.is_file() and is_example_image(f.name)
    ]


def remove_example_images(images_dir: Path) -> int:
    """
    Remove all example placeholder images

    Args:
        images_dir: Images directory

    Returns:
        Number of images removed
    """
    example_images = get_example_images(images_dir)
    removed_count = 0

    for img_path in example_images:
        try:
            img_path.unlink()
        except OSError as e:
            ColorPrint.yellow(f"[PlaceholderCleanup] Failed to remove: path={img_path} error={e}")
            continue
        ColorPrint.plain(f"[PlaceholderCleanup] Removed: {img_path}")
        removed_count += 1

    return removed_count


def manage_placeholder(images_dir: Path, directory_label: str = "") -> bool:
    """
    Manage placeholder images: generate or cleanup

    Logic:
    - If directory is empty or only has examples -> Generate example image
    - If has actual images -> Remove example images

    Args:
        images_dir: Images directory
        directory_label: Directory label (for placeholder display)

    Returns:
        True if action was taken
    """
    # Ensure directory exists
    images_dir.mkdir(parents=True, exist_ok=True)

    # Get actual images
    actual_images = get_actual_images(images_dir)

    # Get example image name based on directory context
    example_name = get_example_image_name(directory_label)
    example_path = images_dir / example_name

    if len(actual_images) == 0:
        # No actual images, ensure example exists
        if not example_path.exists():
            label = directory_label or images_dir.name
            return generate_placeholder(example_path, label)
        return False  # Example already exists

    else:
        # Has actual images, remove all example images
        removed = remove_example_images(images_dir)
        return removed > 0


def ensure_images_readme(images_dir: Path, layer_name: str = "") -> bool:
    readme_path = images_dir / "README.md"
    if readme_path.exists():
        return False

    content = """# Images Directory

This directory stores design images.

## Example Image Mechanism

- **Filename**: Example images (e.g., `example_architecture.png`, `example_mockup.png`)
- **Purpose**: Auto-generated when directory is empty to remind developers to add actual designs
- **Cleanup**: Auto-removed when actual images are added

## Suggested Images
"""
    if "concept" in layer_name.lower():
        content += """
- `architecture.png`: Architecture diagram
- `user_flow.png`: User flow diagram
- `data_model.png`: Data model diagram
"""
    elif "page_designs_cn" in layer_name.lower():
        content += """
- `page_name_v1.png`: Page design (version 1)
- `page_name_v2.png`: Page design (version 2)
"""
    else:
        content += """
- `wireframe.png`: Wireframe (low fidelity)
- `wireframe_mobile.png`: Mobile wireframe
- `mockup.png`: High-fidelity mockup
- `mockup_dark.png`: Dark mode mockup
- `components.png`: Component annotations
- `interaction_flow.png`: Interaction flow
"""
    content += """
## Naming

- Use descriptive `snake_case` names
- Versions use `_v1`, `_v2` suffixes
- Device/mode variants use underscores (e.g. `_mobile`, `_dark`)

## Supported Formats

- PNG (recommended, supports transparency)
- JPG/JPEG (photographic mockups)
- SVG (vector, scalable)
- GIF (animated)

## Reference

See `doc/DESIGN_IMAGES_PLACEMENT.md`.
"""
    try:
        readme_path.write_text(content, encoding='utf-8')
    except OSError as e:
        ColorPrint.red(f"[ImagesREADME] Failed to create README: path={readme_path} error={e}")
        return False
    ColorPrint.plain(f"[ImagesREADME] Created: {readme_path}")
    return True


def get_markdown_placeholder_comment(layer_name: str = "") -> str:
    """
    Get Markdown placeholder comment template

    Args:
        layer_name: Layer name

    Returns:
        Comment text
    """
    if "concept" in layer_name.lower():
        suggested_images = """     - architecture.png: Architecture diagram
     - user_flow.png: User flow diagram
     - data_model.png: Data model diagram"""
    elif "rough" in layer_name.lower():
        suggested_images = """     - page_name_v1.png: Page design v1
     - page_name_v2.png: Page design v2 (iteration)"""
    else:
        suggested_images = """     - wireframe.png: Wireframe
     - mockup.png: High-fidelity mockup
     - components.png: Component annotations"""

    return f"""<!-- Design images directory: images/
     Example images: Auto-generated when empty (e.g., example_architecture.png)
     Auto-removed when actual images are added

     Suggested images:
{suggested_images}
-->"""
