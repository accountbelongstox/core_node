# -*- coding: utf-8 -*-
"""
Slot quality classification from game window image (primal / ancient / normal).
Uses line and dot detection; no dependency on controller.
"""

from typing import Tuple, Optional, List

from pycore.pyfoundations.third_party import get_third_package_numpy

numpy = get_third_package_numpy()
np = numpy

# Primal Ancient line RGBs (same as scripts/slot_line_scan_columns.py DEFAULT_PRIMAL_BGRS as RGB)
LINE_PRIMAL_ANCIENT_RGBS = [
    (0x86, 0x0A, 0x0D), (0x97, 0x0A, 0x0D), (0x92, 0x0A, 0x08), (0x8C, 0x0A, 0x09),
    (0x99, 0x0B, 0x08), (0xA1, 0x0B, 0x0E), (0x9A, 0x0B, 0x08), (0x5B, 0x09, 0x08),
    (0x4A, 0x08, 0x08), (0x39, 0x07, 0x07), (0x2C, 0x04, 0x06), (0x3A, 0x07, 0x04),
    (0x5C, 0x09, 0x08),     (0x45, 0x07, 0x06),
]
LINE_PRIMAL_ANCIENT_TOLERANCE = 0.10
LINE_ANCIENT_RGBS = [
    (0xBA, 0x70, 0x01), (0x9E, 0x61, 0x08), (0xA2, 0x64, 0x08), (0x78, 0x44, 0x03),
    (0x54, 0x30, 0x07), (0x7F, 0x47, 0x05), (0xB7, 0x72, 0x08), (0x74, 0x42, 0x03),
    (0x84, 0x48, 0x02), (0x87, 0x4D, 0x07), (0x42, 0x24, 0x08), (0x61, 0x38, 0x08),
    (0x5B, 0x39, 0x02),
]
LINE_BRIGHTNESS_TOLERANCE = 0.10
MIN_LINE_HEIGHT_PX = 5


def _pixel_matches_ref(
    pixel: Tuple[int, int, int],
    ref_rgb: Tuple[int, int, int],
    tolerance: Optional[float] = None,
) -> bool:
    tol = tolerance if tolerance is not None else LINE_BRIGHTNESS_TOLERANCE
    r, g, b = ref_rgb
    lo, hi = 1.0 - tol, 1.0 + tol
    pr, pg, pb = pixel[0], pixel[1], pixel[2]
    return r * lo <= pr <= r * hi and g * lo <= pg <= g * hi and b * lo <= pb <= b * hi


def _pixel_matches_any_ref(
    pixel: Tuple[int, int, int],
    ref_rgbs: list,
    tolerance: Optional[float] = None,
) -> bool:
    tol = tolerance if tolerance is not None else LINE_BRIGHTNESS_TOLERANCE
    for ref in ref_rgbs:
        if _pixel_matches_ref(pixel, tuple(ref), tol):
            return True
    return False


def _full_crop_scan_primal_ancient(crop_array: "np.ndarray") -> Tuple[List[Tuple[int, int]], List[Tuple[int, int]]]:
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
    h_crop, w_crop = crop_array.shape[0], crop_array.shape[1]
    x_start = min(int(left_edge_x_in_crop), w_crop - 1)
    x_end = max(0, int(left_edge_x_in_crop - search_length))
    if x_start < 0 or x_end >= w_crop or h_crop <= 0:
        return (None, None, *_full_crop_scan_primal_ancient(crop_array))

    x_found = None
    kind_found = None
    ref_found = None
    y_seed = None
    for x in range(x_start, x_end - 1, -1):
        if x < 0:
            break
        for y in range(0, h_crop):
            pixel = tuple(int(v) for v in crop_array[y, x])
            if _pixel_matches_any_ref(pixel, LINE_PRIMAL_ANCIENT_RGBS, LINE_PRIMAL_ANCIENT_TOLERANCE):
                x_found, kind_found = x, "orange"
                ref_found = (LINE_PRIMAL_ANCIENT_RGBS, LINE_PRIMAL_ANCIENT_TOLERANCE)
                y_seed = y
                break
            if _pixel_matches_any_ref(pixel, LINE_ANCIENT_RGBS):
                x_found, kind_found = x, "ancient"
                ref_found = (LINE_ANCIENT_RGBS, LINE_BRIGHTNESS_TOLERANCE)
                y_seed = y
                break
        if kind_found == "orange":
            break

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
    if (y_bottom - y_top + 1) < MIN_LINE_HEIGHT_PX:
        return (None, None, *_full_crop_scan_primal_ancient(crop_array))

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

    primal_xy = []
    ancient_xy = []
    for y in range(y_strip_top, y_strip_bottom + 1):
        pixel = tuple(int(v) for v in crop_array[y, x_found])
        if _pixel_matches_any_ref(pixel, LINE_PRIMAL_ANCIENT_RGBS, LINE_PRIMAL_ANCIENT_TOLERANCE):
            primal_xy.append((x_found, y))
        elif _pixel_matches_any_ref(pixel, LINE_ANCIENT_RGBS):
            ancient_xy.append((x_found, y))
    height = y_bottom - y_top + 1
    return (kind_found, height, primal_xy, ancient_xy)


def _crop_search_region(
    img_array: "np.ndarray",
    top_left: Tuple[int, int],
    slot_width: float,
    slot_height: float,
    r: int,
    c: int,
) -> "np.ndarray":
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
    Returns "primal" | "ancient" | "normal".
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


__all__ = [
    "classify_slot_quality_from_window",
    "_find_line_in_crop",
    "_crop_search_region",
    "_pixel_matches_any_ref",
    "LINE_PRIMAL_ANCIENT_RGBS",
    "LINE_PRIMAL_ANCIENT_TOLERANCE",
    "LINE_ANCIENT_RGBS",
    "LINE_BRIGHTNESS_TOLERANCE",
    "MIN_LINE_HEIGHT_PX",
]
