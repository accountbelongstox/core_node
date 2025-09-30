#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Log Output Widget
Provides a scrollable log output widget with color support
"""

import tkinter as tk
from tkinter import ttk, scrolledtext
from datetime import datetime
import sys
import os
from typing import Optional

# Add ncore path for color_print
ncore_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "ncore")
sys.path.insert(0, ncore_path)

from pytools.pyfoundations.color_print import ColorPrint


class LogOutputWidget:
    """Log output widget with color support and auto-scroll"""
    
    def __init__(self, parent, config_manager=None):
        """Initialize log output widget"""
        self.parent = parent
        self.config_manager = config_manager
        self.auto_scroll = True
        self.max_lines = 1000  # Maximum number of lines to keep
        
        # Log level mapping
        self.log_levels = {
            'DEBUG': 0,
            'INFO': 1,
            'WARNING': 2,
            'ERROR': 3,
            'CRITICAL': 4
        }
        self.current_log_level = 'INFO'  # Default log level
        
        # Create log frame
        self.log_frame = ttk.LabelFrame(parent, text="日志输出 (Log Output)", padding=5)
        self.log_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        
        # Create log level control frame
        self.control_frame = ttk.Frame(self.log_frame)
        self.control_frame.pack(fill=tk.X, pady=(0, 5))
        
        # Log level dropdown
        ttk.Label(self.control_frame, text="日志级别:").pack(side=tk.LEFT, padx=(0, 5))
        self.log_level_var = tk.StringVar(value=self.current_log_level)
        self.log_level_combo = ttk.Combobox(
            self.control_frame,
            textvariable=self.log_level_var,
            values=list(self.log_levels.keys()),
            state="readonly",
            width=10
        )
        self.log_level_combo.pack(side=tk.LEFT, padx=(0, 10))
        self.log_level_combo.bind('<<ComboboxSelected>>', self._on_log_level_changed)
        
        # Load log level from config
        self._load_log_level_from_config()
        
        # Create scrolled text widget
        self.log_text = scrolledtext.ScrolledText(
            self.log_frame,
            wrap=tk.WORD,
            width=100,
            height=20,
            bg='#1e1e1e',
            fg='#ffffff',
            font=('Consolas', 9),
            insertbackground='white'
        )
        self.log_text.pack(fill=tk.BOTH, expand=True)
        
        # Configure text tags for colors
        self._setup_color_tags()
        
        # Bind scroll events
        self.log_text.bind('<MouseWheel>', self._on_scroll)
        self.log_text.bind('<Button-4>', self._on_scroll)  # Linux scroll up
        self.log_text.bind('<Button-5>', self._on_scroll)  # Linux scroll down
        
        # Register with ColorPrint
        self._register_color_print_callback()
    
    def _setup_color_tags(self):
        """Setup color tags for different log levels"""
        self.log_text.tag_configure("green", foreground="#00ff00")
        self.log_text.tag_configure("red", foreground="#ff4444")
        self.log_text.tag_configure("yellow", foreground="#ffff00")
        self.log_text.tag_configure("blue", foreground="#4444ff")
        self.log_text.tag_configure("gray", foreground="#888888")
        self.log_text.tag_configure("white", foreground="#ffffff")
        self.log_text.tag_configure("timestamp", foreground="#888888", font=('Consolas', 8))
    
    def _on_scroll(self, event):
        """Handle scroll events to control auto-scroll"""
        # Check if user is at the bottom
        self.log_text.see(tk.END)
        self.auto_scroll = True
    
    def _register_color_print_callback(self):
        """Register callback with ColorPrint"""
        ColorPrint.register_callback(self._log_callback)
    
    def _log_callback(self, message, color_type="white"):
        """Callback function for ColorPrint"""
        # Determine log level based on color type
        log_level = "INFO"
        if color_type == "red":
            log_level = "ERROR"
        elif color_type == "yellow":
            log_level = "WARNING"
        elif color_type == "blue":
            log_level = "INFO"
        elif color_type == "green":
            log_level = "INFO"
        elif color_type == "gray":
            log_level = "DEBUG"
        
        self.add_log(message, color_type, log_level)
    
    def add_log(self, message, color_type="white", log_level="INFO"):
        """Add a log message with specified color and log level"""
        try:
            # Check if message should be filtered based on log level
            if not self._should_show_message(log_level):
                return
                
            # Get current timestamp
            timestamp = datetime.now().strftime("%H:%M:%S")
            
            # Insert timestamp
            self.log_text.insert(tk.END, f"[{timestamp}] ", "timestamp")
            
            # Insert log level
            self.log_text.insert(tk.END, f"[{log_level}] ", "gray")
            
            # Insert message with color
            self.log_text.insert(tk.END, f"{message}\n", color_type)
            
            # Remove old lines if exceeding max_lines
            self._cleanup_old_lines()
            
            # Auto-scroll if enabled
            if self.auto_scroll:
                self.log_text.see(tk.END)
            
            # Update display
            self.log_text.update_idletasks()
            
        except Exception as e:
            # Fallback to simple print if widget fails
            print(f"Log widget error: {e}")
    
    def _cleanup_old_lines(self):
        """Remove old lines if exceeding max_lines"""
        try:
            lines = self.log_text.get("1.0", tk.END).split('\n')
            if len(lines) > self.max_lines:
                # Remove oldest lines
                lines_to_remove = len(lines) - self.max_lines
                self.log_text.delete("1.0", f"{lines_to_remove}.0")
        except Exception:
            pass  # Ignore cleanup errors
    
    def clear_log(self):
        """Clear all log content"""
        self.log_text.delete("1.0", tk.END)
    
    def set_auto_scroll(self, enabled):
        """Enable or disable auto-scroll"""
        self.auto_scroll = enabled
    
    def get_log_content(self):
        """Get current log content"""
        return self.log_text.get("1.0", tk.END)
    
    def save_log_to_file(self, filename):
        """Save log content to file"""
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(self.get_log_content())
            return True
        except Exception as e:
            self.add_log(f"Failed to save log: {e}", "red")
            return False
    
    def _should_show_message(self, log_level):
        """Check if message should be shown based on current log level"""
        try:
            current_level = self.log_levels.get(self.current_log_level, 1)
            message_level = self.log_levels.get(log_level, 1)
            return message_level >= current_level
        except Exception:
            return True  # Show message if level check fails
    
    def _on_log_level_changed(self, event=None):
        """Handle log level dropdown change"""
        try:
            new_level = self.log_level_var.get()
            if new_level != self.current_log_level:
                self.current_log_level = new_level
                self._save_log_level_to_config()
                self.add_log(f"日志级别已更改为: {new_level}", "blue", "INFO")
        except Exception as e:
            print(f"Error changing log level: {e}")
    
    def _load_log_level_from_config(self):
        """Load log level from configuration"""
        try:
            if self.config_manager:
                auxiliary_config = self.config_manager.get_auxiliary_config()
                log_level = auxiliary_config.get('log_level', 'INFO')
                if log_level in self.log_levels:
                    self.current_log_level = log_level
                    self.log_level_var.set(log_level)
        except Exception as e:
            print(f"Error loading log level from config: {e}")
    
    def _save_log_level_to_config(self):
        """Save log level to configuration"""
        try:
            if self.config_manager:
                config_data = {'log_level': self.current_log_level}
                self.config_manager.update_auxiliary_config(config_data)
        except Exception as e:
            print(f"Error saving log level to config: {e}")
    
    def destroy(self):
        """Clean up and unregister callback"""
        ColorPrint.unregister_callback(self._log_callback)
        if hasattr(self, 'log_frame'):
            self.log_frame.destroy()


# Test function
def main():
    """Test function for LogOutputWidget"""
    root = tk.Tk()
    root.title("Log Output Widget Test")
    root.geometry("800x600")
    
    # Create log widget
    log_widget = LogOutputWidget(root)
    
    # Test buttons
    button_frame = ttk.Frame(root)
    button_frame.pack(fill=tk.X, padx=10, pady=5)
    
    ttk.Button(button_frame, text="Test Green", 
              command=lambda: ColorPrint.green("This is a green test message")).pack(side=tk.LEFT, padx=5)
    ttk.Button(button_frame, text="Test Red", 
              command=lambda: ColorPrint.red("This is a red test message")).pack(side=tk.LEFT, padx=5)
    ttk.Button(button_frame, text="Test Blue", 
              command=lambda: ColorPrint.blue("This is a blue test message")).pack(side=tk.LEFT, padx=5)
    ttk.Button(button_frame, text="Clear Log", 
              command=log_widget.clear_log).pack(side=tk.LEFT, padx=5)
    
    # Test some messages
    ColorPrint.green("Log widget initialized successfully")
    ColorPrint.blue("Testing different color outputs")
    ColorPrint.yellow("This is a warning message")
    ColorPrint.red("This is an error message")
    
    root.mainloop()


if __name__ == "__main__":
    main()
