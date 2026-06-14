# -*- coding: utf-8 -*-
"""
Debug: Reuse collect_bag_info result; hover slots left-to-right top-to-bottom; print type/quality and line detection.
Per slot: move mouse to slot -> wait for hover to settle -> capture game window (screenshot just before hover ends)
-> run line detection and save region temp image from that in-memory capture. Computation no longer depends on mouse.
No controller import: blacksmith debug list is invoked via optional on_blacksmith_debug callback (injected by UI).
"""

import time
from datetime import datetime
from pathlib import Path
from typing import Tuple, Optional, List, Callable

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.pybasecommon.encyclopedia import ENCYCLOPEDIA
from pycore.pyfoundations.third_party import get_third_package_win32api, get_third_package_numpy, get_third_package_PIL_Image
from pycore.pyutils.input.click_handler import ClickHandler
from d3utils.click_handler_singleton import get_click_handler
from pycore.pyutils.common.window_finder import WindowFinder
from providor.constants.common import (
    DEBUG_BAG_HOVER_FOCUS_CLICK_DURATION_SEC,
    DEBUG_BAG_HOVER_FOCUS_CLICK_PAUSE_AFTER_MOVE_SEC,
    DEBUG_BAG_HOVER_FOCUS_CLICK_RETURN_TO_ORIGINAL,
    DEBUG_BAG_LINE_DIR,
    FLOW_IMAGES_IN_MEMORY_ONLY,
)
from share.game_interface_data import get_game_interface_data, get_scaled_game_focus_click_point
from share.bag_data_hub import get_coordinates as get_bag_coordinates, get_layout as get_bag_layout
from d3utils.d3_manager import get_d3_manager
from d3utils.interface_manager import get_d3_interface_manager
from providor.providor_index import DIABLO_III_WINDOW_TITLES
from d3utils.screenshot_provider import get_screenshot_provider
from d3utils.slot_quality import (
    _find_line_in_crop,
    _crop_search_region,
    _pixel_matches_any_ref,
    LINE_PRIMAL_ANCIENT_RGBS,
    LINE_PRIMAL_ANCIENT_TOLERANCE,
    LINE_ANCIENT_RGBS,
    LINE_BRIGHTNESS_TOLERANCE,
    MIN_LINE_HEIGHT_PX,
)

PIL_Image = get_third_package_PIL_Image()

win32api = get_third_package_win32api()
numpy = get_third_package_numpy()
np = numpy

# Seconds to wait after moving to slot before capture (hover just before end)
HOVER_SETTLE_BEFORE_CAPTURE_SEC = 0.3


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


def run_debug_bag_hover(on_blacksmith_debug: Optional[Callable[[], None]] = None) -> bool:
    """
    Reuse bag detection result; hover each equipped slot left-to-right top-to-bottom and print (row,col) type quality; restore mouse at end.
    Only item_1slot / item_2slot; skip empty and item_2slot_bottom (two-slot item hovered once).
    When interface_type is blacksmith and on_blacksmith_debug is provided, call it to run handle_auto_salvage_by_slots(..., debug_only=False) and execute real salvage (tab + slot + salvage + confirm).
    """
    if not win32api:
        ColorPrint.red("[DebugBagHover] win32api not available")
        return False

    coords = get_bag_coordinates()
    layout = get_bag_layout()
    if not coords or not layout or not (layout.items if layout else None):
        ColorPrint.blue("[DebugBagHover] No bag data, refreshing from screenshot (collect_bag_info_quik)...")
        get_d3_interface_manager().collect_bag_info_quik(force_new_capture=True, save_screenshot=False)
        coords = get_bag_coordinates()
        layout = get_bag_layout()
    else:
        ColorPrint.blue("[DebugBagHover] Reusing existing bag layout (no new capture)")
    shared = get_game_interface_data()

    if not coords or not layout or not layout.items:
        ColorPrint.red("[DebugBagHover] Still no bag coordinates/layout")
        return False

    interface_type = shared.interface_type
    ColorPrint.blue(f"[DebugBagHover] Interface: {interface_type or 'none (bag only or unknown)'}")
    if interface_type == "blacksmith" and on_blacksmith_debug:
        on_blacksmith_debug()

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
        window_offset = shared.window_offset
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
        gs = shared.game_window_size
        if gs and gs[0] > 0 and gs[1] > 0:
            game_window_size = gs
        elif shared.game_window_image:
            game_window_size = (shared.game_window_image.width, shared.game_window_image.height)
        else:
            game_window_size = (0, 0)
        window_w = game_window_size[0]
        window_h = game_window_size[1]
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
                if not FLOW_IMAGES_IN_MEMORY_ONLY:
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
