#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Status Item - one label+value pair for status row.
Returns (frame, value_label) so caller can pack frame and optionally register value_label for fg updates.
"""

import tkinter as tk
from ..unified_styles import UnifiedStyles


def make_status_item(parent, label_text: str, var: tk.StringVar, fg=None):
    """
    Build one status item: "label_text: value".
    Returns (frame, value_label). value_label uses textvariable=var; use it for fg updates.
    """
    f = tk.Frame(parent, bg=UnifiedStyles.COLORS['bg_secondary'])
    tk.Label(
        f,
        text=label_text + ":",
        bg=UnifiedStyles.COLORS['bg_secondary'],
        fg=UnifiedStyles.COLORS['text_secondary'],
        font=UnifiedStyles.FONTS['default'],
    ).pack(side=tk.LEFT)
    value_label = tk.Label(
        f,
        textvariable=var,
        bg=UnifiedStyles.COLORS['bg_secondary'],
        fg=fg or UnifiedStyles.COLORS['text_primary'],
        font=UnifiedStyles.FONTS['default'],
    )
    value_label.pack(side=tk.LEFT, padx=(2, 8))
    return f, value_label
