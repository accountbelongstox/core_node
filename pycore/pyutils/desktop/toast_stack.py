# -*- coding: utf-8 -*-
"""
Desktop toast stack — borderless always-on-top popup cards anchored to the
bottom-right corner of the primary screen.

Shared UI library for pycore desktop notifications:
- Stacked cards: the newest toast sits at the bottom and pushes older cards up.
- Click-to-copy: when ``copy_text`` is given, clicking the card body copies it
  to the system clipboard and flashes a confirmation.
- Auto-dismiss with a close button; at most MAX_VISIBLE cards (oldest drops).
- Cross-platform (Windows / Linux X11+XWayland) through tkinter; headless
  Linux sessions (no DISPLAY/WAYLAND_DISPLAY) are skipped with a log line.

Threading: tkinter owns a single dedicated daemon thread (ToastStackThread).
``show_toast`` is safe to call from any thread; requests are pumped through a
queue into the tk loop. No third-party dependency.

Usage:
    from pycore.pyutils.desktop.toast_stack import show_desktop_toast

    show_desktop_toast(
        title="New prompt derived",
        message="derived english text",
        copy_text="derived english text",
    )
"""

import queue
import sys
import threading
from typing import List, Optional

from pycore.pyfoundations.desktop_session import has_graphical_display
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

try:
    import tkinter as tk
    TK_AVAILABLE = True
except ImportError:
    tk = None
    TK_AVAILABLE = False


TOAST_WIDTH = 360
TOAST_HEIGHT = 108
TOAST_MARGIN = 16
TOAST_GAP = 10
MAX_VISIBLE = 5
DEFAULT_DURATION_MS = 9000
MESSAGE_CHAR_CAP = 160
QUEUE_POLL_MS = 100

BG_COLOR = "#1e293b"
BORDER_COLOR = "#6366f1"
TITLE_COLOR = "#e2e8f0"
TEXT_COLOR = "#cbd5e1"
HINT_COLOR = "#818cf8"
CLOSE_COLOR = "#94a3b8"

_REQUEST_QUEUE: "queue.Queue[dict]" = queue.Queue()
_INSTANCE: Optional["ToastStackThread"] = None
_INSTANCE_LOCK = threading.Lock()
_SHUTDOWN_REGISTERED = False


def desktop_toast_available() -> bool:
    """True when a desktop toast can be shown on this host."""
    if not TK_AVAILABLE:
        return False
    if sys.platform == "win32":
        return True
    if sys.platform.startswith("linux"):
        return has_graphical_display()
    return False


class _ToastCard:
    """One borderless Toplevel card owned by the tk thread."""

    def __init__(self, root: "tk.Tk", title: str, message: str,
                 copy_text: Optional[str], duration_ms: int) -> None:
        self.copy_text = copy_text or ""
        self.window = tk.Toplevel(root)
        win = self.window
        win.overrideredirect(True)
        win.attributes("-topmost", True)
        win.configure(bg=BORDER_COLOR)

        frame = tk.Frame(win, bg=BG_COLOR, padx=10, pady=8)
        frame.pack(fill="both", expand=True, padx=1, pady=1)

        header = tk.Frame(frame, bg=BG_COLOR)
        header.pack(fill="x")
        title_label = tk.Label(
            header, text=title, bg=BG_COLOR, fg=TITLE_COLOR,
            font=("Segoe UI", 10, "bold"), anchor="w", justify="left",
        )
        title_label.pack(side="left", fill="x", expand=True)
        close_label = tk.Label(
            header, text="x", bg=BG_COLOR, fg=CLOSE_COLOR,
            font=("Segoe UI", 10, "bold"), cursor="hand2",
        )
        close_label.pack(side="right")
        close_label.bind("<Button-1>", lambda _e: self.dismiss())

        text = message if len(message) <= MESSAGE_CHAR_CAP else message[:MESSAGE_CHAR_CAP] + "..."
        self.body_label = tk.Label(
            frame, text=text, bg=BG_COLOR, fg=TEXT_COLOR,
            font=("Segoe UI", 9), anchor="nw", justify="left",
            wraplength=TOAST_WIDTH - 24,
        )
        self.body_label.pack(fill="both", expand=True, pady=(2, 0))
        if self.copy_text:
            self.body_label.configure(cursor="hand2")
            self.body_label.bind("<Button-1>", lambda _e: self.copy())
            hint = tk.Label(
                frame, text="Click to copy", bg=BG_COLOR, fg=HINT_COLOR,
                font=("Segoe UI", 8), anchor="w",
            )
            hint.pack(fill="x")
            self._hint_label = hint
        else:
            self._hint_label = None

        win.geometry(f"{TOAST_WIDTH}x{TOAST_HEIGHT}")
        win.bind("<Button-1>", lambda _e: self.copy() if self.copy_text else None)
        self._after_id = win.after(max(1500, int(duration_ms)), self.dismiss)

    def copy(self) -> None:
        if not self.copy_text:
            return
        self.window.clipboard_clear()
        self.window.clipboard_append(self.copy_text)
        self.window.update()
        if self._hint_label is not None:
            self._hint_label.configure(text="Copied")

    def place(self, x: int, y: int) -> None:
        self.window.geometry(f"{TOAST_WIDTH}x{TOAST_HEIGHT}+{x}+{y}")

    def dismiss(self) -> None:
        try:
            if self._after_id is not None:
                self.window.after_cancel(self._after_id)
                self._after_id = None
        except Exception:
            pass
        try:
            self.window.destroy()
        except Exception:
            pass


