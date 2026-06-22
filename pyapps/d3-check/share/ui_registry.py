# -*- coding: utf-8 -*-
"""
UI Registry: central registry for main and popup UI.
Main UI is created once at startup and registered here; popups are registered on demand. Callers use get_ui / get_root / get_panel.
"""

from typing import Any, Optional, Dict

# Main UI instance (set by register_ui); panel table maintained by main UI via get_panel(key)
_ui: Optional[Any] = None
# Popup UI (created on demand; register_popup / get_popup / unregister_popup)
_popups: Dict[str, Any] = {}


def register_ui(ui_instance: Any) -> None:
    """Register the main UI. Panels are provided by main UI get_panel(key). Call once after UI creation, and again after language change rebuild."""
    global _ui
    _ui = ui_instance


def get_ui() -> Optional[Any]:
    """Return main UI instance (Diablo3MacroUI). None after exit."""
    return _ui


def get_root() -> Optional[Any]:
    """Return main window root (Tk). For popup parent, after(), etc. None if not started or after exit."""
    if _ui is None:
        return None
    return _ui.root


def get_panel(key: str) -> Optional[Any]:
    """
    Return panel by key, delegating to main UI get_panel(key). Use providor.constants.ui PANEL_KEY_*.
    For PANEL_KEY_ROSBOT, the panel may not have created internal widgets yet (_content_created=False)
    until the tab is switched or ensure_content has run; callers depending on panel internals should check
    panel._content_created or ensure ensure_content has completed.
    """
    return _ui.get_panel(key) if _ui else None


def register_popup(key: str, instance: Any) -> None:
    """Register popup UI. key: use providor.constants.ui POPUP_KEY_*."""
    global _popups
    _popups[key] = instance


def get_popup(key: str) -> Optional[Any]:
    """Return popup UI by key; None if not registered or closed."""
    return _popups.get(key)


def unregister_popup(key: str) -> None:
    """Unregister popup UI (call when closing)."""
    global _popups
    _popups.pop(key, None)
