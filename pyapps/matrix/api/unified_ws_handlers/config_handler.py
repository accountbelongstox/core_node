"""Config namespace handler"""

from typing import Dict, Any
from fastapi import WebSocket

from .base_handler import BaseHandler
from pyapps.matrix.services import ConfigService


class ConfigHandler(BaseHandler):
    """Handle config namespace requests"""

    def __init__(self):
        self.config_service = ConfigService.instance()
        super().__init__()

    def _register_actions(self):
        """Register config actions"""
        self.actions['get_full'] = self.handle_get_full
        self.actions['get_global'] = self.handle_get_global
        self.actions['update_global'] = self.handle_update_global
        self.actions['get_device'] = self.handle_get_device
        self.actions['update_device'] = self.handle_update_device
        self.actions['delete_device'] = self.handle_delete_device

    async def handle_get_full(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Get full configuration"""
        config = await self.config_service.get_config()
        return {
            "success": True,
            "config": config
        }

    async def handle_get_global(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Get global configuration"""
        global_config = await self.config_service.get_global()
        return {
            "success": True,
            "config": global_config
        }

    async def handle_update_global(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Update global configuration"""
        # Extract config payload from data
        config_payload = {}
        for key in ['max_size', 'bit_rate', 'max_fps', 'codec', 'control', 'locked_video_orientation']:
            if key in data:
                config_payload[key] = data[key]

        if not config_payload:
            return {'error': {'code': 'MISSING_PAYLOAD', 'message': 'Configuration payload required'}}

        # Validate ranges
        if 'max_size' in config_payload:
            if not 120 <= config_payload['max_size'] <= 4320:
                return {'error': {'code': 'INVALID_MAX_SIZE', 'message': 'max_size must be between 120 and 4320'}}

        if 'bit_rate' in config_payload:
            if not 100000 <= config_payload['bit_rate'] <= 20000000:
                return {'error': {'code': 'INVALID_BIT_RATE', 'message': 'bit_rate must be between 100000 and 20000000'}}

        if 'max_fps' in config_payload:
            if not 1 <= config_payload['max_fps'] <= 120:
                return {'error': {'code': 'INVALID_MAX_FPS', 'message': 'max_fps must be between 1 and 120'}}

        if 'codec' in config_payload:
            if config_payload['codec'] not in ['h264', 'h265', 'av1']:
                return {'error': {'code': 'INVALID_CODEC', 'message': "codec must be 'h264', 'h265', or 'av1'"}}

        if 'locked_video_orientation' in config_payload:
            if not -1 <= config_payload['locked_video_orientation'] <= 3:
                return {'error': {'code': 'INVALID_ORIENTATION', 'message': 'locked_video_orientation must be between -1 and 3'}}

        updated = await self.config_service.update_global(config_payload)
        return {
            "success": True,
            "config": updated
        }

    async def handle_get_device(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Get device-specific configuration"""
        device_name = data.get('deviceName')
        if not device_name:
            return {'error': {'code': 'MISSING_DEVICE_NAME', 'message': 'Device name required'}}

        config = await self.config_service.get_device_config(device_name)
        if config is None:
            return {'error': {'code': 'DEVICE_NOT_FOUND', 'message': 'Device configuration not found'}}

        return {
            "success": True,
            "device": device_name,
            "config": config
        }

    async def handle_update_device(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Update device-specific configuration"""
        device_name = data.get('deviceName')
        if not device_name:
            return {'error': {'code': 'MISSING_DEVICE_NAME', 'message': 'Device name required'}}

        # Extract config payload from data
        config_payload = {}
        for key in ['max_size', 'bit_rate', 'max_fps', 'codec', 'control', 'locked_video_orientation']:
            if key in data:
                config_payload[key] = data[key]

        if not config_payload:
            return {'error': {'code': 'MISSING_PAYLOAD', 'message': 'Configuration payload required'}}

        # Validate ranges (same as global)
        if 'max_size' in config_payload:
            if not 120 <= config_payload['max_size'] <= 4320:
                return {'error': {'code': 'INVALID_MAX_SIZE', 'message': 'max_size must be between 120 and 4320'}}

        if 'bit_rate' in config_payload:
            if not 100000 <= config_payload['bit_rate'] <= 20000000:
                return {'error': {'code': 'INVALID_BIT_RATE', 'message': 'bit_rate must be between 100000 and 20000000'}}

        if 'max_fps' in config_payload:
            if not 1 <= config_payload['max_fps'] <= 120:
                return {'error': {'code': 'INVALID_MAX_FPS', 'message': 'max_fps must be between 1 and 120'}}

        if 'codec' in config_payload:
            if config_payload['codec'] not in ['h264', 'h265', 'av1']:
                return {'error': {'code': 'INVALID_CODEC', 'message': "codec must be 'h264', 'h265', or 'av1'"}}

        if 'locked_video_orientation' in config_payload:
            if not -1 <= config_payload['locked_video_orientation'] <= 3:
                return {'error': {'code': 'INVALID_ORIENTATION', 'message': 'locked_video_orientation must be between -1 and 3'}}

        updated = await self.config_service.update_device_config(device_name, config_payload)
        return {
            "success": True,
            "device": device_name,
            "config": updated
        }

    async def handle_delete_device(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Delete device-specific configuration"""
        device_name = data.get('deviceName')
        if not device_name:
            return {'error': {'code': 'MISSING_DEVICE_NAME', 'message': 'Device name required'}}

        removed = await self.config_service.delete_device_config(device_name)
        if not removed:
            return {'error': {'code': 'DEVICE_NOT_FOUND', 'message': 'Device configuration not found'}}

        return {
            "success": True,
            "device": device_name
        }
