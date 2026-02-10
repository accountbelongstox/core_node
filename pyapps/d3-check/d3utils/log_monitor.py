#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Log Monitor
File-change driven: when watchdog is available, the log file is watched and any modification
triggers an immediate read of new content (no tick delay). New lines are processed via
ColorPrint + log_analyzer. Initial baseline = when set_log_file is first called.
Runs in observer thread: must not block (no get_config_value in ColorPrint callbacks).
Fallback: if watchdog is not installed, use tick-driven check_logs via timer (system_initializer).
Debug: when log_settings.debug_log_latency is True, parse timestamp from log line and print
latency (now - log_time) to verify real-time monitoring.
"""
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from pycore.pyfoundations.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_watchdog
from providor.providor_index import get_config_value_safe
from d3utils.log_analyzer import analyze_log_line
import d3utils.log_monitor_api as _log_monitor_api

# Log line timestamp pattern: "2026-02-07 14:52:46,114 INFO - ..." (some lines have no timestamp)
_LOG_TS_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2},\d{3})")


def _parse_log_timestamp(line: str) -> Optional[float]:
    """Extract timestamp from log line; return epoch seconds or None if not present/invalid."""
    line = line.strip()
    m = _LOG_TS_RE.match(line)
    if not m:
        return None
    s = m.group(1)
    try:
        # "2026-02-07 14:52:46,114" -> datetime; ,114 is milliseconds
        dt = datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S")
        ms = int(s[20:23]) if len(s) >= 23 else 0
        return dt.timestamp() + ms / 1000.0
    except (ValueError, IndexError):
        return None

_watchdog_mod = get_third_package_watchdog()
if _watchdog_mod is not None:
    _WATCHDOG_AVAILABLE = True
    _Observer = _watchdog_mod.observers.Observer
    _FileSystemEventHandler = _watchdog_mod.events.FileSystemEventHandler
else:
    _WATCHDOG_AVAILABLE = False
    _Observer = None
    _FileSystemEventHandler = object


class _LogFileEventHandler(_FileSystemEventHandler):
    """Calls monitor._read_and_process_new_lines() when the watched log file is modified (immediate, change-driven)."""

    def __init__(self, monitor: "LogMonitor") -> None:
        super().__init__()
        self._monitor = monitor

    def on_modified(self, event: Any) -> None:
        if getattr(event, "is_directory", False):
            return
        if not self._monitor.log_file_path:
            return
        try:
            src = os.path.normpath(os.path.abspath(event.src_path))
            log_path = os.path.normpath(os.path.abspath(self._monitor.log_file_path))
            if src != log_path:
                return
        except Exception:
            return
        self._monitor._read_and_process_new_lines()


class LogMonitor:
    """Monitors ROSBOT log file for changes (watchdog)."""

    def __init__(self):
        self.log_file_path: Optional[str] = None
        self.last_position = 0
        self.last_modified = 0.0
        self.initialized = False
        self._observer: Any = None
        self._watch_dir: Optional[str] = None

        if _WATCHDOG_AVAILABLE:
            ColorPrint.blue("[LogMonitor] 预加载成功 (file-change driven)")
        else:
            ColorPrint.yellow("[LogMonitor] watchdog 不可用，使用 tick 轮询")

    def set_log_file(self, file_path: str) -> None:
        """Set the log file to monitor. Initial read = now: record position, do not print content before this moment.
        If watchdog available, start watching the file's directory; otherwise only set baseline."""
        if self.log_file_path == file_path and self.initialized:
            return
        self.stop_watching()
        if os.path.exists(file_path):
            self.log_file_path = file_path
            self.last_position = os.path.getsize(file_path)
            self.last_modified = os.path.getmtime(file_path)
            self.initialized = True
            ColorPrint.blue(f"[LogMonitor] Monitoring log file: {file_path}")
            if _WATCHDOG_AVAILABLE:
                self._start_watching()
        else:
            ColorPrint.yellow(f"[LogMonitor] Log file not found: {file_path}")
            self.log_file_path = None
            self.initialized = False

    def _start_watching(self) -> None:
        """Start watchdog observer on the directory containing the log file."""
        if not _WATCHDOG_AVAILABLE or not self.log_file_path or self._observer is not None:
            return
        watch_dir = str(Path(self.log_file_path).resolve().parent)
        if not watch_dir or not os.path.isdir(watch_dir):
            return
        try:
            handler = _LogFileEventHandler(self)
            self._observer = _Observer()
            self._observer.schedule(handler, watch_dir, recursive=False)
            self._observer.start()
            self._watch_dir = watch_dir
            ColorPrint.blue(f"[LogMonitor] File watcher started on: {watch_dir}")
        except Exception as e:
            ColorPrint.red(f"[LogMonitor] Failed to start file watcher: {e}")
            self._observer = None

    def stop_watching(self) -> None:
        """Stop the watchdog observer (e.g. on shutdown or when changing log file)."""
        if self._observer is None:
            return
        try:
            self._observer.stop()
            self._observer.join(timeout=3.0)
        except Exception as e:
            ColorPrint.red(f"[LogMonitor] Error stopping file watcher: {e}")
        self._observer = None
        self._watch_dir = None

    def _read_and_process_new_lines(self) -> None:
        """Read new content from last_position, process each line (ColorPrint + analyze). Called by watchdog or tick."""
        if not self.initialized or not self.log_file_path:
            return
        try:
            if not os.path.exists(self.log_file_path):
                ColorPrint.yellow(f"[LogMonitor] Log file disappeared: {self.log_file_path}")
                self.initialized = False
                return
            debug_latency = bool(get_config_value_safe("log_settings.debug_log_latency", False))
            current_modified = os.path.getmtime(self.log_file_path)
            with open(self.log_file_path, "r", encoding="utf-8", errors="ignore") as f:
                f.seek(self.last_position)
                new_content = f.read()
                if new_content:
                    self.last_position = f.tell()
                    self.last_modified = current_modified
                    lines = new_content.strip().split("\n")
                    now = time.time()
                    for line in lines:
                        if not line.strip():
                            continue
                        prefix = "[ROSBOT]"
                        if debug_latency:
                            log_ts = _parse_log_timestamp(line)
                            if log_ts is not None:
                                delay = now - log_ts
                                prefix = f"[ROSBOT~{delay:.1f}s]"
                        ColorPrint.info(f"{prefix} {line}")
                        analyze_log_line(line)
        except Exception as e:
            ColorPrint.red(f"[LogMonitor] Error reading log file: {e}")
            self.initialized = False

    def check_logs(self) -> bool:
        """
        Check for new log content and process it (tick-driven fallback when watchdog not used).
        Returns True if file was modified and content was processed.
        """
        if not self.initialized or not self.log_file_path:
            return False
        try:
            if not os.path.exists(self.log_file_path):
                ColorPrint.yellow(f"[LogMonitor] Log file disappeared: {self.log_file_path}")
                self.initialized = False
                return False
            if os.path.getmtime(self.log_file_path) <= self.last_modified:
                return False
            self._read_and_process_new_lines()
            return True
        except Exception as e:
            ColorPrint.red(f"[LogMonitor] Error reading log file: {e}")
            self.initialized = False
        return False

    def set_rosbot_running(self, running: bool) -> None:
        """Reserved for future use."""
        pass


