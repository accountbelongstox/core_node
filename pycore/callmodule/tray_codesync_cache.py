# -*- coding: utf-8 -*-
"""
Tray CodeSync state cache.

CodeSyncManager getters use @serialized_method and can block for up to 30s while
the dedicated worker is busy. The native Win32 tray rebuilds its menu on every
right-click on the tray message thread, so those getters must never run there.

This module keeps a THREAD_BUS-backed snapshot refreshed from a background thread
(and on code_sync_update / tray toggles). Tray menu getters read the snapshot only.
"""

import threading
import time

from pycore import THREAD_BUS, ColorPrint
from pycore.pyutils.codesync import get_code_sync_manager

TRAY_CODESYNC_STATE_SIGNAL = "tray.codesync.state"

_DEFAULT_STATE = {
    "role": "client",
    "distributing": False,
    "skip_update": False,
    "light": False,
}

_REFRESH_CONTEXT = {
    "launcher": None,
    "port": None,
    "singleton_port": None,
}
_STARTED = {"value": False}
_CACHE_THREAD = {"value": None}


def get_tray_codesync_state() -> dict:
    """Instant read of the last cached CodeSync tray state."""
    state = THREAD_BUS.get_signal(TRAY_CODESYNC_STATE_SIGNAL)
    if isinstance(state, dict):
        return state
    return dict(_DEFAULT_STATE)


def _state_signature(state: dict) -> str:
    role = state.get("role", "client")
    distributing = bool(state.get("distributing"))
    skip_update = bool(state.get("skip_update"))
    light = bool(state.get("light"))
    return f"{role}:{distributing}:{skip_update}:{light}"


def refresh_tray_codesync_cache() -> dict:
    """
    Pull live CodeSync state from the manager.

    May block on the serialized worker; call only from non-tray threads.
    """
    try:
        mgr = get_code_sync_manager()
        state = {
            "role": mgr.get_role(),
            "distributing": bool(mgr.is_distributing()),
            "skip_update": bool(mgr.is_skip_update()),
            "light": bool(getattr(mgr, "light", False)),
        }
    except Exception:
        state = get_tray_codesync_state()
    THREAD_BUS.signal(TRAY_CODESYNC_STATE_SIGNAL, state)
    return state


def _push_tray_menu_if_context(previous: dict, current: dict) -> None:
    launcher = _REFRESH_CONTEXT.get("launcher")
    port = _REFRESH_CONTEXT.get("port")
    if launcher is None or port is None:
        return
    if _state_signature(previous) == _state_signature(current):
        return
    try:
        from pycore.callmodule.tray_menu import update_tray_menu_with_singleton
        update_tray_menu_with_singleton(
            launcher,
            port=port,
            singleton_port=_REFRESH_CONTEXT.get("singleton_port"),
        )
    except Exception as exc:
        ColorPrint.yellow(f"[TrayCodeSyncCache] Tray menu refresh failed: {exc}")


def apply_tray_codesync_cache_refresh(push_menu: bool = True) -> dict:
    """Refresh the cache and optionally re-push the tray menu when state changed."""
    previous = get_tray_codesync_state()
    current = refresh_tray_codesync_cache()
    if push_menu:
        _push_tray_menu_if_context(previous, current)
    return current


class TrayCodeSyncCacheThread(threading.Thread):
    """Background refresher for CodeSync tray menu state."""

    REFRESH_SECONDS = 5.0

    def __init__(self, queue_name: str) -> None:
        super().__init__(name="TrayCodeSyncCacheThread", daemon=True)
        self._queue_name = queue_name

    def run(self) -> None:
        config = THREAD_BUS.receive_message(self._queue_name) or {}
        _REFRESH_CONTEXT["launcher"] = config.get("launcher")
        _REFRESH_CONTEXT["port"] = config.get("port")
        _REFRESH_CONTEXT["singleton_port"] = config.get("singleton_port")

        apply_tray_codesync_cache_refresh(push_menu=False)

        while not THREAD_BUS.is_shutdown_requested():
            apply_tray_codesync_cache_refresh(push_menu=True)
            deadline = time.monotonic() + self.REFRESH_SECONDS
            while time.monotonic() < deadline:
                if THREAD_BUS.is_shutdown_requested():
                    return
                time.sleep(0.25)


def start_tray_codesync_cache(launcher, port, singleton_port=None) -> None:
    """Start the background cache refresher (idempotent)."""
    if _STARTED["value"]:
        _REFRESH_CONTEXT["launcher"] = launcher
        _REFRESH_CONTEXT["port"] = port
        _REFRESH_CONTEXT["singleton_port"] = singleton_port
        return
    _STARTED["value"] = True
    _REFRESH_CONTEXT["launcher"] = launcher
    _REFRESH_CONTEXT["port"] = port
    _REFRESH_CONTEXT["singleton_port"] = singleton_port

    queue_name = "callmodule.tray.codesync_cache.config"
    THREAD_BUS.send_message(queue_name, {
        "launcher": launcher,
        "port": port,
        "singleton_port": singleton_port,
    })
    thread = TrayCodeSyncCacheThread(queue_name)
    _CACHE_THREAD["value"] = thread
    thread.start()
    ColorPrint.blue("[TrayCodeSyncCache] Background refresher started")


def on_code_sync_update(event_data) -> None:
    """THREAD_BUS handler: mesh ticks may change distribute/skip/role visibility."""
    apply_tray_codesync_cache_refresh(push_menu=True)
