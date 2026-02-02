#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Image Annotator Helper
Common methods for drawing template match results
"""

import os
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from datetime import datetime

from providor.common_imports import ColorPrint, ImageAnnotator
from providor.providor_index import TMP_DIR
from share.scaled_template_matcher_base import cv2, np, Image

# Built-in color palette for annotations (BGR format for OpenCV)
ANNOTATION_COLORS = {
    "green": (0, 255, 0),
    "red": (0, 0, 255),
    "blue": (255, 0, 0),
    "yellow": (0, 255, 255),
    "cyan": (255, 255, 0),
    "magenta": (255, 0, 255),
    "orange": (0, 165, 255),
    "purple": (128, 0, 255),
    "pink": (203, 192, 255),
    "lime": (0, 255, 128),
    "white": (255, 255, 255),
    "gray": (128, 128, 128),
    "dark_gray": (80, 80, 80),
    # Extended colors for more elements
    "spring_green": (0, 255, 127),
    "sky_blue": (235, 206, 135),
    "violet": (211, 0, 148),
    "gold": (0, 215, 255),
    "coral": (80, 127, 255),
    "turquoise": (208, 224, 64),
    "salmon": (114, 128, 250),
    "khaki": (140, 230, 240),
    "lavender": (250, 230, 230),
    "mint": (170, 255, 195),
    "peach": (180, 229, 255),
    "aqua": (212, 255, 127),
    "rose": (143, 143, 255),
    "navy": (128, 0, 0),
    "olive": (0, 128, 128),
    "teal": (128, 128, 0),
    "maroon": (0, 0, 128),
    "indigo": (130, 0, 75),
    "crimson": (60, 20, 220),
    "forest_green": (34, 139, 34),
}

# Predefined color sequence for auto-assignment (expanded for more elements)
COLOR_SEQUENCE = [
    "magenta", "yellow", "cyan", "orange", "purple",
    "lime", "pink", "green", "blue", "red",
    "spring_green", "sky_blue", "violet", "gold", "coral",
    "turquoise", "salmon", "khaki", "mint", "peach",
    "aqua", "rose", "navy", "olive", "teal",
    "maroon", "indigo", "crimson", "forest_green", "lavender"
]

def get_annotation_color(color_name: str, default: Tuple[int, int, int] = (0, 255, 0)) -> Tuple[int, int, int]:
    """
    Get annotation color by name from built-in palette

    Args:
        color_name: Color name (e.g., "green", "red", "blue")
        default: Default color if name not found

    Returns:
        Color tuple in BGR format
    """
    return ANNOTATION_COLORS.get(color_name.lower(), default)

def get_auto_color(index: int) -> Tuple[int, int, int]:
    """
    Get color automatically by index from predefined sequence

    Args:
        index: Index for color selection (cycles through COLOR_SEQUENCE)

    Returns:
        Color tuple in BGR format
    """
    color_name = COLOR_SEQUENCE[index % len(COLOR_SEQUENCE)]
    return get_annotation_color(color_name)

def get_tmp_dir() -> Path:
    """Get the temporary directory for saving annotated images"""
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    return TMP_DIR

def generate_timestamp() -> str:
    """Generate a consistent timestamp string"""
    return datetime.now().strftime("%Y%m%d_%H%M%S")

def create_annotator(image_source) -> ImageAnnotator:
    """
    Create ImageAnnotator from various image sources

    Args:
        image_source: Can be:
            - str/Path: Path to image file
            - numpy.ndarray: Image array
            - PIL.Image: PIL Image object

    Returns:
        ImageAnnotator instance
    """
    try:
        if isinstance(image_source, (str, Path)):
            # File path
            return ImageAnnotator(str(image_source))
        elif isinstance(image_source, np.ndarray):
            # Numpy array
            annotator = ImageAnnotator()
            annotator.set_image(image_source)
            return annotator
        else:
            # Assume PIL Image or compatible
            annotator = ImageAnnotator()
            # Convert PIL to numpy if needed
            if hasattr(image_source, 'mode'):  # PIL Image
                img_array = np.array(image_source)
                if image_source.mode == 'RGB':
                    img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                annotator.set_image(img_array)
            else:
                annotator.set_image(image_source)
            return annotator
    except Exception as e:
        ColorPrint.red(f"[ImageAnnotatorHelper] Error creating annotator: {e}")
        raise

def get_image_pil(annotator: ImageAnnotator) -> Image.Image:
    """
    Get annotated image as PIL Image

    Converts ImageAnnotator's BGR numpy array to PIL Image in RGB format

    Args:
        annotator: ImageAnnotator instance

    Returns:
        PIL Image in RGB format
    """
    try:
        # Get numpy array in BGR format from annotator
        bgr = annotator.get_image()

        # Convert BGR to RGB (OpenCV uses BGR, PIL uses RGB)
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

        # Convert to PIL Image
        return Image.fromarray(rgb)
    except Exception as e:
        ColorPrint.red(f"[ImageAnnotatorHelper] Error converting to PIL Image: {e}")
        raise

def draw_info_texts(
    annotator: ImageAnnotator,
    info_items: List[Dict],
    start_y: int = 30,
    line_height: int = 40,
    default_font_scale: float = 0.6,
    default_color: Tuple[int, int, int] = (255, 255, 255)
) -> int:
    """
    Draw multiple information text lines

    Args:
        annotator: ImageAnnotator instance
        info_items: List of dicts with keys: text, bg_color (str or tuple), font_scale (optional)
        start_y: Starting Y position
        line_height: Height between lines
        default_font_scale: Default font scale if not specified
        default_color: Default text color

    Returns:
        Final Y position after drawing all texts
    """
    current_y = start_y

    for item in info_items:
        text = item.get("text", "")
        bg_color_value = item.get("bg_color", "gray")
        font_scale = item.get("font_scale", default_font_scale)
        thickness = item.get("thickness", 2)

        # Convert color name to tuple if needed
        if isinstance(bg_color_value, str):
            bg_color = get_annotation_color(bg_color_value, (128, 128, 128))
        else:
            bg_color = bg_color_value

        annotator.draw_text(
            text=text,
            position=(10, current_y),
            color=default_color,
            font_scale=font_scale,
            thickness=thickness,
            background_color=bg_color
        )

        current_y += line_height

    return current_y

def draw_grid_overlay(
    annotator: ImageAnnotator,
    rows: int,
    cols: int,
    top_left: Optional[Tuple[int, int]] = None,
    bottom_right: Optional[Tuple[int, int]] = None,
    grid_color: str = "gray",
    thickness: int = 1
) -> None:
    """
    Draw grid overlay on image

    Args:
        annotator: ImageAnnotator instance
        rows: Number of rows
        cols: Number of columns
        top_left: Top-left corner (x, y), None for full image
        bottom_right: Bottom-right corner (x, y), None for full image
        grid_color: Grid line color name
        thickness: Line thickness
    """
    try:
        if top_left is None or bottom_right is None:
            # Draw grid on full image
            annotator.draw_grid_full(
                rows=rows,
                cols=cols,
                color=get_annotation_color(grid_color),
                thickness=thickness
            )
        else:
            # Draw grid in specified region
            annotator.draw_grid(
                top_left=top_left,
                bottom_right=bottom_right,
                rows=rows,
                cols=cols,
                color=get_annotation_color(grid_color),
                thickness=thickness
            )
    except Exception as e:
        ColorPrint.red(f"[ImageAnnotatorHelper] Error drawing grid overlay: {e}")
        import traceback
        traceback.print_exc()

def draw_match_result(
    annotator: ImageAnnotator,
    match_result: Dict,
    name: str,
    color: Tuple[int, int, int] = (0, 255, 0),
    template_path: Optional[str] = None,
    draw_template: bool = True,
    template_position: Optional[Tuple[int, int]] = None
) -> None:
    """
    Draw a template match result on the annotator

    Args:
        annotator: ImageAnnotator instance
        match_result: Match result dict with keys: center, polygon, match_score
        name: Name of the template
        color: Color for drawing (B, G, R)
        template_path: Path to template image (optional)
        draw_template: Whether to draw template image on annotation
        template_position: Position to draw template (x, y), if None will use default
    """
    try:
        if match_result is None or len(match_result) == 0:
            ColorPrint.yellow(f"[ImageAnnotatorHelper] No match result for {name}")
            return

        # Get match info
        center = match_result.get("center")
        polygon = match_result.get("polygon")
        score = match_result.get("match_score", 0.0)

        if center is None or (isinstance(center, np.ndarray) and center.size == 0):
            ColorPrint.yellow(f"[ImageAnnotatorHelper] No center in match result for {name}")
            return

        center_x, center_y = int(center[0]), int(center[1])

        # Draw polygon if available
        if polygon is not None and (not isinstance(polygon, np.ndarray) or polygon.size > 0):
            annotator.draw_polygon(
                points=polygon,
                color=color,
                thickness=3
            )

        # Draw center point
        annotator.draw_circle(
            center=(center_x, center_y),
            radius=8,
            color=color,
            thickness=-1  # Filled
        )

        # Draw crosshair
        annotator.draw_line(
            start=(center_x - 15, center_y),
            end=(center_x + 15, center_y),
            color=(255, 255, 255),
            thickness=2
        )
        annotator.draw_line(
            start=(center_x, center_y - 15),
            end=(center_x, center_y + 15),
            color=(255, 255, 255),
            thickness=2
        )

        # Draw label near the match
        label_text = f"{name} ({score:.3f})"
        annotator.draw_text(
            text=label_text,
            position=(center_x + 15, center_y - 10),
            color=(255, 255, 255),
            font_scale=0.5,
            thickness=2,
            background_color=color
        )

        # Draw coordinate text
        coord_text = f"({center_x}, {center_y})"
        annotator.draw_text(
            text=coord_text,
            position=(center_x + 20, center_y + 20),
            color=(255, 255, 0),  # Cyan
            font_scale=0.5,
            thickness=1,
            background_color=(0, 0, 0)
        )

        # Draw template image if requested
        if draw_template and template_path and Path(template_path).exists():
            try:
                template_img = cv2.imread(str(template_path))
                if template_img is not None:
                    # Use provided position or default to top-left
                    pos = template_position if template_position else (10, 184)  # was (10, 300) at 1826x1301

                    annotator.draw_image(
                        image=template_img,
                        position=pos
                    )

                    # Draw template name below the image
                    template_label = f"{name}.png"
                    annotator.draw_text(
                        text=template_label,
                        position=(pos[0], pos[1] + template_img.shape[0] + 20),
                        color=(255, 255, 255),
                        font_scale=0.4,
                        thickness=1,
                        background_color=color
                    )
            except Exception as e:
                ColorPrint.yellow(f"[ImageAnnotatorHelper] Could not load template {template_path}: {e}")

    except Exception as e:
        ColorPrint.red(f"[ImageAnnotatorHelper] Error drawing match result: {e}")
        import traceback
        traceback.print_exc()


def save_match_debug_image(
    image_source,
    match: Dict,
    label: str,
    output_dir: Path,
    template_path: Optional[str] = None,
    color: Optional[Tuple[int, int, int]] = None,
    filename_prefix: str = "match_debug",
) -> Optional[Path]:
    """
    Draw match result on image and save to output_dir. Generic for any template match debug.
    Returns saved path or None.
    """
    if image_source is None or not match:
        return None
    if color is None:
        color = (0, 255, 0)
    try:
        annotator = create_annotator(image_source)
        draw_match_result(
            annotator,
            match_result=match,
            name=label,
            color=color,
            template_path=template_path,
            draw_template=True,
            template_position=(10, 10),
        )
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        path = output_dir / f"{filename_prefix}_{label}_{ts}.png"
        annotator.save(str(path))
        ColorPrint.blue(f"[ImageAnnotatorHelper] Debug image saved: {path}")
        return path
    except Exception as e:
        ColorPrint.red(f"[ImageAnnotatorHelper] Debug image save error: {e}")
        return None


def save_no_match_debug_image(
    image_source,
    method_name: str,
    output_dir: Path,
    template_path: Optional[str] = None,
    filename_prefix: str = "no_match_debug",
) -> Optional[Path]:
    """
    Draw template icon and "METHOD: no match" text, save to output_dir. Generic for feature-method failures.
    Returns saved path or None.
    """
    if image_source is None:
        return None
    try:
        annotator = create_annotator(image_source)
        pos = (10, 10)
        if template_path and Path(template_path).exists():
            template_img = cv2.imread(str(template_path))
            if template_img is not None:
                annotator.draw_image(image=template_img, position=pos)
                pos = (pos[0], pos[1] + template_img.shape[0] + 8)
        annotator.draw_text(
            text=f"{method_name}: no match",
            position=pos,
            color=(255, 255, 255),
            font_scale=0.6,
            thickness=2,
            background_color=(0, 0, 255),
        )
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        path = output_dir / f"{filename_prefix}_{method_name}_no_match_{ts}.png"
        annotator.save(str(path))
        ColorPrint.blue(f"[ImageAnnotatorHelper] Debug image saved: {path}")
        return path
    except Exception as e:
        ColorPrint.red(f"[ImageAnnotatorHelper] Debug image save error: {e}")
        return None


def save_click_debug_image(
    image_source,
    click_points: List[Tuple],
    output_dir: Path,
    filename_prefix: str = "click_debug",
    radius: int = 12,
) -> Optional[Path]:
    """
    Draw click points on screenshot and save as debug image.
    click_points: list of (x, y) in image coords, or (x, y, label_str). Labels drawn above point.
    Returns saved path or None.
    """
    if image_source is None or not click_points:
        return None
    try:
        annotator = create_annotator(image_source)
        colors = [get_annotation_color(name) for name in COLOR_SEQUENCE[: len(click_points)]]
        for i, pt in enumerate(click_points):
            if len(pt) >= 3:
                x, y, label = int(pt[0]), int(pt[1]), str(pt[2])
            else:
                x, y, label = int(pt[0]), int(pt[1]), str(i + 1)
            color = colors[i] if i < len(colors) else get_annotation_color("green")
            annotator.draw_circle((x, y), radius, color=color, thickness=2, filled=False)
            annotator.draw_text(
                text=label,
                position=(max(0, x - 10), max(0, y - radius - 4)),
                color=color,
                font_scale=0.5,
                thickness=1,
                background_color=(0, 0, 0),
            )
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        path = output_dir / f"{filename_prefix}_{ts}.png"
        annotator.save(str(path))
        ColorPrint.blue(f"[ImageAnnotatorHelper] Click debug image saved: {path}")
        return path
    except Exception as e:
        ColorPrint.red(f"[ImageAnnotatorHelper] Click debug save error: {e}")
        return None


def draw_match_results(
    annotator: ImageAnnotator,
    match_results: List[Dict],
    save_path: Optional[Path] = None,
    summary_text: Optional[str] = None,
    summary_color: str = "green",
    show_not_found: bool = True,
    not_found_start_y: int = 30,
    auto_color: bool = True
) -> None:
    """
    Draw multiple match results and optionally save annotated image

    Args:
        annotator: ImageAnnotator instance
        match_results: List of dicts with keys: match_result, name, color (optional), template_path
        save_path: Path to save annotated image (optional, if None will not save)
        summary_text: Summary text to display at top (optional)
        summary_color: Color name for summary text background (from ANNOTATION_COLORS)
        show_not_found: Whether to show "NOT FOUND" messages for missing matches
        not_found_start_y: Y position to start showing "NOT FOUND" messages
        auto_color: If True, automatically assign colors to items without color specified
    """
    try:
        # Draw summary text if provided
        if summary_text:
            summary_bg_color = get_annotation_color(summary_color, (0, 255, 0))
            annotator.draw_text(
                text=summary_text,
                position=(10, 30),
                color=(255, 255, 255),
                font_scale=0.8,
                thickness=2,
                background_color=summary_bg_color
            )

        # Track not found items
        not_found_items = []
        found_items = []

        # Separate found and not found items
        for idx, result_info in enumerate(match_results):
            match_result = result_info.get("match_result")
            name = result_info.get("name", f"Match_{idx}")

            # Check if match result is valid (not None, not empty dict, has center)
            is_found = (
                match_result is not None
                and len(match_result) > 0
                and match_result.get("center") is not None
                and (not isinstance(match_result.get("center"), np.ndarray) or match_result.get("center").size > 0)
            )

            if is_found:
                found_items.append((idx, result_info))
            else:
                not_found_items.append((idx, result_info))

        # Draw found items (layout scaled from 300/100 at 1826x1301)
        template_y_offset = 184   # was 300 at 1826x1301
        template_row_step = 61   # was 100 at 1826x1301
        for list_idx, (original_idx, result_info) in enumerate(found_items):
            match_result = result_info.get("match_result")
            name = result_info.get("name", f"Match_{list_idx}")
            color_value = result_info.get("color")
            template_path = result_info.get("template_path")

            # Auto-assign color if not provided and auto_color is enabled
            if color_value is None and auto_color:
                color = get_auto_color(original_idx)
            elif color_value is not None:
                # Convert color name to tuple if needed
                if isinstance(color_value, str):
                    color = get_annotation_color(color_value, (0, 255, 0))
                else:
                    color = color_value
            else:
                # Fallback to green if auto_color is disabled
                color = get_annotation_color("green")

            # Calculate template position
            template_pos = (10, template_y_offset + list_idx * template_row_step)

            draw_match_result(
                annotator=annotator,
                match_result=match_result,
                name=name,
                color=color,
                template_path=template_path,
                draw_template=True,
                template_position=template_pos
            )

        # Draw "NOT FOUND" messages for missing items
        if show_not_found and len(not_found_items) > 0:
            for list_idx, (original_idx, result_info) in enumerate(not_found_items):
                name = result_info.get("name", f"Match_{list_idx}")
                color_value = result_info.get("color")

                # Auto-assign color if not provided and auto_color is enabled
                if color_value is None and auto_color:
                    color = get_auto_color(original_idx)
                elif color_value is not None:
                    # Convert color name to tuple if needed
                    if isinstance(color_value, str):
                        color = get_annotation_color(color_value, (0, 0, 255))
                    else:
                        color = color_value
                else:
                    # Fallback to red if auto_color is disabled
                    color = get_annotation_color("red")

                not_found_text = f"{name}: NOT FOUND"
                annotator.draw_text(
                    text=not_found_text,
                    position=(10, not_found_start_y + list_idx * 30),
                    color=(255, 255, 255),
                    font_scale=0.6,
                    thickness=2,
                    background_color=color
                )

        # Save annotated image if path provided
        if save_path is not None:
            save_path.parent.mkdir(parents=True, exist_ok=True)
            annotator.save(save_path)
            ColorPrint.green(f"[ImageAnnotatorHelper] Saved annotated image: {save_path}")

    except Exception as e:
        ColorPrint.red(f"[ImageAnnotatorHelper] Error drawing match results: {e}")
        import traceback
        traceback.print_exc()

def save_anchor_detection_result(
    annotator: ImageAnnotator,
    anchor_results: List[Dict],
    timestamp: str,
    success: bool,
    save_path: Path,
    window_rect: Optional[Tuple[int, int, int, int]] = None,
    border_line: Optional[Dict] = None
) -> None:
    """
    Save anchor detection result with annotations

    Args:
        annotator: ImageAnnotator instance with loaded image
        anchor_results: List of anchor search results
        timestamp: Timestamp for filename
        success: Whether detection was successful
        save_path: Path to save the annotated image
        window_rect: Optional window rectangle (left, top, width, height)
        border_line: Optional detected border line information
    """
    try:
        ColorPrint.blue("[ImageAnnotatorHelper] Drawing anchor detection results...")

        # Draw border line first (if detected)
        if border_line is not None and len(border_line) > 0:
            ColorPrint.blue(f"[ImageAnnotatorHelper] Drawing detected border line...")
            border_color = get_annotation_color("yellow")
            annotator.draw_line(
                start=(border_line["end_x"], border_line["end_y"]),
                end=(border_line["start_x"], border_line["start_y"]),
                color=border_color,
                thickness=3
            )

            # Draw line info text
            line_info_text = f"Border Line: {border_line['length']}px at y={border_line['start_y']}, Color: {border_line['color']}"
            annotator.draw_text(
                text=line_info_text,
                position=(10, 30),
                color=(255, 255, 255),
                font_scale=0.7,
                thickness=2,
                background_color=border_color
            )

        # Draw each anchor search attempt
        info_y = 60  # Start position for info text
        template_x_offset = 10  # X position for template images
        template_y_offset = 184  # was 300 at 1826x1301

        for idx, anchor in enumerate(anchor_results):
            # Determine color based on found status
            if anchor["found"]:
                color = get_annotation_color("green")
                status_text = "FOUND"
            else:
                color = get_annotation_color("red")
                status_text = "NOT FOUND"

            # Draw info text for each anchor including attempts
            score = anchor.get("score", 0.0)
            threshold = anchor.get("threshold", 0.8)
            attempts = anchor.get("attempts", 0)
            scale = anchor.get("scale")
            match_mode = anchor.get("match_mode", "template")
            position = anchor.get("position")

            # Build info text with position if found
            if anchor["found"] and position is not None:
                pos_x, pos_y = int(position[0]), int(position[1])
                if scale is not None:
                    info_text = f"{anchor['name']}: {status_text} at ({pos_x},{pos_y}) [Mode: {match_mode}] [Score: {score:.3f} / Thresh: {threshold:.2f}] (Attempts: {attempts}, Scale: {scale:.2f}x)"
                else:
                    info_text = f"{anchor['name']}: {status_text} at ({pos_x},{pos_y}) [Mode: {match_mode}] [Score: {score:.3f} / Thresh: {threshold:.2f}] (Attempts: {attempts})"
            else:
                if scale is not None:
                    info_text = f"{anchor['name']}: {status_text} [Mode: {match_mode}] [Score: {score:.3f} / Thresh: {threshold:.2f}] (Attempts: {attempts}, Scale: {scale:.2f}x)"
                else:
                    info_text = f"{anchor['name']}: {status_text} [Mode: {match_mode}] [Score: {score:.3f} / Thresh: {threshold:.2f}] (Attempts: {attempts})"

            annotator.draw_text(
                text=info_text,
                position=(10, info_y + idx * 30),
                color=(255, 255, 255),
                font_scale=0.6,
                thickness=2,
                background_color=color
            )

            # Draw template image
            template_path = anchor.get("template_path")
            if template_path and Path(template_path).exists():
                try:
                    # Load template image
                    template_img = cv2.imread(str(template_path))
                    if template_img is not None:
                        # Calculate position for this template
                        current_y = template_y_offset + idx * 61  # was 100 at 1826x1301

                        # Draw template image on annotation
                        annotator.draw_image(
                            image=template_img,
                            position=(template_x_offset, current_y)
                        )

                        # Draw template name below the image
                        template_label = f"{anchor['name']}.png"
                        annotator.draw_text(
                            text=template_label,
                            position=(template_x_offset, current_y + template_img.shape[0] + 20),
                            color=(255, 255, 255),
                            font_scale=0.4,
                            thickness=1,
                            background_color=color
                        )
                except Exception as e:
                    ColorPrint.yellow(f"[ImageAnnotatorHelper] Could not load template {template_path}: {e}")

            # Draw visual markers if found
            if anchor["found"]:
                pos = anchor["position"]
                center_x, center_y = int(pos[0]), int(pos[1])

                # Draw bounding box if polygon available
                if anchor["polygon"] is not None:
                    polygon = anchor["polygon"]
                    annotator.draw_polygon(
                        points=polygon,
                        color=color,
                        thickness=3
                    )

                    # Draw label near the match
                    annotator.draw_text(
                        text=anchor['name'],
                        position=(center_x + 15, center_y - 10),
                        color=(255, 255, 255),
                        font_scale=0.5,
                        thickness=2,
                        background_color=color
                    )

                # Draw center point
                annotator.draw_circle(
                    center=(center_x, center_y),
                    radius=8,
                    color=color,
                    thickness=-1  # Filled
                )

                # Draw crosshair
                annotator.draw_line(
                    start=(center_x - 15, center_y),
                    end=(center_x + 15, center_y),
                    color=(255, 255, 255),
                    thickness=2
                )
                annotator.draw_line(
                    start=(center_x, center_y - 15),
                    end=(center_x, center_y + 15),
                    color=(255, 255, 255),
                    thickness=2
                )

                # Draw coordinate text
                coord_text = f"({center_x}, {center_y})"
                annotator.draw_text(
                    text=coord_text,
                    position=(center_x + 20, center_y + 20),
                    color=(255, 255, 0),  # Cyan
                    font_scale=0.5,
                    thickness=1,
                    background_color=(0, 0, 0)
                )

        # Draw window rectangle if successful
        if success and window_rect is not None:
            left, top, width, height = window_rect
            annotator.draw_rectangle(
                top_left=(left, top),
                bottom_right=(left + width, top + height),
                color=get_annotation_color("magenta"),
                thickness=3,
                label=f"Game Window: {width}x{height}"
            )

        # Draw summary text
        summary_y = 30
        if success:
            summary_text = f"Anchor Detection: SUCCESS - {len([a for a in anchor_results if a['found']])}/{len(anchor_results)} anchors found"
            summary_color = get_annotation_color("green")
        else:
            summary_text = f"Anchor Detection: FAILED - {len([a for a in anchor_results if a['found']])}/{len(anchor_results)} anchors found"
            summary_color = get_annotation_color("red")

        annotator.draw_text(
            text=summary_text,
            position=(10, summary_y),
            color=(255, 255, 255),
            font_scale=0.8,
            thickness=2,
            background_color=summary_color
        )

        # Save annotated image
        save_path.parent.mkdir(parents=True, exist_ok=True)
        annotator.save(save_path)
        ColorPrint.green(f"[ImageAnnotatorHelper] Saved annotated image: {save_path}")

    except Exception as e:
        ColorPrint.red(f"[ImageAnnotatorHelper] Error saving anchor detection result: {e}")
        import traceback
        traceback.print_exc()

def save_bag_detection_result(
    annotator: ImageAnnotator,
    bag_match: Dict,
    bag_coords: object,
    template_path: str,
    save_path: Path,
    bag_layout: Optional[object] = None
) -> None:
    """
    Save bag detection result with annotations

    Args:
        annotator: ImageAnnotator instance with loaded image
        bag_match: Bag border match result
        bag_coords: Bag coordinates object with top_left, bottom_right, width, height, rows, cols, total_slots
        template_path: Path to bag border template
        save_path: Path to save the annotated image
        bag_layout: Optional bag layout object with layout grid and items dict
    """
    try:
        ColorPrint.blue("[ImageAnnotatorHelper] Drawing bag detection results...")

        # Draw bag border match result
        draw_match_result(
            annotator=annotator,
            match_result=bag_match,
            name="Bag Border",
            color=get_annotation_color("green"),
            template_path=template_path,
            draw_template=True,
            template_position=(10, 184)  # was (10, 300) at 1826x1301
        )

        # Draw final bag rectangle (after offset applied)
        annotator.draw_rectangle(
            top_left=bag_coords.top_left,
            bottom_right=bag_coords.bottom_right,
            color=get_annotation_color("magenta"),
            thickness=3,
            label=f"Bag Area: {bag_coords.width}x{bag_coords.height}"
        )

        # Draw bag layout grid if available
        if bag_layout is not None:
            ColorPrint.blue("[ImageAnnotatorHelper] Drawing bag layout grid...")
            _draw_bag_layout_grid(
                annotator=annotator,
                bag_coords=bag_coords,
                bag_layout=bag_layout
            )

        # Draw bag info text
        bag_info = f"Bag: {bag_coords.rows}x{bag_coords.cols} grid ({bag_coords.total_slots} slots)"
        annotator.draw_text(
            text=bag_info,
            position=(10, 70),
            color=(255, 255, 255),
            font_scale=0.7,
            thickness=2,
            background_color=get_annotation_color("green")
        )

        # Draw summary text
        summary_text = "Bag Detection: SUCCESS"
        annotator.draw_text(
            text=summary_text,
            position=(10, 30),
            color=(255, 255, 255),
            font_scale=0.8,
            thickness=2,
            background_color=get_annotation_color("green")
        )

        # Save annotated image
        save_path.parent.mkdir(parents=True, exist_ok=True)
        annotator.save(save_path)
        ColorPrint.green(f"[ImageAnnotatorHelper] Saved annotated image: {save_path}")

    except Exception as e:
        ColorPrint.red(f"[ImageAnnotatorHelper] Error saving bag detection result: {e}")
        import traceback
        traceback.print_exc()

def _draw_bag_layout_grid(
    annotator: ImageAnnotator,
    bag_coords: object,
    bag_layout: object
) -> None:
    """
    Draw bag layout grid with slot detection results

    Args:
        annotator: ImageAnnotator instance
        bag_coords: Bag coordinates object
        bag_layout: Bag layout object with layout grid and items dict
    """
    try:
        # Quality color mapping (using built-in color palette)
        quality_colors = {
            'empty': get_annotation_color("dark_gray"),
            'legendary_set': get_annotation_color("green"),
            'legendary': get_annotation_color("orange"),
            'rare': get_annotation_color("yellow"),
            'magic': get_annotation_color("blue"),
            'unknown': get_annotation_color("gray")
        }

        # Calculate slot dimensions
        bag_width = bag_coords.width
        bag_height = bag_coords.height
        slot_width = bag_width / bag_coords.cols
        slot_height = bag_height / bag_coords.rows

        top_left_x, top_left_y = bag_coords.top_left

        # Draw grid lines
        ColorPrint.blue("[ImageAnnotatorHelper] Drawing grid lines...")
        grid_color = get_annotation_color("gray")

        # Vertical lines
        for col in range(bag_coords.cols + 1):
            x = int(top_left_x + col * slot_width)
            annotator.draw_line(
                start=(x, top_left_y),
                end=(x, top_left_y + bag_height),
                color=grid_color,
                thickness=1
            )

        # Horizontal lines
        for row in range(bag_coords.rows + 1):
            y = int(top_left_y + row * slot_height)
            annotator.draw_line(
                start=(top_left_x, y),
                end=(top_left_x + bag_width, y),
                color=grid_color,
                thickness=1
            )

        # Draw slot information
        ColorPrint.blue("[ImageAnnotatorHelper] Drawing slot information...")
        layout = bag_layout.layout
        items = bag_layout.items

        for row in range(bag_coords.rows):
            for col in range(bag_coords.cols):
                slot_type = layout[row][col]

                # Skip if this is the bottom part of a 2-slot item
                if slot_type == 'item_2slot_bottom':
                    continue

                # Get slot center position
                center_x = int(top_left_x + (col + 0.5) * slot_width)
                center_y = int(top_left_y + (row + 0.5) * slot_height)

                # Get item info
                item_info = items.get((row, col))
                if not item_info:
                    continue

                item_type = item_info.get('type', 'unknown')
                quality = item_info.get('quality', 'unknown')
                color = quality_colors.get(quality, (128, 128, 128))

                # Draw slot marker based on type
                if item_type == 'empty':
                    # Draw small circle for empty slot
                    annotator.draw_circle(
                        center=(center_x, center_y),
                        radius=5,
                        color=color,
                        thickness=2
                    )
                elif item_type == 'item_1slot':
                    # Draw filled circle for 1-slot item
                    annotator.draw_circle(
                        center=(center_x, center_y),
                        radius=8,
                        color=color,
                        thickness=-1  # Filled
                    )
                    # Draw quality text
                    annotator.draw_text(
                        text=quality[0].upper(),  # First letter of quality
                        position=(center_x - 5, center_y + 5),
                        color=(255, 255, 255),
                        font_scale=0.4,
                        thickness=1
                    )
                elif item_type == 'item_2slot':
                    # Draw rectangle spanning two slots
                    rect_top_left = (
                        int(top_left_x + col * slot_width + 5),
                        int(top_left_y + row * slot_height + 5)
                    )
                    rect_bottom_right = (
                        int(top_left_x + (col + 1) * slot_width - 5),
                        int(top_left_y + (row + 2) * slot_height - 5)
                    )
                    annotator.draw_rectangle(
                        top_left=rect_top_left,
                        bottom_right=rect_bottom_right,
                        color=color,
                        thickness=3
                    )
                    # Draw quality text at center of 2-slot item
                    center_2slot_y = int(top_left_y + (row + 1) * slot_height)
                    annotator.draw_text(
                        text=quality[0].upper(),
                        position=(center_x - 5, center_2slot_y + 5),
                        color=(255, 255, 255),
                        font_scale=0.5,
                        thickness=2
                    )

        ColorPrint.green("[ImageAnnotatorHelper] Bag layout grid drawn successfully")

    except Exception as e:
        ColorPrint.red(f"[ImageAnnotatorHelper] Error drawing bag layout grid: {e}")
        import traceback
        traceback.print_exc()
