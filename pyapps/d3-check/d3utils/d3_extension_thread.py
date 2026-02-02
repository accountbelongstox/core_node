#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3 Extension Thread
Single dedicated thread for all D3/ROSBOT extension work: login check, start/stop ROSBOT.
Commands received via queue (filled by event center handlers); completion reported
via event center (trigger_extension_rosbot_started/stopped), not direct callbacks.
"""

import queue
import threading
from typing import Optional

from pycore.pyfoundations.color_print import ColorPrint
from share.game_interface_data import get_game_interface_data
from controller.login_try_screenshot_controller import get_login_try_screenshot_controller
from d3utils.task_thread_manager import get_task_manager, TaskStatus
import d3utils.rosbot_task_processor as rosbot_processor
from d3utils.event_signals import trigger_extension_rosbot_started, trigger_extension_rosbot_stopped


from providor.app_constants import CMD_START_ROSBOT, CMD_STOP_ROSBOT, CMD_SHUTDOWN


class D3ExtensionThread(threading.Thread):
    """
    Dedicated thread for D3 extension. Commands come from event center (handler puts to queue).
    Completion is reported via event center (trigger_extension_rosbot_started/stopped).
    """

    def __init__(self):
        super().__init__(daemon=True)
        self._command_queue: queue.Queue[str] = queue.Queue()
        self._shutdown = threading.Event()

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
        if not get_game_interface_data().rosbot_flow_master_enabled:
            trigger_extension_rosbot_started(False, None)
            return
        result = False
        err = None
        try:
            result = get_login_try_screenshot_controller().ensure_battlenet_started_and_login_check()
        except Exception as e:
            err = e
        trigger_extension_rosbot_started(result, err)

    def _do_stop_rosbot(self) -> None:
        try:
            get_task_manager().set_task_status("rosbot_task", TaskStatus.DISABLED)
            rosbot_processor.stop_rosbot_task()
        except Exception as e:
            ColorPrint.red(f"[D3ExtensionThread] Stop error: {e}")
        trigger_extension_rosbot_stopped()


_instance: Optional[D3ExtensionThread] = None


def get_d3_extension_thread() -> Optional[D3ExtensionThread]:
    return _instance


def set_d3_extension_thread(thread: Optional[D3ExtensionThread]) -> None:
    global _instance
    _instance = thread
