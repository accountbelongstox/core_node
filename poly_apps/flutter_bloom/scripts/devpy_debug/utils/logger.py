#!/usr/bin/env python3

import sys
from typing import Optional

class ColoredLogger:
    """Colored console logger for better visibility"""

    # ANSI color codes
    COLORS = {
        'SUCCESS': '\033[92m',   # Green
        'INFO': '\033[94m',      # Blue
        'WARNING': '\033[93m',   # Yellow
        'ERROR': '\033[91m',     # Red
        'COMMAND': '\033[95m',   # Magenta
        'CYAN': '\033[96m',      # Cyan
        'WHITE': '\033[97m',     # White
        'RESET': '\033[0m'       # Reset
    }

    def __init__(self, use_colors: bool = True):
        self.use_colors = use_colors

    def _colorize(self, message: str, color: str) -> str:
        """Apply color to message if colors are enabled"""
        if not self.use_colors:
            return message
        return f"{self.COLORS.get(color, '')}{message}{self.COLORS['RESET']}"

    def _log(self, message: str, level: str, prefix: Optional[str] = None):
        """Internal logging method"""
        if prefix:
            formatted_message = f"[{prefix}] {message}"
        else:
            formatted_message = f"[{level}] {message}"

        colored_message = self._colorize(formatted_message, level)
        print(colored_message, file=sys.stderr)

    def success(self, message: str, prefix: Optional[str] = None):
        """Log success message"""
        self._log(message, 'SUCCESS', prefix)

    def info(self, message: str, prefix: Optional[str] = None):
        """Log info message"""
        self._log(message, 'INFO', prefix)

    def warning(self, message: str, prefix: Optional[str] = None):
        """Log warning message"""
        self._log(message, 'WARNING', prefix)

    def error(self, message: str, prefix: Optional[str] = None):
        """Log error message"""
        self._log(message, 'ERROR', prefix)

    def command(self, message: str, prefix: Optional[str] = None):
        """Log command message"""
        self._log(message, 'COMMAND', prefix)

    def cyan(self, message: str, prefix: Optional[str] = None):
        """Log cyan colored message"""
        self._log(message, 'CYAN', prefix)

    def white(self, message: str, prefix: Optional[str] = None):
        """Log white message"""
        self._log(message, 'WHITE', prefix)

    def header(self, title: str, char: str = "=", width: int = 50):
        """Print a header with decorative characters"""
        print("", file=sys.stderr)
        print(char * width, file=sys.stderr)
        print(title, file=sys.stderr)
        print(char * width, file=sys.stderr)

    def separator(self, char: str = "-", width: int = 50):
        """Print a separator line"""
        print(char * width, file=sys.stderr)

    def blank_line(self):
        """Print a blank line"""
        print("", file=sys.stderr)

# Global logger instance
logger = ColoredLogger()

# Convenience functions for quick access
def log_success(message: str, prefix: Optional[str] = None):
    logger.success(message, prefix)

def log_info(message: str, prefix: Optional[str] = None):
    logger.info(message, prefix)

def log_warning(message: str, prefix: Optional[str] = None):
    logger.warning(message, prefix)

def log_error(message: str, prefix: Optional[str] = None):
    logger.error(message, prefix)

def log_command(message: str, prefix: Optional[str] = None):
    logger.command(message, prefix)

def log_cyan(message: str, prefix: Optional[str] = None):
    logger.cyan(message, prefix)

def log_header(title: str, char: str = "=", width: int = 50):
    logger.header(title, char, width)

def log_separator(char: str = "-", width: int = 50):
    logger.separator(char, width)

def log_blank():
    logger.blank_line()