"""System namespace handler"""

from typing import Dict, Any
from fastapi import WebSocket
import platform
import psutil
from datetime import datetime

from .base_handler import BaseHandler


class SystemHandler(BaseHandler):
    """Handle system namespace requests"""

    def _register_actions(self):
        """Register system actions"""
        self.actions['health'] = self.handle_health
        self.actions['health_detailed'] = self.handle_health_detailed
        self.actions['info'] = self.handle_info

    async def handle_health(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Basic health check"""
        return {
            "status": "healthy",
            "service": "pyMatrix",
            "version": "1.1.0",
            "timestamp": datetime.now().isoformat()
        }

    async def handle_health_detailed(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Detailed health check"""
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        return {
            "status": "healthy",
            "service": {
                "name": "pyMatrix",
                "version": "1.1.0",
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
            }
        }

    async def handle_info(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """API information"""
        return {
            "message": "pyMatrix API Server",
            "version": "1.1.0",
            "description": "Android Device Mirroring and Group Control System",
            "protocol": "Unified WebSocket",
            "endpoints": {
                "websocket": "/ws",
                "documentation": "/docs"
            },
            "namespaces": [
                "system", "device", "screen", "file",
                "recording", "group", "config", "control", "video"
            ]
        }
