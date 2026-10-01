# -*- coding: utf-8 -*-
"""
IME (Input Method Editor) switch and restore for Windows.

Uses Imm32.dll: save current conversion/sentence mode, switch to English (alphanumeric)
for reliable ASCII typing, then restore previous mode. No app-specific deps.
"""
import ctypes
import sys
from typing import Any, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


def _load_imm32() -> Optional[Any]:
    if sys.platform != "win32":
        return None
    try:
        return ctypes.windll.Imm32  # type: ignore[attr-defined]
    except OSError as exc:
        ColorPrint.yellow(f"[ime_switch] Imm32.dll unavailable: {exc}")
        return None


_imm32 = _load_imm32()

# IME conversion mode (from Win32 imm.h)
# IME_CMODE_ALPHANUMERIC = 0x0000: direct English/alphanumeric input
# IME_SMODE_NONE = 0
IME_CMODE_ALPHANUMERIC = 0x0000
IME_SMODE_NONE = 0


def _get_foreground_window():
    if _imm32 is None:
        return None
    return ctypes.windll.user32.GetForegroundWindow()  # type: ignore[attr-defined]


def save_and_switch_ime_to_english() -> Optional[Tuple[int, int]]:
    """
    Save current IME conversion/sentence status and switch to English (alphanumeric) mode.
    Returns (saved_conversion, saved_sentence) for restore_ime(), or None if not supported/failed.
    """
    hwnd = _get_foreground_window()
    if not hwnd:
        return None
    h_imc = _imm32.ImmGetContext(hwnd)
    if not h_imc:
        return None
    conv = ctypes.c_ulong(0)
    sent = ctypes.c_ulong(0)
    saved = None
    if _imm32.ImmGetConversionStatus(h_imc, ctypes.byref(conv), ctypes.byref(sent)):
        saved = (int(conv.value), int(sent.value))
        _imm32.ImmSetConversionStatus(h_imc, IME_CMODE_ALPHANUMERIC, IME_SMODE_NONE)
    _imm32.ImmReleaseContext(hwnd, h_imc)
    return saved


def restore_ime(saved: Optional[Tuple[int, int]]) -> bool:
    """
    Restore IME conversion/sentence status from save_and_switch_ime_to_english().
    Returns True if restored, False otherwise.
    """
    if saved is None:
        return False
    hwnd = _get_foreground_window()
    if not hwnd:
        return False
    h_imc = _imm32.ImmGetContext(hwnd)
    if not h_imc:
        return False
    conv, sent = saved
    ok = bool(_imm32.ImmSetConversionStatus(h_imc, conv, sent))
    _imm32.ImmReleaseContext(hwnd, h_imc)
    return ok


def is_ime_switch_available() -> bool:
    """True if IME save/restore is available (Windows with Imm32)."""
    return _imm32 is not None


__all__ = [
    "save_and_switch_ime_to_english",
    "restore_ime",
    "is_ime_switch_available",
]
