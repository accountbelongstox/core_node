# -*- coding: utf-8 -*-
"""
Window resizer: generic library to resize a window so its client area matches target size.
No game-specific titles or dimensions; caller passes window_titles and client width/height.
Uses win32 GetWindowRect, GetClientRect, MoveWindow.
Ensures window stays within primary monitor bounds (four edges not exceeding screen).
"""
import ctypes
import time
from typing import List, Tuple

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyutils.common.window_finder import WindowFinder

try:
    import win32gui
except ImportError:
    win32gui = None


def _get_screen_size() -> Tuple[int, int]:
    """Primary monitor size (pixels). Uses GetSystemMetrics to avoid Tk/circular imports."""
    try:
        user32 = ctypes.windll.user32
        return (user32.GetSystemMetrics(0), user32.GetSystemMetrics(1))  # SM_CXSCREEN, SM_CYSCREEN
    except Exception:
        return (1920, 1080)


def _clamp_position_to_screen(
    left: int, top: int, width: int, height: int, margin: int = 0
) -> Tuple[int, int]:
    """
    Clamp (left, top) so that the rectangle [left, top, left+width, top+height]
    stays within primary screen (all four edges inside screen, optional margin).
    """
    sw, sh = _get_screen_size()
    min_left = margin
    min_top = margin
    max_left = max(min_left, sw - width - margin)
    max_top = max(min_top, sh - height - margin)
    new_left = max(min_left, min(left, max_left))
    new_top = max(min_top, min(top, max_top))
    return (new_left, new_top)


def resize_window_to_client_size(
    hwnd: int,
    target_client_width: int,
    target_client_height: int,
    keep_position: bool = True,
    ensure_on_screen: bool = True,
    screen_margin: int = 0,
) -> Tuple[bool, bool]:
    """
    Resize window so its client area becomes target_client_width x target_client_height.
    Preserves window frame (title bar, borders) by measuring current frame and adding to target.
    When ensure_on_screen is True, clamps window position so all four edges stay within primary monitor.

    Args:
        hwnd: Window handle.
        target_client_width: Desired client area width.
        target_client_height: Desired client area height.
        keep_position: If True, keep window left/top; only change size (then clamp if ensure_on_screen).
        ensure_on_screen: If True, move window so it does not extend beyond screen bounds.
        screen_margin: Minimum pixels from screen edges when ensure_on_screen (default 0).

    Returns:
        (move_ok, verified): move_ok True if MoveWindow was called successfully;
        verified True if after resize the client size was confirmed (handle still valid and size matched).
    """
    if not win32gui:
        ColorPrint.yellow("[WindowResizer] win32gui not available")
        return False, False
    try:
        if not win32gui.IsWindow(hwnd):
            ColorPrint.yellow("[WindowResizer] Invalid hwnd")
            return False, False
        wr = win32gui.GetWindowRect(hwnd)
        cr = win32gui.GetClientRect(hwnd)
        win_w = wr[2] - wr[0]
        win_h = wr[3] - wr[1]
        client_w = cr[2] - cr[0]
        client_h = cr[3] - cr[1]
        if client_w <= 0 or client_h <= 0:
            ColorPrint.yellow("[WindowResizer] Client size is 0, window may not be ready")
            return False, False
        # Frame = outer window minus client area; we want client = target, so outer = target + frame
        frame_w = win_w - client_w
        frame_h = win_h - client_h
        new_win_w = target_client_width + frame_w
        new_win_h = target_client_height + frame_h
        ColorPrint.blue(
            f"[WindowResizer] Before: client {client_w}x{client_h}, outer {win_w}x{win_h}, "
            f"frame {frame_w}x{frame_h} -> set outer {new_win_w}x{new_win_h} so client = {target_client_width}x{target_client_height}"
        )
        left, top = (wr[0], wr[1]) if keep_position else (wr[0], wr[1])
        if ensure_on_screen:
            left, top = _clamp_position_to_screen(left, top, new_win_w, new_win_h, margin=screen_margin)
            if (left, top) != (wr[0], wr[1]):
                ColorPrint.blue(
                    f"[WindowResizer] Position clamped to stay on screen: ({wr[0]}, {wr[1]}) -> ({left}, {top})"
                )
        win32gui.MoveWindow(hwnd, left, top, new_win_w, new_win_h, True)
        verified = False
        try:
            if win32gui.IsWindow(hwnd):
                cr2 = win32gui.GetClientRect(hwnd)
                actual_cw = cr2[2] - cr2[0]
                actual_ch = cr2[3] - cr2[1]
                if actual_cw == target_client_width and actual_ch == target_client_height:
                    ColorPrint.green(
                        f"[WindowResizer] Done: client area = {actual_cw}x{actual_ch} (matches base size)"
                    )
                    verified = True
                else:
                    ColorPrint.yellow(
                        f"[WindowResizer] After resize client = {actual_cw}x{actual_ch} (expected {target_client_width}x{target_client_height})"
                    )
            else:
                ColorPrint.gray("[WindowResizer] Resize sent; could not verify (handle invalid, window may have been recreated)")
        except Exception:
            ColorPrint.gray("[WindowResizer] Resize sent; could not verify (handle invalid or error after MoveWindow)")
        return True, verified
    except Exception as e:
        ColorPrint.red(f"[WindowResizer] resize_window_to_client_size: {e}")
        return False, False


def resize_window_by_titles_to_client_size(
    window_titles: List[str],
    client_width: int,
    client_height: int,
    use_cache: bool = True,
    retry_after_recreate: bool = True,
    retry_delay_sec: float = 0.4,
    max_attempts: int = 3,
) -> bool:
    """
    Find first window matching any of window_titles and resize its client area to client_width x client_height.
    If the game recreates its window on resize (handle becomes invalid), retries with a fresh handle.

    Args:
        window_titles: List of window title substrings (match_mode="in").
        client_width: Desired client area width.
        client_height: Desired client area height.
        use_cache: Passed to WindowFinder on first attempt.
        retry_after_recreate: If True and verification failed, wait and retry with fresh handle.
        retry_delay_sec: Seconds to wait before re-finding window for retry.
        max_attempts: Max resize attempts (first + retries).

    Returns:
        True if a window was found and resize was verified; False otherwise.
    """
    attempt = 0
    use_cache_this = use_cache
    while attempt < max_attempts:
        attempt += 1
        windows = WindowFinder.find_windows_by_titles(
            titles=window_titles,
            match_mode="in",
            use_cache=use_cache_this,
        )
        if not windows:
            ColorPrint.gray("[WindowResizer] No window found for given titles, skip resize")
            return False
        hwnd = windows[0].get("hwnd")
        if not hwnd:
            return False
        move_ok, verified = resize_window_to_client_size(
            hwnd, client_width, client_height, keep_position=True
        )
        if verified:
            return True
        if not move_ok:
            return False
        if not retry_after_recreate or attempt >= max_attempts:
            break
        ColorPrint.blue(
            f"[WindowResizer] Retry in {retry_delay_sec}s with fresh handle (attempt {attempt}/{max_attempts})"
        )
        time.sleep(retry_delay_sec)
        use_cache_this = False
    return False
