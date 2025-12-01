# -*- coding: utf-8 -*-
"""
Health Controller - Health check and status endpoints
"""

from ..global_config import get_global_config
from ..models.response_models import HealthResponse, StatusResponse
from ..services import ModuleCallService


class HealthController:
    """Controller for health and status endpoints"""

    def __init__(self):
        self.config = get_global_config()
        self.service = ModuleCallService()

    def get_health(self) -> HealthResponse:
        """Get health status"""
        return HealthResponse(
            success=True,
            service="Pycore Module Caller",
            status="healthy",
            pycore_root=str(self.config.pycore_root),
            api_enabled=self.config.api_enabled
        )

    def get_status(self) -> StatusResponse:
        """Get detailed service status"""
        return StatusResponse(
            success=True,
            status=self.service.get_status()
        )