class ToastStackThread(threading.Thread):
    """Dedicated tk thread rendering the bottom-right toast stack."""

    def __init__(self) -> None:
        super().__init__(name="DesktopToastStackThread", daemon=True)
        self._root: Optional["tk.Tk"] = None
        self._cards: List[_ToastCard] = []
        self._ready = threading.Event()

    def run(self) -> None:
        try:
            self._root = tk.Tk()
        except Exception as exc:
            ColorPrint.yellow(f"[ToastStack] tk root unavailable: {exc}")
            self._ready.set()
            return
        self._root.withdraw()
        self._root.after(QUEUE_POLL_MS, self._pump)
        self._ready.set()
        ColorPrint.green("[ToastStack] desktop toast thread running")
        try:
            self._root.mainloop()
        except Exception as exc:
            ColorPrint.yellow(f"[ToastStack] mainloop exited: {exc}")

    def _pump(self) -> None:
        while True:
            try:
                request = _REQUEST_QUEUE.get_nowait()
            except queue.Empty:
                break
            self._show(request)
        if self._root is not None:
            self._root.after(QUEUE_POLL_MS, self._pump)

    def _show(self, request: dict) -> None:
        if self._root is None:
            return
        card = _ToastCard(
            self._root,
            str(request.get("title") or ""),
            str(request.get("message") or ""),
            request.get("copy_text"),
            int(request.get("duration_ms") or DEFAULT_DURATION_MS),
        )
        self._cards.append(card)
        while len(self._cards) > MAX_VISIBLE:
            oldest = self._cards.pop(0)
            oldest.dismiss()
        self._restack()

    def _restack(self) -> None:
        """Newest card at the bottom; older cards pushed up one slot each."""
        if self._root is None:
            return
        screen_w = self._root.winfo_screenwidth()
        screen_h = self._root.winfo_screenheight()
        live: List[_ToastCard] = []
        for card in self._cards:
            try:
                if card.window.winfo_exists():
                    live.append(card)
            except Exception:
                pass
        self._cards = live
        count = len(self._cards)
        for index, card in enumerate(self._cards):
            depth = count - index  # newest (last) gets depth 1 → bottom slot
            x = screen_w - TOAST_WIDTH - TOAST_MARGIN
            y = screen_h - TOAST_MARGIN - depth * TOAST_HEIGHT - (depth - 1) * TOAST_GAP
            card.place(x, y)

    def stop(self) -> None:
        if self._root is None:
            return
        try:
            self._root.after(0, self._root.destroy)
        except Exception:
            pass


def _ensure_thread() -> Optional[ToastStackThread]:
    global _INSTANCE, _SHUTDOWN_REGISTERED
    if not desktop_toast_available():
        ColorPrint.yellow("[ToastStack] desktop toast unavailable (headless or no tkinter)")
        return None
    with _INSTANCE_LOCK:
        if _INSTANCE is not None and _INSTANCE.is_alive():
            return _INSTANCE
        _INSTANCE = ToastStackThread()
        _INSTANCE.start()
        if not _SHUTDOWN_REGISTERED:
            _SHUTDOWN_REGISTERED = True
            THREAD_BUS.register_shutdown_handler(
                lambda: _INSTANCE.stop() if _INSTANCE else None,
                priority=85,
                name="desktop_toast_stack",
            )
    _INSTANCE._ready.wait(timeout=5)
    if _INSTANCE._root is None:
        return None
    return _INSTANCE


def show_desktop_toast(
    title: str,
    message: str,
    copy_text: Optional[str] = None,
    duration_ms: int = DEFAULT_DURATION_MS,
) -> bool:
    """
    Queue a bottom-right stacked desktop toast. Thread-safe, non-blocking.

    Args:
        title: Bold headline line.
        message: Body text (capped for display).
        copy_text: When set, clicking the card copies this to the clipboard.
        duration_ms: Auto-dismiss delay.

    Returns:
        True when the toast was queued, False when desktop UI is unavailable.
    """
    if _ensure_thread() is None:
        return False
    _REQUEST_QUEUE.put({
        "title": title,
        "message": message,
        "copy_text": copy_text,
        "duration_ms": duration_ms,
    })
    return True


__all__ = ["show_desktop_toast", "desktop_toast_available", "ToastStackThread"]
