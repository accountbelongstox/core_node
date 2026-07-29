#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hotkey Registry System
Universal hotkey registration system driven by configuration.

Extension: Hotkeys are loaded from CONFIG at startup (initialize_hotkeys).
When config changes (e.g. user edits HotkeyInput in UI), the UI calls
get_config_change_hub().notify_config_changed(...); controller subscribes
and calls reregister_* so the global listener rebinds immediately (same
pattern for assistant_hotkey, macro_start_hotkey, etc.).
Per-config bindings (config1..config4; keys from share.values.skill_config_hotkeys) are
managed by macro_config_loader (load at app start, refresh on config change);
macro reads loader via macro_config_provider and sends to D3 via macro_config_ops.

Config hotkey keys: see CONFIG_HOTKEY_KEYS and docs/HOTKEY_BINDING_AND_CONFIG_DESIGN.md.
"""

import os
import sys
from typing import Dict, Callable, Optional, Any

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from providor.providor_index import CONFIG, get_assistant_state, set_assistant_should_stop, can_start_assistant
from d3utils.global_hotkey_manager import register_hotkey, unregister_hotkey

# Keys under macro_configs.auxiliary_config used for global hotkey registration (immediate rebind on change).
AUXILIARY_CONFIG_HOTKEY_KEYS = ('assistant_hotkey', 'macro_start_hotkey')

# UI binding map: config paths for HotkeyInput-backed keys (design §8.7).
HOTKEY_CONFIG_PATH_AUXILIARY = "macro_configs.auxiliary_config"
HOTKEY_CONFIG_PATH_SKILL_CONFIGS = "macro_configs.skill_configs"
CONFIG_KEY_ASSISTANT_HOTKEY = "assistant_hotkey"
CONFIG_KEY_MACRO_START_HOTKEY = "macro_start_hotkey"


def normalize_hotkey_canonical(hotkey: str) -> str:
    """
    Normalize hotkey string to canonical form for CONFIG and keyboard library (design §4.5, §8.1).
    Returns lowercase, no spaces, '+' between keys; empty input returns ''.
    """
    if not hotkey or not str(hotkey).strip():
        return ""
    return str(hotkey).strip().lower().replace(" ", "")

# Injected by controller; d3utils does not import controller.
_assistant_callback: Optional[Callable[[], None]] = None
_combat_callback: Optional[Callable[[], None]] = None


def set_assistant_callback(cb: Callable[[], None]) -> None:
    """Set callback for assistant hotkey (run assistant action). Called from controller layer."""
    global _assistant_callback
    _assistant_callback = cb


def set_combat_callback(cb: Callable[[], None]) -> None:
    """Set callback for combat macro hotkey (toggle combat macro). Called from controller layer."""
    global _combat_callback
    _combat_callback = cb


class HotkeyRegistry:
    """
    Universal hotkey registry system

    Manages hotkey registration based on configuration and provides
    a unified interface for registering/unregistering hotkeys.
    """

    def __init__(self):
        """Initialize hotkey registry"""
        self._registered_hotkeys: Dict[str, Dict[str, Any]] = {}
        ColorPrint.blue("[HotkeyRegistry] Initialized")

    def register_assistant_hotkey(self) -> bool:
        """
        Register assistant macro hotkey from config

        Returns:
            True if registered successfully, False otherwise
        """
        # Get hotkey from config (canonical form for CONFIG/keyboard, design §8.1)
        raw = (CONFIG.get('macro_configs', {}) or {}).get('auxiliary_config', {}) or {}
        raw = raw.get('assistant_hotkey')
        assistant_hotkey = normalize_hotkey_canonical(raw) if raw else ""

        if not assistant_hotkey:
            ColorPrint.yellow("[HotkeyRegistry] No assistant_hotkey in CONFIG")
            return False

        ColorPrint.blue(f"[HotkeyRegistry] Registering assistant hotkey: {assistant_hotkey}")

        def assistant_hotkey_callback():
            """Toggle assistant; uses injected _assistant_callback (set by controller)."""
            state = get_assistant_state()

            if state["is_running"]:
                ColorPrint.yellow("[HOTKEY] Assistant: Requesting stop...")
                set_assistant_should_stop(True)
            else:
                if can_start_assistant():
                    if _assistant_callback:
                        ColorPrint.blue("[HOTKEY] Assistant: Starting auto use interface function...")
                        _assistant_callback()
                    else:
                        ColorPrint.yellow("[HOTKEY] Assistant: Callback not set (controller not ready)")
                else:
                    ColorPrint.yellow("[HOTKEY] Assistant: Cannot start - execution disabled")

        # Register hotkey
        success = register_hotkey(
            hotkey=assistant_hotkey,
            callback=assistant_hotkey_callback,
            description="Assistant macro - Toggle auto use interface function",
            source="hotkey_registry",
            priority=50,
            enabled=True
        )

        if success:
            # Track registered hotkey (same binding used when config changes: unregister old, register new)
            self._registered_hotkeys['assistant'] = {
                'hotkey': assistant_hotkey,
                'callback': assistant_hotkey_callback,
                'description': 'Assistant macro hotkey'
            }
            ColorPrint.green(f"[HotkeyRegistry] Assistant hotkey registered: {assistant_hotkey}")
        else:
            ColorPrint.red(f"[HotkeyRegistry] Failed to register assistant hotkey: {assistant_hotkey}")

        return success

    def reregister_assistant_hotkey(self) -> bool:
        """
        Rebind assistant hotkey from CONFIG (e.g. after UI changed assistant macro hotkey).
        Unregisters current key and registers new key; if new key is empty, unregisters old only (§8.2).
        """
        aux = (CONFIG.get('macro_configs', {}) or {}).get('auxiliary_config', {}) or {}
        new_hotkey = normalize_hotkey_canonical(aux.get('assistant_hotkey') or "")

        if 'assistant' not in self._registered_hotkeys:
            if new_hotkey:
                return self.register_assistant_hotkey()
            return True
        entry = self._registered_hotkeys['assistant']
        old_hotkey = entry['hotkey']
        if not new_hotkey:
            if old_hotkey:
                unregister_hotkey(old_hotkey, "hotkey_registry")
            del self._registered_hotkeys['assistant']
            ColorPrint.blue("[HotkeyRegistry] Assistant hotkey cleared (empty config)")
            return True
        if old_hotkey == new_hotkey:
            return True
        if unregister_hotkey(old_hotkey, "hotkey_registry"):
            entry['hotkey'] = new_hotkey
            if register_hotkey(
                hotkey=new_hotkey,
                callback=entry['callback'],
                description=entry['description'],
                source="hotkey_registry",
                priority=50,
                enabled=True
            ):
                ColorPrint.green(f"[HotkeyRegistry] Assistant hotkey rebound: {old_hotkey} -> {new_hotkey}")
                return True
            if register_hotkey(old_hotkey, entry['callback'], entry['description'], "hotkey_registry", 50, True):
                entry['hotkey'] = old_hotkey
            ColorPrint.red(f"[HotkeyRegistry] Failed to register new assistant hotkey: {new_hotkey}")
            return False
        ColorPrint.red(f"[HotkeyRegistry] Failed to unregister old assistant hotkey: {old_hotkey}")
        return False

    def register_combat_hotkey(self) -> bool:
        """
        Register combat macro hotkey from config (macro_start_hotkey).

        Returns:
            True if registered successfully, False otherwise
        """
        aux = (CONFIG.get('macro_configs', {}) or {}).get('auxiliary_config', {}) or {}
        raw = aux.get('macro_start_hotkey')
        macro_start_hotkey = normalize_hotkey_canonical(raw) if raw else ""

        if not macro_start_hotkey:
            ColorPrint.yellow("[HotkeyRegistry] No macro_start_hotkey in CONFIG")
            return False

        ColorPrint.blue(f"[HotkeyRegistry] Registering combat hotkey: {macro_start_hotkey}")

        def combat_hotkey_callback():
            """Toggle combat macro; uses injected _combat_callback (set by controller)."""
            if _combat_callback:
                ColorPrint.blue("[HOTKEY] Combat: Toggle macro...")
                _combat_callback()
            else:
                ColorPrint.yellow("[HOTKEY] Combat: Callback not set (controller not ready)")

        success = register_hotkey(
            hotkey=macro_start_hotkey,
            callback=combat_hotkey_callback,
            description="Combat macro - Toggle start/stop",
            source="hotkey_registry",
            priority=50,
            enabled=True
        )

        if success:
            self._registered_hotkeys['combat'] = {
                'hotkey': macro_start_hotkey,
                'callback': combat_hotkey_callback,
                'description': 'Combat macro hotkey'
            }
            ColorPrint.green(f"[HotkeyRegistry] Combat hotkey registered: {macro_start_hotkey}")
        else:
            ColorPrint.red(f"[HotkeyRegistry] Failed to register combat hotkey: {macro_start_hotkey}")

        return success

    def reregister_combat_hotkey(self) -> bool:
        """
        Rebind combat hotkey from CONFIG (e.g. after UI changed macro_start_hotkey).
        If new key is empty, unregisters old only (§8.2).
        """
        aux = (CONFIG.get('macro_configs', {}) or {}).get('auxiliary_config', {}) or {}
        new_hotkey = normalize_hotkey_canonical(aux.get('macro_start_hotkey') or "")

        if 'combat' not in self._registered_hotkeys:
            if new_hotkey:
                return self.register_combat_hotkey()
            return True
        entry = self._registered_hotkeys['combat']
        old_hotkey = entry['hotkey']
        if not new_hotkey:
            if old_hotkey:
                unregister_hotkey(old_hotkey, "hotkey_registry")
            del self._registered_hotkeys['combat']
            ColorPrint.blue("[HotkeyRegistry] Combat hotkey cleared (empty config)")
            return True
        if old_hotkey == new_hotkey:
            return True
        if unregister_hotkey(old_hotkey, "hotkey_registry"):
            entry['hotkey'] = new_hotkey
            if register_hotkey(
                hotkey=new_hotkey,
                callback=entry['callback'],
                description=entry['description'],
                source="hotkey_registry",
                priority=50,
                enabled=True
            ):
                ColorPrint.green(f"[HotkeyRegistry] Combat hotkey rebound: {old_hotkey} -> {new_hotkey}")
                return True
            if register_hotkey(old_hotkey, entry['callback'], entry['description'], "hotkey_registry", 50, True):
                entry['hotkey'] = old_hotkey
            ColorPrint.red(f"[HotkeyRegistry] Failed to register new combat hotkey: {new_hotkey}")
            return False
        ColorPrint.red(f"[HotkeyRegistry] Failed to unregister old combat hotkey: {old_hotkey}")
        return False

    def unregister_all_auxiliary_hotkeys(self) -> None:
        """Unregister assistant and combat hotkeys (design §8.6). Called on shutdown."""
        for name in ('assistant', 'combat'):
            if name not in self._registered_hotkeys:
                continue
            entry = self._registered_hotkeys[name]
            hotkey = entry.get('hotkey')
            if hotkey:
                unregister_hotkey(hotkey, "hotkey_registry")
            del self._registered_hotkeys[name]
        ColorPrint.blue("[HotkeyRegistry] Auxiliary hotkeys unregistered")

    def register_custom_hotkey(
        self,
        name: str,
        hotkey: str,
        callback: Callable,
        description: str = "",
        priority: int = 50
    ) -> bool:
        """
        Register a custom hotkey

        Args:
            name: Hotkey identifier (unique)
            hotkey: Hotkey combination (e.g., "ctrl+f1")
            callback: Callback function
            description: Hotkey description
            priority: Hotkey priority (higher = more priority)

        Returns:
            True if registered successfully, False otherwise
        """
        if name in self._registered_hotkeys:
            ColorPrint.yellow(f"[HotkeyRegistry] Hotkey '{name}' already registered")
            return False

        ColorPrint.blue(f"[HotkeyRegistry] Registering custom hotkey '{name}': {hotkey}")

        success = register_hotkey(
            hotkey=hotkey,
            callback=callback,
            description=description or f"Custom hotkey: {name}",
            source="hotkey_registry",
            priority=priority,
            enabled=True
        )

        if success:
            self._registered_hotkeys[name] = {
                'hotkey': hotkey,
                'callback': callback,
                'description': description
            }
            ColorPrint.green(f"[HotkeyRegistry] Custom hotkey '{name}' registered: {hotkey}")
        else:
            ColorPrint.red(f"[HotkeyRegistry] Failed to register custom hotkey '{name}': {hotkey}")

        return success

    def unregister_hotkey(self, name: str) -> bool:
        """
        Unregister a hotkey

        Args:
            name: Hotkey identifier

        Returns:
            True if unregistered successfully, False otherwise
        """
        if name not in self._registered_hotkeys:
            ColorPrint.yellow(f"[HotkeyRegistry] Hotkey '{name}' not registered")
            return False

        hotkey_info = self._registered_hotkeys[name]
        ColorPrint.blue(f"[HotkeyRegistry] Unregistering hotkey '{name}': {hotkey_info['hotkey']}")

        # Remove from tracking
        del self._registered_hotkeys[name]

        ColorPrint.green(f"[HotkeyRegistry] Hotkey '{name}' unregistered")
        return True

    def get_registered_hotkeys(self) -> Dict[str, Dict[str, Any]]:
        """
        Get all registered hotkeys

        Returns:
            Dictionary of registered hotkeys
        """
        return self._registered_hotkeys.copy()

    def is_registered(self, name: str) -> bool:
        """
        Check if a hotkey is registered

        Args:
            name: Hotkey identifier

        Returns:
            True if registered, False otherwise
        """
        return name in self._registered_hotkeys


# Global hotkey registry instance
_hotkey_registry: Optional[HotkeyRegistry] = None


def get_hotkey_registry() -> HotkeyRegistry:
    """Get global hotkey registry instance (singleton)"""
    global _hotkey_registry
    if _hotkey_registry is None:
        _hotkey_registry = HotkeyRegistry()
    return _hotkey_registry


def unregister_all_auxiliary_hotkeys() -> None:
    """Unregister assistant and combat hotkeys on shutdown (design §8.6)."""
    get_hotkey_registry().unregister_all_auxiliary_hotkeys()


def initialize_hotkeys() -> bool:
    """
    Initialize all system hotkeys from configuration.

    Registers global listener hotkeys from CONFIG:
    - Assistant macro hotkey (assistant_hotkey)
    - Combat macro hotkey (macro_start_hotkey)
    """
    ColorPrint.blue("[HotkeyRegistry] Initializing system hotkeys...")

    registry = get_hotkey_registry()
    assistant_success = registry.register_assistant_hotkey()
    combat_success = registry.register_combat_hotkey()

    if assistant_success and combat_success:
        ColorPrint.green("[HotkeyRegistry] All system hotkeys initialized successfully")
    elif assistant_success or combat_success:
        ColorPrint.yellow("[HotkeyRegistry] Some hotkeys failed to initialize")
    else:
        ColorPrint.yellow("[HotkeyRegistry] No hotkeys registered (check CONFIG)")

    return assistant_success or combat_success
