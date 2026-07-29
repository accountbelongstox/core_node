#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diablo 3 Skill Macro UI Library - PySide6
Main UI coordinator using Qt components and panel stubs.
"""

import sys
import time
from typing import Optional, Callable
from pathlib import Path

from PySide6.QtCore import Qt, QObject, QEvent
from PySide6.QtWidgets import QWidget, QVBoxLayout, QTabWidget, QApplication, QMessageBox

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from providor.providor_index import CONFIG, set_config_value_async, get_config_value_safe
from providor.constants.common import (
    UI_SETTINGS_WINDOW_GEOMETRY,
    DEFAULT_WINDOW_GEOMETRY,
)
from ui.qt_main_window import D3MainWindow
from ui.qt_app_styles import get_global_stylesheet
from ui.components_qt import TitleBarQt, BottomBarQt, MacroControlsQt
from ui.components import SystemTray
from ui.panels_qt import (
    MainFunctionsPanelQt,
    LogPanelQt,
    RosbotExtensionPanelQt,
    D4PanelQt,
    CoordinateCalibrationPanelQt,
)
from ui.theme import UITheme
from providor.i18n_manager import i18n_manager
from providor.constants.ui import (
    TAB_INDEX_MAIN,
    TAB_INDEX_ROSBOT,
    TAB_INDEX_D4,
    TAB_INDEX_CALIBRATION,
    TAB_INDEX_LOG,
    TAB_COUNT,
    PANEL_KEY_MAIN,
    PANEL_KEY_ROSBOT,
    PANEL_KEY_D4,
    PANEL_KEY_CALIBRATION,
    PANEL_KEY_LOG,
)
from share.ui_registry import register_ui
from runtime import register_main_thread_handlers, trigger_window_show, trigger_app_exit
from pycore.pyutils.tk_taskbar import set_windows_app_user_model_id


class _GeometryFilter(QObject):
    """Event filter to debounce geometry save on move/resize."""

    def __init__(self, ui):
        super().__init__()
        self._ui = ui

    def eventFilter(self, obj, event):
        if event.type() in (QEvent.Type.Resize, QEvent.Type.Move):
            self._ui._on_window_configure()
        return False


class Diablo3MacroUI:
    """Diablo 3 Skill Macro UI - PySide6 implementation."""

    def get_panel(self, key: str):
        return self._panel_by_key.get(key)

    def __init__(self, initial_config="config1"):
        set_windows_app_user_model_id("pycore.d3check.1.0")
        self.root = D3MainWindow()
        self._app_icon_photo = None
        self.resize_direction = None
        self._is_maximized = False
        self._saved_geometry_restore = None
        self.system_tray = None
        i18n_manager.load_language_from_config()
        self._language_change_in_progress = False
        self.current_config = initial_config
        self.on_macro_start: Optional[Callable] = None
        self.on_macro_stop: Optional[Callable] = None
        self.on_config_change: Optional[Callable] = None
        self.on_skill_config_switch: Optional[Callable] = None
        self._initialization_complete = False
        self._panel_by_key = {}
        self._geometry_save_after_id = None
        self._taskbar_style_applied = False
        self._taskbar_fix_logged = False
        self._map_event_processed = False

        self.root.setWindowTitle(i18n_manager.get_ui_text("main_window.title"))
        initial_geos = CONFIG.get("ui_settings", {}).get(UI_SETTINGS_WINDOW_GEOMETRY) or DEFAULT_WINDOW_GEOMETRY
        self.root.geometry(initial_geos)
        app = QApplication.instance()
        if app:
            app.setStyleSheet(get_global_stylesheet())

        self.root.hide()
        self.root._on_close_callback = self._on_window_close
        self._create_ui()
        self.root.installEventFilter(_GeometryFilter(self))
        self.root.after(350, self._apply_taskbar_fix)
        self.root.after(500, self._apply_topmost_once)
        self._create_system_tray()
        self._load_last_tab()
        if self.last_selected_tab == TAB_INDEX_ROSBOT:
            self.rosbot_extension_panel.ensure_content_sync()
        self.root.show()
        self.root.raise_()
        self.root.activateWindow()
        register_main_thread_handlers(self)

    def _apply_topmost_once(self):
        self.root.raise_()
        self.root.activateWindow()

    def _create_ui(self):
        central = QWidget()
        layout = QVBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        self.root.setCentralWidget(central)

        self.title_bar = TitleBarQt(self)
        layout.addWidget(self.title_bar)

        self.bottom_bar = BottomBarQt(self)
        self.main_notebook = QTabWidget()
        self.main_notebook.setStyleSheet("")  # use global QSS
        self._create_main_tabs()
        layout.addWidget(self.main_notebook, 1)
        layout.addWidget(self.bottom_bar)

        self.macro_controls = MacroControlsQt(self.bottom_bar, on_start=self._on_start_macro, on_stop=self._on_stop_macro)
        self.bottom_bar.add_macro_controls(self.macro_controls)

    def _create_main_tabs(self):
        self._load_last_tab()
        self.table1_frame = QWidget()
        self.main_notebook.addTab(self.table1_frame, i18n_manager.get_ui_text("tabs.main_functions"))
        self.main_functions_panel = MainFunctionsPanelQt(self.table1_frame, self.current_config, self.bottom_bar)
        self.main_functions_panel.set_skill_config_switch_callback(self._on_skill_config_switch)
        lay1 = self.table1_frame.layout() or QVBoxLayout(self.table1_frame)
        lay1.addWidget(self.main_functions_panel)

        self.rosbot_frame = QWidget()
        self.main_notebook.addTab(self.rosbot_frame, i18n_manager.get_ui_text("tabs.rosbot_extension"))
        self.rosbot_extension_panel = RosbotExtensionPanelQt(self.rosbot_frame, bottom_bar=self.bottom_bar)
        lay2 = QVBoxLayout(self.rosbot_frame)
        lay2.addWidget(self.rosbot_extension_panel)

        self.d4_frame = QWidget()
        self.main_notebook.addTab(self.d4_frame, i18n_manager.get_ui_text("tabs.d4_functions"))
        self.d4_panel = D4PanelQt(self.d4_frame)
        lay3 = QVBoxLayout(self.d4_frame)
        lay3.addWidget(self.d4_panel)

        self.calibration_frame = QWidget()
        self.main_notebook.addTab(self.calibration_frame, i18n_manager.get_ui_text("tabs.coordinate_calibration"))
        self.coordinate_calibration_panel = CoordinateCalibrationPanelQt(self.calibration_frame)
        lay4 = QVBoxLayout(self.calibration_frame)
        lay4.addWidget(self.coordinate_calibration_panel)

        self.table3_frame = QWidget()
        self.main_notebook.addTab(self.table3_frame, i18n_manager.get_ui_text("tabs.log"))
        self.log_panel = LogPanelQt(self.table3_frame)
        lay5 = QVBoxLayout(self.table3_frame)
        lay5.addWidget(self.log_panel)

        self._panel_by_key = {
            PANEL_KEY_MAIN: self.main_functions_panel,
            PANEL_KEY_ROSBOT: self.rosbot_extension_panel,
            PANEL_KEY_D4: self.d4_panel,
            PANEL_KEY_CALIBRATION: self.coordinate_calibration_panel,
            PANEL_KEY_LOG: self.log_panel,
        }
        register_ui(self)
        self.rosbot_extension_panel.ensure_content()
        self.main_notebook.currentChanged.connect(self._on_tab_changed_qt)
        idx = max(0, min(self.last_selected_tab, TAB_COUNT - 1))
        self.main_notebook.setCurrentIndex(idx)
        self.last_selected_tab = idx
        self.bottom_bar.show_tab_content(idx)
        self.root.after(1, self._flush_after_first_build)
        self._reregister_log_callback()

    def _on_tab_changed_qt(self, index: int):
        self.root.after(0, lambda: self._deferred_after_tab_changed(index))

    def _deferred_after_tab_changed(self, selected_tab: int):
        self.last_selected_tab = selected_tab
        if not self._initialization_complete:
            set_config_value_async("ui_settings.last_selected_tab", selected_tab)
            self.bottom_bar.show_tab_content(selected_tab)
            self._reregister_log_callback()
            if selected_tab == TAB_INDEX_ROSBOT:
                self.rosbot_extension_panel.ensure_content()
            self._initialization_complete = True
            ColorPrint.blue(f"[UI] Tab changed to: {selected_tab} (init)")
            return
        set_config_value_async("ui_settings.last_selected_tab", selected_tab)
        self.bottom_bar.show_tab_content(selected_tab)
        self._reregister_log_callback()
        if selected_tab == TAB_INDEX_ROSBOT:
            self.rosbot_extension_panel.ensure_content()
        ColorPrint.blue(f"[UI] Tab changed to: {selected_tab}")

    def _load_last_tab(self):
        last_tab = CONFIG.get("ui_settings", {}).get("last_selected_tab", 0)
        if last_tab >= 1:
            last_tab = last_tab - 1
        last_tab = min(max(0, last_tab), TAB_COUNT - 1)
        if last_tab == TAB_INDEX_CALIBRATION:
            last_tab = TAB_INDEX_MAIN
        self.last_selected_tab = last_tab

    def _flush_after_first_build(self):
        if self.root.winfo_exists():
            self.root.update_idletasks()
            self.root.update()

    def get_window_status_callback(self):
        return self.bottom_bar.on_window_status_update

    def _create_system_tray(self):
        self.system_tray = SystemTray(self)
        self.system_tray.set_show_callback(self._tray_show_window)
        self.system_tray.set_exit_callback(self._tray_exit_application)
        self.root.after(500, self.start_system_tray_if_needed)

    def start_system_tray_if_needed(self):
        if self.system_tray.start():
            ColorPrint.green("[UI] System tray started successfully")
        else:
            ColorPrint.yellow("[UI] System tray failed to start")

    def _tray_show_window(self):
        trigger_window_show()
        ColorPrint.blue("[UI] Window show requested from tray")

    def _tray_exit_application(self):
        ColorPrint.blue("[UI] Exit requested from tray")
        trigger_app_exit()

    def _do_show_window(self):
        self.root.deiconify()
        ColorPrint.blue("[UI] Window shown from tray")

    def _on_window_close(self):
        self._save_window_geometry()
        ColorPrint.blue("[UI] Window close - sending shutdown request")
        trigger_app_exit()

    def _apply_taskbar_fix(self):
        if sys.platform == "win32":
            try:
                from pycore.pyutils.tk_taskbar import ensure_tk_root_in_taskbar
                if not self._taskbar_style_applied:
                    if ensure_tk_root_in_taskbar(self.root):
                        self._taskbar_style_applied = True
            except Exception:
                pass
        self.root.focus_force()
        self.root.after(10, lambda: self.root.focus_force() if self.root.winfo_exists() else None)

    def restore_window_to_preset(self):
        self.root.geometry(DEFAULT_WINDOW_GEOMETRY)
        self._is_maximized = False
        self.title_bar.maximize_btn.configure(text="□")

    def _save_window_geometry(self):
        if not self.root.winfo_exists() or self._is_maximized:
            return
        w = self.root.winfo_width()
        h = self.root.winfo_height()
        x = self.root.winfo_rootx()
        y = self.root.winfo_rooty()
        if w > 1 and h > 1:
            set_config_value_async("ui_settings.window_geometry", f"{w}x{h}+{x}+{y}")

    def _on_window_configure(self):
        if self._geometry_save_after_id:
            self.root.after_cancel(self._geometry_save_after_id)
        self._geometry_save_after_id = self.root.after(800, self._debounced_save_geometry)

    def _debounced_save_geometry(self):
        self._geometry_save_after_id = None
        self._save_window_geometry()

    def switch_to_tab(self, index: int):
        n = self.main_notebook.count()
        if n == 0:
            return
        idx = max(0, min(index, n - 1))
        self.main_notebook.blockSignals(True)
        self.main_notebook.setCurrentIndex(idx)
        self.main_notebook.blockSignals(False)
        self.last_selected_tab = idx
        self.bottom_bar.show_tab_content(idx)
        set_config_value_async("ui_settings.last_selected_tab", idx)
        self._reregister_log_callback()
        if idx == TAB_INDEX_ROSBOT:
            self.rosbot_extension_panel.ensure_content()
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()
        ColorPrint.blue(f"[UI] Switched to tab {idx}")

    def ensure_current_tab_content_if_needed(self):
        try:
            idx = self.main_notebook.currentIndex()
        except Exception:
            return
        if idx == TAB_INDEX_ROSBOT:
            self.rosbot_extension_panel.ensure_content()

    def _reregister_log_callback(self):
        ColorPrint.clear_all_callbacks()
        idx = self.main_notebook.currentIndex()
        if idx == TAB_INDEX_ROSBOT:
            ColorPrint.register_callback(self.rosbot_extension_panel.add_log_message)
        elif idx == TAB_INDEX_D4:
            ColorPrint.register_callback(self.d4_panel.add_log_message)
        elif idx == TAB_INDEX_LOG:
            ColorPrint.register_callback(self.log_panel.add_log_message)

    def _on_start_macro(self):
        if self.on_macro_start:
            self.on_macro_start()
        self.macro_controls.set_running(True)
        ColorPrint.green("[UI] Macro started")

    def _on_stop_macro(self):
        if self.on_macro_stop:
            self.on_macro_stop()
        self.macro_controls.set_running(False)
        ColorPrint.yellow("[UI] Macro stopped")

    def _on_skill_config_switch(self, config_name: str):
        self.current_config = config_name
        self.bottom_bar.update_config_status(config_name)
        if self.on_skill_config_switch:
            self.on_skill_config_switch(config_name)
        ColorPrint.blue(f"[UI] Switched to skill configuration: {config_name}")

    def set_macro_start_callback(self, callback: Callable):
        self.on_macro_start = callback

    def set_macro_stop_callback(self, callback: Callable):
        self.on_macro_stop = callback

    def set_config_change_callback(self, callback: Callable):
        self.on_config_change = callback

    def set_skill_config_switch_callback(self, callback: Callable):
        self.on_skill_config_switch = callback

    def show_message(self, title: str, message: str, msg_type: str = "info"):
        if msg_type == "error":
            QMessageBox.critical(self.root, title, message)
        elif msg_type == "warning":
            QMessageBox.warning(self.root, title, message)
        else:
            QMessageBox.information(self.root, title, message)

    def get_skill_config(self, config_name: str):
        skill_configs = get_config_value_safe("macro_configs.skill_configs", {})
        if not isinstance(skill_configs, dict):
            return {}
        return skill_configs.get(config_name, {})

    def get_auxiliary_config(self):
        aux = get_config_value_safe("macro_configs.auxiliary_config", {})
        return dict(aux) if isinstance(aux, dict) else {}

    def run(self):
        if self._release_any_grab():
            ColorPrint.yellow("[UI] Grab was held before mainloop; released.")
        self.root.mainloop()

    def _release_any_grab(self) -> bool:
        return False

    def destroy(self):
        if self._geometry_save_after_id and self.root.winfo_exists():
            self.root.after_cancel(self._geometry_save_after_id)
        self._geometry_save_after_id = None
        self._save_window_geometry()
        ColorPrint.blue("[UI] Starting UI destruction...")
        try:
            self.system_tray.stop()
            time.sleep(0.2)
        except Exception:
            pass
        ColorPrint.blue("[UI] System tray stopped")
        self.root.quit()
        for w in self.root.winfo_children():
            try:
                w.deleteLater()
            except Exception:
                pass
        self.root.destroy()
        ColorPrint.green("[UI] UI destruction completed")

    def _on_language_changed(self, new_language: str):
        if self._language_change_in_progress:
            return
        self._language_change_in_progress = True
        ColorPrint.green(f"[UI] Language changed to: {new_language}")
        self.root.title(i18n_manager.get_ui_text("main_window.title"))
        self.title_bar.update_title(i18n_manager.get_ui_text("main_window.title"))
        self.macro_controls.update_text()
        self.root.after(1000, self._reset_language_change_flag)

    def _reset_language_change_flag(self):
        self._language_change_in_progress = False
