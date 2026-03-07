#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OCR helper: shared keyword-in-image check.
"""

import os
from pathlib import Path
from typing import Optional, Sequence, Union, List, Dict, Any, Tuple

from pycore.pyfoundations.color_print import ColorPrint

# CnOCR engine initialized by d3-check at app startup (single shared instance)
def _get_default_engine():
    from d3utils.cnocr_engine_registry import get_cnocr_engine_default
    return get_cnocr_engine_default()


def ocr_get_result(
    image_input: Union[str, Path, Any],
    engine=None,
) -> Optional[Dict[str, Any]]:
    """
    Run OCR once; return {text, raw_result} or None. Same engine.ocr() result.
    image_input: file path (str/Path) or in-memory PIL Image (avoids disk I/O).
    """
    eng = engine if engine is not None else _get_default_engine()
    if eng is None:
        return None
    try:
        if hasattr(image_input, "mode"):
            return eng.ocr(image=image_input)
        return eng.ocr(img_path=str(image_input))
    except RuntimeError as e:
        msg = str(e)
        if "CUDA" in msg or "cuda" in msg:
            ColorPrint.red(f"[OCR] ocr_get_result error: {e}")
            ColorPrint.yellow("[OCR] Engine should use CPU when CUDA unavailable (see CnOCREngine init). Restart app or re-init engine.")
        else:
            ColorPrint.red(f"[OCR] ocr_get_result error: {e}")
        return None
    except Exception as e:
        ColorPrint.red(f"[OCR] ocr_get_result error: {e}")
        if not hasattr(image_input, "mode"):
            try:
                path_str = str(image_input)
                exists = os.path.exists(path_str)
                size = os.path.getsize(path_str) if exists else None
                ext = os.path.splitext(path_str)[1].lower() if path_str else ""
                ColorPrint.gray(
                    f"[OCR] IMG path={path_str!r} exists={exists} size={size} ext={ext!r}"
                )
            except Exception as info_err:
                ColorPrint.gray(f"[OCR] IMG input (info failed: {info_err})")
        return None


def _boxes_from_raw_result(raw_result: List[Dict], keywords: Sequence[str]) -> List[Dict[str, Any]]:
    """From raw_result (list of {text, position}), return [{keyword, text, bbox}] for items matching keywords.
    position can be list of [x,y] or np.ndarray shape (4,2). If position is missing (e.g. naive_det), bbox is None."""
    if not raw_result or not keywords:
        return []
    out = []
    for item in raw_result:
        text = (item.get("text") or "").strip()
        if not text:
            continue
        pos = item.get("position")
        bbox = _position_to_bbox(pos) if pos is not None else None
        if bbox is None:
            continue
        for kw in keywords:
            if kw in text:
                out.append({"keyword": kw, "text": text, "bbox": bbox})
                break
    return out


def ocr_has_any_keywords(
    image_path: Union[str, Path],
    keywords: Sequence[str],
    engine=None,
    log_prefix: str = "[OCR]",
) -> bool:
    """
    Run OCR on image; return True if any keyword is in recognized text.
    engine: CnOCREngine instance or None (use default singleton).
    """
    if not keywords:
        return False
    eng = engine if engine is not None else _get_default_engine()
    if eng is None:
        ColorPrint.yellow(f"{log_prefix} OCR not available, skip keyword check")
        return False
    try:
        result = eng.ocr(str(image_path))
        text = (result or {}).get("text", "") or ""
        for kw in keywords:
            if kw in text:
                ColorPrint.blue(f"{log_prefix} Keyword in UI: '{kw}'")
                return True
        return False
    except Exception as e:
        ColorPrint.red(f"{log_prefix} OCR error: {e}")
        return False


def _position_to_bbox(position) -> Optional[Tuple[float, float, float, float]]:
    """Convert cnocr position (list or np.ndarray of [x,y] points, shape (4,2)) to (min_x, min_y, max_x, max_y)."""
    if position is None:
        return None
    if hasattr(position, "tolist"):
        position = position.tolist()
    if not position or not isinstance(position, (list, tuple)):
        return None
    xs, ys = [], []
    for p in position:
        if getattr(p, "__len__", None) and len(p) >= 2:
            xs.append(float(p[0]))
            ys.append(float(p[1]))
    if not xs or not ys:
        return None
    return (min(xs), min(ys), max(xs), max(ys))


def bbox_center(bbox: Tuple[float, float, float, float]) -> Tuple[float, float]:
    """Return (cx, cy) center of bbox (min_x, min_y, max_x, max_y)."""
    return ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)


def bbox_first_char_center(bbox: Tuple[float, float, float, float], num_chars: int = 3) -> Tuple[float, float]:
    """Return center of left 1/num_chars part of bbox (for clicking first character of agree text)."""
    w = bbox[2] - bbox[0]
    left = bbox[0]
    right = bbox[0] + w / num_chars
    cx = (left + right) / 2
    cy = (bbox[1] + bbox[3]) / 2
    return (cx, cy)


def bbox_left_center(bbox: Tuple[float, float, float, float], x_offset: float = 2.0) -> Tuple[float, float]:
    """Return (x, y) for agree click: x = left edge + offset, y = 50% height (not end of text)."""
    cx = bbox[0] + x_offset
    cy = (bbox[1] + bbox[3]) / 2
    return (cx, cy)


def ocr_find_keyword_boxes(
    image_path: Union[str, Path],
    keywords: Sequence[str],
    engine=None,
    log_prefix: str = "[OCR]",
) -> List[Dict[str, Any]]:
    """
    Run OCR and return list of matches: each dict has keyword, text, bbox=(min_x,min_y,max_x,max_y).
    bbox is in image coordinates. Prefer using ocr_get_result() once then _boxes_from_raw_result() to avoid duplicate OCR.
    """
    result = ocr_get_result(image_path, engine=engine)
    if not result:
        return []
    raw = (result.get("raw_result") or [])
    out = _boxes_from_raw_result(raw, keywords)
    for m in out:
        ColorPrint.blue(f"{log_prefix} Found keyword '{m['keyword']}' at bbox {m['bbox']}")
    return out
