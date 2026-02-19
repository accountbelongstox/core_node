#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ROSBOT Task Processor – single tick entry (FLOW_STATE_ARCHITECTURE Approach 3).

Task thread calls process_rosbot_task() every 1s:
  - First tick_driver.on_tick(): global tick+1, dispatch by % to sigint_guard / smart_echo / inactive_refresh (log_monitor not in tick; driven only by watchdog).
  - When tick % 2 == 0 run process_task(): flow_state gate, tick_bn_only_flow / tick_flow_master.
All periods simulated by tick + %; no separate timers.

Architecture boundary: This module is the 1s periodic task entry only. Log analysis is done by log_monitor (watchdog thread).
This task only handles: tick_driver.on_tick() and flow (timeout detection, etc.). Does not process log lines.
"""
import os
import sys
import time
from typing import Optional
from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import LOGS_FILE_PATH
from d3utils.log_monitor_api import set_log_file, set_rosbot_running
from share.game_interface_data import get_game_interface_data
from d3utils.rosbot_flow_state import (
    get_flow_master_enabled,
    get_bn_only_enabled,
    is_flow_active,
)
from d3utils.task_thread_manager import TaskStatus
from d3utils.rosbot_flow_f3_log_timeout import get_test_mode_display_string
from d3utils.rosbot_flow_rosbot_exit_state import get_total_restart_count
from d3utils.rosbot_flow.flow_bn_only import tick_bn_only_flow
from d3utils.rosbot_flow.flow_master_driver import tick_flow_master
from d3utils.rosbot_task_registry import register_start_rosbot_task, register_stop_rosbot_task
from d3utils.battlenet_status_provider import refresh_battlenet_status
from d3utils.d3_status_provider import refresh_d3_status
from d3utils.rosbot_status_provider import refresh_rosbot_status
from share.asia_credentials import is_asia_credentials_dialog_pending
from d3utils.tick_driver import on_tick as tick_driver_on_tick, get_global_tick

class RosbotTaskProcessor:
    """ROSBOT task processor for background operations (1s tick + flow)."""

    def __init__(self):
        self.game_state = get_game_interface_data()
        self.log_file_path: Optional[str] = None
        self.initialized = False

        ColorPrint.blue("[RosbotTaskProcessor] Initialized")

    def initialize(self):
        """Initialize ROSBOT task processor."""
        if not self.initialized:
            self.log_file_path = LOGS_FILE_PATH
            set_log_file(self.log_file_path)
            self.initialized = True
            ColorPrint.blue("[RosbotTaskProcessor] Initialized with log file")
    
    def start_rosbot(self):
        """Start ROSBOT monitoring"""
        if not self.initialized:
            self.initialize()
        set_rosbot_running(True)
        self.game_state.set_rosbot_status(True)
        ColorPrint.green("[RosbotTaskProcessor] ROSBOT monitoring started")
    
    def stop_rosbot(self):
        """Stop ROSBOT monitoring"""
        set_rosbot_running(False)
        self.game_state.set_rosbot_status(False)
        self.game_state.rosbot_test_mode_display = None
        # Update total restart count from config
        total_count = get_total_restart_count()
        self.game_state.set_rosbot_total_restart_count(total_count)
        ColorPrint.yellow("[RosbotTaskProcessor] ROSBOT monitoring stopped")
    
    def process_task(self):
        """Single tick: run on_tick, then when tick % 2 == 0 run flow. Log analysis is done by log_monitor (watchdog thread)."""
        self.game_state.rosbot_test_mode_display = get_test_mode_display_string()
        # Update total restart count from config
        total_count = get_total_restart_count()
        self.game_state.set_rosbot_total_restart_count(total_count)
        tick_driver_on_tick()
        t = get_global_tick()
        if t % 2 != 0:
            return
        global _flow_last_run_time
        if not is_flow_active():
            return
        _flow_tick_count[0] = t // 2
        if is_asia_credentials_dialog_pending():
            return
        now = time.time()
        time_since_previous = (now - _flow_last_run_time) if _flow_last_run_time > 0 else 0.0
        _flow_last_run_time = now
        bn_only = get_bn_only_enabled()
        flow_master = get_flow_master_enabled()
        status_prefix = f"[A2/A3] Tick #{_flow_tick_count[0]} dt={time_since_previous:.2f}s | "
        if not flow_master:
            ColorPrint.gray(
                f"[A2/A3] Tick #{_flow_tick_count[0]} (2s step) flow_master={flow_master} bn_only={bn_only} | "
                f"time since previous: {time_since_previous:.2f} s"
            )
        bn_only2 = get_bn_only_enabled()
        flow_master2 = get_flow_master_enabled()
        if not flow_master2 and not bn_only2:
            return
        if bn_only2:
            tick_bn_only_flow()
        if flow_master2:
            tick_flow_master(_flow_tick_count[0], start_rosbot_task, status_prefix=status_prefix)


# Global instance
_rosbot_processor = None
# 2s flow tick counter (task runs every 1s; flow step only when count % 2 == 0; see ROSBOT_FLOW.md)
_flow_tick_count = [0]
# Time of last flow step run (for "time since previous" in gray output)
_flow_last_run_time = 0.0


def get_flow_tick_count() -> int:
    """Current flow tick (incremented every 2s when count % 2 == 0). Used by extension flow state machine for deadline_tick."""
    return _flow_tick_count[0]


def get_rosbot_processor() -> RosbotTaskProcessor:
    """Global ROSBOT task processor instance (1s tick + flow entry). Singleton."""
    global _rosbot_processor
    if _rosbot_processor is None:
        _rosbot_processor = RosbotTaskProcessor()
    return _rosbot_processor


def start_rosbot_task():
    """Enable ROSBOT monitoring: ensure initialize (set_log_file), set_rosbot_running(True), game_state.rosbot_status. Does not start the 1s task loop (that is always running; flow_state controls flow)."""
    processor = get_rosbot_processor()
    processor.start_rosbot()


def stop_rosbot_task():
    """Disable ROSBOT monitoring: set_rosbot_running(False), clear game_state rosbot status and test display. Task loop keeps running; flow_state controls flow."""
    processor = get_rosbot_processor()
    processor.stop_rosbot()


def process_rosbot_task():
    """One 1s tick: called by task thread every 1s. Runs tick_driver.on_tick(), then when tick % 2 == 0 runs flow (tick_bn_only_flow / tick_flow_master). Entry point registered in system_initializer as rosbot_task."""
    processor = get_rosbot_processor()
    processor.process_task()


def run_full_status_refresh() -> Optional[dict]:
    """
    Reusable status refresh. Scope depends on flow switches at call time:
    - Only bn_only (Ensure Battle.net only): BN only, no D3/ROSBOT (BN flow does not touch get_rosbot_window).
    - Else (flow_master or both off): BN + D3 light + ROSBOT, then notify.

    Callers (no conflict among the three):
    - Startup initial check: submit_one_shot(do_window_monitor_initial_check) at timer start; reads bn_only/flow_master when run.
    - Start ROSBOT: _start_rosbot sets flow_master=True then _request_status_refresh -> full refresh.
    - Ensure Battle.net (on): _ensure_battlenet_only sets bn_only=True then _request_status_refresh -> BN-only refresh.
    Returns D3 window info dict for window callbacks (optional); None when BN-only path.
    """
    bn_only = get_bn_only_enabled()
    flow_master = get_flow_master_enabled()
    if bn_only and not flow_master:
        refresh_battlenet_status()
        get_game_interface_data().notify_state_sync()
        return None
    refresh_battlenet_status()
    d3_info = refresh_d3_status(skip_dynamic=True)
    refresh_rosbot_status()
    get_game_interface_data().notify_state_sync()
    return d3_info


register_start_rosbot_task(start_rosbot_task)
register_stop_rosbot_task(stop_rosbot_task)
