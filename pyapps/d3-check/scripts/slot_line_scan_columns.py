#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
用太古线色对目标图逐列扫描：每列看能否扫出一条线（连续匹配段 >= MIN_LINE_HEIGHT_PX）；
若没有则显示该列最长的一段。颜色固定用本文件 DEFAULT_PRIMAL_BGRS，不从参考图提取。
"""

import sys
from pathlib import Path
from typing import List, Tuple

_script_dir = Path(__file__).resolve().parent
_d3_check_root = _script_dir.parent
_core_node_root = _d3_check_root.parent.parent
sys.path.insert(0, str(_core_node_root))
sys.path.insert(0, str(_d3_check_root))

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy
cv2 = get_third_package_cv2()
np = get_third_package_numpy()

MIN_LINE_HEIGHT_PX = 10
COLOR_TOLERANCE_RATIO = 0.10  # ±10%
TARGET_DIR = r"C:\Users\accou\.core_node\pytools\tmp\debug_bag_line\run_20260208_040800"
TARGET_NAME = "slot_r2_c0_normal_legendary.png"

# 太古线色 BGR（本脚本唯一颜色来源）：#860A0D #970A0D #920A08 #8C0A09 #990B08 #A10B0E #9A0B08 #5B0908 #4A0808 #390707 #2C0406 #3A0704 #5C0908 #450706
DEFAULT_PRIMAL_BGRS = [
    (13, 10, 134),   # #860A0D
    (13, 10, 151),   # #970A0D
    (8, 10, 146),    # #920A08
    (9, 10, 140),    # #8C0A09
    (8, 11, 153),    # #990B08
    (14, 11, 161),   # #A10B0E
    (8, 11, 154),    # #9A0B08
    (8, 9, 91),      # #5B0908
    (8, 8, 74),      # #4A0808
    (7, 7, 57),      # #390707
    (6, 4, 44),      # #2C0406
    (4, 7, 58),      # #3A0704
    (8, 9, 92),      # #5C0908
    (6, 7, 69),      # #450706
]


def build_mask_relative(img: np.ndarray, colors: List[Tuple[int, int, int]], ratio: float = 0.10) -> np.ndarray:
    """匹配任一颜色 ±ratio（每通道），返回二值 mask 0/255。"""
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    out = np.zeros(img.shape[:2], dtype=np.uint8)
    for c in colors:
        lo = np.array([max(0, int(c[i] * (1 - ratio))) for i in range(3)], dtype=np.uint8)
        hi = np.array([min(255, int(c[i] * (1 + ratio) + 0.5)) for i in range(3)], dtype=np.uint8)
        out = np.maximum(out, cv2.inRange(img, lo, hi))
    return out


def vertical_runs_in_column(mask: np.ndarray, x: int) -> List[Tuple[int, int, int]]:
    """第 x 列中所有连续 255 的区间，返回 [(y_start, y_end, length), ...]。"""
    col = mask[:, x]
    h = len(col)
    runs = []
    y = 0
    while y < h:
        if col[y] == 0:
            y += 1
            continue
        start = y
        while y < h and col[y]:
            y += 1
        runs.append((start, y - 1, y - start))
    return runs


def scan_columns(
    mask: np.ndarray,
    min_height: int = MIN_LINE_HEIGHT_PX,
) -> Tuple[List[Tuple[int, int, int, int, int]], List[Tuple[int, int, int, int, int]]]:
    """逐列扫描。lines=扫到的线(length>=min_height)，fallbacks=该列最长段。"""
    h, w = mask.shape
    lines = []
    fallbacks = []
    for x in range(w):
        runs = vertical_runs_in_column(mask, x)
        if not runs:
            continue
        best = max(runs, key=lambda r: r[2])
        y0, y1, length = best[0], best[1], best[2]
        if length >= min_height:
            lines.append((x, y0, y1, length, x))
        else:
            fallbacks.append((x, y0, y1, length, x))
    return lines, fallbacks


def main() -> None:
    target_dir = Path(TARGET_DIR)
    target_name = TARGET_NAME
    if len(sys.argv) >= 2:
        arg = Path(sys.argv[1]).resolve()
        if arg.is_file():
            target_dir, target_name = arg.parent, arg.name
        else:
            target_dir = arg
    target_path = target_dir / target_name
    if not target_path.exists():
        print("not found:", target_path)
        sys.exit(1)
    img = cv2.imread(str(target_path))
    if img is None:
        print("failed to load:", target_path)
        sys.exit(2)
    h, w = img.shape[:2]
    colors = list(DEFAULT_PRIMAL_BGRS)
    print("colors (BGR) count:", len(colors), "tolerance: ±10%")
    mask = build_mask_relative(img, colors, COLOR_TOLERANCE_RATIO)
    lines, fallbacks = scan_columns(mask, MIN_LINE_HEIGHT_PX)
    print("columns with line (run>=%d):" % MIN_LINE_HEIGHT_PX, len(lines))
    for t in lines[:20]:
        print("  x=%d y=[%d,%d] len=%d" % (t[0], t[1], t[2], t[3]))
    if len(lines) > 20:
        print("  ... and", len(lines) - 20, "more")
    print("columns without full line, longest run:", len(fallbacks))
    for t in fallbacks[:20]:
        print("  x=%d y=[%d,%d] len=%d" % (t[0], t[1], t[2], t[3]))
    if len(fallbacks) > 20:
        print("  ... and", len(fallbacks) - 20, "more")
    out = img.copy()
    for (x, y0, y1, length, _) in lines:
        cv2.line(out, (x, y0), (x, y1), (0, 255, 0), 1)
    for (x, y0, y1, length, _) in fallbacks:
        cv2.line(out, (x, y0), (x, y1), (0, 200, 255), 1)
    out_dir = target_dir / "slot_line_scan"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_name = target_path.name.replace(".png", "_scan.png")
    out_path = out_dir / out_name
    cv2.imwrite(str(out_path), out)
    print("wrote", out_path, "(green=line, orange=longest run)")


if __name__ == "__main__":
    main()
