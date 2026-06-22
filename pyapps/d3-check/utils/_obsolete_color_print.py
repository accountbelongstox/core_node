#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys
import os

import shutil
columns = shutil.get_terminal_size().columns

# Import UI manager for log capture

class ColorPrint:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    GRAY = '\033[90m'
    WHITE = '\033[97m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    
    _last_was_update_line = False
    
    @staticmethod
    def green(text: str):
        if ColorPrint._last_was_update_line:
            print()
            ColorPrint._last_was_update_line = False
        print(ColorPrint.GREEN + text + ColorPrint.RESET)
    
    @staticmethod
    def blue(text: str):
        if ColorPrint._last_was_update_line:
            print()
            ColorPrint._last_was_update_line = False
        print(ColorPrint.BLUE + text + ColorPrint.RESET)

    @staticmethod
    def red(text: str):
        if ColorPrint._last_was_update_line:
            print()
            ColorPrint._last_was_update_line = False
        print(ColorPrint.RED + text + ColorPrint.RESET)
    
    @staticmethod
    def yellow(text: str):
        if ColorPrint._last_was_update_line:
            print()
            ColorPrint._last_was_update_line = False
        print(ColorPrint.YELLOW + text + ColorPrint.RESET)
    
    @staticmethod
    def gray(text: str):
        if ColorPrint._last_was_update_line:
            print()
            ColorPrint._last_was_update_line = False
        print(ColorPrint.GRAY + text + ColorPrint.RESET)
    
    @staticmethod
    def white(text: str):
        if ColorPrint._last_was_update_line:
            print()
            ColorPrint._last_was_update_line = False
        print(ColorPrint.WHITE + text + ColorPrint.RESET)
    
    @staticmethod
    def print_colored(text: str):
        if ColorPrint._last_was_update_line:
            print()
            ColorPrint._last_was_update_line = False
        if ' INFO ' in text:
            print(ColorPrint.GREEN + text + ColorPrint.RESET)
        elif ' ERROR ' in text or ' FATAL ' in text:
            print(ColorPrint.RED + text + ColorPrint.RESET)
        elif ' WARNING ' in text or ' WARN ' in text:
            print(ColorPrint.YELLOW + text + ColorPrint.RESET)
        elif ' DEBUG ' in text:
            print(ColorPrint.GRAY + text + ColorPrint.RESET)
        else:
            print(ColorPrint.WHITE + text + ColorPrint.RESET)
        
    
    @staticmethod
    def update_line(text: str, color: str = WHITE):
        """Print text on same line, overwriting previous content"""
        need_to_print = text + " " * (columns - len(text) -10)
        print(f"\r{color}{need_to_print}{ColorPrint.RESET}", end='', flush=True)
        ColorPrint._last_was_update_line = True