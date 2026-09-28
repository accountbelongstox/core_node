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
    from pycore.pyutils.native_ui.step7_managers.shutdown_manager import shutdown_manager

    # Register pre-shutdown hooks
    def cleanup_resources():
        print("Cleaning up resources...")

    shutdown_manager.add_shutdown_hook(cleanup_resources, priority=10)

    # Request shutdown
    shutdown_manager.request_shutdown()

    # Or request restart
    shutdown_manager.request_restart()

    # Check shutdown state
    if shutdown_manager.is_shutdown_requested():
        print("Shutdown in progress")

    # Wait for shutdown completion
    shutdown_manager.wait_for_completion(timeout=10.0)

Author: Extracted from d3-check, adapted for pycore
"""

from pycore.pyfoundations.serialized_worker import (
    SerializedSingletonProvider,
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
import time
from typing import List, Callable, Optional, Tuple
from dataclasses import dataclass, field

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS


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

    def __init__(self):
        """Initialize shutdown manager."""
        # Shutdown state
        self._signal_prefix = f'pyutils.native_ui.shutdown.{id(self)}'

        # Shutdown hooks
        self._hooks: List[ShutdownHook] = []
        init_serialized_owner(
            self,
            'pyutils.native_ui.shutdown.hooks',
            'NativeUIShutdownHooksThread',
        )

        # UI quit callback (for GUI applications)
        THREAD_BUS.signal(f'{self._signal_prefix}.ui_quit', None)

        ColorPrint.print_info("[ShutdownManager] Initialized (singleton)")

    def register_ui_quit_callback(self, callback: Callable):
        """
        Register UI quit callback

        This callback will be called to quit the UI mainloop
        when shutdown is requested.

        Args:
            callback: Function to call to quit UI (e.g., root.quit())
        """
        THREAD_BUS.signal(f'{self._signal_prefix}.ui_quit', callback)
        ColorPrint.print_info("[ShutdownManager] UI quit callback registered")

    @serialized_method
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
        hook = ShutdownHook(
            name=name,
            callback=callback,
            priority=priority,
            timeout=timeout
        )
        self._hooks.append(hook)
        self._hooks.sort(key=lambda h: h.priority, reverse=True)
        ColorPrint.print_info(
            f"[ShutdownManager] Added shutdown hook: {name} "
            f"(priority={priority})"
        )

    @serialized_method
    def remove_shutdown_hook(self, name: str) -> bool:
        """Remove a shutdown hook by name"""
        for index, hook in enumerate(self._hooks):
            if hook.name == name:
                del self._hooks[index]
                ColorPrint.print_info(
                    f"[ShutdownManager] Removed shutdown hook: {name}"
                )
                return True

        ColorPrint.print_warn(
            f"[ShutdownManager] Shutdown hook not found: {name}"
        )
        return False

    @serialized_method
    def _hook_snapshot(self) -> List[ShutdownHook]:
        """Return the ordered shutdown-hook snapshot."""
        return list(self._hooks)

    def request_shutdown(self):
        """
        Request application shutdown

        This is the ONLY method that should be called to trigger shutdown.
        It sets the shutdown flag and quits UI if registered.
        """
        if THREAD_BUS.has_signal(f'{self._signal_prefix}.requested'):
            return

        ColorPrint.print_warn("=" * 60)
        ColorPrint.print_warn("[ShutdownManager] Shutdown requested")
        ColorPrint.print_warn("=" * 60)

        THREAD_BUS.signal(f'{self._signal_prefix}.requested', True)

        # Quit UI if callback registered
        ui_quit_callback = THREAD_BUS.get_signal(f'{self._signal_prefix}.ui_quit')
        if ui_quit_callback:
            try:
                ColorPrint.print_info(
                    "[ShutdownManager] Quitting UI mainloop..."
                )
                ui_quit_callback()
            except Exception as e:
                ColorPrint.print_error(
                    f"[ShutdownManager] Error quitting UI: {e}"
                )

    def request_restart(self):
        """
        Request application restart

        This sets both restart and shutdown flags.
        """
        if THREAD_BUS.has_signal(f'{self._signal_prefix}.requested'):
            return

        ColorPrint.print_warn("=" * 60)
        ColorPrint.print_warn("[ShutdownManager] Restart requested")
        ColorPrint.print_warn("=" * 60)

        THREAD_BUS.signal(f'{self._signal_prefix}.restart', True)
        THREAD_BUS.signal(f'{self._signal_prefix}.requested', True)

        # Quit UI if callback registered
        ui_quit_callback = THREAD_BUS.get_signal(f'{self._signal_prefix}.ui_quit')
        if ui_quit_callback:
            try:
                ColorPrint.print_info(
                    "[ShutdownManager] Quitting UI for restart..."
                )
                ui_quit_callback()
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
        if not THREAD_BUS.has_signal(f'{self._signal_prefix}.requested'):
            ColorPrint.print_warn(
                "[ShutdownManager] Shutdown not requested"
            )
            return False

        if THREAD_BUS.has_signal(f'{self._signal_prefix}.completed'):
            ColorPrint.print_warn(
                "[ShutdownManager] Shutdown already completed"
            )
            return True

        ColorPrint.print_info("[ShutdownManager] Starting shutdown sequence...")

        # Execute shutdown hooks
        hooks = self._hook_snapshot()

        for hook in hooks:
            try:
                ColorPrint.print_info(
                    f"[ShutdownManager] Executing hook: {hook.name}"
                )

                # Execute with timeout
                thread = start_bus_task(
                    hook.callback,
                    thread_name=f"ShutdownHookThread-{hook.name}",
                )
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

        THREAD_BUS.signal(f'{self._signal_prefix}.completed', True)
        ColorPrint.print_success("[ShutdownManager] Shutdown sequence completed")

        return True

    def is_shutdown_requested(self) -> bool:
        """Check if shutdown has been requested"""
        return THREAD_BUS.has_signal(f'{self._signal_prefix}.requested')

    def is_restart_requested(self) -> bool:
        """Check if restart has been requested"""
        return THREAD_BUS.has_signal(f'{self._signal_prefix}.restart')

    def is_shutdown_completed(self) -> bool:
        """Check if shutdown sequence has completed"""
        return THREAD_BUS.has_signal(f'{self._signal_prefix}.completed')

    def wait_for_completion(self, timeout: Optional[float] = None) -> bool:
        """
        Wait for shutdown sequence to complete

        Args:
            timeout: Maximum time to wait in seconds (None = infinite)

        Returns:
            True if completed within timeout, False otherwise
        """
        return bool(THREAD_BUS.wait_signal(
            f'{self._signal_prefix}.completed',
            timeout=timeout,
        ))

    def reset(self):
        """
        Reset shutdown manager state

        Use with caution - only for testing or restart scenarios.
        """
        THREAD_BUS.clear_signal(f'{self._signal_prefix}.requested')
        THREAD_BUS.clear_signal(f'{self._signal_prefix}.restart')
        THREAD_BUS.clear_signal(f'{self._signal_prefix}.completed')

        ColorPrint.print_info("[ShutdownManager] State reset")


_SHUTDOWN_MANAGER_PROVIDER = SerializedSingletonProvider(
    ShutdownManager,
    "native_ui.shutdown_manager.provider",
    "ShutdownManagerProvider",
)

shutdown_manager = _SHUTDOWN_MANAGER_PROVIDER.get()


# Export
__all__ = [
    'ShutdownManager',
    'ShutdownHook',
    'shutdown_manager',
]
