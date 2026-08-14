#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
THREAD_BUS window-control bridge for the PySide6 framework.

Cross-thread window control routing: THREAD_BUS event handlers may fire on ANY
thread (Tray, RPC v2, tick, ...). They emit Qt Signals which Qt marshals into
the Qt main thread, so the actual GUI mutations (move/resize/show/hide/...)
always run on the GUI thread.

SIGNAL OWNERSHIP (critical): The 10 _thread_bus_*_signal Signals are declared
in the class body of ThreadBusBridgeMixin, which subclasses QObject. Declaring
Signals inside a QObject-subclass class body is the ONLY form PySide6 accepts;
signals assigned outside a class body (module-level or post-creation) silently
fail to bind and never emit. PySide6Framework inherits this mixin, so the
signals remain valid descriptors in the framework's MRO and bind to each
framework instance. Single QObject base (this mixin) + plain StartupController
mixin composes safely.

Expected on the concrete framework instance (provided at runtime):
    self.config          (PySide6UIConfig: thread_bus_namespace, app_id, enable_tray, debug)
    self.main_window     (Optional[PySide6MainWindow])
    self.system_tray     (Optional[PySide6SystemTray])
    self.qt_app          (Optional[QApplication])
    self.show_window() / self.hide_window() / self.toggle_window() / self.quit()
    self._publish_window_visible(bool)
