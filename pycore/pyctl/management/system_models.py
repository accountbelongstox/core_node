# -*- coding: utf-8 -*-
"""
System Management Models

Models for system status, configuration, and control operations.
"""

from typing import Any, Dict, Optional, Literal
from pycore.pyfoundations.third_party.api import get_third_package_pydantic


pydantic = get_third_package_pydantic()
BaseModel = pydantic.BaseModel
Field = pydantic.Field


# ========== Basic Component Models ==========

class DiskUsage(BaseModel):
    """Disk usage information"""
    total: float = Field(..., description="Total disk space in GB")
    used: float = Field(..., description="Used disk space in GB")
    free: float = Field(..., description="Free disk space in GB")


class ResourceUsage(BaseModel):
    """Resource usage information"""
    cpu_usage: float = Field(..., description="CPU usage percentage")
    memory_usage: float = Field(..., description="Memory usage in MB")
    disk_usage: DiskUsage


class HardwareInfo(BaseModel):
    """Hardware information"""
    cpu_model: str = Field(..., description="CPU model name")
    cpu_cores: int = Field(..., description="Number of CPU cores")
    total_memory: float = Field(..., description="Total memory in MB")
    gpu_available: bool = Field(default=False, description="GPU availability")
    gpu_model: Optional[str] = Field(None, description="GPU model name")


ServiceStatusType = Literal['running', 'stopped', 'error', 'starting']


class ServiceInfo(BaseModel):
    """Service information"""
    name: str = Field(..., description="Service name")
    status: ServiceStatusType
    uptime: Optional[float] = Field(None, description="Service uptime in seconds")
    error: Optional[str] = Field(None, description="Error message if status is error")


# ========== System Status ==========

class SystemStatus(BaseModel):
    """System status response model"""
    system: Dict[str, Any] = Field(..., description="System information")
    services: Dict[str, ServiceStatusType] = Field(..., description="Service status map")
    local_processing: Dict[str, Any] = Field(..., description="Local processing information")

    class Config:
        json_schema_extra = {
            "example": {
                "system": {
                    "status": "running",
                    "uptime": 3600,
                    "version": "1.0.0",
                    "pid": 12345,
                    "cpu_usage": 25.5,
                    "memory_usage": 512.0,
                    "disk_usage": {
                        "total": 500.0,
                        "used": 250.0,
                        "free": 250.0
                    }
                },
                "services": {
                    "rpc_v2": "running",
                    "heartbeat": "running",
                    "ui": "running",
                    "tray": "running",
                    "local_processor": "running"
                },
                "local_processing": {
                    "enabled": True,
                    "capabilities": {
                        "screenshot": True,
                        "ocr": True,
                        "audio_transcribe": True,
                        "video_process": False
                    },
                    "statistics": {
                        "total_processed": 1000,
                        "today_processed": 50,
                        "failed": 5,
                        "average_time": 2.5
                    }
                }
            }
        }


# ========== System Configuration ==========

LogLevelType = Literal['DEBUG', 'INFO', 'WARNING', 'ERROR']


class SystemConfig(BaseModel):
    """System configuration model"""
    system: Dict[str, Any] = Field(..., description="System-level configuration")
    local_processing: Optional[Dict[str, Any]] = Field(None, description="Local processing configuration")

    class Config:
        json_schema_extra = {
            "example": {
                "system": {
                    "debug": False,
                    "log_level": "INFO",
                    "max_connections": 100
                },
                "local_processing": {
                    "enabled": True,
                    "auto_upload": True
                }
            }
        }


class ConfigResponse(BaseModel):
    """Configuration update response"""
    success: bool
    message: str
    config: Optional[SystemConfig] = None
    errors: Optional[list] = None


# ========== Control Operations ==========

ControlActionType = Literal['restart', 'stop', 'reload-config', 'clear-cache']


class ControlResponse(BaseModel):
    """Control operation response"""
    success: bool
    message: str
    action: ControlActionType
    timestamp: str = Field(..., description="ISO 8601 timestamp")

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Service restarted successfully",
                "action": "restart",
                "timestamp": "2025-12-07T10:30:00Z"
            }
        }


# ========== Dashboard Models ==========

class DashboardOverview(BaseModel):
    """Dashboard overview data"""
    system: Dict[str, Any] = Field(..., description="System information")
    resources: ResourceUsage
    today_stats: Dict[str, Any] = Field(..., description="Today's statistics")

    class Config:
        json_schema_extra = {
            "example": {
                "system": {
                    "status": "running",
                    "uptime": 3600,
                    "version": "1.0.0",
                    "pid": 12345
                },
                "resources": {
                    "cpu_usage": 25.5,
                    "memory_usage": 512.0,
                    "disk_usage": {
                        "total": 500.0,
                        "used": 250.0,
                        "free": 250.0
                    }
                },
                "today_stats": {
                    "processed_tasks": 50,
                    "uploaded_files": 45,
                    "failed_tasks": 5,
                    "success_rate": 90.0
                }
            }
        }


class RealtimeMetrics(BaseModel):
    """Real-time metrics data"""
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    cpu_usage: float
    memory_usage: float
    network_upload: float = Field(..., description="Network upload speed in KB/s")
    network_download: float = Field(..., description="Network download speed in KB/s")
    tasks_per_minute: int

    class Config:
        json_schema_extra = {
            "example": {
                "timestamp": "2025-12-07T10:30:00Z",
                "cpu_usage": 25.5,
                "memory_usage": 512.0,
                "network_upload": 100.5,
                "network_download": 50.3,
                "tasks_per_minute": 10
            }
        }
