# -*- coding: utf-8 -*-
"""Build Qt stylesheet from UITheme/UnifiedStyles for d3-check PySide6 UI."""

from .theme.theme import UITheme
from .unified_styles import UnifiedStyles


def get_global_stylesheet() -> str:
    """Single QSS string for main window and common widgets (same colors as TK theme)."""
    C = UITheme.COLORS
    C2 = UnifiedStyles.COLORS
    bg_primary = C.get("bg_primary", "#1a1a2e")
    bg_secondary = C.get("bg_secondary", "#16213e")
    text_primary = C.get("text_primary", "#e0e0e0")
    text_secondary = C.get("text_secondary", "#00d4ff")
    btn_primary = C.get("btn_primary", "#4CAF50")
    btn_primary_hover = C.get("btn_primary_hover", "#45a049")
    btn_secondary = C.get("btn_secondary", "#f44336")
    border_primary = C.get("border_primary", "#00d4ff")
    tab_unselected_bg = C.get("tab_unselected_bg", "#4C566A")
    tab_unselected_fg = C.get("tab_unselected_fg", "#ECEFF4")
    tab_selected_bg = C.get("tab_selected_bg", "#16213e")
    tab_selected_fg = C.get("tab_selected_fg", "#e0e0e0")
    input_bg = C.get("input_bg", "#2a2a3e")

    return f"""
    QMainWindow, QWidget {{
        background-color: {bg_primary};
    }}
    QLabel {{
        color: {text_primary};
        font-size: 9px;
        font-family: Segoe UI, Arial;
    }}
    QPushButton {{
        background-color: {bg_secondary};
        color: {text_primary};
        border: 1px solid {border_primary};
        padding: 4px 8px;
        font-size: 9px;
        font-weight: bold;
    }}
    QPushButton:hover {{
        background-color: {btn_primary_hover};
    }}
    QPushButton#closeBtn {{
        background-color: {btn_secondary};
    }}
    QTabWidget::pane {{
        border: 0;
        background-color: {bg_primary};
        top: -1px;
    }}
    QTabBar::tab {{
        background-color: {tab_unselected_bg};
        color: {tab_unselected_fg};
        padding: 8px 12px;
        margin-right: 2px;
        font-size: 9px;
        font-weight: bold;
    }}
    QTabBar::tab:selected {{
        background-color: {tab_selected_bg};
        color: {tab_selected_fg};
    }}
    QTabBar::tab:hover:!selected {{
        background-color: #0f3460;
    }}
    QComboBox {{
        background-color: {input_bg};
        color: {text_primary};
        border: 1px solid {border_primary};
        padding: 2px 6px;
        font-size: 9px;
        min-width: 60px;
    }}
    """
