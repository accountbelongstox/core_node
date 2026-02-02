#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hotkey Registry System
Universal hotkey registration system driven by configuration
"""

import os
import sys
from typing import Dict, Callable, Optional, Any

# Add project paths
from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import CONFIG
from d3utils.global_hotkey_manager import register_hotkey


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
        # Get hotkey from config
        assistant_hotkey = CONFIG.get('macro_configs', {}).get(
            'auxiliary_config', {}
        ).get('assistant_hotkey')

        if not assistant_hotkey:
            ColorPrint.yellow("[HotkeyRegistry] No assistant_hotkey in CONFIG")
            return False

        ColorPrint.blue(f"[HotkeyRegistry] Registering assistant hotkey: {assistant_hotkey}")

        # Import dependencies
        from controller.game_assistant_controller import GameAssistantController
        from providor.providor_index import (
            get_assistant_state,
            set_assistant_should_stop,
            can_start_assistant
        )

        # Create controller instance
        game_assistant = GameAssistantController()

        def assistant_hotkey_callback():
            """Toggle assistant function execution"""
            state = get_assistant_state()

            if state["is_running"]:
                # Already running, request stop
                ColorPrint.yellow("[HOTKEY] Assistant: Requesting stop...")
                set_assistant_should_stop(True)
            else:
                # Not running, check if can start
                if can_start_assistant():
                    ColorPrint.blue("[HOTKEY] Assistant: Starting auto use interface function...")
                    game_assistant.auto_use_interface_function()
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
            # Track registered hotkey
            self._registered_hotkeys['assistant'] = {
                'hotkey': assistant_hotkey,
                'callback': assistant_hotkey_callback,
                'description': 'Assistant macro hotkey'
            }
            ColorPrint.green(f"[HotkeyRegistry] Assistant hotkey registered: {assistant_hotkey}")
        else:
            ColorPrint.red(f"[HotkeyRegistry] Failed to register assistant hotkey: {assistant_hotkey}")

        return success

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


def initialize_hotkeys() -> bool:
    """
    Initialize all system hotkeys from configuration

    This function registers all configured hotkeys, including:
    - Assistant macro hotkey
    - Future: Combat hotkeys, debug hotkeys, etc.

    Returns:
        True if all hotkeys initialized successfully, False if any failed
    """
    ColorPrint.blue("[HotkeyRegistry] Initializing system hotkeys...")

    registry = get_hotkey_registry()

    # Register assistant hotkey
    assistant_success = registry.register_assistant_hotkey()

    # Future: Add other hotkey registrations here
    # combat_success = registry.register_combat_hotkey()
    # debug_success = registry.register_debug_hotkey()

    if assistant_success:
        ColorPrint.green("[HotkeyRegistry] All system hotkeys initialized successfully")
    else:
        ColorPrint.yellow("[HotkeyRegistry] Some hotkeys failed to initialize")

    return assistant_success
