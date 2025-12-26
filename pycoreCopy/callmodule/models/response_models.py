# -*- coding: utf-8 -*-
"""
Response Models
"""

from typing import Any, Optional
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Health check response"""
    success: bool = True
    service: str = "Pycore Module Caller"
    status: str = "healthy"
    pycore_root: str
    api_enabled: bool


class StatusResponse(BaseModel):
    """Service status response"""
    success: bool = True
    status: dict


class HistoryResponse(BaseModel):
    """Call history response"""
    success: bool = True
    history: list
