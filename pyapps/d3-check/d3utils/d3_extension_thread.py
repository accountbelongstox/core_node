#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3 Extension Thread
Single dedicated thread for all D3/ROSBOT extension work: login check, start/stop ROSBOT.
Commands received via queue (filled by event center handlers); completion reported
via event center (trigger_extension_rosbot_started/stopped), not direct callbacks.
Start ROSBOT (ROSBOT_FLOW_MERMAID): B/D/C -> C8 success -> F2 -> F2 no -> E1-E6 -> started(ran_e_block=True).
"""

import queue
import threading
from typing import Callable, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from d3utils.task_thread_manager import get_task_manager, TaskStatus
from d3utils.rosbot_task_registry import get_start_rosbot_task, get_stop_rosbot_task
from d3utils.event_signals import trigger_extension_rosbot_started, trigger_extension_rosbot_stopped
from d3utils.rosbot_flow_state import get_flow_master_enabled
from d3utils.rosbot_flow_f2_rosbot_online import run_f2_rosbot_online
from d3utils.rosbot_flow.flow_e_rosbot_run import (
    run_e1_kill,
    run_e2_sleep,
    run_e3_update_flow,
    run_e4_start,
    run_e5_init,
    run_e5a_wait_win_srv_poll_click,
    run_e6_done,
)
from d3utils.rosbot_ui_automation import run_after_rosbot_start

from providor.constants.common import CMD_START_ROSBOT, CMD_STOP_ROSBOT, CMD_SHUTDOWN


class D3ExtensionThread(threading.Thread):
    """
    Dedicated thread for D3 extension. Commands come from event center (handler puts to queue).
    Completion is reported via event center (trigger_extension_rosbot_started/stopped).
    battlenet_login_check_provider: callable() -> bool, injected by controller (no controller import here).
    """

    def __init__(self, battlenet_login_check_provider: Optional[Callable[[], bool]] = None):
        threading.Thread.__init__(self, daemon=True)
        self._command_queue: queue.Queue[str] = queue.Queue()
        self._shutdown = threading.Event()
        self._battlenet_login_check_provider = battlenet_login_check_provider

    def put_command(self, cmd: str) -> None:
        """Send command to D3 thread (call from main thread / UI)."""
        self._command_queue.put(cmd)

    def request_shutdown(self) -> None:
        """Request thread to exit (e.g. on app shutdown)."""
        self._shutdown.set()
        self._command_queue.put(CMD_SHUTDOWN)

    def run(self) -> None:
        ColorPrint.blue("[D3ExtensionThread] Started")
        while not self._shutdown.is_set():
            try:
                try:
                    cmd = self._command_queue.get(timeout=0.1)
                except queue.Empty:
                    continue
                if cmd == CMD_SHUTDOWN:
                    break
                if cmd == CMD_START_ROSBOT:
                    self._do_start_rosbot()
                elif cmd == CMD_STOP_ROSBOT:
                    self._do_stop_rosbot()
            except Exception as e:
                ColorPrint.red(f"[D3ExtensionThread] Error handling command: {e}")
        ColorPrint.yellow("[D3ExtensionThread] Stopped")

    def _do_start_rosbot(self) -> None:
        # ROSBOT_FLOW_MERMAID: B/D/C -> C8 success -> F2 -> F2 no -> E1-E6 -> started(ran_e_block=True). All in this thread, tick-driven entry only.
        # Flow gate: if state disabled skip entire path, do not call third-party; only driven by tick/flow.
        if not get_flow_master_enabled():
            trigger_extension_rosbot_started(False, None, False)
            return
        result = False
        err = None
        ran_e_block = False
        try:
            if self._battlenet_login_check_provider:
                result = self._battlenet_login_check_provider()
            else:
                result = False
            if not get_flow_master_enabled():
                trigger_extension_rosbot_started(False, None, False)
                return
            if result:
                step = run_f2_rosbot_online()
                if step == "c1":
                    ColorPrint.gray("[D3ExtensionThread] F2: ROSBOT not online -> E1-E6 (Start ROSBOT)")
                    run_e1_kill()
                    run_e2_sleep(1.0)
                    proceed, _ = run_e3_update_flow(ask_confirm_callback=None)
                    if proceed and run_e4_start():
                            start_fn = get_start_rosbot_task()
                            if start_fn:
                                run_e5_init(start_fn)
                            run_e5a_wait_win_srv_poll_click(
                                run_after_rosbot_start,
                                wait_sec=30,
                                do_debug=True,
                                do_tab=True,
                                do_start_botting=True,
                            )
                    run_e6_done()
                    ran_e_block = True
        except Exception as e:
            err = e
        trigger_extension_rosbot_started(result, err, ran_e_block)

    def _do_stop_rosbot(self) -> None:
        try:
            get_task_manager().set_task_status("rosbot_task", TaskStatus.DISABLED)
            stop_fn = get_stop_rosbot_task()
            if stop_fn:
                stop_fn()
        except Exception as e:
            ColorPrint.red(f"[D3ExtensionThread] Stop error: {e}")
        trigger_extension_rosbot_stopped()


_instance: Optional[D3ExtensionThread] = None


def get_d3_extension_thread() -> Optional[D3ExtensionThread]:
    return _instance


def set_d3_extension_thread(thread: Optional[D3ExtensionThread]) -> None:
    global _instance
    _instance = thread
