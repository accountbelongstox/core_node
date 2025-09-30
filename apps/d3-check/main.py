#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3Check - Diablo III Bot Auto Control System
Main entry point for the application
"""

from controller.d3_macro_controller import D3MacroController

if __name__ == "__main__":
    D3MacroController().run()