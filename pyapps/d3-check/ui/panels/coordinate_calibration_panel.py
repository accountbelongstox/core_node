#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coordinate Calibration Panel (TABLE5) - Unified Style Version
Contains coordinate picking and calibration tools for game window analysis
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
from pycore.pyfoundations.encyclopedia import ENCYCLOPEDIA
from pycore.pyutils.window_screenshot import WindowScreenshot
from pycore.pyutils.click_handler import ClickHandler
from pycore.pyutils.image_annotator import ImageAnnotator
from providor.providor_index import (
    CONFIG,
    save_config,
    # Client type constants
    CLIENT_TYPE_BATTLENET,
    CLIENT_TYPE_D3_GAME,
    CLIENT_TYPE_D4_GAME,
    # Window title lists
    DIABLO_III_WINDOW_TITLES,
    DIABLO_IV_WINDOW_TITLES
)
from d3utils.battlenet_manager import get_battlenet_window_titles
from ..unified_styles import UnifiedStyles
from ..utils.tk_variables import var_str, var_bool
from d3utils.i18n_manager import i18n_manager
from ui.utils.config_binding import ConfigBinding


class CoordinateCalibrationPanel:
    """
    Coordinate Calibration Panel for TABLE5
    Handles coordinate picking and analysis for game windows
    """

    # Window title mappings for different client types (Battle.net list from battlenet_manager)
    WINDOW_TITLES_MAP = {
        CLIENT_TYPE_BATTLENET: get_battlenet_window_titles(),
        CLIENT_TYPE_D3_GAME: DIABLO_III_WINDOW_TITLES,
        CLIENT_TYPE_D4_GAME: DIABLO_IV_WINDOW_TITLES
    }

    def __init__(self, parent):
        """Initialize coordinate calibration panel"""
        self.parent = parent
        self.vars = {}
        self.screenshot = None
        self.screenshot_path = None
        self.pick_history: List[Dict] = []
        self.current_client_type = CLIENT_TYPE_BATTLENET  # Use constant instead of hardcoded string
        self.should_save_screenshot = True
        self.should_compress_screenshot = False
        self.popup_window = None

        self.style = UnifiedStyles.configure_ttk_styles()

        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        self.container.pack(fill=tk.BOTH, expand=True,
                           padx=UnifiedStyles.SPACING['md'],
                           pady=UnifiedStyles.SPACING['md'])

        self.container.grid_columnconfigure(0, weight=1)
        self.container.grid_rowconfigure(0, weight=0)
        self.container.grid_rowconfigure(1, weight=1)

        self.create_content()

    def create_content(self):
        """Create panel content"""
        self._create_control_panel()
        self._create_history_panel()

    def _create_control_panel(self):
        """Create top bar: 拾取坐标, 清除历史, 导出JSON only. Client type and save/compress use defaults (chosen before opening picker, not shown here)."""
        button_frame = tk.Frame(self.container, bg=UnifiedStyles.COLORS['bg_primary'])
        button_frame.grid(row=0, column=0, sticky="ew", padx=0, pady=(0, UnifiedStyles.SPACING['md']))
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

    def _create_history_panel(self):
        """Create history list panel"""
        history_frame = ttk.LabelFrame(
            self.container,
            text=i18n_manager.get_ui_text("ui.coord_calibration.history_title"),
            style='TLabelframe'
        )
        history_frame.grid(row=1, column=0, sticky="nsew", padx=0, pady=0)
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

    def _on_capture_screenshot(self):
        """Capture screenshot from game window based on selected client type"""
        ColorPrint.blue(f"[COORD_CALIBRATION] Capturing screenshot for client: {self.current_client_type}...")

        try:
            # Get window titles for the selected client type
            window_titles = self.WINDOW_TITLES_MAP.get(
                self.current_client_type,
                self.WINDOW_TITLES_MAP[CLIENT_TYPE_BATTLENET]  # Default fallback
            )
            ColorPrint.blue(f"[COORD_CALIBRATION] Looking for windows: {window_titles}")

            # Use WindowScreenshot to capture the window
            ws = WindowScreenshot()

            # Use the capture_first_window_by_titles method to capture the window
            result = ws.screenshot_first_window_by_titles(
                titles=window_titles,
                filename_prefix=f"calibration_{self.current_client_type}",
                use_cache=True
            )

            if not result or not result.get('screenshot_path'):
                messagebox.showwarning(
                    i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                    i18n_manager.get_ui_text("ui.coord_calibration.no_game_window")
                )
                ColorPrint.yellow(f"[COORD_CALIBRATION] Could not find window matching: {window_titles}")
                return

            # Load the screenshot from the saved file path
            from PIL import Image
            screenshot_path = result['screenshot_path']
            self.screenshot = Image.open(screenshot_path)
            self.screenshot_path = screenshot_path

            ColorPrint.green(f"[COORD_CALIBRATION] Screenshot captured successfully")
            ColorPrint.blue(f"[COORD_CALIBRATION] Window: {result.get('window_title', 'unknown')}")
            ColorPrint.blue(f"[COORD_CALIBRATION] Window offset: {result.get('window_offset', 'N/A')}")
            ColorPrint.blue(f"[COORD_CALIBRATION] Window size: {result.get('window_size', 'N/A')}")

            self._open_calibration_window()

        except Exception as e:
            ColorPrint.red(f"[COORD_CALIBRATION] Error capturing screenshot: {e}")
            import traceback
            traceback.print_exc()
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                f"{i18n_manager.get_ui_text('ui.coord_calibration.error_prefix')}: {str(e)}"
            )

    def _open_calibration_window(self):
        """Open calibration window for coordinate picking"""
        if self.popup_window:
            self.popup_window.destroy()

        from ..components.coordinate_picker_window import CoordinatePicker
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
            coords = f"({pick.get('x', 0)}, {pick.get('y', 0)})"
            pick_type = pick.get('type', 'point')
            game_mode = pick.get('game_mode', 'd3')
            timestamp = pick.get('timestamp', '')[:19]

            self.history_tree.insert(
                '',
                'end',
                iid=f"item_{idx}",
                values=(idx, pick_type, coords, game_mode, timestamp)
            )

    def _on_history_context_menu(self, event):
        """Show context menu for history item"""
        item = self.history_tree.identify('item', event.x, event.y)
        if item:
            self.history_tree.selection_set(item)
            self.selected_item = item
            try:
                self.context_menu.tk_popup(event.x_root, event.y_root)
            finally:
                self.context_menu.grab_release()

    def _on_rename_item(self):
        """Rename selected history item"""
        if not hasattr(self, 'selected_item') or not self.selected_item:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.select_item_first")
            )
            return

        try:
            item_id = int(self.selected_item.split('_')[1]) - 1
            old_name = self.pick_history[item_id].get('name', '')

            dialog = tk.Toplevel(self.parent)
            dialog.title(i18n_manager.get_ui_text("ui.coord_calibration.rename_title"))
            dialog.geometry("300x100")
            dialog.resizable(False, False)

            label = tk.Label(dialog, text=i18n_manager.get_ui_text("ui.coord_calibration.new_name"))
            label.pack(padx=10, pady=5)

            entry = tk.Entry(dialog)
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

        except (ValueError, IndexError):
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.invalid_selection")
            )

    def _on_delete_item(self):
        """Delete selected history item"""
        if not hasattr(self, 'selected_item') or not self.selected_item:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.warning_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.select_item_first")
            )
            return

        try:
            item_id = int(self.selected_item.split('_')[1]) - 1
            del self.pick_history[item_id]
            self._update_history_display()
        except (ValueError, IndexError):
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                i18n_manager.get_ui_text("ui.coord_calibration.invalid_selection")
            )

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

        try:
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

        except Exception as e:
            ColorPrint.red(f"[COORD_CALIBRATION] Export error: {e}")
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title"),
                f"{i18n_manager.get_ui_text('ui.coord_calibration.export_failed')}: {str(e)}"
            )
