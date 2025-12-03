"""Screen namespace handler"""

from typing import Dict, Any
from fastapi import WebSocket

from .base_handler import BaseHandler
from pyapps.matrix.services import ScreenService


class ScreenHandler(BaseHandler):
    """Handle screen namespace requests"""

    def __init__(self):
        self.screen_service = ScreenService.instance()
        super().__init__()

    def _register_actions(self):
        """Register screen actions"""
        self.actions['power'] = self.handle_power
        self.actions['set_brightness'] = self.handle_set_brightness
        self.actions['get_brightness'] = self.handle_get_brightness
        self.actions['set_rotation'] = self.handle_set_rotation
        self.actions['get_rotation'] = self.handle_get_rotation
        self.actions['enable_auto_rotation'] = self.handle_enable_auto_rotation
        self.actions['disable_auto_rotation'] = self.handle_disable_auto_rotation

    async def handle_power(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Control screen power"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        action = data.get('action')
        if not action:
            return {'error': {'code': 'MISSING_ACTION', 'message': 'Power action required'}}

        if action not in ['on', 'off', 'toggle']:
            return {
                'error': {
                    'code': 'INVALID_ACTION',
                    'message': "Invalid action. Must be 'on', 'off', or 'toggle'"
                }
            }

        result = await self.screen_service.control_screen_power(serial=serial, action=action)

        if not result.get("success"):
            return {'error': {'code': 'POWER_CONTROL_FAILED', 'message': result.get('error', 'Failed to control screen power')}}

        return result

    async def handle_set_brightness(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Set screen brightness"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        level = data.get('level')
        if level is None:
            return {'error': {'code': 'MISSING_LEVEL', 'message': 'Brightness level required'}}

        if not isinstance(level, int) or not 0 <= level <= 255:
            return {
                'error': {
                    'code': 'INVALID_LEVEL',
                    'message': 'Brightness level must be between 0 and 255'
                }
            }

        result = await self.screen_service.control_screen_brightness(serial=serial, level=level)

        if not result.get("success"):
            return {'error': {'code': 'BRIGHTNESS_CONTROL_FAILED', 'message': result.get('error', 'Failed to set brightness')}}

        return result

    async def handle_get_brightness(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Get current screen brightness"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        result = await self.screen_service.get_screen_brightness(serial=serial)

        if not result.get("success"):
            return {'error': {'code': 'BRIGHTNESS_GET_FAILED', 'message': result.get('error', 'Failed to get brightness')}}

        return result

    async def handle_set_rotation(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Set screen rotation"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        rotation = data.get('rotation')
        if rotation is None:
            return {'error': {'code': 'MISSING_ROTATION', 'message': 'Rotation value required'}}

        if rotation not in [0, 90, 180, 270]:
            return {
                'error': {
                    'code': 'INVALID_ROTATION',
                    'message': 'Rotation must be 0, 90, 180, or 270 degrees'
                }
            }

        result = await self.screen_service.control_screen_rotation(serial=serial, rotation=rotation)

        if not result.get("success"):
            return {'error': {'code': 'ROTATION_CONTROL_FAILED', 'message': result.get('error', 'Failed to set rotation')}}

        return result

    async def handle_get_rotation(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Get current screen rotation"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        result = await self.screen_service.get_screen_rotation(serial=serial)

        if not result.get("success"):
            return {'error': {'code': 'ROTATION_GET_FAILED', 'message': result.get('error', 'Failed to get rotation')}}

        return result

    async def handle_enable_auto_rotation(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Enable automatic screen rotation"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        result = await self.screen_service.enable_auto_rotation(serial=serial)

        if not result.get("success"):
            return {'error': {'code': 'AUTO_ROTATION_ENABLE_FAILED', 'message': result.get('error', 'Failed to enable auto-rotation')}}

        return result

    async def handle_disable_auto_rotation(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Disable automatic screen rotation"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        result = await self.screen_service.disable_auto_rotation(serial=serial)

        if not result.get("success"):
            return {'error': {'code': 'AUTO_ROTATION_DISABLE_FAILED', 'message': result.get('error', 'Failed to disable auto-rotation')}}

        return result
