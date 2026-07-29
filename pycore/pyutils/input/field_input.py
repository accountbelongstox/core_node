# -*- coding: utf-8 -*-
"""
Generic field input simulator: focus, clear, and type into input fields.

Public utility for any caller (no app-specific deps). Supports:
- Simulated keyboard input (and optional clipboard paste for Unicode).
- Auto-clear: replace (Ctrl+A then type), append (End then type), or none.
- Configurable random interval between keystrokes (default 0.1–0.3s).
- Optional focus: click at (x, y) or run a custom focus callable before typing.
- IME switch/restore (Windows): switch to English before typing, restore after.
"""
import random
import time
from typing import Optional, Tuple, Callable

from pycore.pyfoundations.third_party.api import get_third_package_pyautogui
from pycore.pyutils.common.clipboard_text import get_clipboard_text, set_clipboard_text
from pycore.pyutils.input.ime_switch import save_and_switch_ime_to_english, restore_ime

# Clear mode: replace = clear then type; append = type at end; none = type only (no clear)
CLEAR_MODE_REPLACE = "replace"
CLEAR_MODE_APPEND = "append"
CLEAR_MODE_NONE = "none"


def _pyautogui():
    p = get_third_package_pyautogui()
    if p is None:
        raise RuntimeError("pyautogui not available")
    return p


def _is_ascii_only(text: str) -> bool:
    return all(ord(c) < 128 for c in text)


def _paste_via_clipboard(text: str) -> bool:
    """Set clipboard to text, send Ctrl+V, then restore previous clipboard."""
    try:
        backup = get_clipboard_text()
        if not set_clipboard_text(text):
            return False
        time.sleep(0.05)
        pag = _pyautogui()
        pag.hotkey("ctrl", "v")
        time.sleep(0.05)
        if backup is not None:
            set_clipboard_text(backup)
        return True
    except Exception:
        return False


def _ime_wrap_typing(ensure_ime_english: bool, do_type: Callable[[], bool]) -> bool:
    """Run do_type(); if ensure_ime_english, switch to English before and restore after."""
    if not ensure_ime_english:
        return do_type()
    saved = save_and_switch_ime_to_english()
    try:
        return do_type()
    finally:
        if saved is not None:
            restore_ime(saved)


def type_into_field(
    text: str,
    *,
    focus_xy: Optional[Tuple[int, int]] = None,
    focus_callable: Optional[Callable[[], bool]] = None,
    clear_mode: str = CLEAR_MODE_REPLACE,
    interval_min: float = 0.1,
    interval_max: float = 0.3,
    after_focus_delay: float = 0.2,
    after_clear_delay: float = 0.05,
    use_clipboard_for_unicode: bool = True,
    ensure_ime_english: bool = True,
    set_value_fallback: Optional[Callable[[str], bool]] = None,
) -> bool:
    """
    Focus (optional), clear (by mode), then type text into the active/selected field.
    On Windows, optionally switches IME to English before typing and restores after.
    If keyboard typing fails and set_value_fallback is provided (e.g. UIA ValuePattern.SetValue),
    calls set_value_fallback(text) and returns its result.

    Args:
        text: Content to type (supports ASCII and, with use_clipboard_for_unicode, Chinese etc.).
        focus_xy: If set, click at (x, y) before typing to focus the field.
        focus_callable: If set, called before typing; if it returns False, abort and return False.
        clear_mode: "replace" = Ctrl+A then type (default); "append" = End then type; "none" = type only.
        interval_min: Min delay in seconds between keystrokes (for keyboard typing).
        interval_max: Max delay in seconds between keystrokes.
        after_focus_delay: Seconds to wait after focus (click or callable) before clear/type.
        after_clear_delay: Seconds to wait after clear (Ctrl+A or End) before typing.
        use_clipboard_for_unicode: If True and text contains non-ASCII, paste via clipboard instead of key type.
        ensure_ime_english: If True (default), on Windows switch IME to English before typing and restore after.
        set_value_fallback: If keyboard fails, call this with text (e.g. ValuePattern.SetValue); return its result.

    Returns:
        True if typing or fallback completed successfully, False on failure.
    """
    pag = _pyautogui()

    if focus_callable is not None:
        if not focus_callable():
            return False
        time.sleep(after_focus_delay)
    elif focus_xy is not None:
        pag.click(focus_xy[0], focus_xy[1])
        time.sleep(after_focus_delay)

    if clear_mode == CLEAR_MODE_REPLACE:
        pag.hotkey("ctrl", "a")
        time.sleep(after_clear_delay)
    elif clear_mode == CLEAR_MODE_APPEND:
        pag.press("end")
        time.sleep(after_clear_delay)
    elif clear_mode != CLEAR_MODE_NONE:
        pass

    if not text:
        return True

    def _do_type() -> bool:
        use_paste = use_clipboard_for_unicode and not _is_ascii_only(text)
        if use_paste:
            return _paste_via_clipboard(text)
        for c in text:
            try:
                pag.write(c, interval=0)
            except Exception:
                try:
                    _paste_via_clipboard(c)
                except Exception:
                    return False
            delay = random.uniform(interval_min, interval_max)
            if delay > 0:
                time.sleep(delay)
        return True

    ok = _ime_wrap_typing(ensure_ime_english, _do_type)
    if not ok and set_value_fallback is not None:
        try:
            return set_value_fallback(text)
        except Exception:
            return False
    return ok


