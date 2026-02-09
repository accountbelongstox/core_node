#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ROSBOT Task Processor – tick entry only (FLOW_STATE_ARCHITECTURE Approach 3).

Tick does not call third-party libs; it only invokes the flow library. Flow libraries
call refresh/notify and all other providers.

Chain:
  - TaskThreadManager 1s: process_rosbot_task() -> process_task() when rosbot_task ENABLED.
  - process_task(): read flow_state; 2s gate; re-read flow_state; if bn_only run tick_bn_only_flow();
    if flow_master run tick_flow_master(). When both enabled, both run in same tick (BN-only first).
  - flow_bn_only / flow_master_driver each do refresh, notify, re-read, then their steps.
  - When flow inactive, window_monitor runs BN+D3 refresh (not by tick).
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
from d3utils.rosbot_flow.flow_bn_only import tick_bn_only_flow
from d3utils.rosbot_flow.flow_master_driver import tick_flow_master
from d3utils.rosbot_task_registry import register_start_rosbot_task
from d3utils.battlenet_status_provider import refresh_battlenet_status
from d3utils.d3_status_provider import refresh_d3_status
from d3utils.rosbot_status_provider import refresh_rosbot_status
from share.asia_credentials import is_asia_credentials_dialog_pending

class RosbotTaskProcessor:
    """ROSBOT task processor for background operations"""

    def __init__(self):
        self.game_state = get_game_interface_data()
        self.log_file_path: Optional[str] = None
        self.initialized = False
        
        ColorPrint.blue("[RosbotTaskProcessor] Initialized")
    
    def initialize(self):
        """Initialize ROSBOT task processor"""
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
        ColorPrint.yellow("[RosbotTaskProcessor] ROSBOT monitoring stopped")
    
    def process_task(self):
        """Tick entry only: read flow state, 2s gate, re-read; then call flow library. No third-party calls here (Approach 3)."""
        global _flow_last_run_time
        if not is_flow_active():
            return
        _flow_tick_count[0] += 1
        if _flow_tick_count[0] % 2 != 0:
            return
        if is_asia_credentials_dialog_pending():
            return
        now = time.time()
        time_since_previous = (now - _flow_last_run_time) if _flow_last_run_time > 0 else 0.0
        _flow_last_run_time = now
        bn_only = get_bn_only_enabled()
        flow_master = get_flow_master_enabled()
        ColorPrint.gray(
            f"[A2/A3] Tick #{_flow_tick_count[0]} (2s step) flow_master={flow_master} bn_only={bn_only} | "
            f"time since previous: {time_since_previous:.2f} s"
        )
        bn_only2 = get_bn_only_enabled()
        flow_master2 = get_flow_master_enabled()
        if not flow_master2 and not bn_only2:
            return
        # Both flows can run in the same tick when both switches are on (simultaneous).
        # Order: BN-only first (ensure Battle.net), then flow-master (F0/extension/F3/F4).
        if bn_only2:
            tick_bn_only_flow()
        if flow_master2:
            tick_flow_master(_flow_tick_count[0], start_rosbot_task)


# Global instance
_rosbot_processor = None
# 2s flow tick counter (task runs every 1s; flow step only when count % 2 == 0, ROSBOT_FLOW.md)
_flow_tick_count = [0]
# Time of last flow step run (for "time since previous" log)
_flow_last_run_time = 0.0


def get_flow_tick_count() -> int:
    """Current flow tick (incremented every 2s when count % 2 == 0). Used by extension flow state machine for deadline_tick."""
    return _flow_tick_count[0]


def get_rosbot_processor() -> RosbotTaskProcessor:
    """Get global ROSBOT task processor instance"""
    global _rosbot_processor
    if _rosbot_processor is None:
        _rosbot_processor = RosbotTaskProcessor()
    return _rosbot_processor


def start_rosbot_task():
    """Start ROSBOT task"""
    processor = get_rosbot_processor()
    processor.start_rosbot()


def stop_rosbot_task():
    """Stop ROSBOT task"""
    processor = get_rosbot_processor()
    processor.stop_rosbot()


def process_rosbot_task():
    """Process ROSBOT task (called by task thread)."""
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
