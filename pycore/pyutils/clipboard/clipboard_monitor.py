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
from pycore import THREAD_BUS, ColorPrint
from pycore.pyfoundations.third_party import get_third_package_pyperclip
from pycore.pyutils.clipboard.clipboard_history import get_clipboard_history
from pycore.pyfoundations.serialized_worker import start_bus_task

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

        # Monitor state
        self.running = False
        self.monitor_thread: Optional[threading.Thread] = None
        self.last_content = ""

        # Callback
        self.on_change: Optional[Callable[[str], None]] = None

    def start(self):
        """Start monitoring clipboard"""
        if self.running:
            ColorPrint.yellow(f"[ClipboardMonitor] Already running for client: {self.client_id}")
            return

        self.running = True

        # Get initial clipboard content
        self.last_content = pyperclip.paste()

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

    def stop(self):
        """Stop monitoring clipboard"""
        if not self.running:
            return

        self.running = False

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
        while self.running:
            # THREAD_BUS Integration: Check if global shutdown was requested
            if THREAD_BUS.is_shutdown_requested():
                ColorPrint.yellow(f"[ClipboardMonitor] THREAD_BUS shutdown detected, stopping...")
                break

            # Get current clipboard content
            current_content = pyperclip.paste()

            # Check if changed
            if current_content != self.last_content:
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
                    if self.on_change:
                        self.on_change(current_content)

                    ColorPrint.blue(f"[ClipboardMonitor] Clipboard changed: {current_content[:50]}...")

                self.last_content = current_content

            # Sleep
            time.sleep(self.poll_interval)

    def set_clipboard(self, content: str, add_to_history: bool = True):
        """
        Set clipboard content

        Args:
            content: Content to set
            add_to_history: Whether to add to history
        """
        pyperclip.copy(content)
        self.last_content = content

        if add_to_history:
            self.clipboard_history.add_item(
                content=content,
                client_id=self.client_id,
                content_type="text"
            )

        ColorPrint.green(f"[ClipboardMonitor] Clipboard set: {content[:50]}...")

    def set_change_callback(self, callback: Callable[[str], None]):
        """Set callback for clipboard changes"""
        self.on_change = callback


# Global singleton instance
_global_clipboard_monitor: Optional[ClipboardMonitor] = None


def get_clipboard_monitor(client_id: str = "system") -> ClipboardMonitor:
    """
    Get global clipboard monitor singleton

    Args:
        client_id: Client identifier

    Returns:
        ClipboardMonitor instance
    """
    global _global_clipboard_monitor
    if _global_clipboard_monitor is None:
        _global_clipboard_monitor = ClipboardMonitor(client_id=client_id)
    return _global_clipboard_monitor
