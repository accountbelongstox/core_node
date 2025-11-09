#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native UI Framework - Thread Architecture Module
Clear separation of thread responsibilities - ASCII only
"""

# Check and install dependencies before importing
from pycore import check_and_install_dependencies
check_and_install_dependencies()

# Import ColorPrint for logging
from pycore.pyfoundations.color_print import ColorPrint

import threading
import time
from typing import Optional


class UIThread(threading.Thread):
    """
    UI Thread - Runs Tkinter mainloop
    Responsibility: Handle UI rendering and user interactions
    """

    def __init__(self, framework_instance, name="UIThread"):
        super().__init__(name=name, daemon=False)
        self.framework = framework_instance
        self.running = False

    def run(self):
        """Thread entry point - creates and runs Tkinter UI"""
        ColorPrint.green(f"[{self.name}] Started")
        self.running = True

        try:
            self.framework._create_tkinter_ui()
            self.framework._run_tkinter_mainloop()
        except Exception as e:
            ColorPrint.red(f"[{self.name}] Error: {e}")
        finally:
            self.running = False
            ColorPrint.yellow(f"[{self.name}] Stopped")


class MainThread(threading.Thread):
    """
    Main Thread - Processes signals and main thread methods
    Responsibility: Execute UI operations safely in main thread context
    """

    def __init__(self, framework_instance, name="MainThread"):
        super().__init__(name=name, daemon=True)
        self.framework = framework_instance
        self.running = False

    def run(self):
        """Thread entry point - process signals and method calls"""
        ColorPrint.green(f"[{self.name}] Started")
        self.running = True

        while self.running:
            try:
                # Process signals from signal queue
                self.framework.signal_manager.process_signals()

                # Execute pending main thread methods
                self.framework.main_executor.execute_pending()

                # Small sleep to prevent CPU spinning
                time.sleep(0.01)

            except Exception as e:
                ColorPrint.red(f"[{self.name}] Error: {e}")

        ColorPrint.yellow(f"[{self.name}] Stopped")

    def stop(self):
        """Stop the main thread"""
        self.running = False


class TaskThread(threading.Thread):
    """
    Task Thread - Runs timer-based background tasks
    Responsibility: Execute scheduled tasks at regular intervals (default 1 second tick)
    """

    def __init__(self, framework_instance, name="TaskThread"):
        super().__init__(name=name, daemon=True)
        self.framework = framework_instance
        self.running = False

    def run(self):
        """Thread entry point - run task timer"""
        ColorPrint.green(f"[{self.name}] Started")
        self.running = True

        # Run timer (blocking until stopped)
        self.framework.task_timer.run()

        ColorPrint.yellow(f"[{self.name}] Stopped")

    def stop(self):
        """Stop the task thread"""
        self.running = False
        self.framework.task_timer.stop()


class ThreadManager:
    """
    Thread Manager - Manages lifecycle of all three threads
    Clear separation: UI Thread, Main Thread, Task Thread
    """

    def __init__(self, framework_instance):
        self.framework = framework_instance

        # Three core threads
        self.ui_thread: Optional[UIThread] = None
        self.main_thread: Optional[MainThread] = None
        self.task_thread: Optional[TaskThread] = None

        ColorPrint.green("[ThreadManager] Initialized")

    def start_all(self):
        """
        Start all threads in correct order
        Order: UI Thread -> Main Thread -> Task Thread
        """
        ColorPrint.blue("=" * 60)
        ColorPrint.blue(" Starting Thread Architecture")
        ColorPrint.blue("=" * 60)

        # 1. Start UI Thread (must be first to create Tkinter root)
        self.ui_thread = UIThread(self.framework)
        self.ui_thread.start()

        # Wait for UI to be ready
        while not self.framework.ui_ready:
            time.sleep(0.1)

        ColorPrint.green("[ThreadManager] UI Thread ready")

        # 2. Start Main Thread (signal processing)
        self.main_thread = MainThread(self.framework)
        self.main_thread.start()
        ColorPrint.green("[ThreadManager] Main Thread started")

        # 3. Start Task Thread (timer-based tasks)
        self.task_thread = TaskThread(self.framework)
        self.task_thread.start()
        ColorPrint.green("[ThreadManager] Task Thread started")

        ColorPrint.blue("=" * 60)
        ColorPrint.green(" All Threads Running")
        ColorPrint.blue("=" * 60)

    def stop_all(self, timeout=5):
        """
        Stop all threads gracefully
        Order: Task Thread -> Main Thread -> UI Thread
        """
        ColorPrint.blue("=" * 60)
        ColorPrint.blue(" Stopping Thread Architecture")
        ColorPrint.blue("=" * 60)

        # 1. Stop Task Thread
        if self.task_thread and self.task_thread.is_alive():
            ColorPrint.yellow("[ThreadManager] Stopping Task Thread...")
            self.task_thread.stop()
            self.task_thread.join(timeout=timeout)

        # 2. Stop Main Thread
        if self.main_thread and self.main_thread.is_alive():
            ColorPrint.yellow("[ThreadManager] Stopping Main Thread...")
            self.main_thread.stop()
            self.main_thread.join(timeout=timeout)

        # 3. Stop UI Thread (Tkinter cleanup)
        if self.ui_thread and self.ui_thread.is_alive():
            ColorPrint.yellow("[ThreadManager] Stopping UI Thread...")
            # UI thread stops when Tkinter mainloop exits

        ColorPrint.blue("=" * 60)
        ColorPrint.green(" All Threads Stopped")
        ColorPrint.blue("=" * 60)

    def get_thread_status(self):
        """
        Get status of all threads

        Returns:
            dict: Status of each thread
        """
        return {
            'ui_thread': self.ui_thread.is_alive() if self.ui_thread else False,
            'main_thread': self.main_thread.is_alive() if self.main_thread else False,
            'task_thread': self.task_thread.is_alive() if self.task_thread else False
        }
