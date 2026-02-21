# -*- coding: utf-8 -*-
"""
Browser login OCR flow (CN, no Tampermonkey).
Flow: find browser by BROWSER_LOGIN_WINDOW_TITLE_SUBSTRS -> activate to front + wait ->
center 80% region capture (ImageGrab) -> OCR -> button bbox + offset -> click.
"""

import os
import tempfile
import time
from typing import Optional, Tuple, List, Dict, Any

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageGrab
from pycore.pyutils.click_handler import ClickHandler
from pycore.pyutils.window_activator import WindowActivator
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

# Center region of browser window: 80% width and height (for OCR to reduce noise)
CENTER_REGION_WIDTH_RATIO = 0.8
CENTER_REGION_HEIGHT_RATIO = 0.8

# B11 OCR DEBUG: when True, save center-80% image used for OCR to temp dir when no 登录/同意/EULA found
B11_OCR_DEBUG = True
B11_OCR_DEBUG_DIR = os.path.join(tempfile.gettempdir(), "browser_login_ocr_debug")


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


def _format_raw_with_position(raw_result: List[Dict]) -> str:
    """Format OCR raw_result items that have position for logging: text @ (x,y,w,h)."""
    if not raw_result:
        return "[]"
    parts = []
    for item in raw_result:
        text = (item.get("text") or "").strip()
        if not text:
            continue
        pos = item.get("position")
        bbox = _position_to_bbox(pos) if pos is not None else None
        if bbox is None:
            continue
        x1, y1, x2, y2 = bbox
        w, h = round(x2 - x1), round(y2 - y1)
        parts.append("%s@(%d,%d,%d,%d)" % (repr(text)[:32], round(x1), round(y1), w, h))
    return "[" + ", ".join(parts) + "]" if parts else "[]"


def _rect_center_region(
    left: int, top: int, right: int, bottom: int,
    width_ratio: float = CENTER_REGION_WIDTH_RATIO,
    height_ratio: float = CENTER_REGION_HEIGHT_RATIO,
) -> Tuple[int, int, int, int]:
    """Return (left, top, right, bottom) of the center region of the given rect (80% by default)."""
    w, h = right - left, bottom - top
    cw = max(1, int(w * width_ratio))
    ch = max(1, int(h * height_ratio))
    cx = left + (w - cw) // 2
    cy = top + (h - ch) // 2
    return (cx, cy, cx + cw, cy + ch)


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
    """Click at bbox center: offset = window_rect (left, top); screen = offset + bbox_center(bbox)."""
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
    One poll: find browser by BROWSER_LOGIN_WINDOW_TITLE_SUBSTRS; if not found wait this tick (return continue);
    if found: activate to front + wait -> capture center 80% (ImageGrab) -> OCR -> click at bbox_center + rect offset.
    Returns:
      "success"  - detected success text or clicked through; caller should call notify_oauth_done if needed
      "timeout"  - time.time() >= deadline; flow should go to BN_Exit
      "continue" - no browser yet (wait by title) or no clickable element this round
    """
    if time.time() >= deadline:
        return "timeout"
    # B11: find browser by title constant; if not found -> wait this tick (do not do other work)
    win = get_frontmost_browser_login_window(title_substrs=BROWSER_LOGIN_WINDOW_TITLE_SUBSTRS)
    if not win:
        ColorPrint.gray("[BrowserLoginOCR] B11 wait: no window matching title %s, skip this tick" % (BROWSER_LOGIN_WINDOW_TITLE_SUBSTRS,))
        return "continue"
    full_rect = win.get("rect")
    if not full_rect or len(full_rect) < 4:
        return "continue"
    hwnd = win.get("hwnd")
    if hwnd is not None:
        try:
            WindowActivator().activate_window_by_handle(int(hwnd))
        except Exception:
            pass
        time.sleep(ACTIVATE_BEFORE_CAPTURE_DELAY_SEC)
    left, top, right, bottom = _rect_center_region(full_rect[0], full_rect[1], full_rect[2], full_rect[3])
    rect = (left, top, right, bottom)
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
    # B11 real-time OCR: use constants 登录/同意/EULA to get position, click when found (CN browser OAuth)
    eula_boxes = _boxes_from_raw(raw, [EULA_LABEL_SUBSTR])
    agree_boxes = _boxes_from_raw(raw, [AGREE_BTN_SUBSTR])
    login_boxes = _boxes_from_raw(raw, [LOGIN_BTN_SUBSTR])
    agree_btn = None
    for ab in agree_boxes:
        if ab.get("text", "").find(CANCEL_BTN_SUBSTR) == -1:
            agree_btn = ab
            break
    if eula_boxes and agree_btn:
        bbox = eula_boxes[0]["bbox"]
        check_cx = bbox[0] - 24
        check_cy = (bbox[1] + bbox[3]) / 2
        if check_cx < 0:
            check_cx = bbox[0] / 2
        check_bbox = (check_cx - 8, check_cy - 8, check_cx + 8, check_cy + 8)
        _click_in_window(clk, rect, check_bbox)
        time.sleep(0.3)
        _click_in_window(clk, rect, agree_btn["bbox"])
        ColorPrint.blue("[BrowserLoginOCR] B11 OCR: EULA+同意 at center 80% -> clicked")
        return "continue"
    if agree_btn and not eula_boxes:
        _click_in_window(clk, rect, agree_btn["bbox"])
        ColorPrint.blue("[BrowserLoginOCR] B11 OCR: 同意 at center 80% -> clicked")
        return "continue"
    if login_boxes:
        _click_in_window(clk, rect, login_boxes[0]["bbox"])
        ColorPrint.blue("[BrowserLoginOCR] B11 OCR: 登录 at center 80% -> clicked")
        return "continue"
    # DEBUG: save the exact center-80%% image used for OCR when no 登录/同意/EULA found
    debug_path = None
    if B11_OCR_DEBUG and img is not None:
        try:
            os.makedirs(B11_OCR_DEBUG_DIR, exist_ok=True)
            ts = time.strftime("%Y%m%d_%H%M%S", time.localtime()) + "_%d" % (time.time() % 1 * 1000)
            fname = "b11_center80_%s.png" % ts
            debug_path = os.path.join(B11_OCR_DEBUG_DIR, fname)
            img.save(debug_path)
            debug_path = os.path.abspath(debug_path)
        except Exception as e:
            ColorPrint.yellow("[BrowserLoginOCR] B11 DEBUG save image failed: %s" % e)
    with_pos = _format_raw_with_position(raw)
    text_preview = (result.get("text") or "")[:200]
    has_any_position = any(_position_to_bbox(item.get("position")) is not None for item in raw)
    extra = (" | DEBUG image: %s" % debug_path) if debug_path else ""
    ColorPrint.gray(
        "[BrowserLoginOCR] B11 OCR: center 80%% no 登录/同意/EULA, next tick | with position: %s | raw_count=%d has_position=%s text=%s%s"
        % (with_pos, len(raw), has_any_position, repr(text_preview), extra)
    )
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
