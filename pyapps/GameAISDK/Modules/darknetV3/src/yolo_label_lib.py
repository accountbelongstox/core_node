# -*- coding: utf-8 -*-
"""
YOLO labeling utilities for use as a library (e.g. by d3-check).
Implements DelUnLabelImg-style sync and VOC XML to YOLO txt conversion.
Reference: GameAISDK doc/YOLO/TrainDetModel.md; scripts/voc_label.py.
All third-party packages (e.g. labelImg) via pycore.pyfoundations.third_party per CODE_STANDARDS.
"""

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from typing import List, Optional, Tuple

# pycore sys.path: required before any pycore import when run from sub-app (GameAISDK/d3-check under core_node)
_dir = os.path.dirname(os.path.abspath(__file__))
while _dir:
    if os.path.isdir(os.path.join(_dir, "pycore")):
        if _dir not in sys.path:
            sys.path.insert(0, _dir)
        break
    _dir = os.path.dirname(_dir)

get_third_package_labelImg = None
try:
    from pycore.pyfoundations.third_party import get_third_package_labelImg
except ImportError:
    pass

# ---------------------------------------------------------------------------
# Clean unlabeled (TrainDetModel.md §4 DelUnLabelImg)
# ---------------------------------------------------------------------------


def clean_unlabeled(
    image_dir: str,
    label_dir: Optional[str] = None,
    image_extensions: Optional[Tuple[str, ...]] = None,
    label_extension: str = ".xml",
) -> Tuple[bool, str]:
    """
    Remove images that have no label file and label files that have no image.
    Keeps image set and label set in 1:1 correspondence by base name.
    Returns (True, "Removed N images, M labels") or (False, error_message).
    """
    if image_extensions is None:
        image_extensions = (".jpg", ".jpeg", ".png", ".bmp")
    if not image_dir or not os.path.isdir(image_dir):
        return False, "image_dir not found or not a directory"
    ann_dir = label_dir if label_dir is not None else image_dir
    if not os.path.isdir(ann_dir):
        return False, "label_dir not found or not a directory"
    image_dir = os.path.abspath(image_dir)
    ann_dir = os.path.abspath(ann_dir)

    def base_name(path: str, ext: str) -> str:
        name = os.path.basename(path)
        if name.lower().endswith(ext.lower()):
            return name[: -len(ext)]
        return name

    try:
        images = [
            f
            for f in os.listdir(image_dir)
            if os.path.isfile(os.path.join(image_dir, f))
            and any(f.lower().endswith(ext) for ext in image_extensions)
        ]
        labels = [
            f
            for f in os.listdir(ann_dir)
            if os.path.isfile(os.path.join(ann_dir, f))
            and f.lower().endswith(label_extension)
        ]
    except OSError as e:
        return False, str(e)

    image_bases = {base_name(f, os.path.splitext(f)[1]) for f in images}
    label_bases = {base_name(f, label_extension) for f in labels}

    to_remove_images = [f for f in images if base_name(f, os.path.splitext(f)[1]) not in label_bases]
    to_remove_labels = [f for f in labels if base_name(f, label_extension) not in image_bases]
    removed_imgs = 0
    removed_lbls = 0
    for f in to_remove_images:
        try:
            os.remove(os.path.join(image_dir, f))
            removed_imgs += 1
        except OSError:
            pass
    for f in to_remove_labels:
        try:
            os.remove(os.path.join(ann_dir, f))
            removed_lbls += 1
        except OSError:
            pass
    return True, "Removed %d images, %d labels" % (removed_imgs, removed_lbls)


# ---------------------------------------------------------------------------
# VOC XML to YOLO txt (TrainDetModel.md §5; same logic as voc_label.py)
# ---------------------------------------------------------------------------


def _convert_box(size: Tuple[int, int], box: Tuple[float, float, float, float]) -> Tuple[float, float, float, float]:
    """
    Convert VOC bndbox (xmin, xmax, ymin, ymax) to YOLO normalized (x_center, y_center, width, height).
    Per Ultralytics and TrainDetModel.md §5: coordinates normalized to [0, 1] by dividing by image width/height.
    """
    w_img, h_img = size[0], size[1]
    if w_img <= 0 or h_img <= 0:
        return (0.0, 0.0, 0.0, 0.0)
    dw = 1.0 / w_img
    dh = 1.0 / h_img
    xmin, xmax, ymin, ymax = box[0], box[1], box[2], box[3]
    x_center = (xmin + xmax) / 2.0
    y_center = (ymin + ymax) / 2.0
    w = xmax - xmin
    h = ymax - ymin
    return (x_center * dw, y_center * dh, w * dw, h * dh)


