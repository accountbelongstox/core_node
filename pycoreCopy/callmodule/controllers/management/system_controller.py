# -*- coding: utf-8 -*-
"""
System Controller - Request handling for system management
"""

from ...services.management.system_service import SystemService
from ...models.management.system_models import (
    SystemStatus,
    SystemConfig,
    ControlResponse,
    DashboardOverview,
    RealtimeMetrics,
)


class SystemController:
    """Controller for system management endpoints"""

    def __init__(self):
        self.service = SystemService()

    def get_status(self) -> SystemStatus:
        """
        Get system status.

        Returns:
            SystemStatus response
        """
        return self.service.get_system_status()

    def get_config(self) -> SystemConfig:
        """
        Get system configuration.

        Returns:
            SystemConfig response
        """
        return self.service.get_system_config()

    def update_config(self, config: SystemConfig) -> dict:
        """
        Update system configuration.

        Args:
            config: New system configuration

        Returns:
            Dictionary with success status and message
        """
        return self.service.update_system_config(config)

    def control(self, action: str) -> ControlResponse:
        """
        Execute control action.

        Args:
            action: Control action to execute

        Returns:
            ControlResponse with result
        """
        return self.service.execute_control_action(action)

    def get_dashboard_overview(self) -> DashboardOverview:
        """
        Get dashboard overview data.

        Returns:
            DashboardOverview response
        """
        return self.service.get_dashboard_overview()

    def get_realtime_metrics(self) -> RealtimeMetrics:
        """
        Get real-time metrics.

        Returns:
            RealtimeMetrics response
        """
        return self.service.get_realtime_metrics()
