#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Menu Bar Component
Application menu bar with language selection
"""

import tkinter as tk
from typing import Optional, Callable
from d3utils.i18n_manager import I18nManager
i18n_manager = I18nManager()

class MenuBar:
    """Menu bar component with language selection"""

    def __init__(self, root: tk.Tk, on_language_change: Optional[Callable] = None):
        """
        Create menu bar component

        Args:
            root: Root Tk window
            on_language_change: Callback for language change
        """
        self.root = root
        self.on_language_change = on_language_change

        # Create menu bar
        self.menubar = tk.Menu(root)
        root.config(menu=self.menubar)

        self._create_menus()

    def _create_menus(self):
        """Create menu items"""
        # Language menu
        self.language_menu = tk.Menu(self.menubar, tearoff=0)
        self.menubar.add_cascade(
            label=i18n_manager.get_ui_text("main_window.menu.language"),
            menu=self.language_menu
        )

        # Add language options
        language_names = i18n_manager.get_language_names()
        for lang_code, lang_name in language_names.items():
            self.language_menu.add_command(
                label=lang_name,
                command=lambda l=lang_code: self._switch_language(l)
            )

    def _switch_language(self, language: str):
        """
        Switch application language

        Args:
            language: Language code to switch to
        """
        try:
            i18n_manager.set_language(language)
            if self.on_language_change:
                self.on_language_change(language)
        except Exception as e:
            import sys
            import os

            from providor.common_imports import ColorPrint
            ColorPrint.red(f"[MenuBar] Failed to switch language: {e}")

    def update_labels(self):
        """Update menu labels after language change"""
        # Recreate menus with new language
        self.menubar.delete(0, tk.END)
        self._create_menus()