# Global instance
_log_monitor: Optional[LogMonitor] = None


def get_log_monitor() -> LogMonitor:
    """Get global log monitor instance."""
    global _log_monitor
    if _log_monitor is None:
        _log_monitor = LogMonitor()
    return _log_monitor


def check_logs() -> bool:
    """Check for new log content (used by timer when file watcher is not used)."""
    return get_log_monitor().check_logs()


def set_log_file(file_path: str) -> None:
    """Set the log file to monitor; starts file watcher if watchdog is available."""
    get_log_monitor().set_log_file(file_path)


def get_last_log_modified_time() -> float:
    """Return last time log file had new content (epoch seconds). 0.0 if not initialized (F3 timeout check)."""
    m = get_log_monitor()
    if not m.initialized or not m.log_file_path:
        return 0.0
    return m.last_modified


def stop_log_watching() -> None:
    """Stop the log file watcher (e.g. on shutdown)."""
    get_log_monitor().stop_watching()


def get_default_interceptor():
    """No throttling when using timer fallback."""
    return lambda: True


def set_rosbot_running(running: bool) -> None:
    """Set ROSBOT running status for interceptor control (timer fallback)."""
    get_log_monitor().set_rosbot_running(running)


def is_file_watcher_available() -> bool:
    """Return True if watchdog is installed and log is driven by file changes."""
    return _WATCHDOG_AVAILABLE


_log_monitor_api.register(get_log_monitor)
