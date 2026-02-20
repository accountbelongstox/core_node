#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bottom Bar Status Block: two rows (STATUS_ROW_1/2), no frame title. All value labels registered for fg updates.
Test mode row: one label only (no "label: value" pair).
"""

import tkinter as tk
from ..unified_styles import UnifiedStyles
from d3utils.i18n_manager import i18n_manager
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


def _build_test_mode_row(parent, status_vars):
    """One label only: one Label with textvariable=test_mode, no prefix. Do not use make_status_item."""
    row = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
    row.pack(fill=tk.X, padx=4, pady=2)
    var = status_vars.get("test_mode")
    if var is not None:
        lbl = tk.Label(
            row,
            textvariable=var,
            bg=UnifiedStyles.COLORS['bg_secondary'],
            fg=UnifiedStyles.COLORS['text_primary'],
            font=UnifiedStyles.FONTS['default'],
        )
        lbl.pack(side=tk.LEFT)
    return row


class BottomBarStatusBlock:
    """Two fixed rows + one optional test-mode row (single label). register_callback(value_labels). Test row shown only when value set."""

    def __init__(self, parent, status_vars: dict, register_callback):
        self.frame = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
        self.frame.grid_columnconfigure(0, weight=1)

        content = tk.Frame(self.frame, bg=UnifiedStyles.COLORS['bg_secondary'])
        content.pack(fill=tk.X, padx=5, pady=2)

        _, labels1 = _build_row(content, STATUS_ROW_1, status_vars)
        _, labels2 = _build_row(content, STATUS_ROW_2, status_vars)
        self._test_mode_row = _build_test_mode_row(content, status_vars)
        self._test_mode_row.pack_forget()
        value_labels = {**labels1, **labels2}
        register_callback(value_labels)
