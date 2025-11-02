"""Health check and system status routes"""

from fastapi import APIRouter, Request
from datetime import datetime
import psutil
import platform

router = APIRouter()


@router.get("/health")
async def health_check():
    """
    Basic health check endpoint

    Returns:
        Health status information
    """
    return {
        "status": "healthy",
        "service": "pyMatrix",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }


@router.get("/health/detailed")
async def detailed_health_check(request: Request):
    """
    Detailed health check with system information

    Returns:
        Comprehensive health status including:
        - Service status
        - System resources
        - Performance metrics
        - Runtime information
    """
    # Get performance middleware if available
    performance_metrics = {}
    for middleware in request.app.middleware:
        if hasattr(middleware, "get_metrics"):
            performance_metrics = middleware.get_metrics()
            break

    # Get system information
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')

    return {
        "status": "healthy",
        "service": {
            "name": "pyMatrix",
            "version": "1.0.0",
            "description": "Android Device Mirroring and Group Control System"
        },
        "timestamp": datetime.now().isoformat(),
        "uptime_seconds": int(psutil.boot_time()),
        "system": {
            "platform": platform.system(),
            "platform_version": platform.version(),
            "python_version": platform.python_version(),
            "architecture": platform.machine()
        },
        "resources": {
            "cpu": {
                "usage_percent": cpu_percent,
                "cores": psutil.cpu_count()
            },
            "memory": {
                "total_mb": round(memory.total / 1024 / 1024, 2),
                "available_mb": round(memory.available / 1024 / 1024, 2),
                "used_percent": memory.percent
            },
            "disk": {
                "total_gb": round(disk.total / 1024 / 1024 / 1024, 2),
                "free_gb": round(disk.free / 1024 / 1024 / 1024, 2),
                "used_percent": disk.percent
            }
        },
        "performance_metrics": performance_metrics if performance_metrics else {
            "message": "No metrics available yet"
        }
    }


@router.get("/")
async def root():
    """
    Root endpoint with API information

    Returns:
        Basic API information
    """
    return {
        "message": "pyMatrix API Server",
        "version": "1.0.0",
        "description": "Android Device Mirroring and Group Control System",
        "documentation": {
            "swagger": "/docs",
            "redoc": "/redoc"
        },
        "endpoints": {
            "health": "/api/health",
            "detailed_health": "/api/health/detailed",
            "devices": "/api/devices",
            "groups": "/api/groups",
            "files": "/api/files"
        }
    }
