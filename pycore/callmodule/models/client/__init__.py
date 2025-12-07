# -*- coding: utf-8 -*-
"""Client Models Package"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class ForwardRequest(BaseModel):
    endpoint: str
    method: str = "POST"
    data: Optional[Dict[str, Any]] = None

class ForwardResponse(BaseModel):
    success: bool
    status_code: int
    response_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class ConnectionStatus(BaseModel):
    connected: bool
    server_url: Optional[str] = None
    latency: Optional[float] = None
