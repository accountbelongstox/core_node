#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Diablo 3 Skill Macro UI Library
Main UI coordinator using modular components
"""

import tkinter as tk
from tkinter import ttk, messagebox
import sys
import os
import time
from typing import Optional, Callable
from pathlib import Path

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from providor.providor_index import CONFIG, save_config, CONFIG_USER_PATH
from providor.constants.common import UI_SETTINGS_WINDOW_GEOMETRY, DEFAULT_WINDOW_GEOMETRY

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

# Import i18n manager (global singleton instance)
from d3utils.i18n_manager import i18n_manager

# Lifecycle/event via runtime (THREAD_BUS -> main thread)
from runtime import register_main_thread_handlers, trigger_window_show, trigger_app_exit

class Diablo3MacroUI:
    """Diablo 3 Skill Macro UI Class - Refactored with Components"""
    
    def __init__(self, initial_config='config1'):
        """
        Initialize the main UI

        Args:
            initial_config: Initial configuration name
        """
        self.root = tk.Tk()

        # Load language settings
        i18n_manager.load_language_from_config()

        # Language change control
        self._language_change_in_progress = False

        # Note: Language change listener is registered at controller level

        # Set window title and initial geometry (saved position/size or default) so window never flashes at 0,0
        self.root.title(i18n_manager.get_ui_text("main_window.title"))
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

        # Register language change listener
        i18n_manager.add_language_change_listener(self._on_language_changed)

        # Callbacks
        self.on_macro_start: Optional[Callable] = None
        self.on_macro_stop: Optional[Callable] = None
        self.on_config_change: Optional[Callable] = None
        self.on_skill_config_switch: Optional[Callable] = None

        # Store UI instance in ENCYCLOPEDIA for global access
        ENCYCLOPEDIA['ui'] = self
        ColorPrint.blue("[UI] UI instance stored in ENCYCLOPEDIA")

        # Create UI
        self._create_ui()

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
        if not hasattr(self, 'resize_direction'):
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
        # Remove OS title bar and make window frameless
        self.root.overrideredirect(True)
        
        # Add resize borders for frameless window
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
        if not getattr(self, "system_tray", None):
            return
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

    def _apply_first_run_topmost(self):
        """On every startup: lift and briefly topmost once (geometry already set at init to avoid 0,0 flash)."""
        self.root.lift()
        self.root.attributes("-topmost", True)
        self.root.after(500, lambda: self.root.attributes("-topmost", False))

    def restore_window_to_preset(self):
        """Restore window to initial preset size (DEFAULT_WINDOW_GEOMETRY); clear maximized state and sync title bar."""
        self.root.geometry(DEFAULT_WINDOW_GEOMETRY)
        self._is_maximized = False
        if hasattr(self, "title_bar") and hasattr(self.title_bar, "maximize_btn"):
            self.title_bar.maximize_btn.configure(text="□")

    def _save_window_geometry(self):
        """Persist current window position and size to config (skip when maximized to avoid saving fullscreen)."""
        try:
            if getattr(self, "_is_maximized", False):
                return
            w = self.root.winfo_width()
            h = self.root.winfo_height()
            x = self.root.winfo_rootx()
            y = self.root.winfo_rooty()
            if w > 1 and h > 1:
                geos = f"{w}x{h}+{x}+{y}"
                if "ui_settings" not in CONFIG:
                    CONFIG["ui_settings"] = {}
                CONFIG["ui_settings"][UI_SETTINGS_WINDOW_GEOMETRY] = geos
                save_config()
        except tk.TclError:
            pass

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
        
        # Apply dark theme to notebook
        self._apply_notebook_theme()

        # Load last selected tab
        self._load_last_tab()
        
        # Create tab frames
        self._create_table1_tab()  # Main functions
        self._create_table2_tab()  # Auxiliary functions
        self._create_rosbot_tab()  # ROSBOT extension
        self._create_d4_tab()  # D4 functions
        self._create_coordinate_calibration_tab()  # Coordinate calibration
        self._create_table3_tab()  # Test and logs
        
        # Bind tab change event
        self.main_notebook.bind('<<NotebookTabChanged>>', self._on_tab_changed)
        
        # Set initial tab
        self.main_notebook.select(self.last_selected_tab)
        self.bottom_bar.show_tab_content(self.last_selected_tab)

        # Only the current tab's panel receives ColorPrint (D3/ROSBOT -> ROSBOT tab log, D4 -> D4 tab log)
        self._reregister_log_callback()
    
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
        ColorPrint.green("[UI] Forced notebook style update")

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
        ColorPrint.green("[UI] Applied styles to all tabs")

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
        ColorPrint.green(f"[UI] Applied style to tab: {tab_id}")
    
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
        
        # Set callbacks
        if hasattr(self.main_functions_panel, 'set_config_change_callback'):
            self.main_functions_panel.set_config_change_callback(self._on_config_change)
        if hasattr(self.main_functions_panel, 'set_skill_config_switch_callback'):
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
        
        # Set callbacks
        if hasattr(self.auxiliary_functions_panel, 'set_config_change_callback'):
            self.auxiliary_functions_panel.set_config_change_callback(self._on_config_change)
    
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

        # Set callbacks
        if hasattr(self.rosbot_extension_panel, 'set_config_change_callback'):
            self.rosbot_extension_panel.set_config_change_callback(self._on_config_change)

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

        # Set callbacks
        if hasattr(self.d4_panel, 'set_config_change_callback'):
            self.d4_panel.set_config_change_callback(self._on_config_change)

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

        # Set callbacks
        if hasattr(self.coordinate_calibration_panel, 'set_config_change_callback'):
            self.coordinate_calibration_panel.set_config_change_callback(self._on_config_change)

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

        if not hasattr(self, 'macro_controls') or not self.macro_controls:
            self.macro_controls = MacroControls(
                self.bottom_bar.frame,
                on_start=self._on_start_macro,
                on_stop=self._on_stop_macro
            )

        self._register_panel_language_listeners()

        if hasattr(self, 'macro_controls') and self.macro_controls:
            self.macro_controls.grid(row=0, column=0, sticky="w", padx=0, pady=0)

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

        if not hasattr(self, 'macro_controls') or not self.macro_controls:
            self.macro_controls = MacroControls(
                self.bottom_bar.frame,
                on_start=self._on_start_macro,
                on_stop=self._on_stop_macro
            )

        if hasattr(self, 'macro_controls') and self.macro_controls:
            self.macro_controls.grid(row=0, column=0, sticky="w", padx=0, pady=0)

        try:
            self.main_notebook.select(self.last_selected_tab)
        except tk.TclError:
            pass
        self._reregister_log_callback()

    def _reregister_log_callback(self):
        """Register only the current tab's panel as ColorPrint callback. Tab order: 0=table1, 1=table2, 2=rosbot, 3=d4, 4=calibration, 5=log."""
        ColorPrint.clear_all_callbacks()
        try:
            sel = self.main_notebook.select()
            idx = self.main_notebook.index(sel)
        except tk.TclError:
            idx = 0
        # Panels live on self; tab frame's winfo_children() are container Frames, not panel objects
        panel = None
        if idx == 2 and hasattr(self, 'rosbot_extension_panel'):
            panel = self.rosbot_extension_panel
        elif idx == 3 and hasattr(self, 'd4_panel'):
            panel = self.d4_panel
        elif idx == 5 and hasattr(self, 'log_panel'):
            panel = self.log_panel
        if panel is not None and hasattr(panel, 'add_log_message'):
            ColorPrint.register_callback(panel.add_log_message)

    def _register_panel_language_listeners(self):
        """Register language change listeners for all panels"""
        panels_to_register = []

        for i in range(self.main_notebook.index("end")):
            tab_frame = self.main_notebook.nametowidget(self.main_notebook.tabs()[i])
            for child in tab_frame.winfo_children():
                if hasattr(child, '_on_language_changed'):
                    panels_to_register.append(child)

        for panel in panels_to_register:
            i18n_manager.add_language_change_listener(panel._on_language_changed)
            ColorPrint.blue(f"[UI] Registered language listener for: {panel.__class__.__name__}")

    def _load_last_tab(self):
        """Load last selected tab from configuration"""
        last_tab = CONFIG.get('ui_settings', {}).get('last_selected_tab', 0)
        self.last_selected_tab = last_tab
    
    def _on_tab_changed(self, event=None):
        """Handle tab change event"""
        selected_tab = self.main_notebook.index(self.main_notebook.select())
        self.last_selected_tab = selected_tab

        if 'ui_settings' not in CONFIG:
            CONFIG['ui_settings'] = {}
        CONFIG['ui_settings']['last_selected_tab'] = selected_tab
        save_config()

        self.bottom_bar.show_tab_content(selected_tab)
        self._reregister_log_callback()
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
        if hasattr(self, 'auxiliary_functions_panel'):
            if hasattr(self.auxiliary_functions_panel, 'set_bag_correction_image'):
                return self.auxiliary_functions_panel.set_bag_correction_image(image_input, display_size)
        ColorPrint.yellow("[UI] Auxiliary functions panel not available")
        return False

    def get_bag_correction_image(self):
        """Get current bag correction image"""
        if hasattr(self, 'auxiliary_functions_panel'):
            if hasattr(self.auxiliary_functions_panel, 'get_bag_correction_image'):
                return self.auxiliary_functions_panel.get_bag_correction_image()
        return None

    def capture_bag_correction_image(self, screenshot_callback=None):
        """Capture bag correction image from game"""
        if hasattr(self, 'auxiliary_functions_panel'):
            if hasattr(self.auxiliary_functions_panel, 'capture_bag_correction_image'):
                return self.auxiliary_functions_panel.capture_bag_correction_image(screenshot_callback)
        return False

    def generate_bag_correction_image(self):
        """Generate bag correction image using GameAssistantController"""
        if hasattr(self, 'auxiliary_functions_panel'):
            if hasattr(self.auxiliary_functions_panel, '_generate_bag_correction_image'):
                return self.auxiliary_functions_panel._generate_bag_correction_image()
        return False

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

    def run(self):
        """Run the UI"""
        self.root.mainloop()
    
    def destroy(self):
        """Destroy the UI completely - called by shutdown manager"""
        if self._geometry_save_after_id:
            try:
                self.root.after_cancel(self._geometry_save_after_id)
            except (tk.TclError, Exception):
                pass
            self._geometry_save_after_id = None
        self._save_window_geometry()
        ColorPrint.blue("[UI] Starting UI destruction...")

        if hasattr(self, 'system_tray') and self.system_tray:
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

