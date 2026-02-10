#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diablo 3 Skill Macro UI Library
Main UI coordinator using modular components.
本模块为主窗口子组件（TitleBar、BottomBar、各 Panel 等）的单一创建者，每类仅在此处实例化一次。
"""

import tkinter as tk
from tkinter import ttk, messagebox
import sys
import os
import time
import ctypes
from typing import Optional, Callable
from pathlib import Path

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import CONFIG, set_config_value_async, CONFIG_USER_PATH, get_config_value_safe
from providor.constants.common import (
    ROOT_DIR,
    UI_SETTINGS_WINDOW_GEOMETRY,
    UI_SETTINGS_APP_ICON,
    DEFAULT_WINDOW_GEOMETRY,
    DEFAULT_APP_ICON_PATH,
    DEFAULT_APP_LOGO_PATH,
    DEFAULT_APP_ICON_PNG_PATH,
)

# Import UI components
from .components import TitleBar, MenuBar, BottomBar, MacroControls, SystemTray

# Import panels
from .panels.main_functions_panel import MainFunctionsPanel
from .panels.auxiliary_functions_panel import AuxiliaryFunctionsPanel
from .panels.log_panel import LogPanel
from .panels.rosbot_extension_panel import RosbotExtensionPanel
from .panels.d4_panel import D4Panel
from .panels.coordinate_calibration_panel import CoordinateCalibrationPanel

# Import theme
from .theme import UITheme
from ui.utils.config_binding import ConfigBinding

# Import i18n manager (global singleton instance)
from d3utils.i18n_manager import i18n_manager
from providor.constants.ui import (
    TAB_INDEX_MAIN,
    TAB_INDEX_AUXILIARY,
    TAB_INDEX_ROSBOT,
    TAB_INDEX_D4,
    TAB_INDEX_CALIBRATION,
    TAB_INDEX_LOG,
    TAB_COUNT,
)
from share.ui_registry import register_ui

# Lifecycle/event via runtime (THREAD_BUS -> main thread)
from runtime import register_main_thread_handlers, trigger_window_show, trigger_app_exit
from pycore.pyutils.tk_taskbar import ensure_tk_root_in_taskbar, set_windows_app_user_model_id
from pycore.pyutils.icon_utils import get_icon_path_for_windows
from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageDraw, get_third_package_PIL_ImageTk

_PIL_Image = get_third_package_PIL_Image()
_PIL_ImageDraw = get_third_package_PIL_ImageDraw()
_PIL_ImageTk = get_third_package_PIL_ImageTk()


class Diablo3MacroUI:
    """Diablo 3 Skill Macro UI Class - Refactored with Components"""
    
    def __init__(self, initial_config='config1'):
        """
        Initialize the main UI

        Args:
            initial_config: Initial configuration name
        """
        set_windows_app_user_model_id("pycore.d3check.1.0")
        self.root = tk.Tk()
        self._app_icon_photo = None
        self.resize_direction = None
        self._is_maximized = False
        self.system_tray = None
        self._initialization_complete = False  # Flag to avoid extra update() calls during tab selection init

        # Load language settings
        i18n_manager.load_language_from_config()

        # Language change control
        self._language_change_in_progress = False

        # Note: Language change listener is registered at controller level

        # Set window title and initial geometry (saved position/size or default) so window never flashes at 0,0
        self.root.title(i18n_manager.get_ui_text("main_window.title"))
        self._set_window_icon()
        initial_geos = CONFIG.get("ui_settings", {}).get(UI_SETTINGS_WINDOW_GEOMETRY) or DEFAULT_WINDOW_GEOMETRY
        self.root.geometry(initial_geos)
        self.root.minsize(670, 400)
        self.root.resizable(True, True)
        self.root.configure(bg=UITheme.get_color('bg_dark'))

        # Apply theme
        UITheme.apply_to_root(self.root)

        # Window geometry: debounced save on move/resize (id cleared after save)
        self._geometry_save_after_id = None
        self._had_saved_geometry = bool(CONFIG.get("ui_settings", {}).get(UI_SETTINGS_WINDOW_GEOMETRY))

        # Current configuration
        self.current_config = initial_config

        # Language: main UI rebuild is driven only by Controller (single chain); see DESIGN_ISSUES_MAJOR §1
        # Controller registers _on_language_changed and calls self.ui._on_language_changed(new_language)

        # Callbacks
        self.on_macro_start: Optional[Callable] = None
        self.on_macro_stop: Optional[Callable] = None
        self.on_config_change: Optional[Callable] = None
        self.on_skill_config_switch: Optional[Callable] = None

        # Create UI (register_ui(self) called in _create_main_tabs / _recreate_ui_for_language_change → share.ui_registry)
        # Create UI
        self._create_ui()
        # Taskbar: apply once at 350ms; do NOT run again at 800ms (second SetWindowLong/SetWindowPos makes window unresponsive)
        self._taskbar_fix_logged = False
        self._taskbar_style_applied = False  # ensure_tk_root_in_taskbar only once
        self.root.after(350, self._apply_taskbar_fix)
        def _on_map(_e):
            self.root.after(1, lambda: self.root.focus_force())
            self.root.after(0, _deferred_after_map)
        def _deferred_after_map():
            # Only claim focus on first map. Do NOT run ensure_tk_root_in_taskbar/SetForegroundWindow here:
            # Win32 SetWindowLong/SetWindowPos in Map path can leave window unresponsive (no input). Run once in _apply_taskbar_fix (350ms).
            self.root.focus_force()
            for ms in (50, 150, 300):
                self.root.after(ms, lambda m=ms: self.root.focus_force())
        self.root.bind("<Map>", _on_map)

        # First run only: bring window to top (geometry already set at init)
        self._apply_first_run_topmost()

        # Maximize/restore: state for frameless window (overrideredirect); event_center toggles via saved geometry
        self._is_maximized = False
        self._saved_geometry_restore = None

        # Bind Configure to save geometry when user moves/resizes (debounced)
        self.root.bind("<Configure>", self._on_window_configure)

        # Create system tray
        self._create_system_tray()

        # Event center: exit/restart/show/minimize/maximize dispatched to main thread via THREAD_BUS
        register_main_thread_handlers(self)

    def _add_resize_borders(self):
        """Add resize borders for frameless window"""
        # Create invisible frames for resize borders
        self.resize_frames = {}
        
        # Top border (scaled to 60% of original 3px)
        self.resize_frames['top'] = tk.Frame(self.root, height=2, bg=UITheme.get_color('bg_dark'))
        self.resize_frames['top'].pack(fill=tk.X, side=tk.TOP)
        self.resize_frames['top'].bind("<Button-1>", lambda e: self._start_resize('n'))
        self.resize_frames['top'].bind("<B1-Motion>", lambda e: self._on_resize('n', e))
        
        # Bottom border (scaled to 60% of original 3px)
        self.resize_frames['bottom'] = tk.Frame(self.root, height=2, bg=UITheme.get_color('bg_dark'))
        self.resize_frames['bottom'].pack(fill=tk.X, side=tk.BOTTOM)
        self.resize_frames['bottom'].bind("<Button-1>", lambda e: self._start_resize('s'))
        self.resize_frames['bottom'].bind("<B1-Motion>", lambda e: self._on_resize('s', e))
        
        # Left border (scaled to 60% of original 3px)
        self.resize_frames['left'] = tk.Frame(self.root, width=2, bg=UITheme.get_color('bg_dark'))
        self.resize_frames['left'].pack(fill=tk.Y, side=tk.LEFT)
        self.resize_frames['left'].bind("<Button-1>", lambda e: self._start_resize('w'))
        self.resize_frames['left'].bind("<B1-Motion>", lambda e: self._on_resize('w', e))
        
        # Right border (scaled to 60% of original 3px)
        self.resize_frames['right'] = tk.Frame(self.root, width=2, bg=UITheme.get_color('bg_dark'))
        self.resize_frames['right'].pack(fill=tk.Y, side=tk.RIGHT)
        self.resize_frames['right'].bind("<Button-1>", lambda e: self._start_resize('e'))
        self.resize_frames['right'].bind("<B1-Motion>", lambda e: self._on_resize('e', e))
        
        # Corner borders (scaled to 60% of original 3x3px)
        self.resize_frames['nw'] = tk.Frame(self.root, width=2, height=2, bg=UITheme.get_color('bg_dark'))
        self.resize_frames['nw'].place(x=0, y=0)
        self.resize_frames['nw'].bind("<Button-1>", lambda e: self._start_resize('nw'))
        self.resize_frames['nw'].bind("<B1-Motion>", lambda e: self._on_resize('nw', e))
        
        self.resize_frames['ne'] = tk.Frame(self.root, width=2, height=2, bg=UITheme.get_color('bg_dark'))
        self.resize_frames['ne'].place(relx=1.0, y=0, anchor='ne')
        self.resize_frames['ne'].bind("<Button-1>", lambda e: self._start_resize('ne'))
        self.resize_frames['ne'].bind("<B1-Motion>", lambda e: self._on_resize('ne', e))
        
        self.resize_frames['sw'] = tk.Frame(self.root, width=2, height=2, bg=UITheme.get_color('bg_dark'))
        self.resize_frames['sw'].place(x=0, rely=1.0, anchor='sw')
        self.resize_frames['sw'].bind("<Button-1>", lambda e: self._start_resize('sw'))
        self.resize_frames['sw'].bind("<B1-Motion>", lambda e: self._on_resize('sw', e))
        
        self.resize_frames['se'] = tk.Frame(self.root, width=2, height=2, bg=UITheme.get_color('bg_dark'))
        self.resize_frames['se'].place(relx=1.0, rely=1.0, anchor='se')
        self.resize_frames['se'].bind("<Button-1>", lambda e: self._start_resize('se'))
        self.resize_frames['se'].bind("<B1-Motion>", lambda e: self._on_resize('se', e))
        
        # Set cursor for resize areas
        self.resize_frames['top'].configure(cursor='sb_v_double_arrow')
        self.resize_frames['bottom'].configure(cursor='sb_v_double_arrow')
        self.resize_frames['left'].configure(cursor='sb_h_double_arrow')
        self.resize_frames['right'].configure(cursor='sb_h_double_arrow')
        self.resize_frames['nw'].configure(cursor='bottom_right_corner')
        self.resize_frames['se'].configure(cursor='bottom_right_corner')
        self.resize_frames['ne'].configure(cursor='top_right_corner')
        self.resize_frames['sw'].configure(cursor='top_right_corner')

    def _start_resize(self, direction):
        """Start resizing window"""
        self.resize_direction = direction
        self.resize_start_x = self.root.winfo_pointerx()
        self.resize_start_y = self.root.winfo_pointery()
        self.resize_start_width = self.root.winfo_width()
        self.resize_start_height = self.root.winfo_height()
        self.resize_start_x_root = self.root.winfo_rootx()
        self.resize_start_y_root = self.root.winfo_rooty()

    def _on_resize(self, direction, event):
        """Handle window resizing"""
        if self.resize_direction is None:
            return
            
        current_x = self.root.winfo_pointerx()
        current_y = self.root.winfo_pointery()
        
        delta_x = current_x - self.resize_start_x
        delta_y = current_y - self.resize_start_y
        
        new_width = self.resize_start_width
        new_height = self.resize_start_height
        new_x = self.resize_start_x_root
        new_y = self.resize_start_y_root
        
        if 'e' in direction:
            new_width = max(420, self.resize_start_width + delta_x)
        if 'w' in direction:
            new_width = max(420, self.resize_start_width - delta_x)
            new_x = self.resize_start_x_root + delta_x
        if 's' in direction:
            new_height = max(400, self.resize_start_height + delta_y)
        if 'n' in direction:
            new_height = max(400, self.resize_start_height - delta_y)
            new_y = self.resize_start_y_root + delta_y
        
        # Apply new geometry
        self.root.geometry(f"{new_width}x{new_height}+{new_x}+{new_y}")

    def _create_ui(self):
        """Create the main UI using components"""
        # Add resize borders first (content needed before frameless)
        self._add_resize_borders()
        
        # Title bar with language switch and window controls (no outer margin)
        self.title_bar = TitleBar(self)
        self.title_bar.pack(fill=tk.X, padx=0, pady=0)

        # Menu bar (hidden since language switch is now in title bar)
        # self.menu_bar = MenuBar(self.root, on_language_change=self._on_language_changed)

        # Bottom bar (create early so it can be passed to panels)
        self.bottom_bar = BottomBar(self.root)

        # Main tabbed interface
        self._create_main_tabs()

        # Pack bottom bar (no outer margin)
        self.bottom_bar.pack(fill=tk.X, padx=0, pady=0)

        # Note: Bottom bar callback registration is handled by system_initializer
        # UI does not import timer system - decoupled architecture
        # Flow: system_initializer -> registers bottom_bar.on_window_status_update to window_monitor

        # Macro controls (inside bottom bar)
        self.macro_controls = MacroControls(
            self.bottom_bar.frame,
            on_start=self._on_start_macro,
            on_stop=self._on_stop_macro
        )
        self.macro_controls.grid(row=0, column=0, sticky="w", padx=0, pady=0)

        # Remove OS title bar after window is fully configured (Tk/overrideredirect: call update_idletasks before setting flag or window can be disabled before it appears)
        self.root.update_idletasks()
        self.root.overrideredirect(True)

    def get_window_status_callback(self):
        """
        Get window status update callback for system_initializer to register

        This method allows system_initializer to register the callback without
        UI importing timer system - maintaining decoupled architecture.

        Returns:
            Callable: bottom_bar.on_window_status_update method
        """
        return self.bottom_bar.on_window_status_update

    def _create_system_tray(self):
        """Create system tray icon. Start deferred so Tk is ready (fixes tray not showing on Windows)."""
        self.system_tray = SystemTray(self)
        self.system_tray.set_show_callback(self._tray_show_window)
        self.system_tray.set_exit_callback(self._tray_exit_application)
        self.root.protocol("WM_DELETE_WINDOW", self._on_window_close)
        # Deferred start (backup): in case start_system_tray_if_needed() is not called before mainloop
        self.root.after(500, self.start_system_tray_if_needed)

    def start_system_tray_if_needed(self):
        """Start system tray if not already running. Call when UI is ready (e.g. before mainloop)."""
        if self.system_tray.start():
            ColorPrint.green("[UI] System tray started successfully")
        else:
            ColorPrint.yellow("[UI] System tray failed to start (pystray/PIL missing or icon create failed)")
    
    def _tray_show_window(self):
        """Show window from tray; dispatched to main thread via event center."""
        trigger_window_show()
        ColorPrint.blue("[UI] Window show requested from tray")
    
    def _do_show_window(self):
        """Actually show window"""
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()
        ColorPrint.blue("[UI] Window shown from tray")

    def _tray_exit_application(self):
        """Exit application from tray; dispatched to main thread via event center."""
        ColorPrint.blue("[UI] Exit requested from tray - sending shutdown request")
        trigger_app_exit()

    def _on_window_close(self):
        """Handle window close event; dispatched to main thread via event center."""
        self._save_window_geometry()
        ColorPrint.blue("[UI] Window close button clicked - sending shutdown request")
        trigger_app_exit()

    def _set_window_icon(self):
        """Set window/taskbar icon: config app_icon path, else default .ico / logo.png / app_icon.png (Windows may auto-generate .ico from logo), else generated (same as tray)."""
        path_cfg = (CONFIG.get("ui_settings") or {}).get(UI_SETTINGS_APP_ICON) or ""
        if path_cfg:
            p = Path(path_cfg)
            path = (Path(ROOT_DIR) / path_cfg).resolve() if not p.is_absolute() else p.resolve()
        else:
            path = None
        if not path or not path.exists():
            path = DEFAULT_APP_ICON_PATH if DEFAULT_APP_ICON_PATH.exists() else None
        if not path and DEFAULT_APP_LOGO_PATH.exists():
            path = DEFAULT_APP_LOGO_PATH
        if not path and DEFAULT_APP_ICON_PNG_PATH.exists():
            path = DEFAULT_APP_ICON_PNG_PATH
        if path and path.exists() and self.root.winfo_exists():
            if sys.platform == "win32":
                use_path = get_icon_path_for_windows(path)
                if str(use_path).lower().endswith(".ico"):
                    self.root.iconbitmap(str(use_path))
                    return
                path = use_path
            if _PIL_Image and _PIL_ImageTk:
                img = _PIL_Image.open(path).convert("RGBA")
                self._app_icon_photo = _PIL_ImageTk.PhotoImage(img)
                self.root.iconphoto(True, self._app_icon_photo)
                return
        if _PIL_Image and _PIL_ImageDraw and _PIL_ImageTk and self.root.winfo_exists():
            w, h = 64, 64
            image = _PIL_Image.new("RGBA", (w, h), (0, 0, 0, 0))
            draw = _PIL_ImageDraw.Draw(image)
            draw.ellipse([8, 8, w - 8, h - 8], fill=(200, 0, 0, 255), outline=(255, 255, 255, 255), width=2)
            draw.rectangle([20, 20, 24, 44], fill=(255, 255, 255, 255))
            draw.rectangle([20, 20, 32, 24], fill=(255, 255, 255, 255))
            draw.rectangle([20, 40, 32, 44], fill=(255, 255, 255, 255))
            draw.rectangle([30, 24, 32, 40], fill=(255, 255, 255, 255))
            draw.rectangle([36, 20, 40, 44], fill=(255, 255, 255, 255))
            draw.rectangle([36, 20, 44, 24], fill=(255, 255, 255, 255))
            draw.rectangle([36, 32, 44, 36], fill=(255, 255, 255, 255))
            draw.rectangle([36, 40, 44, 44], fill=(255, 255, 255, 255))
            self._app_icon_photo = _PIL_ImageTk.PhotoImage(image)
            self.root.iconphoto(True, self._app_icon_photo)

    def _apply_taskbar_fix(self):
        """Apply Windows taskbar visibility once (SetWindowLong/SetWindowPos). Ensure focus sync before/after Win32 calls."""
        if not self._taskbar_style_applied:
            # Sync Tk state before Win32 API calls to avoid timing issues
            self.root.update_idletasks()
            if ensure_tk_root_in_taskbar(self.root):
                self._taskbar_style_applied = True
                if not self._taskbar_fix_logged:
                    self._taskbar_fix_logged = True
                    ColorPrint.blue("[UI] Main window set to show in taskbar")
            # Sync Tk state after Win32 API calls, then immediately restore focus
            self.root.update_idletasks()
        if sys.platform == "win32":
            self._set_window_icon()
        # Restore focus immediately after all operations (Win32 SetWindowPos may have affected focus)
        self.root.focus_force()

    def _win32_set_foreground(self):
        """Set this window as foreground on Windows (user32) so it receives input. Overrideredirect windows may not get focus from WM."""
        if sys.platform != "win32":
            return
        self.root.update_idletasks()
        hwnd = self.root.winfo_id()
        if hwnd:
            ctypes.windll.user32.SetForegroundWindow(ctypes.c_void_p(hwnd))

    def _apply_first_run_topmost(self):
        """On every startup: lift and briefly topmost once (geometry already set at init to avoid 0,0 flash). Restore focus after topmost attr change."""
        self.root.lift()
        self.root.attributes("-topmost", True)
        self.root.after(500, lambda: (
            self.root.attributes("-topmost", False),
            self.root.focus_force()  # Immediately restore focus after -topmost change to prevent input loss
        ))

    def restore_window_to_preset(self):
        """Restore window to initial preset size (DEFAULT_WINDOW_GEOMETRY); clear maximized state and sync title bar."""
        self.root.geometry(DEFAULT_WINDOW_GEOMETRY)
        self._is_maximized = False
        self.title_bar.maximize_btn.configure(text="□")

    def _save_window_geometry(self):
        """Persist current window position and size to config (skip when maximized to avoid saving fullscreen). Call only when root exists."""
        if not self.root.winfo_exists() or self._is_maximized:
            return
        w = self.root.winfo_width()
        h = self.root.winfo_height()
        x = self.root.winfo_rootx()
        y = self.root.winfo_rooty()
        if w > 1 and h > 1:
            geos = f"{w}x{h}+{x}+{y}"
            set_config_value_async("ui_settings.window_geometry", geos)

    def _on_window_configure(self, event=None):
        """Debounce geometry save on move/resize (Configure fires for root and children)."""
        if event is not None and event.widget != self.root:
            return
        if self._geometry_save_after_id:
            self.root.after_cancel(self._geometry_save_after_id)
        self._geometry_save_after_id = self.root.after(800, self._debounced_save_geometry)

    def _debounced_save_geometry(self):
        """Run after idle: save geometry and clear after id."""
        self._geometry_save_after_id = None
        self._save_window_geometry()

    def _create_main_tabs(self):
        """Create main tabbed interface"""
        # Create notebook for main tabs (takeFocus=0 to avoid dotted focus ring on selected tab)
        self.main_notebook = ttk.Notebook(self.root, height=370)
        self.main_notebook.configure(takefocus=0)
        self.main_notebook.pack(fill=tk.X, padx=0, pady=0)
        self.main_notebook.enable_traversal()
        
        # Apply dark theme to notebook
        self._apply_notebook_theme()

        # Load last selected tab
        self._load_last_tab()

        # Config change hub: controller subscribes in run() and defers sync to timer thread to avoid main-thread block

        # Create tab frames (all UI built at startup)
        self._create_table1_tab()
        self._create_table2_tab()
        self._create_rosbot_tab()
        self._create_d4_tab()
        self._create_coordinate_calibration_tab()
        self._create_table3_tab()

        register_ui(self)
        self.rosbot_extension_panel.ensure_content()

        ColorPrint.green("[UI] Notebook style updated")
        ConfigBinding.log_registration_summary()
        
        # Bind tab change event
        self.main_notebook.bind('<<NotebookTabChanged>>', self._on_tab_changed)

        tab_ids = self.main_notebook.tabs()
        n = len(tab_ids)
        for tid in tab_ids:
            self.main_notebook.tab(tid, state="normal")
        idx = max(0, min(self.last_selected_tab, n - 1)) if n else TAB_INDEX_MAIN
        self.last_selected_tab = idx
        if n > 0:
            self.main_notebook.select(tab_ids[idx])
        self.bottom_bar.show_tab_content(idx)
        self.root.update_idletasks()
        self.root.update()

        # Only the current tab's panel receives ColorPrint (D3/ROSBOT -> ROSBOT tab log, D4 -> D4 tab log)
        self._reregister_log_callback()

        # Mark initialization complete so _deferred_after_tab_changed can apply updates() normally after this
        self._initialization_complete = True
    
    def _apply_notebook_theme(self):
        """Apply dark theme to notebook with multiple methods"""
        style = ttk.Style()

        # CRITICAL: Must avoid Windows native themes (vista/xpnative) which ignore custom colors
        # Use 'clam' theme - it's fully customizable and cross-platform
        current_theme = style.theme_use()
        ColorPrint.blue(f"[UI] Current theme: {current_theme}, available: {style.theme_names()}")

        # Force use clam theme to enable custom colors
        if current_theme in ('vista', 'xpnative', 'winnative'):
            ColorPrint.yellow(f"[UI] Switching from native theme '{current_theme}' to 'clam' for custom styling")
        style.theme_use('clam')

        # Tab layout: no Notebook.focus wrapper. Clam default adds focus for selected only -> shrinks selected height.
        self._apply_tab_layout(style)

        # tabmargins [L,T,R,B]: bottom=0 so no gap under tab bar (avoids white line).
        style.configure('Dark.TNotebook',
                       background=UITheme.get_color('bg_primary'),
                       borderwidth=0,
                       tabmargins=[1, 3, 1, 0])

        # Configure frame style for tab content
        style.configure('Dark.TFrame',
                       background=UITheme.get_color('bg_primary'),
                       borderwidth=0)

        # Tab style: padding [L,T,R,B] equal top/bottom; focusthickness=0 / shiftrelief=0 / relief=flat
        style.configure('Dark.TNotebook.Tab',
                       background=UITheme.get_color('tab_unselected_bg'),
                       foreground=UITheme.get_color('tab_unselected_fg'),
                       padding=[12, 8, 12, 8],
                       borderwidth=0,
                       lightcolor=UITheme.get_color('tab_unselected_bg'),
                       darkcolor=UITheme.get_color('tab_unselected_bg'),
                       bordercolor=UITheme.get_color('tab_unselected_bg'),
                       focusthickness=0,
                       focuscolor=UITheme.get_color('tab_unselected_bg'),
                       shiftrelief=0,
                       relief='flat')

        # map(): same padding for selected/!selected (no extra wrap); selected expand [0,0,0,2] so height matches unselected.
        style.map('Dark.TNotebook.Tab',
                 background=[('selected', UITheme.get_color('tab_selected_bg')),
                           ('active', UITheme.get_color('state_hover')),
                           ('!selected', UITheme.get_color('tab_unselected_bg'))],
                 foreground=[('selected', UITheme.get_color('tab_selected_fg')),
                           ('active', UITheme.get_color('text_primary')),
                           ('!selected', UITheme.get_color('tab_unselected_fg'))],
                 lightcolor=[('selected', UITheme.get_color('tab_selected_bg')),
                           ('!selected', UITheme.get_color('tab_unselected_bg'))],
                 darkcolor=[('selected', UITheme.get_color('tab_selected_bg')),
                          ('!selected', UITheme.get_color('tab_unselected_bg'))],
                 bordercolor=[('selected', UITheme.get_color('tab_selected_bg')),
                             ('!selected', UITheme.get_color('tab_unselected_bg'))],
                 padding=[('selected', [12, 8, 12, 8]), ('!selected', [12, 8, 12, 8])],
                 expand=[('selected', [0, 0, 0, 2]), ('!selected', [0, 0, 0, 0])])
        
        # Apply style to notebook
        self.main_notebook.configure(style='Dark.TNotebook')

        # Force style update after a short delay to ensure it takes effect
        self.root.after(100, self._force_style_update)

    def _apply_tab_layout(self, style):
        """Apply Tab layout without Notebook.focus so selected and unselected have same structure (no extra wrapper)."""
        style.layout(
            'Dark.TNotebook.Tab',
            [
                (
                    'Notebook.tab',
                    {
                        'sticky': 'nswe',
                        'children': [
                            (
                                'Notebook.padding',
                                {
                                    'side': 'top',
                                    'sticky': 'nswe',
                                    'children': [
                                        ('Notebook.label', {'side': 'top', 'sticky': ''}),
                                    ],
                                },
                            ),
                        ],
                    },
                ),
            ],
        )

    def _force_style_update(self):
        """Force style update: re-apply Tab layout (no focus wrapper) and same padding/expand for selected and !selected."""
        style = ttk.Style()
        self._apply_tab_layout(style)
        style.configure('Dark.TNotebook', tabmargins=[1, 3, 1, 0])
        style.configure('Dark.TNotebook.Tab',
                       background=UITheme.get_color('tab_unselected_bg'),
                       foreground=UITheme.get_color('tab_unselected_fg'),
                       padding=[12, 8, 12, 8],
                       borderwidth=0,
                       lightcolor=UITheme.get_color('tab_unselected_bg'),
                       darkcolor=UITheme.get_color('tab_unselected_bg'),
                       bordercolor=UITheme.get_color('tab_unselected_bg'),
                       focusthickness=0,
                       focuscolor=UITheme.get_color('tab_unselected_bg'),
                       shiftrelief=0,
                       relief='flat')
        style.map('Dark.TNotebook.Tab',
                 background=[('selected', UITheme.get_color('tab_selected_bg')),
                           ('active', UITheme.get_color('state_hover')),
                           ('!selected', UITheme.get_color('tab_unselected_bg'))],
                 foreground=[('selected', UITheme.get_color('tab_selected_fg')),
                           ('active', UITheme.get_color('text_primary')),
                           ('!selected', UITheme.get_color('tab_unselected_fg'))],
                 lightcolor=[('selected', UITheme.get_color('tab_selected_bg')),
                           ('!selected', UITheme.get_color('tab_unselected_bg'))],
                 darkcolor=[('selected', UITheme.get_color('tab_selected_bg')),
                          ('!selected', UITheme.get_color('tab_unselected_bg'))],
                 bordercolor=[('selected', UITheme.get_color('tab_selected_bg')),
                             ('!selected', UITheme.get_color('tab_unselected_bg'))],
                 padding=[('selected', [12, 8, 12, 8]), ('!selected', [12, 8, 12, 8])],
                 expand=[('selected', [0, 0, 0, 2]), ('!selected', [0, 0, 0, 0])])
        self.main_notebook.update_idletasks()

    def _apply_all_tab_styles(self):
        """Apply styles to all tabs (same line height and underline)"""
        style = ttk.Style()
        self._apply_tab_layout(style)
        style.configure('Dark.TNotebook', tabmargins=[1, 3, 1, 0])
        for style_name in ['Dark.TNotebook.Tab', 'TNotebook.Tab', 'Tab']:
            style.configure(style_name,
                           background=UITheme.get_color('tab_unselected_bg'),
                           foreground=UITheme.get_color('tab_unselected_fg'),
                           padding=[12, 8, 12, 8],
                           borderwidth=0,
                           lightcolor=UITheme.get_color('tab_unselected_bg'),
                           darkcolor=UITheme.get_color('tab_unselected_bg'),
                           bordercolor=UITheme.get_color('tab_unselected_bg'),
                           focusthickness=0,
                           focuscolor=UITheme.get_color('tab_unselected_bg'),
                           shiftrelief=0,
                           relief='flat')
        style.map('Dark.TNotebook.Tab',
                 background=[('selected', UITheme.get_color('tab_selected_bg')),
                           ('active', UITheme.get_color('state_hover')),
                           ('!selected', UITheme.get_color('tab_unselected_bg'))],
                 foreground=[('selected', UITheme.get_color('tab_selected_fg')),
                           ('active', UITheme.get_color('text_primary')),
                           ('!selected', UITheme.get_color('tab_unselected_fg'))],
                 lightcolor=[('selected', UITheme.get_color('tab_selected_bg')),
                           ('!selected', UITheme.get_color('tab_unselected_bg'))],
                 darkcolor=[('selected', UITheme.get_color('tab_selected_bg')),
                          ('!selected', UITheme.get_color('tab_unselected_bg'))],
                 bordercolor=[('selected', UITheme.get_color('tab_selected_bg')),
                             ('!selected', UITheme.get_color('tab_unselected_bg'))],
                 padding=[('selected', [12, 8, 12, 8]), ('!selected', [12, 8, 12, 8])],
                 expand=[('selected', [0, 0, 0, 2]), ('!selected', [0, 0, 0, 0])])
        self.main_notebook.update_idletasks()
        self.main_notebook.update()

    def _apply_tab_style(self, tab_id):
        """Apply style to a specific tab (same line height and underline)"""
        style = ttk.Style()
        self._apply_tab_layout(style)
        style.configure('Dark.TNotebook', tabmargins=[1, 3, 1, 0])
        for style_name in ['Dark.TNotebook.Tab', 'TNotebook.Tab', 'Tab']:
            style.configure(style_name,
                           background=UITheme.get_color('tab_unselected_bg'),
                           foreground=UITheme.get_color('tab_unselected_fg'),
                           padding=[12, 8, 12, 8],
                           borderwidth=0,
                           lightcolor=UITheme.get_color('tab_unselected_bg'),
                           darkcolor=UITheme.get_color('tab_unselected_bg'),
                           bordercolor=UITheme.get_color('tab_unselected_bg'),
                           focusthickness=0,
                           focuscolor=UITheme.get_color('tab_unselected_bg'),
                           shiftrelief=0,
                           relief='flat')
            style.map(style_name,
                     background=[('selected', UITheme.get_color('tab_selected_bg')),
                               ('active', UITheme.get_color('state_hover')),
                               ('!selected', UITheme.get_color('tab_unselected_bg'))],
                     foreground=[('selected', UITheme.get_color('tab_selected_fg')),
                               ('active', UITheme.get_color('text_primary')),
                               ('!selected', UITheme.get_color('tab_unselected_fg'))],
                     lightcolor=[('selected', UITheme.get_color('tab_selected_bg')),
                               ('!selected', UITheme.get_color('tab_unselected_bg'))],
                     darkcolor=[('selected', UITheme.get_color('tab_selected_bg')),
                              ('!selected', UITheme.get_color('tab_unselected_bg'))],
                     bordercolor=[('selected', UITheme.get_color('tab_selected_bg')),
                                 ('!selected', UITheme.get_color('tab_unselected_bg'))],
                     padding=[('selected', [12, 8, 12, 8]), ('!selected', [12, 8, 12, 8])],
                     expand=[('selected', [0, 0, 0, 2]), ('!selected', [0, 0, 0, 0])])
        self.main_notebook.update_idletasks()
        self.main_notebook.update()

    def _create_table1_tab(self):
        """Create TABLE1 - Main functions tab"""
        self.table1_frame = ttk.Frame(self.main_notebook)
        # Set theme background color for the frame
        self.table1_frame.configure(style='Dark.TFrame')
        tab_id = self.main_notebook.add(
            self.table1_frame,
            text=i18n_manager.get_ui_text("tabs.main_functions")
        )
        # Force apply style to this tab
        self._apply_tab_style(tab_id)
        
        # Create main functions panel
        self.main_functions_panel = MainFunctionsPanel(
            self.table1_frame,
            self.current_config,
            self.bottom_bar  # Pass bottom bar for config display
        )
        
        self.main_functions_panel.set_skill_config_switch_callback(self._on_skill_config_switch)

    def _create_table2_tab(self):
        """Create TABLE2 - Auxiliary functions tab"""
        self.table2_frame = ttk.Frame(self.main_notebook)
        # Set theme background color for the frame
        self.table2_frame.configure(style='Dark.TFrame')
        tab_id = self.main_notebook.add(
            self.table2_frame,
            text=i18n_manager.get_ui_text("tabs.auxiliary_functions")
        )
        # Force apply style to this tab
        self._apply_tab_style(tab_id)
        
        # Create auxiliary functions panel
        self.auxiliary_functions_panel = AuxiliaryFunctionsPanel(self.table2_frame)

    def _create_rosbot_tab(self):
        """Create ROSBOT Extension tab"""
        self.rosbot_frame = ttk.Frame(self.main_notebook)
        # Set theme background color for the frame
        self.rosbot_frame.configure(style='Dark.TFrame')
        tab_id = self.main_notebook.add(
            self.rosbot_frame,
            text=i18n_manager.get_ui_text("tabs.rosbot_extension")
        )
        # Force apply style to this tab
        self._apply_tab_style(tab_id)

        # Create ROSBOT extension panel (status merged into bottom bar Game Status row)
        self.rosbot_extension_panel = RosbotExtensionPanel(self.rosbot_frame, bottom_bar=self.bottom_bar)

    def _create_d4_tab(self):
        """Create D4 Functions tab"""
        self.d4_frame = ttk.Frame(self.main_notebook)
        # Set theme background color for the frame
        self.d4_frame.configure(style='Dark.TFrame')
        tab_id = self.main_notebook.add(
            self.d4_frame,
            text=i18n_manager.get_ui_text("tabs.d4_functions")
        )
        # Force apply style to this tab
        self._apply_tab_style(tab_id)

        # Create D4 panel
        self.d4_panel = D4Panel(self.d4_frame)

    def _create_coordinate_calibration_tab(self):
        """Create Coordinate Calibration tab"""
        self.calibration_frame = ttk.Frame(self.main_notebook)
        # Set theme background color for the frame
        self.calibration_frame.configure(style='Dark.TFrame')
        tab_id = self.main_notebook.add(
            self.calibration_frame,
            text=i18n_manager.get_ui_text("tabs.coordinate_calibration")
        )
        # Force apply style to this tab
        self._apply_tab_style(tab_id)

        # Create coordinate calibration panel
        self.coordinate_calibration_panel = CoordinateCalibrationPanel(self.calibration_frame)

    def _create_table3_tab(self):
        """Create TABLE3 - Test and logs tab"""
        self.table3_frame = ttk.Frame(self.main_notebook)
        # Set theme background color for the frame
        self.table3_frame.configure(style='Dark.TFrame')
        tab_id = self.main_notebook.add(
            self.table3_frame,
            text=i18n_manager.get_ui_text("tabs.log")
        )
        # Force apply style to this tab
        self._apply_tab_style(tab_id)
        
        # Create log panel
        self.log_panel = LogPanel(self.table3_frame)

    def _on_language_changed(self, new_language: str):
        """Handle language change event - unified UI rebuild with deduplication"""
        if self._language_change_in_progress:
            ColorPrint.blue(f"[UI] Language change to {new_language} already in progress, skipping")
            return

        self._language_change_in_progress = True
        ColorPrint.green(f"[UI] Language changed to: {new_language}")

        self.root.title(i18n_manager.get_ui_text("main_window.title"))
        self.title_bar.update_title(i18n_manager.get_ui_text("main_window.title"))
        self.macro_controls.update_text()
        self._recreate_ui_for_language_change()

        ColorPrint.green(f"[UI] UI updated for language: {new_language}")
        self.root.after(1000, self._reset_language_change_flag)

    def _reset_language_change_flag(self):
        """Reset language change flag"""
        self._language_change_in_progress = False
        ColorPrint.blue("[UI] Language change flag reset")

    def _recreate_ui(self):
        """Recreate UI with current language"""
        for widget in self.main_notebook.winfo_children():
            widget.destroy()

        self._create_table1_tab()
        self._create_table2_tab()
        self._create_rosbot_tab()
        self._create_d4_tab()
        self._create_coordinate_calibration_tab()
        self._create_table3_tab()

        register_ui(self)
        self.rosbot_extension_panel.ensure_content()

        self.macro_controls.grid(row=0, column=0, sticky="w", padx=0, pady=0)
        self._register_panel_language_listeners()

    def _recreate_ui_for_language_change(self):
        """Recreate UI specifically for language change - no panel listeners"""
        for widget in self.main_notebook.winfo_children():
            widget.destroy()

        self._create_table1_tab()
        self._create_table2_tab()
        self._create_rosbot_tab()
        self._create_d4_tab()
        self._create_coordinate_calibration_tab()
        self._create_table3_tab()

        register_ui(self)
        self.rosbot_extension_panel.ensure_content()

        self.macro_controls.grid(row=0, column=0, sticky="w", padx=0, pady=0)

        if self.main_notebook.winfo_exists():
            tab_ids = self.main_notebook.tabs()
            n = len(tab_ids)
            if n > 0:
                idx = max(0, min(self.last_selected_tab, n - 1))
                self.main_notebook.select(tab_ids[idx])
                self.last_selected_tab = idx
                self.bottom_bar.show_tab_content(idx)
            self._reregister_log_callback()
            self.root.update_idletasks()
            self.root.update()

    def _reregister_log_callback(self):
        """Register only the current tab's panel as ColorPrint callback."""
        t0 = time.time()
        ColorPrint.clear_all_callbacks()
        ColorPrint.gray(f"[UI-DBG] _reregister_log_callback after clear t={time.time()-t0:.3f}")
        if not self.main_notebook.winfo_exists():
            idx = TAB_INDEX_MAIN
        else:
            sel = self.main_notebook.select()
            idx = self.main_notebook.index(sel)
        if idx == TAB_INDEX_ROSBOT:
            ColorPrint.register_callback(self.rosbot_extension_panel.add_log_message)
        elif idx == TAB_INDEX_D4:
            ColorPrint.register_callback(self.d4_panel.add_log_message)
        elif idx == TAB_INDEX_LOG:
            ColorPrint.register_callback(self.log_panel.add_log_message)
        ColorPrint.gray(f"[UI-DBG] _reregister_log_callback EXIT idx={idx} t={time.time()-t0:.3f}")

    def _register_panel_language_listeners(self):
        """Register language change listeners. Panels with _on_language_changed listed explicitly (code-level)."""
        panels_with_language_listener = []
        for panel in panels_with_language_listener:
            i18n_manager.add_language_change_listener(panel._on_language_changed)
            ColorPrint.blue(f"[UI] Registered language listener for: {panel.__class__.__name__}")

    def _load_last_tab(self):
        """Load last selected tab from configuration. Never restore to coordinate calibration (tab 4) on startup to avoid full UI freeze."""
        last_tab = CONFIG.get('ui_settings', {}).get('last_selected_tab', 0)
        if last_tab == TAB_INDEX_CALIBRATION:
            last_tab = TAB_INDEX_MAIN
        self.last_selected_tab = last_tab

    def switch_to_tab(self, index: int) -> None:
        """Single entry: switch to tab by index (0-based). Used by tray Debug menu. Unbinds tab event during switch to avoid duplicate save/block, then forces redraw."""
        nb = self.main_notebook
        tab_ids = nb.tabs()
        n = len(tab_ids)
        if n == 0:
            return
        idx = max(0, min(index, n - 1))
        nb.unbind("<<NotebookTabChanged>>")
        nb.select(tab_ids[idx])
        self.last_selected_tab = idx
        self.bottom_bar.show_tab_content(idx)
        set_config_value_async("ui_settings.last_selected_tab", idx)
        self._reregister_log_callback()
        if idx == TAB_INDEX_ROSBOT:
            self.rosbot_extension_panel.ensure_content()
        nb.bind("<<NotebookTabChanged>>", self._on_tab_changed)
        self.root.deiconify()
        self.root.lift()
        self.root.focus_force()
        nb.focus_set()
        self.root.update_idletasks()
        self.root.update()
        ColorPrint.blue(f"[UI] Switched to tab {idx}")

    def _on_tab_changed(self, event=None):
        """Handle tab change event. Defer work to next idle so binding returns immediately and UI stays responsive."""
        self.root.after(0, self._deferred_after_tab_changed)

    def _deferred_after_tab_changed(self):
        """Run after tab change: update state, bottom bar, config, log callback, then force redraw so tab content is drawn (same as switch_to_tab from tray). Skip update() if during initialization."""
        if not self.main_notebook.winfo_exists():
            return
        selected_tab = self.main_notebook.index(self.main_notebook.select())
        self.last_selected_tab = selected_tab
        set_config_value_async("ui_settings.last_selected_tab", selected_tab)
        self.bottom_bar.show_tab_content(selected_tab)
        self._reregister_log_callback()
        if selected_tab == TAB_INDEX_ROSBOT:
            self.rosbot_extension_panel.ensure_content()
        # Only call update() after initialization is complete (skip during init to avoid double redraw)
        if self._initialization_complete:
            self.root.update_idletasks()
            self.root.update()
        ColorPrint.blue(f"[UI] Tab changed to: {selected_tab}")
    
    def _on_start_macro(self):
        """Handle start macro button click"""
        if self.on_macro_start:
            self.on_macro_start()
        ColorPrint.green("[UI] Macro started")
    
    def _on_stop_macro(self):
        """Handle stop macro button click"""
        if self.on_macro_stop:
            self.on_macro_stop()
        ColorPrint.yellow("[UI] Macro stopped")

    def _on_config_change(self):
        """Handle configuration change"""
        if self.on_config_change:
            self.on_config_change()
        ColorPrint.blue("[UI] Configuration changed")

    def _on_skill_config_switch(self, config_name: str):
        """Handle skill configuration switch"""
        self.current_config = config_name
        self.bottom_bar.update_config_status(config_name)

        if self.on_skill_config_switch:
            self.on_skill_config_switch(config_name)

        ColorPrint.blue(f"[UI] Switched to skill configuration: {config_name}")


    # Public API methods for external control

    def set_bag_correction_image(self, image_input, display_size=(200, 150)):
        """Set bag correction image with flexible input support"""
        return self.auxiliary_functions_panel.set_bag_correction_image(image_input, display_size)

    def get_bag_correction_image(self):
        """Get current bag correction image"""
        return self.auxiliary_functions_panel.get_bag_correction_image()

    def capture_bag_correction_image(self, screenshot_callback=None):
        """Capture bag correction image from game"""
        return self.auxiliary_functions_panel.capture_bag_correction_image(screenshot_callback)

    def generate_bag_correction_image(self):
        """Generate bag correction image using GameAssistantController"""
        return self.auxiliary_functions_panel._generate_bag_correction_image()

    # Callback setters
    
    def set_macro_start_callback(self, callback: Callable):
        """Set callback for macro start"""
        self.on_macro_start = callback
    
    def set_macro_stop_callback(self, callback: Callable):
        """Set callback for macro stop"""
        self.on_macro_stop = callback
    
    def set_config_change_callback(self, callback: Callable):
        """Set callback for configuration change"""
        self.on_config_change = callback
    
    def set_skill_config_switch_callback(self, callback: Callable):
        """Set callback for skill configuration switch"""
        self.on_skill_config_switch = callback

    # Utility methods
    
    def show_message(self, title: str, message: str, msg_type: str = 'info'):
        """Show message box"""
        if msg_type == 'error':
            messagebox.showerror(title, message)
        elif msg_type == 'warning':
            messagebox.showwarning(title, message)
        else:
            messagebox.showinfo(title, message)
    
    def get_current_config(self):
        """Get current configuration"""
        return {
            'current_config': self.current_config,
            'last_selected_tab': self.last_selected_tab
        }

    def get_skill_config(self, config_name: str):
        """Get skill config dict for controller sync. Reads from CONFIG (thread-safe)."""
        skill_configs = get_config_value_safe("macro_configs.skill_configs", {})
        if not isinstance(skill_configs, dict):
            return {}
        return skill_configs.get(config_name, {})

    def get_auxiliary_config(self):
        """Get auxiliary config dict for controller sync. Reads from CONFIG (thread-safe)."""
        aux = get_config_value_safe("macro_configs.auxiliary_config", {})
        return dict(aux) if isinstance(aux, dict) else {}

    def run(self):
        """Run the UI. Release any stray grab; do not focus_force before mainloop (focus is applied in Map handler after(1) to avoid overrideredirect window losing input)."""
        self._release_any_grab()
        self.root.update_idletasks()
        self.root.mainloop()

    def _release_any_grab(self):
        """Release grab on any widget that holds it so main window and all controls receive events (Tk: grab subtree owns pointer until released)."""
        try:
            current = self.root.grab_current()
            if not current:
                return
            paths = current if isinstance(current, (list, tuple)) else [current]
            for path in paths:
                if not isinstance(path, str):
                    continue
                w = self.root.nametowidget(path)
                if w.winfo_exists():
                    w.grab_release()
        except (tk.TclError, KeyError):
            pass
    
    def destroy(self):
        """Destroy the UI completely - called by shutdown manager"""
        if self._geometry_save_after_id and self.root.winfo_exists():
            self.root.after_cancel(self._geometry_save_after_id)
        self._geometry_save_after_id = None
        self._save_window_geometry()
        ColorPrint.blue("[UI] Starting UI destruction...")

        ColorPrint.blue("[UI] Stopping system tray...")
        self.system_tray.stop()
        time.sleep(0.2)
        ColorPrint.blue("[UI] System tray stopped")

        self.root.quit()

        for widget in self.root.winfo_children():
            widget.destroy()

        self.root.destroy()
        ColorPrint.blue("[UI] Root window destroyed")
        ColorPrint.green("[UI] UI destruction completed")

# Example usage
if __name__ == "__main__":
    def on_macro_start():
        print("Macro started!")
    
    def on_macro_stop():
        print("Macro stopped!")
    
    def on_config_change():
        print("Configuration changed!")
    
    # Create and run UI
    ui = Diablo3MacroUI()
    ui.set_macro_start_callback(on_macro_start)
    ui.set_macro_stop_callback(on_macro_stop)
    ui.set_config_change_callback(on_config_change)
    
    ui.run()

