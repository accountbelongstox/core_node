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
import time
import hashlib
import re
import inspect
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
            # Verify callback is callable
            if not callable(callback):
                continue

            # Check callback signature - let errors expose naturally
            sig = inspect.signature(callback)
            if len(sig.parameters) >= 3:
                callback(message, color_type, log_level)
            else:
                callback(message, color_type)
    
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

    _printed_hashes = set()
    _last_print_times = {}
    
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

    # ========================================
    # Semantic aliases for consistent API
    # ========================================

    @staticmethod
    def print_info(message):
        """Print info message (blue) - alias for blue()"""
        ColorPrint.blue(message)

    @staticmethod
    def print_warn(message):
        """Print warning message (yellow) - alias for yellow()"""
        ColorPrint.yellow(message)

    @staticmethod
    def print_warning(message):
        """Print warning message (yellow) - alias for yellow()"""
        ColorPrint.yellow(message)

    @staticmethod
    def print_error(message):
        """Print error message (red) - alias for red()"""
        ColorPrint.red(message)

    @staticmethod
    def print_success(message):
        """Print success message (green) - alias for green()"""
        ColorPrint.green(message)

    @staticmethod
    def print_debug(message):
        """Print debug message (gray) - alias for debug()"""
        ColorPrint.debug(message)

    @staticmethod
    def info(message):
        """Print info message (blue) - alias for blue()"""
        ColorPrint.blue(message)

    @staticmethod
    def warn(message):
        """Print warning message (yellow) - alias for yellow()"""
        ColorPrint.yellow(message)

    @staticmethod
    def warning(message):
        """Print warning message (yellow) - alias for yellow()"""
        ColorPrint.yellow(message)

    @staticmethod
    def error(message):
        """Print error message (red) - alias for red()"""
        ColorPrint.red(message)

    @staticmethod
    def success(message):
        """Print success message (green) - alias for green()"""
        ColorPrint.green(message)

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

    @staticmethod
    def _hash_message(message):
        m = hashlib.md5()
        m.update(str(message).encode('utf-8'))
        return m.hexdigest()

    @staticmethod
    def _parse_duration_to_seconds(interval):
        if isinstance(interval, (int, float)):
            return float(interval)
        s = str(interval).strip().lower()
        m = re.fullmatch(r"\s*(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)?\s*", s)
        if not m:
            return 0.0
        value = float(m.group(1))
        unit = m.group(2) or 's'
        if unit in ('s', 'sec', 'secs', 'second', 'seconds'):
            return value
        if unit in ('m', 'min', 'mins', 'minute', 'minutes'):
            return value * 60
        if unit in ('h', 'hr', 'hrs', 'hour', 'hours'):
            return value * 3600
        if unit in ('d', 'day', 'days'):
            return value * 86400
        return value

    @staticmethod
    def _call_color_printer(color, message):
        fn = getattr(ColorPrint, color, None)
        if callable(fn):
            fn(message)
        else:
            ColorPrint.white(message)

    @staticmethod
    def print_once(message, color='white'):
        h = ColorPrint._hash_message(message)
        if h in ColorPrint._printed_hashes:
            return
        ColorPrint._printed_hashes.add(h)
        ColorPrint._call_color_printer(color, message)

    @staticmethod
    def print_min_interval(message, interval="1min", color='white'):
        seconds = ColorPrint._parse_duration_to_seconds(interval)
        h = ColorPrint._hash_message(message)
        now = time.time()
        last = ColorPrint._last_print_times.get(h)
        if last is None or (now - last) >= seconds:
            ColorPrint._last_print_times[h] = now
            ColorPrint._call_color_printer(color, message)


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