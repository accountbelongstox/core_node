#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shutdown Manager - Unified Application Shutdown Controller

Handles all application shutdown logic in a centralized location,
ensuring proper resource cleanup and graceful termination.

Features:
- Centralized shutdown control
- Restart support
- Pre-shutdown hook system
- Thread-safe shutdown state management
- Resource cleanup coordination
- Shutdown timeout handling

Usage:
    from pycore.pyutils.native_ui import ShutdownManager

    # Get singleton instance
    shutdown_mgr = ShutdownManager()

    # Register pre-shutdown hooks
    def cleanup_resources():
        print("Cleaning up resources...")

    shutdown_mgr.add_shutdown_hook(cleanup_resources, priority=10)

    # Request shutdown
    shutdown_mgr.request_shutdown()

    # Or request restart
    shutdown_mgr.request_restart()

    # Check shutdown state
    if shutdown_mgr.is_shutdown_requested():
        print("Shutdown in progress")

    # Wait for shutdown completion
    shutdown_mgr.wait_for_completion(timeout=10.0)

Author: Extracted from d3-check, adapted for pycore
"""

import threading
import time
from typing import List, Callable, Optional, Tuple
from dataclasses import dataclass, field

from pycore import ColorPrint


@dataclass
class ShutdownHook:
    """
    Shutdown hook data structure

    Attributes:
        name: Hook name
        callback: Callback function to execute
        priority: Execution priority (higher = earlier execution)
        timeout: Maximum execution time in seconds
    """
    name: str
    callback: Callable
    priority: int = 0
    timeout: float = 5.0


class ShutdownManager:
    """
    Shutdown Manager - Unified application shutdown controller

    Singleton pattern implementation for global shutdown management.
    """

    _instance: Optional['ShutdownManager'] = None
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
        """Initialize shutdown manager (only once)"""
        if getattr(self, '_initialized', False):
            return

        # Shutdown state
        self._shutdown_requested = threading.Event()
        self._restart_requested = threading.Event()
        self._shutdown_completed = threading.Event()

        # Shutdown hooks
        self._hooks: List[ShutdownHook] = []
        self._hooks_lock = threading.Lock()

        # UI quit callback (for GUI applications)
        self._ui_quit_callback: Optional[Callable] = None

        ColorPrint.print_info("[ShutdownManager] Initialized (singleton)")
        self._initialized = True

    def register_ui_quit_callback(self, callback: Callable):
        """
        Register UI quit callback

        This callback will be called to quit the UI mainloop
        when shutdown is requested.

        Args:
            callback: Function to call to quit UI (e.g., root.quit())
        """
        self._ui_quit_callback = callback
        ColorPrint.print_info("[ShutdownManager] UI quit callback registered")

    def add_shutdown_hook(
        self,
        name: str,
        callback: Callable,
        priority: int = 0,
        timeout: float = 5.0
    ):
        """
        Add a shutdown hook

        Hooks are executed in priority order (higher priority first)
        when shutdown is performed.

        Args:
            name: Hook name
            callback: Function to execute on shutdown
            priority: Execution priority (higher = earlier)
            timeout: Maximum execution time
        """
        with self._hooks_lock:
            hook = ShutdownHook(
                name=name,
                callback=callback,
                priority=priority,
                timeout=timeout
            )
            self._hooks.append(hook)

            # Sort by priority (descending)
            self._hooks.sort(key=lambda h: h.priority, reverse=True)

            ColorPrint.print_info(
                f"[ShutdownManager] Added shutdown hook: {name} "
                f"(priority={priority})"
            )

    def remove_shutdown_hook(self, name: str) -> bool:
        """Remove a shutdown hook by name"""
        with self._hooks_lock:
            for i, hook in enumerate(self._hooks):
                if hook.name == name:
                    del self._hooks[i]
                    ColorPrint.print_info(
                        f"[ShutdownManager] Removed shutdown hook: {name}"
                    )
                    return True

        ColorPrint.print_warn(
            f"[ShutdownManager] Shutdown hook not found: {name}"
        )
        return False

    def request_shutdown(self):
        """
        Request application shutdown

        This is the ONLY method that should be called to trigger shutdown.
        It sets the shutdown flag and quits UI if registered.
        """
        if self._shutdown_requested.is_set():
            return

        ColorPrint.print_warn("=" * 60)
        ColorPrint.print_warn("[ShutdownManager] Shutdown requested")
        ColorPrint.print_warn("=" * 60)

        self._shutdown_requested.set()

        # Quit UI if callback registered
        if self._ui_quit_callback:
            try:
                ColorPrint.print_info(
                    "[ShutdownManager] Quitting UI mainloop..."
                )
                self._ui_quit_callback()
            except Exception as e:
                ColorPrint.print_error(
                    f"[ShutdownManager] Error quitting UI: {e}"
                )

    def request_restart(self):
        """
        Request application restart

        This sets both restart and shutdown flags.
        """
        if self._shutdown_requested.is_set():
            return

        ColorPrint.print_warn("=" * 60)
        ColorPrint.print_warn("[ShutdownManager] Restart requested")
        ColorPrint.print_warn("=" * 60)

        self._restart_requested.set()
        self._shutdown_requested.set()

        # Quit UI if callback registered
        if self._ui_quit_callback:
            try:
                ColorPrint.print_info(
                    "[ShutdownManager] Quitting UI for restart..."
                )
                self._ui_quit_callback()
            except Exception as e:
                ColorPrint.print_error(
                    f"[ShutdownManager] Error quitting UI: {e}"
                )

    def perform_shutdown(self) -> bool:
        """
        Perform shutdown sequence

        Executes all registered shutdown hooks in priority order.
        Should be called from main thread after UI quit.

        Returns:
            True if shutdown completed successfully
        """
        if not self._shutdown_requested.is_set():
            ColorPrint.print_warn(
                "[ShutdownManager] Shutdown not requested"
            )
            return False

        if self._shutdown_completed.is_set():
            ColorPrint.print_warn(
                "[ShutdownManager] Shutdown already completed"
            )
            return True

        ColorPrint.print_info("[ShutdownManager] Starting shutdown sequence...")

        # Execute shutdown hooks
        with self._hooks_lock:
            hooks = self._hooks.copy()

        for hook in hooks:
            try:
                ColorPrint.print_info(
                    f"[ShutdownManager] Executing hook: {hook.name}"
                )

                # Execute with timeout
                thread = threading.Thread(target=hook.callback)
                thread.start()
                thread.join(timeout=hook.timeout)

                if thread.is_alive():
                    ColorPrint.print_warn(
                        f"[ShutdownManager] Hook '{hook.name}' "
                        f"timed out after {hook.timeout}s"
                    )

            except Exception as e:
                ColorPrint.print_error(
                    f"[ShutdownManager] Error in hook '{hook.name}': {e}"
                )

        self._shutdown_completed.set()
        ColorPrint.print_success("[ShutdownManager] Shutdown sequence completed")

        return True

    def is_shutdown_requested(self) -> bool:
        """Check if shutdown has been requested"""
        return self._shutdown_requested.is_set()

    def is_restart_requested(self) -> bool:
        """Check if restart has been requested"""
        return self._restart_requested.is_set()

    def is_shutdown_completed(self) -> bool:
        """Check if shutdown sequence has completed"""
        return self._shutdown_completed.is_set()

    def wait_for_completion(self, timeout: Optional[float] = None) -> bool:
        """
        Wait for shutdown sequence to complete

        Args:
            timeout: Maximum time to wait in seconds (None = infinite)

        Returns:
            True if completed within timeout, False otherwise
        """
        return self._shutdown_completed.wait(timeout=timeout)

    def reset(self):
        """
        Reset shutdown manager state

        Use with caution - only for testing or restart scenarios.
        """
        self._shutdown_requested.clear()
        self._restart_requested.clear()
        self._shutdown_completed.clear()

        ColorPrint.print_info("[ShutdownManager] State reset")


def get_shutdown_manager() -> ShutdownManager:
    """
    Get the singleton ShutdownManager instance

    Returns:
        ShutdownManager singleton instance
    """
    return ShutdownManager()


# Export
__all__ = [
    'ShutdownManager',
    'ShutdownHook',
    'get_shutdown_manager'
]
