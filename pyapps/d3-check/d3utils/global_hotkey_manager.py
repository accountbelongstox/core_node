#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Global Hotkey Manager Module
Moved from the config package to avoid configuration coupling.
Uses a single worker thread + command queue instead of locks.
"""

import queue
import threading
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Dict, List, Optional

from share.project_path import ensure_d3_check_in_sys_path
ensure_d3_check_in_sys_path()

# Direct pycore imports (no secondary encapsulation)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.hotkey.global_hotkey_listener import (
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

# Command queue and worker; single worker owns the registry.
_hotkey_cmd_queue: queue.Queue = queue.Queue()


class GlobalHotkeyManager:
    """Global hotkey manager with conflict resolution. All mutations run in worker thread."""

    def __init__(self, cmd_queue: queue.Queue):
        self._cmd_queue = cmd_queue
        self.hotkey_registry: Dict[str, HotkeyEntry] = {}
        self.conflict_resolution = True
        self.auto_restore_system_hotkeys = True
        self.system_hotkey_backup: Dict[str, Callable] = {}
        self.hotkey_listener = get_global_hotkey_listener()
        ColorPrint.green("[INIT] GlobalHotkeyManager initialized (worker)")

    def register_hotkey(
        self,
        hotkey: str,
        callback: Callable,
        description: str,
        source: str,
        priority: int = 0,
        enabled: bool = True
    ) -> bool:
        result_q: queue.Queue = queue.Queue()
        self._cmd_queue.put(("register", (hotkey, callback, description, source, priority, enabled), result_q))
        return result_q.get()

    def unregister_hotkey(self, hotkey: str, source: str) -> bool:
        result_q: queue.Queue = queue.Queue()
        self._cmd_queue.put(("unregister", (hotkey, source), result_q))
        return result_q.get()

    def list_hotkeys(self, source: Optional[str] = None) -> List[HotkeyEntry]:
        result_q: queue.Queue = queue.Queue()
        self._cmd_queue.put(("list", (source,), result_q))
        return result_q.get()

    def clear_hotkeys(self, source: Optional[str] = None) -> int:
        result_q: queue.Queue = queue.Queue()
        self._cmd_queue.put(("clear", (source,), result_q))
        return result_q.get()

    def _do_register(
        self,
        hotkey: str,
        callback: Callable,
        description: str,
        source: str,
        priority: int = 0,
        enabled: bool = True
    ) -> bool:
        try:
            current_time = time.time()
            normalized_hotkey = self._normalize_hotkey(hotkey)

            if normalized_hotkey in self.hotkey_registry:
                existing_entry = self.hotkey_registry[normalized_hotkey]
                if (existing_entry.callback == callback and
                    existing_entry.source == source and
                    existing_entry.description == description):
                    existing_entry.last_used = current_time
                    ColorPrint.blue(f"[HOTKEY] Duplicate registration ignored for '{hotkey}' from '{source}'")
                    return True

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

            if normalized_hotkey in self.hotkey_registry:
                if not self._resolve_hotkey_conflict(normalized_hotkey, hotkey_entry):
                    ColorPrint.red(f"[HOTKEY] Failed to resolve conflict for '{hotkey}'")
                    return False

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

    def _do_unregister(self, hotkey: str, source: str) -> bool:
        try:
            normalized_hotkey = self._normalize_hotkey(hotkey)

            if normalized_hotkey not in self.hotkey_registry:
                ColorPrint.yellow(f"[HOTKEY] Hotkey '{hotkey}' not found in registry")
                return False

            entry = self.hotkey_registry[normalized_hotkey]
            if entry.source != source:
                ColorPrint.yellow(f"[HOTKEY] Hotkey '{hotkey}' registered by '{entry.source}', not '{source}'")
                return False

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

    def _do_list(self, source: Optional[str] = None) -> List[HotkeyEntry]:
        if source:
            return [entry for entry in self.hotkey_registry.values() if entry.source == source]
        return list(self.hotkey_registry.values())

    def _do_clear(self, source: Optional[str] = None) -> int:
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
        return hotkey.lower().replace(' ', '').replace('+', '+')

    def _resolve_hotkey_conflict(self, hotkey: str, new_entry: HotkeyEntry) -> bool:
        try:
            existing_entry = self.hotkey_registry[hotkey]
            if new_entry.priority > existing_entry.priority:
                ColorPrint.yellow(f"[HOTKEY] Replacing '{hotkey}' due to higher priority")
                if self.auto_restore_system_hotkeys:
                    self.system_hotkey_backup[hotkey] = existing_entry.callback
                unregister_global_hotkey(hotkey)
                return True
            if new_entry.priority == existing_entry.priority:
                ColorPrint.yellow(f"[HOTKEY] Keeping existing '{hotkey}' (same priority)")
                return False
            ColorPrint.yellow(f"[HOTKEY] Rejecting '{hotkey}' (lower priority)")
            return False
        except Exception as e:
            ColorPrint.red(f"[HOTKEY] Error resolving conflict for '{hotkey}': {e}")
            return False

    def _create_wrapped_callback(self, entry: HotkeyEntry) -> Callable:
        def wrapped_callback():
            entry.last_used = time.time()
            try:
                entry.callback()
            except Exception as e:
                ColorPrint.red(f"[HOTKEY] Error executing callback for '{entry.hotkey}': {e}")
        return wrapped_callback


def _hotkey_worker() -> None:
    manager = GlobalHotkeyManager(_hotkey_cmd_queue)
    while True:
        item = _hotkey_cmd_queue.get()
        if item is None:
            break
        cmd, args, result_q = item
        if cmd == "get_manager":
            result_q.put(manager)
        elif cmd == "register":
            result_q.put(manager._do_register(*args))
        elif cmd == "unregister":
            result_q.put(manager._do_unregister(*args))
        elif cmd == "list":
            result_q.put(manager._do_list(*args))
        elif cmd == "clear":
            result_q.put(manager._do_clear(*args))


# Start worker at import so no lock needed for one-time start.
_hotkey_worker_thread = threading.Thread(target=_hotkey_worker, daemon=True)
_hotkey_worker_thread.start()


def get_global_hotkey_manager() -> GlobalHotkeyManager:
    result_q: queue.Queue = queue.Queue()
    _hotkey_cmd_queue.put(("get_manager", (), result_q))
    return result_q.get()


def register_hotkey(
    hotkey: str,
    callback: Callable,
    description: str,
    source: str,
    priority: int = 0,
    enabled: bool = True
) -> bool:
    manager = get_global_hotkey_manager()
    return manager.register_hotkey(hotkey, callback, description, source, priority, enabled)


def unregister_hotkey(hotkey: str, source: str) -> bool:
    manager = get_global_hotkey_manager()
    return manager.unregister_hotkey(hotkey, source)


def list_hotkeys(source: Optional[str] = None) -> List[HotkeyEntry]:
    manager = get_global_hotkey_manager()
    return manager.list_hotkeys(source)


def clear_hotkeys(source: Optional[str] = None) -> int:
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
