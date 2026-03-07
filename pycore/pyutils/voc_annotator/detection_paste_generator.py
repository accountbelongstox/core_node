# -*- coding: utf-8 -*-
"""
Detection dataset by pasting small images (patches) onto large background images.
Copied/adapted from pyutils.ultralytics.dataset_generator_yolo DetectionDatasetGenerator;
no cross-import so voc_annotator stays self-contained.
Output: YOLO format (class x_center y_center width height normalized [0,1]).
"""

import os
import random
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy
from pycore.pyutils.common import ultralytics_comm

cv2 = get_third_package_cv2()
np = get_third_package_numpy()


def generate_detection_by_paste(
    background_image_paths: List[str],
    patch_items: List[Tuple[str, int]],
    class_names: List[str],
    output_images_dir: str,
    output_labels_dir: str,
    num_images: int = 50,
    patches_per_image: Tuple[int, int] = (2, 8),
    aug_config: Optional[Dict] = None,
    image_format: str = "png",
) -> int:
    """
    Generate detection dataset by pasting small patch images onto random backgrounds.
    background_image_paths: paths to large images (backgrounds).
    patch_items: list of (patch_file_path, class_id). Patch path can be absolute or relative.
    class_names: used only to ensure class_id is valid; output labels use class_id.
    output_images_dir, output_labels_dir: where to write images and .txt labels.
    num_images: number of synthetic images to generate.
    patches_per_image: (min, max) patches to paste per image.
    aug_config: optional {allow_scale, scale_range, allow_stretch, allow_rotation, rotation_range, color_jitter}.
    Returns count of images written.
    """
    aug_config = aug_config or {}
    scale_range = aug_config.get("scale_range", [0.6, 1.4])
    stretch_x_range = aug_config.get("stretch_x_range", [0.8, 1.2])
    stretch_y_range = aug_config.get("stretch_y_range", [0.9, 1.1])
    rotation_range = aug_config.get("rotation_range", [-15, 15])
    allow_scale = aug_config.get("allow_scale", True)
    allow_stretch = aug_config.get("allow_stretch", True)
    allow_rotation = aug_config.get("allow_rotation", True)
    color_jitter = aug_config.get("color_jitter", True)

    backgrounds = []
    for p in background_image_paths:
        img = cv2.imread(p)
        if img is not None:
            backgrounds.append(img)
    if not backgrounds:
        return 0

    patches = []
    for path, cid in patch_items:
        img = cv2.imread(path)
        if img is not None and 0 <= cid < len(class_names):
            patches.append({"image": img, "class_id": cid})
    if not patches:
        return 0

    os.makedirs(output_images_dir, exist_ok=True)
    os.makedirs(output_labels_dir, exist_ok=True)
    min_p, max_p = patches_per_image
    if max_p < min_p:
        max_p = min_p
    count = 0
    for img_idx in range(num_images):
        bg = random.choice(backgrounds).copy()
        h, w = bg.shape[:2]
        n_paste = random.randint(min_p, min(max_p, len(patches)))
        chosen = random.sample(patches, n_paste)
        annotations = []
        for patch_info in chosen:
            patch = patch_info["image"].copy()
            ph, pw = patch.shape[:2]
            if allow_scale:
                s = random.uniform(scale_range[0], scale_range[1])
                nw = max(10, int(pw * s))
                nh = max(5, int(ph * s))
                patch = cv2.resize(patch, (nw, nh))
            else:
                nh, nw = patch.shape[:2]
            if allow_stretch:
                sx = random.uniform(stretch_x_range[0], stretch_x_range[1])
                sy = random.uniform(stretch_y_range[0], stretch_y_range[1])
                nw = max(10, int(nw * sx))
                nh = max(5, int(nh * sy))
                patch = cv2.resize(patch, (nw, nh))
            if allow_rotation and nw > 5 and nh > 5:
                angle = random.uniform(rotation_range[0], rotation_range[1])
                abs_cos = abs(np.cos(np.radians(angle)))
                abs_sin = abs(np.sin(np.radians(angle)))
                rw = int(nh * abs_sin + nw * abs_cos)
                rh = int(nh * abs_cos + nw * abs_sin)
                M = cv2.getRotationMatrix2D((nw // 2, nh // 2), angle, 1.0)
                M[0, 2] += (rw - nw) / 2
                M[1, 2] += (rh - nh) / 2
                patch = cv2.warpAffine(patch, M, (rw, rh), borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
                nw, nh = rw, rh
            if color_jitter:
                patch = ultralytics_comm.color_jitter(patch)
            if nw >= w or nh >= h:
                continue
            x = random.randint(0, max(0, w - nw))
            y = random.randint(0, max(0, h - nh))
            bg[y : y + nh, x : x + nw] = patch
            cx = (x + nw / 2) / w
            cy = (y + nh / 2) / h
            nw_n = nw / w
            nh_n = nh / h
            annotations.append(
                ultralytics_comm.format_detection_line(patch_info["class_id"], cx, cy, nw_n, nh_n)
            )
        out_name = "syn_%04d" % img_idx
        img_path = os.path.join(output_images_dir, out_name + "." + image_format)
        lbl_path = os.path.join(output_labels_dir, out_name + ".txt")
        cv2.imwrite(img_path, bg)
        with open(lbl_path, "w", encoding="utf-8") as f:
            f.write("\n".join(annotations) + "\n")
        count += 1
    return count
