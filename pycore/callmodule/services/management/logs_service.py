# -*- coding: utf-8 -*-
"""
Logs Service - Business logic for log management
"""

import os
import logging
from typing import List, Optional
from datetime import datetime

from ...models.management.logs_models import (
    LogEntry,
    LogsQuery,
    LogsResponse,
)


class LogsService:
    """Service for log management operations"""

    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self._log_buffer: List[LogEntry] = []
        self._max_buffer_size = 10000

    def get_logs(self, query: LogsQuery) -> LogsResponse:
        """
        Get logs based on query parameters.

        Args:
            query: LogsQuery with filter parameters

        Returns:
            LogsResponse with filtered logs
        """
        # TODO: Implement actual log reading from file or database
        # For now, return from in-memory buffer with filtering

        filtered_logs = self._filter_logs(query)

        # Apply pagination
        lines = query.lines or 100
        total = len(filtered_logs)
        has_more = total > lines

        # Return only requested number of lines
        result_logs = filtered_logs[:lines]

        return LogsResponse(
            total=total,
            has_more=has_more,
            logs=result_logs
        )

    def _filter_logs(self, query: LogsQuery) -> List[LogEntry]:
        """
        Filter logs based on query parameters.

        Args:
            query: LogsQuery with filter parameters

        Returns:
            List of filtered LogEntry objects
        """
        logs = self._log_buffer.copy()

        # Filter by level
        if query.level:
            logs = [log for log in logs if log.level == query.level]

        # Filter by category
        if query.category:
            logs = [log for log in logs if log.category == query.category]

        # Filter by time range
        if query.start_time:
            logs = [log for log in logs if log.timestamp >= query.start_time]

        if query.end_time:
            logs = [log for log in logs if log.timestamp <= query.end_time]

        # Filter by search keyword
        if query.search:
            search_lower = query.search.lower()
            logs = [log for log in logs if search_lower in log.message.lower()]

        return logs

    def add_log(self, level: str, category: str, message: str,
                details: Optional[dict] = None, source: Optional[str] = None):
        """
        Add a log entry to the buffer.

        Args:
            level: Log level (DEBUG, INFO, WARNING, ERROR)
            category: Log category
            message: Log message
            details: Optional details dictionary
            source: Optional source identifier
        """
        log_entry = LogEntry(
            timestamp=datetime.utcnow().isoformat() + 'Z',
            level=level,
            category=category,
            message=message,
            details=details,
            source=source
        )

        self._log_buffer.append(log_entry)

        # Maintain buffer size
        if len(self._log_buffer) > self._max_buffer_size:
            self._log_buffer = self._log_buffer[-self._max_buffer_size:]

    def clear_logs(self, category: Optional[str] = None):
        """
        Clear logs from buffer.

        Args:
            category: Optional category to clear. If None, clears all logs.
        """
        if category:
            self._log_buffer = [log for log in self._log_buffer if log.category != category]
        else:
            self._log_buffer.clear()

    def get_log_stats(self) -> dict:
        """
        Get statistics about logs.

        Returns:
            Dictionary with log statistics
        """
        total = len(self._log_buffer)

        # Count by level
        by_level = {}
        for log in self._log_buffer:
            by_level[log.level] = by_level.get(log.level, 0) + 1

        # Count by category
        by_category = {}
        for log in self._log_buffer:
            by_category[log.category] = by_category.get(log.category, 0) + 1

        return {
            "total": total,
            "by_level": by_level,
            "by_category": by_category,
            "buffer_size": self._max_buffer_size
        }

    def export_logs(self, filepath: str, query: Optional[LogsQuery] = None) -> bool:
        """
        Export logs to a file.

        Args:
            filepath: Path to export file
            query: Optional query to filter logs

        Returns:
            True if successful, False otherwise
        """
        try:
            if query:
                logs = self._filter_logs(query)
            else:
                logs = self._log_buffer

            with open(filepath, 'w', encoding='utf-8') as f:
                for log in logs:
                    f.write(f"[{log.timestamp}] [{log.level}] [{log.category}] {log.message}\n")
                    if log.details:
                        f.write(f"  Details: {log.details}\n")
                    if log.source:
                        f.write(f"  Source: {log.source}\n")
                    f.write("\n")

            return True
        except Exception as e:
            self.logger.error(f"Failed to export logs: {e}")
            return False
