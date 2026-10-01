#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Hotkey Listener
Provides system-wide hotkey monitoring with priority and conflict takeover
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Callable, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.third_party.api import get_third_package_keyboard

# Errors the keyboard package raises for invalid hotkeys or missing OS hooks.
KEYBOARD_ERRORS = (ValueError, KeyError, ImportError, OSError)


class HotkeyType(Enum):
    """Hotkey types"""
    KEYBOARD = "keyboard"
    MOUSE = "mouse"
    COMBINATION = "combination"


@dataclass
class HotkeyInfo:
    """Hotkey information"""
    hotkey: str
    callback: Callable
    description: str = ""
    hotkey_type: HotkeyType = HotkeyType.KEYBOARD
    priority: int = 0  # Higher number = higher priority
    enabled: bool = True
    original_callback: Optional[Callable] = None  # Chained system callback


class HotkeyListener:
    """
    Global hotkey listener with priority and conflict takeover
    """

    def __init__(self):
        keyboard = get_third_package_keyboard()
        KEYBOARD_AVAILABLE = keyboard is not None
        self.hotkeys: Dict[str, HotkeyInfo] = {}
        self.listening = False
        self.keyboard_available = KEYBOARD_AVAILABLE
        init_serialized_owner(
            self,
            "hotkey.listener.state",
            "HotkeyListenerState",
        )

    @serialized_method
    def register_hotkey(
        self,
        hotkey: str,
        callback: Callable,
        description: str = "",
        priority: int = 0,
        enabled: bool = True
    ) -> bool:
        """Register (or replace) a hotkey such as 'ctrl+shift+f1' or 'f12'."""
        normalized_hotkey = self._normalize_hotkey(hotkey)
        if normalized_hotkey in self.hotkeys:
            ColorPrint.yellow(f"[WARN] Hotkey '{hotkey}' already registered, updating...")
            if self.listening:
                self._unregister_from_keyboard(normalized_hotkey)

        hotkey_info = HotkeyInfo(
            hotkey=normalized_hotkey,
            callback=callback,
            description=description,
            priority=priority,
            enabled=enabled
        )
        self.hotkeys[normalized_hotkey] = hotkey_info
        ColorPrint.green(f"[REGISTER] Hotkey '{hotkey}' registered (priority: {priority})")

        if self.listening and enabled:
            return self._register_with_keyboard(normalized_hotkey)
        return True

    @serialized_method
    def unregister_hotkey(self, hotkey: str) -> bool:
        """Unregister a hotkey; False when it was not registered."""
        normalized_hotkey = self._normalize_hotkey(hotkey)
        if normalized_hotkey not in self.hotkeys:
            ColorPrint.yellow(f"[WARN] Hotkey '{hotkey}' not registered")
            return False
        if self.listening:
            self._unregister_from_keyboard(normalized_hotkey)
        del self.hotkeys[normalized_hotkey]
        ColorPrint.green(f"[UNREGISTER] Hotkey '{hotkey}' unregistered")
        return True

    @serialized_method
    def enable_hotkey(self, hotkey: str) -> bool:
        """Enable a hotkey"""
        return self._set_hotkey_enabled(hotkey, True)

    @serialized_method
    def disable_hotkey(self, hotkey: str) -> bool:
        """Disable a hotkey"""
        return self._set_hotkey_enabled(hotkey, False)

    def _set_hotkey_enabled(self, hotkey: str, enabled: bool) -> bool:
        normalized_hotkey = self._normalize_hotkey(hotkey)
        if normalized_hotkey not in self.hotkeys:
            ColorPrint.yellow(f"[WARN] Hotkey '{hotkey}' not registered")
            return False

        self.hotkeys[normalized_hotkey].enabled = enabled
        if self.listening:
            if enabled:
                self._register_with_keyboard(normalized_hotkey)
            else:
                self._unregister_from_keyboard(normalized_hotkey)

        status = "enabled" if enabled else "disabled"
        ColorPrint.blue(f"[UPDATE] Hotkey '{hotkey}' {status}")
        return True

    @serialized_method
    def start_listening(self) -> bool:
        """Register every enabled hotkey with the keyboard hook."""
        if not self.keyboard_available:
            ColorPrint.yellow("[WARN] Cannot start listening - keyboard module not available")
            return False
        if self.listening:
            ColorPrint.yellow("[WARN] Already listening for hotkeys")
            return True

        for hotkey, info in self.hotkeys.items():
            if info.enabled:
                self._register_with_keyboard(hotkey)
        self.listening = True
        ColorPrint.green(f"[START] Started listening for {len(self.hotkeys)} hotkey(s)")
        return True

    @serialized_method
    def stop_listening(self) -> bool:
        """Remove every hotkey from the keyboard hook."""
        self._stop_listening()
        return True

    def _stop_listening(self) -> None:
        if not self.listening:
            return
        for hotkey in list(self.hotkeys.keys()):
            self._unregister_from_keyboard(hotkey)
        self.listening = False
        ColorPrint.green("[STOP] Stopped listening for hotkeys")

    @serialized_method
    def update_hotkey(self, old_hotkey: str, new_hotkey: str) -> bool:
        """Rebind a registered hotkey to a new key combination."""
        old_normalized = self._normalize_hotkey(old_hotkey)
        new_normalized = self._normalize_hotkey(new_hotkey)
        if old_normalized not in self.hotkeys:
            ColorPrint.yellow(f"[WARN] Hotkey '{old_hotkey}' not registered")
            return False

        hotkey_info = self.hotkeys.pop(old_normalized)
        if self.listening:
            self._unregister_from_keyboard(old_normalized)
        hotkey_info.hotkey = new_normalized
        self.hotkeys[new_normalized] = hotkey_info
        if self.listening and hotkey_info.enabled:
            self._register_with_keyboard(new_normalized)

        ColorPrint.green(f"[UPDATE] Hotkey updated: '{old_hotkey}' -> '{new_hotkey}'")
        return True

    @serialized_method
    def get_registered_hotkeys(self) -> List[Dict]:
        """List registered hotkeys as dictionaries."""
        return [
            {
                "hotkey": info.hotkey,
                "description": info.description,
                "priority": info.priority,
                "enabled": info.enabled
            }
            for info in self.hotkeys.values()
        ]

    @serialized_method
    def clear_all_hotkeys(self) -> bool:
        """Stop listening and drop every registered hotkey."""
        self._stop_listening()
        count = len(self.hotkeys)
        self.hotkeys.clear()
        ColorPrint.green(f"[CLEAR] Cleared {count} hotkey(s)")
        return True

    @staticmethod
    def _normalize_hotkey(hotkey: str) -> str:
        return hotkey.lower().replace(' ', '')

    def _make_trigger(self, hotkey: str) -> Callable[[], None]:
        def trigger() -> None:
            callback_state = self._get_callback_state(hotkey)
            if callback_state is None:
                return
            ColorPrint.blue(f"[HOTKEY] Triggered: {hotkey}")
            callback, original_callback = callback_state
            callback()
            if original_callback:
                ColorPrint.blue(f"[HOTKEY] Executing original system callback for '{hotkey}'")
                original_callback()
        return trigger

    def _register_with_keyboard(self, hotkey: str) -> bool:
        """Register with the keyboard hook; take the hotkey over (suppress) on conflict."""
        keyboard = get_third_package_keyboard()
        KEYBOARD_AVAILABLE = keyboard is not None
        if not KEYBOARD_AVAILABLE:
            ColorPrint.red(f"[HOTKEY] Keyboard module not available; cannot register '{hotkey}'")
            return False
        trigger = self._make_trigger(hotkey)
        try:
            keyboard.add_hotkey(hotkey, trigger, suppress=False)
            ColorPrint.green(f"[HOTKEY] Successfully registered '{hotkey}'")
            return True
        except KEYBOARD_ERRORS as register_error:
            ColorPrint.yellow(f"[HOTKEY] Registration failed for '{hotkey}': {register_error}; taking over with suppress=True")
        self._unregister_from_keyboard(hotkey)
        try:
            keyboard.add_hotkey(hotkey, trigger, suppress=True)
        except KEYBOARD_ERRORS as suppress_error:
            ColorPrint.red(f"[HOTKEY] Failed to register '{hotkey}' with suppress=True: {suppress_error}")
            return False
        ColorPrint.green(f"[HOTKEY] Successfully took over '{hotkey}' with suppress=True")
        return True

    @serialized_method
    def _get_callback_state(self, hotkey: str):
        info = self.hotkeys.get(hotkey)
        if info is None or not info.enabled:
            return None
        return info.callback, info.original_callback

    def _unregister_from_keyboard(self, hotkey: str) -> None:
        keyboard = get_third_package_keyboard()
        KEYBOARD_AVAILABLE = keyboard is not None
        if not KEYBOARD_AVAILABLE:
            return
        try:
            keyboard.remove_hotkey(hotkey)
        except KEYBOARD_ERRORS as e:
            ColorPrint.yellow(f"[HOTKEY] remove_hotkey('{hotkey}') skipped: {e}")


global_hotkey_listener = HotkeyListener()


__all__ = [
    "HotkeyType",
    "HotkeyInfo",
    "HotkeyListener",
    "global_hotkey_listener",
]
