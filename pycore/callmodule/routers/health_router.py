# -*- coding: utf-8 -*-
"""
Health Router - Health check and status routes
"""

from pycore.pyfoundations.third_party import fastapi

from ..controllers import HealthController
from ..models.response_models import HealthResponse, StatusResponse

APIRouter = fastapi.APIRouter
health_router = APIRouter(prefix="", tags=["Health"])

# Initialize controller
health_controller = HealthController()


@health_router.get("/health", response_model=HealthResponse)
async def get_health():
    """
    Health check endpoint.

    Returns:
        HealthResponse: Service health status
    """
    return health_controller.get_health()


@health_router.get("/api/status", response_model=StatusResponse)
async def get_status():
    """
    Get detailed service status.

    Returns:
        StatusResponse: Detailed service configuration and state
    """
    return health_controller.get_status()
