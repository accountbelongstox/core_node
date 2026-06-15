# -*- coding: utf-8 -*-
"""
Logs Models

Models for log queries, entries, and responses.
"""

from typing import Any, Dict, List, Optional, Literal
from pydantic import BaseModel, Field


# ========== Log Types ==========

LogLevelType = Literal['DEBUG', 'INFO', 'WARNING', 'ERROR']
LogCategoryType = Literal['system', 'local_processing', 'upload', 'remote']


# ========== Log Entry ==========

class LogEntry(BaseModel):
    """Log entry model"""
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    level: LogLevelType
    category: str
    message: str
    details: Optional[Dict[str, Any]] = None
    source: Optional[str] = Field(None, description="Source of the log")

    class Config:
        json_schema_extra = {
            "example": {
                "timestamp": "2025-12-07T10:30:00Z",
                "level": "INFO",
                "category": "system",
                "message": "Service started successfully",
                "details": {
                    "service_name": "rpc_v2",
                    "port": 59000
                },
                "source": "pycore.callmodule.app"
            }
        }


# ========== Log Query ==========

class LogsQuery(BaseModel):
    """Logs query parameters"""
    lines: Optional[int] = Field(default=100, ge=1, le=10000, description="Number of lines to retrieve")
    level: Optional[LogLevelType] = Field(None, description="Filter by log level")
    category: Optional[LogCategoryType] = Field(None, description="Filter by category")
    start_time: Optional[str] = Field(None, description="Start time (ISO 8601)")
    end_time: Optional[str] = Field(None, description="End time (ISO 8601)")
    search: Optional[str] = Field(None, description="Search keyword in message")

    class Config:
        json_schema_extra = {
            "example": {
                "lines": 100,
                "level": "ERROR",
                "category": "system",
                "start_time": "2025-12-07T00:00:00Z",
                "end_time": "2025-12-07T23:59:59Z",
                "search": "failed"
            }
        }


# ========== Log Response ==========

class LogsResponse(BaseModel):
    """Logs response model"""
    total: int = Field(..., description="Total number of log entries matching the query")
    has_more: bool = Field(..., description="Whether there are more logs available")
    logs: List[LogEntry] = Field(default_factory=list)

    class Config:
        json_schema_extra = {
            "example": {
                "total": 250,
                "has_more": True,
                "logs": [
                    {
                        "timestamp": "2025-12-07T10:30:00Z",
                        "level": "INFO",
                        "category": "system",
                        "message": "Service started successfully",
                        "details": {
                            "service_name": "rpc_v2",
                            "port": 59000
                        },
                        "source": "pycore.callmodule.app"
                    },
                    {
                        "timestamp": "2025-12-07T10:35:00Z",
                        "level": "ERROR",
                        "category": "local_processing",
                        "message": "OCR processing failed",
                        "details": {
                            "error": "Model not found",
                            "task_id": "task_123"
                        },
                        "source": "pycore.pyutils.ocr_manager"
                    }
                ]
            }
        }
