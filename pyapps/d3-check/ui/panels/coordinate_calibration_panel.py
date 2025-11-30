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

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from providor.common_imports import ColorPrint, WindowScreenshot, ClickHandler, ImageAnnotator, ENCYCLOPEDIA
from providor.providor_index import (
    CONFIG,
    save_config,
    # Client type constants
    CLIENT_TYPE_BATTLENET,
    CLIENT_TYPE_D3_GAME,
    CLIENT_TYPE_D4_GAME,
    # Window title lists
    BATTLE_NET_WINDOW_TITLES,
    DIABLO_III_WINDOW_TITLES,
    DIABLO_IV_WINDOW_TITLES
)
from ..unified_styles import UnifiedStyles
from d3utils.i18n_manager import i18n_manager
from ui.utils.config_binding import ConfigBinding


class CoordinateCalibrationPanel:
    """
    Coordinate Calibration Panel for TABLE5
    Handles coordinate picking and analysis for game windows
    """

    # Window title mappings for different client types
    # Use centralized window title definitions from providor_index.py
    WINDOW_TITLES_MAP = {
        CLIENT_TYPE_BATTLENET: BATTLE_NET_WINDOW_TITLES,  # Full list from providor_index.py (13+ variants)
        CLIENT_TYPE_D3_GAME: DIABLO_III_WINDOW_TITLES,    # Full list from providor_index.py (13+ variants)
        CLIENT_TYPE_D4_GAME: DIABLO_IV_WINDOW_TITLES      # Full list from providor_index.py (20+ variants)
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
        """Create control panel with settings"""
        control_frame = ttk.LabelFrame(
            self.container,
            text=i18n_manager.get_ui_text("ui.coord_calibration.control_title"),
            style='TLabelframe'
        )
        control_frame.grid(row=0, column=0, sticky="ew", padx=0, pady=(0, UnifiedStyles.SPACING['md']))
        control_frame.grid_columnconfigure(1, weight=1)

        # Client type selection - Three independent clients
        client_frame = tk.Frame(control_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        client_frame.grid(row=0, column=0, columnspan=2, sticky="ew", padx=UnifiedStyles.SPACING['md'], pady=UnifiedStyles.SPACING['sm'])

        client_label = tk.Label(
            client_frame,
            text=i18n_manager.get_ui_text("ui.coord_calibration.client_type"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['label']
        )
        client_label.pack(side=tk.LEFT, padx=(0, UnifiedStyles.SPACING['sm']))

        client_var = tk.StringVar(value=CLIENT_TYPE_BATTLENET)  # Use constant
        self.vars['client_type'] = client_var

        def on_client_type_change(*args):
            """Update current_client_type when selection changes"""
            self.current_client_type = client_var.get()
            ColorPrint.blue(f"[COORD_CALIBRATION] Client type changed to: {self.current_client_type}")

        client_var.trace('w', on_client_type_change)

        # Three independent client options - Use constants instead of hardcoded strings
        client_types = [
            (CLIENT_TYPE_BATTLENET, i18n_manager.get_ui_text("ui.coord_calibration.client_battlenet")),
            (CLIENT_TYPE_D3_GAME, i18n_manager.get_ui_text("ui.coord_calibration.client_d3_game")),
            (CLIENT_TYPE_D4_GAME, i18n_manager.get_ui_text("ui.coord_calibration.client_d4_game"))
        ]

        for type_value, type_label in client_types:
            rb = tk.Radiobutton(
                client_frame,
                text=type_label,
                variable=client_var,
                value=type_value,
                bg=UnifiedStyles.COLORS['bg_secondary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                activebackground=UnifiedStyles.COLORS['bg_tertiary'],
                activeforeground=UnifiedStyles.COLORS['text_primary'],
                selectcolor=UnifiedStyles.COLORS['accent'],
                font=UnifiedStyles.FONTS['label']
            )
            rb.pack(side=tk.LEFT, padx=UnifiedStyles.SPACING['xs'])

        # Options frame
        options_frame = tk.Frame(control_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        options_frame.grid(row=1, column=0, columnspan=2, sticky="ew", padx=UnifiedStyles.SPACING['md'], pady=UnifiedStyles.SPACING['sm'])

        save_var = tk.BooleanVar(value=True)
        self.vars['save_screenshot'] = save_var
        save_cb = tk.Checkbutton(
            options_frame,
            text=i18n_manager.get_ui_text("ui.coord_calibration.save_screenshot"),
            variable=save_var,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['bg_tertiary'],
            activeforeground=UnifiedStyles.COLORS['text_primary'],
            selectcolor=UnifiedStyles.COLORS['accent'],
            font=UnifiedStyles.FONTS['label']
        )
        save_cb.pack(side=tk.LEFT, padx=UnifiedStyles.SPACING['sm'])

        compress_var = tk.BooleanVar(value=False)
        self.vars['compress_screenshot'] = compress_var
        compress_cb = tk.Checkbutton(
            options_frame,
            text=i18n_manager.get_ui_text("ui.coord_calibration.compress_screenshot"),
            variable=compress_var,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['bg_tertiary'],
            activeforeground=UnifiedStyles.COLORS['text_primary'],
            selectcolor=UnifiedStyles.COLORS['accent'],
            font=UnifiedStyles.FONTS['label']
        )
        compress_cb.pack(side=tk.LEFT, padx=UnifiedStyles.SPACING['sm'])

        # Action buttons
        button_frame = tk.Frame(control_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        button_frame.grid(row=3, column=0, columnspan=2, sticky="ew", padx=UnifiedStyles.SPACING['md'], pady=UnifiedStyles.SPACING['sm'])

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
        self.popup_window = CoordinatePicker(
            screenshot=self.screenshot,
            on_picks_updated=self._on_picks_updated,
            parent=self.parent,
            client_mode=self.current_client_type,  # Fixed: client_type -> client_mode
            pick_history_ref=self.pick_history  # Pass reference to main UI's pick history
        )

    def _on_picks_updated(self, picks: List[Dict]):
        """Handle updated picks from calibration window"""
        for pick in picks:
            pick['timestamp'] = datetime.now().isoformat()
            pick['game_mode'] = self.vars['game_mode'].get()
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
