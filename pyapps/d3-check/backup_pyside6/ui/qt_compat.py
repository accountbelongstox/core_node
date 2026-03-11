# -*- coding: utf-8 -*-
"""
Qt root compatibility layer: provides Tk-like API on QWidget so controller,
config_change_hub, game_interface_data, event_center etc. work unchanged.
"""

from typing import Callable, Optional, List, Any

from PySide6.QtCore import QTimer, Qt
from PySide6.QtGui import QCursor
from PySide6.QtWidgets import QWidget, QApplication


def _qt_app() -> QApplication:
    app = QApplication.instance()
    if app is None:
        raise RuntimeError("QApplication must be created before using Qt UI")
    return app


class TkCompatRootMixin:
    """
    Mixin for QMainWindow (or QWidget) to expose Tk-like API: after, after_cancel,
    winfo_*, geometry, deiconify, withdraw, lift, focus_force, title, minsize, etc.
    """
    _geometry_save_timer: Optional[QTimer] = None

    def after(self, ms: int, callback: Callable[[], None]) -> Optional[QTimer]:
        """Schedule callback on main thread after ms. Returns timer id for after_cancel."""
        t = QTimer(self)
        t.setSingleShot(True)
        t.timeout.connect(lambda: self._run_after_callback(t, callback))
        t.start(ms)
        return t

    def _run_after_callback(self, timer: QTimer, callback: Callable[[], None]) -> None:
        try:
            if not getattr(timer, "_cancelled", False):
                callback()
        finally:
            timer.deleteLater()

    def after_cancel(self, timer_id: Optional[Any]) -> None:
        """Cancel a scheduled after(). timer_id is the return value of after()."""
        if timer_id is None:
            return
        if isinstance(timer_id, QTimer):
            timer_id._cancelled = True
            timer_id.stop()
            timer_id.deleteLater()

    def winfo_exists(self) -> bool:
        """True if window is not destroyed and still valid."""
        if isinstance(self, QWidget):
            return not getattr(self, "_tk_compat_closed", False)
        return True

    def winfo_width(self) -> int:
        if isinstance(self, QWidget):
            return self.width()
        return 0

    def winfo_height(self) -> int:
        if isinstance(self, QWidget):
            return self.height()
        return 0

    def winfo_rootx(self) -> int:
        if isinstance(self, QWidget):
            return self.frameGeometry().x()
        return 0

    def winfo_rooty(self) -> int:
        if isinstance(self, QWidget):
            return self.frameGeometry().y()
        return 0

    def winfo_x(self) -> int:
        return self.winfo_rootx()

    def winfo_y(self) -> int:
        return self.winfo_rooty()

    def winfo_pointerx(self) -> int:
        return QCursor.pos().x()

    def winfo_pointery(self) -> int:
        return QCursor.pos().y()

    def winfo_screenwidth(self) -> int:
        screen = QApplication.primaryScreen()
        return screen.size().width() if screen else 1920

    def winfo_screenheight(self) -> int:
        screen = QApplication.primaryScreen()
        return screen.size().height() if screen else 1080

    def winfo_id(self) -> int:
        """Native window handle (HWND on Windows) for SetForegroundWindow etc."""
        if isinstance(self, QWidget):
            wid = self.winId()
            return int(wid) if wid else 0
        return 0

    def winfo_children(self) -> List[QWidget]:
        if isinstance(self, QWidget):
            return self.findChildren(QWidget, "", Qt.FindChildOption.FindDirectChildrenOnly)
        return []

    def geometry(self, geos: Optional[str] = None) -> Optional[str]:
        """Set or get geometry string 'WxH+X+Y' or '+X+Y'."""
        if isinstance(self, QWidget):
            if geos is not None:
                s = geos.strip()
                if s.startswith("+"):
                    parts = s[1:].replace("+", " ").split()
                    if len(parts) >= 2:
                        x, y = int(parts[0]), int(parts[1])
                        self.move(x, y)
                    return None
                parts = s.replace("+", " ").replace("x", " ").split()
                if len(parts) >= 4:
                    w, h, x, y = int(parts[0]), int(parts[1]), int(parts[2]), int(parts[3])
                    self.setGeometry(x, y, w, h)
                elif len(parts) >= 2:
                    self.resize(int(parts[0]), int(parts[1]))
                return None
            g = self.geometry()
            return f"{g.width()}x{g.height()}+{self.frameGeometry().x()}+{self.frameGeometry().y()}"
        return None

    def deiconify(self) -> None:
        if isinstance(self, QWidget):
            self.show()
            self.raise_()
            self.activateWindow()

    def withdraw(self) -> None:
        if isinstance(self, QWidget):
            self.hide()

    def lift(self) -> None:
        if isinstance(self, QWidget):
            self.raise_()

    def focus_force(self) -> None:
        if isinstance(self, QWidget):
            self.activateWindow()
            self.setFocus()

    def title(self, text: Optional[str] = None) -> Optional[str]:
        if isinstance(self, QWidget):
            if text is not None:
                self.setWindowTitle(text)
                return None
            return self.windowTitle()
        return None

    def minsize(self, width: Optional[int] = None, height: Optional[int] = None) -> None:
        if isinstance(self, QWidget) and width is not None and height is not None:
            self.setMinimumSize(width, height)

    def resizable(self, width: bool = True, height: bool = True) -> None:
        if isinstance(self, QWidget):
            self.setMinimumSize(0, 0) if (width and height) else None
            # Qt is resizable by default; no need to set

    def configure(self, **kwargs) -> None:
        if "bg" in kwargs and isinstance(self, QWidget):
            self.setStyleSheet(f"background-color: {kwargs['bg']};")

    def bind(self, sequence: str, handler: Optional[Callable] = None) -> Optional[str]:
        """Simplified: only Map and Configure are used in diablo3_macro_ui. Map -> showEvent; Configure -> resizeEvent."""
        return None

    def mainloop(self) -> None:
        _qt_app().exec()

    def protocol(self, name: str, func: Optional[Callable] = None) -> None:
        """WM_DELETE_WINDOW: close event is handled by closeEvent in main window."""
        pass

    def grab_current(self) -> Optional[Any]:
        """Tk compat: no grab in Qt; return None."""
        return None

    def quit(self) -> None:
        """Tk compat: quit app."""
        _qt_app().quit()

    def update_idletasks(self) -> None:
        """Tk compat: process pending events."""
        _qt_app().processEvents()

    def update(self) -> None:
        """Tk compat: process pending events."""
        _qt_app().processEvents()

    def destroy(self) -> None:
        """Tk compat: close and mark as closed."""
        if isinstance(self, QWidget):
            self._tk_compat_closed = True
            self.close()
            self.deleteLater()
