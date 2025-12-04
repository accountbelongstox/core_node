"""Video namespace handler"""

from typing import Dict, Any
from fastapi import WebSocket

from .base_handler import BaseHandler
from pyapps.matrix.services import VideoStreamService


class VideoHandler(BaseHandler):
    """Handle video namespace requests"""

    def __init__(self):
        self.video_service = VideoStreamService.instance()
        super().__init__()

    def _register_actions(self):
        """Register video actions"""
        # Note: Video streaming subscription is handled via subscribe/unsubscribe in unified_ws.py
        # These actions are for controlling active streams
        self.actions['quality'] = self.handle_quality
        self.actions['pause'] = self.handle_pause
        self.actions['resume'] = self.handle_resume

    async def handle_quality(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Change video stream quality"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        # Quality parameters (max_size, bit_rate, max_fps)
        quality_params = {}
        if 'max_size' in data:
            quality_params['max_size'] = data['max_size']
        if 'bit_rate' in data:
            quality_params['bit_rate'] = data['bit_rate']
        if 'max_fps' in data:
            quality_params['max_fps'] = data['max_fps']

        if not quality_params:
            return {'error': {'code': 'MISSING_QUALITY_PARAMS', 'message': 'Quality parameters required'}}

        await self.video_service.set_quality(serial, quality_params)

        return {
            "success": True,
            "message": "Video quality updated",
            "params": quality_params
        }

    async def handle_pause(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Pause video stream"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        await self.video_service.pause(serial)

        return {
            "success": True,
            "message": "Video stream paused"
        }

    async def handle_resume(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Resume video stream"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        await self.video_service.resume(serial)

        return {
            "success": True,
            "message": "Video stream resumed"
        }
