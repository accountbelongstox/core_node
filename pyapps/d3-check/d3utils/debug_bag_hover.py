# -*- coding: utf-8 -*-
"""
Debug: Reuse collect_bag_info result; hover slots left-to-right top-to-bottom; print type/quality and line detection.
Per slot: move mouse to slot -> wait for hover to settle -> capture game window (screenshot just before hover ends)
-> run line detection and save region temp image from that in-memory capture. Computation no longer depends on mouse.
"""

import time
from datetime import datetime
from pathlib import Path
from typing import Tuple, Optional, List

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.third_party import get_third_package_win32api, get_third_package_numpy, get_third_package_PIL_Image
from pycore.pyutils.click_handler import ClickHandler
from d3utils.click_handler_singleton import get_click_handler
from pycore.pyutils.common.window_finder import WindowFinder
from providor.constants.common import (
    DEBUG_BAG_HOVER_FOCUS_CLICK_DURATION_SEC,
    DEBUG_BAG_HOVER_FOCUS_CLICK_PAUSE_AFTER_MOVE_SEC,
    DEBUG_BAG_HOVER_FOCUS_CLICK_RETURN_TO_ORIGINAL,
    DEBUG_BAG_LINE_DIR,
)
from share.game_interface_data import get_game_interface_data, get_scaled_game_focus_click_point
from d3utils.d3_manager import get_d3_manager
from d3utils.interface_manager import get_d3_interface_manager
from providor.providor_index import DIABLO_III_WINDOW_TITLES
from d3utils.screenshot_provider import get_screenshot_provider

PIL_Image = get_third_package_PIL_Image()

win32api = get_third_package_win32api()
numpy = get_third_package_numpy()
np = numpy

# Primal Ancient line: same as scripts/slot_line_scan_columns.py DEFAULT_PRIMAL_BGRS (as RGB). Any +/- 7%
LINE_PRIMAL_ANCIENT_RGBS = [
    (0x86, 0x0A, 0x0D),  # #860A0D
    (0x97, 0x0A, 0x0D),  # #970A0D
    (0x92, 0x0A, 0x08),  # #920A08
    (0x8C, 0x0A, 0x09),  # #8C0A09
    (0x99, 0x0B, 0x08),  # #990B08
    (0xA1, 0x0B, 0x0E),  # #A10B0E
    (0x9A, 0x0B, 0x08),  # #9A0B08
    (0x5B, 0x09, 0x08),  # #5B0908
    (0x4A, 0x08, 0x08),  # #4A0808
    (0x39, 0x07, 0x07),  # #390707
    (0x2C, 0x04, 0x06),  # #2C0406
    (0x3A, 0x07, 0x04),  # #3A0704
    (0x5C, 0x09, 0x08),  # #5C0908
    (0x45, 0x07, 0x06),  # #450706
]
LINE_PRIMAL_ANCIENT_TOLERANCE = 0.10
# Ancient line: any of these RGB +/- 10%
LINE_ANCIENT_RGBS = [
    (0xBA, 0x70, 0x01),  # #BA7001
    (0x9E, 0x61, 0x08),  # #9E6108
    (0xA2, 0x64, 0x08),  # #A26408
    (0x78, 0x44, 0x03),  # #784403
    (0x54, 0x30, 0x07),  # #543007
    (0x7F, 0x47, 0x05),  # #7F4705
    # additional ancient colors
    (0xB7, 0x72, 0x08),  # #B77208
    (0x74, 0x42, 0x03),  # #744203
    (0x84, 0x48, 0x02),  # #844802
    (0x87, 0x4D, 0x07),  # #874D07
    (0x42, 0x24, 0x08),  # #422408
    (0x61, 0x38, 0x08),  # #613808
    (0x5B, 0x39, 0x02),  # #5B3902
]
LINE_BRIGHTNESS_TOLERANCE = 0.10
# Line must have at least this height (px) to count as primal/ancient; below = use full-scan dots only
MIN_LINE_HEIGHT_PX = 5
# Seconds to wait after moving to slot before capture (hover just before end)
HOVER_SETTLE_BEFORE_CAPTURE_SEC = 0.3


