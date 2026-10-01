# -*- coding: utf-8 -*-
"""Desktop toast stack: borderless always-on-top cards anchored bottom-right.

The newest card sits at the bottom and pushes older cards up; clicking a card
with ``copy_text`` copies it. tkinter runs on one ToastStackThread; requests
from any thread go through a THREAD_BUS-owned deque pumped by the tk loop.
"""

import sys
import threading
from typing import List, Optional

from pycore.pyfoundations.desktop_session import has_graphical_display
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedDeque, SerializedValue
from pycore.pyfoundations.third_party.api import get_third_package_tkinter
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.native_ui.step0_i18n.i18n_keys import I18nKeys
from pycore.pyutils.native_ui.step0_i18n.i18n_manager import i18n

TOAST_WIDTH = 360
TOAST_HEIGHT = 108
TOAST_MARGIN = 16
TOAST_GAP = 10
MAX_VISIBLE = 5
DEFAULT_DURATION_MS = 9000
MIN_DURATION_MS = 1500
MESSAGE_CHAR_CAP = 160
QUEUE_POLL_MS = 100
READY_TIMEOUT_SECONDS = 5
READY_SIGNAL = "native_ui.toast_stack.ready"
SHUTDOWN_PRIORITY = 85

BG_COLOR = "#1e293b"
BORDER_COLOR = "#6366f1"
TITLE_COLOR = "#e2e8f0"
TEXT_COLOR = "#cbd5e1"
HINT_COLOR = "#818cf8"
CLOSE_COLOR = "#94a3b8"


def desktop_toast_available() -> bool:
    """True when a desktop toast can be shown on this host."""
    if sys.platform == "win32":
        return get_third_package_tkinter() is not None
    if sys.platform.startswith("linux"):
        return has_graphical_display() and get_third_package_tkinter() is not None
    return False


class ToastCard:
    """One borderless Toplevel card owned by the tk thread."""

    def __init__(self, root, title: str, message: str, copy_text: Optional[str], duration_ms: int) -> None:
        tk = get_third_package_tkinter()
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
        tk.Label(
            header, text=title, bg=BG_COLOR, fg=TITLE_COLOR,
            font=("Segoe UI", 10, "bold"), anchor="w", justify="left",
        ).pack(side="left", fill="x", expand=True)
        close_label = tk.Label(
            header, text="x", bg=BG_COLOR, fg=CLOSE_COLOR,
            font=("Segoe UI", 10, "bold"), cursor="hand2",
        )
        close_label.pack(side="right")
        close_label.bind("<Button-1>", lambda _e: self.dismiss())

        text = message if len(message) <= MESSAGE_CHAR_CAP else message[:MESSAGE_CHAR_CAP] + "..."
        body_label = tk.Label(
            frame, text=text, bg=BG_COLOR, fg=TEXT_COLOR,
            font=("Segoe UI", 9), anchor="nw", justify="left",
            wraplength=TOAST_WIDTH - 24,
        )
        body_label.pack(fill="both", expand=True, pady=(2, 0))
        self.hint_label = None
        if self.copy_text:
            body_label.configure(cursor="hand2")
            body_label.bind("<Button-1>", lambda _e: self.copy())
            self.hint_label = tk.Label(
                frame, text=i18n.get(I18nKeys.TOAST_CLICK_TO_COPY), bg=BG_COLOR, fg=HINT_COLOR,
                font=("Segoe UI", 8), anchor="w",
            )
            self.hint_label.pack(fill="x")

        win.geometry(f"{TOAST_WIDTH}x{TOAST_HEIGHT}")
        win.bind("<Button-1>", lambda _e: self.copy())
        win.after(max(MIN_DURATION_MS, int(duration_ms)), self.dismiss)

    def copy(self) -> None:
        if not self.copy_text:
            return
        self.window.clipboard_clear()
        self.window.clipboard_append(self.copy_text)
        self.window.update()
        if self.hint_label is not None:
            self.hint_label.configure(text=i18n.get(I18nKeys.TOAST_COPIED))

    def place(self, x: int, y: int) -> None:
        self.window.geometry(f"{TOAST_WIDTH}x{TOAST_HEIGHT}+{x}+{y}")

    def exists(self) -> bool:
        return bool(self.window.winfo_exists())

    def dismiss(self) -> None:
        if self.exists():
            self.window.destroy()


