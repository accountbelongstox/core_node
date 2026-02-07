#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ROSBOT Task Processor
Handles ROSBOT operations in background task thread
"""
import os
import sys
import time
from typing import Optional
from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import LOGS_FILE_PATH
from d3utils.log_monitor import set_log_file, set_rosbot_running
from share.game_interface_data import get_game_interface_data
from d3utils.task_thread_manager import TaskStatus
from d3utils.d3_status_provider import refresh_d3_status
from d3utils.battlenet_status_provider import refresh_battlenet_status
from d3utils.rosbot_flow_battlenet import tick_battlenet_ready_flow, set_battlenet_tick_confirmed, get_bn_flow_ever_confirmed, reset_confirmed_to_poll
from d3utils.event_center import trigger_extension_rosbot_start

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
        try:
            ColorPrint.debug_messagebox("DEBUG #12", "[RosbotTaskProcessor] Enter start_rosbot")

            if not self.initialized:
                ColorPrint.debug_messagebox("DEBUG #13", "[RosbotTaskProcessor] Need initialization")
                self.initialize()
                ColorPrint.debug_messagebox("DEBUG #14", "[RosbotTaskProcessor] Initialization completed")

            # Enable full-speed monitoring
            ColorPrint.debug_messagebox("DEBUG #15", "[RosbotTaskProcessor] Preparing to call set_rosbot_running(True)")
            set_rosbot_running(True)
            ColorPrint.debug_messagebox("DEBUG #16", "[RosbotTaskProcessor] set_rosbot_running returned")

            # Update game state
            ColorPrint.debug_messagebox("DEBUG #17", "[RosbotTaskProcessor] Preparing to update game_state")
            self.game_state.set_rosbot_status(True)
            ColorPrint.debug_messagebox("DEBUG #18", "[RosbotTaskProcessor] game_state.set_rosbot_status returned")

            ColorPrint.green("[RosbotTaskProcessor] ROSBOT monitoring started")

        except Exception as e:
            ColorPrint.debug_messagebox("ERROR", f"[RosbotTaskProcessor] Exception: {e}", "error")
            ColorPrint.red(f"[RosbotTaskProcessor] Error starting ROSBOT: {e}")
            # Update game state to reflect error
            self.game_state.set_rosbot_status(False)
    
    def stop_rosbot(self):
        """Stop ROSBOT monitoring"""
        try:
            # Enable throttled monitoring
            set_rosbot_running(False)
            
            # Update game state
            self.game_state.set_rosbot_status(False)
            
            ColorPrint.yellow("[RosbotTaskProcessor] ROSBOT monitoring stopped")
            
        except Exception as e:
            ColorPrint.red(f"[RosbotTaskProcessor] Error stopping ROSBOT: {e}")
    
    def process_task(self):
        """Flow driver: 1s tick; flow uses % for 2s. When flow master on: full flow (BN then D3/ROSBOT). When ensure_battlenet_only on: BN-only, each tick re-polls after confirm (reconnect on disconnect)."""
        bn_only = self.game_state.ensure_battlenet_only_master_enabled
        flow_master = self.game_state.rosbot_flow_master_enabled
        if not flow_master and not bn_only:
            return
        _flow_tick_count[0] += 1
        if _flow_tick_count[0] % 2 != 0:
            return
        try:
            refresh_battlenet_status()
            if flow_master and get_bn_flow_ever_confirmed():
                refresh_d3_status()
            self.game_state.notify_state_sync()
        except Exception:
            pass
        done, result = tick_battlenet_ready_flow(no_activate=bn_only)
        if done and result == "confirmed":
            if flow_master:
                set_battlenet_tick_confirmed()
                trigger_extension_rosbot_start()
            elif bn_only:
                reset_confirmed_to_poll()


# Global instance
_rosbot_processor = None
# 2s flow tick counter (task runs every 1s; flow step only when count % 2 == 0, ROSBOT_FLOW.md)
_flow_tick_count = [0]


def get_rosbot_processor() -> RosbotTaskProcessor:
    """Get global ROSBOT task processor instance"""
    global _rosbot_processor
    if _rosbot_processor is None:
        _rosbot_processor = RosbotTaskProcessor()
    return _rosbot_processor


def start_rosbot_task():
    """Start ROSBOT task"""
    try:
        ColorPrint.debug_messagebox("DEBUG #9", "[start_rosbot_task] Enter function")

        processor = get_rosbot_processor()
        ColorPrint.debug_messagebox("DEBUG #10", "[start_rosbot_task] Got processor instance successfully")

        processor.start_rosbot()
        ColorPrint.debug_messagebox("DEBUG #11", "[start_rosbot_task] processor.start_rosbot() returned")

    except Exception as e:
        ColorPrint.debug_messagebox("ERROR", f"[start_rosbot_task] Exception: {e}", "error")
        ColorPrint.red(f"[start_rosbot_task] Error: {e}")


def stop_rosbot_task():
    """Stop ROSBOT task"""
    processor = get_rosbot_processor()
    processor.stop_rosbot()


def process_rosbot_task():
    """Process ROSBOT task (called by task thread)"""
    processor = get_rosbot_processor()
    processor.process_task()
