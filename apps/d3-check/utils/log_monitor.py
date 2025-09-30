#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Log Monitor Utility
"""

import os
import sys
import re
from typing import List, Callable, Optional

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from providor.providor_second import LOGS_FILE_PATH
from utils.color_print import ColorPrint


def match_print_method(text: str) -> str:
    """Match text content to appropriate ColorPrint method"""
    if ' INFO ' in text:
        return 'green'
    elif ' ERROR ' in text or ' FATAL ' in text:
        return 'red'
    elif ' WARNING ' in text or ' WARN ' in text:
        return 'yellow'
    elif ' DEBUG ' in text:
        return 'gray'
    else:
        return 'white'


class LogMonitor:
    def __init__(self):
        self.log_file_path = LOGS_FILE_PATH
        self.last_position = 0
        self.first_run = True
        self.callbacks: List[Callable[[str], None]] = []
        
        # Initialize to end of file
        if os.path.exists(self.log_file_path):
            with open(self.log_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                f.seek(0, 2)
                self.last_position = f.tell()
    
    def check_new_logs(self):
        """Check for new log content and process it"""
        if not os.path.exists(self.log_file_path):
            return
        
        try:
            with open(self.log_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                f.seek(0, 2)
                current_size = f.tell()
                
                if current_size < self.last_position:
                    self.last_position = 0
                
                f.seek(self.last_position)
                new_content = f.read()
                
                if new_content:
                    new_lines = [line.rstrip('\n\r') for line in new_content.split('\n') if line.strip()]
                    self.last_position = f.tell()
                    
                    # Don't print on first run
                    if not self.first_run:
                        for line in new_lines:
                            method_name = match_print_method(line)
                            getattr(ColorPrint, method_name)(line)
                    
                    # Send to callbacks
                    for callback in self.callbacks:
                        for line in new_lines:
                            try:
                                callback(line)
                            except:
                                pass
                    
                    if self.first_run:
                        self.first_run = False
        except:
            pass


# Global instance
_monitor = LogMonitor()

def start_log_monitoring(callbacks: Optional[List[Callable[[str], None]]] = None):
    """Initialize log monitoring with optional callbacks"""
    if callbacks:
        _monitor.callbacks = callbacks

def check_logs():
    """Check for new logs - call this in your main loop every 500ms"""
    _monitor.check_new_logs() 