#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Callback Manager - Queue-based callback execution

Manages callback queues for UI lifecycle events:
- on_ready: When UI is ready
- on_closed: When UI is closed
- on_closing: Before UI closes (cleanup)

Supports multiple callbacks executed in order.
"""

from typing import List, Callable, Optional
from pycore.pyfoundations import ColorPrint


class CallbackManager:
    """
    Manages callback queues for UI lifecycle events

    Usage:
        manager = CallbackManager(debug=True)

        # Add callbacks
        manager.add_ready_callback(lambda: print("Ready 1"))
        manager.add_ready_callback(lambda: print("Ready 2"))

        # Execute callbacks
        manager.execute_ready_callbacks()
    """

    def __init__(self, debug: bool = False):
        """
        Initialize callback manager

        Args:
            debug: Enable debug output
        """
        self.debug = debug

        # Callback queues
        self._ready_callbacks: List[Callable] = []
        self._closed_callbacks: List[Callable] = []
        self._closing_callbacks: List[Callable] = []

        # Restart callback (single)
        self._restart_callback: Optional[Callable] = None

    def add_ready_callback(self, callback: Callable) -> None:
        """Add callback to ready queue"""
        if not callable(callback):
            raise ValueError("Callback must be callable")
        self._ready_callbacks.append(callback)
        if self.debug:
            ColorPrint.blue(f"[CallbackManager] Added ready callback: {callback.__name__}")

    def add_closed_callback(self, callback: Callable) -> None:
        """Add callback to closed queue"""
        if not callable(callback):
            raise ValueError("Callback must be callable")
        self._closed_callbacks.append(callback)
        if self.debug:
            ColorPrint.blue(f"[CallbackManager] Added closed callback: {callback.__name__}")

    def add_closing_callback(self, callback: Callable) -> None:
        """Add callback to closing queue"""
        if not callable(callback):
            raise ValueError("Callback must be callable")
        self._closing_callbacks.append(callback)
        if self.debug:
            ColorPrint.blue(f"[CallbackManager] Added closing callback: {callback.__name__}")

    def set_restart_callback(self, callback: Callable) -> None:
        """Set restart callback (only one allowed)"""
        if not callable(callback):
            raise ValueError("Callback must be callable")
        self._restart_callback = callback
        if self.debug:
            ColorPrint.blue(f"[CallbackManager] Set restart callback: {callback.__name__}")

    def execute_ready_callbacks(self) -> None:
        """
        Execute all ready callbacks in order

        Built-in logic executes first, then user callbacks.
        """
        if self.debug:
            ColorPrint.blue(f"[CallbackManager] Executing {len(self._ready_callbacks)} ready callbacks")

        for i, callback in enumerate(self._ready_callbacks):
            try:
                if self.debug:
                    ColorPrint.blue(f"[CallbackManager] Executing ready callback {i+1}/{len(self._ready_callbacks)}")
                callback()
            except Exception as e:
                ColorPrint.red(f"[CallbackManager] Error in ready callback {i+1}: {e}")
                import traceback
                traceback.print_exc()

    def execute_closed_callbacks(self) -> None:
        """
        Execute all closed callbacks in order

        Built-in cleanup executes first, then user callbacks.
        """
        if self.debug:
            ColorPrint.blue(f"[CallbackManager] Executing {len(self._closed_callbacks)} closed callbacks")

        for i, callback in enumerate(self._closed_callbacks):
            try:
                if self.debug:
                    ColorPrint.blue(f"[CallbackManager] Executing closed callback {i+1}/{len(self._closed_callbacks)}")
                callback()
            except Exception as e:
                ColorPrint.red(f"[CallbackManager] Error in closed callback {i+1}: {e}")
                import traceback
                traceback.print_exc()

    def execute_closing_callbacks(self) -> None:
        """
        Execute all closing callbacks in order

        User callbacks execute first, then built-in cleanup.
        This allows users to clean up before native UI cleanup.
        """
        if self.debug:
            ColorPrint.blue(f"[CallbackManager] Executing {len(self._closing_callbacks)} closing callbacks")

        for i, callback in enumerate(self._closing_callbacks):
            try:
                if self.debug:
                    ColorPrint.blue(f"[CallbackManager] Executing closing callback {i+1}/{len(self._closing_callbacks)}")
                callback()
            except Exception as e:
                ColorPrint.red(f"[CallbackManager] Error in closing callback {i+1}: {e}")
                import traceback
                traceback.print_exc()

    def execute_restart_callback(self) -> None:
        """Execute restart callback if set"""
        if self._restart_callback is None:
            if self.debug:
                ColorPrint.yellow("[CallbackManager] No restart callback set")
            return

        if self.debug:
            ColorPrint.blue("[CallbackManager] Executing restart callback")

        try:
            self._restart_callback()
        except Exception as e:
            ColorPrint.red(f"[CallbackManager] Error in restart callback: {e}")
            import traceback
            traceback.print_exc()

    def has_ready_callbacks(self) -> bool:
        """Check if there are any ready callbacks"""
        return len(self._ready_callbacks) > 0

    def has_closed_callbacks(self) -> bool:
        """Check if there are any closed callbacks"""
        return len(self._closed_callbacks) > 0

    def has_closing_callbacks(self) -> bool:
        """Check if there are any closing callbacks"""
        return len(self._closing_callbacks) > 0

    def has_restart_callback(self) -> bool:
        """Check if restart callback is set"""
        return self._restart_callback is not None

    def clear_all(self) -> None:
        """Clear all callback queues"""
        self._ready_callbacks.clear()
        self._closed_callbacks.clear()
        self._closing_callbacks.clear()
        self._restart_callback = None
        if self.debug:
            ColorPrint.blue("[CallbackManager] Cleared all callbacks")
