#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SmartEcho: F7 pause + OCR-driven resume. One trigger (log "Picking end" + lookback) → one F7, one message;
OCR tick every 3s; no Chinese text → resume immediately. Timeout 60s → resume immediately.
All logic in memory (crop + OCR, no screenshot file).
"""

import threading
import time

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.common.window_finder import WindowFinder
from pycore.pyutils.window_activator import WindowActivator
from providor.providor_index import DIABLO_III_WINDOW_TITLES
from providor.app_constants import ACTIVATE_BEFORE_CAPTURE_DELAY_SEC, SMART_ECHO_OCR_TICK_MAX_SEC
from d3utils.screenshot_provider import get_screenshot_provider
from d3utils.d3u_common.game_window_region import crop_game_window_middle30_upper_half
from d3utils.ocr_helper import ocr_get_result
from d3utils.i18n_manager import i18n_manager
from d3utils.rosbot_operation import get_rosbot_operation
from d3utils.key_send import send_f7_to_system
import timers.timer_manager as timer_manager

_smart_echo_resume_pending = False
_smart_echo_ocr_resume_scheduled = False

SMART_ECHO_TICK_INTERVAL_SEC = 3.0


def _activate_d3_window_for_capture() -> bool:
    """Bring D3 window to front before capture. Returns True if activated."""
    windows = WindowFinder.find_windows_by_titles(
        titles=list(DIABLO_III_WINDOW_TITLES),
        match_mode="in",
        use_cache=False,
    )
    if not windows or not windows[0].get("hwnd"):
        return False
    WindowActivator().activate_window_by_handle(windows[0]["hwnd"])
    time.sleep(ACTIVATE_BEFORE_CAPTURE_DELAY_SEC)
    return True


def _smart_echo_ocr_has_chinese(text: str) -> bool:
    """True if text contains at least one CJK character (U+4E00..U+9FFF)."""
    if not text:
        return False
    return any("\u4e00" <= c <= "\u9fff" for c in text)


def _do_resume_rosbot_after_smart_echo() -> None:
    """Resume ROSBOT after smart echo pause. Clears pending flags."""
    global _smart_echo_resume_pending, _smart_echo_ocr_resume_scheduled
    _smart_echo_resume_pending = False
    _smart_echo_ocr_resume_scheduled = False
    try:
        if get_rosbot_operation().resume_rosbot(do_tab=True, do_start_botting=True):
            ColorPrint.green("[SmartEcho] ROSBOT resumed after pause.")
        else:
            ColorPrint.yellow("[SmartEcho] ROSBOT resume (UI) failed.")
    except Exception as e:
        ColorPrint.red(f"[SmartEcho] Resume error: {e}")


def _schedule_resume_after_smart_echo() -> None:
    """Schedule resume in timer thread (run immediately)."""
    timer_manager.submit_one_shot(_do_resume_rosbot_after_smart_echo)


def _smart_echo_capture_tick(end_time_sec: float) -> None:
    """Every 3s: OCR game region (middle 30%, upper half). No Chinese text → resume immediately. Timeout 60s → resume immediately."""
    global _smart_echo_ocr_resume_scheduled
    now = time.time()
    if now >= end_time_sec:
        if not _smart_echo_ocr_resume_scheduled:
            _smart_echo_ocr_resume_scheduled = True
            ColorPrint.yellow("[SmartEcho] OCR tick timeout (60s), resume now.")
            _schedule_resume_after_smart_echo()
        return
    text = ""
    try:
        _activate_d3_window_for_capture()
        provider = get_screenshot_provider()
        sd = provider.gen(use_optimized_capture=True, window_titles=list(DIABLO_III_WINDOW_TITLES))
        if sd and sd.game_window_image:
            region_img = crop_game_window_middle30_upper_half(sd.game_window_image)
            if region_img is None:
                ColorPrint.yellow("[SmartEcho] Crop middle30 upper half failed, skip OCR tick")
                if time.time() + SMART_ECHO_TICK_INTERVAL_SEC < end_time_sec:
                    threading.Timer(SMART_ECHO_TICK_INTERVAL_SEC, _smart_echo_capture_tick, args=(end_time_sec,)).start()
                return
            rw, rh = region_img.size
            ColorPrint.blue(f"[SmartEcho] OCR region size: {rw}x{rh} (middle 30%, upper half)")
            ocr_result = ocr_get_result(region_img)
            text = (ocr_result or {}).get("text") or ""
            ColorPrint.blue("[SmartEcho] OCR: " + (text.strip() or "(no text)"))
        else:
            ColorPrint.yellow("[SmartEcho] D3 window not found, skip OCR tick")
    except Exception as e:
        ColorPrint.red(f"[SmartEcho] OCR tick error: {e}")
    if _smart_echo_ocr_resume_scheduled:
        return
    if _smart_echo_ocr_has_chinese(text):
        if time.time() + SMART_ECHO_TICK_INTERVAL_SEC < end_time_sec:
            threading.Timer(SMART_ECHO_TICK_INTERVAL_SEC, _smart_echo_capture_tick, args=(end_time_sec,)).start()
        return
    _smart_echo_ocr_resume_scheduled = True
    ColorPrint.green("[SmartEcho] No Chinese text, resume now.")
    _schedule_resume_after_smart_echo()


def do_smart_echo_pause_after_complete() -> None:
    """Send F7 once, message once. Resume driven by OCR (tick every 3s; no Chinese → resume immediately). Timeout 60s → resume immediately."""
    global _smart_echo_resume_pending, _smart_echo_ocr_resume_scheduled
    if _smart_echo_resume_pending:
        return
    _smart_echo_resume_pending = True
    _smart_echo_ocr_resume_scheduled = False
    if not send_f7_to_system():
        _smart_echo_resume_pending = False
        ColorPrint.red("[SmartEcho] F7 send failed")
        return
    try:
        msg = i18n_manager.get_ui_text("rosbot.smart_echo_pause_log")
        ColorPrint.green(f"[SmartEcho] {msg}")
    except Exception:
        ColorPrint.green("[SmartEcho] Smart pause ROSBOT to prevent game exit.")
    end_time_sec = time.time() + SMART_ECHO_OCR_TICK_MAX_SEC
    threading.Timer(0.0, _smart_echo_capture_tick, args=(end_time_sec,)).start()
