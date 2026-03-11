#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Auxiliary Functions Panel (TABLE2) - Unified Style Version
Contains auxiliary functions with unified styling
"""

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import sys
import os
from typing import Optional, Callable

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import CONFIG, get_config_value_safe, queue_config_save, DIABLO_III_WINDOW_TITLES
from providor.constants.common import BATTLE_NET_EXE_NAME
from providor.constants.d3 import DIABLO_III_EXE_NAME
import timers.timer_manager as timer_manager
from timers.one_shot_tasks import do_path_scan, do_ensure_d3_running_from_battlenet_no_rosbot

# Import unified styles
from ..unified_styles import UnifiedStyles

# Import widgets
from ..widgets import ThemedCombobox

# Import i18n manager (global singleton instance)
from providor.i18n_manager import i18n_manager
from ..utils.tk_variables import var_str
from ui.utils.config_binding import ConfigBinding
from share.game_interface_data import get_game_interface_data, get_scaled_bag_region, get_global_scale
from pycore.pyfoundations.third_party import get_third_package_PIL_Image, get_third_package_PIL_ImageTk, get_third_package_cv2, get_third_package_numpy
from d3utils.screenshot_provider import get_screenshot_provider
from d3utils.interface_manager import get_d3_interface_manager
from d3utils.collectors.bag_info_collector import get_bag_info_collector
from d3utils.collectors.collect_tools.bag_layout_detector import get_bag_layout_detector
from d3utils.debug_bag_hover import run_debug_bag_hover
from controller.ctl_func.blacksmith_handler import get_blacksmith_handler
from share.template_match_debug import (
    set_debug_ui_active,
    clear as debug_clear,
    pop_all,
    get_entries,
)
from ui.components.auxiliary_options_block import create_auxiliary_options_block

Image = get_third_package_PIL_Image()
ImageTk = get_third_package_PIL_ImageTk()
cv2 = get_third_package_cv2()
np = get_third_package_numpy()

class AuxiliaryFunctionsPanel:
    """
    Auxiliary Functions Panel for TABLE2
    Unified styling and layout
    """
    
    def __init__(self, parent):
        """Initialize auxiliary functions panel"""
        self.parent = parent
        self.vars = {}
        self._pad_cell = UnifiedStyles.SPACING['sm']

        # ttk styles: single source from UITheme.apply_to_root (no second configure here; see docs/ui2)
        
        # Create main container - tab main style (UnifiedStyles.TAB_PAD, reused by all tab panels)
        self.container = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_primary'])
        tab_pad = UnifiedStyles.TAB_PAD
        self.container.pack(fill=tk.BOTH, expand=True, padx=tab_pad, pady=tab_pad)
        
        # Two rows: row0=paths+buttons; row1=bag offset + auxiliary in one row (two columns).
        self.container.grid_columnconfigure(0, weight=1)
        self.container.grid_rowconfigure(0, weight=0)
        self.container.grid_rowconfigure(1, weight=1)
        
        self.create_content()

        # Note: Language change is handled by main UI, not individual panels

    def create_content(self):
        """Row0=paths+buttons only. Row1=bag offset + auxiliary in one row (two columns)."""
        self._create_row0()
        self._create_row1_bag_and_auxiliary()

    def _create_row0(self):
        """First row: path section (same layout as Rosbot extension, no ros-bot line) + right buttons."""
        row0 = tk.Frame(self.container, bg=UnifiedStyles.COLORS['bg_secondary'])
        tab_pad = UnifiedStyles.TAB_PAD
        row0.grid(row=0, column=0, sticky="ew", padx=0, pady=(0, tab_pad // 2))
        row0.grid_columnconfigure(0, weight=1)
        inner = tk.Frame(row0, bg=UnifiedStyles.COLORS['bg_secondary'])
        inner.pack(fill=tk.X, expand=True, padx=tab_pad, pady=tab_pad)
        inner.grid_columnconfigure(0, weight=1)

        path_frame = tk.Frame(inner, bg=UnifiedStyles.COLORS['bg_secondary'])
        path_frame.grid(row=0, column=0, sticky="ew")
        path_frame.grid_columnconfigure(1, weight=1)
        path_frame.grid_columnconfigure(3, weight=0)
        path_frame.grid_columnconfigure(4, weight=0)

        _btn_style = dict(
            bg=UnifiedStyles.COLORS['btn_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['button'],
            padx=UnifiedStyles.PADDING['sm'],
            pady=UnifiedStyles.PADDING['xs'],
        )
        _btn_width_scan_start = 8   # One-click scan and Start D3 use smaller width to leave more space for path
        _btn_width_side = 10

        # Battle.net path (same UI as Rosbot: label, entry, browse) — left path area gets priority width
        bn_lbl = tk.Label(path_frame, text=BATTLE_NET_EXE_NAME + ":",
                          bg=UnifiedStyles.COLORS['bg_secondary'], fg=UnifiedStyles.COLORS['text_primary'],
                          font=UnifiedStyles.FONTS['label'])
        bn_lbl.grid(row=0, column=0, sticky="w", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
        ConfigBinding.create_input_binding(
            path_frame, "battlenet.battlenet_path", default_value="", width=58,
            bg=UnifiedStyles.COLORS['input_bg'], fg=UnifiedStyles.COLORS['input_text'],
            font=UnifiedStyles.FONTS['input']
        ).grid(row=0, column=1, sticky="ew", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
        tk.Button(path_frame, text=i18n_manager.get_ui_text("rosbot.browse"),
                 bg=UnifiedStyles.COLORS['btn_secondary'], fg=UnifiedStyles.COLORS['text_primary'],
                 font=UnifiedStyles.FONTS['button'],
                 command=self._browse_battlenet_path
                 ).grid(row=0, column=2, padx=(0, UnifiedStyles.SPACING['sm']), pady=UnifiedStyles.SPACING['xs'])

        # D3 path (same UI as Rosbot: label, entry, browse)
        d3_lbl = tk.Label(path_frame, text=DIABLO_III_EXE_NAME + ":",
                         bg=UnifiedStyles.COLORS['bg_secondary'], fg=UnifiedStyles.COLORS['text_primary'],
                         font=UnifiedStyles.FONTS['label'])
        d3_lbl.grid(row=1, column=0, sticky="w", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
        ConfigBinding.create_input_binding(
            path_frame, "d3.d3_path", default_value="", width=58,
            bg=UnifiedStyles.COLORS['input_bg'], fg=UnifiedStyles.COLORS['input_text'],
            font=UnifiedStyles.FONTS['input']
        ).grid(row=1, column=1, sticky="ew", padx=UnifiedStyles.SPACING['sm'], pady=UnifiedStyles.SPACING['xs'])
        tk.Button(path_frame, text=i18n_manager.get_ui_text("rosbot.browse"),
                 bg=UnifiedStyles.COLORS['btn_secondary'], fg=UnifiedStyles.COLORS['text_primary'],
                 font=UnifiedStyles.FONTS['button'],
                 command=self._browse_d3_path
                 ).grid(row=1, column=2, padx=(0, UnifiedStyles.SPACING['sm']), pady=UnifiedStyles.SPACING['xs'])

        # Start D3 button: smaller width to leave more space for path
        self._start_d3_btn = tk.Button(
            path_frame,
            text=i18n_manager.get_ui_text("button_area.start_d3"),
            width=_btn_width_scan_start,
            cursor='hand2',
            command=lambda: timer_manager.submit_one_shot(do_ensure_d3_running_from_battlenet_no_rosbot),
            **_btn_style,
        )
        self._start_d3_btn.grid(
            row=1,
            column=3,
            sticky="ew",
            padx=(UnifiedStyles.SPACING['sm'], 0),
            pady=UnifiedStyles.SPACING['xs'],
        )

        # One-click scan + start D3: one column two rows (stacked vertically)
        self._scan_status = [None]
        self._scan_in_progress = False
        self._scan_progress_after_id = None
        self._aux_scan_btn = tk.Button(path_frame, text=i18n_manager.get_ui_text("rosbot.scan_one_click"),
                                       width=_btn_width_scan_start,
                                       **_btn_style,
                                       command=self._run_aux_scan)
        self._aux_scan_btn.grid(
            row=0,
            column=3,
            sticky="ew",
            padx=(UnifiedStyles.SPACING['sm'], 0),
            pady=UnifiedStyles.SPACING['xs'],
        )

        right_btns = tk.Frame(inner, bg=UnifiedStyles.COLORS['bg_secondary'])
        right_btns.grid(row=0, column=1, sticky="nw", padx=(UnifiedStyles.SPACING['lg'], 0), pady=0)
        open_bag_btn = tk.Button(right_btns, text=i18n_manager.get_ui_text("ui.auxiliary_panel.open_bag_adjust"),
                                 width=_btn_width_side, command=self._open_bag_adjust_window, **_btn_style)
        open_bag_btn.pack(anchor="w", pady=(0, UnifiedStyles.SPACING['xs']))
        debug_btn = tk.Button(right_btns, text=i18n_manager.get_ui_text("ui.auxiliary_panel.other_image_lookup_debug"),
                              width=_btn_width_side, command=self._open_template_match_debug_window, **_btn_style)
        debug_btn.pack(anchor="w")

    def _create_row1_bag_and_auxiliary(self):
        """Second row: shared auxiliary options block (bag offset + automation) + debug row below."""
        row1 = tk.Frame(self.container, bg=UnifiedStyles.COLORS["bg_primary"])
        row1.grid(row=1, column=0, sticky="nsew", padx=0, pady=0)
        row1.grid_columnconfigure(0, weight=1)
        row1.grid_rowconfigure(0, weight=1)

        tab_pad = UnifiedStyles.TAB_PAD
        block = tk.Frame(row1, bg=UnifiedStyles.COLORS["bg_secondary"])
        block.grid(row=0, column=0, sticky="nsew", padx=tab_pad, pady=tab_pad)
        block.pack_propagate(False)
        wrapper = tk.Frame(block, bg=UnifiedStyles.COLORS["bg_secondary"])
        wrapper.pack(fill=tk.BOTH, expand=True)
        create_auxiliary_options_block(wrapper)
    def _browse_battlenet_path(self):
        current = (ConfigBinding.get_config_value("battlenet.battlenet_path") or "").strip()
        initialdir = os.path.dirname(current) if current and os.path.exists(current) else None
        filetypes = [(i18n_manager.get_ui_text("rosbot.executable_files"), "*.exe"), (i18n_manager.get_ui_text("rosbot.all_files"), "*.*")]
        kwargs = {"title": i18n_manager.get_ui_text("rosbot.select_battlenet_executable"), "filetypes": filetypes}
        if initialdir:
            kwargs["initialdir"] = initialdir
        filename = filedialog.askopenfilename(**kwargs)
        if filename:
            ConfigBinding.set_config_value("battlenet.battlenet_path", filename)

    def _browse_d3_path(self):
        current = (ConfigBinding.get_config_value("d3.d3_path") or "").strip()
        initialdir = os.path.dirname(current) if current and os.path.exists(current) else None
        filetypes = [(i18n_manager.get_ui_text("rosbot.executable_files"), "*.exe"), (i18n_manager.get_ui_text("rosbot.all_files"), "*.*")]
        kwargs = {"title": i18n_manager.get_ui_text("rosbot.select_d3_executable"), "filetypes": filetypes}
        if initialdir:
            kwargs["initialdir"] = initialdir
        filename = filedialog.askopenfilename(**kwargs)
        if filename:
            ConfigBinding.set_config_value("d3.d3_path", filename)

    def _run_aux_scan(self):
        """One-click scan for Battle.net and D3 only (no ROSBOT). Same progress behavior as Rosbot panel."""
        self._scan_in_progress = True
        self._scan_status[0] = None
        self._aux_scan_btn.config(state=tk.DISABLED, text=i18n_manager.get_ui_text("rosbot.scan_searching"))
        self._scan_progress_tick()
        timer_manager.submit_one_shot(lambda: do_path_scan(self, include_rosbot=False))

    def _scan_progress_tick(self):
        """Update scan progress (main thread every 200ms). Same as Rosbot panel; no progress label in auxiliary."""
        if not self._scan_in_progress:
            return
        self._scan_progress_after_id = self.container.after(200, self._scan_progress_tick)

    def _apply_scan_results(self, battlenet_path, rosbot_dirs, d3_path=None, error_msg=None):
        """Apply scan results: only set Battle.net and D3 when current path is missing or invalid (auxiliary panel, no ROSBOT)."""
        self._scan_in_progress = False
        if self._scan_progress_after_id is not None:
            self.container.after_cancel(self._scan_progress_after_id)
        self._scan_progress_after_id = None
        self._aux_scan_btn.config(state=tk.NORMAL, text=i18n_manager.get_ui_text("rosbot.scan_one_click"))
        if error_msg:
            messagebox.showerror(i18n_manager.get_ui_text("rosbot.error"), error_msg)
            return
        cur_bn = (get_config_value_safe("battlenet.battlenet_path") or "").strip()
        cur_d3 = (get_config_value_safe("d3.d3_path") or "").strip()
        bn_valid = cur_bn and os.path.isfile(cur_bn) and os.path.basename(cur_bn) == BATTLE_NET_EXE_NAME
        d3_valid = cur_d3 and os.path.isfile(cur_d3) and os.path.basename(cur_d3) == DIABLO_III_EXE_NAME
        if battlenet_path and not bn_valid:
            ConfigBinding.set_config_value("battlenet.battlenet_path", battlenet_path)
        if d3_path and not d3_valid:
            ConfigBinding.set_config_value("d3.d3_path", d3_path)
        if not battlenet_path and not d3_path:
            messagebox.showinfo(
                i18n_manager.get_ui_text("rosbot.scan_done"),
                i18n_manager.get_ui_text("rosbot.scan_not_found_battlenet") + "\n"
                + i18n_manager.get_ui_text("rosbot.scan_not_found_d3"),
            )

    def _open_bag_adjust_window(self):
        """Popup: menu, bag info (layout/offset/quality), big image (annotated), small image (bag_layout)."""
        win = tk.Toplevel(self.parent)
        win.title(i18n_manager.get_ui_text("ui.auxiliary_panel.bag_adjust_window_title"))
        win.configure(bg=UnifiedStyles.COLORS['bg_primary'])
        win.geometry("1000x720")

        content = tk.Frame(win, bg=UnifiedStyles.COLORS['bg_primary'])
        content.pack(fill=tk.BOTH, expand=True, padx=UnifiedStyles.SPACING['md'], pady=UnifiedStyles.SPACING['md'])

        _saved_scale = float(ConfigBinding.get_config_value("ui_analysis.bag_adjust_zoom_scale", 1.0))
        _saved_scale = max(0.25, min(3.0, _saved_scale))

        # ----- Menu area -----
        menu_frame = tk.Frame(content, bg=UnifiedStyles.COLORS['bg_primary'])
        menu_frame.pack(fill=tk.X, pady=(0, UnifiedStyles.SPACING['sm']))
        refresh_btn = ttk.Button(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.auxiliary_panel.refresh_bag_preview"),
            command=lambda: _refresh(info_text, img_label, small_img_label, win)
        )
        refresh_btn.pack(side=tk.LEFT)
        zoom_out_btn = ttk.Button(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.auxiliary_panel.zoom_out"),
            command=lambda: _zoom(win, img_label, -1)
        )
        zoom_out_btn.pack(side=tk.LEFT, padx=(UnifiedStyles.SPACING['sm'], 0))
        zoom_in_btn = ttk.Button(
            menu_frame,
            text=i18n_manager.get_ui_text("ui.auxiliary_panel.zoom_in"),
            command=lambda: _zoom(win, img_label, 1)
        )
        zoom_in_btn.pack(side=tk.LEFT, padx=(UnifiedStyles.SPACING['xs'], 0))
        zoom_label = tk.Label(
            menu_frame,
            text="%d%%" % round(_saved_scale * 100),
            bg=UnifiedStyles.COLORS['bg_primary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['label'],
        )
        zoom_label.pack(side=tk.LEFT, padx=(UnifiedStyles.SPACING['sm'], 0))
        win._bag_zoom_label = zoom_label

        # ----- Main: info area (left) + image area (right) -----
        main_frame = tk.Frame(content, bg=UnifiedStyles.COLORS['bg_primary'])
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Info area: scrollable text
        info_frame = tk.LabelFrame(
            main_frame,
            text=i18n_manager.get_ui_text("ui.auxiliary_panel.bag_adjust_info_title"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['subheading'],
        )
        info_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=False, padx=(0, UnifiedStyles.SPACING['sm']))
        info_inner = tk.Frame(info_frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        info_inner.pack(fill=tk.BOTH, expand=True)
        scroll = tk.Scrollbar(info_inner)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)
        info_text = tk.Text(
            info_inner,
            wrap=tk.WORD,
            width=38,
            height=24,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['small'],
            insertbackground=UnifiedStyles.COLORS['text_primary'],
            relief=tk.FLAT,
            yscrollcommand=scroll.set,
        )
        info_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scroll.config(command=info_text.yview)

        # Right: big image (top) + small image (bottom, bag_layout visualization)
        right_col = tk.Frame(main_frame, bg=UnifiedStyles.COLORS['bg_primary'])
        right_col.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        big_img_frame = tk.LabelFrame(
            right_col,
            text=i18n_manager.get_ui_text("ui.auxiliary_panel.bag_adjust_image_title"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['subheading'],
        )
        big_img_frame.pack(fill=tk.BOTH, expand=True)
        img_label = tk.Label(
            big_img_frame,
            text="",
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['label'],
        )
        img_label.pack(fill=tk.BOTH, expand=True)

        small_img_frame = tk.LabelFrame(
            right_col,
            text=i18n_manager.get_ui_text("ui.auxiliary_panel.bag_adjust_small_image_title"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['subheading'],
        )
        small_img_frame.pack(fill=tk.X, pady=(UnifiedStyles.SPACING['sm'], 0))
        small_img_label = tk.Label(
            small_img_frame,
            text="",
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_muted'],
            font=UnifiedStyles.FONTS['small'],
        )
        small_img_label.pack(fill=tk.X, pady=2)

        win._bag_pil_original = None
        win._bag_zoom_scale = _saved_scale
        win._bag_base_width = 520
        win._bag_small_photo = None

        def _update_zoom_label(w):
            lbl = w._bag_zoom_label
            if lbl is not None and lbl.winfo_exists():
                lbl.configure(text="%d%%" % round(w._bag_zoom_scale * 100))

        def _apply_zoom(w, img_widget):
            if w._bag_pil_original is None:
                return
            pil = w._bag_pil_original
            base = w._bag_base_width
            scale = w._bag_zoom_scale
            new_w = max(50, min(2000, int(base * scale)))
            ratio = new_w / pil.width
            new_h = int(pil.height * ratio)
            resized = pil.resize((new_w, new_h), Image.Resampling.LANCZOS)
            photo = ImageTk.PhotoImage(resized)
            w._bag_photo = photo
            img_widget.configure(image=photo, text="")
            _update_zoom_label(w)

        def _zoom(w, img_widget, direction):
            if w._bag_pil_original is None:
                return
            scale = w._bag_zoom_scale
            if direction > 0:
                w._bag_zoom_scale = min(3.0, scale * 1.25)
            else:
                w._bag_zoom_scale = max(0.25, scale / 1.25)
            ConfigBinding.set_config_value("ui_analysis.bag_adjust_zoom_scale", w._bag_zoom_scale)
            _apply_zoom(w, img_widget)

        def _refresh(info_widget, img_widget, small_img_widget, w):
            no_img_msg = i18n_manager.get_ui_text("ui.auxiliary_panel.no_game_window_image")
            no_data_msg = i18n_manager.get_ui_text("d4_panel.exp_farming.debug_window.d3_bag_no_data")
            get_d3_interface_manager().collect_bag_info_quik(force_new_capture=True, save_screenshot=False)
            game_data = get_game_interface_data()
            img = game_data.game_window_image
            coords = game_data.bag_coordinates
            layout = game_data.bag_layout

            layout_result = None
            layout_result_detector = None
            if img is not None and coords is not None:
                top_left = coords.top_left
                bottom_right = coords.bottom_right
                if len(top_left) >= 2 and len(bottom_right) >= 2:
                    left, top = top_left[0], top_left[1]
                    right, bottom = bottom_right[0], bottom_right[1]
                    cropped = np.array(img)
                    if cropped.ndim == 3 and cropped.shape[2] == 3:
                        bag_region_bgr = cv2.cvtColor(cropped, cv2.COLOR_RGB2BGR)[top:bottom, left:right]
                    else:
                        bag_region_bgr = cropped[top:bottom, left:right]
                    bag_coords_dict = {"top_left": coords.top_left, "bottom_right": coords.bottom_right, "rows": coords.rows, "cols": coords.cols}
                    detector = get_bag_layout_detector()
                    layout_result = detector.detect_layout(bag_region_bgr, bag_coords_dict)
                    layout_result_detector = detector

            info_widget.delete("1.0", tk.END)
            if coords is None and layout is None and layout_result is None:
                info_widget.insert(tk.END, no_data_msg)
            else:
                lines = []
                scale_x, scale_y = get_global_scale()
                bag_offset = CONFIG.get("ui_analysis", {}).get("bag_offset", {}) or CONFIG.get("system_settings", {}).get("bag_offset", {})
                oL, oR = bag_offset.get("left", 0), bag_offset.get("right", 0)
                oT, oB = bag_offset.get("top", 0), bag_offset.get("bottom", 0)
                lines.append(f"Offset: L={int(oL*scale_x)} R={int(oR*scale_x)} T={int(oT*scale_y)} B={int(oB*scale_y)} px")
                lines.append(f"Scale: {scale_x:.2f} x {scale_y:.2f}")
                lines.append("")
                if coords is not None:
                    lines.append(f"Grid: {coords.rows}x{coords.cols} ({coords.total_slots} slots)")
                    lines.append(f"TopLeft: {coords.top_left}  BottomRight: {coords.bottom_right}")
                    lines.append(f"Size: {coords.width}x{coords.height}")
                layout_grid = (layout_result or {}).get("layout") or (layout.layout if layout else None)
                if layout_grid and len(layout_grid) > 0 and len(layout_grid[0]) > 0:
                    rows, cols = len(layout_grid), len(layout_grid[0])
                    empty_c = sum(1 for r in range(rows) for c in range(cols) if layout_grid[r][c] == "empty")
                    c1 = sum(1 for r in range(rows) for c in range(cols) if layout_grid[r][c] == "item_1slot")
                    c2 = sum(1 for r in range(rows) for c in range(cols) if layout_grid[r][c] == "item_2slot_top")
                    lines.append(f"Empty: {empty_c}  |  1-slot: {c1}  |  2-slot: {c2}")
                items_src = (layout.items if layout else None) or (layout_result and layout_result.get("items"))
                if items_src:
                    occupied = sum(1 for v in items_src.values() if v.get("type") != "empty")
                    lines.append(f"Occupied: {occupied}" + (f" / {coords.total_slots}" if coords else ""))
                    quality_count = {'legendary_set': 0, 'legendary': 0, 'rare': 0, 'magic': 0, 'unknown': 0, 'empty': 0, 'see_top': 0}
                    for v in items_src.values():
                        q = v.get('quality', 'unknown')
                        quality_count[q] = quality_count.get(q, 0) + 1
                    lines.append("")
                    lines.append("Quality: L_set L R M Unknown Empty see_top")
                    lines.append(f"  {quality_count.get('legendary_set', 0)}  {quality_count.get('legendary', 0)}  {quality_count.get('rare', 0)}  {quality_count.get('magic', 0)}  {quality_count.get('unknown', 0)}  {quality_count.get('empty', 0)}  {quality_count.get('see_top', 0)}")
                    lines.append("")
                    for (r, c), info in sorted(items_src.items()):
                        if info.get("type") != "empty":
                            lines.append(f"  ({r},{c}) {info.get('type', '?')}  {info.get('quality', '?')}")
                else:
                    lines.append("Layout: no item detail")
                info_widget.insert(tk.END, "\n".join(lines))
            info_widget.see("1.0")

            if img is None:
                img_widget.configure(image="", text=no_img_msg)
                w._bag_photo = None
                w._bag_pil_original = None
            else:
                screenshot_bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
                detection_success = coords is not None
                collector = get_bag_info_collector()
                pil_annotated = collector.get_annotated_detection_image(screenshot_bgr, detection_success)
                if pil_annotated is None:
                    img_widget.configure(image="", text=no_img_msg)
                    w._bag_photo = None
                    w._bag_pil_original = None
                else:
                    w._bag_pil_original = pil_annotated
                    w._bag_base_width = min(520, pil_annotated.width)
                    w._bag_zoom_scale = max(0.25, min(3.0, float(ConfigBinding.get_config_value("ui_analysis.bag_adjust_zoom_scale", 1.0))))
                    _apply_zoom(w, img_widget)

            small_img_widget.configure(image="", text="")
            w._bag_small_photo = None
            if layout_result is not None and layout_result_detector is not None:
                vis_bgr = layout_result_detector.build_visualization_image(layout_result)
                if vis_bgr is not None:
                    vis_rgb = cv2.cvtColor(vis_bgr, cv2.COLOR_BGR2RGB)
                    pil_small = Image.fromarray(vis_rgb)
                    max_w = 480
                    if pil_small.width > max_w:
                        ratio = max_w / pil_small.width
                        pil_small = pil_small.resize((max_w, int(pil_small.height * ratio)), Image.Resampling.LANCZOS)
                    w._bag_small_photo = ImageTk.PhotoImage(pil_small)
                    small_img_widget.configure(image=w._bag_small_photo, text="")

        _refresh(info_text, img_label, small_img_label, win)

    def _open_template_match_debug_window(self):
        """Open template-match debug UI: left=log+list, right=match image, in-memory, queue-driven."""
        win = tk.Toplevel(self.parent)
        win.title(i18n_manager.get_ui_text("ui.auxiliary_panel.template_match_debug_title"))
        win.configure(bg=UnifiedStyles.COLORS['bg_primary'])
        win.geometry("960x560")
        set_debug_ui_active(True)

        main = tk.Frame(win, bg=UnifiedStyles.COLORS['bg_primary'])
        main.pack(fill=tk.BOTH, expand=True, padx=UnifiedStyles.SPACING['md'], pady=UnifiedStyles.SPACING['md'])

        left_frame = tk.Frame(main, bg=UnifiedStyles.COLORS['bg_secondary'])
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=False, padx=(0, UnifiedStyles.SPACING['sm']))

        log_lf = tk.LabelFrame(
            left_frame,
            text=i18n_manager.get_ui_text("ui.auxiliary_panel.debug_log"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['subheading'],
        )
        log_lf.pack(fill=tk.X, pady=(0, UnifiedStyles.SPACING['xs']))
        log_scroll = tk.Scrollbar(log_lf)
        log_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        log_text = tk.Text(
            log_lf,
            wrap=tk.WORD,
            width=42,
            height=10,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['small'],
            yscrollcommand=log_scroll.set,
        )
        log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        log_scroll.config(command=log_text.yview)

        list_lf = tk.LabelFrame(
            left_frame,
            text=i18n_manager.get_ui_text("ui.auxiliary_panel.debug_list"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['subheading'],
        )
        list_lf.pack(fill=tk.BOTH, expand=True)
        list_scroll = tk.Scrollbar(list_lf)
        list_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        listbox = tk.Listbox(
            list_lf,
            width=42,
            height=12,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['small'],
            selectmode=tk.SINGLE,
            yscrollcommand=list_scroll.set,
        )
        listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        list_scroll.config(command=listbox.yview)

        right_frame = tk.LabelFrame(
            main,
            text=i18n_manager.get_ui_text("ui.auxiliary_panel.debug_match_image"),
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['subheading'],
        )
        right_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        img_label = tk.Label(
            right_frame,
            text="",
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
        )
        img_label.pack(fill=tk.BOTH, expand=True)

        entries_ref = []

        def _show_image_at_index(idx):
            if idx < 0 or idx >= len(entries_ref):
                img_label.configure(image="", text="")
                win._debug_photo = None
                return
            entry = entries_ref[idx]
            img = entry.get("image")
            if img is None:
                img_label.configure(image="", text=entry.get("log", "")[:80])
                win._debug_photo = None
                return
            w, h = img.size
            max_w, max_h = 480, 360
            if w > max_w or h > max_h:
                r = min(max_w / w, max_h / h)
                w, h = int(w * r), int(h * r)
                img = img.resize((w, h), Image.Resampling.LANCZOS)
            photo = ImageTk.PhotoImage(img)
            win._debug_photo = photo
            img_label.configure(image=photo, text="")

        def _on_list_select(evt):
            sel = listbox.curselection()
            if sel:
                _show_image_at_index(sel[0])

        listbox.bind("<<ListboxSelect>>", _on_list_select)

        def _poll():
            if not win.winfo_exists():
                return
            items = pop_all()
            for it in items:
                entries_ref.append(it)
                log_text.insert(tk.END, it.get("title", "") + ": " + it.get("log", "") + "\n")
                log_text.see(tk.END)
                listbox.insert(tk.END, it.get("title", "") + " | " + (it.get("log", "")[:40] or ""))
            if items:
                listbox.selection_clear(0, tk.END)
                listbox.selection_set(tk.END)
                listbox.see(tk.END)
                _show_image_at_index(len(entries_ref) - 1)
            win.after(300, _poll)

        def _on_close():
            set_debug_ui_active(False)
            debug_clear()
            win.destroy()

        win.protocol("WM_DELETE_WINDOW", _on_close)
        win.after(200, _poll)

    # Note: Removed _test_bag_offset method as requested by user
    # Note: Removed _start_automation and _stop_automation methods - replaced with hotkey control

# Language change is now handled by main UI - no individual panel methods needed
