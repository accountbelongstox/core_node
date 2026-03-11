#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
对单张 debug_bag_line 区域图用太古/远古算法检测线，同目录输出带绿/白点的图。
用法: python run_line_detect_on_image.py <path_to_slot_image.png>
"""

import sys
from pathlib import Path

_script_dir = Path(__file__).resolve().parent
_d3_check_root = _script_dir.parent
_core_node_root = _d3_check_root.parent.parent
sys.path.insert(0, str(_core_node_root))
sys.path.insert(0, str(_d3_check_root))

from pycore.pyfoundations.third_party import get_third_package_numpy, get_third_package_PIL_Image
from d3utils.debug_bag_hover import (
    _find_line_in_crop,
    _draw_dots_on_matched,
    _pixel_matches_any_ref,
    LINE_PRIMAL_ANCIENT_RGBS,
    LINE_PRIMAL_ANCIENT_TOLERANCE,
    LINE_ANCIENT_RGBS,
)

PIL_Image = get_third_package_PIL_Image()
np = get_third_package_numpy()


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python run_line_detect_on_image.py <path_to_slot_image.png>")
        sys.exit(1)
    src = Path(sys.argv[1])
    if not src.is_file():
        print(f"Not a file: {src}")
        sys.exit(1)

    img = PIL_Image.open(str(src))
    if img.mode != "RGB":
        img = img.convert("RGB")
    crop_array = np.array(img)

    h_crop, w_crop = crop_array.shape[0], crop_array.shape[1]
    # 区域图即“槽左侧搜索区”，槽左缘在图右侧；整幅宽度都搜
    left_edge_x_in_crop = max(0, w_crop - 2)
    center_y_in_crop = h_crop / 2.0
    search_length = float(w_crop)

    kind, height, primal_xy, ancient_xy = _find_line_in_crop(
        crop_array, left_edge_x_in_crop, center_y_in_crop, search_length
    )

    # 若未找到线，全图扫一遍太古/远古色并打点，便于看图上到底有没有匹配色
    if not primal_xy and not ancient_xy:
        for y in range(h_crop):
            for x in range(w_crop):
                pixel = tuple(int(v) for v in crop_array[y, x])
                if _pixel_matches_any_ref(pixel, LINE_PRIMAL_ANCIENT_RGBS, LINE_PRIMAL_ANCIENT_TOLERANCE):
                    primal_xy.append((x, y))
                elif _pixel_matches_any_ref(pixel, LINE_ANCIENT_RGBS):
                    ancient_xy.append((x, y))

    line_label = "unknown"
    if kind == "orange" and height is not None:
        line_label = f"primal_{height}"
    elif kind == "ancient" and height is not None:
        line_label = f"ancient_{height}"
    elif primal_xy or ancient_xy:
        line_label = "full_scan"
    else:
        line_label = "normal"

    if primal_xy or ancient_xy:
        _draw_dots_on_matched(crop_array, primal_xy, ancient_xy)

    out_name = src.stem + "_line_" + line_label + src.suffix
    out_path = src.parent / out_name
    PIL_Image.fromarray(crop_array.astype(np.uint8), mode="RGB").save(str(out_path))
    print(f"kind={kind} height={height} primal_pts={len(primal_xy)} ancient_pts={len(ancient_xy)} -> {out_path}")


if __name__ == "__main__":
    main()
