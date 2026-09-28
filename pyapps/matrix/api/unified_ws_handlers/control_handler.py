"""Control namespace handler"""

from typing import Dict, Any
from fastapi import WebSocket

from .base_handler import BaseHandler
from pyapps.matrix.services import ControlService


class ControlHandler(BaseHandler):
    """Handle control namespace requests"""

    def __init__(self):
        self.control_service = ControlService.instance()
        super().__init__()

    def _register_actions(self):
        """Register control actions"""
        self.actions['touch'] = self.handle_touch
        self.actions['key'] = self.handle_key
        self.actions['text'] = self.handle_text
        self.actions['swipe'] = self.handle_swipe
        self.actions['systemkey'] = self.handle_systemkey
        self.actions['clipboard_set'] = self.handle_clipboard_set
        self.actions['clipboard_get'] = self.handle_clipboard_get

    async def handle_touch(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Send touch event"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        # Extract touch event data
        touch_data = {
            "action": data.get("action"),
            "pointerId": data.get("pointerId", 0),
            "x": data.get("x"),
            "y": data.get("y"),
            "pressure": data.get("pressure", 1.0),
            "screenWidth": data.get("screenWidth"),
            "screenHeight": data.get("screenHeight")
        }

        success = await self.control_service.send_touch_event(serial, touch_data)

        if not success:
            return {'error': {'code': 'TOUCH_FAILED', 'message': 'Failed to send touch event'}}

        return {"success": True}

    async def handle_key(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Send key event"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        key_data = {
            "action": data.get("action"),
            "keyCode": data.get("keyCode"),
            "metaState": data.get("metaState", 0)
        }

        success = await self.control_service.send_key_event(serial, key_data)

        if not success:
            return {'error': {'code': 'KEY_FAILED', 'message': 'Failed to send key event'}}

        return {"success": True}

    async def handle_text(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Send text input"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        text = data.get('text', '')
        if not text:
            return {'error': {'code': 'MISSING_TEXT', 'message': 'Text content required'}}

        success = await self.control_service.send_text(serial, text)

        if not success:
            return {'error': {'code': 'TEXT_FAILED', 'message': 'Failed to send text'}}

        return {"success": True}

    async def handle_swipe(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Send swipe gesture"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        swipe_data = {
            "startX": data.get("startX"),
            "startY": data.get("startY"),
            "endX": data.get("endX"),
            "endY": data.get("endY"),
            "duration": data.get("duration", 300),
            "screenWidth": data.get("screenWidth"),
            "screenHeight": data.get("screenHeight")
        }

        success = await self.control_service.send_swipe(serial, swipe_data)

        if not success:
            return {'error': {'code': 'SWIPE_FAILED', 'message': 'Failed to send swipe'}}

        return {"success": True}

    async def handle_systemkey(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Send system key (home, back, etc.)"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        action = data.get('action')
        if not action:
            return {'error': {'code': 'MISSING_ACTION', 'message': 'System key action required'}}

        # Validate action
        valid_actions = ['home', 'back', 'recent', 'power', 'volume_up', 'volume_down']
        if action not in valid_actions:
            return {
                'error': {
                    'code': 'INVALID_ACTION',
                    'message': f'Invalid action. Must be one of: {", ".join(valid_actions)}'
                }
            }

        success = await self.control_service.send_system_key(serial, action)

        if not success:
            return {'error': {'code': 'SYSTEMKEY_FAILED', 'message': f'Failed to send system key: {action}'}}

        return {"success": True, "action": action}

    async def handle_clipboard_set(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Set device clipboard"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        text = data.get('text', '')
        if not text:
            return {'error': {'code': 'MISSING_TEXT', 'message': 'Clipboard text required'}}

        success = await self.control_service.set_clipboard(serial, text)

        if not success:
            return {'error': {'code': 'CLIPBOARD_SET_FAILED', 'message': 'Failed to set clipboard'}}

        return {"success": True, "message": "Clipboard set successfully"}

    async def handle_clipboard_get(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Get device clipboard"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        clipboard_text = await self.control_service.get_clipboard(serial)

        return {"success": True, "text": clipboard_text}
