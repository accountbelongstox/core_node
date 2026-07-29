#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Clipboard Monitor

Monitors system clipboard for changes and syncs with clipboard history.

THREAD_BUS Integration:
- Registers shutdown handler (priority=80) for graceful shutdown
- Triggers 'clipboard.changed' events when clipboard content changes
- Checks THREAD_BUS.is_shutdown_requested() in monitor loop
- Backwards compatible: keeps existing callback mechanism
"""

import time
from typing import Optional, Callable
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import get_third_package_pyperclip
from pycore.pyutils.clipboard.clipboard_history import get_clipboard_history
from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)

pyperclip = get_third_package_pyperclip()


class ClipboardMonitor:
    """
    System clipboard monitor

    Features:
    - Monitors system clipboard for changes
    - Auto-saves to clipboard history
    - Configurable polling interval
    - Client ID tracking
    """

    def __init__(self, client_id: str = "system", poll_interval: float = 1.0):
        """
        Initialize clipboard monitor

        Args:
            client_id: Client identifier for this monitor
            poll_interval: Polling interval in seconds
        """
        self.client_id = client_id
        self.poll_interval = poll_interval
        self.clipboard_history = get_clipboard_history()
        self.monitor_thread = None
        self._running_signal = f"clipboard.monitor.{id(self)}.running"
        self._content_signal = f"clipboard.monitor.{id(self)}.content"
        self._callback_signal = f"clipboard.monitor.{id(self)}.callback"
        THREAD_BUS.signal(self._running_signal, False)
        THREAD_BUS.signal(self._content_signal, "")
        init_serialized_owner(
            self,
            "clipboard.monitor.state",
            "ClipboardMonitorState",
        )

    @serialized_method
    def start(self):
        """Start monitoring clipboard"""
        if THREAD_BUS.get_signal(self._running_signal, False):
            ColorPrint.yellow(f"[ClipboardMonitor] Already running for client: {self.client_id}")
            return

        THREAD_BUS.signal(self._running_signal, True)

        # Get initial clipboard content
        THREAD_BUS.signal(self._content_signal, pyperclip.paste())

        # Start monitor thread
        self.monitor_thread = start_bus_task(
            self._monitor_loop,
            thread_name=f"ClipboardMonitor-{self.client_id}",
        )

        # THREAD_BUS Integration: Register shutdown handler
        # Priority=80 ensures clipboard monitor stops before core services
        THREAD_BUS.register_shutdown_handler(
            self.stop,
            priority=80,
            name=f"clipboard_monitor_{self.client_id}"
        )
        ColorPrint.blue(f"[ClipboardMonitor] Registered THREAD_BUS shutdown handler (priority=80)")

        ColorPrint.green(f"[ClipboardMonitor] Started for client: {self.client_id}")

    @serialized_method
    def stop(self):
        """Stop monitoring clipboard"""
        if not THREAD_BUS.get_signal(self._running_signal, False):
            return

        THREAD_BUS.signal(self._running_signal, False)

        if self.monitor_thread:
            self.monitor_thread.join(timeout=2.0)
            self.monitor_thread = None

        ColorPrint.yellow(f"[ClipboardMonitor] Stopped for client: {self.client_id}")

    def _monitor_loop(self):
        """
        Main monitoring loop

        THREAD_BUS Integration:
        - Checks THREAD_BUS.is_shutdown_requested() for graceful shutdown
        - Triggers 'clipboard.changed' events when content changes
        """
        while THREAD_BUS.get_signal(self._running_signal, False):
            # THREAD_BUS Integration: Check if global shutdown was requested
            if THREAD_BUS.is_shutdown_requested():
                ColorPrint.yellow(f"[ClipboardMonitor] THREAD_BUS shutdown detected, stopping...")
                break

            # Get current clipboard content
            current_content = pyperclip.paste()

            # Check if changed
            last_content = THREAD_BUS.get_signal(self._content_signal, "")
            if current_content != last_content:
                if current_content and current_content.strip():
                    # Save to history
                    self.clipboard_history.add_item(
                        content=current_content,
                        client_id=self.client_id,
                        content_type="text"
                    )

                    # THREAD_BUS Integration: Trigger event (new mechanism)
                    THREAD_BUS.trigger_event('clipboard.changed', {
                        'content': current_content,
                        'content_type': 'text',
                        'client_id': self.client_id,
                        'timestamp': time.time()
                    }, async_mode=True)

                    # Call legacy callback (backward compatibility)
                    callback = THREAD_BUS.get_signal(self._callback_signal)
                    if callable(callback):
                        start_bus_task(
                            callback,
                            current_content,
                            thread_name="ClipboardChangeCallbackThread",
                        )

                    ColorPrint.blue(f"[ClipboardMonitor] Clipboard changed: {current_content[:50]}...")

                THREAD_BUS.signal(self._content_signal, current_content)

            # Sleep
            time.sleep(self.poll_interval)
        THREAD_BUS.signal(self._running_signal, False)

    @serialized_method
    def set_clipboard(self, content: str, add_to_history: bool = True):
        """
        Set clipboard content

        Args:
            content: Content to set
            add_to_history: Whether to add to history
        """
        pyperclip.copy(content)
        THREAD_BUS.signal(self._content_signal, content)

        if add_to_history:
            self.clipboard_history.add_item(
                content=content,
                client_id=self.client_id,
                content_type="text"
            )

        ColorPrint.green(f"[ClipboardMonitor] Clipboard set: {content[:50]}...")

    @serialized_method
    def set_change_callback(self, callback: Callable[[str], None]):
        """Set callback for clipboard changes"""
        THREAD_BUS.signal(self._callback_signal, callback)


_CLIPBOARD_MONITOR_PROVIDER = SerializedSingletonProvider(
    ClipboardMonitor,
    "clipboard.monitor.provider",
    "ClipboardMonitorProvider",
)


def get_clipboard_monitor(client_id: str = "system") -> ClipboardMonitor:
    """
    Get global clipboard monitor singleton

    Args:
        client_id: Client identifier

    Returns:
        ClipboardMonitor instance
    """
    return _CLIPBOARD_MONITOR_PROVIDER.get(client_id=client_id)
