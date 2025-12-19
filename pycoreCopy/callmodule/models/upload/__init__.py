# -*- coding: utf-8 -*-
"""Upload Models Package"""
from pydantic import BaseModel, Field
from typing import Optional, List

class UploadTask(BaseModel):
    upload_id: str
    result_type: str
    status: str
    progress: float
    error: Optional[str] = None

class UploadTasksResponse(BaseModel):
    success: bool
    total: int
    tasks: List[UploadTask]

class ServerConfig(BaseModel):
    server_id: str
    name: str
    url: str
    enabled: bool = True

class ServerConfigResponse(BaseModel):
    success: bool
    servers: List[ServerConfig]