"""

import hashlib
import json
import time

from PySide6.QtCore import QObject, Signal, Slot
from PySide6.QtWidgets import QApplication

from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

from pycore.pyutils.native_ui.step5_main_ui.pyside6.system_tray import build_pyside6_menu_from_dicts


class ThreadBusBridgeMixin(QObject):
    """
    QObject base mixin carrying the THREAD_BUS control Signals and their
    wiring (event listeners + signal/slot connections), event handlers and
    Qt-main-thread slot implementations.
    """

    # Internal signals for thread-safe THREAD_BUS control.
    # These signals ensure GUI operations execute in the Qt main thread.
    _thread_bus_show_signal = Signal()
    _thread_bus_hide_signal = Signal()
    _thread_bus_toggle_signal = Signal(object)
    _thread_bus_move_signal = Signal(int, int)  # x, y
    _thread_bus_resize_signal = Signal(int, int)  # width, height
    _thread_bus_close_signal = Signal()
    _thread_bus_minimize_signal = Signal()
    _thread_bus_maximize_signal = Signal()
    _thread_bus_update_tray_menu_signal = Signal(object)  # menu items (list of dicts)
    _thread_bus_subtitle_mode_signal = Signal(bool)  # subtitle compact mode: True=enter, False=exit
    _thread_bus_tray_menu_signature = {'value': None}

    # ========== THREAD_BUS Integration ==========

    def _setup_thread_bus_bridge(self):
        """
        Connect the THREAD_BUS control signals to their Qt-main-thread slots
        and register THREAD_BUS event listeners for window control (always
        enabled).

        IMPORTANT: These event handlers may be called from ANY thread (Tray,
        RPC v2, etc.). They emit Qt signals which automatically execute in the
        Qt main thread for thread safety.
        """
        # Internal signal -> slot connections (thread-safe marshalling into Qt main thread)
        self._thread_bus_show_signal.connect(self.show_window)
        self._thread_bus_hide_signal.connect(self.hide_window)
        self._thread_bus_toggle_signal.connect(self.toggle_window)
        self._thread_bus_move_signal.connect(self._do_move_window)
        self._thread_bus_resize_signal.connect(self._do_resize_window)
        self._thread_bus_close_signal.connect(self.quit)
        self._thread_bus_minimize_signal.connect(self._do_minimize_window)
        self._thread_bus_maximize_signal.connect(self._do_maximize_window)
        self._thread_bus_update_tray_menu_signal.connect(self._do_update_tray_menu)
        self._thread_bus_subtitle_mode_signal.connect(self._do_subtitle_mode)

        # Determine namespace: use thread_bus_namespace if provided, else use app_id, else 'ui'
        namespace = self.config.thread_bus_namespace
        if not namespace:
            namespace = self.config.app_id if self.config.app_id else "ui"

        # Define event names
        events = {
            f"{namespace}.show": self._on_thread_bus_show,
            f"{namespace}.hide": self._on_thread_bus_hide,
            f"{namespace}.toggle": self._on_thread_bus_toggle,
            f"{namespace}.move": self._on_thread_bus_move,
            f"{namespace}.resize": self._on_thread_bus_resize,
            f"{namespace}.close": self._on_thread_bus_close,
            f"{namespace}.minimize": self._on_thread_bus_minimize,
            f"{namespace}.maximize": self._on_thread_bus_maximize,
        }

        # Register event handlers
        for event_name, handler in events.items():
            THREAD_BUS.register_event_handler(event_name, handler)

        # Tray menu live-update for the Qt tray (only when this framework owns the tray;
        # the independent pystray tray registers its own 'tray.update_menu' handler).
        if self.config.enable_tray:
            THREAD_BUS.register_event_handler('tray.update_menu', self._on_thread_bus_update_tray_menu)
            last_payload = THREAD_BUS.get_signal('tray.menu.payload')
            if isinstance(last_payload, dict):
                menu_items = last_payload.get('menu_items')
                if menu_items is not None:
                    self._on_thread_bus_update_tray_menu({'menu_items': menu_items})

        # Voice-subtitle compact ("Subtitle Mode") window control. Triggered by the
        # web UI via HTTP controller -> thread_bus/trigger_event. Handled here (Qt thread)
        # because window/screen geometry must be touched on the GUI thread.
        THREAD_BUS.register_event_handler('voice_subtitle.subtitle_mode_enter', self._on_thread_bus_subtitle_mode_enter)
        THREAD_BUS.register_event_handler('voice_subtitle.subtitle_mode_exit', self._on_thread_bus_subtitle_mode_exit)

        if self.config.debug:
            ColorPrint.green(f"[PySide6Framework] Registered THREAD_BUS listeners with namespace: {namespace}")

    # ========== THREAD_BUS event handlers (any thread -> emit Qt signal) ==========

    def _on_thread_bus_show(self, event_data):
        """
        Handle show event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.
        """
        self._thread_bus_show_signal.emit()

    def _on_thread_bus_hide(self, event_data):
        """
        Handle hide event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.
        """
        self._thread_bus_hide_signal.emit()

    def _on_thread_bus_toggle(self, event_data):
        """
        Handle toggle event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.
        """
        timing = event_data.get("_tray_timing") if isinstance(event_data, dict) else None
        if isinstance(timing, dict):
            elapsed_ms = (time.perf_counter() - timing["started_at"]) * 1000
            ColorPrint.blue(
                f"[TrayTiming] id={timing.get('trace_id', '?')} qt_signal_queued "
                f"wall={time.strftime('%Y-%m-%d %H:%M:%S')} elapsed={elapsed_ms:.3f}ms"
            )
        self._thread_bus_toggle_signal.emit(event_data)

    def _on_thread_bus_move(self, event_data):
        """
        Handle move event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.

        event_data expected format:
        {
            'x': int,  # X coordinate
            'y': int   # Y coordinate
        }
        """
        if isinstance(event_data, dict):
            x = event_data.get('x')
            y = event_data.get('y')
            if x is not None and y is not None:
                self._thread_bus_move_signal.emit(int(x), int(y))

    def _on_thread_bus_resize(self, event_data):
        """
        Handle resize event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.

        event_data expected format:
        {
            'width': int,   # Width
            'height': int   # Height
        }
        """
        if isinstance(event_data, dict):
            width = event_data.get('width')
            height = event_data.get('height')
            if width is not None and height is not None:
                self._thread_bus_resize_signal.emit(int(width), int(height))

    def _on_thread_bus_close(self, event_data):
        """
        Handle close event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.
        """
        self.request_quit()

    def request_quit(self):
        """Queue application shutdown on the Qt main thread."""
        self._thread_bus_close_signal.emit()

    def _on_thread_bus_minimize(self, event_data):
        """
        Handle minimize event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.
        """
        self._thread_bus_minimize_signal.emit()

    def _on_thread_bus_maximize(self, event_data):
        """
        Handle maximize event from THREAD_BUS (may be called from any thread).
        Emits signal to execute in Qt main thread.
        """
        self._thread_bus_maximize_signal.emit()

    def _on_thread_bus_update_tray_menu(self, event_data):
        """
        Handle tray.update_menu event from THREAD_BUS (may be called from any thread).
        Emits signal to rebuild the native tray menu in the Qt main thread.

        event_data expected format: {'menu_items': List[dict]}  (canonical dict menu)
        """
        if isinstance(event_data, dict):
            menu_items = event_data.get('menu_items')
            if menu_items is not None:
                self._thread_bus_update_tray_menu_signal.emit(menu_items)

    def _on_thread_bus_subtitle_mode_enter(self, event_data):
        """voice_subtitle.subtitle_mode_enter (any thread) -> Qt thread."""
        self._thread_bus_subtitle_mode_signal.emit(True)

    def _on_thread_bus_subtitle_mode_exit(self, event_data):
        """voice_subtitle.subtitle_mode_exit (any thread) -> Qt thread."""
        self._thread_bus_subtitle_mode_signal.emit(False)

    # ========== THREAD_BUS Signal Slots (Qt main thread helpers) ==========

    @Slot(int, int)
    def _do_move_window(self, x: int, y: int):
        """Move window (called via signal in Qt main thread)."""
        if self.main_window:
            self.main_window.move(x, y)

    @Slot(int, int)
    def _do_resize_window(self, width: int, height: int):
        """Resize window (called via signal in Qt main thread)."""
        if self.main_window:
            self.main_window.resize(width, height)

    @Slot()
    def _do_minimize_window(self):
        """Minimize window (called via signal in Qt main thread)."""
        if self.main_window:
            self.main_window.minimize_window()

    @Slot()
    def _do_maximize_window(self):
        """Toggle maximize window (called via signal in Qt main thread)."""
        if self.main_window:
            self.main_window.toggle_maximize()

    @Slot(object)
    def _do_update_tray_menu(self, menu_items):
        """Rebuild the native tray menu (Qt main thread)."""
        if self.system_tray:
            signature = self._menu_signature(menu_items)
            if signature == self._thread_bus_tray_menu_signature.get('value'):
                return
            self._thread_bus_tray_menu_signature['value'] = signature
            self.system_tray.set_menu_items(build_pyside6_menu_from_dicts(menu_items))

    def _menu_signature(self, menu_items):
        """Create a stable tray menu signature for dedupe."""
        try:
            payload = json.dumps(
                menu_items,
                sort_keys=True,
                ensure_ascii=False,
                default=str,
            ).encode("utf-8")
            return hashlib.md5(payload).hexdigest()
        except Exception:
            return hashlib.md5(str(menu_items).encode("utf-8")).hexdigest()

    @Slot(bool)
    def _do_subtitle_mode(self, enter: bool):
        """
        Enter/exit compact "Subtitle Mode": a small window at the bottom-center of
        the screen (above the taskbar). Runs on the Qt main thread.
        """
        if not self.main_window:
            return
        if enter:
            self._subtitle_saved_geometry = self.main_window.geometry()
            screen = self.qt_app.primaryScreen() if self.qt_app else QApplication.primaryScreen()
            avail = screen.availableGeometry() if screen else None
            width, height = 1200, 200
            if avail:
                x = avail.x() + (avail.width() - width) // 2
                y = avail.y() + avail.height() - height - 10
            else:
                x, y = 100, 100
            self.main_window.setGeometry(x, y, width, height)
            self.main_window.show()
            self.main_window.raise_()
            self.main_window.activateWindow()
            self._publish_window_visible(True)
        else:
            saved = getattr(self, "_subtitle_saved_geometry", None)
            if saved is not None:
                self.main_window.setGeometry(saved)
