#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bottom Bar Status Block: two rows (STATUS_ROW_1/2), no frame title. All value labels registered for fg updates.
Test mode row: one label only (no "label: value" pair).
"""

import tkinter as tk
from ..unified_styles import UnifiedStyles
from providor.i18n_manager import i18n_manager
from .status_item import make_status_item
from .status_row_config import STATUS_ROW_1, STATUS_ROW_2


def _build_row(parent, items, status_vars):
    row = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
    row.pack(fill=tk.X, padx=4, pady=2)
    labels = {}
    for label_key, var_key, fg_key in items:
        var = status_vars.get(var_key)
        if var is None:
            continue
        label_text = i18n_manager.get_ui_text(label_key)
        fg = UnifiedStyles.COLORS.get(fg_key) if isinstance(fg_key, str) else fg_key
        item_frame, value_label = make_status_item(row, label_text, var, fg)
        item_frame.pack(side=tk.LEFT)
        labels[var_key] = value_label
    return row, labels


def _build_row3_always(parent, status_vars, register_path_icons_cb, register_row3_right_extra_cb):
    """Row 3: always visible. Left = test_mode text; right = 4 path labels BN/D3/D4/ROS (fg by path) + extra container for scan button."""
    row = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
    row.pack(fill=tk.X, padx=4, pady=2)
    row.grid_columnconfigure(0, weight=1)
    row.grid_columnconfigure(1, weight=0)

    left_f = tk.Frame(row, bg=UnifiedStyles.COLORS['bg_secondary'])
    left_f.grid(row=0, column=0, sticky="w")
    var = status_vars.get("test_mode")
    if var is not None:
        tk.Label(
            left_f,
            textvariable=var,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['default'],
        ).pack(side=tk.LEFT)

    right_f = tk.Frame(row, bg=UnifiedStyles.COLORS['bg_secondary'])
    right_f.grid(row=0, column=1, sticky="e")
    path_icons = {}
    circle = "\u25CB"  # circle = no value; refresh_path_icons sets check when path configured
    for abbr in ("BN", "D3", "D4", "ROS"):
        lbl = tk.Label(
            right_f,
            text=f"{circle} {abbr}",
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_secondary'],
            font=UnifiedStyles.FONTS['default'],
        )
        lbl.pack(side=tk.LEFT, padx=(8, 0))
        path_icons[abbr] = lbl
    if register_path_icons_cb:
        register_path_icons_cb(path_icons)
    extra_f = tk.Frame(right_f, bg=UnifiedStyles.COLORS['bg_secondary'])
    extra_f.pack(side=tk.LEFT, padx=(12, 0))
    if register_row3_right_extra_cb:
        register_row3_right_extra_cb(extra_f)
    return row


class BottomBarStatusBlock:
    """Two fixed rows + row 3 always visible (test_mode left, BN/D3/D4/ROS + extra right). register_callback(value_labels)."""

    def __init__(self, parent, status_vars: dict, register_callback, register_path_icons_cb=None, register_row3_right_extra_cb=None):
        self.frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
        self.frame.grid_columnconfigure(0, weight=1)

        content = tk.Frame(self.frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        content.pack(fill=tk.X, padx=5, pady=2)

        _, labels1 = _build_row(content, STATUS_ROW_1, status_vars)
        _, labels2 = _build_row(content, STATUS_ROW_2, status_vars)
        self._test_mode_row = _build_row3_always(content, status_vars, register_path_icons_cb, register_row3_right_extra_cb)
        value_labels = {**labels1, **labels2}
        register_callback(value_labels)
