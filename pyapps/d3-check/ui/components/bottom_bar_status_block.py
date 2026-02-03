#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bottom Bar Status Block: two rows, no frame title. All value labels registered for fg updates.
"""

import tkinter as tk
from ..unified_styles import UnifiedStyles
from d3utils.i18n_manager import I18nManager
from .status_item import make_status_item
from .status_row_config import STATUS_ROW_1, STATUS_ROW_2

i18n_manager = I18nManager()


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
    return labels


class BottomBarStatusBlock:
    """Two rows, no title. register_callback(value_labels: dict var_key -> Label)."""

    def __init__(self, parent, status_vars: dict, register_callback):
        self.frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
        self.frame.grid_columnconfigure(0, weight=1)

        content = tk.Frame(self.frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        content.pack(fill=tk.X, padx=5, pady=2)

        labels1 = _build_row(content, STATUS_ROW_1, status_vars)
        labels2 = _build_row(content, STATUS_ROW_2, status_vars)
        value_labels = {**labels1, **labels2}
        register_callback(value_labels)
