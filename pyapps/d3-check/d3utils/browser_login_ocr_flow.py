# -*- coding: utf-8 -*-
"""
Browser login OCR flow: when Tampermonkey is not connected (CN), wait for browser
window by title, capture frontmost browser every 2s, OCR, and click EULA checkbox+agree
or login button. Same steps as Tampermonkey script; 5 min timeout then flow returns to start.
"""

import time
from typing import Optional, Tuple, List, Dict, Any

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageGrab
from pycore.pyutils.click_handler import ClickHandler
from d3utils.click_handler_singleton import get_click_handler

from providor.constants.common import (
    BROWSER_LOGIN_FALLBACK_TIMEOUT_SEC,
    BROWSER_LOGIN_WINDOW_TITLE_SUBSTRS,
    ACTIVATE_BEFORE_CAPTURE_DELAY_SEC,
)
from d3utils.browser_login_window_finder import get_frontmost_browser_login_window
from d3utils.ocr_helper import (
    ocr_get_result,
    bbox_center,
    _position_to_bbox,
)

Image = get_third_package_PIL_Image()
ImageGrab = get_third_package_PIL_ImageGrab()

# Page text to match (same as Tampermonkey script)
EULA_LABEL_SUBSTR = "我接受暴雪战网最终用户许可协议"
AGREE_BTN_SUBSTR = "同意"
CANCEL_BTN_SUBSTR = "取消"
LOGIN_BTN_SUBSTR = "登录"
SUCCESS_TEXT_SUBSTR = "现在可以返回战网游戏或应用程序"

# Poll interval (capture + OCR every this many seconds)
POLL_INTERVAL_SEC = 2.0


def _boxes_from_raw(raw_result: List[Dict], keywords: List[str]) -> List[Dict[str, Any]]:
    """From OCR raw_result, return [{keyword, text, bbox}] for items matching any keyword."""
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


def _capture_window_rect(left: int, top: int, right: int, bottom: int):
    """Capture screen region; return PIL Image or None. Requires ImageGrab at module load."""
    if ImageGrab is None:
        return None
    bbox = (left, top, right, bottom)
    return ImageGrab.grab(bbox=bbox)


def _click_in_window(
    clicker: ClickHandler,
    window_rect: Tuple[int, int, int, int],
    bbox: Tuple[float, float, float, float],
) -> bool:
    """Click at bbox center in window; bbox is (min_x, min_y, max_x, max_y) in window coords."""
    left, top, _, _ = window_rect
    cx, cy = bbox_center(bbox)
    screen_x = int(left + cx)
    screen_y = int(top + cy)
    try:
        return clicker.click(screen_x, screen_y, direct_click=True, return_to_original=True)
    except Exception as e:
        ColorPrint.yellow(f"[BrowserLoginOCR] Click failed: {e}")
        return False


def run_one_poll(
    deadline: float,
    clicker: Optional[ClickHandler] = None,
    notify_oauth_done=None,
) -> str:
    """
    One poll step: find frontmost browser with login title, capture, OCR, click what is found.
    Returns:
      "success"  - detected success text or clicked through; caller should call notify_oauth_done if needed
      "timeout"  - time.time() >= deadline; flow should go to BN_Exit
      "continue" - no browser yet or no clickable element this round
    """
    if time.time() >= deadline:
        return "timeout"
    win = get_frontmost_browser_login_window(title_substrs=BROWSER_LOGIN_WINDOW_TITLE_SUBSTRS)
    if not win:
        return "continue"
    rect = win.get("rect")
    if not rect or len(rect) < 4:
        return "continue"
    left, top, right, bottom = rect[0], rect[1], rect[2], rect[3]
    time.sleep(ACTIVATE_BEFORE_CAPTURE_DELAY_SEC)
    img = _capture_window_rect(left, top, right, bottom)
    if img is None:
        return "continue"
    result = ocr_get_result(img)
    if not result:
        return "continue"
    raw = (result.get("raw_result") or [])
    text_flat = (result.get("text") or "")
    if SUCCESS_TEXT_SUBSTR in text_flat:
        ColorPrint.blue("[BrowserLoginOCR] Success text found, consider OAuth done")
        if notify_oauth_done:
            notify_oauth_done()
        return "success"
    clk = clicker or get_click_handler()
    # EULA: checkbox (approximate: left of EULA text) + agree button
    eula_boxes = _boxes_from_raw(raw, [EULA_LABEL_SUBSTR])
    agree_boxes = _boxes_from_raw(raw, [AGREE_BTN_SUBSTR])
    cancel_boxes = _boxes_from_raw(raw, [CANCEL_BTN_SUBSTR])
    login_boxes = _boxes_from_raw(raw, [LOGIN_BTN_SUBSTR])
    # Prefer agree button that is not cancel (text contains 同意 but not 取消)
    agree_btn = None
    for ab in agree_boxes:
        if ab.get("text", "").find(CANCEL_BTN_SUBSTR) == -1:
            agree_btn = ab
            break
    if eula_boxes and agree_btn:
        # Click checkbox: left of EULA text (first char region)
        bbox = eula_boxes[0]["bbox"]
        check_cx = bbox[0] - 24
        check_cy = (bbox[1] + bbox[3]) / 2
        if check_cx < 0:
            check_cx = bbox[0] / 2
        check_bbox = (check_cx - 8, check_cy - 8, check_cx + 8, check_cy + 8)
        _click_in_window(clk, rect, check_bbox)
        time.sleep(0.3)
        _click_in_window(clk, rect, agree_btn["bbox"])
        ColorPrint.blue("[BrowserLoginOCR] Clicked EULA checkbox + agree")
        return "continue"
    if agree_btn and not eula_boxes:
        _click_in_window(clk, rect, agree_btn["bbox"])
        ColorPrint.blue("[BrowserLoginOCR] Clicked agree button")
        return "continue"
    if login_boxes:
        _click_in_window(clk, rect, login_boxes[0]["bbox"])
        ColorPrint.blue("[BrowserLoginOCR] Clicked login button")
        return "continue"
    return "continue"


def run_browser_login_ocr_flow(
    timeout_sec: float = BROWSER_LOGIN_FALLBACK_TIMEOUT_SEC,
    poll_interval_sec: float = POLL_INTERVAL_SEC,
    notify_oauth_done=None,
) -> bool:
    """
    Block until success or timeout. Polls every poll_interval_sec; each poll runs run_one_poll.
    Returns True if success (notify_oauth_done called), False on timeout.
    """
    deadline = time.time() + timeout_sec
    clicker = get_click_handler()
    while time.time() < deadline:
        status = run_one_poll(deadline, clicker=clicker, notify_oauth_done=notify_oauth_done)
        if status == "success":
            return True
        if status == "timeout":
            ColorPrint.yellow(f"[BrowserLoginOCR] Timeout after {timeout_sec}s")
            return False
        time.sleep(poll_interval_sec)
    return False
