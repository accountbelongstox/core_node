# -*- coding: utf-8 -*-
"""
Template match debug queue: for "other image find" debug UI, in-memory only, no disk.
Bridges matcher and AutoUseInterface log/result images; uses ImageAnnotator to draw target + template + match mode + result.
"""

import queue
from typing import Optional, List, Dict, Any

from pycore.pyfoundations.third_party import get_third_package_cv2, get_third_package_numpy
from pycore.pyfoundations.third_party import get_third_package_PIL_Image
from pycore.pyutils.image_annotator import ImageAnnotator

cv2 = get_third_package_cv2()
np = get_third_package_numpy()
Image = get_third_package_PIL_Image()

_debug_queue: queue.Queue = queue.Queue()
_entries: List[Dict[str, Any]] = []
_ui_active: bool = False


def set_debug_ui_active(active: bool):
    global _ui_active
    _ui_active = active


def is_debug_ui_active() -> bool:
    return _ui_active


def push(title: str, log_line: str, image=None):
    """Append one debug entry (title, log line, optional match image), in-memory only."""
    _debug_queue.put({"title": title, "log": log_line, "image": image})
    entry = {"title": title, "log": log_line, "image": image}
    _entries.append(entry)


def pop_all() -> List[Dict[str, Any]]:
    """Non-blocking pop of all items currently in queue."""
    out = []
    try:
        while True:
            out.append(_debug_queue.get_nowait())
    except queue.Empty:
        pass
    return out


def get_entries() -> List[Dict[str, Any]]:
    """Return current accumulated entry list (including items just popped from queue)."""
    return list(_entries)


def clear():
    """Clear queue and cache when UI closes."""
    global _entries, _ui_active
    try:
        while True:
            _debug_queue.get_nowait()
    except queue.Empty:
        pass
    _entries = []
    _ui_active = False


def _bgr_array_to_pil(arr) -> Optional[Any]:
    if arr is None:
        return None
    try:
        rgb = cv2.cvtColor(arr, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb)
    except Exception:
        return None


def _build_annotated_match_image(
    target_bgr,
    template_bgr,
    template_name: str,
    match_method: str,
    result: Dict,
    expected_threshold: Optional[float] = None,
    first_match: Optional[Dict] = None,
) -> Optional[Any]:
    """
    Use ImageAnnotator to draw: target image + template thumbnail + match mode + result + match score + expected threshold.
    Returns PIL Image, in-memory only.
    """
    if target_bgr is None:
        return None
    try:
        annotator = ImageAnnotator(np.ascontiguousarray(target_bgr.copy()))
        h, w = target_bgr.shape[:2]
        line_y = 24
        line_h = 22

        # Mode (ASCII only: cv2.putText does not support Unicode)
        annotator.draw_text(
            f"Mode: {match_method}",
            (10, line_y),
            color=(255, 255, 255),
            font_scale=0.55,
            thickness=1,
            background_color=(80, 80, 80),
        )
        line_y += line_h

        # Expected threshold
        if expected_threshold is not None:
            annotator.draw_text(
                f"Threshold: {expected_threshold:.2f}",
                (10, line_y),
                color=(255, 255, 255),
                font_scale=0.55,
                thickness=1,
                background_color=(60, 60, 80),
            )
            line_y += line_h

        # Score
        total = result.get("total_matches", 0) if isinstance(result, dict) else 0
        if total and first_match is not None:
            num_inliers = first_match.get("num_matches")
            thresh_used = first_match.get("match_threshold")
            if num_inliers is not None and thresh_used is not None:
                score_text = f"Score: {num_inliers} inliers (ratio {thresh_used:.2f})"
            else:
                score_text = "Score: OK"
        else:
            score_text = "Score: FAIL"
        annotator.draw_text(
            score_text,
            (10, line_y),
            color=(255, 255, 255),
            font_scale=0.55,
            thickness=1,
            background_color=(80, 60, 60) if not total else (60, 80, 60),
        )
        line_y += line_h

        # Result
        err = result.get("error", "")
        if total and result.get("matches"):
            result_text = f"Result: {total} match(es)"
            bg_color = (0, 100, 0)
        else:
            result_text = "Result: 0 matches" + (f" ({err})" if err else "")
            bg_color = (0, 0, 100)
        annotator.draw_text(
            result_text,
            (10, line_y),
            color=(255, 255, 255),
            font_scale=0.55,
            thickness=1,
            background_color=bg_color,
        )
        line_y += line_h
        annotator.draw_text(
            f"Template: {template_name}",
            (10, line_y),
            color=(200, 200, 200),
            font_scale=0.5,
            thickness=1,
            background_color=(50, 50, 50),
        )
        line_y += line_h

        # Template thumbnail top-right (label ASCII only)
        if template_bgr is not None and template_bgr.size > 0:
            th, tw = template_bgr.shape[:2]
            max_side = 120
            if max(th, tw) > max_side:
                r = max_side / max(th, tw)
                tw, th = int(tw * r), int(th * r)
                template_small = cv2.resize(template_bgr, (tw, th), interpolation=cv2.INTER_AREA)
            else:
                template_small = template_bgr
            tx = max(10, w - template_small.shape[1] - 10)
            ty = line_y + 4
            if ty + template_small.shape[0] <= h and tx + template_small.shape[1] <= w:
                annotator.draw_image(template_small, (tx, ty), alpha=1.0)
                annotator.draw_text(
                    "Template img",
                    (tx, ty - 2),
                    color=(255, 255, 0),
                    font_scale=0.5,
                    thickness=1,
                    background_color=(60, 60, 60),
                )
        out_bgr = annotator.get_image()
        rgb = cv2.cvtColor(out_bgr, cv2.COLOR_BGR2RGB)
        return Image.fromarray(rgb)
    except Exception:
        return _bgr_array_to_pil(target_bgr)


def notify_match(
    template_name: str,
    result: Dict,
    target_img_array: Any,
    template_img_array: Any = None,
    match_method: str = "ORB",
    expected_threshold: Optional[float] = None,
    first_match: Optional[Dict] = None,
):
    """
    Called by ScaledTemplateMatcherBase after each match.
    Only when debug UI is active: draw target+template+match mode+result+score with ImageAnnotator and push to queue.
    """
    if not _ui_active:
        return
    total = result.get("total_matches", 0) if isinstance(result, dict) else 0
    err = result.get("error", "")
    if total and result.get("matches"):
        log_line = f"{template_name}: {total} match(es)"
    else:
        log_line = f"{template_name}: 0 matches" + (f" ({err})" if err else "")
    img = _build_annotated_match_image(
        target_bgr=target_img_array,
        template_bgr=template_img_array,
        template_name=template_name,
        match_method=match_method,
        result=result,
        expected_threshold=expected_threshold,
        first_match=first_match,
    )
    if img is None:
        img = _bgr_array_to_pil(target_img_array)
    push(template_name, log_line, img)
