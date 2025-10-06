#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Hotkey Manager Module
Moved from the config package to avoid configuration coupling.
"""

import os
import sys
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Dict, List, Optional

# Add project paths for shared utilities
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)

# Import from common_imports (unified public library imports)
from providor.common_imports import (
    ColorPrint,
    get_global_hotkey_listener,
    register_global_hotkey,
    unregister_global_hotkey,
)

class HotkeyStatus(Enum):
    """Hotkey registration status"""
    REGISTERED = "registered"
    CONFLICT = "conflict"
    ERROR = "error"
    PENDING = "pending"

@dataclass
class HotkeyEntry:
    """Hotkey entry in the global registry"""
    hotkey: str
    callback: Callable
    description: str
    source: str
    priority: int = 0
    enabled: bool = True
    status: HotkeyStatus = HotkeyStatus.PENDING
    original_callback: Optional[Callable] = None
    registration_time: float = field(default_factory=lambda: 0.0)
    last_used: float = field(default_factory=lambda: 0.0)

class GlobalHotkeyManager:
    """Global hotkey manager with conflict resolution"""

    _instance: Optional['GlobalHotkeyManager'] = None
    _lock = threading.Lock()

    def __new__(cls):
        """Singleton pattern implementation"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        """Initialize the global hotkey manager"""
        if getattr(self, '_initialized', False):
            return

        self.hotkey_registry: Dict[str, HotkeyEntry] = {}
        self.conflict_resolution = True
        self.auto_restore_system_hotkeys = True
        self.system_hotkey_backup: Dict[str, Callable] = {}
        self.registration_lock = threading.Lock()

        # Get the global hotkey listener
        self.hotkey_listener = get_global_hotkey_listener()

        ColorPrint.green("[INIT] GlobalHotkeyManager initialized as singleton")
        self._initialized = True

    def register_hotkey(
        self,
        hotkey: str,
        callback: Callable,
        description: str,
        source: str,
        priority: int = 0,
        enabled: bool = True
    ) -> bool:
        """Register a hotkey with the global manager"""
        with self.registration_lock:
            try:
                current_time = time.time()

                # Normalize hotkey string
                normalized_hotkey = self._normalize_hotkey(hotkey)

                # Check for duplicate registration
                if normalized_hotkey in self.hotkey_registry:
                    existing_entry = self.hotkey_registry[normalized_hotkey]
                    if (existing_entry.callback == callback and
                        existing_entry.source == source and
                        existing_entry.description == description):
                        existing_entry.last_used = current_time
                        ColorPrint.blue(f"[HOTKEY] Duplicate registration ignored for '{hotkey}' from '{source}'")
                        return True

                # Create hotkey entry
                hotkey_entry = HotkeyEntry(
                    hotkey=normalized_hotkey,
                    callback=callback,
                    description=description,
                    source=source,
                    priority=priority,
                    enabled=enabled,
                    registration_time=current_time,
                    last_used=current_time
                )

                # Handle conflict resolution
                if normalized_hotkey in self.hotkey_registry:
                    if not self._resolve_hotkey_conflict(normalized_hotkey, hotkey_entry):
                        ColorPrint.red(f"[HOTKEY] Failed to resolve conflict for '{hotkey}'")
                        return False

                # Register with the global hotkey listener
                success = register_global_hotkey(
                    normalized_hotkey,
                    self._create_wrapped_callback(hotkey_entry),
                    description,
                    priority,
                    enabled
                )

                if success:
                    self.hotkey_registry[normalized_hotkey] = hotkey_entry
                    hotkey_entry.status = HotkeyStatus.REGISTERED
                    ColorPrint.green(f"[HOTKEY] Registered '{hotkey}' from '{source}' (priority: {priority})")
                    return True
                else:
                    hotkey_entry.status = HotkeyStatus.ERROR
                    ColorPrint.red(f"[HOTKEY] Failed to register '{hotkey}' from '{source}'")
                    return False

            except Exception as e:
                ColorPrint.red(f"[HOTKEY] Error registering '{hotkey}' from '{source}': {e}")
                return False

    def unregister_hotkey(self, hotkey: str, source: str) -> bool:
        """Unregister a hotkey from the global manager"""
        with self.registration_lock:
            try:
                normalized_hotkey = self._normalize_hotkey(hotkey)

                if normalized_hotkey not in self.hotkey_registry:
                    ColorPrint.yellow(f"[HOTKEY] Hotkey '{hotkey}' not found in registry")
                    return False

                entry = self.hotkey_registry[normalized_hotkey]

                # Only unregister if the source matches
                if entry.source != source:
                    ColorPrint.yellow(f"[HOTKEY] Hotkey '{hotkey}' registered by '{entry.source}', not '{source}'")
                    return False

                # Unregister from the global hotkey listener
                success = unregister_global_hotkey(normalized_hotkey)

                if success:
                    del self.hotkey_registry[normalized_hotkey]
                    ColorPrint.blue(f"[HOTKEY] Unregistered '{hotkey}' from '{source}'")
                    return True
                else:
                    ColorPrint.red(f"[HOTKEY] Failed to unregister '{hotkey}' from '{source}'")
                    return False

            except Exception as e:
                ColorPrint.red(f"[HOTKEY] Error unregistering '{hotkey}' from '{source}': {e}")
                return False

    def list_hotkeys(self, source: Optional[str] = None) -> List[HotkeyEntry]:
        """List all registered hotkeys, optionally filtered by source"""
        if source:
            return [entry for entry in self.hotkey_registry.values() if entry.source == source]
        return list(self.hotkey_registry.values())

    def clear_hotkeys(self, source: Optional[str] = None) -> int:
        """Clear hotkeys, optionally filtered by source"""
        with self.registration_lock:
            cleared_count = 0
            hotkeys_to_remove = []

            for hotkey, entry in self.hotkey_registry.items():
                if source is None or entry.source == source:
                    hotkeys_to_remove.append((hotkey, entry))

            for hotkey, entry in hotkeys_to_remove:
                if unregister_global_hotkey(hotkey):
                    del self.hotkey_registry[hotkey]
                    cleared_count += 1
                    ColorPrint.blue(f"[HOTKEY] Cleared '{hotkey}' from '{entry.source}'")

            return cleared_count

    def _normalize_hotkey(self, hotkey: str) -> str:
        """Normalize hotkey string for consistent comparison"""
        return hotkey.lower().replace(' ', '').replace('+', '+')

    def _resolve_hotkey_conflict(self, hotkey: str, new_entry: HotkeyEntry) -> bool:
        """Resolve hotkey conflicts by priority"""
        try:
            existing_entry = self.hotkey_registry[hotkey]

            # If new entry has higher priority, replace existing
            if new_entry.priority > existing_entry.priority:
                ColorPrint.yellow(f"[HOTKEY] Replacing '{hotkey}' due to higher priority")

                # Backup the existing callback for restoration
                if self.auto_restore_system_hotkeys:
                    self.system_hotkey_backup[hotkey] = existing_entry.callback

                # Unregister the existing hotkey
                unregister_global_hotkey(hotkey)
                return True

            # If same priority, keep existing
            if new_entry.priority == existing_entry.priority:
                ColorPrint.yellow(f"[HOTKEY] Keeping existing '{hotkey}' (same priority)")
                return False

            # If lower priority, reject new entry
            ColorPrint.yellow(f"[HOTKEY] Rejecting '{hotkey}' (lower priority)")
            return False

        except Exception as e:
            ColorPrint.red(f"[HOTKEY] Error resolving conflict for '{hotkey}': {e}")
            return False

    def _create_wrapped_callback(self, entry: HotkeyEntry) -> Callable:
        """Create wrapped callback that updates last_used timestamp"""
        def wrapped_callback():
            entry.last_used = time.time()
            try:
                entry.callback()
            except Exception as e:
                ColorPrint.red(f"[HOTKEY] Error executing callback for '{entry.hotkey}': {e}")
        return wrapped_callback

_global_hotkey_manager: Optional[GlobalHotkeyManager] = None

def get_global_hotkey_manager() -> GlobalHotkeyManager:
    """Get the global hotkey manager instance"""
    global _global_hotkey_manager
    if _global_hotkey_manager is None:
        _global_hotkey_manager = GlobalHotkeyManager()
    return _global_hotkey_manager

def register_hotkey(
    hotkey: str,
    callback: Callable,
    description: str,
    source: str,
    priority: int = 0,
    enabled: bool = True
) -> bool:
    """Register a hotkey with the global manager"""
    manager = get_global_hotkey_manager()
    return manager.register_hotkey(hotkey, callback, description, source, priority, enabled)

def unregister_hotkey(hotkey: str, source: str) -> bool:
    """Unregister a hotkey from the global manager"""
    manager = get_global_hotkey_manager()
    return manager.unregister_hotkey(hotkey, source)

def list_hotkeys(source: Optional[str] = None) -> List[HotkeyEntry]:
    """List all registered hotkeys"""
    manager = get_global_hotkey_manager()
    return manager.list_hotkeys(source)

def clear_hotkeys(source: Optional[str] = None) -> int:
    """Clear hotkeys from the global manager"""
    manager = get_global_hotkey_manager()
    return manager.clear_hotkeys(source)

__all__ = [
    'HotkeyStatus',
    'HotkeyEntry',
    'GlobalHotkeyManager',
    'get_global_hotkey_manager',
    'register_hotkey',
    'unregister_hotkey',
    'list_hotkeys',
    'clear_hotkeys',
]