def fill_field_with_fallback(
    text: str,
    set_value_callable: Callable[[str], bool],
    *,
    focus_callable: Optional[Callable[[], bool]] = None,
    focus_xy: Optional[Tuple[int, int]] = None,
    prefer_set_value: bool = True,
    **kwargs,
) -> bool:
    """
    Fill a field by trying one method first, then the other.
    prefer_set_value True: try set_value_callable(text) first, on failure try keyboard (type_into_field).
    prefer_set_value False: try keyboard first, on failure try set_value_callable(text).
    Pass focus_callable or focus_xy and other type_into_field kwargs as needed.
    """
    if not text:
        return True
    if prefer_set_value:
        if set_value_callable(text):
            return True
        return type_into_field(text, focus_callable=focus_callable, focus_xy=focus_xy, **kwargs)
    return type_into_field(
        text,
        focus_callable=focus_callable,
        focus_xy=focus_xy,
        set_value_fallback=set_value_callable,
        **kwargs,
    )


class FieldInputSimulator:
    """
    Configurable simulator for typing into input fields.
    Same behavior as type_into_field() but with options set once and input_text() called multiple times.
    """

    def __init__(
        self,
        clear_mode: str = CLEAR_MODE_REPLACE,
        interval_min: float = 0.1,
        interval_max: float = 0.3,
        after_focus_delay: float = 0.2,
        after_clear_delay: float = 0.05,
        use_clipboard_for_unicode: bool = True,
        ensure_ime_english: bool = True,
    ):
        self.clear_mode = clear_mode
        self.interval_min = interval_min
        self.interval_max = interval_max
        self.after_focus_delay = after_focus_delay
        self.after_clear_delay = after_clear_delay
        self.use_clipboard_for_unicode = use_clipboard_for_unicode
        self.ensure_ime_english = ensure_ime_english

    def input_text(
        self,
        text: str,
        *,
        focus_xy: Optional[Tuple[int, int]] = None,
        focus_callable: Optional[Callable[[], bool]] = None,
        set_value_fallback: Optional[Callable[[str], bool]] = None,
    ) -> bool:
        """Type text with this simulator's options. Optional focus and set_value fallback."""
        return type_into_field(
            text,
            focus_xy=focus_xy,
            focus_callable=focus_callable,
            clear_mode=self.clear_mode,
            interval_min=self.interval_min,
            interval_max=self.interval_max,
            after_focus_delay=self.after_focus_delay,
            after_clear_delay=self.after_clear_delay,
            use_clipboard_for_unicode=self.use_clipboard_for_unicode,
            ensure_ime_english=self.ensure_ime_english,
            set_value_fallback=set_value_fallback,
        )


__all__ = [
    "CLEAR_MODE_REPLACE",
    "CLEAR_MODE_APPEND",
    "CLEAR_MODE_NONE",
    "type_into_field",
    "fill_field_with_fallback",
    "FieldInputSimulator",
]
