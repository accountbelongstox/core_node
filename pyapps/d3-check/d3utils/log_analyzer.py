#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Log Analyzer
Analyzes ROSBOT log lines and updates game state.
On "Login try" in log, triggers full-screen screenshot via LoginTryScreenshotController.
"""
import os
import sys
import time
import re
from typing import Dict, Any, Optional
from providor.common_imports import ColorPrint
from providor.providor_index import CONFIG
from share.game_interface_data import get_game_interface_data
from config.constants import LOGIN_TRY_TRIGGER_DEFAULT


def _get_login_try_trigger() -> str:
    """Trigger string for login-try screenshot (from config, else default constant)."""
    return CONFIG.get("log_detection", {}).get("login_try", LOGIN_TRY_TRIGGER_DEFAULT)


class LogAnalyzer:
    """Analyzes ROSBOT log lines for game state information"""

    def __init__(self):
        self.game_state = get_game_interface_data()
        
        # Regex patterns for log analysis
        self.patterns = {
            'rosbot_start': re.compile(r'ROSBOT.*started|ROSBOT.*running', re.IGNORECASE),
            'rosbot_stop': re.compile(r'ROSBOT.*stopped|ROSBOT.*exit', re.IGNORECASE),
            'd3_detected': re.compile(r'Diablo.*detected|D3.*found', re.IGNORECASE),
            'd3_lost': re.compile(r'Diablo.*lost|D3.*not.*found', re.IGNORECASE),
            'map_town': re.compile(r'town|city|base', re.IGNORECASE),
            'map_greater_rift': re.compile(r'greater.*rift|gr\d+|大秘境', re.IGNORECASE),
            'map_rift': re.compile(r'rift|nephalem.*rift|小秘境', re.IGNORECASE),
            'stage_gem_upgrade': re.compile(r'gem.*upgrade|upgrade.*gem|宝石.*升级', re.IGNORECASE),
            'stage_kill_boss': re.compile(r'kill.*boss|boss.*kill|击杀.*boss', re.IGNORECASE),
            'stage_back_town': re.compile(r'back.*town|return.*town|回城', re.IGNORECASE),
            'stage_in_greater_rift': re.compile(r'in.*greater.*rift|大秘.*中', re.IGNORECASE),
            'stage_in_rift': re.compile(r'in.*rift|小秘.*中', re.IGNORECASE)
        }
        
        ColorPrint.blue("[LogAnalyzer] Initialized")
    
    def analyze_line(self, line: str) -> bool:
        """
        Analyze a log line and update game state
        
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
        
        # Check D3 status
        if self.patterns['d3_detected'].search(line):
            self.game_state.set_d3_status(True)
            updated = True
        elif self.patterns['d3_lost'].search(line):
            self.game_state.set_d3_status(False)
            updated = True
        
        # Check map type
        if self.patterns['map_greater_rift'].search(line):
            self.game_state.set_map_type("greater_rift")
            updated = True
        elif self.patterns['map_rift'].search(line):
            self.game_state.set_map_type("rift")
            updated = True
        elif self.patterns['map_town'].search(line):
            self.game_state.set_map_type("town")
            updated = True
        
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

        # On "Login try" in log: Battle.net window screenshot, OCR for Retry/重试; if disconnect, restart Battle.net
        login_try_trigger = _get_login_try_trigger()
        if login_try_trigger and login_try_trigger in line:
            try:
                from controller.login_try_screenshot_controller import get_login_try_screenshot_controller
                get_login_try_screenshot_controller().handle_login_try()
            except Exception as e:
                ColorPrint.red(f"[LogAnalyzer] Login try handler failed: {e}")
            updated = True
        
        if updated:
            ColorPrint.debug(f"[LogAnalyzer] Updated state from line: {line[:50]}...")
        
        return updated


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