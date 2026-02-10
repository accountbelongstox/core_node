#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
中性颜色匹配：将两张模板图等比缩放到宽4px，提取最多5个中性色，用颜色在大图中查找，只匹配一个位置，支持±色差。
"""

from pathlib import Path
from typing import List, Tuple, Optional

import sys
_script_dir = Path(__file__).resolve().parent
_d3_check_root = _script_dir.parent
_core_node_root = _d3_check_root.parent.parent
sys.path.insert(0, str(_core_node_root))
sys.path.insert(0, str(_d3_check_root))

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy
cv2 = get_third_package_cv2()
np = get_third_package_numpy()

from providor.constants.common import TEMPLATE_DIR

TARGET_WIDTH = 4
MAX_NEUTRAL_COLORS = 5
DEFAULT_TOLERANCE = 15  # ± 色差（每通道绝对值）


def scale_to_width(img: np.ndarray, width: int) -> np.ndarray:
    """等比缩小，使宽为 width 像素。"""
    h, w = img.shape[:2]
    if w <= width:
        return img
    scale = width / w
    new_w = width
    new_h = max(1, int(h * scale))
    return cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)


def get_neutral_colors(img: np.ndarray, max_n: int = MAX_NEUTRAL_COLORS) -> List[Tuple[int, int, int]]:
    """
    从缩小后的图取最多 max_n 个“中性”代表色。用 k-means 聚类取主色；若像素太少则按出现频率取。
    颜色为 BGR。
    """
    if img is None or img.size == 0:
        return []
    h, w = img.shape[:2]
    # 只取前 3 通道，忽略 alpha
    if img.ndim == 3 and img.shape[2] >= 3:
        pixels = img[:, :, :3].reshape(-1, 3).astype(np.float32)
    else:
        pixels = np.expand_dims(img.ravel(), axis=1).astype(np.float32)
        pixels = np.repeat(pixels, 3, axis=1)
    n_pixels = pixels.shape[0]
    if n_pixels == 0:
        return []
    k = min(max_n, n_pixels)
    if k < 1:
        return []
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
    _, labels, centers = cv2.kmeans(pixels, k, None, criteria, 3, cv2.KMEANS_PP_CENTERS)
    centers = np.clip(centers, 0, 255).astype(np.uint8)
    # 按该簇像素数排序，取前 max_n 个
    counts = np.bincount(labels.ravel(), minlength=k)
    order = np.argsort(-counts)[:max_n]
    out = []
    for i in order:
        out.append(tuple(int(c) for c in centers[i].tolist()))
    return out


def color_in_range(bgr: np.ndarray, color: Tuple[int, int, int], tol: int) -> bool:
    """单像素是否在 color 的 ±tol 范围内（每通道）。"""
    b, g, r = color
    if bgr.ndim >= 2:
        bgr = bgr.reshape(-1, 3)
    return np.all(np.abs(bgr.astype(np.int16) - (b, g, r)) <= tol)


def count_matching_pixels(region: np.ndarray, colors: List[Tuple[int, int, int]], tol: int) -> int:
    """区域内有落在任一颜色±tol范围内的像素数（同一像素只计一次）。"""
    if region.ndim == 2:
        region = cv2.cvtColor(region, cv2.COLOR_GRAY2BGR)
    combined = np.zeros(region.shape[:2], dtype=np.uint8)
    for c in colors:
        lo = np.array([max(0, c[0] - tol), max(0, c[1] - tol), max(0, c[2] - tol)], dtype=np.uint8)
        hi = np.array([min(255, c[0] + tol), min(255, c[1] + tol), min(255, c[2] + tol)], dtype=np.uint8)
        mask = cv2.inRange(region, lo, hi)
        combined = cv2.bitwise_or(combined, mask)
    return int(np.count_nonzero(combined))


def build_color_mask(img: np.ndarray, colors: List[Tuple[int, int, int]], tol: int) -> np.ndarray:
    """用提取的色在整图上做反查，返回二值图 mask（255=匹配任一颜色±tol）。"""
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    combined = np.zeros(img.shape[:2], dtype=np.uint8)
    for c in colors:
        lo = np.array([max(0, c[0] - tol), max(0, c[1] - tol), max(0, c[2] - tol)], dtype=np.uint8)
        hi = np.array([min(255, c[0] + tol), min(255, c[1] + tol), min(255, c[2] + tol)], dtype=np.uint8)
        mask = cv2.inRange(img, lo, hi)
        combined = cv2.bitwise_or(combined, mask)
    return combined


def find_single_match(
    haystack: np.ndarray,
    colors: List[Tuple[int, int, int]],
    tw: int,
    th: int,
    tolerance: int = DEFAULT_TOLERANCE,
    min_ratio: float = 0.5,
) -> Optional[Tuple[int, int]]:
    """
    在大图 haystack 上用颜色找与模板大小 tw x th 的窗口，只返回一个匹配位置。
    要求窗口内“大部分”像素落在 colors 的 ±tolerance 内（min_ratio 为匹配像素占比下限）。
    只保留得分最高的一处。
    """
    if not colors or tw <= 0 or th <= 0:
        return None
    H, W = haystack.shape[:2]
    if tw > W or th > H:
        return None
    total_pixels = tw * th
    best_xy: Optional[Tuple[int, int]] = None
    best_count = -1
    for y in range(0, H - th + 1):
        for x in range(0, W - tw + 1):
            region = haystack[y : y + th, x : x + tw]
            cnt = count_matching_pixels(region, colors, tolerance)
            if cnt >= min_ratio * total_pixels and cnt > best_count:
                best_count = cnt
                best_xy = (x, y)
    return best_xy


def load_image(path: Path) -> Optional[np.ndarray]:
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    return img


def build_template_descriptor(
    template_path: Path,
    tolerance: int = DEFAULT_TOLERANCE,
) -> Optional[Tuple[np.ndarray, List[Tuple[int, int, int]], int, int]]:
    """
    加载模板，等比缩放到宽 TARGET_WIDTH，提取最多 5 个中性色。
    返回 (缩放后小图, 颜色列表, 原图宽, 原图高)，用于在大图上用原尺寸窗口匹配。
    """
    img = load_image(template_path)
    if img is None:
        return None
    orig_h, orig_w = img.shape[:2]
    small = scale_to_width(img, TARGET_WIDTH)
    colors = get_neutral_colors(small, MAX_NEUTRAL_COLORS)
    return (small, colors, orig_w, orig_h)


def find_template_in_image(
    haystack: np.ndarray,
    template_path: Path,
    tolerance: int = DEFAULT_TOLERANCE,
    min_ratio: float = 0.5,
) -> Optional[Tuple[int, int]]:
    """
    在 haystack 中查找模板（primal_native 或 ancient_native），只返回一个匹配 (x, y)。
    模板会先缩放到宽 4px 取色，再用原图尺寸做滑动窗口匹配。
    """
    desc = build_template_descriptor(template_path, tolerance)
    if desc is None:
        return None
    _, colors, tw, th = desc
    return find_single_match(haystack, colors, tw, th, tolerance, min_ratio)


def visualize_reverse_lookup(
    template_path: Path,
    output_dir: Path,
    tolerance: int = DEFAULT_TOLERANCE,
    min_ratio: float = 0.5,
) -> None:
    """
    用提取的色在模板图上反查：生成颜色匹配 mask 图、叠加效果图、以及用 find_single_match 标出匹配框。
    """
    img = load_image(template_path)
    if img is None:
        return
    small = scale_to_width(img, TARGET_WIDTH)
    colors = get_neutral_colors(small, MAX_NEUTRAL_COLORS)
    if not colors:
        return
    h, w = img.shape[:2]
    mask = build_color_mask(img, colors, tolerance)
    match_xy = find_single_match(img, colors, w, h, tolerance, min_ratio)
    stem = template_path.stem
    output_dir.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output_dir / f"{stem}_mask.png"), mask)
    overlay = img.copy()
    overlay[mask > 0] = overlay[mask > 0] * 0.5 + np.array([0, 255, 0], dtype=np.uint8) * 0.5
    if match_xy is not None:
        x, y = match_xy
        cv2.rectangle(overlay, (x, y), (x + w, y + h), (0, 255, 255), 2)
        cv2.putText(overlay, "match", (x, y - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
    cv2.imwrite(str(output_dir / f"{stem}_reverse.png"), overlay)
    ratio = np.count_nonzero(mask) / (w * h)
    print(f"{stem}: colors={colors}, match_xy={match_xy}, mask_ratio={ratio:.2%}, out={output_dir}")


def main():
    images_dir = Path(TEMPLATE_DIR)
    templates = [
        ("primal_native", images_dir / "primal_native.png"),
        ("ancient_native", images_dir / "ancient_native.png"),
    ]
    out_dir = images_dir / "neutral_color_reverse"
    for name, path in templates:
        if not path.exists():
            print(f"skip {name}: not found {path}")
            continue
        img = load_image(path)
        if img is None:
            print(f"skip {name}: failed to load")
            continue
        small = scale_to_width(img, TARGET_WIDTH)
        colors = get_neutral_colors(small, MAX_NEUTRAL_COLORS)
        print(f"{name} ({path.name}): size {img.shape[1]}x{img.shape[0]} -> 4x{small.shape[0]}, colors={colors}")
        visualize_reverse_lookup(path, out_dir, DEFAULT_TOLERANCE, 0.5)
    print("usage: find_template_in_image(haystack_bgr, path_to_primal_native_or_ancient_native, tolerance=15, min_ratio=0.5)")


if __name__ == "__main__":
    main()
