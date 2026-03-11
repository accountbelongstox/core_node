# -*- coding: utf-8 -*-
"""
VOC XML read/write for GameAISDK-compatible Pascal VOC format.
One XML per image; bndbox in pixel coords (xmin, ymin, xmax, ymax).
"""

import os
import xml.etree.ElementTree as ET
from typing import List, Optional, Tuple

from pycore.pyfoundations.third_party import get_third_package_PIL_Image

_PIL_Image = get_third_package_PIL_Image()


def _ensure_int(value: float) -> int:
    return int(round(value))


def image_size_from_file(image_path: str) -> Optional[Tuple[int, int]]:
    """Return (width, height) from image file; None on failure."""
    try:
        img = _PIL_Image.open(image_path)
        w, h = img.size
        img.close()
        return (w, h)
    except OSError:
        return None


def read_boxes_from_voc(xml_path: str) -> List[Tuple[str, int, int, int, int, int]]:
    """
    Read VOC XML; return list of (class_name, xmin, ymin, xmax, ymax, difficult).
    difficult 0/1; bndbox in pixels.
    """
    if not os.path.isfile(xml_path):
        return []
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except (ET.ParseError, OSError):
        return []
    out = []
    for obj in root.iter("object"):
        name_el = obj.find("name")
        name = name_el.text.strip() if name_el is not None and name_el.text else ""
        difficult_el = obj.find("difficult")
        difficult = 0
        if difficult_el is not None and difficult_el.text:
            try:
                difficult = int(difficult_el.text)
            except ValueError:
                pass
        bnd = obj.find("bndbox")
        if bnd is None:
            continue
        xmin_el = bnd.find("xmin")
        ymin_el = bnd.find("ymin")
        xmax_el = bnd.find("xmax")
        ymax_el = bnd.find("ymax")
        if any(e is None or e.text is None for e in (xmin_el, ymin_el, xmax_el, ymax_el)):
            continue
        try:
            xmin = _ensure_int(float(xmin_el.text))
            ymin = _ensure_int(float(ymin_el.text))
            xmax = _ensure_int(float(xmax_el.text))
            ymax = _ensure_int(float(ymax_el.text))
        except ValueError:
            continue
        out.append((name, xmin, ymin, xmax, ymax, difficult))
    return out


def write_voc_xml(
    xml_path: str,
    image_path: str,
    image_size: Tuple[int, int],
    boxes: List[Tuple[str, int, int, int, int, int]],
    depth: int = 3,
) -> None:
    """
    Write one VOC XML file (GameAISDK format).
    boxes: list of (class_name, xmin, ymin, xmax, ymax, difficult).
    """
    w, h = image_size
    folder = os.path.basename(os.path.dirname(image_path))
    filename = os.path.basename(image_path)
    path_abs = os.path.abspath(image_path)

    root = ET.Element("annotation")
    ET.SubElement(root, "folder").text = folder
    ET.SubElement(root, "filename").text = filename
    ET.SubElement(root, "path").text = path_abs
    src = ET.SubElement(root, "source")
    ET.SubElement(src, "database").text = "Unknown"
    size = ET.SubElement(root, "size")
    ET.SubElement(size, "width").text = str(w)
    ET.SubElement(size, "height").text = str(h)
    ET.SubElement(size, "depth").text = str(depth)
    ET.SubElement(root, "segmented").text = "0"

    for (cls_name, xmin, ymin, xmax, ymax, difficult) in boxes:
        obj = ET.SubElement(root, "object")
        ET.SubElement(obj, "name").text = cls_name
        ET.SubElement(obj, "pose").text = "Unspecified"
        ET.SubElement(obj, "truncated").text = "0"
        ET.SubElement(obj, "difficult").text = str(difficult)
        bnd = ET.SubElement(obj, "bndbox")
        ET.SubElement(bnd, "xmin").text = str(xmin)
        ET.SubElement(bnd, "ymin").text = str(ymin)
        ET.SubElement(bnd, "xmax").text = str(xmax)
        ET.SubElement(bnd, "ymax").text = str(ymax)

    tree = ET.ElementTree(root)
    ET.indent(tree, space="\t", level=0)
    os.makedirs(os.path.dirname(xml_path) or ".", exist_ok=True)
    tree.write(xml_path, encoding="utf-8", xml_declaration=True, default_namespace=None, method="xml")
