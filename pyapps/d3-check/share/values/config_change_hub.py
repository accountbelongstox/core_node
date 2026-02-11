# -*- coding: utf-8 -*-
"""
Config Change Hub - single-instance config change notification (CONFIG_UI_LINKAGE_DESIGN).
Subscribe once; any CONFIG write calls notify_config_changed. Callbacks run on main thread only:
when root is not yet registered, notifications are queued and dispatched after root is set (DESIGN_ISSUES_MAJOR §6).
Coalesces rapid notifies into one dispatch to avoid main-thread flood and UI freeze.
"""

import uuid
from typing import Callable, Optional, List, Tuple

_hub: Optional["ConfigChangeHub"] = None


def get_config_change_hub(root=None) -> "ConfigChangeHub":
    """Return singleton hub. Pass root (tk.Tk) when UI is ready; queued notifies will then run on main thread."""
    global _hub
    if _hub is None:
        _hub = ConfigChangeHub()
    if root is not None:
        _hub._set_root(root)
    return _hub


class ConfigChangeHub:
    """Single-instance hub: subscribe(callback, key_prefix); notify_config_changed(key_path)."""

    def __init__(self):
        self._root = None
        self._subs: List[Tuple[str, Callable[[Optional[str]], None], Optional[str]]] = []
        self._pending_after_id: Optional[str] = None
        self._pending_key_path: Optional[str] = None
        self._pending_queue: List[Optional[str]] = []

    def _set_root(self, root) -> None:
        """Set root and flush any notifications queued (report §6: use after(50) to avoid crowding Map/350ms focus)."""
        self._root = root
        if self._pending_queue and root is not None and (not hasattr(root, "winfo_exists") or root.winfo_exists()):
            root.after(50, self._flush_pending_queue)

    def subscribe(
        self,
        callback: Callable[[Optional[str]], None],
        key_prefix: Optional[str] = None,
    ) -> str:
        """Register callback; key_prefix=None means all changes. Returns subscription_id."""
        sid = str(uuid.uuid4())
        self._subs.append((sid, callback, key_prefix))
        return sid

    def unsubscribe(self, subscription_id: str) -> None:
        """Remove subscription by id."""
        self._subs[:] = [(i, cb, kp) for i, cb, kp in self._subs if i != subscription_id]

    def notify_config_changed(self, key_path: Optional[str] = None) -> None:
        """Schedule one dispatch on main thread (coalesced). If no root, queue; do not run callbacks in current thread."""
        root = self._root
        if root is None:
            try:
                from share.ui_registry import get_root
                root = get_root()
            except Exception:
                root = None
        if root is not None and (not hasattr(root, "winfo_exists") or root.winfo_exists()):
            if self._pending_after_id is not None:
                try:
                    root.after_cancel(self._pending_after_id)
                except Exception:
                    pass
                self._pending_after_id = None
            self._pending_key_path = key_path
            self._pending_after_id = root.after(50, self._dispatch_pending)
        else:
            self._pending_queue.append(key_path)

    def _flush_pending_queue(self) -> None:
        """Dispatch coalesced key from queue on main thread (called after root is set)."""
        if not self._pending_queue:
            return
        kp = self._pending_queue[-1] if self._pending_queue else None
        self._pending_queue.clear()
        self._dispatch(kp)

    def _dispatch_pending(self) -> None:
        self._pending_after_id = None
        kp = self._pending_key_path
        self._pending_key_path = None
        self._dispatch(kp)

    def _dispatch(self, key_path: Optional[str]) -> None:
        for _sid, callback, key_prefix in self._subs:
            if key_prefix is None or (key_path is not None and key_path.startswith(key_prefix)):
                try:
                    callback(key_path)
                except Exception:
                    pass
