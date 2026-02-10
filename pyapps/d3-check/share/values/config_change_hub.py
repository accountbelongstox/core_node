# -*- coding: utf-8 -*-
"""
Config Change Hub - single-instance config change notification (CONFIG_UI_LINKAGE_DESIGN).
Subscribe once; any CONFIG write calls notify_config_changed; callbacks run on main thread.
Coalesces rapid notifies into one dispatch to avoid main-thread flood and UI freeze.
"""

import uuid
from typing import Callable, Optional, List, Tuple

_hub: Optional["ConfigChangeHub"] = None


def get_config_change_hub(root=None) -> "ConfigChangeHub":
    """Return singleton hub. Pass root (tk.Tk) when UI is ready so notify runs on main thread."""
    global _hub
    if _hub is None:
        _hub = ConfigChangeHub()
    if root is not None:
        _hub._root = root
    return _hub


class ConfigChangeHub:
    """Single-instance hub: subscribe(callback, key_prefix); notify_config_changed(key_path)."""

    def __init__(self):
        self._root = None
        self._subs: List[Tuple[str, Callable[[Optional[str]], None], Optional[str]]] = []
        self._pending_after_id: Optional[str] = None
        self._pending_key_path: Optional[str] = None

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
        """Schedule one dispatch on main thread (coalesced); if no root, dispatch synchronously."""
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
            self._pending_after_id = root.after(0, self._dispatch_pending)
        else:
            self._dispatch(key_path)

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