def voc_annotations_to_yolo_labels(
    annotations_dir: str,
    labels_output_dir: str,
    image_id_list: List[str],
    classes: List[str],
) -> Tuple[bool, str]:
    """
    For each image_id, read annotations_dir/<image_id>.xml (VOC) and write
    labels_output_dir/<image_id>.txt in YOLO format (class_id x_center y_center width height, normalized).
    Skips objects with class not in classes or difficult==1.
    Returns (True, "Converted N files") or (False, error_message).
    """
    if not annotations_dir or not os.path.isdir(annotations_dir):
        return False, "annotations_dir not found or not a directory"
    if not image_id_list:
        return True, "Converted 0 files"
    annotations_dir = os.path.abspath(annotations_dir)
    try:
        os.makedirs(labels_output_dir, exist_ok=True)
    except OSError as e:
        return False, str(e)
    labels_output_dir = os.path.abspath(labels_output_dir)
    converted = 0
    for image_id in image_id_list:
        xml_path = os.path.join(annotations_dir, image_id + ".xml")
        if not os.path.isfile(xml_path):
            continue
        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()
        except (ET.ParseError, OSError):
            continue
        size_el = root.find("size")
        if size_el is None:
            continue
        w_el = size_el.find("width")
        h_el = size_el.find("height")
        if w_el is None or h_el is None or w_el.text is None or h_el.text is None:
            continue
        try:
            w = int(w_el.text)
            h = int(h_el.text)
        except ValueError:
            continue
        lines = []
        for obj in root.iter("object"):
            difficult_el = obj.find("difficult")
            difficult = int(difficult_el.text) if difficult_el is not None and difficult_el.text else 0
            if difficult == 1:
                continue
            cls_el = obj.find("name")
            cls_name = cls_el.text if cls_el is not None else ""
            if cls_name not in classes:
                continue
            cls_id = classes.index(cls_name)
            bndbox = obj.find("bndbox")
            if bndbox is None:
                continue
            xmin_el = bndbox.find("xmin")
            xmax_el = bndbox.find("xmax")
            ymin_el = bndbox.find("ymin")
            ymax_el = bndbox.find("ymax")
            if any(e is None or e.text is None for e in (xmin_el, xmax_el, ymin_el, ymax_el)):
                continue
            try:
                xmin = float(xmin_el.text)
                xmax = float(xmax_el.text)
                ymin = float(ymin_el.text)
                ymax = float(ymax_el.text)
            except ValueError:
                continue
            bb = _convert_box((w, h), (xmin, xmax, ymin, ymax))
            lines.append("%d %.6f %.6f %.6f %.6f" % (cls_id, bb[0], bb[1], bb[2], bb[3]))
        if lines:
            out_path = os.path.join(labels_output_dir, image_id + ".txt")
            try:
                with open(out_path, "w", encoding="utf-8") as f:
                    f.write("\n".join(lines) + "\n")
                converted += 1
            except OSError:
                pass
    return True, "Converted %d files" % converted


# ---------------------------------------------------------------------------
# Pycore JSON to YOLO segment (Ultralytics segment format)
# When pycore voc_annotator is used, annotations are saved as .json per image.
# Segment .txt: one row per object, "class_id x1 y1 x2 y2 ..." normalized [0,1], min 3 points.
# ---------------------------------------------------------------------------


def annotations_to_yolo_segment(
    annotations_dir: str,
    labels_output_dir: str,
    image_id_list: List[str],
    classes: List[str],
) -> Tuple[bool, str]:
    """
    Convert pycore JSON annotations to YOLO segment .txt (Ultralytics format).
    Reads annotations_dir/<image_id>.json (shape_type, label, points); writes
    labels_output_dir/<image_id>.txt with normalized polygon rows. Skips images without JSON.
    Returns (True, "Converted N files") or (False, error_message).
    """
    try:
        from pycore.pyutils.voc_annotator import annotation_io
    except ImportError:
        return False, "pycore not available for segment export"
    if not annotations_dir or not os.path.isdir(annotations_dir):
        return False, "annotations_dir not found or not a directory"
    if not image_id_list:
        return True, "Converted 0 files"
    annotations_dir = os.path.abspath(annotations_dir)
    try:
        os.makedirs(labels_output_dir, exist_ok=True)
    except OSError as e:
        return False, str(e)
    labels_output_dir = os.path.abspath(labels_output_dir)
    converted = 0
    for image_id in image_id_list:
        json_path = os.path.join(annotations_dir, image_id + ".json")
        if not os.path.isfile(json_path):
            continue
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError):
            continue
        shapes = data.get("shapes")
        if not isinstance(shapes, list):
            continue
        size_list = data.get("imageSize")
        if not isinstance(size_list, (list, tuple)) or len(size_list) < 2:
            continue
        image_size = (int(size_list[0]), int(size_list[1]))
        txt_path = os.path.join(labels_output_dir, image_id + ".txt")
        n = annotation_io.export_yolo_segment_txt(txt_path, image_size, shapes, classes)
        if n > 0:
            converted += 1
    return True, "Converted %d files" % converted


