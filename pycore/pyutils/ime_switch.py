# -*- coding: utf-8 -*-
"""
IME (Input Method Editor) switch and restore for Windows.

Uses Imm32.dll: save current conversion/sentence mode, switch to English (alphanumeric)
for reliable ASCII typing, then restore previous mode. No app-specific deps.
"""
import sys
from typing import Optional, Tuple

if sys.platform != "win32":
    _imm32 = None
else:
    try:
        import ctypes
        _imm32 = ctypes.windll.Imm32  # type: ignore[attr-defined]
    except Exception:
        _imm32 = None

# IME conversion mode (from Win32 imm.h)
# IME_CMODE_ALPHANUMERIC = 0x0000: direct English/alphanumeric input
# IME_CMODE_NATIVE = 0x0001: native (CJK) input
# IME_CMODE_ROMAN = 0x0010: Roman character mode
# IME_SMODE_NONE = 0
IME_CMODE_ALPHANUMERIC = 0x0000
IME_SMODE_NONE = 0


def _get_foreground_window():
    if sys.platform != "win32":
        return None
    try:
        user32 = ctypes.windll.user32  # type: ignore[attr-defined]
        return user32.GetForegroundWindow()
    except Exception:
        return None


def save_and_switch_ime_to_english() -> Optional[Tuple[int, int]]:
    """
    Save current IME conversion/sentence status and switch to English (alphanumeric) mode.
    Returns (saved_conversion, saved_sentence) for restore_ime(), or None if not supported/failed.
    """
    if _imm32 is None:
        return None
    hwnd = _get_foreground_window()
    if not hwnd:
        return None
    try:
        import ctypes
        conv = ctypes.c_ulong(0)
        sent = ctypes.c_ulong(0)
        h_imc = _imm32.ImmGetContext(hwnd)
        if not h_imc:
            return None
        if not _imm32.ImmGetConversionStatus(h_imc, ctypes.byref(conv), ctypes.byref(sent)):
            _imm32.ImmReleaseContext(hwnd, h_imc)
            return None
        saved = (int(conv.value), int(sent.value))
        _imm32.ImmSetConversionStatus(h_imc, IME_CMODE_ALPHANUMERIC, IME_SMODE_NONE)
        _imm32.ImmReleaseContext(hwnd, h_imc)
        return saved
    except Exception:
        return None


def restore_ime(saved: Optional[Tuple[int, int]]) -> bool:
    """
    Restore IME conversion/sentence status from save_and_switch_ime_to_english().
    Returns True if restored, False otherwise.
    """
    if _imm32 is None or saved is None:
        return False
    hwnd = _get_foreground_window()
    if not hwnd:
        return False
    try:
        h_imc = _imm32.ImmGetContext(hwnd)
        if not h_imc:
            return False
        conv, sent = saved
        ok = bool(_imm32.ImmSetConversionStatus(h_imc, conv, sent))
        _imm32.ImmReleaseContext(hwnd, h_imc)
        return ok
    except Exception:
        return False


def is_ime_switch_available() -> bool:
    """True if IME save/restore is available (Windows with Imm32)."""
    return _imm32 is not None and sys.platform == "win32"


__all__ = [
    "save_and_switch_ime_to_english",
    "restore_ime",
    "is_ime_switch_available",
]
