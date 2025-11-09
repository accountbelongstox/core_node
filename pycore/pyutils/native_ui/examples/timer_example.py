#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Framework - Timer Example
Demonstrates Task timer and interval parameter usage
"""

import sys
import os

# Add project root directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../..')))

from pycore.pyutils.native_ui import (
    NativeUIFramework,
    UIConfig,
    SignalType,
    Signal
)
from pycore.pyfoundations.color_print import ColorPrint


class TimerDemoApp(NativeUIFramework):
    """Timer demonstration application"""

    def __init__(self):
        config = UIConfig(
            app_name="Timer Example",
            window_size=(800, 600),
            show_on_start=True,
            debug=True
        )

        super().__init__(config)

        # Application state
        self.counter_1s = 0
        self.counter_3s = 0
        self.counter_5s = 0

        # Register timer tasks
        self._register_timer_tasks()

        # Register signal handlers
        self.register_signal_handler(SignalType.UI_READY, self._on_ui_ready)

    def _register_timer_tasks(self):
        """Register timer tasks"""
        # Task 1: Execute every 1 second (interval=1)
        self.register_timer_task(
            name="task_1s",
            callback=self._task_every_1s,
            interval=1  # Execute every 1 tick
        )

        # Task 2: Execute every 3 seconds (interval=3)
        self.register_timer_task(
            name="task_3s",
            callback=self._task_every_3s,
            interval=3  # Execute every 3 ticks
        )

        # Task 3: Execute every 5 seconds (interval=5)
        self.register_timer_task(
            name="task_5s",
            callback=self._task_every_5s,
            interval=5  # Execute every 5 ticks
        )

    def _on_ui_ready(self, signal: Signal):
        """UI ready callback"""
        ColorPrint.green("\n" + "=" * 60)
        ColorPrint.green(" Timer Demo Application Started")
        ColorPrint.green("=" * 60)
        ColorPrint.cyan("\nTimer Task Description:")
        ColorPrint.cyan("- Task 1: Executes every 1 second")
        ColorPrint.cyan("- Task 2: Executes every 3 seconds")
        ColorPrint.cyan("- Task 3: Executes every 5 seconds")
        ColorPrint.green("\n" + "=" * 60 + "\n")

    def _task_every_1s(self):
        """Task executed every 1 second"""
        self.counter_1s += 1
        ColorPrint.blue(f"[1s Task] Execution count: {self.counter_1s}")

    def _task_every_3s(self):
        """Task executed every 3 seconds"""
        self.counter_3s += 1
        ColorPrint.yellow(f"[3s Task] Execution count: {self.counter_3s}")

    def _task_every_5s(self):
        """Task executed every 5 seconds"""
        self.counter_5s += 1
        ColorPrint.green(f"[5s Task] Execution count: {self.counter_5s}")


def main():
    """Main function"""
    ColorPrint.blue("=" * 60)
    ColorPrint.blue(" Native UI Framework - Timer Example")
    ColorPrint.blue("=" * 60)

    app = TimerDemoApp()
    app.start()


if __name__ == '__main__':
    main()
