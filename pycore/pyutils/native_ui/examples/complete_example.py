#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Framework - Complete Application Example
Comprehensive demonstration of all features: signal system, timer, main thread methods
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


class CompleteApp(NativeUIFramework):
    """Complete application example"""

    def __init__(self):
        config = UIConfig(
            app_name="Complete Application Example",
            window_size=(1000, 700),
            show_on_start=True,
            debug=True
        )

        super().__init__(config)

        # Application data
        self.data = {
            'total_ticks': 0,
            'tasks_executed': 0,
            'methods_called': 0
        }

        # Initialize
        self._setup()

    def _setup(self):
        """Setup application"""
        # Register signal handlers
        self.register_signal_handler(SignalType.UI_READY, self._on_ui_ready)
        self.register_signal_handler(SignalType.CUSTOM, self._on_custom_signal)

        # Register timer tasks
        self.register_timer_task('monitor', self._task_monitor, interval=5)
        self.register_timer_task('heartbeat', self._task_heartbeat, interval=10)

        # Register main thread methods
        self.register_main_method('log_event', self._main_log_event)
        self.register_main_method('update_stats', self._main_update_stats)

    # ============================================
    # Signal Handlers
    # ============================================

    def _on_ui_ready(self, signal: Signal):
        """UI ready"""
        ColorPrint.green("\n" + "=" * 60)
        ColorPrint.green(" Complete Application Example Started")
        ColorPrint.green("=" * 60)
        ColorPrint.cyan("\nFeature Overview:")
        ColorPrint.cyan("- Signal System: Handles window control and custom events")
        ColorPrint.cyan("- Timer: Monitor every 5s, heartbeat every 10s")
        ColorPrint.cyan("- Main Thread Methods: Safe UI operations")
        ColorPrint.green("\n" + "=" * 60 + "\n")

        # Send welcome signal
        self.emit_signal(SignalType.CUSTOM, {
            'type': 'welcome',
            'message': 'Welcome to Native UI Framework!'
        })

    def _on_custom_signal(self, signal: Signal):
        """Custom signal handler"""
        sig_type = signal.data.get('type')

        if sig_type == 'welcome':
            message = signal.data.get('message')
            ColorPrint.green(f"📢 {message}")

        elif sig_type == 'task_complete':
            task_name = signal.data.get('task_name')
            ColorPrint.blue(f"✅ Task completed: {task_name}")

    # ============================================
    # Timer Tasks
    # ============================================

    def _task_monitor(self):
        """Monitor task (every 5 seconds)"""
        self.data['total_ticks'] += 5
        self.data['tasks_executed'] += 1

        ColorPrint.yellow(f"🔍 [Monitor] Tick: {self.data['total_ticks']}s, " +
                         f"Tasks: {self.data['tasks_executed']}")

        # Call main thread method to update stats
        self.call_main_method('update_stats', key='tasks_executed',
                             value=self.data['tasks_executed'])

    def _task_heartbeat(self):
        """Heartbeat task (every 10 seconds)"""
        ColorPrint.green(f"💓 [Heartbeat] Application running normally (uptime {self.data['total_ticks']}s)")

        # Send task complete signal
        self.emit_signal(SignalType.CUSTOM, {
            'type': 'task_complete',
            'task_name': 'heartbeat'
        })

    # ============================================
    # Main Thread Methods
    # ============================================

    def _main_log_event(self, event: str):
        """Main thread method: Log event"""
        ColorPrint.cyan(f"📝 [Event Log] {event}")

    def _main_update_stats(self, key: str, value: int):
        """Main thread method: Update statistics"""
        self.data['methods_called'] += 1
        ColorPrint.blue(f"📊 [Stats] {key} = {value}, " +
                       f"Methods Called: {self.data['methods_called']}")


def main():
    """Main function"""
    ColorPrint.blue("=" * 60)
    ColorPrint.blue(" Native UI Framework - Complete Application Example")
    ColorPrint.blue("=" * 60)

    app = CompleteApp()
    app.start()


if __name__ == '__main__':
    main()
