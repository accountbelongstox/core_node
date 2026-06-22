#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Printer - Colorized Output Utility

Provides colorized printing for console output.
"""

from typing import Optional
from pycore.pyfoundations.color_print import ColorPrint


class Printer:
    """
    Printer Class
    
    Provides colorized console output with optional prefix.
    Wraps ColorPrint for consistent logging across the application.
    """
    
    def __init__(self, prefix: str = ""):
        """
        Initialize printer
        
        Args:
            prefix (str): Prefix for all messages
        """
        self.prefix = prefix
    
    def _format_message(self, message: str) -> str:
        """
        Format message with prefix
        
        Args:
            message (str): Message to format
            
        Returns:
            str: Formatted message
        """
        if self.prefix:
            return f"{self.prefix} {message}"
        return message
    
    def info(self, message: str):
        """Print info message in blue"""
        ColorPrint.blue(self._format_message(message))
    
    def success(self, message: str):
        """Print success message in green"""
        ColorPrint.green(self._format_message(message))
    
    def warning(self, message: str):
        """Print warning message in yellow"""
        ColorPrint.yellow(self._format_message(message))
    
    def error(self, message: str):
        """Print error message in red"""
        ColorPrint.red(self._format_message(message))
    
    def plain(self, message: str):
        """Print plain message without color"""
        print(self._format_message(message))
    
    def header(self, title: str, width: int = 80):
        """
        Print header with separator
        
        Args:
            title (str): Header title
            width (int): Header width
        """
        ColorPrint.green("\n" + "=" * width)
        ColorPrint.green(title)
        ColorPrint.green("=" * width)
    
    def separator(self, width: int = 80):
        """
        Print separator line
        
        Args:
            width (int): Separator width
        """
        print("-" * width)
    
    def key_value(self, key: str, value: any, color: str = "blue"):
        """
        Print key-value pair
        
        Args:
            key (str): Key name
            value: Value to print
            color (str): Color for value
        """
        message = f"  {key}: {value}"
        
        if color == "blue":
            ColorPrint.blue(message)
        elif color == "green":
            ColorPrint.green(message)
        elif color == "yellow":
            ColorPrint.yellow(message)
        elif color == "red":
            ColorPrint.red(message)
        else:
            print(message)
    
    def table_row(self, *columns, widths: Optional[list] = None):
        """
        Print table row
        
        Args:
            *columns: Column values
            widths (list): Column widths
        """
        if widths:
            formatted_cols = []
            for col, width in zip(columns, widths):
                formatted_cols.append(str(col).ljust(width))
            print("  " + " | ".join(formatted_cols))
        else:
            print("  " + " | ".join(str(col) for col in columns))
    
    def progress(self, current: int, total: int, prefix: str = ""):
        """
        Print progress indicator
        
        Args:
            current (int): Current progress
            total (int): Total items
            prefix (str): Progress prefix
        """
        percentage = (current / total) * 100 if total > 0 else 0
        message = f"{prefix} [{current}/{total}] {percentage:.1f}%"
        ColorPrint.blue(self._format_message(message))
    
    def ticker_info(self, inst_id: str, price: str, change_24h: str, volume_24h: str = None):
        """
        Print ticker information in formatted style
        
        Args:
            inst_id (str): Instrument ID
            price (str): Current price
            change_24h (str): 24h change percentage
            volume_24h (str): 24h volume (optional)
        """
        ColorPrint.blue(f"\n{inst_id}:")
        print(f"  Price: {price}")
        
        try:
            change_float = float(change_24h.rstrip('%'))
            if change_float >= 0:
                ColorPrint.green(f"  24h Change: +{change_24h}%")
            else:
                ColorPrint.red(f"  24h Change: {change_24h}%")
        except (ValueError, AttributeError):
            print(f"  24h Change: {change_24h}")
        
        if volume_24h:
            print(f"  24h Volume: {volume_24h}")

