#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Log Analyzer
Log layer only: analyzes ROSBOT log lines and updates game state (map_type, stage, disconnect, etc.).
On "Login try" in log, invokes registered callback (e.g. LoginTryScreenshotController). Does not trigger flow.
Echo detection rules (smart echo): grouped in _run_echo_detection_rules; only active when UI smart_echo is on.
"""
import os
import re
import sys
import time
from collections import deque
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.color_print import ColorPrint
from providor.providor_index import get_config_section, LOGS_FILE_PATH
from share.game_interface_data import get_game_interface_data
from d3utils.rosbot_manager import get_rosbot_manager
from d3utils.d3_manager import get_d3_manager
from d3utils.rosbot_ui_automation import (
    try_close_d3_must_be_launched_dialog,
    try_close_no_items_popup,
    do_after_no_items_close_switch_rift_and_start,
)
from d3utils.smart_echo import do_smart_echo_pause_after_complete
from providor.constants.common import LOGIN_TRY_TRIGGER_DEFAULT
from providor.i18n_manager import i18n_manager


# Injected by controller at startup; d3utils does not import controller.
_login_try_callback: Optional[Callable[[], None]] = None


def register_login_try_callback(cb: Callable[[], None]) -> None:
    """Register handler for 'Login try' log line. Called from controller layer."""
    global _login_try_callback
    _login_try_callback = cb


def _get_login_try_trigger() -> str:
    """Trigger string for login-try screenshot (from config, else default constant)."""
    log_detection = get_config_section("log_detection")
    return log_detection.get("login_try", LOGIN_TRY_TRIGGER_DEFAULT)


def _smart_echo_enabled() -> bool:
    rosbot = get_config_section("rosbot")
    return bool(rosbot.get("smart_echo", False))


# --- Smart echo trigger logic (no "Game ended") ---
# 1. Only when the current line is "Picking end".
# 2. Look back once: PICKING_END_LOOKBACK lines before this "Picking end". If memory has >= 22 lines use memory; else read from log file. Skip only when file has insufficient lines.
# 3. If "Running: Echoing Fury Exploration" in those lines → call do_smart_echo_pause_after_complete() once.
PICKING_END_LOOKBACK = 22
# System error: ignore when "Plugins" in previous 10 lines (plugin load failure). After one kill, require this many lines before next trigger.
SYSTEM_ERROR_LOOKBACK_LINES = 10
SYSTEM_ERROR_COOLDOWN_LINES = 30  # lines processed after a trigger before we allow another trigger


def _read_lookback_before_sentinel_from_file(log_path: str, sentinel: str, lookback: int) -> List[str]:
    """Reusable: read log file and return up to `lookback` lines immediately before the last line containing `sentinel`. Returns [] if file missing, unreadable, or no match."""
    if not log_path or not os.path.isfile(log_path):
        return []
    try:
        with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = [ln.strip() for ln in f.readlines()]
    except OSError:
        return []
    last_idx = None
    for i in range(len(lines) - 1, -1, -1):
        if sentinel in (lines[i] or ""):
            last_idx = i
            break
    if last_idx is None or last_idx <= 0:
        return []
    start = max(0, last_idx - lookback)
    return lines[start:last_idx]


def _get_lookback_lines(
    memory_lines: deque,
    lookback: int,
    file_path: str,
    sentinel: str,
) -> List[str]:
    """Reusable: return `lookback` lines before sentinel. If memory has >= lookback use memory; else read from file (lines before last `sentinel`). If file has < lookback lines, return []."""
    if len(memory_lines) >= lookback:
        return list(memory_lines)
    lines = _read_lookback_before_sentinel_from_file(file_path, sentinel, lookback)
    if len(lines) < lookback:
        return []
    return lines


class LogAnalyzer:
    """Analyzes ROSBOT log lines for game state information"""

    def __init__(self):
        self.game_state = get_game_interface_data()
        
        # Regex patterns for log analysis. D3 running is NOT from log; only WindowMonitor/controller set d3_running by window detection.
        self.patterns = {
            'rosbot_start': re.compile(r'ROSBOT.*started|ROSBOT.*running', re.IGNORECASE),
            'rosbot_stop': re.compile(r'ROSBOT.*stopped|ROSBOT.*exit', re.IGNORECASE),
            'map_greater_rift': re.compile(r'greater.*rift|gr\d+', re.IGNORECASE),
            'map_rift': re.compile(r'rift|nephalem.*rift', re.IGNORECASE),
            'stage_gem_upgrade': re.compile(r'gem.*upgrade|upgrade.*gem', re.IGNORECASE),
            'stage_kill_boss': re.compile(r'kill.*boss|boss.*kill', re.IGNORECASE),
            'stage_back_town': re.compile(r'back.*town|return.*town', re.IGNORECASE),
            'stage_in_greater_rift': re.compile(r'in.*greater.*rift', re.IGNORECASE),
            'stage_in_rift': re.compile(r'in.*rift', re.IGNORECASE)
        }
        # Echo (Echoing Nightmare) state. "Running: Echoing Fury Exploration" means map is echo.
        self._line_buffer: deque = deque(maxlen=6)
        self._recent_lines: deque = deque(maxlen=PICKING_END_LOOKBACK)  # last N lines before current, for Picking end lookback only
        # Firstborn temple: count "Objective RunLogic: Temple of the Firstbor"; when reuse option on, only odd count updates map.
        self._firstborn_objective_count: int = 0
        # System error: buffer last 2 lines for consecutive "at System"; ignore if "Plugins" in previous 10 lines; cooldown N lines after one trigger.
        self._at_error_buffer: deque = deque(maxlen=2)
        self._lines_since_system_kill: int = 999

        ColorPrint.blue("[LogAnalyzer] Initialized")
    
    def analyze_line(self, line: str) -> bool:
        """
        Analyze a log line and update game state.
        Called from watchdog observer thread (log_monitor) for real-time processing.
        Must be thread-safe: no blocking on config worker or UI. Direct CONFIG.get() is OK (dict read).
        
        Args:
            line: Log line to analyze
            
        Returns:
            True if state was updated, False otherwise
        """
        if not line or not line.strip():
            return False
        
        line = line.strip()
        updated = False
        
        # Check ROSBOT status
        if self.patterns['rosbot_start'].search(line):
            self.game_state.set_rosbot_status(True)
            updated = True
        elif self.patterns['rosbot_stop'].search(line):
            self.game_state.set_rosbot_status(False)
            updated = True
        
        # Check ROSBOT disconnection messages (ROSBOT_FLOW_MERMAID: detect disconnect from logs)
        # "WARN - Disconnected" or "Session Time out 5 min.." indicates ROSBOT disconnected
        if ("WARN" in line and "Disconnected" in line) or ("Session Time out" in line and ("min" in line.lower() or "timeout" in line.lower())):
            self.game_state.set_rosbot_disconnected_from_log(True)
            ColorPrint.yellow(f"[LogAnalyzer] ROSBOT disconnection detected from log: {line[:80]}...")
            updated = True
        
        # D3 running: only from WindowMonitor and controller (window detection), not from log.
        
        # Temple of the Firstborn: in-memory counter _firstborn_objective_count; when UI "firstborn blue gate reuse" on, only odd count updates map.
        if "Objective RunLogic: Temple of the Firstbor" in line:
            self._firstborn_objective_count += 1
            rosbot = get_config_section("rosbot")
            firstborn_reuse = bool(rosbot.get("firstborn_blue_gate_reuse", False))
            is_odd = (self._firstborn_objective_count % 2 == 1)
            if not firstborn_reuse or is_odd:
                self.game_state.set_map_type("firstborn_temple")
                self.game_state.set_game_stage("back_town")
                updated = True
            if firstborn_reuse and is_odd:
                msg = i18n_manager.get_ui_text("rosbot.firstborn_reuse_needed") % (self._firstborn_objective_count,)
                ColorPrint.blue(f"[LogAnalyzer] {msg}")
        # Town portal done: anytime this log appears, reset to town.
        elif "Town portal done" in line:
            self.game_state.set_map_type("town")
            self.game_state.set_game_stage("back_town")
            updated = True
        # Map type: only "Map: town", "Map: echo", or return-to-town pattern.
        elif "Map: town" in line:
            self.game_state.set_map_type("town")
            updated = True
        elif "Map: echo" in line:
            self.game_state.set_map_type("echo")
            updated = True
        elif self.patterns['stage_back_town'].search(line):
            self.game_state.set_map_type("town")
            updated = True
        elif self.patterns['map_greater_rift'].search(line):
            self.game_state.set_map_type("greater_rift")
            updated = True
        elif self.patterns['map_rift'].search(line):
            self.game_state.set_map_type("rift")
            updated = True

        # Echo: "Running: Echoing Fury Exploration" means map is echo ([D3State] Map: echo).
        if "Running: Echoing Fury Exploration" in line:
            self.game_state.set_map_type("echo")
            updated = True
        # Temple of the Firstborn (e.g. "Running: Temple of the Firstborn Level 1 Illusions Exploration") -> map firstborn_temple
        if "Running: Temple of the Firstborn" in line:
            self.game_state.set_map_type("firstborn_temple")
            updated = True
        if "Game ended" in line and self.game_state.map_type == "echo":
            self.game_state.set_map_type("echo_completed")
            updated = True

        # Smart echo: only on "Picking end" — look back 22 lines once, no "Game ended" condition.
        self._run_echo_detection_rules(line)
        # No items popup: when log line contains "No items" or "Vendor loop done", close popup and switch to rift
        self._on_no_items_popup(line)
        # System error detection: consecutive "at System"; ignore if Plugins in previous 10 lines; cooldown N lines after kill
        recent_10 = list(self._recent_lines)[-SYSTEM_ERROR_LOOKBACK_LINES:] if self._recent_lines else []
        self._check_system_error(line, recent_10)
        self._lines_since_system_kill += 1
        self._recent_lines.append(line)
        self._line_buffer.append(line)

        # Check game stage
        if self.patterns['stage_gem_upgrade'].search(line):
            self.game_state.set_game_stage("gem_upgrade")
            updated = True
        elif self.patterns['stage_kill_boss'].search(line):
            self.game_state.set_game_stage("kill_boss")
            updated = True
        elif self.patterns['stage_back_town'].search(line):
            self.game_state.set_game_stage("back_town")
            updated = True
        elif self.patterns['stage_in_greater_rift'].search(line):
            self.game_state.set_game_stage("in_greater_rift")
            updated = True
        elif self.patterns['stage_in_rift'].search(line):
            self.game_state.set_game_stage("in_rift")
            updated = True

        # On "Login try" in log
        login_try_trigger = _get_login_try_trigger()
        if login_try_trigger and login_try_trigger in line:
            if _login_try_callback:
                _login_try_callback()
            updated = True
        
        if updated:
            ColorPrint.debug(f"[LogAnalyzer] Updated state from line: {line[:50]}...")
        
        return updated

    def _do_smart_echo_if_enabled(self) -> None:
        """Run F7 pause immediately in the same thread (log reader) to avoid timer-queue delay."""
        if _smart_echo_enabled():
            do_smart_echo_pause_after_complete()

    def _run_echo_detection_rules(self, line: str) -> None:
        """Smart echo: only on "Picking end" — one lookback of 22 lines before this line; if "Running: Echoing Fury Exploration" in them, trigger once. No Game ended."""
        if not _smart_echo_enabled():
            return
        self._rule_picking_end_echo_trigger(line)

    def _rule_picking_end_echo_trigger(self, line: str) -> None:
        """Current line must be "Picking end". Look back once via _get_lookback_lines (memory or file); only when file also insufficient skip. If "Running: Echoing Fury Exploration" in lookback → trigger."""
        if "Picking end" not in line:
            return
        lookback_lines = _get_lookback_lines(
            self._recent_lines, PICKING_END_LOOKBACK, LOGS_FILE_PATH, "Picking end"
        )
        if not lookback_lines:
            return
        if not any("Running: Echoing Fury Exploration" in ln for ln in lookback_lines):
            return
        ColorPrint.green("[SmartEcho] Echo map returning to town.")
        self._line_buffer.clear()
        self._do_smart_echo_if_enabled()

    def _on_no_items_popup(self, line: str) -> None:
        """
        When log line contains "No items" or "Vendor loop done", try to close the No items popup
        and switch to rift + start. ROSBOT process must be running; popup may be the only visible window.
        """
        if "No items" not in line and "Vendor loop done" not in line:
            return
        self._close_no_items_popup_and_switch_rift()

    def _close_no_items_popup_and_switch_rift(self) -> None:
        """Try close D3 must-be-launched dialog, then No items popup; if popup closed, switch to rift and start."""
        detection = get_rosbot_manager().get_rosbot_detection()
        if detection.get("status") == "not_found":
            return
        try_close_d3_must_be_launched_dialog()
        if try_close_no_items_popup():
            do_after_no_items_close_switch_rift_and_start()

    def _check_system_error(self, line: str, recent_10_lines: List[str]) -> None:
        """
        Detect system error: consecutive 2 lines containing "at System". When detected, kill D3 and ROSBOT.
        - Plugin: if "Plugins" in the 10 lines before this line, ignore (plugin load failure, e.g. WinDivert.dll).
        - Cooldown: after one trigger we set _lines_since_system_kill=0; we only allow trigger again after
          at least SYSTEM_ERROR_COOLDOWN_LINES lines have been processed (avoids double trigger on same stack).
        """
        if self._lines_since_system_kill < SYSTEM_ERROR_COOLDOWN_LINES:
            self._at_error_buffer.clear()
            return
        if "at System" in line:
            if any("Plugins" in ln for ln in recent_10_lines):
                self._at_error_buffer.clear()
                return
            self._at_error_buffer.append(line)
            if len(self._at_error_buffer) >= 2:
                ColorPrint.red("[LogAnalyzer] System error detected: consecutive 'at System' lines, killing D3 and ROSBOT")
                get_d3_manager().kill_if_running()
                get_rosbot_manager().kill_if_running()
                self._at_error_buffer.clear()
                self._lines_since_system_kill = 0
        else:
            self._at_error_buffer.clear()


# Global instance
_log_analyzer = None


def get_log_analyzer() -> LogAnalyzer:
    """Get global log analyzer instance"""
    global _log_analyzer
    if _log_analyzer is None:
        _log_analyzer = LogAnalyzer()
    return _log_analyzer


def analyze_log_line(line: str) -> bool:
    """Analyze a log line and update game state"""
    return get_log_analyzer().analyze_line(line)