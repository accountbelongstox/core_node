from pprint import pprint
from typing import Any
from datetime import datetime

class Printer:
    """Utility class for colored and formatted printing"""
    
    # ANSI Color codes
    COLORS = {
        'red': '\033[91m',
        'green': '\033[92m',
        'yellow': '\033[93m',
        'blue': '\033[94m',
        'purple': '\033[95m',
        'cyan': '\033[96m',
        'white': '\033[97m',
        'end': '\033[0m'
    }

    @classmethod
    def _format_color(cls, text: str, color: str) -> str:
        """Format text with color"""
        color_code = cls.COLORS.get(color.lower(), '')
        if color_code:
            return f"{color_code}{text}{cls.COLORS['end']}"
        return text

    @classmethod
    def print(cls, message: str, color: str = 'white'):
        """Print text with color"""
        print(cls._format_color(message, color))

    @classmethod
    def success(cls, message: str):
        """Print success message in green"""
        cls.print(message, 'green')
    
    @classmethod
    def error(cls, message: str):
        """Print error message in red"""
        cls.print(message, 'red')
    
    @classmethod
    def warning(cls, message: str):
        """Print warning message in yellow"""
        cls.print(message, 'yellow')
    
    @classmethod
    def info(cls, message: str):
        """Print info message in cyan"""
        cls.print(message, 'cyan')
    
    @classmethod
    def debug(cls, message: str):
        """Print debug message in blue"""
        cls.print(message, 'blue') 