def _pixel_matches_ref(
    pixel: Tuple[int, int, int],
    ref_rgb: Tuple[int, int, int],
    tolerance: Optional[float] = None,
) -> bool:
    """True if pixel RGB matches ref_rgb within tolerance per channel (default LINE_BRIGHTNESS_TOLERANCE)."""
    tol = tolerance if tolerance is not None else LINE_BRIGHTNESS_TOLERANCE
    r, g, b = ref_rgb
    lo = 1.0 - tol
    hi = 1.0 + tol
    pr, pg, pb = pixel[0], pixel[1], pixel[2]
    return (
        r * lo <= pr <= r * hi
        and g * lo <= pg <= g * hi
        and b * lo <= pb <= b * hi
    )


def _pixel_matches_any_ref(
    pixel: Tuple[int, int, int],
    ref_rgbs: list,
    tolerance: Optional[float] = None,
) -> bool:
    """True if pixel matches any reference RGB within tolerance per channel."""
    tol = tolerance if tolerance is not None else LINE_BRIGHTNESS_TOLERANCE
    for ref in ref_rgbs:
        if _pixel_matches_ref(pixel, tuple(ref), tol):
            return True
    return False


def _find_line_left_of_slot(
    img_array: "np.ndarray",
    top_left: Tuple[int, int],
    slot_width: float,
    slot_height: float,
    rows: int,
    cols: int,
    r: int,
    c: int,
) -> Tuple[Optional[str], Optional[int]]:
    """
    Ancient / Primal Ancient line detection: from slot left outer edge, search left for 50% slot width;
    if a matching pixel is found, extend upward and downward to get line height. See
    docs/BAG_SLOT_ANCIENT_LINE_DETECTION.md for the full algorithm.
    Returns ("orange", height), ("ancient", height), or (None, None).
    """
    h_img, w_img = img_array.shape[0], img_array.shape[1]
    left_edge_x = top_left[0] + c * slot_width
    center_y = top_left[1] + (r + 0.5) * slot_height
    search_length = 0.5 * slot_width
    x_start = int(left_edge_x)
    x_end = int(left_edge_x - search_length)
    if x_end < 0:
        x_end = 0
    y_center = int(center_y)
    if y_center < 0 or y_center >= h_img:
        return (None, None)

    # Search leftward: first pixel matching primal (7%) or any ancient (10%) color
    x_found = None
    kind_found = None
    ref_found = None  # (ref_rgbs_list, tolerance)
    for x in range(x_start, x_end - 1, -1):
        if x < 0:
            break
        pixel = tuple(int(v) for v in img_array[y_center, x])
        if _pixel_matches_any_ref(pixel, LINE_PRIMAL_ANCIENT_RGBS, LINE_PRIMAL_ANCIENT_TOLERANCE):
            x_found = x
            kind_found = "orange"
            ref_found = (LINE_PRIMAL_ANCIENT_RGBS, LINE_PRIMAL_ANCIENT_TOLERANCE)
            break
        if _pixel_matches_any_ref(pixel, LINE_ANCIENT_RGBS):
            x_found = x
            kind_found = "ancient"
            ref_found = (LINE_ANCIENT_RGBS, LINE_BRIGHTNESS_TOLERANCE)
            break

    if x_found is None or kind_found is None or ref_found is None:
        return (None, None)

    ref_list, ref_tol = ref_found
    # Extend vertically with same color set and tolerance
    y_top = y_center
    for y in range(y_center - 1, -1, -1):
        pixel = tuple(int(v) for v in img_array[y, x_found])
        if _pixel_matches_any_ref(pixel, ref_list, ref_tol):
            y_top = y
        else:
            break
    y_bottom = y_center
    for y in range(y_center + 1, h_img):
        pixel = tuple(int(v) for v in img_array[y, x_found])
        if _pixel_matches_any_ref(pixel, ref_list, ref_tol):
            y_bottom = y
        else:
            break
    height = y_bottom - y_top + 1
    if height < MIN_LINE_HEIGHT_PX:
        return (None, None)
    return (kind_found, height)


def _search_region_bounds(
    top_left: Tuple[int, int],
    slot_width: float,
    slot_height: float,
    r: int,
    c: int,
    window_w: int,
    window_h: int,
) -> Tuple[int, int, int, int, float, float]:
    """
    Return (x_min, y_min, x_max, y_max, left_edge_x, center_y) in window coords for the slot search region.
    Used to compute screen rect for native region capture and crop-relative coords for line detection.
    """
    left_edge_x = top_left[0] + c * slot_width
    search_length = 0.5 * slot_width
    center_y = top_left[1] + (r + 0.5) * slot_height
    margin_y = 1.5 * slot_height
    x_min = max(0, int(left_edge_x - search_length))
    x_max = min(window_w, int(left_edge_x) + 10)
    y_min = max(0, int(center_y - margin_y))
    y_max = min(window_h, int(center_y + margin_y) + 1)
    return (x_min, y_min, x_max, y_max, left_edge_x, center_y)


