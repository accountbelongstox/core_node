# -*- coding: utf-8 -*-
"""
Signal utilities: re-apply SIGINT/SIGBREAK ignore for GUI mode.
Extracted so runtime.thread_registry can call reapply without importing system_initializer (avoids circular import).
"""
import signal

_gui_mode_sigint_ignored: bool = False


def set_gui_mode_sigint_ignored(value: bool) -> None:
    global _gui_mode_sigint_ignored
    _gui_mode_sigint_ignored = value


def _reapply_sigint_sigbreak_ignore() -> None:
    """Re-apply SIG_IGN so Fortran/numpy (loaded later) cannot override and cause forrtl control-C abort."""
    global _gui_mode_sigint_ignored
    if not _gui_mode_sigint_ignored:
        return
    try:
        signal.signal(signal.SIGINT, signal.SIG_IGN)
        if hasattr(signal, "SIGBREAK"):
            signal.signal(signal.SIGBREAK, signal.SIG_IGN)
    except Exception:
        pass


def reapply_sigint_sigbreak_ignore_for_gui() -> None:
    """Public: re-apply SIG_IGN for GUI mode (call when timer loop starts so forrtl control-C is ignored)."""
    _reapply_sigint_sigbreak_ignore()
