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

columns = shutil.get_terminal_size().columns


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
    def green(message):
        """Print green text"""
        print(f"{ColorPrint.GREEN}{message}{ColorPrint.RESET}")
    
    @staticmethod
    def red(message):
        """Print red text"""
        print(f"{ColorPrint.RED}{message}{ColorPrint.RESET}")
    
    @staticmethod
    def yellow(message):
        """Print yellow text"""
        print(f"{ColorPrint.YELLOW}{message}{ColorPrint.RESET}")
    
    @staticmethod
    def gray(message):
        """Print gray text"""
        print(f"{ColorPrint.GRAY}{message}{ColorPrint.RESET}")
    
    @staticmethod
    def white(message):
        """Print white text"""
        print(f"{ColorPrint.WHITE}{message}{ColorPrint.RESET}")
    
    @staticmethod
    def blue(message):
        """Print blue text"""
        print(f"{ColorPrint.BLUE}{message}{ColorPrint.RESET}")
    
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