def _full_crop_scan_primal_ancient(crop_array: "np.ndarray") -> Tuple[List[Tuple[int, int]], List[Tuple[int, int]]]:
    """Full-crop pixel scan for primal/ancient colors; returns (primal_xy, ancient_xy)."""
    h_crop, w_crop = crop_array.shape[0], crop_array.shape[1]
    primal_xy: List[Tuple[int, int]] = []
    ancient_xy: List[Tuple[int, int]] = []
    for y in range(h_crop):
        for x in range(w_crop):
            pixel = tuple(int(v) for v in crop_array[y, x])
            if _pixel_matches_any_ref(pixel, LINE_PRIMAL_ANCIENT_RGBS, LINE_PRIMAL_ANCIENT_TOLERANCE):
                primal_xy.append((x, y))
            elif _pixel_matches_any_ref(pixel, LINE_ANCIENT_RGBS):
                ancient_xy.append((x, y))
    return (primal_xy, ancient_xy)


def _find_line_in_crop(
    crop_array: "np.ndarray",
    left_edge_x_in_crop: float,
    center_y_in_crop: float,
    search_length: float,
) -> Tuple[Optional[str], Optional[int], List[Tuple[int, int]], List[Tuple[int, int]]]:
    """
    Run ancient/primal line detection inside a pre-cropped region image (crop = search area).
    Returns (kind, height, primal_matched_xy, ancient_matched_xy).
    When no line is found (no match or height < MIN), falls back to full-crop scan so dots are still drawn.
    """
    h_crop, w_crop = crop_array.shape[0], crop_array.shape[1]
    x_start = min(int(left_edge_x_in_crop), w_crop - 1)
    x_end = max(0, int(left_edge_x_in_crop - search_length))
    if x_start < 0 or x_end >= w_crop or h_crop <= 0:
        return (None, None, *_full_crop_scan_primal_ancient(crop_array))

    # Scan left from slot left edge; each column x scanned full y; record ancient then keep scanning for primal.
    x_found = None
    kind_found = None
    ref_found = None
    y_seed = None  # first matched row for vertical extent
    for x in range(x_start, x_end - 1, -1):
        if x < 0:
            break
        for y in range(0, h_crop):
            pixel = tuple(int(v) for v in crop_array[y, x])
            if _pixel_matches_any_ref(pixel, LINE_PRIMAL_ANCIENT_RGBS, LINE_PRIMAL_ANCIENT_TOLERANCE):
                x_found = x
                kind_found = "orange"
                ref_found = (LINE_PRIMAL_ANCIENT_RGBS, LINE_PRIMAL_ANCIENT_TOLERANCE)
                y_seed = y
                break
            if _pixel_matches_any_ref(pixel, LINE_ANCIENT_RGBS):
                x_found = x
                kind_found = "ancient"
                ref_found = (LINE_ANCIENT_RGBS, LINE_BRIGHTNESS_TOLERANCE)
                y_seed = y
                break
        if kind_found == "orange":
            break
        # ancient: do not break, continue next column for primal

    if x_found is None or kind_found is None or ref_found is None or y_seed is None:
        return (None, None, *_full_crop_scan_primal_ancient(crop_array))

    ref_list, ref_tol = ref_found
    y_top = y_seed
    for y in range(y_seed - 1, -1, -1):
        pixel = tuple(int(v) for v in crop_array[y, x_found])
        if _pixel_matches_any_ref(pixel, ref_list, ref_tol):
            y_top = y
        else:
            break
    y_bottom = y_seed
    for y in range(y_seed + 1, h_crop):
        pixel = tuple(int(v) for v in crop_array[y, x_found])
        if _pixel_matches_any_ref(pixel, ref_list, ref_tol):
            y_bottom = y
        else:
            break
    height = y_bottom - y_top + 1
    if height < MIN_LINE_HEIGHT_PX:
        return (None, None, *_full_crop_scan_primal_ancient(crop_array))

    # Expand strip to include any pixel matching primal OR ancient (mixed lines get both dots)
    y_strip_top = y_top
    for y in range(y_top - 1, -1, -1):
        pixel = tuple(int(v) for v in crop_array[y, x_found])
        if _pixel_matches_any_ref(pixel, LINE_PRIMAL_ANCIENT_RGBS, LINE_PRIMAL_ANCIENT_TOLERANCE) or _pixel_matches_any_ref(pixel, LINE_ANCIENT_RGBS):
            y_strip_top = y
        else:
            break
    y_strip_bottom = y_bottom
    for y in range(y_bottom + 1, h_crop):
        pixel = tuple(int(v) for v in crop_array[y, x_found])
        if _pixel_matches_any_ref(pixel, LINE_PRIMAL_ANCIENT_RGBS, LINE_PRIMAL_ANCIENT_TOLERANCE) or _pixel_matches_any_ref(pixel, LINE_ANCIENT_RGBS):
            y_strip_bottom = y
        else:
            break

    # Per-pixel classification in strip: primal=green, ancient=white
    primal_xy: List[Tuple[int, int]] = []
    ancient_xy: List[Tuple[int, int]] = []
    for y in range(y_strip_top, y_strip_bottom + 1):
        pixel = tuple(int(v) for v in crop_array[y, x_found])
        if _pixel_matches_any_ref(pixel, LINE_PRIMAL_ANCIENT_RGBS, LINE_PRIMAL_ANCIENT_TOLERANCE):
            primal_xy.append((x_found, y))
        elif _pixel_matches_any_ref(pixel, LINE_ANCIENT_RGBS):
            ancient_xy.append((x_found, y))

    return (kind_found, height, primal_xy, ancient_xy)


