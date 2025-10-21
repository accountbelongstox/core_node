#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coordinate Picker Window Component
Large screenshot display with coordinate picking tools
"""

import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk, ImageDraw
from typing import Optional, Callable, List, Dict
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from providor.common_imports import ColorPrint, ImageAnnotator
from d3utils.i18n_manager import i18n_manager
from ..unified_styles import UnifiedStyles


class CoordinatePicker:
    """
    Coordinate Picker Window
    Displays large screenshot and allows coordinate picking with optional template matching
    """

    def __init__(self, screenshot, game_mode: str = 'd3', on_picks_updated: Optional[Callable] = None, parent=None, client_mode: str = 'game'):
        """Initialize coordinate picker window"""
        self.screenshot = screenshot
        self.game_mode = game_mode
        self.client_mode = client_mode
        self.on_picks_updated = on_picks_updated
        self.parent = parent
        self.picks: List[Dict] = []
        self.current_pick_type = 'point'
        self.pick_mode = False
        self.temp_points: List[tuple] = []

        from .template_matcher_helper import TemplateMatcherHelper
        self.template_matcher = TemplateMatcherHelper()

        self.window = tk.Toplevel(parent) if parent else tk.Tk()
        self.window.title(i18n_manager.get_ui_text("ui.coord_picker.window_title"))
        self.window.geometry("1400x800")
        self.window.resizable(True, True)

        self._create_ui()
        self._setup_screenshot_display()

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
        menu_frame.grid(row=0, column=0, sticky="ns", fill=tk.Y)
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

        # Action buttons
        start_btn = tk.Button(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.start_picking"),
            command=self._on_start_picking,
            bg=UnifiedStyles.COLORS['success'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['success'],
            font=UnifiedStyles.FONTS['button'],
            padx=10,
            pady=8,
            relief=tk.FLAT,
            cursor='hand2'
        )
        start_btn.pack(padx=10, pady=5, fill=tk.X)
        self.start_btn = start_btn

        stop_btn = tk.Button(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.stop_picking"),
            command=self._on_stop_picking,
            bg=UnifiedStyles.COLORS['error'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['error'],
            font=UnifiedStyles.FONTS['button'],
            padx=10,
            pady=8,
            relief=tk.FLAT,
            cursor='hand2',
            state=tk.DISABLED
        )
        stop_btn.pack(padx=10, pady=5, fill=tk.X)
        self.stop_btn = stop_btn

        undo_btn = tk.Button(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.undo"),
            command=self._on_undo,
            bg=UnifiedStyles.COLORS['warning'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['warning'],
            font=UnifiedStyles.FONTS['button'],
            padx=10,
            pady=5,
            relief=tk.FLAT,
            cursor='hand2'
        )
        undo_btn.pack(padx=10, pady=3, fill=tk.X)

        # Separator
        sep4 = ttk.Separator(menu_frame, orient=tk.HORIZONTAL)
        sep4.pack(fill=tk.X, padx=10, pady=5)

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

        # Info section
        info_label = tk.Label(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.picks_count"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['small']
        )
        info_label.pack(padx=10, pady=(10, 5), anchor=tk.W)

        self.count_label = tk.Label(
            menu_frame,
            text="0",
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['accent'],
            font=UnifiedStyles.FONTS['bold']
        )
        self.count_label.pack(padx=10, pady=3, anchor=tk.W)

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
        """Create screenshot canvas"""
        canvas_frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        canvas_frame.grid(row=0, column=1, sticky="nsew", fill=tk.BOTH, expand=True)

        self.canvas = tk.Canvas(
            canvas_frame,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            highlightthickness=0,
            cursor='crosshair'
        )
        self.canvas.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        self.canvas.bind('<Button-1>', self._on_canvas_click)
        self.canvas.bind('<Motion>', self._on_canvas_motion)

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

    def _set_pick_type(self, pick_type: str):
        """Set current pick type"""
        self.current_pick_type = pick_type
        self.pick_type_var.set(pick_type)

        for ptype, btn in self.buttons.items():
            if ptype == pick_type:
                btn.configure(bg=UnifiedStyles.COLORS['accent'])
            else:
                btn.configure(bg=UnifiedStyles.COLORS['bg_tertiary'])

    def _on_start_picking(self):
        """Start picking mode"""
        self.pick_mode = True
        self.temp_points = []
        self.start_btn.configure(state=tk.DISABLED)
        self.stop_btn.configure(state=tk.NORMAL)
        ColorPrint.green(f"[COORD_PICKER] Picking mode started - Type: {self.current_pick_type}")

    def _on_stop_picking(self):
        """Stop picking mode"""
        self.pick_mode = False
        self.start_btn.configure(state=tk.NORMAL)
        self.stop_btn.configure(state=tk.DISABLED)
        self.temp_points = []
        ColorPrint.blue("[COORD_PICKER] Picking mode stopped")

    def _on_canvas_click(self, event):
        """Handle canvas click"""
        if not self.pick_mode:
            return

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
            self._draw_pick(x, y)
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
                self._update_canvas_display()

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
                self._update_canvas_display()

        self._update_count()

    def _on_canvas_motion(self, event):
        """Handle canvas motion"""
        if not self.pick_mode or not hasattr(self, 'scale_factor'):
            return

    def _draw_pick(self, x: int, y: int):
        """Draw a point on the screenshot"""
        self._update_canvas_display()

    def _on_undo(self):
        """Undo last pick"""
        if self.picks:
            self.picks.pop()
            self._update_canvas_display()
            self._update_count()
            ColorPrint.blue("[COORD_PICKER] Last pick undone")

    def _update_count(self):
        """Update pick count display"""
        self.count_label.configure(text=str(len(self.picks)))

    def _on_close(self):
        """Close window and save picks"""
        if self.picks and self.on_picks_updated:
            self.on_picks_updated(self.picks)
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
                if self.template_matcher.match_templates(self.game_mode):
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
