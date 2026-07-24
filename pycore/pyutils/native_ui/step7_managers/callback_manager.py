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
from pycore import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    init_serialized_owner,
    serialized_method,
)

import traceback



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
        init_serialized_owner(
            self,
            "native_ui.callback_manager.state",
            "CallbackManagerState",
        )

    @serialized_method
    def add_ready_callback(self, callback: Callable) -> None:
        """
        Add callback to ready queue

        Args:
            callback: Function to call when UI is ready (no parameters)

        Raises:
            ValueError: If callback is not callable
        """
        if not callable(callback):
            raise ValueError("Callback must be callable")
        self._ready_callbacks.append(callback)
        if self.debug:
            ColorPrint.print_info(f"[CallbackManager] Added ready callback: {callback.__name__}")

    @serialized_method
    def add_closed_callback(self, callback: Callable) -> None:
        """
        Add callback to closed queue

        Args:
            callback: Function to call when UI is closed (no parameters)

        Raises:
            ValueError: If callback is not callable
        """
        if not callable(callback):
            raise ValueError("Callback must be callable")
        self._closed_callbacks.append(callback)
        if self.debug:
            ColorPrint.print_info(f"[CallbackManager] Added closed callback: {callback.__name__}")

    @serialized_method
    def add_closing_callback(self, callback: Callable) -> None:
        """
        Add callback to closing queue

        Args:
            callback: Function to call before UI closes (no parameters)

        Raises:
            ValueError: If callback is not callable
        """
        if not callable(callback):
            raise ValueError("Callback must be callable")
        self._closing_callbacks.append(callback)
        if self.debug:
            ColorPrint.print_info(f"[CallbackManager] Added closing callback: {callback.__name__}")

    @serialized_method
    def set_restart_callback(self, callback: Callable) -> None:
        """
        Set restart callback (only one allowed)

        Args:
            callback: Function to call when restart is triggered (no parameters)

        Raises:
            ValueError: If callback is not callable
        """
        if not callable(callback):
            raise ValueError("Callback must be callable")
        self._restart_callback = callback
        if self.debug:
            ColorPrint.print_info(f"[CallbackManager] Set restart callback: {callback.__name__}")

    @serialized_method
    def execute_ready_callbacks(self) -> None:
        """
        Execute all ready callbacks in order

        Built-in logic executes first, then user callbacks.
        """
        if self.debug:
            ColorPrint.print_info(f"[CallbackManager] Executing {len(self._ready_callbacks)} ready callbacks")

        for i, callback in enumerate(self._ready_callbacks):
            try:
                if self.debug:
                    ColorPrint.print_info(f"[CallbackManager] Executing ready callback {i+1}/{len(self._ready_callbacks)}")
                callback()
            except Exception as e:
                ColorPrint.print_error(f"[CallbackManager] Error in ready callback {i+1}: {e}")
                traceback.print_exc()

    @serialized_method
    def execute_closed_callbacks(self) -> None:
        """
        Execute all closed callbacks in order

        Built-in cleanup executes first, then user callbacks.
        """
        if self.debug:
            ColorPrint.print_info(f"[CallbackManager] Executing {len(self._closed_callbacks)} closed callbacks")

        for i, callback in enumerate(self._closed_callbacks):
            try:
                if self.debug:
                    ColorPrint.print_info(f"[CallbackManager] Executing closed callback {i+1}/{len(self._closed_callbacks)}")
                callback()
            except Exception as e:
                ColorPrint.print_error(f"[CallbackManager] Error in closed callback {i+1}: {e}")
                traceback.print_exc()

    @serialized_method
    def execute_closing_callbacks(self) -> None:
        """
        Execute all closing callbacks in order

        User callbacks execute first, then built-in cleanup.
        This allows users to clean up before native UI cleanup.
        """
        if self.debug:
            ColorPrint.print_info(f"[CallbackManager] Executing {len(self._closing_callbacks)} closing callbacks")

        for i, callback in enumerate(self._closing_callbacks):
            try:
                if self.debug:
                    ColorPrint.print_info(f"[CallbackManager] Executing closing callback {i+1}/{len(self._closing_callbacks)}")
                callback()
            except Exception as e:
                ColorPrint.print_error(f"[CallbackManager] Error in closing callback {i+1}: {e}")
                traceback.print_exc()

    @serialized_method
    def execute_restart_callback(self) -> None:
        """Execute restart callback if set"""
        if self._restart_callback is None:
            if self.debug:
                ColorPrint.print_warn("[CallbackManager] No restart callback set")
            return

        if self.debug:
            ColorPrint.print_info("[CallbackManager] Executing restart callback")

        try:
            self._restart_callback()
        except Exception as e:
            ColorPrint.print_error(f"[CallbackManager] Error in restart callback: {e}")
            traceback.print_exc()

    @serialized_method
    def has_ready_callbacks(self) -> bool:
        """
        Check if there are any ready callbacks

        Returns:
            True if ready callbacks exist, False otherwise
        """
        return len(self._ready_callbacks) > 0

    @serialized_method
    def has_closed_callbacks(self) -> bool:
        """
        Check if there are any closed callbacks

        Returns:
            True if closed callbacks exist, False otherwise
        """
        return len(self._closed_callbacks) > 0

    @serialized_method
    def has_closing_callbacks(self) -> bool:
        """
        Check if there are any closing callbacks

        Returns:
            True if closing callbacks exist, False otherwise
        """
        return len(self._closing_callbacks) > 0

    @serialized_method
    def has_restart_callback(self) -> bool:
        """
        Check if restart callback is set

        Returns:
            True if restart callback is set, False otherwise
        """
        return self._restart_callback is not None

    @serialized_method
    def clear_all(self) -> None:
        """Clear all callback queues and reset restart callback"""
        self._ready_callbacks.clear()
        self._closed_callbacks.clear()
        self._closing_callbacks.clear()
        self._restart_callback = None
        if self.debug:
            ColorPrint.print_info("[CallbackManager] Cleared all callbacks")


_CALLBACK_MANAGER_PROVIDER = SerializedSingletonProvider(
    CallbackManager,
    "native_ui.callback_manager.provider",
    "CallbackManagerProvider",
)


def get_callback_manager(debug: bool = False) -> CallbackManager:
    """
    Get singleton CallbackManager instance

    Args:
        debug: Enable debug output (only applies on first call)

    Returns:
        CallbackManager singleton instance
    """
    return _CALLBACK_MANAGER_PROVIDER.get(debug=debug)