def _crop_search_region(
    img_array: "np.ndarray",
    top_left: Tuple[int, int],
    slot_width: float,
    slot_height: float,
    r: int,
    c: int,
) -> "np.ndarray":
    """Crop the search region (left of slot, 50% width + vertical margin) for saving as temp debug image."""
    h_img, w_img = img_array.shape[0], img_array.shape[1]
    left_edge_x = top_left[0] + c * slot_width
    search_length = 0.5 * slot_width
    center_y = top_left[1] + (r + 0.5) * slot_height
    margin_y = 1.5 * slot_height
    x_min = max(0, int(left_edge_x - search_length))
    x_max = min(w_img, int(left_edge_x) + 10)
    y_min = max(0, int(center_y - margin_y))
    y_max = min(h_img, int(center_y + margin_y) + 1)
    return np.ascontiguousarray(img_array[y_min:y_max, x_min:x_max])


def classify_slot_quality_from_window(
    img_array: "np.ndarray",
    top_left: Tuple[int, int],
    slot_width: float,
    slot_height: float,
    r: int,
    c: int,
) -> str:
    """
    Classify a bag slot as primal / ancient / normal from full game window image (RGB numpy).
    Reuses line/dot detection. Returns "primal" | "ancient" | "normal".
    """
    crop = _crop_search_region(img_array, top_left, slot_width, slot_height, r, c)
    if crop.size == 0:
        return "normal"
    left_edge_x = top_left[0] + c * slot_width
    center_y = top_left[1] + (r + 0.5) * slot_height
    search_length = 0.5 * slot_width
    margin_y = 1.5 * slot_height
    x_min = max(0, int(left_edge_x - search_length))
    y_min = max(0, int(center_y - margin_y))
    left_edge_x_in_crop = left_edge_x - x_min
    center_y_in_crop = center_y - y_min
    kind, height, primal_xy, ancient_xy = _find_line_in_crop(
        crop, left_edge_x_in_crop, center_y_in_crop, search_length
    )
    if kind == "orange" or (primal_xy and len(primal_xy) > 0):
        return "primal"
    if kind == "ancient" or (ancient_xy and len(ancient_xy) > 0):
        return "ancient"
    return "normal"


def _draw_dots_on_matched(
    img_array: "np.ndarray",
    primal_xy: List[Tuple[int, int]],
    ancient_xy: List[Tuple[int, int]],
    radius: int = 2,
) -> None:
    """Draw green dots at primal pixels, white dots at ancient pixels. Modifies img_array in place (RGB)."""
    h, w = img_array.shape[0], img_array.shape[1]
    green = np.array([0, 255, 0], dtype=img_array.dtype)
    white = np.array([255, 255, 255], dtype=img_array.dtype)

    for (x, y) in primal_xy:
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                if dx * dx + dy * dy <= radius * radius:
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w:
                        img_array[ny, nx] = green
    for (x, y) in ancient_xy:
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                if dx * dx + dy * dy <= radius * radius:
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w:
                        img_array[ny, nx] = white


