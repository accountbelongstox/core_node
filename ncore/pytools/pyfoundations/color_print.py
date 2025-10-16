#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Color Print Base Class
Provides colored console output functionality as a base class
No dependencies on other project modules
"""

import sys
import os
import shutil
from typing import List, Callable, Optional

columns = shutil.get_terminal_size().columns


class ColorPrintCallback:
    """ColorPrint callback handler for multiple registrations"""
    
    def __init__(self):
        self._callbacks: List[Callable[[str, str], None]] = []
    
    def register(self, callback: Callable[[str, str], None]):
        """Register a callback function"""
        if callback not in self._callbacks:
            self._callbacks.append(callback)
    
    def unregister(self, callback: Callable[[str, str], None]):
        """Unregister a callback function"""
        if callback in self._callbacks:
            self._callbacks.remove(callback)
    
    def clear_all(self):
        """Clear all registered callbacks"""
        self._callbacks.clear()
    
    def notify(self, message: str, color_type: str = "white", log_level: str = None):
        """Notify all registered callbacks"""
        for callback in self._callbacks:
            try:
                # Support both old and new callback signatures
                import inspect
                sig = inspect.signature(callback)
                if len(sig.parameters) >= 3:
                    callback(message, color_type, log_level)
                else:
                    callback(message, color_type)
            except Exception:
                pass  # Ignore callback errors
    
    def get_callback_count(self) -> int:
        """Get number of registered callbacks"""
        return len(self._callbacks)


# Global callback handler instance
_color_print_callback = ColorPrintCallback()


class ColorPrint:
    """Base class for colored console output"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    GRAY = '\033[90m'
    WHITE = '\033[97m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    
    @staticmethod
    def register_callback(callback):
        """Register a callback function for log output"""
        _color_print_callback.register(callback)
    
    @staticmethod
    def unregister_callback(callback):
        """Unregister a callback function"""
        _color_print_callback.unregister(callback)
    
    @staticmethod
    def clear_all_callbacks():
        """Clear all registered callbacks"""
        _color_print_callback.clear_all()
    
    @staticmethod
    def get_callback_count():
        """Get number of registered callbacks"""
        return _color_print_callback.get_callback_count()
    
    @staticmethod
    def _log_to_callback(message, color_type="white", log_level=None):
        """Send message to all registered callbacks"""
        _color_print_callback.notify(message, color_type, log_level)
    
    @staticmethod
    def green(message):
        """Print green text"""
        print(f"{ColorPrint.GREEN}{message}{ColorPrint.RESET}")
        ColorPrint._log_to_callback(message, "green", "SUCCESS")

    @staticmethod
    def red(message):
        """Print red text"""
        print(f"{ColorPrint.RED}{message}{ColorPrint.RESET}")
        ColorPrint._log_to_callback(message, "red", "ERROR")

    @staticmethod
    def yellow(message):
        """Print yellow text"""
        print(f"{ColorPrint.YELLOW}{message}{ColorPrint.RESET}")
        ColorPrint._log_to_callback(message, "yellow", "WARNING")

    @staticmethod
    def gray(message):
        """Print gray text"""
        print(f"{ColorPrint.GRAY}{message}{ColorPrint.RESET}")
        ColorPrint._log_to_callback(message, "gray", "DEBUG")

    @staticmethod
    def white(message):
        """Print white text"""
        print(f"{ColorPrint.WHITE}{message}{ColorPrint.RESET}")
        ColorPrint._log_to_callback(message, "white", "INFO")

    @staticmethod
    def blue(message):
        """Print blue text"""
        print(f"{ColorPrint.BLUE}{message}{ColorPrint.RESET}")
        ColorPrint._log_to_callback(message, "blue", "INFO")
    
    @staticmethod
    def debug(message):
        """Print debug text (gray)"""
        print(f"{ColorPrint.GRAY}{message}{ColorPrint.RESET}")
        ColorPrint._log_to_callback(message, "gray", "DEBUG")

    @staticmethod
    def debug_messagebox(title: str, message: str, enabled: bool = True, msg_type: str = "info"):
        """
        Show debug messagebox if enabled, otherwise just log to console

        Args:
            title: Messagebox title (e.g., "DEBUG #1")
            message: Message content
            enabled: Whether to show messagebox (controlled by DEBUG_MESSAGEBOX flag)
            msg_type: Message type - "info" or "error"
        """
        if enabled:
            try:
                from tkinter import messagebox
                if msg_type == "error":
                    messagebox.showerror(title, message)
                else:
                    messagebox.showinfo(title, message)
            except Exception as e:
                # If tkinter is not available, just log to console
                ColorPrint.debug(f"[{title}] {message} (MessageBox Error: {e})")
        else:
            # Just log to console when disabled
            ColorPrint.debug(f"[{title}] {message}")

    @staticmethod
    def print_separator(char='-', length=None):
        """Print a separator line"""
        if length is None:
            length = min(columns, 80)
        print(char * length)

    @staticmethod
    def print_header(title, char='=', length=None):
        """Print a header with title"""
        if length is None:
            length = min(columns, 80)
        ColorPrint.print_separator(char, length)
        ColorPrint.blue(f" {title} ")
        ColorPrint.print_separator(char, length)

    @staticmethod
    def print_section(title, char='-', length=None):
        """Print a section header"""
        if length is None:
            length = min(columns, 60)
        ColorPrint.blue(f"{title}")
        ColorPrint.print_separator(char, length)

    @staticmethod
    def print_status(status, message, success_color=None, error_color=None):
        """Print status with colored indicator"""
        if success_color is None:
            success_color = ColorPrint.GREEN
        if error_color is None:
            error_color = ColorPrint.RED

        if status.lower() in ['success', 'ok', 'completed', 'done']:
            color = success_color
        elif status.lower() in ['error', 'failed', 'fail']:
            color = error_color
        else:
            color = ColorPrint.BLUE

        print(f"{color}[{status.upper()}]{ColorPrint.RESET} {message}")

    @staticmethod
    def print_progress(current, total, message="", bar_length=30):
        """Print progress bar"""
        if total == 0:
            percentage = 0
        else:
            percentage = (current / total) * 100

        filled_length = int(bar_length * current // total) if total > 0 else 0
        bar = '█' * filled_length + '-' * (bar_length - filled_length)

        progress_text = f"\r{ColorPrint.BLUE}[{bar}]{ColorPrint.RESET} {percentage:.1f}% {message}"
        print(progress_text, end='', flush=True)

        if current >= total:
            print()  # New line when complete

    @staticmethod
    def print_table_row(columns_data, widths=None, separator='|'):
        """Print a table row with aligned columns"""
        if widths is None:
            widths = [15] * len(columns_data)

        row = separator
        for i, data in enumerate(columns_data):
            width = widths[i] if i < len(widths) else 15
            row += f" {str(data):<{width}} {separator}"

        print(row)

    @staticmethod
    def print_table_header(headers, widths=None, separator='|'):
        """Print table header with separator line"""
        ColorPrint.print_table_row(headers, widths, separator)

        if widths is None:
            widths = [15] * len(headers)

        # Print separator line
        separator_line = separator
        for width in widths:
            separator_line += '-' * (width + 2) + separator
        print(separator_line)


def main():
    """Test function for ColorPrint base class"""
    ColorPrint.print_header("ColorPrint Base Class Test")

    ColorPrint.green("This is green text")
    ColorPrint.red("This is red text")
    ColorPrint.yellow("This is yellow text")
    ColorPrint.blue("This is blue text")
    ColorPrint.gray("This is gray text")
    ColorPrint.white("This is white text")

    ColorPrint.print_section("Status Examples")
    ColorPrint.print_status("SUCCESS", "Operation completed successfully")
    ColorPrint.print_status("ERROR", "Operation failed")
    ColorPrint.print_status("INFO", "Information message")

    ColorPrint.print_section("Progress Example")
    for i in range(11):
        ColorPrint.print_progress(i, 10, f"Processing step {i}")
        import time
        time.sleep(0.1)

    ColorPrint.print_section("Table Example")
    ColorPrint.print_table_header(["Name", "Status", "Value"], [20, 15, 10])
    ColorPrint.print_table_row(["Process 1", "Running", "100"], [20, 15, 10])
    ColorPrint.print_table_row(["Process 2", "Stopped", "0"], [20, 15, 10])


if __name__ == "__main__":
    main()