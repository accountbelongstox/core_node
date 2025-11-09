#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Framework - Basic Example
Demonstrates basic window and signal system usage
"""

import sys
import os

# Add project root directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..')))

from pycore.pyutils.native_ui import (
    create_ui_framework,
    SignalType,
    Signal
)
from pycore.pyfoundations.color_print import ColorPrint


def main():
    """Basic example main function"""
    ColorPrint.blue("=" * 60)
    ColorPrint.blue(" Native UI Framework - Basic Example")
    ColorPrint.blue("=" * 60)

    # Create UI framework
    app = create_ui_framework(
        app_name="Basic Example",
        window_size=(800, 600),
        show_on_start=True,
        debug=True
    )

    # Register UI ready signal handler
    def on_ui_ready(signal: Signal):
        ColorPrint.green("\n✅ UI ready! You can start interacting now\n")

    app.register_signal_handler(SignalType.UI_READY, on_ui_ready)

    # Start application
    ColorPrint.cyan("\nStarting application...\n")
    app.start()


if __name__ == '__main__':
    main()
