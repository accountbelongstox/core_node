# -*- coding: utf-8 -*-
"""
Rotating sync logger for the Code Sync client.

Owns the in-memory recent-activity ring (for UI display) and the rotating
on-disk log files. Extracted from CodeSyncClient so the client lifecycle and
file-pull logic stay focused.

Stdlib only: logging via `.runtime.log`. No pycore import, no third_party.
"""

from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

from pycore.pyutils.codesync.runtime import log as ColorPrint


# TODO(sync-logs): consolidate this per-file client log ring with the manager's
# `_sync_logs` ring (manager.py, push/receive events served via
# `get_sync_logs(limit)` -> http_server `/code-sync/sync-logs`). Both keep a
# newest-last list trimmed to a cap; merging them into one shared ring would
# give the UI a single unified activity feed. Deferred - leaving behaviour
# identical for now.
class SyncLogger:
    """Rotating sync logger: in-memory recent-activity ring + rotating log files."""

    def __init__(self, logs_dir: Path, max_logs: int = 50, max_logs_per_file: int = 20000):
        """
        Initialize sync logger

        Args:
            logs_dir: Directory for on-disk log files (created if missing)
            max_logs: Keep last N logs in memory for UI display
            max_logs_per_file: Max lines per on-disk log file before rotating
        """
        self.logs_dir = logs_dir
        self.max_logs = max_logs  # Keep last N logs in memory for UI
        self.max_logs_per_file = max_logs_per_file  # Max lines per log file

        # Recent activity (shared across all servers) - newest last
        self.sync_logs: List[Dict] = []

        # Current log file tracking (rotation)
        self.current_log_file: Optional[Path] = None
        self.current_log_line_count = 0

        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self._init_log_file()

    def _init_log_file(self):
        """Initialize current log file"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        self.current_log_file = self.logs_dir / f'sync_logs_{timestamp}.log'
        self.current_log_line_count = 0
        ColorPrint.blue(f"[CodeSync Client] Log file: {self.current_log_file.name}")

    def _write_log_line(self, log_line: str):
        """Write a log line to file"""
        # Check if need to rotate
        if self.current_log_line_count >= self.max_logs_per_file:
            self._init_log_file()

        # Append to log file
        with open(self.current_log_file, 'a', encoding='utf-8') as f:
            f.write(log_line + '\n')

        self.current_log_line_count += 1

    def add_log(self, action: str, file_path: str, reason: str, details: str = ""):
        """
        Add a log entry

        Args:
            action: Action type ('received', 'skipped', 'backup', 'error')
            file_path: File path
            reason: Reason for the action
            details: Additional details
        """
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        # Create log entry for memory (UI display)
        log_entry = {
            'timestamp': timestamp,
            'action': action,
            'file': file_path,
            'reason': reason,
            'details': details
        }

        # Add to memory (keep last N for UI)
        self.sync_logs.append(log_entry)
        if len(self.sync_logs) > self.max_logs:
            self.sync_logs = self.sync_logs[-self.max_logs:]

        # Write to log file (simple text format)
        log_line = f"[{timestamp}] {action.upper()}: {file_path} - {reason}"
        if details:
            log_line += f" | {details}"
        self._write_log_line(log_line)

        # Print to console
        ColorPrint.blue(f"[{timestamp.split()[1]}] {action.upper()}: {file_path} - {reason}")
        if details:
            ColorPrint.blue(f"  Details: {details}")

    def recent_logs(self) -> List[Dict]:
        """Last N log entries for UI display (mirrors the old get_status slice)."""
        return self.sync_logs[-self.max_logs:]