# ---------------------------------------------------------------------------
# Launch annotator: prefer pycore voc_annotator (PySide6, GameAISDK VOC); fallback labelImg
# ---------------------------------------------------------------------------

_core_node_root: Optional[str] = None
for _d in [os.path.dirname(os.path.abspath(__file__)), os.getcwd()] + (sys.path or []):
    if _d and os.path.isdir(os.path.join(_d, "pycore")):
        _core_node_root = os.path.abspath(_d)
        break
if _core_node_root is None and "pycore" in sys.modules:
    _m = sys.modules["pycore"]
    _core_node_root = os.path.dirname(os.path.abspath(getattr(_m, "__file__", "") or ""))


def _popen_annotator(cmd: list, cwd: str, timeout_sec: float = 5.0) -> bool:
    """Start annotator process; return True if Popen succeeded and still running after timeout (Qt may start slow)."""
    try:
        p = subprocess.Popen(
            cmd,
            cwd=cwd,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        p.wait(timeout=timeout_sec)
        return False
    except subprocess.TimeoutExpired:
        return True
    except (OSError, ValueError):
        return False


def launch_labelimg(
    images_dir: str,
    save_dir: Optional[str] = None,
    project_name: Optional[str] = None,
    config_path: Optional[str] = None,
) -> Tuple[bool, str]:
    """
    Launch VOC annotator: prefer pycore voc_annotator (PySide6, GameAISDK VOC); fallback to labelImg.
    images_dir = open dir, save_dir = where to save XML (default images_dir).
    project_name and config_path: passed to pycore annotator for shared classes across segments.
    Returns (True, "") or (False, error_message).
    """
    if not images_dir or not os.path.isdir(images_dir):
        return False, "images_dir not found or not a directory"
    images_dir = os.path.abspath(images_dir)
    save = save_dir if save_dir and os.path.isdir(save_dir) else images_dir
    cwd = _core_node_root or os.path.dirname(images_dir) or "."

    # Prefer pycore voc_annotator (PySide6; output GameAISDK VOC XML)
    if _core_node_root and os.path.isdir(os.path.join(_core_node_root, "pycore", "pyutils", "voc_annotator")):
        cmd = [sys.executable, "-m", "pycore.pyutils.voc_annotator", images_dir, save]
        if config_path:
            cmd.extend(["--config", os.path.abspath(config_path)])
        if project_name:
            cmd.extend(["--project-name", project_name])
        if _popen_annotator(cmd, _core_node_root):
            return True, ""

    # Fallback: labelImg (PyQt5)
    if get_third_package_labelImg is None:
        return False, "pycore not on sys.path; add core_node root to sys.path before importing yolo_label_lib"
    mod = get_third_package_labelImg()
    if mod is None:
        return False, "get_third_package_labelImg() returned None"
    pkg_dir = os.path.dirname(os.path.abspath(getattr(mod, "__file__", "") or ""))
    if not pkg_dir or not os.path.isdir(pkg_dir):
        pkg_dir = None
    if pkg_dir:
        for script_name in ("labelImg.py", "__main__.py"):
            script_path = os.path.join(pkg_dir, script_name)
            if os.path.isfile(script_path):
                if _popen_annotator([sys.executable, script_path, images_dir, "", save], cwd):
                    return True, ""
    if _popen_annotator([sys.executable, "-m", "labelImg", images_dir, "", save], cwd):
        return True, ""
    if _popen_annotator([sys.executable, "-m", "labelimg", images_dir, "", save], cwd):
        return True, ""
    if sys.platform == "win32":
        scripts_dir = os.path.join(sys.prefix, "Scripts")
        for name in ("labelimg.exe", "labelImg.exe"):
            exe = os.path.join(scripts_dir, name)
            if os.path.isfile(exe) and _popen_annotator([exe, images_dir, "", save], cwd):
                return True, ""
    for name in ("labelImg", "labelimg"):
        exe = shutil.which(name)
        if exe and _popen_annotator([exe, images_dir, "", save], cwd):
            return True, ""
    return False, "Annotator process exited too soon; try: python -m pycore.pyutils.voc_annotator \"%s\"" % images_dir