class ToastStackThread(threading.Thread):
    """Dedicated tk thread rendering the bottom-right toast stack."""

    def __init__(self, requests: SerializedDeque) -> None:
        super().__init__(name="DesktopToastStackThread", daemon=True)
        self.requests = requests
        self.root = None
        self.cards: List[ToastCard] = []

    def run(self) -> None:
        tk = get_third_package_tkinter()
        try:
            self.root = tk.Tk()
        except tk.TclError as exc:
            ColorPrint.yellow(f"[ToastStack] tk root unavailable: {exc}")
            THREAD_BUS.signal(READY_SIGNAL, False)
            return
        self.root.withdraw()
        self.root.after(QUEUE_POLL_MS, self.pump)
        THREAD_BUS.signal(READY_SIGNAL, True)
        ColorPrint.green("[ToastStack] desktop toast thread running")
        try:
            self.root.mainloop()
        except tk.TclError as exc:
            ColorPrint.yellow(f"[ToastStack] mainloop exited: {exc}")
        self.root = None

    def pump(self) -> None:
        request = self.requests.popleft()
        while request is not None:
            self.show(request)
            request = self.requests.popleft()
        if THREAD_BUS.is_shutdown_requested():
            self.root.destroy()
            return
        self.root.after(QUEUE_POLL_MS, self.pump)

    def show(self, request: dict) -> None:
        self.cards.append(ToastCard(
            self.root,
            str(request.get("title") or ""),
            str(request.get("message") or ""),
            request.get("copy_text"),
            int(request.get("duration_ms") or DEFAULT_DURATION_MS),
        ))
        while len(self.cards) > MAX_VISIBLE:
            self.cards.pop(0).dismiss()
        self.restack()

    def restack(self) -> None:
        """Newest card at the bottom; older cards pushed up one slot each."""
        screen_w = self.root.winfo_screenwidth()
        screen_h = self.root.winfo_screenheight()
        self.cards = [card for card in self.cards if card.exists()]
        count = len(self.cards)
        for index, card in enumerate(self.cards):
            depth = count - index
            x = screen_w - TOAST_WIDTH - TOAST_MARGIN
            y = screen_h - TOAST_MARGIN - depth * TOAST_HEIGHT - (depth - 1) * TOAST_GAP
            card.place(x, y)


class DesktopToastStack:
    """Owner of the toast request deque and its single tk thread."""

    def __init__(self) -> None:
        self.requests = SerializedDeque(name="DesktopToastRequests")
        self.started = SerializedValue(False, name="DesktopToastStarted")

    def ensure_started(self) -> bool:
        if not desktop_toast_available():
            ColorPrint.yellow("[ToastStack] desktop toast unavailable (headless or no tkinter)")
            return False
        if self.started.compare_and_set(False, True):
            ToastStackThread(self.requests).start()
        return bool(THREAD_BUS.wait_signal(READY_SIGNAL, timeout=READY_TIMEOUT_SECONDS))

    def show(
        self,
        title: str,
        message: str,
        copy_text: Optional[str] = None,
        duration_ms: int = DEFAULT_DURATION_MS,
    ) -> bool:
        """Queue a toast; False when desktop UI is unavailable."""
        if not self.ensure_started():
            return False
        self.requests.append({
            "title": title,
            "message": message,
            "copy_text": copy_text,
            "duration_ms": duration_ms,
        })
        return True


desktop_toast_stack = DesktopToastStack()
