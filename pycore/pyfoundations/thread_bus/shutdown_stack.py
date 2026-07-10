#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shutdown Stack - extracted from ThreadBus

Stack-based global shutdown handler registry. Handlers execute in priority
order (lower number = earlier shutdown), producing a stack effect where child
subsystems (lower priority) shut down before the main process (higher priority).

This class is a stateless strategy operating on the owning ThreadBus's shared
RLock and shutdown state containers. The ThreadBus instance owns the ONE RLock
plus all internal dicts/lists; ShutdownStack only references them via the bus
so thread-safety is never split across separate locks.

TODO (reuse batch): consolidate with the near-duplicate
pycore/pyfoundations/shutdown_manager.py once that module is reconciled.
"""

import threading
import traceback
from typing import Callable, List, Optional


class ShutdownStack:
    """
    Stack-based shutdown handler registry.

    Owns no state: all shutdown state (_shutdown_handlers list,
    _shutdown_executed / _restart_requested flags, and the signal store used
    for shutdown/restart signaling) lives on the composing ThreadBus instance
    and is guarded by the bus's single shared RLock.
    """

    def __init__(self, bus):
        """
        Args:
            bus: the owning ThreadBus instance. Provides the shared RLock
                 (bus._lock), the shutdown state containers
                 (bus._shutdown_handlers / bus._shutdown_executed /
                 bus._restart_requested) and the signal store
                 (bus._signals / bus._events) used for shutdown signaling.
        """
        self._bus = bus

    def register_shutdown_handler(
        self,
        handler: Callable,
        priority: int = 100,
        name: Optional[str] = None
    ) -> str:
        """
        Register shutdown handler in the shutdown stack

        Shutdown handlers are executed in priority order (lower priority first).
        This creates a stack effect: child processes (lower priority) shut down
        before main process (higher priority).

        Args:
            handler: Shutdown handler function
            priority: Execution priority (lower = earlier shutdown)
                     Examples: RPC=50, Speech=60, Heartbeat=100
            name: Handler name (auto-generated if None)

        Returns:
            Handler name (for unregistration)

        Example:
            def cleanup_rpc():
                print("Closing RPC server...")
                rpc_server.stop()

            THREAD_BUS.register_shutdown_handler(
                cleanup_rpc,
                priority=50,
                name="rpc_cleanup"
            )
        """
        with self._bus._lock:
            if name is None:
                name = f"handler_{len(self._bus._shutdown_handlers)}"

            # Check if already registered
            existing = [h for h in self._bus._shutdown_handlers if h[1] == name]
            if existing:
                # Replace existing handler
                self._bus._shutdown_handlers = [h for h in self._bus._shutdown_handlers if h[1] != name]

            # Add handler
            self._bus._shutdown_handlers.append((priority, name, handler))

            # Sort by priority (lower priority executes first)
            self._bus._shutdown_handlers.sort(key=lambda x: x[0])

            return name

    def unregister_shutdown_handler(self, name: str) -> bool:
        """
        Unregister shutdown handler

        Args:
            name: Handler name

        Returns:
            True if handler was removed
        """
        with self._bus._lock:
            original_len = len(self._bus._shutdown_handlers)
            self._bus._shutdown_handlers = [
                h for h in self._bus._shutdown_handlers if h[1] != name
            ]
            return len(self._bus._shutdown_handlers) < original_len

    def execute_shutdown(self, reason: str = "User requested shutdown") -> None:
        """
        Execute all registered shutdown handlers in priority order

        This is the core of the shutdown stack system.
        Handlers are executed in order: lower priority first (子进程先关).

        Args:
            reason: Reason for shutdown

        Example:
            THREAD_BUS.execute_shutdown("Application closing")
            # Executes: RPC(50) -> Speech(60) -> Heartbeat(100)
        """
        with self._bus._lock:
            if self._bus._shutdown_executed:
                return

            handlers = list(self._bus._shutdown_handlers)
            self._bus._shutdown_executed = True

        if not handlers:
            return

        print(f"[ThreadBus] Executing shutdown stack: {reason}")
        print(f"[ThreadBus] Shutdown order: {[h[1] for h in handlers]}")

        for priority, name, handler in handlers:
            try:
                print(f"[ThreadBus] Executing shutdown handler: {name} (priority: {priority})")
                handler()
            except Exception as e:
                print(f"[ThreadBus] Error in shutdown handler '{name}': {e}")

        print(f"[ThreadBus] Shutdown stack execution completed")

    def request_shutdown(
        self,
        reason: str = "User requested shutdown",
        execute_handlers: bool = True
    ) -> None:
        """
        Request global application shutdown

        Sends a shutdown signal that can be monitored by all threads.
        Optionally executes all registered shutdown handlers.

        Args:
            reason: Reason for shutdown
            execute_handlers: If True, execute shutdown handlers immediately

        Example:
            # Request shutdown and execute handlers
            THREAD_BUS.request_shutdown("Replacing with new instance")

            # Or just signal (let threads handle it themselves)
            THREAD_BUS.request_shutdown("User exit", execute_handlers=False)
        """
        # Shutdown-source diagnostics: print WHO requested the shutdown and the
        # call stack that led here. This is the single load-bearing line for
        # answering "why did the process exit" - the reason names the trigger
        # (singleton takeover / tray / Ctrl+C / UI window / API) and the trimmed
        # stack pinpoints the exact call site. Cheap (only runs on shutdown).
        if not self._bus.has_signal('global.shutdown.requested'):
            current = threading.current_thread()
            print(f"[ThreadBus] >>> SHUTDOWN REQUESTED <<< reason='{reason}' "
                  f"thread='{current.name}' (id={threading.get_ident()})")
            # Drop this frame (extract_stack includes the current line); keep the
            # last few callers so the originating module:line is obvious.
            frames = traceback.extract_stack()[:-1]
            for f in frames[-8:]:
                print(f"[ThreadBus]     at {f.filename}:{f.lineno} {f.name}()")

        self._bus.signal('global.shutdown.requested', {
            'reason': reason,
            'requester_thread_id': threading.get_ident()
        })

        if execute_handlers:
            self.execute_shutdown(reason)

    def request_restart(
        self,
        reason: str = "User requested restart",
        execute_handlers: bool = True
    ) -> None:
        """
        Request global application restart

        Sets restart flag and triggers shutdown sequence.
        After shutdown completes, the application should restart using os.execv().

        Args:
            reason: Reason for restart
            execute_handlers: If True, execute shutdown handlers immediately

        Example:
            # Request restart via API
            THREAD_BUS.request_restart("API restart request")

            # In main loop after shutdown:
            if THREAD_BUS.is_restart_requested():
                import os, sys
                os.execv(sys.executable, [sys.executable] + sys.argv)
        """
        with self._bus._lock:
            self._bus._restart_requested = True

        # Signal restart (in addition to shutdown)
        self._bus.signal('global.restart.requested', {
            'reason': reason,
            'requester_thread_id': threading.get_ident()
        })

        # Request shutdown with restart flag set
        self.request_shutdown(reason, execute_handlers)

    def is_shutdown_requested(self) -> bool:
        """
        Check if global shutdown has been requested

        Returns:
            True if shutdown signal exists

        Example:
            if THREAD_BUS.is_shutdown_requested():
                print("Shutdown requested, cleaning up...")
                break
        """
        return self._bus.has_signal('global.shutdown.requested')

    def is_restart_requested(self) -> bool:
        """
        Check if restart was requested (used after shutdown)

        Returns:
            True if restart flag is set

        Example:
            if THREAD_BUS.is_restart_requested():
                # Restart process
                os.execv(sys.executable, [sys.executable] + sys.argv)
        """
        with self._bus._lock:
            return self._bus._restart_requested

    def get_shutdown_reason(self) -> Optional[str]:
        """
        Get reason for shutdown request

        Returns:
            Shutdown reason string or None if no shutdown requested
        """
        data = self._bus.get_signal('global.shutdown.requested')
        if data and isinstance(data, dict):
            return data.get('reason')
        return None

    def clear_shutdown(self) -> None:
        """
        Clear shutdown request signal and reset execution flag

        Use this after handling shutdown to reset state.
        """
        with self._bus._lock:
            if 'global.shutdown.requested' in self._bus._signals:
                del self._bus._signals['global.shutdown.requested']
            if 'global.shutdown.requested' in self._bus._events:
                self._bus._events['global.shutdown.requested'].clear()
            self._bus._shutdown_executed = False

    def get_shutdown_handlers(self) -> List[tuple]:
        """
        Get list of registered shutdown handlers

        Returns:
            List of (priority, name, handler) tuples sorted by priority
        """
        with self._bus._lock:
            return list(self._bus._shutdown_handlers)
