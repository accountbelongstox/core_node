#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shutdown Stack - extracted from ThreadBus

Stack-based global shutdown handler registry. Handlers execute in priority
order (lower number = earlier shutdown), producing a stack effect where child
subsystems (lower priority) shut down before the main process (higher priority).

This class is a stateless strategy operating on the owning ThreadBus state
thread.

TODO (reuse batch): consolidate with the near-duplicate
pycore/pyfoundations/shutdown_manager.py once that module is reconciled.
"""

import threading
import traceback
from typing import Callable, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


class ShutdownStack:
    """
    Stack-based shutdown handler registry.

    Owns no state: all shutdown state (_shutdown_handlers list,
    _shutdown_executed / _restart_requested flags, and the signal store used
    for shutdown/restart signaling) lives on the composing ThreadBus instance.
    """

    def __init__(self, bus):
        """
        Args:
            bus: the owning ThreadBus instance. Provides shutdown state
                 containers
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
        def register() -> str:
            handler_name = name
            if handler_name is None:
                handler_name = f"handler_{len(self._bus._shutdown_handlers)}"

            handlers = [
                registered
                for registered in self._bus._shutdown_handlers
                if registered[1] != handler_name
            ]
            handlers.append((priority, handler_name, handler))
            handlers.sort(key=lambda item: item[0])
            self._bus._shutdown_handlers = handlers
            return handler_name

        return self._bus._call_state(register)

    def unregister_shutdown_handler(self, name: str) -> bool:
        """
        Unregister shutdown handler

        Args:
            name: Handler name

        Returns:
            True if handler was removed
        """
        def unregister() -> bool:
            handlers = self._bus._shutdown_handlers
            updated_handlers = [
                handler for handler in handlers if handler[1] != name
            ]
            self._bus._shutdown_handlers = updated_handlers
            return len(updated_handlers) < len(handlers)

        return bool(self._bus._call_state(unregister))

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
        def claim_shutdown() -> Optional[tuple]:
            if self._bus._shutdown_executed:
                return None
            handlers = tuple(self._bus._shutdown_handlers)
            self._bus._shutdown_executed = True
            return handlers

        handlers = self._bus._call_state(claim_shutdown)
        if handlers is None:
            return

        if not handlers:
            return

        ColorPrint.blue(f"[ThreadBus] Executing shutdown stack: {reason}")
        ColorPrint.blue(f"[ThreadBus] Shutdown order: {[item[1] for item in handlers]}")

        for priority, name, handler in handlers:
            try:
                ColorPrint.blue(
                    f"[ThreadBus] Executing shutdown handler: {name} "
                    f"(priority: {priority})"
                )
                handler()
            except Exception as exc:
                ColorPrint.red(
                    f"[ThreadBus] Error in shutdown handler '{name}': {exc}"
                )

        ColorPrint.blue("[ThreadBus] Shutdown stack execution completed")

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
            ColorPrint.yellow(
                f"[ThreadBus] >>> SHUTDOWN REQUESTED <<< reason='{reason}' "
                f"thread='{current.name}' (id={threading.get_ident()})"
            )
            # Drop this frame (extract_stack includes the current line); keep the
            # last few callers so the originating module:line is obvious.
            frames = traceback.extract_stack()[:-1]
            for f in frames[-8:]:
                ColorPrint.yellow(
                    f"[ThreadBus]     at {f.filename}:{f.lineno} {f.name}()"
                )

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
        self._bus._call_state(
            setattr,
            self._bus,
            '_restart_requested',
            True,
        )

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
        return bool(self._bus._call_state(
            getattr,
            self._bus,
            '_restart_requested',
        ))

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
        self._bus.clear_signal('global.shutdown.requested')
        self._bus._call_state(
            setattr,
            self._bus,
            '_shutdown_executed',
            False,
        )

    def get_shutdown_handlers(self) -> List[tuple]:
        """
        Get list of registered shutdown handlers

        Returns:
            List of (priority, name, handler) tuples sorted by priority
        """
        return self._bus._call_state(
            lambda: list(self._bus._shutdown_handlers)
        )
