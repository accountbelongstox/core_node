#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Coordinate Picker Window Component
Large screenshot display with coordinate picking tools
"""

import tkinter as tk
from tkinter import ttk, Toplevel, messagebox
from typing import Optional, Callable, List, Dict, Tuple, Any
from pathlib import Path
import sys

from pycore.pyfoundations.third_party.api import get_third_package_PIL_Image, get_third_package_PIL_ImageDraw, get_third_package_PIL_ImageTk

Image = get_third_package_PIL_Image()
ImageDraw = get_third_package_PIL_ImageDraw()
ImageTk = get_third_package_PIL_ImageTk()

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.image_tools.image_annotator import ImageAnnotator
from providor.providor_index import (
    CLIENT_TYPE_BATTLENET,
    CLIENT_TYPE_D3_GAME,
    CLIENT_TYPE_D4_GAME,
)
from providor.i18n_manager import i18n_manager
from providor.constants.common import TMP_DIR
from ..unified_styles import UnifiedStyles
from ..utils.tk_variables import var_str, var_int, var_bool
from ..utils.app_root import get_app_root
from .template_matcher_helper import get_template_matcher_helper
from datetime import datetime


class CoordinatePicker:
    """
    Coordinate Picker Window
    Displays large screenshot and allows coordinate picking with optional template matching
    """

    def __init__(self, screenshot, game_mode: str = 'd3', on_picks_updated: Optional[Callable] = None, parent=None, client_mode: Optional[str] = None, pick_history_ref: Optional[List] = None, on_refresh_screenshot: Optional[Callable[[], Tuple[Optional[Any], Optional[str]]]] = None):
        """Initialize coordinate picker window. client_mode: CLIENT_TYPE_BATTLENET / CLIENT_TYPE_D3_GAME / CLIENT_TYPE_D4_GAME. on_refresh_screenshot: () -> (screenshot, error_msg) to get latest screenshot by client type, same as open-time capture."""
        self.screenshot = screenshot
        self.game_mode = game_mode
        self.client_mode = client_mode if client_mode in (CLIENT_TYPE_BATTLENET, CLIENT_TYPE_D3_GAME, CLIENT_TYPE_D4_GAME) else CLIENT_TYPE_BATTLENET
        self.on_picks_updated = on_picks_updated
        self.on_refresh_screenshot = on_refresh_screenshot  # Same logic as panel _capture_for_client
        self.parent = parent
        self.picks: List[Dict] = []
        self.current_pick_type = 'point'
        self.pick_mode = True  # Always in picking mode
        self.temp_points: List[tuple] = []
        self.pick_history_ref = pick_history_ref  # Reference to main UI's pick history
        self.pick_labels: Dict[str, tk.Label] = {}  # Store label widgets for each pick by pick_id
        self.pick_label_entries: Dict[str, tk.Entry] = {}  # Store entry widgets for editing

        self.template_matcher = get_template_matcher_helper()
        self.scale_factor = None

        root = parent or get_app_root()
        self.window = tk.Toplevel(root) if root else tk.Tk()

        # Set window title with screenshot size info
        width, height = screenshot.size if screenshot else (0, 0)
        title = i18n_manager.get_ui_text("ui.coord_picker.window_title")
        self.window.title(f"{title} - {width}x{height}")

        self.window.geometry("1400x800")  # Picker window size; D3 outer = 1316x839 when client 1300x800
        self.window.resizable(True, True)
        self.window.configure(bg=UnifiedStyles.COLORS['bg_primary'])

        self._create_ui()
        self._setup_screenshot_display()
        self._update_history_display()  # Initial display of history

    def _create_ui(self):
        """Create UI components"""
        main_frame = tk.Frame(self.window, bg=UnifiedStyles.COLORS['bg_primary'])
        main_frame.pack(fill=tk.BOTH, expand=True)

        main_frame.grid_columnconfigure(0, weight=0, minsize=220)
        main_frame.grid_columnconfigure(1, weight=1)
        main_frame.grid_rowconfigure(0, weight=1)

        self._create_left_menu(main_frame)
        self._create_screenshot_canvas(main_frame)

    def _create_left_menu(self, parent):
        """Create left side menu panel (delegates to section builders)."""
        pad = UnifiedStyles.SPACING
        menu_frame = tk.Frame(
            parent,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            width=220,
            highlightbackground=UnifiedStyles.COLORS['panel_border'],
            highlightthickness=1,
        )
        menu_frame.grid(row=0, column=0, sticky="ns")
        menu_frame.grid_propagate(False)

        title = tk.Label(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.menu_title"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_secondary'],
            font=UnifiedStyles.FONTS['bold'],
            wraplength=200,
        )
        title.pack(padx=pad['md'], pady=pad['md'], fill=tk.X)
        ttk.Separator(menu_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=pad['sm'], pady=pad['xs'])

        self._create_pick_type_section(menu_frame)
        self._create_params_section(menu_frame)
        self._create_template_section(menu_frame)
        self._create_history_section(menu_frame)
        self._create_action_buttons(menu_frame)

    def _create_pick_type_section(self, menu_frame: tk.Frame):
        """Build pick type block: label + point/rect/circle buttons."""
        pad = UnifiedStyles.SPACING
        tk.Label(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.pick_mode_title"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_secondary'],
            font=UnifiedStyles.FONTS['label'],
        ).pack(padx=pad['sm'], pady=(pad['md'], pad['xs']), anchor=tk.W)

        self.pick_type_var = var_str(self.window, 'point')
        self.buttons = {}
        for pick_type, label_key in [
            ('point', 'ui.coord_picker.pick_type_point'),
            ('rect', 'ui.coord_picker.pick_type_rect'),
            ('circle', 'ui.coord_picker.pick_type_circle'),
        ]:
            btn = tk.Button(
                menu_frame,
                text=i18n_manager.get_ui_text(label_key),
                command=lambda pt=pick_type: self._set_pick_type(pt),
                bg=UnifiedStyles.COLORS['accent'] if pick_type == 'point' else UnifiedStyles.COLORS['bg_tertiary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                activebackground=UnifiedStyles.COLORS['accent_light'],
                activeforeground=UnifiedStyles.COLORS['text_primary'],
                font=UnifiedStyles.FONTS['label'],
                padx=pad['sm'],
                pady=pad['xs'],
                relief=tk.FLAT,
                cursor='hand2',
            )
            btn.pack(padx=pad['sm'], pady=pad['xs'], fill=tk.X)
            self.buttons[pick_type] = btn
        ttk.Separator(menu_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=pad['sm'], pady=pad['xs'])

    def _create_params_section(self, menu_frame: tk.Frame):
        """Build parameters block: width, height, radius spinboxes."""
        pad = UnifiedStyles.SPACING
        tk.Label(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.values_title"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_secondary'],
            font=UnifiedStyles.FONTS['label'],
        ).pack(padx=pad['sm'], pady=(pad['md'], pad['xs']), anchor=tk.W)

        for label_key, var_name, default, from_, to in [
            ('ui.coord_picker.width', 'width_var', 50, 10, 500),
            ('ui.coord_picker.height', 'height_var', 50, 10, 500),
            ('ui.coord_picker.radius', 'radius_var', 30, 5, 200),
        ]:
            row = tk.Frame(menu_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
            row.pack(padx=pad['sm'], pady=pad['xs'], fill=tk.X)
            tk.Label(
                row,
                text=i18n_manager.get_ui_text(label_key),
                bg=UnifiedStyles.COLORS['bg_secondary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                font=UnifiedStyles.FONTS['small'],
            ).pack(side=tk.LEFT, padx=(0, pad['xs']))
            v = var_int(self.window, default)
            setattr(self, var_name, v)
            tk.Spinbox(
                row,
                from_=from_,
                to=to,
                textvariable=v,
                width=6,
                bg=UnifiedStyles.COLORS['input_bg'],
                fg=UnifiedStyles.COLORS['input_text'],
                font=UnifiedStyles.FONTS['small'],
                highlightthickness=0,
            ).pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Separator(menu_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=pad['sm'], pady=pad['xs'])

    def _create_template_section(self, menu_frame: tk.Frame):
        """Build template matching block: title, Select Templates button. Client is fixed from panel."""
        pad = UnifiedStyles.SPACING
        tk.Label(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.template_matching_title"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_secondary'],
            font=UnifiedStyles.FONTS['bold'],
            wraplength=200,
        ).pack(padx=pad['sm'], pady=(pad['md'], pad['xs']), fill=tk.X)

        tk.Button(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.select_templates"),
            command=self._on_select_templates,
            bg=UnifiedStyles.COLORS['accent'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['accent_light'],
            activeforeground=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            padx=pad['sm'],
            pady=pad['xs'],
            relief=tk.FLAT,
            cursor='hand2',
        ).pack(padx=pad['sm'], pady=pad['xs'], fill=tk.X)
        ttk.Separator(menu_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=pad['sm'], pady=pad['xs'])

    def _create_history_section(self, menu_frame: tk.Frame):
        """Build history block: title + Treeview (ID, Type, Coords, Name)."""
        pad = UnifiedStyles.SPACING
        tk.Label(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.history_title"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_secondary'],
            font=UnifiedStyles.FONTS['bold'],
        ).pack(padx=pad['sm'], pady=(pad['md'], pad['xs']), anchor=tk.W)

        tree_frame = tk.Frame(
            menu_frame,
            bg=UnifiedStyles.COLORS['bg_tertiary'],
            highlightbackground=UnifiedStyles.COLORS['panel_border'],
            highlightthickness=1,
        )
        tree_frame.pack(padx=pad['sm'], pady=pad['xs'], fill=tk.BOTH, expand=True)
        tree_scrollbar = ttk.Scrollbar(tree_frame)
        tree_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        col_id = i18n_manager.get_ui_text("ui.coord_picker.history_col_id")
        col_type = i18n_manager.get_ui_text("ui.coord_picker.history_col_type")
        col_coords = i18n_manager.get_ui_text("ui.coord_picker.history_col_coords")
        col_name = i18n_manager.get_ui_text("ui.coord_picker.history_col_name") or "名称"
        self.history_tree = ttk.Treeview(
            tree_frame,
            columns=('ID', 'Type', 'Coords', 'Name'),
            height=8,
            yscrollcommand=tree_scrollbar.set,
            style='Treeview',
            show='headings'
        )
        tree_scrollbar.config(command=self.history_tree.yview)
        self.history_tree.column('ID', width=30, anchor=tk.CENTER)
        self.history_tree.column('Type', width=58, anchor=tk.CENTER)
        self.history_tree.column('Coords', width=100, anchor=tk.W)
        self.history_tree.column('Name', width=120, anchor=tk.W)
        self.history_tree.heading('ID', text=col_id)
        self.history_tree.heading('Type', text=col_type)
        self.history_tree.heading('Coords', text=col_coords)
        self.history_tree.heading('Name', text=col_name)
        self.history_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

    def _create_action_buttons(self, menu_frame: tk.Frame):
        """Build bottom action buttons: Refresh (if callback provided), Complete, Export, Close."""
        pad = UnifiedStyles.SPACING
        btn_frame = tk.Frame(menu_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        btn_frame.pack(padx=pad['sm'], pady=pad['md'], fill=tk.X, side=tk.BOTTOM)

        if self.on_refresh_screenshot is not None:
            refresh_btn = tk.Button(
                btn_frame,
                text=i18n_manager.get_ui_text("ui.coord_picker.refresh_screenshot") or "刷新",
                command=self._on_refresh_screenshot,
                bg=UnifiedStyles.COLORS['bg_tertiary'],
                fg=UnifiedStyles.COLORS['text_primary'],
                activebackground=UnifiedStyles.COLORS['accent'],
                activeforeground=UnifiedStyles.COLORS['text_primary'],
                font=UnifiedStyles.FONTS['button'],
                padx=pad['sm'],
                pady=pad['xs'],
                relief=tk.FLAT,
                cursor='hand2',
            )
            refresh_btn.pack(side=tk.LEFT, padx=(0, pad['xs']))

        complete_btn = tk.Button(
            btn_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.complete"),
            command=self._on_complete,
            bg=UnifiedStyles.COLORS['accent'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['accent_light'],
            activeforeground=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            padx=pad['sm'],
            pady=pad['xs'],
            relief=tk.FLAT,
            cursor='hand2',
        )
        complete_btn.pack(side=tk.LEFT, padx=(0, pad['xs']))

        export_btn = tk.Button(
            btn_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.export_coords") or "导出坐标",
            command=self._on_export_coords,
            bg=UnifiedStyles.COLORS['success'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['accent_green'] if 'accent_green' in UnifiedStyles.COLORS else UnifiedStyles.COLORS['success'],
            activeforeground=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            padx=pad['sm'],
            pady=pad['xs'],
            relief=tk.FLAT,
            cursor='hand2',
        )
        export_btn.pack(side=tk.LEFT, padx=(0, pad['xs']))

        close_btn = tk.Button(
            btn_frame,
            text=i18n_manager.get_ui_text("ui.coord_picker.close"),
            command=self._on_close,
            bg=UnifiedStyles.COLORS['bg_tertiary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            activebackground=UnifiedStyles.COLORS['accent'],
            activeforeground=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            padx=pad['sm'],
            pady=pad['xs'],
            relief=tk.FLAT,
            cursor='hand2',
        )
        close_btn.pack(side=tk.LEFT)

    def _create_screenshot_canvas(self, parent):
        """Create screenshot canvas with transparent overlay for drawing"""
        canvas_frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        canvas_frame.grid(row=0, column=1, sticky="nsew")

        # Main canvas for screenshot
        pad = UnifiedStyles.SPACING
        self.canvas = tk.Canvas(
            canvas_frame,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            highlightthickness=0,
            cursor='crosshair',
        )
        self.canvas.pack(fill=tk.BOTH, expand=True, padx=pad['sm'], pady=pad['sm'])

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
        # Redraw all labels
        self._redraw_all_labels()

    def _redraw_all_marks(self):
        """Redraw all pick marks on canvas after display update"""
        self.canvas_marks = []
        history = self.pick_history_ref if self.pick_history_ref is not None else self.picks
        for pick in history:
            pick_type = pick.get('type', 'point')
            if pick_type == 'point':
                self._draw_mark_at(pick.get('x', 0), pick.get('y', 0))
            elif pick_type == 'rect':
                self._draw_rect_mark(pick)
            elif pick_type == 'circle':
                self._draw_circle_mark(pick)
        # Draw temp first point for rect/circle when in progress
        if len(self.temp_points) == 1:
            self._draw_mark_at(self.temp_points[0][0], self.temp_points[0][1])
    
    def _redraw_all_labels(self):
        """Redraw all pick labels after canvas update"""
        # Clear existing label windows
        self.canvas.delete('pick_label')
        self.pick_labels.clear()
        
        history = self.pick_history_ref if self.pick_history_ref is not None else self.picks
        for pick in history:
            pick_id = pick.get('id')
            if not pick_id:
                continue
            
            pick_type = pick.get('type', 'point')
            name = pick.get('name', '')
            x, y = pick.get('x', 0), pick.get('y', 0)
            
            # Determine label position
            if pick_type == 'rect':
                label_x = x + pick.get('width', 0) // 2
                label_y = y + pick.get('height', 0) // 2
            elif pick_type == 'circle':
                label_x, label_y = x, y
            else:  # point
                label_x, label_y = x, y
            
            self._create_pick_label(pick_id, label_x, label_y, name)

    def _draw_mark_at(self, x: int, y: int):
        """Draw a mark at given original coordinates"""
        if self.scale_factor is None:
            return

        # Convert original coordinates to canvas coordinates
        canvas_x = int(x * self.scale_factor) + self.canvas_offset_x
        canvas_y = int(y * self.scale_factor) + self.canvas_offset_y

        mark_color = UnifiedStyles.COLORS.get('accent_green', UnifiedStyles.COLORS.get('accent', '#00d4ff'))
        marker_size = 8
        mark_id = self.canvas.create_oval(
            canvas_x - marker_size, canvas_y - marker_size,
            canvas_x + marker_size, canvas_y + marker_size,
            outline=mark_color,
            fill='',
            width=2,
            tags='pick_mark'
        )

        cross_size = 15
        h_line = self.canvas.create_line(
            canvas_x - cross_size, canvas_y,
            canvas_x + cross_size, canvas_y,
            fill=mark_color,
            width=2,
            tags='pick_mark'
        )
        v_line = self.canvas.create_line(
            canvas_x, canvas_y - cross_size,
            canvas_x, canvas_y + cross_size,
            fill=mark_color,
            width=2,
            tags='pick_mark'
        )

        self.canvas_marks.extend([mark_id, h_line, v_line])

    def _to_canvas(self, x: int, y: int):
        """Convert original image coords to canvas coords."""
        if self.scale_factor is None:
            return (0, 0)
        cx = int(x * self.scale_factor) + self.canvas_offset_x
        cy = int(y * self.scale_factor) + self.canvas_offset_y
        return (cx, cy)

    def _draw_rect_mark(self, pick: Dict):
        """Draw rectangle region on canvas overlay."""
        x, y = pick.get('x', 0), pick.get('y', 0)
        w, h = pick.get('width', 0), pick.get('height', 0)
        if w <= 0 or h <= 0:
            return
        c1 = self._to_canvas(x, y)
        c2 = self._to_canvas(x + w, y + h)
        rect_color = UnifiedStyles.COLORS.get('accent_green', UnifiedStyles.COLORS.get('accent', '#00d4ff'))
        mark_id = self.canvas.create_rectangle(
            c1[0], c1[1], c2[0], c2[1],
            outline=rect_color, fill='', width=2, tags='pick_mark'
        )
        self.canvas_marks.append(mark_id)

    def _draw_circle_mark(self, pick: Dict):
        """Draw circle region on canvas overlay."""
        cx, cy = pick.get('x', 0), pick.get('y', 0)
        r = pick.get('radius', 0)
        if r <= 0:
            return
        cc = self._to_canvas(cx, cy)
        sr = int(r * self.scale_factor)
        circle_color = UnifiedStyles.COLORS.get('accent_green', UnifiedStyles.COLORS.get('accent', '#00d4ff'))
        mark_id = self.canvas.create_oval(
            cc[0] - sr, cc[1] - sr, cc[0] + sr, cc[1] + sr,
            outline=circle_color, fill='', width=2, tags='pick_mark'
        )
        self.canvas_marks.append(mark_id)

    def _set_pick_type(self, pick_type: str):
        """Set current pick type"""
        self.current_pick_type = pick_type
        self.pick_type_var.set(pick_type)
        self.temp_points = []

        for ptype, btn in self.buttons.items():
            if ptype == pick_type:
                btn.configure(bg=UnifiedStyles.COLORS['accent'])
            else:
                btn.configure(bg=UnifiedStyles.COLORS['bg_tertiary'])

    # Note: _on_start_picking and _on_stop_picking removed - always in picking mode

    def _on_canvas_click(self, event):
        """Handle canvas click - always active since window is in constant picking mode"""
        # No need to check pick_mode - always active

        if self.scale_factor is None:
            return

        x = int((event.x - self.canvas_offset_x) / self.scale_factor)
        y = int((event.y - self.canvas_offset_y) / self.scale_factor)

        if x < 0 or y < 0 or x > self.original_screenshot.width or y > self.original_screenshot.height:
            return

        if self.current_pick_type == 'point':
            pick_id = f"pick_{len(self.picks)}"
            pick = {
                'type': 'point',
                'x': x,
                'y': y,
                'name': f"Point {len(self.picks) + 1}",
                'id': pick_id
            }
            self.picks.append(pick)

            # Immediately sync to main UI if callback provided
            if self.on_picks_updated:
                self.on_picks_updated([pick])

            self._draw_pick(x, y)
            self._create_pick_label(pick_id, x, y, pick['name'])
            self._update_history_display()  # Update list display
            ColorPrint.green(f"[COORD_PICKER] Pick added: {pick}")

        elif self.current_pick_type == 'rect':
            if len(self.temp_points) == 0:
                self.temp_points.append((x, y))
                self._draw_pick(x, y)
            elif len(self.temp_points) == 1:
                x1, y1 = self.temp_points[0]
                pick_id = f"pick_{len(self.picks)}"
                pick = {
                    'type': 'rect',
                    'x': min(x, x1),
                    'y': min(y, y1),
                    'width': abs(x - x1),
                    'height': abs(y - y1),
                    'name': f"Rect {len(self.picks) + 1}",
                    'id': pick_id
                }
                self.picks.append(pick)
                self.temp_points = []

                # Immediately sync to main UI
                if self.on_picks_updated:
                    self.on_picks_updated([pick])

                self._create_pick_label(pick_id, pick['x'] + pick['width'] // 2, pick['y'] + pick['height'] // 2, pick['name'])
                self._update_canvas_display()
                self._update_history_display()

        elif self.current_pick_type == 'circle':
            if len(self.temp_points) == 0:
                self.temp_points.append((x, y))
                self._draw_pick(x, y)
            elif len(self.temp_points) == 1:
                cx, cy = self.temp_points[0]
                radius = int(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5)
                pick_id = f"pick_{len(self.picks)}"
                pick = {
                    'type': 'circle',
                    'x': cx,
                    'y': cy,
                    'radius': radius,
                    'name': f"Circle {len(self.picks) + 1}",
                    'id': pick_id
                }
                self.picks.append(pick)
                self.temp_points = []

                # Immediately sync to main UI
                if self.on_picks_updated:
                    self.on_picks_updated([pick])

                self._create_pick_label(pick_id, cx, cy, pick['name'])
                self._update_canvas_display()
                self._update_history_display()

    def _on_canvas_motion(self, event):
        """Handle canvas motion"""
        if not self.pick_mode or self.scale_factor is None:
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

        for idx, pick in enumerate(history, 1):
            pick_type = pick.get('type', 'point')
            x, y = pick.get('x', 0), pick.get('y', 0)
            name = pick.get('name', f"{pick_type.capitalize()} {idx}")
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
            self.history_tree.insert(
                '', 'end', iid=f"item_{idx}",
                values=(idx, pick_type, coords, name)
            )

    def _on_complete(self):
        """Confirm and close (same as close; picks already synced in real-time)."""
        self.window.destroy()

    def _create_pick_label(self, pick_id: str, x: int, y: int, default_name: str):
        """Create an editable label at the pick location"""
        if self.scale_factor is None:
            return
        
        canvas_x = int(x * self.scale_factor) + self.canvas_offset_x
        canvas_y = int(y * self.scale_factor) + self.canvas_offset_y
        
        label_bg = UnifiedStyles.COLORS.get('accent', '#00d4ff')
        label_fg = UnifiedStyles.COLORS.get('text_dark', '#1a1a1a')
        label = tk.Label(
            self.canvas,
            text=default_name,
            bg=label_bg,
            fg=label_fg,
            font=UnifiedStyles.FONTS['small'],
            padx=UnifiedStyles.PADDING['xs'],
            pady=UnifiedStyles.PADDING['xs'],
            relief=tk.RAISED,
            borderwidth=1,
            highlightthickness=0,
        )
        
        # Place label near the pick point (offset to avoid covering the mark)
        label_x = canvas_x + 20
        label_y = canvas_y - 15
        
        # Create window on canvas
        label_id = self.canvas.create_window(label_x, label_y, window=label, anchor=tk.NW, tags='pick_label')
        self.pick_labels[pick_id] = label
        
        # Bind double-click to edit
        def on_label_double_click(event):
            self._edit_pick_label(pick_id, label_x, label_y)
        
        label.bind('<Double-Button-1>', on_label_double_click)
    
    def _edit_pick_label(self, pick_id: str, x: int, y: int):
        """Edit pick label name"""
        if pick_id not in self.pick_labels:
            return
        
        label = self.pick_labels[pick_id]
        current_name = label.cget('text')
        
        entry = tk.Entry(
            self.canvas,
            bg=UnifiedStyles.COLORS['input_bg'],
            fg=UnifiedStyles.COLORS['input_text'],
            font=UnifiedStyles.FONTS['small'],
            width=15,
            insertbackground=UnifiedStyles.COLORS['input_text'],
            highlightthickness=1,
            highlightbackground=UnifiedStyles.COLORS['input_border'],
        )
        entry.insert(0, current_name)
        entry.select_range(0, tk.END)
        entry.focus()
        
        # Replace label with entry
        entry_window = self.canvas.create_window(x, y, window=entry, anchor=tk.NW, tags='pick_label_edit')
        self.pick_label_entries[pick_id] = entry
        
        def on_entry_return(event):
            new_name = entry.get().strip()
            if not new_name:
                new_name = current_name
            
            # Update pick data
            for pick in self.picks:
                if pick.get('id') == pick_id:
                    pick['name'] = new_name
                    break
            
            # Update history ref if exists
            if self.pick_history_ref is not None:
                for pick in self.pick_history_ref:
                    if pick.get('id') == pick_id:
                        pick['name'] = new_name
                        break
            
            # Restore label with new name
            label.config(text=new_name)
            self.canvas.delete(entry_window)
            if pick_id in self.pick_label_entries:
                del self.pick_label_entries[pick_id]
            self._update_history_display()
        
        def on_entry_focus_out(event):
            on_entry_return(None)
        
        entry.bind('<Return>', on_entry_return)
        entry.bind('<FocusOut>', on_entry_focus_out)
    
    def _on_refresh_screenshot(self):
        """Get latest screenshot using same client-type logic as open; do not clear coordinate history."""
        if self.on_refresh_screenshot is None:
            return
        result = self.on_refresh_screenshot()
        if not result or len(result) != 2:
            return
        screenshot, err = result
        if err or screenshot is None:
            messagebox.showwarning(
                i18n_manager.get_ui_text("ui.coord_calibration.error_title") or "错误",
                err or i18n_manager.get_ui_text("ui.coord_calibration.no_game_window") or "No window"
            )
            return
        self.screenshot = screenshot
        self.original_screenshot = screenshot
        self.template_matcher.display_image = None
        self._update_canvas_display()
        width, height = screenshot.size if screenshot else (0, 0)
        self.window.title(f"{i18n_manager.get_ui_text('ui.coord_picker.window_title')} - {width}x{height}")
        ColorPrint.green("[COORD_PICKER] Screenshot refreshed, history unchanged")

    def _on_export_coords(self):
        """Export coordinates to txt file in temp directory"""
        history = self.pick_history_ref if self.pick_history_ref is not None else self.picks
        if not history:
            ColorPrint.yellow("[COORD_PICKER] No coordinates to export")
            return
        
        # Ensure temp directory exists
        TMP_DIR.mkdir(parents=True, exist_ok=True)
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"coords_{timestamp}.txt"
        filepath = TMP_DIR / filename
        
        # Write coordinates to file
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(f"坐标导出 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write("=" * 50 + "\n\n")
                for idx, pick in enumerate(history, 1):
                    pick_type = pick.get('type', 'point')
                    name = pick.get('name', f"{pick_type.capitalize()} {idx}")
                    x, y = pick.get('x', 0), pick.get('y', 0)
                    
                    if pick_type == 'point':
                        f.write(f"{idx}. {name}\n")
                        f.write(f"   类型: {pick_type}\n")
                        f.write(f"   坐标: ({x}, {y})\n")
                    elif pick_type == 'rect':
                        w, h = pick.get('width', 0), pick.get('height', 0)
                        f.write(f"{idx}. {name}\n")
                        f.write(f"   类型: {pick_type}\n")
                        f.write(f"   坐标: ({x}, {y})\n")
                        f.write(f"   尺寸: {w} × {h}\n")
                    elif pick_type == 'circle':
                        r = pick.get('radius', 0)
                        f.write(f"{idx}. {name}\n")
                        f.write(f"   类型: {pick_type}\n")
                        f.write(f"   中心: ({x}, {y})\n")
                        f.write(f"   半径: {r}\n")
                    f.write("\n")
            
            ColorPrint.green(f"[COORD_PICKER] Coordinates exported to {filepath}")
            messagebox.showinfo(
                i18n_manager.get_ui_text("ui.coord_picker.export_success_title") or "导出成功",
                f"{i18n_manager.get_ui_text('ui.coord_picker.export_success_msg') or '坐标已导出到'}\n{filepath}"
            )
        except Exception as e:
            ColorPrint.red(f"[COORD_PICKER] Export failed: {e}")
            messagebox.showerror(
                i18n_manager.get_ui_text("ui.coord_picker.export_error_title") or "导出失败",
                str(e)
            )
    
    def _on_close(self):
        """Close window - picks already synced in real-time."""
        self.window.destroy()

    def destroy(self):
        """Destroy the coordinate picker window (delegate to internal window)"""
        if self.window is not None:
            self.window.destroy()

    def _on_select_templates(self):
        """Open template selection dialog"""
        if not self.screenshot:
            ColorPrint.yellow("[COORD_PICKER] No screenshot to match templates on")
            return

        dialog = Toplevel(self.window)
        dialog.title(i18n_manager.get_ui_text("ui.coord_picker.select_templates"))
        dialog.geometry("450x600")
        dialog.resizable(True, True)

        templates_data = self.template_matcher.get_available_templates(self.client_mode)

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
            text=i18n_manager.get_ui_text("ui.coord_picker.select_templates") + ":",
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
                var = var_bool(dialog, False)
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
            var = var_bool(dialog, False)
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
                if self.template_matcher.match_templates(self.client_mode):
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
