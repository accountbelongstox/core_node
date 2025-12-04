"""Device namespace handler"""

from typing import Dict, Any
from fastapi import WebSocket

from .base_handler import BaseHandler
from pyapps.matrix.services import DeviceService


class DeviceHandler(BaseHandler):
    """Handle device namespace requests"""

    def __init__(self):
        self.device_service = DeviceService.instance()
        super().__init__()

    def _register_actions(self):
        """Register device actions"""
        self.actions['list'] = self.handle_list
        self.actions['get'] = self.handle_get
        self.actions['connect'] = self.handle_connect
        self.actions['disconnect'] = self.handle_disconnect
        self.actions['batch_configure'] = self.handle_batch_configure

    async def handle_list(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """List all devices"""
        devices = await self.device_service.list_devices()

        devices_list = []
        for device in devices:
            device_dict = {
                "serial": device.serial,
                "status": device.state.value,
                "model": device.model if hasattr(device, 'model') else "Unknown",
                "manufacturer": device.product if hasattr(device, 'product') else None,
                "android_version": None
            }
            devices_list.append(device_dict)

        return {
            "devices": devices_list,
            "count": len(devices_list)
        }

    async def handle_get(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Get device info"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        device_info = await self.device_service.get_device_info(serial)

        if not device_info:
            return {'error': {'code': 'DEVICE_NOT_FOUND', 'message': f'Device {serial} not found'}}

        return {
            "device": {
                "serial": device_info.serial,
                "model": device_info.model,
                "manufacturer": device_info.manufacturer if hasattr(device_info, 'manufacturer') else None,
                "android_version": device_info.android_version,
                "sdk_version": device_info.sdk_version,
                "resolution": {
                    "width": device_info.resolution.width,
                    "height": device_info.resolution.height
                },
                "dpi": device_info.dpi
            }
        }

    async def handle_connect(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Connect device"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        params = {
            "max_size": data.get('max_size', 720),
            "bit_rate": data.get('bit_rate', 8000000),
            "max_fps": data.get('max_fps', 60),
            "codec": data.get('codec'),
            "control": data.get('control'),
            "locked_video_orientation": data.get('locked_video_orientation'),
            "device_name": data.get('device_name'),
        }

        success = await self.device_service.connect_device(serial, params)

        if not success:
            return {'error': {'code': 'CONNECT_FAILED', 'message': f'Failed to connect device {serial}'}}

        return {
            "success": True,
            "message": f"Device {serial} connected successfully"
        }

    async def handle_disconnect(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Disconnect device"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        success = await self.device_service.disconnect_device(serial)

        if not success:
            return {'error': {'code': 'DISCONNECT_FAILED', 'message': f'Failed to disconnect device {serial}'}}

        return {
            "success": True,
            "message": f"Device {serial} disconnected successfully"
        }

    async def handle_batch_configure(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Batch configure devices"""
        # Implement batch configuration
        # This is a simplified version - full implementation would match device_routes.py
        return {
            "success": True,
            "message": "Batch configuration not fully implemented yet"
        }
