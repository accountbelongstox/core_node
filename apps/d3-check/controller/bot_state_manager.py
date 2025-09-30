#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Bot State Manager
Manages bot program states and transitions
"""

import time
from enum import Enum
from typing import Dict, Optional
from utils.color_print import ColorPrint


class BotState(Enum):
    """Bot program states"""
    WAITING_TO_START = "waiting_to_start"           # 程序开始等待重启
    STARTING = "starting"                           # 正在启动
    RUNNING = "running"                             # 运行中
    NORMAL_EXIT_WAITING = "normal_exit_waiting"     # 正常退出等待重启
    ERROR_EXIT_WAITING = "error_exit_waiting"       # 错误退出等待重启
    DIABLO_RESTART_NEEDED = "diablo_restart_needed" # 需要重启Diablo


class BotStateManager:
    """Manages bot program state transitions and timing"""
    
    def __init__(self, repeat_login_time: int, run_duration: int):
        """
        Initialize bot state manager
        
        Args:
            repeat_login_time: Time to wait before restart (seconds)
            run_duration: How long to run before normal exit (seconds)
        """
        self.repeat_login_time = repeat_login_time
        self.run_duration = run_duration
        self.current_state = BotState.WAITING_TO_START
        self.state_start_time = time.time()
        self.run_start_time = None
        self.last_state_change = time.time()
        
        ColorPrint.green("✅ BotStateManager initialized")
        ColorPrint.blue(f"⏱️  Repeat login time: {repeat_login_time} seconds")
        ColorPrint.blue(f"⏱️  Run duration: {run_duration} seconds")
    
    def get_current_state(self) -> BotState:
        """Get current bot state"""
        return self.current_state
    
    def get_state_duration(self) -> float:
        """Get how long current state has been active"""
        return time.time() - self.state_start_time
    
    def get_run_duration(self) -> float:
        """Get how long bot has been running (if in running state)"""
        if self.current_state == BotState.RUNNING and self.run_start_time:
            return time.time() - self.run_start_time
        return 0.0
    
    def transition_to_state(self, new_state: BotState, reason: str = ""):
        """
        Transition to new state
        
        Args:
            new_state: New state to transition to
            reason: Reason for state change
        """
        if new_state == self.current_state:
            return
        
        old_state = self.current_state
        self.current_state = new_state
        self.state_start_time = time.time()
        self.last_state_change = time.time()
        
        # Special handling for running state
        if new_state == BotState.RUNNING:
            self.run_start_time = time.time()
        
        ColorPrint.yellow(f"🔄 State transition: {old_state.value} → {new_state.value}")
        if reason:
            ColorPrint.gray(f"   Reason: {reason}")
    
    def should_start_bot(self) -> bool:
        """Check if bot should be started"""
        if self.current_state == BotState.WAITING_TO_START:
            return True
        elif self.current_state in [BotState.NORMAL_EXIT_WAITING, BotState.ERROR_EXIT_WAITING]:
            return self.get_state_duration() >= self.repeat_login_time
        elif self.current_state == BotState.DIABLO_RESTART_NEEDED:
            return True
        return False
    
    def should_stop_bot(self) -> bool:
        """Check if bot should be stopped (run duration exceeded)"""
        if self.current_state == BotState.RUNNING:
            return self.get_run_duration() >= self.run_duration
        return False
    
    def handle_bot_started(self):
        """Handle bot startup completion"""
        self.transition_to_state(BotState.RUNNING, "Bot started successfully")
    
    def handle_bot_normal_exit(self):
        """Handle normal bot exit"""
        self.transition_to_state(BotState.NORMAL_EXIT_WAITING, "Bot exited normally")
    
    def handle_bot_error_exit(self):
        """Handle bot error exit"""
        self.transition_to_state(BotState.ERROR_EXIT_WAITING, "Bot exited with error")
    
    def handle_diablo_restart_needed(self):
        """Handle when Diablo restart is needed"""
        self.transition_to_state(BotState.DIABLO_RESTART_NEEDED, "Diablo restart required")
    
    def handle_bot_starting(self):
        """Handle bot starting process"""
        self.transition_to_state(BotState.STARTING, "Bot startup initiated")
    
    def get_time_until_next_action(self) -> float:
        """Get time until next action should be taken"""
        if self.current_state in [BotState.NORMAL_EXIT_WAITING, BotState.ERROR_EXIT_WAITING]:
            remaining = self.repeat_login_time - self.get_state_duration()
            return max(0, remaining)
        elif self.current_state == BotState.RUNNING:
            remaining = self.run_duration - self.get_run_duration()
            return max(0, remaining)
        return 0.0
    
    def get_state_info(self) -> Dict:
        """Get comprehensive state information"""
        return {
            "current_state": self.current_state.value,
            "state_duration": self.get_state_duration(),
            "run_duration": self.get_run_duration(),
            "time_until_next_action": self.get_time_until_next_action(),
            "should_start_bot": self.should_start_bot(),
            "should_stop_bot": self.should_stop_bot(),
            "run_start_time": self.run_start_time,
            "state_start_time": self.state_start_time,
            "last_state_change": self.last_state_change
        }
    
    def print_state_info(self):
        """Print current state information"""
        info = self.get_state_info()
        ColorPrint.blue(f"🤖 Bot State: {info['current_state']}")
        ColorPrint.gray(f"   State duration: {info['state_duration']:.1f}s")
        
        if self.current_state == BotState.RUNNING:
            ColorPrint.gray(f"   Run duration: {info['run_duration']:.1f}s / {self.run_duration}s")
            ColorPrint.gray(f"   Time until stop: {info['time_until_next_action']:.1f}s")
        elif self.current_state in [BotState.NORMAL_EXIT_WAITING, BotState.ERROR_EXIT_WAITING]:
            ColorPrint.gray(f"   Time until restart: {info['time_until_next_action']:.1f}s")
    
    def update_timing_settings(self, repeat_login_time: int = None, run_duration: int = None):
        """Update timing settings"""
        if repeat_login_time is not None:
            self.repeat_login_time = repeat_login_time
            ColorPrint.blue(f"⏱️  Updated repeat login time: {repeat_login_time} seconds")
        
        if run_duration is not None:
            self.run_duration = run_duration
            ColorPrint.blue(f"⏱️  Updated run duration: {run_duration} seconds")
