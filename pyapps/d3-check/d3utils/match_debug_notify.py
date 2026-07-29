# -*- coding: utf-8 -*-
"""
Match debug notify: builds annotated match image and pushes to share queue.
Lives in d3utils so share does not depend on d3utils (image_annotator_helper).
Used as on_after_match callback by D3/D4 scaled template matchers.
"""

from typing import Optional, Dict, Any

from pycore.pyfoundations.third_party.api import get_third_package_cv2, get_third_package_numpy
from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image
from share.template_match_debug import push, is_debug_ui_active, bgr_array_to_pil
from d3utils.d3u_common.image_annotator_helper import create_annotator

cv2 = get_third_package_cv2()
np = get_third_package_numpy()
Image = get_third_package_PIL_Image()


def _build_annotated_match_image(
    target_bgr: Any,
    template_bgr: Any,
    template_name: str,
    match_method: str,
    result: Dict,
    expected_threshold: Optional[float] = None,
    first_match: Optional[Dict] = None,
) -> Optional[Any]:
    """Draw target + template thumbnail + match mode + result with ImageAnnotator; return PIL Image."""
    if target_bgr is None:
        return None
    try:
        annotator = create_annotator(np.ascontiguousarray(target_bgr.copy()))
        h, w = target_bgr.shape[:2]
        line_y = 24
        line_h = 22
        annotator.draw_text(
            f"Mode: {match_method}",
            (10, line_y),
            color=(255, 255, 255),
            font_scale=0.55,
            thickness=1,
            background_color=(80, 80, 80),
        )
        line_y += line_h
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
        return bgr_array_to_pil(target_bgr)


def notify_match(
    template_name: str,
    result: Dict,
    target_img_array: Any,
    template_img_array: Any = None,
    match_method: str = "ORB",
    expected_threshold: Optional[float] = None,
    first_match: Optional[Dict] = None,
) -> None:
    """When debug UI is active: build annotated image and push to share queue. Used as on_after_match by matchers."""
    if not is_debug_ui_active():
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
        img = bgr_array_to_pil(target_img_array)
    push(template_name, log_line, img)


__all__ = ["notify_match"]