def _save_region_temp_image(region: "np.ndarray", out_path: Path) -> None:
    """Save region array (RGB uint8) to PNG."""
    if region.size == 0:
        return
    pil_img = PIL_Image.fromarray(region.astype(np.uint8), mode="RGB")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pil_img.save(str(out_path))


def run_debug_bag_hover() -> bool:
    """
    Reuse bag detection result; hover each equipped slot left-to-right top-to-bottom and print (row,col) type quality; restore mouse at end.
    Only item_1slot / item_2slot; skip empty and item_2slot_bottom (two-slot item hovered once).
    """
    if not win32api:
        ColorPrint.red("[DebugBagHover] win32api not available")
        return False

    shared = get_game_interface_data()
    coords = getattr(shared, "bag_coordinates", None)
    layout = getattr(shared, "bag_layout", None)

    if not coords or not layout or not getattr(layout, "items", None):
        ColorPrint.blue("[DebugBagHover] No bag data, running collect_bag_info_quik...")
        get_d3_interface_manager().collect_bag_info_quik(force_new_capture=True, save_screenshot=False)
        shared = get_game_interface_data()
        coords = getattr(shared, "bag_coordinates", None)
        layout = getattr(shared, "bag_layout", None)
    else:
        ColorPrint.blue("[DebugBagHover] Reusing existing bag layout (no new capture)")

    if not coords or not layout or not getattr(layout, "items", None):
        ColorPrint.red("[DebugBagHover] Still no bag coordinates/layout")
        return False

    # Debug: do not use cached window position; get in real time
    titles = list(get_d3_manager().get_capture_titles()) or list(DIABLO_III_WINDOW_TITLES)
    WindowFinder.invalidate_window_cache(titles)
    provider = get_screenshot_provider()
    sd = provider.gen(use_optimized_capture=True, window_titles=titles)
    if sd and sd.game_window_image:
        window_offset = sd.window_offset or (0, 0)
        game_window_size = (sd.game_window_size or (sd.game_window_image.width, sd.game_window_image.height))
        shared = get_game_interface_data()
        shared.window_offset = window_offset
        shared.game_window_size = game_window_size
        window_w = game_window_size[0]
        window_h = game_window_size[1]
        ColorPrint.blue("[DebugBagHover] Window position from real-time capture (no cache)")
    else:
        window_offset = getattr(shared, "window_offset", (0, 0))
        window_w = 0
        window_h = 0
        ColorPrint.yellow("[DebugBagHover] Real-time capture failed, using shared window_offset")

    top_left = coords.top_left
    w, h = coords.width, coords.height
    rows, cols = coords.rows, coords.cols
    slot_width = w / cols
    slot_height = h / rows

    try:
        original_pos = win32api.GetCursorPos()
    except OSError as e:
        ColorPrint.red(f"[DebugBagHover] GetCursorPos: {e}")
        return False

    ColorPrint.blue(f"[DebugBagHover] Grid {rows}x{cols} TopLeft={top_left} Size={w}x{h} window_offset={window_offset}")

    # Click game focus point to activate and bring window to top (config: instant move), then move to slot, restore in finally
    focus_cx, focus_cy = get_scaled_game_focus_click_point()
    focus_screen_x = window_offset[0] + focus_cx
    focus_screen_y = window_offset[1] + focus_cy
    clicker = get_click_handler()
    clicker.click(
        focus_screen_x,
        focus_screen_y,
        direct_click=True,
        return_to_original=DEBUG_BAG_HOVER_FOCUS_CLICK_RETURN_TO_ORIGINAL,
        duration=DEBUG_BAG_HOVER_FOCUS_CLICK_DURATION_SEC,
        pause_after_move=DEBUG_BAG_HOVER_FOCUS_CLICK_PAUSE_AFTER_MOVE_SEC,
    )
    time.sleep(0.2)
    # Left to right, top to bottom: by row then column; only hover equipped slots (item_1slot / item_2slot)
    slots_to_hover = []
    for r in range(rows):
        for c in range(cols):
            info = layout.items.get((r, c))
            if not info:
                continue
            slot_type = info.get("type")
            if slot_type not in ("item_1slot", "item_2slot"):
                continue
            slots_to_hover.append((r, c, info))
    run_ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    debug_out_dir = DEBUG_BAG_LINE_DIR / f"run_{run_ts}"
    ColorPrint.blue(f"[DebugBagHover] Region temp images -> {debug_out_dir}")

    if window_w <= 0 or window_h <= 0:
        game_window_size = getattr(shared, "game_window_size", None) or (getattr(shared, "game_window_image", None) and (shared.game_window_image.width, shared.game_window_image.height)) or (0, 0)
        window_w = game_window_size[0] if game_window_size else 0
        window_h = game_window_size[1] if game_window_size else 0
    if window_w <= 0 or window_h <= 0:
        cached = None
        for t in titles:
            if not t:
                continue
            cache_key = "window_cache_%s" % t.lower()
            cached = ENCYCLOPEDIA.get(cache_key)
            if cached and isinstance(cached, dict):
                break
        if not cached and get_d3_manager().prime_window_cache_for_capture():
            canonical = (titles[0].lower() if titles else "d3")
            cached = ENCYCLOPEDIA.get("window_cache_%s" % canonical)
        if cached and isinstance(cached, dict) and (window_w <= 0 or window_h <= 0):
            window_w = cached.get("width") or 0
            window_h = cached.get("height") or 0
            if window_w > 0 and window_h > 0:
                shared = get_game_interface_data()
                shared.game_window_size = (window_w, window_h)
        if window_w <= 0 or window_h <= 0:
            ColorPrint.yellow("[DebugBagHover] Game window size unknown; one full capture to get size")
            one = provider.gen(use_optimized_capture=True, window_titles=titles)
            if one and one.game_window_image:
                window_w, window_h = one.game_window_image.width, one.game_window_image.height
                shared = get_game_interface_data()
                setattr(shared, "game_window_size", (window_w, window_h))
    ColorPrint.blue(f"[DebugBagHover] Hovering {len(slots_to_hover)} slots; native region capture per slot (realtime window, no fullscreen crop).")

    search_length = 0.5 * slot_width

    try:
        for (r, c, info) in slots_to_hover:
            quality = info.get("quality", "?")
            slot_type = info.get("type", "?")

            item_x_screen = int(window_offset[0] + top_left[0] + (c + 0.5) * slot_width)
            item_y_screen = int(window_offset[1] + top_left[1] + (r + 0.5) * slot_height)
            win32api.SetCursorPos((item_x_screen, item_y_screen))
            time.sleep(HOVER_SETTLE_BEFORE_CAPTURE_SEC)

            x_min, y_min, x_max, y_max, left_edge_x, center_y = _search_region_bounds(
                top_left, slot_width, slot_height, r, c, window_w, window_h
            )
            region_w = x_max - x_min
            region_h = y_max - y_min
            screen_left = window_offset[0] + x_min
            screen_top = window_offset[1] + y_min

            region_pil = provider.capture_region(screen_left, screen_top, region_w, region_h)
            line_str = "normal_legendary"
            safe_label = "normal_legendary"
            if region_pil is not None and region_w > 0 and region_h > 0:
                crop_array = np.array(region_pil)
                left_edge_x_in_crop = left_edge_x - x_min
                center_y_in_crop = center_y - y_min
                kind, height, primal_xy, ancient_xy = _find_line_in_crop(
                    crop_array, left_edge_x_in_crop, center_y_in_crop, search_length
                )
                if kind == "orange" and height is not None:
                    line_str = f"primal line height {height}"
                    safe_label = f"primal_ancient_line_{height}"
                elif kind == "ancient" and height is not None:
                    line_str = f"ancient line height {height}"
                    safe_label = f"ancient_line_{height}"
                elif primal_xy or ancient_xy:
                    if primal_xy:
                        line_str = f"primal ({len(primal_xy)} dots)"
                        safe_label = "primal_dots"
                    else:
                        line_str = f"ancient ({len(ancient_xy)} dots)"
                        safe_label = "ancient_dots"
                else:
                    pass

                if primal_xy or ancient_xy:
                    _draw_dots_on_matched(crop_array, primal_xy, ancient_xy)
                temp_path = debug_out_dir / f"slot_r{r}_c{c}_{safe_label}.png"
                _save_region_temp_image(crop_array, temp_path)
                ColorPrint.gray(f"    -> {temp_path.name}")
            else:
                if region_pil is None:
                    ColorPrint.yellow(f"    [DebugBagHover] Native region capture failed for ({r},{c})")

            ColorPrint.green(f"  ({r},{c}) {slot_type} {quality}  {line_str}")
            time.sleep(0.15)
    finally:
        try:
            win32api.SetCursorPos(original_pos)
            ColorPrint.blue(f"[DebugBagHover] Mouse restored to {original_pos}")
        except OSError as e:
            ColorPrint.yellow(f"[DebugBagHover] Restore cursor: {e}")

    return True
