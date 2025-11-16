#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coordinate Picker Window Component
Large screenshot display with coordinate picking tools
"""

import tkinter as tk
from tkinter import ttk
from typing import Optional, Callable, List, Dict
from pathlib import Path
import sys

from pycore.pyfoundations.third_party import get_third_package_PIL

PIL = get_third_package_PIL()
from PIL import Image, ImageTk, ImageDraw

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from providor.common_imports import ColorPrint, ImageAnnotator
from d3utils.i18n_manager import i18n_manager
from ..unified_styles import UnifiedStyles


class CoordinatePicker:
    """
    Coordinate Picker Window
    Displays large screenshot and allows coordinate picking with optional template matching
    """

    def __init__(self, screenshot, game_mode: str = 'd3', on_picks_updated: Optional[Callable] = None, parent=None, client_mode: str = 'game', pick_history_ref: Optional[List] = None):
        """Initialize coordinate picker window"""
        self.screenshot = screenshot
        self.game_mode = game_mode
        self.client_mode = client_mode
        self.on_picks_updated = on_picks_updated
        self.parent = parent
        self.picks: List[Dict] = []
        self.current_pick_type = 'point'
        self.pick_mode = True  # Always in picking mode
        self.temp_points: List[tuple] = []
        self.pick_history_ref = pick_history_ref  # Reference to main UI's pick history

        from .template_matcher_helper import TemplateMatcherHelper
        self.template_matcher = TemplateMatcherHelper()

        self.window = tk.Toplevel(parent) if parent else tk.Tk()

        # Set window title with screenshot size info
        width, height = screenshot.size if screenshot else (0, 0)
        title = i18n_manager.get_ui_text("ui.coord_picker.window_title")
        self.window.title(f"{title} - {width}x{height}")

        self.window.geometry("1400x800")
        self.window.resizable(True, True)

        self._create_ui()
        self._setup_screenshot_display()
        self._update_history_display()  # Initial display of history

    def _create_ui(self):
        """Create UI components"""
        main_frame = tk.Frame(self.window, bg=UnifiedStyles.COLORS['bg_primary'])
        main_frame.pack(fill=tk.BOTH, expand=True)

        main_frame.grid_columnconfigure(0, weight=0, minsize=200)
        main_frame.grid_columnconfigure(1, weight=1)
        main_frame.grid_rowconfigure(0, weight=1)

        self._create_left_menu(main_frame)
        self._create_screenshot_canvas(main_frame)

    def _create_left_menu(self, parent):
        """Create left side menu panel"""
        menu_frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'],
                             width=200)
        menu_frame.grid(row=0, column=0, sticky="ns")  # Fixed: removed fill=tk.Y (not valid for grid)
        menu_frame.grid_propagate(False)

        # Title
        title = tk.Label(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.menu_title"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['bold'],
            wraplength=180
        )
        title.pack(padx=10, pady=10, fill=tk.X)

        # Separator
        sep1 = ttk.Separator(menu_frame, orient=tk.HORIZONTAL)
        sep1.pack(fill=tk.X, padx=10, pady=5)

        # Pick mode label
        mode_label = tk.Label(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.pick_mode_title"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['label']
        )
        mode_label.pack(padx=10, pady=(10, 5), anchor=tk.W)

        # Pick type buttons
        self.pick_type_var = tk.StringVar(value='point')

        for pick_type, label_key in [('point', 'ui.coord_picker.pick_type_point'),
                                      ('rect', 'ui.coord_picker.pick_type_rect'),
                                      ('circle', 'ui.coord_picker.pick_type_circle')]:
            btn = tk.Button(
                menu_frame,
                text=i18n_manager.get_ui_text(label_key),
                command=lambda pt=pick_type: self._set_pick_type(pt),
                bg=UnifiedStyles.COLORS['accent'] if pick_type == 'point' else UnifiedStyles.COLORS['bg_tertiary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                activebackground=UnifiedStyles.COLORS['accent_light'],
                font=UnifiedStyles.FONTS['label'],
                padx=10,
                pady=5,
                relief=tk.FLAT,
                cursor='hand2'
            )
            btn.pack(padx=10, pady=3, fill=tk.X)
            self.buttons = getattr(self, 'buttons', {})
            self.buttons[pick_type] = btn

        # Separator
        sep2 = ttk.Separator(menu_frame, orient=tk.HORIZONTAL)
        sep2.pack(fill=tk.X, padx=10, pady=5)

        # Values section for rect/circle
        value_label = tk.Label(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.values_title"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['label']
        )
        value_label.pack(padx=10, pady=(10, 5), anchor=tk.W)

        # Width spinbox
        width_frame = tk.Frame(menu_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        width_frame.pack(padx=10, pady=3, fill=tk.X)

        width_label = tk.Label(
            width_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.width"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['small']
        )
        width_label.pack(side=tk.LEFT, padx=(0, 5))

        self.width_var = tk.IntVar(value=50)
        width_spin = tk.Spinbox(
            width_frame,
            from_=10,
            to=500,
            textvariable=self.width_var,
            width=6,
            bg=UnifiedStyles.COLORS['bg_primary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['small']
        )
        width_spin.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # Height spinbox
        height_frame = tk.Frame(menu_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        height_frame.pack(padx=10, pady=3, fill=tk.X)

        height_label = tk.Label(
            height_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.height"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['small']
        )
        height_label.pack(side=tk.LEFT, padx=(0, 5))

        self.height_var = tk.IntVar(value=50)
        height_spin = tk.Spinbox(
            height_frame,
            from_=10,
            to=500,
            textvariable=self.height_var,
            width=6,
            bg=UnifiedStyles.COLORS['bg_primary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['small']
        )
        height_spin.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # Radius spinbox
        radius_frame = tk.Frame(menu_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        radius_frame.pack(padx=10, pady=3, fill=tk.X)

        radius_label = tk.Label(
            radius_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.radius"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['small']
        )
        radius_label.pack(side=tk.LEFT, padx=(0, 5))

        self.radius_var = tk.IntVar(value=30)
        radius_spin = tk.Spinbox(
            radius_frame,
            from_=5,
            to=200,
            textvariable=self.radius_var,
            width=6,
            bg=UnifiedStyles.COLORS['bg_primary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['small']
        )
        radius_spin.pack(side=tk.LEFT, fill=tk.X, expand=True)

        # Separator
        sep3 = ttk.Separator(menu_frame, orient=tk.HORIZONTAL)
        sep3.pack(fill=tk.X, padx=10, pady=5)

        # Note: Start/Stop/Undo buttons removed - window is always in picking mode

        # Template Matching Section
        template_label = tk.Label(
            menu_frame,
            text="Template Matching",
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['bold'],
            wraplength=180
        )
        template_label.pack(padx=10, pady=(10, 5), fill=tk.X)

        # Client mode for template matching
        client_frame = tk.Frame(menu_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        client_frame.pack(padx=10, pady=3, fill=tk.X)

        client_label = tk.Label(
            client_frame,
            text="Client:",
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['small']
        )
        client_label.pack(side=tk.LEFT, padx=(0, 5))

        self.client_var = tk.StringVar(value='game')
        for mode in ['game', 'battlenet']:
            rb = tk.Radiobutton(
                client_frame,
                text=mode.capitalize(),
                variable=self.client_var,
                value=mode,
                bg=UnifiedStyles.COLORS['bg_secondary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                activebackground=UnifiedStyles.COLORS['bg_tertiary'],
                activeforeground=UnifiedStyles.COLORS['text_primary'],
                selectcolor=UnifiedStyles.COLORS['accent'],
                font=UnifiedStyles.FONTS['small']
            )
            rb.pack(side=tk.LEFT, padx=3)

        # Template selection button
        template_btn = tk.Button(
            menu_frame,
            text="Select Templates",
            command=self._on_select_templates,
            bg=UnifiedStyles.COLORS['accent'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['accent_light'],
            font=UnifiedStyles.FONTS['button'],
            padx=10,
            pady=5,
            relief=tk.FLAT,
            cursor='hand2'
        )
        template_btn.pack(padx=10, pady=3, fill=tk.X)

        # Separator
        sep5 = ttk.Separator(menu_frame, orient=tk.HORIZONTAL)
        sep5.pack(fill=tk.X, padx=10, pady=5)

        # History section - Treeview list like main panel
        history_label = tk.Label(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.history_title"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['bold']
        )
        history_label.pack(padx=10, pady=(10, 5), anchor=tk.W)

        # Create frame for treeview and scrollbar
        tree_frame = tk.Frame(menu_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        tree_frame.pack(padx=10, pady=5, fill=tk.BOTH, expand=True)

        # Create scrollbar
        tree_scrollbar = ttk.Scrollbar(tree_frame)
        tree_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Create compact Treeview
        self.history_tree = ttk.Treeview(
            tree_frame,
            columns=('ID', 'Type', 'Coords'),
            height=8,
            yscrollcommand=tree_scrollbar.set,
            style='Treeview',
            show='headings'
        )
        tree_scrollbar.config(command=self.history_tree.yview)

        # Configure columns - compact version
        self.history_tree.column('ID', width=30, anchor=tk.CENTER)
        self.history_tree.column('Type', width=50, anchor=tk.CENTER)
        self.history_tree.column('Coords', width=100, anchor=tk.W)

        self.history_tree.heading('ID', text='ID')
        self.history_tree.heading('Type', text='Type')
        self.history_tree.heading('Coords', text='Coords')

        self.history_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        close_btn = tk.Button(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.close"),
            command=self._on_close,
            bg=UnifiedStyles.COLORS['bg_tertiary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['accent'],
            font=UnifiedStyles.FONTS['button'],
            padx=10,
            pady=5,
            relief=tk.FLAT,
            cursor='hand2'
        )
        close_btn.pack(padx=10, pady=10, fill=tk.X, side=tk.BOTTOM)

    def _create_screenshot_canvas(self, parent):
        """Create screenshot canvas with transparent overlay for drawing"""
        canvas_frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        canvas_frame.grid(row=0, column=1, sticky="nsew")

        # Main canvas for screenshot
        self.canvas = tk.Canvas(
            canvas_frame,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            highlightthickness=0,
            cursor='crosshair'
        )
        self.canvas.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        self.canvas.bind('<Button-1>', self._on_canvas_click)
        self.canvas.bind('<Motion>', self._on_canvas_motion)

        # Initialize drawing marks list
        self.canvas_marks = []  # Store canvas item IDs for drawn marks

    def _setup_screenshot_display(self):
        """Setup screenshot on canvas"""
        if not self.screenshot:
            return

        self.original_screenshot = self.screenshot
        self._update_canvas_display()

    def _update_canvas_display(self):
        """Update canvas display with current screenshot"""
        if not self.original_screenshot:
            return

        canvas_width = self.canvas.winfo_width()
        canvas_height = self.canvas.winfo_height()

        if canvas_width <= 1 or canvas_height <= 1:
            self.window.after(100, self._update_canvas_display)
            return

        # Use template matcher's display image if matches have been drawn, otherwise use original
        display_image = self.template_matcher.display_image if self.template_matcher.display_image else self.original_screenshot

        img_width, img_height = display_image.size
        scale = min(canvas_width / img_width, canvas_height / img_height)

        new_width = int(img_width * scale)
        new_height = int(img_height * scale)

        self.display_screenshot = display_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        self.photo_image = ImageTk.PhotoImage(self.display_screenshot)

        self.canvas.delete('all')
        self.canvas.create_image(canvas_width // 2, canvas_height // 2, image=self.photo_image)

        self.scale_factor = scale
        self.canvas_offset_x = (canvas_width - new_width) // 2
        self.canvas_offset_y = (canvas_height - new_height) // 2

        # Redraw all existing marks after canvas update
        self._redraw_all_marks()

    def _redraw_all_marks(self):
        """Redraw all pick marks on canvas after display update"""
        # Clear old canvas marks list
        self.canvas_marks = []

        # Use main UI's history if available, otherwise local picks
        history = self.pick_history_ref if self.pick_history_ref is not None else self.picks

        # Redraw all marks from history
        for pick in history:
            x = pick.get('x', 0)
            y = pick.get('y', 0)
            pick_type = pick.get('type', 'point')

            if pick_type == 'point':
                self._draw_mark_at(x, y)

    def _draw_mark_at(self, x: int, y: int):
        """Draw a mark at given original coordinates"""
        if not hasattr(self, 'scale_factor'):
            return

        # Convert original coordinates to canvas coordinates
        canvas_x = int(x * self.scale_factor) + self.canvas_offset_x
        canvas_y = int(y * self.scale_factor) + self.canvas_offset_y

        # Draw circle marker
        marker_size = 8
        mark_id = self.canvas.create_oval(
            canvas_x - marker_size, canvas_y - marker_size,
            canvas_x + marker_size, canvas_y + marker_size,
            outline='#00FF00',  # Green outline
            fill='',  # No fill for transparency effect
            width=2,
            tags='pick_mark'
        )

        # Draw crosshair
        cross_size = 15
        h_line = self.canvas.create_line(
            canvas_x - cross_size, canvas_y,
            canvas_x + cross_size, canvas_y,
            fill='#00FF00',
            width=2,
            tags='pick_mark'
        )
        v_line = self.canvas.create_line(
            canvas_x, canvas_y - cross_size,
            canvas_x, canvas_y + cross_size,
            fill='#00FF00',
            width=2,
            tags='pick_mark'
        )

        self.canvas_marks.extend([mark_id, h_line, v_line])

    def _set_pick_type(self, pick_type: str):
        """Set current pick type"""
        self.current_pick_type = pick_type
        self.pick_type_var.set(pick_type)

        for ptype, btn in self.buttons.items():
            if ptype == pick_type:
                btn.configure(bg=UnifiedStyles.COLORS['accent'])
            else:
                btn.configure(bg=UnifiedStyles.COLORS['bg_tertiary'])

    # Note: _on_start_picking and _on_stop_picking removed - always in picking mode

    def _on_canvas_click(self, event):
        """Handle canvas click - always active since window is in constant picking mode"""
        # No need to check pick_mode - always active

        if not hasattr(self, 'scale_factor'):
            return

        x = int((event.x - self.canvas_offset_x) / self.scale_factor)
        y = int((event.y - self.canvas_offset_y) / self.scale_factor)

        if x < 0 or y < 0 or x > self.original_screenshot.width or y > self.original_screenshot.height:
            return

        if self.current_pick_type == 'point':
            pick = {
                'type': 'point',
                'x': x,
                'y': y,
                'name': f"Point {len(self.picks) + 1}"
            }
            self.picks.append(pick)

            # Immediately sync to main UI if callback provided
            if self.on_picks_updated:
                self.on_picks_updated([pick])

            self._draw_pick(x, y)
            self._update_history_display()  # Update list display
            ColorPrint.green(f"[COORD_PICKER] Pick added: {pick}")

        elif self.current_pick_type == 'rect':
            if len(self.temp_points) == 0:
                self.temp_points.append((x, y))
            elif len(self.temp_points) == 1:
                x1, y1 = self.temp_points[0]
                pick = {
                    'type': 'rect',
                    'x': min(x, x1),
                    'y': min(y, y1),
                    'width': abs(x - x1),
                    'height': abs(y - y1),
                    'name': f"Rect {len(self.picks) + 1}"
                }
                self.picks.append(pick)
                self.temp_points = []

                # Immediately sync to main UI
                if self.on_picks_updated:
                    self.on_picks_updated([pick])

                self._update_canvas_display()
                self._update_history_display()

        elif self.current_pick_type == 'circle':
            if len(self.temp_points) == 0:
                self.temp_points.append((x, y))
            elif len(self.temp_points) == 1:
                cx, cy = self.temp_points[0]
                radius = int(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5)
                pick = {
                    'type': 'circle',
                    'x': cx,
                    'y': cy,
                    'radius': radius,
                    'name': f"Circle {len(self.picks) + 1}"
                }
                self.picks.append(pick)
                self.temp_points = []

                # Immediately sync to main UI
                if self.on_picks_updated:
                    self.on_picks_updated([pick])

                self._update_canvas_display()
                self._update_history_display()

    def _on_canvas_motion(self, event):
        """Handle canvas motion"""
        if not self.pick_mode or not hasattr(self, 'scale_factor'):
            return

    def _draw_pick(self, x: int, y: int):
        """Draw a point on the canvas overlay - real-time visual feedback"""
        self._draw_mark_at(x, y)
        ColorPrint.blue(f"[COORD_PICKER] Drew mark at original pos ({x}, {y})")

    def _on_undo(self):
        """Undo last pick"""
        if self.picks:
            self.picks.pop()
            self._update_canvas_display()
            self._update_history_display()
            ColorPrint.blue("[COORD_PICKER] Last pick undone")

    def _update_history_display(self):
        """Update history tree display - shows main UI's pick history"""
        # Clear existing items
        for item in self.history_tree.get_children():
            self.history_tree.delete(item)

        # Use main UI's history if available, otherwise local picks
        history = self.pick_history_ref if self.pick_history_ref is not None else self.picks

        # Populate tree with history
        for idx, pick in enumerate(history, 1):
            pick_type = pick.get('type', 'point')
            x = pick.get('x', 0)
            y = pick.get('y', 0)
            coords = f"({x}, {y})"

            self.history_tree.insert(
                '',
                'end',
                iid=f"item_{idx}",
                values=(idx, pick_type, coords)
            )

    def _on_close(self):
        """Close window - picks already synced in real-time"""
        # Note: Picks are now synced immediately on each click
        # No need to sync again on close
        self.window.destroy()

    def destroy(self):
        """Destroy the coordinate picker window (delegate to internal window)"""
        if hasattr(self, 'window') and self.window:
            self.window.destroy()

    def _on_select_templates(self):
        """Open template selection dialog"""
        if not self.screenshot:
            ColorPrint.yellow("[COORD_PICKER] No screenshot to match templates on")
            return

        from tkinter import Toplevel
        from tkinter import ttk as tkinter_ttk

        dialog = Toplevel(self.window)
        dialog.title("Select Templates")
        dialog.geometry("450x600")
        dialog.resizable(True, True)

        templates_data = self.template_matcher.get_available_templates(self.game_mode, self.client_var.get())

        selected_templates = {}

        # Create main scrollable frame
        canvas = tk.Canvas(dialog, bg=UnifiedStyles.COLORS['bg_primary'], highlightthickness=0)
        scrollbar = tk.Scrollbar(dialog, orient="vertical", command=canvas.yview)
        scrollable_frame = tk.Frame(canvas, bg=UnifiedStyles.COLORS['bg_primary'])

        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )

        canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        # Template selection section
        template_label = tk.Label(
            scrollable_frame,
            text="Select Templates:",
            bg=UnifiedStyles.COLORS['bg_primary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['bold']
        )
        template_label.pack(anchor=tk.W, padx=10, pady=(10, 5))

        for category, templates in templates_data.items():
            cat_label = tk.Label(
                scrollable_frame,
                text=category.upper(),
                bg=UnifiedStyles.COLORS['bg_primary'],
                fg=UnifiedStyles.COLORS['accent'],
                font=UnifiedStyles.FONTS['bold']
            )
            cat_label.pack(anchor=tk.W, padx=10, pady=(5, 3))

            for template in templates:
                var = tk.BooleanVar(value=False)
                selected_templates[template] = var

                cb = tk.Checkbutton(
                    scrollable_frame,
                    text=template,
                    variable=var,
                    bg=UnifiedStyles.COLORS['bg_primary'],
                    fg=UnifiedStyles.COLORS['text_primary'],
                    activebackground=UnifiedStyles.COLORS['bg_tertiary'],
                    activeforeground=UnifiedStyles.COLORS['text_primary'],
                    selectcolor=UnifiedStyles.COLORS['accent'],
                    font=UnifiedStyles.FONTS['small']
                )
                cb.pack(anchor=tk.W, padx=30, pady=1)

        # Separator
        sep = ttk.Separator(scrollable_frame, orient=tk.HORIZONTAL)
        sep.pack(fill=tk.X, padx=10, pady=10)

        # Match modes section
        modes_label = tk.Label(
            scrollable_frame,
            text="Drawing Modes:",
            bg=UnifiedStyles.COLORS['bg_primary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['bold']
        )
        modes_label.pack(anchor=tk.W, padx=10, pady=(5, 5))

        match_modes = {}
        for mode_name, mode_key in [('point', 'Point'), ('rect', 'Rectangle'), ('circle', 'Circle')]:
            var = tk.BooleanVar(value=False)
            match_modes[mode_name] = var

            cb = tk.Checkbutton(
                scrollable_frame,
                text=mode_key,
                variable=var,
                bg=UnifiedStyles.COLORS['bg_primary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                activebackground=UnifiedStyles.COLORS['bg_tertiary'],
                activeforeground=UnifiedStyles.COLORS['text_primary'],
                selectcolor=UnifiedStyles.COLORS['accent'],
                font=UnifiedStyles.FONTS['small']
            )
            cb.pack(anchor=tk.W, padx=30, pady=2)

        canvas.pack(side="left", fill="both", expand=True, padx=10, pady=10)
        scrollbar.pack(side="right", fill="y")

        button_frame = tk.Frame(dialog, bg=UnifiedStyles.COLORS['bg_primary'])
        button_frame.pack(fill=tk.X, padx=10, pady=10)

        def on_apply():
            for template, var in selected_templates.items():
                if var.get():
                    self.template_matcher.select_template(template, True)
                else:
                    self.template_matcher.select_template(template, False)

            # Set match modes based on selected checkboxes
            for mode_name, var in match_modes.items():
                self.template_matcher.match_modes[mode_name] = var.get()

            if self.template_matcher.selected_templates:
                # Check if at least one match mode is selected
                if not any(self.template_matcher.match_modes.values()):
                    ColorPrint.yellow("[COORD_PICKER] Please select at least one drawing mode (Point, Rectangle, or Circle)")
                    return

                self.template_matcher.set_image(self.original_screenshot.copy())
                if self.template_matcher.match_templates(self.client_var.get()):
                    self.template_matcher.draw_matches_on_image()
                    self._update_canvas_display()
                    ColorPrint.green(f"[COORD_PICKER] Templates matched and drawn with modes: {self.template_matcher.match_modes}")
                else:
                    ColorPrint.yellow("[COORD_PICKER] No matches found for selected templates")

            dialog.destroy()

        apply_btn = tk.Button(
            button_frame,
            text="Apply & Match",
            command=on_apply,
            bg=UnifiedStyles.COLORS['success'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['success'],
            font=UnifiedStyles.FONTS['button'],
            padx=10,
            pady=5,
            relief=tk.FLAT,
            cursor='hand2'
        )
        apply_btn.pack(side=tk.LEFT, padx=5)

        def on_reset():
            self.template_matcher.reset_image()
            self._update_canvas_display()
            ColorPrint.blue("[COORD_PICKER] Image reset")

        reset_btn = tk.Button(
            button_frame,
            text="Reset Image",
            command=on_reset,
            bg=UnifiedStyles.COLORS['warning'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['warning'],
            font=UnifiedStyles.FONTS['button'],
            padx=10,
            pady=5,
            relief=tk.FLAT,
            cursor='hand2'
        )
        reset_btn.pack(side=tk.LEFT, padx=5)

        cancel_btn = tk.Button(
            button_frame,
            text="Cancel",
            command=dialog.destroy,
            bg=UnifiedStyles.COLORS['error'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['error'],
            font=UnifiedStyles.FONTS['button'],
            padx=10,
            pady=5,
            relief=tk.FLAT,
            cursor='hand2'
        )
        cancel_btn.pack(side=tk.LEFT, padx=5)

    def _on_close_window(self):
        """Handle window close"""
        self._on_close()
