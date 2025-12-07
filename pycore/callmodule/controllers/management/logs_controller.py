# -*- coding: utf-8 -*-
"""
Logs Controller - Request handling for log management
"""

from ...services.management.logs_service import LogsService
from ...models.management.logs_models import (
    LogsQuery,
    LogsResponse,
)


class LogsController:
    """Controller for log management endpoints"""

    def __init__(self):
        self.service = LogsService()

    def get_logs(self, query: LogsQuery) -> LogsResponse:
        """
        Get logs based on query parameters.

        Args:
            query: LogsQuery with filter parameters

        Returns:
            LogsResponse with filtered logs
        """
        return self.service.get_logs(query)

    def clear_logs(self, category: str = None) -> dict:
        """
        Clear logs.

        Args:
            category: Optional category to clear

        Returns:
            Dictionary with success status
        """
        try:
            self.service.clear_logs(category)
            return {
                "success": True,
                "message": f"Logs cleared successfully" + (f" for category: {category}" if category else "")
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Failed to clear logs: {str(e)}"
            }

    def get_stats(self) -> dict:
        """
        Get log statistics.

        Returns:
            Dictionary with log statistics
        """
        return self.service.get_log_stats()

    def export_logs(self, filepath: str, query: LogsQuery = None) -> dict:
        """
        Export logs to file.

        Args:
            filepath: Path to export file
            query: Optional query to filter logs

        Returns:
            Dictionary with success status
        """
        success = self.service.export_logs(filepath, query)
        return {
            "success": success,
            "message": "Logs exported successfully" if success else "Failed to export logs",
            "filepath": filepath if success else None
        }
