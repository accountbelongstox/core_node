#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coordinate Calibration Panel (TABLE5) - Unified Style Version
Contains coordinate picking and calibration tools. CoordinatePicker is a transient dialog created on demand and not cached.
"""

import tkinter as tk
from tkinter import ttk, messagebox
import sys
import os
from typing import Optional, Callable, List, Dict
from pathlib import Path
import json
from datetime import datetime

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.color_print import ColorPrint
from d3utils.screenshot_provider import get_window_screenshot
from providor.providor_index import (
    CONFIG,
    save_config,
    CLIENT_TYPE_BATTLENET,
    CLIENT_TYPE_D3_GAME,
    CLIENT_TYPE_D4_GAME,
    VALID_CLIENT_TYPES,
    get_config_value_safe,
    set_config_value_async,
    DIABLO_III_WINDOW_TITLES,
    DIABLO_IV_WINDOW_TITLES,
)
from ..unified_styles import UnifiedStyles
from d3utils.battlenet_manager import get_battlenet_manager
from d3utils.d3_manager import get_d3_manager
from ..utils.tk_variables import var_str, var_bool
from providor.i18n_manager import i18n_manager
from ui.utils.config_binding import ConfigBinding
from ..components.yolo_annotation_window import YoloAnnotationWindow
from ..components.coordinate_picker_window import CoordinatePicker

# Config key for client type (class-library style: module-level constant)
CONFIG_KEY_CLIENT_TYPE = "coord_calibration.client_type"


class CoordinateCalibrationPanel:
    """
    Coordinate Calibration Panel for TABLE5
    Handles coordinate picking and analysis for game windows
    """

    # Window title mappings (Battle.net/D3: by exe when path set, else title; use get_capture_titles() for D3 at runtime)
    WINDOW_TITLES_MAP = {
        CLIENT_TYPE_BATTLENET: ["Battle.net"],
        CLIENT_TYPE_D3_GAME: None,  # resolved at capture time via get_d3_manager().get_capture_titles()
        CLIENT_TYPE_D4_GAME: DIABLO_IV_WINDOW_TITLES,
    }

    def __init__(self, parent):
        """Initialize coordinate calibration panel"""
        self.parent = parent
        self.vars = {}
        self.screenshot = None
        self.screenshot_path = None
        self.pick_history: List[Dict] = []

        saved = get_config_value_safe(CONFIG_KEY_CLIENT_TYPE, None)
        self.current_client_type = (
            saved if saved in VALID_CLIENT_TYPES else CLIENT_TYPE_BATTLENET
        )
        self.should_save_screenshot = True
        self.should_compress_screenshot = False
        self.popup_window = None
        self.selected_item = None

        # ttk styles: single source from UITheme.apply_to_root (no second configure here; see docs/ui2)

        # Tab main style (UnifiedStyles.TAB_PAD, same as other tab panels)
        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        tab_pad = UnifiedStyles.TAB_PAD
        self.container.pack(fill=tk.BOTH, expand=True, padx=tab_pad, pady=tab_pad)

        self.container.grid_columnconfigure(0, weight=1)
        self.container.grid_rowconfigure(0, weight=0)
        self.container.grid_rowconfigure(1, weight=0)
        self.container.grid_rowconfigure(2, weight=1)

        self.create_content()

    def create_content(self):
        """Create panel content: client row first, then buttons, then history."""
        self._create_client_row()
        self._create_control_panel()
        self._create_history_panel()

    def _on_client_type_change(self, value: str) -> None:
        """Update current client type and persist so next launch restores selection."""
        self.current_client_type = value
        set_config_value_async(CONFIG_KEY_CLIENT_TYPE, value)

    def _create_client_row(self):
        """Client selector at top, left-aligned and grouped."""
        client_frame = tk.Frame(
            self.container,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            highlightbackground=UnifiedStyles.COLORS['panel_border'],
            highlightthickness=1
        )
        client_frame.grid(row=0, column=0, sticky="w", padx=0, pady=(0, UnifiedStyles.SPACING['sm']))
        client_frame.grid_columnconfigure(0, weight=0)
        pad = UnifiedStyles.SPACING['sm']
        inner = tk.Frame(client_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        inner.pack(side=tk.LEFT, padx=pad, pady=pad)
        lbl = tk.Label(
            inner,
            text=i18n_manager.get_ui_text("ui.coord_calibration.client_mode"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_secondary'],
            font=UnifiedStyles.FONTS['label']
        )
        lbl.pack(side=tk.LEFT, padx=(0, pad))
        self.var_client = tk.StringVar(value=self.current_client_type)
        for val, key in [
            (CLIENT_TYPE_BATTLENET, "ui.coord_calibration.client_battlenet"),
            (CLIENT_TYPE_D3_GAME, "ui.coord_calibration.client_d3_game"),
            (CLIENT_TYPE_D4_GAME, "ui.coord_calibration.client_d4_game"),
        ]:
            rb = tk.Radiobutton(
                inner,
                text=i18n_manager.get_ui_text(key),
                variable=self.var_client,
                value=val,
                bg=UnifiedStyles.COLORS['bg_secondary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                selectcolor=UnifiedStyles.COLORS['bg_tertiary'],
                activebackground=UnifiedStyles.COLORS['bg_secondary'],
                activeforeground=UnifiedStyles.COLORS['text_primary'],
                font=UnifiedStyles.FONTS['label'],
                command=lambda v=val: self._on_client_type_change(v)
            )
            rb.pack(side=tk.LEFT, padx=(0, pad * 2))

    def _create_control_panel(self):
        """Top bar: capture, clear history, export JSON."""
        button_frame = tk.Frame(self.container, bg=UnifiedStyles.COLORS['bg_primary'])
        button_frame.grid(row=1, column=0, sticky="ew", padx=0, pady=(0, UnifiedStyles.SPACING['md']))
        button_frame.grid_columnconfigure(0, weight=1)

        capture_btn = tk.Button(
            button_frame,
            text=i18n_manager.get_ui_text("ui.coord_calibration.capture_button"),
            command=self._on_capture_screenshot,
            bg=UnifiedStyles.COLORS['accent'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['accent_light'],
            activeforeground=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            padx=UnifiedStyles.SPACING['md'],
            pady=UnifiedStyles.SPACING['sm'],
            relief=tk.FLAT,
            cursor='hand2'
        )
        capture_btn.pack(side=tk.LEFT, padx=(0, UnifiedStyles.SPACING['sm']))

        clear_btn = tk.Button(
            button_frame,
            text=i18n_manager.get_ui_text("ui.coord_calibration.clear_button"),
            command=self._on_clear_history,
            bg=UnifiedStyles.COLORS['error'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['error'],
            activeforeground=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            padx=UnifiedStyles.SPACING['md'],
            pady=UnifiedStyles.SPACING['sm'],
            relief=tk.FLAT,
            cursor='hand2'
        )
        clear_btn.pack(side=tk.LEFT, padx=UnifiedStyles.SPACING['xs'])

        export_btn = tk.Button(
            button_frame,
            text=i18n_manager.get_ui_text("ui.coord_calibration.export_button"),
            command=self._on_export_history,
            bg=UnifiedStyles.COLORS['success'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['success'],
            activeforeground=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            padx=UnifiedStyles.SPACING['md'],
            pady=UnifiedStyles.SPACING['sm'],
            relief=tk.FLAT,
            cursor='hand2'
        )
        export_btn.pack(side=tk.LEFT, padx=UnifiedStyles.SPACING['xs'])

        yolo_btn = tk.Button(
            button_frame,
            text=i18n_manager.get_ui_text("ui.coord_calibration.yolo_collect_button"),
            command=self._on_yolo_collect,
            bg=UnifiedStyles.COLORS['accent'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['accent_light'],
            activeforeground=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            padx=UnifiedStyles.SPACING['md'],
            pady=UnifiedStyles.SPACING['sm'],
            relief=tk.FLAT,
            cursor='hand2'
        )
        yolo_btn.pack(side=tk.LEFT, padx=UnifiedStyles.SPACING['xs'])

    def _create_history_panel(self):
        """Create history list panel"""
        history_frame = ttk.LabelFrame(
            self.container,
            text=i18n_manager.get_ui_text("ui.coord_calibration.history_title"),
            style='TLabelframe'
        )
        history_frame.grid(row=2, column=0, sticky="nsew", padx=0, pady=0)
        history_frame.grid_rowconfigure(0, weight=1)
        history_frame.grid_columnconfigure(0, weight=1)

        # Create scrollbar
        scrollbar = ttk.Scrollbar(history_frame)
        scrollbar.grid(row=0, column=1, sticky="ns")

        # Create Treeview
        self.history_tree = ttk.Treeview(
            history_frame,
            columns=('Index', 'Type', 'Coordinates', 'GameMode', 'Timestamp'),
            height=15,
            yscrollcommand=scrollbar.set,
            style='Treeview'
        )
        scrollbar.config(command=self.history_tree.yview)

        self.history_tree.column('#0', width=0, stretch=tk.NO)
        self.history_tree.column('Index', width=50, anchor=tk.CENTER)
        self.history_tree.column('Type', width=80, anchor=tk.CENTER)
        self.history_tree.column('Coordinates', width=150, anchor=tk.W)
        self.history_tree.column('GameMode', width=80, anchor=tk.CENTER)
        self.history_tree.column('Timestamp', width=150, anchor=tk.W)

        self.history_tree.heading('#0', text='', anchor=tk.W)
        self.history_tree.heading('Index', text='ID')
        self.history_tree.heading('Type', text=i18n_manager.get_ui_text("ui.coord_calibration.history_type"))
        self.history_tree.heading('Coordinates', text=i18n_manager.get_ui_text("ui.coord_calibration.history_coords"))
        self.history_tree.heading('GameMode', text=i18n_manager.get_ui_text("ui.coord_calibration.history_mode"))
        self.history_tree.heading('Timestamp', text=i18n_manager.get_ui_text("ui.coord_calibration.history_time"))

        self.history_tree.grid(row=0, column=0, sticky="nsew")

        # Bind right-click context menu
        self.history_tree.bind('<Button-3>', self._on_history_context_menu)

        # Add context menu
        self.context_menu = tk.Menu(self.history_tree, tearoff=0)
        self.context_menu.add_command(
            label=i18n_manager.get_ui_text("ui.coord_calibration.rename_item"),
            command=self._on_rename_item
        )
        self.context_menu.add_command(
            label=i18n_manager.get_ui_text("ui.coord_calibration.delete_item"),
            command=self._on_delete_item
        )

    def _capture_for_client(self):
        """Capture current client window to memory. Returns (screenshot, None) or (None, error_msg)."""
        window_titles = self.WINDOW_TITLES_MAP.get(
            self.current_client_type,
            self.WINDOW_TITLES_MAP[CLIENT_TYPE_BATTLENET],
        )
        if self.current_client_type == CLIENT_TYPE_BATTLENET:
            get_battlenet_manager().prime_window_cache_for_capture()
        elif self.current_client_type == CLIENT_TYPE_D3_GAME:
            get_d3_manager().prime_window_cache_for_capture()
            window_titles = get_d3_manager().get_capture_titles()
        if window_titles is None:
            window_titles = self.WINDOW_TITLES_MAP[CLIENT_TYPE_BATTLENET]
        ws = get_window_screenshot(match_mode="endswith")
        out = ws.capture_first_window_to_memory(titles=window_titles, use_cache=True)
        if not out:
            return (None, i18n_manager.get_ui_text("ui.coord_calibration.no_game_window") or "No window")
        self.screenshot, info = out
        self.screenshot_path = None
        return (self.screenshot, None)

    def _on_capture_screenshot(self):
        """Activate client window, capture to memory (no file), open picker."""
        ColorPrint.blue(f"[COORD_CALIBRATION] Capturing for client: {self.current_client_type}...")
        screenshot, err = self._capture_for_client()
        if err:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                err
            )
            ColorPrint.yellow(f"[COORD_CALIBRATION] No window")
            return
        ColorPrint.green(f"[COORD_CALIBRATION] Captured in memory")
        self._open_calibration_window()

    def _on_yolo_collect(self):
        """Capture for current client and open YOLO training data collection window."""
        ColorPrint.blue(f"[COORD_CALIBRATION] YOLO collect for client: {self.current_client_type}...")
        screenshot, err = self._capture_for_client()
        if err:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                err
            )
            return
        YoloAnnotationWindow(
            initial_screenshot=screenshot,
            client_mode=self.current_client_type,
            on_capture=self._capture_for_client,
            parent=self.parent,
        )

    def _open_calibration_window(self):
        """Open calibration window for coordinate picking"""
        if self.popup_window:
            self.popup_window.destroy()

        game_mode = self.vars.get('game_mode')
        game_mode_val = game_mode.get() if game_mode else 'd3'
        self.popup_window = CoordinatePicker(
            screenshot=self.screenshot,
            game_mode=game_mode_val,
            on_picks_updated=self._on_picks_updated,
            parent=self.parent,
            client_mode=self.current_client_type,
            pick_history_ref=self.pick_history
        )

    def _on_picks_updated(self, picks: List[Dict]):
        """Handle updated picks from calibration window"""
        gm_var = self.vars.get('game_mode')
        game_mode_val = gm_var.get() if gm_var is not None else 'd3'
        for pick in picks:
            pick['timestamp'] = datetime.now().isoformat()
            pick['game_mode'] = game_mode_val
            self.pick_history.append(pick)

        self._update_history_display()
        ColorPrint.green(f"[COORD_CALIBRATION] Added {len(picks)} picks to history")

    def _update_history_display(self):
        """Update history tree display"""
        for item in self.history_tree.get_children():
            self.history_tree.delete(item)

        for idx, pick in enumerate(self.pick_history, 1):
            pick_type = pick.get('type', 'point')
            x, y = pick.get('x', 0), pick.get('y', 0)
            if pick_type == 'point':
                coords = f"({x}, {y})"
            elif pick_type == 'rect':
                w, h = pick.get('width', 0), pick.get('height', 0)
                coords = f"{x},{y} {w}×{h}"
            elif pick_type == 'circle':
                r = pick.get('radius', 0)
                coords = f"({x},{y}) r={r}"
            else:
                coords = f"({x}, {y})"
            game_mode = pick.get('game_mode', 'd3')
            timestamp = pick.get('timestamp', '')[:19]

            self.history_tree.insert(
                '',
                'end',
                iid=f"item_{idx}",
                values=(idx, pick_type, coords, game_mode, timestamp)
            )

    def _on_history_context_menu(self, event):
        """Show context menu for history item. Call only when widget exists."""
        if not self.history_tree.winfo_exists():
            return
        item = self.history_tree.identify('item', event.x, event.y)
        if item:
            self.history_tree.selection_set(item)
            self.selected_item = item
            if self.context_menu.winfo_exists():
                self.context_menu.tk_popup(event.x_root, event.y_root)

    def _on_rename_item(self):
        """Rename selected history item"""
        if self.selected_item is None or not self.selected_item:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.select_item_first")
            )
            return
        parts = self.selected_item.split('_')
        if len(parts) != 2 or not parts[1].isdigit():
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.invalid_selection")
            )
            return
        item_id = int(parts[1]) - 1
        if item_id < 0 or item_id >= len(self.pick_history):
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.invalid_selection")
            )
            return
        old_name = self.pick_history[item_id].get('name', '')

        dialog = tk.Toplevel(self.parent)
        dialog.title(i18n_manager.get_ui_text("ui.coord_calibration.rename_title"))
        dialog.geometry("300x100")
        dialog.resizable(False, False)

        label = tk.Label(dialog, text=i18n_manager.get_ui_text("ui.coord_calibration.new_name"))
        label.pack(padx=10, pady=5)

        entry = tk.Entry(dialog, bg=UnifiedStyles.COLORS['input_bg'], fg=UnifiedStyles.COLORS['input_text'])
        entry.insert(0, old_name)
        entry.pack(padx=10, pady=5, fill=tk.X)
        entry.focus()

        def on_ok():
            new_name = entry.get()
            self.pick_history[item_id]['name'] = new_name
            self._update_history_display()
            dialog.destroy()

        btn = tk.Button(dialog, text="OK", command=on_ok)
        btn.pack(pady=5)

    def _on_delete_item(self):
        """Delete selected history item"""
        if self.selected_item is None or not self.selected_item:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.select_item_first")
            )
            return
        parts = self.selected_item.split('_')
        if len(parts) != 2 or not parts[1].isdigit():
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.invalid_selection")
            )
            return
        item_id = int(parts[1]) - 1
        if item_id < 0 or item_id >= len(self.pick_history):
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.invalid_selection")
            )
            return
        del self.pick_history[item_id]
        self._update_history_display()

    def _on_clear_history(self):
        """Clear all history"""
        if messagebox.askyesno(
            i18n_manager.get_ui_text("ui.coord_calibration.confirm_title"),
            i18n_manager.get_ui_text("ui.coord_calibration.confirm_clear")
        ):
            self.pick_history.clear()
            self._update_history_display()
            ColorPrint.green("[COORD_CALIBRATION] History cleared")

    def _on_export_history(self):
        """Export history to JSON"""
        if not self.pick_history:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.history_empty")
            )
            return

        export_dir = Path(__file__).parent.parent.parent / "exports" / "calibration"
        export_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_path = export_dir / f"calibration_export_{timestamp}.json"
        export_data = {
            'timestamp': datetime.now().isoformat(),
            'total_picks': len(self.pick_history),
            'picks': self.pick_history
        }
        with open(export_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)
        messagebox.showinfo(
            i18n_manager.get_ui_text("ui.coord_calibration.success_title"),
            f"{i18n_manager.get_ui_text('ui.coord_calibration.export_success')}\n{export_path}"
        )
        ColorPrint.green(f"[COORD_CALIBRATION] Export saved to {export_path}")
