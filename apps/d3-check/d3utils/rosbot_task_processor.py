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
from providor.common_imports import ColorPrint
from d3utils.log_monitor import set_log_file, set_rosbot_running
from d3utils.game_state import get_game_state
from d3utils.task_thread_manager import TaskStatus


class RosbotTaskProcessor:
    """ROSBOT task processor for background operations"""
    
    def __init__(self):
        self.game_state = get_game_state()
        self.log_file_path: Optional[str] = None
        self.initialized = False
        
        ColorPrint.blue("[RosbotTaskProcessor] Initialized")
    
    def initialize(self):
        """Initialize ROSBOT task processor"""
        if not self.initialized:
            # Set log file path (hardcoded)
            self.log_file_path = os.path.expanduser(r"~\Documents\RoS-BoT\Logs\logs.txt")
            set_log_file(self.log_file_path)
            self.initialized = True
            ColorPrint.blue("[RosbotTaskProcessor] Initialized with log file")
    
    def start_rosbot(self):
        """Start ROSBOT monitoring"""
        try:
            from tkinter import messagebox
            messagebox.showinfo("Debug", "RosbotTaskProcessor.start_rosbot() called")
            
            if not self.initialized:
                messagebox.showinfo("Debug", "Initializing ROSBOT processor")
                self.initialize()
                messagebox.showinfo("Debug", "ROSBOT processor initialized")
            
            # Enable full-speed monitoring
            messagebox.showinfo("Debug", "Setting ROSBOT running to True")
            set_rosbot_running(True)
            messagebox.showinfo("Debug", "ROSBOT running set to True")
            
            # Update game state
            messagebox.showinfo("Debug", "Updating game state")
            self.game_state.set_rosbot_status(True)
            messagebox.showinfo("Debug", "Game state updated")
            
            ColorPrint.green("[RosbotTaskProcessor] ROSBOT monitoring started")
            messagebox.showinfo("Debug", "ROSBOT monitoring started successfully")
            
        except Exception as e:
            from tkinter import messagebox
            messagebox.showerror("Debug Error", f"Error in RosbotTaskProcessor.start_rosbot(): {e}")
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
        """Main task processing function"""
        # This method is called by the task thread
        # Currently just maintains the ROSBOT state
        # Future enhancements can be added here
        pass


# Global instance
_rosbot_processor = None


def get_rosbot_processor() -> RosbotTaskProcessor:
    """Get global ROSBOT task processor instance"""
    global _rosbot_processor
    if _rosbot_processor is None:
        _rosbot_processor = RosbotTaskProcessor()
    return _rosbot_processor


def start_rosbot_task():
    """Start ROSBOT task"""
    try:
        from tkinter import messagebox
        messagebox.showinfo("Debug", "Starting ROSBOT task processor")
        
        processor = get_rosbot_processor()
        messagebox.showinfo("Debug", "Got ROSBOT processor instance")
        
        processor.start_rosbot()
        messagebox.showinfo("Debug", "ROSBOT processor start_rosbot() completed")
        
    except Exception as e:
        from tkinter import messagebox
        messagebox.showerror("Debug Error", f"Error in start_rosbot_task: {e}")


def stop_rosbot_task():
    """Stop ROSBOT task"""
    processor = get_rosbot_processor()
    processor.stop_rosbot()


def process_rosbot_task():
    """Process ROSBOT task (called by task thread)"""
    processor = get_rosbot_processor()
    processor.process_task()
