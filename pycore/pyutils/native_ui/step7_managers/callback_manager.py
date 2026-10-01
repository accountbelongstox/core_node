#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Callback Manager - ordered UI lifecycle callbacks (ready / closing / closed / restart).

One instance per launched UI; queues live on a THREAD_BUS state owner.
"""

import traceback
from typing import Callable, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method


class CallbackManager:
    """Callback queues for UI lifecycle events, executed in registration order."""

    def __init__(self, debug: bool = False):
        self.debug = debug
        self._ready_callbacks: List[Callable] = []
        self._closed_callbacks: List[Callable] = []
        self._closing_callbacks: List[Callable] = []
        self._restart_callback: Optional[Callable] = None
        init_serialized_owner(
            self,
            "native_ui.callback_manager.state",
            "CallbackManagerState",
        )

    def _add(self, queue: List[Callable], kind: str, callback: Callable) -> None:
        if not callable(callback):
            raise ValueError(f"{kind} callback must be callable")
        queue.append(callback)
        if self.debug:
            ColorPrint.print_info(f"[CallbackManager] Added {kind} callback: {callback.__name__}")

    def _run(self, kind: str, callbacks: List[Callable]) -> None:
        """Run user callbacks; one failing callback is reported and does not stop the rest."""
        if self.debug:
            ColorPrint.print_info(f"[CallbackManager] Executing {len(callbacks)} {kind} callbacks")
        for index, callback in enumerate(callbacks, start=1):
            try:
                callback()
            except Exception as e:  # user callback boundary
                ColorPrint.print_error(
                    f"[CallbackManager] {kind} callback {index}/{len(callbacks)} "
                    f"({getattr(callback, '__name__', callback)}) failed: {e}"
                )
                ColorPrint.red(traceback.format_exc())

    @serialized_method
    def add_ready_callback(self, callback: Callable) -> None:
        self._add(self._ready_callbacks, "ready", callback)

    @serialized_method
    def add_closed_callback(self, callback: Callable) -> None:
        self._add(self._closed_callbacks, "closed", callback)

    @serialized_method
    def add_closing_callback(self, callback: Callable) -> None:
        self._add(self._closing_callbacks, "closing", callback)

    @serialized_method
    def set_restart_callback(self, callback: Callable) -> None:
        if not callable(callback):
            raise ValueError("restart callback must be callable")
        self._restart_callback = callback

    @serialized_method
    def execute_ready_callbacks(self) -> None:
        self._run("ready", list(self._ready_callbacks))

    @serialized_method
    def execute_closing_callbacks(self) -> None:
        self._run("closing", list(self._closing_callbacks))

    @serialized_method
    def execute_closed_callbacks(self) -> None:
        self._run("closed", list(self._closed_callbacks))

    @serialized_method
    def execute_restart_callback(self) -> None:
        if self._restart_callback is not None:
            self._run("restart", [self._restart_callback])
