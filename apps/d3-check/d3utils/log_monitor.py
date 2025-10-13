#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Log Monitor
Monitors ROSBOT log file for new content and analyzes it
"""
import os
import sys
import time
from typing import Optional
from providor.common_imports import ColorPrint
from d3utils.log_analyzer import analyze_log_line


class LogMonitor:
    """Monitors ROSBOT log file for changes"""
    
    def __init__(self):
        self.log_file_path: Optional[str] = None
        self.last_position = 0
        self.last_modified = 0
        self.initialized = False
        self.rosbot_running = False
        self.last_check_time = 0.0
        self.check_interval = 10.0  # Default 10 seconds when ROSBOT not running
        
        ColorPrint.blue("[LogMonitor] Initialized")
    
    def set_log_file(self, file_path: str):
        """Set the log file to monitor"""
        if os.path.exists(file_path):
            self.log_file_path = file_path
            self.last_position = os.path.getsize(file_path)
            self.last_modified = os.path.getmtime(file_path)
            self.initialized = True
            ColorPrint.blue(f"[LogMonitor] Monitoring log file: {file_path}")
        else:
            ColorPrint.yellow(f"[LogMonitor] Log file not found: {file_path}")
            self.log_file_path = None
            self.initialized = False
    
    def check_logs(self) -> bool:
        """
        Check for new log content and analyze it
        
        Returns:
            True if new content was found and processed
        """
        if not self.initialized or not self.log_file_path:
            return False
        
        try:
            # Check if file still exists
            if not os.path.exists(self.log_file_path):
                ColorPrint.yellow(f"[LogMonitor] Log file disappeared: {self.log_file_path}")
                self.initialized = False
                return False
            
            # Check if file was modified
            current_modified = os.path.getmtime(self.log_file_path)
            if current_modified <= self.last_modified:
                return False
            
            # Read new content
            with open(self.log_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                f.seek(self.last_position)
                new_content = f.read()
                
                if new_content:
                    # Update position
                    self.last_position = f.tell()
                    self.last_modified = current_modified
                    
                    # Process new lines
                    lines = new_content.strip().split('\n')
                    for line in lines:
                        if line.strip():
                            # Use ColorPrint to display new log content
                            ColorPrint.info(f"[ROSBOT] {line}")
                            # Analyze the line for state changes
                            analyze_log_line(line)
                    
                    return True
            
        except Exception as e:
            ColorPrint.red(f"[LogMonitor] Error reading log file: {e}")
            self.initialized = False
        
        return False
    
    def set_rosbot_running(self, running: bool):
        """Set ROSBOT running status for interceptor"""
        self.rosbot_running = running
        if running:
            self.check_interval = 0.0  # No throttling when ROSBOT is running
            ColorPrint.blue("[LogMonitor] ROSBOT running - full speed monitoring")
        else:
            self.check_interval = 10.0  # 10-second throttling when not running
            ColorPrint.blue("[LogMonitor] ROSBOT stopped - throttled monitoring")
    
    def interceptor(self) -> bool:
        """Interceptor function to control execution frequency"""
        current_time = time.time()
        
        # If ROSBOT is running, always allow execution
        if self.rosbot_running:
            return True
        
        # If ROSBOT is not running, throttle to 10-second intervals
        if current_time - self.last_check_time >= self.check_interval:
            self.last_check_time = current_time
            return True
        
        return False


# Global instance
_log_monitor = None


def get_log_monitor() -> LogMonitor:
    """Get global log monitor instance"""
    global _log_monitor
    if _log_monitor is None:
        _log_monitor = LogMonitor()
    return _log_monitor


def check_logs() -> bool:
    """Check for new log content and analyze it"""
    return get_log_monitor().check_logs()


def set_log_file(file_path: str):
    """Set the log file to monitor"""
    get_log_monitor().set_log_file(file_path)


def get_default_interceptor():
    """Get the default interceptor function"""
    return get_log_monitor().interceptor


def set_rosbot_running(running: bool):
    """Set ROSBOT running status for interceptor control"""
    get_log_monitor().set_rosbot_running(running)