#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
File Monitor - File Change Monitoring System

Monitors files for changes and executes callbacks when changes are detected.

Features:
- Monitor file modifications, creations, and deletions
- Callback-based notification system
- Position tracking for log files (read only new content)
- Thread-safe operations
- Automatic error handling
- Configurable check intervals

Usage:
    from pycore.pyutils.native_ui import FileMonitor

    # Create monitor
    monitor = FileMonitor()

    # Set file to monitor
    monitor.set_file("/path/to/file.log")

    # Register callback
    def on_new_content(content):
        print(f"New content: {content}")

    monitor.set_callback(on_new_content)

    # Start monitoring
    monitor.start()

    # Check for changes manually
    if monitor.check_changes():
        print("File changed!")

    # Stop monitoring
    monitor.stop()

Author: Extracted from d3-check, adapted for pycore
"""

import os
import threading
import time
from pathlib import Path
from typing import Optional, Callable, List

from pycore import ColorPrint


class FileMonitor:
    """
    File Monitor - Monitors files for changes

    Supports:
    - File modification detection
    - Position tracking for incremental reading (log files)
    - Callback notifications
    - Thread-safe operations
    - Automatic restart on file recreation
    """

    def __init__(
        self,
        file_path: Optional[str] = None,
        check_interval: float = 1.0,
        callback: Optional[Callable[[str], None]] = None
    ):
        """
        Initialize file monitor

        Args:
            file_path: Path to file to monitor (can be set later)
            check_interval: Check interval in seconds
            callback: Callback function(content: str) for new content
        """
        self._file_path: Optional[Path] = Path(file_path) if file_path else None
        self._check_interval = check_interval
        self._callback = callback

        # File state
        self._last_position = 0
        self._last_modified = 0.0
        self._initialized = False

        # Thread control
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._lock = threading.Lock()

        ColorPrint.print_info("[FileMonitor] Initialized")

    def set_file(self, file_path: str) -> bool:
        """
        Set file to monitor

        Args:
            file_path: Path to file to monitor

        Returns:
            True if file exists and monitoring started, False otherwise
        """
        with self._lock:
            self._file_path = Path(file_path)

            if not self._file_path.exists():
                ColorPrint.print_warn(
                    f"[FileMonitor] File not found: {file_path}"
                )
                self._initialized = False
                return False

            # Initialize file state
            self._last_position = self._file_path.stat().st_size
            self._last_modified = self._file_path.stat().st_mtime
            self._initialized = True

            ColorPrint.print_success(
                f"[FileMonitor] Monitoring file: {file_path}"
            )
            return True

    def set_callback(self, callback: Callable[[str], None]):
        """Set callback function for new content notifications"""
        self._callback = callback
        ColorPrint.print_info("[FileMonitor] Callback registered")

    def check_changes(self) -> bool:
        """
        Check for file changes and process new content

        Returns:
            True if changes detected and processed, False otherwise
        """
        if not self._initialized or not self._file_path:
            return False

        try:
            # Check if file still exists
            if not self._file_path.exists():
                ColorPrint.print_warn(
                    f"[FileMonitor] File disappeared: {self._file_path}"
                )
                self._initialized = False
                return False

            # Check if file was modified
            current_modified = self._file_path.stat().st_mtime
            if current_modified <= self._last_modified:
                return False

            # Read new content
            with open(self._file_path, 'r', encoding='utf-8', errors='ignore') as f:
                f.seek(self._last_position)
                new_content = f.read()

                if new_content:
                    # Update position
                    self._last_position = f.tell()
                    self._last_modified = current_modified

                    # Notify callback
                    if self._callback:
                        try:
                            self._callback(new_content)
                        except Exception as e:
                            ColorPrint.print_error(
                                f"[FileMonitor] Error in callback: {e}"
                            )

                    return True

        except Exception as e:
            ColorPrint.print_error(
                f"[FileMonitor] Error checking file: {e}"
            )
            self._initialized = False

        return False

    def _monitor_loop(self):
        """Main monitoring loop (runs in separate thread)"""
        ColorPrint.print_info("[FileMonitor] Monitor loop started")

        while not self._stop_event.is_set():
            try:
                self.check_changes()
                time.sleep(self._check_interval)

            except Exception as e:
                ColorPrint.print_error(
                    f"[FileMonitor] Error in monitor loop: {e}"
                )
                time.sleep(self._check_interval)

        ColorPrint.print_info("[FileMonitor] Monitor loop stopped")

    def start(self) -> bool:
        """
        Start monitoring in background thread

        Returns:
            True if started successfully, False if already running
        """
        if self._running:
            ColorPrint.print_warn("[FileMonitor] Already running")
            return False

        if not self._initialized:
            ColorPrint.print_warn(
                "[FileMonitor] Not initialized - call set_file() first"
            )
            return False

        self._running = True
        self._stop_event.clear()

        self._thread = threading.Thread(
            target=self._monitor_loop,
            daemon=True,
            name="FileMonitorThread"
        )
        self._thread.start()

        ColorPrint.print_success("[FileMonitor] Started")
        return True

    def stop(self, timeout: float = 5.0) -> bool:
        """
        Stop monitoring

        Args:
            timeout: Maximum time to wait for thread to finish

        Returns:
            True if stopped successfully, False if not running
        """
        if not self._running:
            ColorPrint.print_warn("[FileMonitor] Not running")
            return False

        ColorPrint.print_info("[FileMonitor] Stopping...")
        self._stop_event.set()

        # Wait for thread to finish
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=timeout)

        self._running = False
        ColorPrint.print_success("[FileMonitor] Stopped")
        return True

    def is_running(self) -> bool:
        """Check if monitoring is active"""
        return self._running

    def is_initialized(self) -> bool:
        """Check if file is initialized"""
        return self._initialized

    def get_file_path(self) -> Optional[str]:
        """Get current monitored file path"""
        return str(self._file_path) if self._file_path else None

    def reset_position(self):
        """Reset file position to start of file"""
        with self._lock:
            if self._initialized and self._file_path:
                self._last_position = 0
                ColorPrint.print_info("[FileMonitor] Position reset to start")


class LogFileMonitor(FileMonitor):
    """
    Specialized File Monitor for log files

    Extends FileMonitor with line-by-line processing and filtering.
    """

    def __init__(
        self,
        file_path: Optional[str] = None,
        check_interval: float = 1.0,
        line_callback: Optional[Callable[[str], None]] = None,
        line_filter: Optional[Callable[[str], bool]] = None
    ):
        """
        Initialize log file monitor

        Args:
            file_path: Path to log file
            check_interval: Check interval in seconds
            line_callback: Callback function(line: str) for each new line
            line_filter: Optional filter function(line: str) -> bool
        """
        self._line_callback = line_callback
        self._line_filter = line_filter

        # Wrapper callback for line processing
        def content_callback(content: str):
            lines = content.strip().split('\n')
            for line in lines:
                if line.strip():
                    # Apply filter
                    if self._line_filter and not self._line_filter(line):
                        continue

                    # Notify line callback
                    if self._line_callback:
                        try:
                            self._line_callback(line)
                        except Exception as e:
                            ColorPrint.print_error(
                                f"[LogFileMonitor] Error in line callback: {e}"
                            )

        super().__init__(file_path, check_interval, content_callback)

    def set_line_callback(self, callback: Callable[[str], None]):
        """Set callback for line notifications"""
        self._line_callback = callback

    def set_line_filter(self, filter_func: Callable[[str], bool]):
        """Set filter function for lines"""
        self._line_filter = filter_func


# Export
__all__ = [
    'FileMonitor',
    'LogFileMonitor'
]
