# -*- coding: utf-8 -*-
"""
Local Processing Controller - Request handling for local processing management
"""

from typing import Optional

from ...services.management.local_processing_service import LocalProcessingService
from ...models.management.local_processing_models import (
    LocalCapabilities,
    LocalProcessingConfig,
    LocalProcessingStats,
    TestRequest,
    TestResponse,
)


class LocalProcessingController:
    """Controller for local processing management endpoints"""

    def __init__(self):
        self.service = LocalProcessingService()

    def get_capabilities(self) -> LocalCapabilities:
        """
        Get local processing capabilities.

        Returns:
            LocalCapabilities response
        """
        return self.service.get_capabilities()

    def get_config(self) -> LocalProcessingConfig:
        """
        Get local processing configuration.

        Returns:
            LocalProcessingConfig response
        """
        return self.service.get_config()

    def update_config(self, config: LocalProcessingConfig) -> dict:
        """
        Update local processing configuration.

        Args:
            config: New local processing configuration

        Returns:
            Dictionary with success status and message
        """
        return self.service.update_config(config)

    def get_stats(self, period: str = "today",
                  start_date: Optional[str] = None,
                  end_date: Optional[str] = None) -> LocalProcessingStats:
        """
        Get local processing statistics.

        Args:
            period: Time period (today, week, month, all, custom)
            start_date: Start date for custom period
            end_date: End date for custom period

        Returns:
            LocalProcessingStats response
        """
        return self.service.get_stats(period, start_date, end_date)

    def test(self, request: TestRequest) -> TestResponse:
        """
        Test local processing capability.

        Args:
            request: Test request with test type and data

        Returns:
            TestResponse with test results
        """
        return self.service.test_processing(request)
