"""Recording namespace handler"""

from typing import Dict, Any
from fastapi import WebSocket

from .base_handler import BaseHandler
from pyapps.matrix.services import RecordingService


class RecordingHandler(BaseHandler):
    """Handle recording namespace requests"""

    def __init__(self):
        self.recording_service = RecordingService.instance()
        super().__init__()

    def _register_actions(self):
        """Register recording actions"""
        self.actions['start'] = self.handle_start
        self.actions['stop'] = self.handle_stop
        self.actions['get_status'] = self.handle_get_status
        self.actions['screenshot'] = self.handle_screenshot

    async def handle_start(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Start screen recording"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        quality = data.get('quality', 'high')
        max_duration = data.get('maxDuration', 1800)

        result = await self.recording_service.start_recording(
            serial=serial,
            quality=quality,
            max_duration=max_duration
        )

        if not result.get("success"):
            return {'error': {'code': 'RECORDING_START_FAILED', 'message': result.get('error', 'Failed to start recording')}}

        return result

    async def handle_stop(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Stop screen recording"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        result = await self.recording_service.stop_recording(serial=serial)

        if not result.get("success"):
            return {'error': {'code': 'RECORDING_STOP_FAILED', 'message': result.get('error', 'Failed to stop recording')}}

        return result

    async def handle_get_status(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Get current recording status"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        recording_info = self.recording_service.get_recording_status(serial)

        return {
            "success": True,
            "isRecording": recording_info is not None,
            "recordingInfo": recording_info
        }

    async def handle_screenshot(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Capture screenshot"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        format_type = data.get('format', 'png')

        result = await self.recording_service.capture_screenshot(
            serial=serial,
            format=format_type
        )

        if not result.get("success"):
            return {'error': {'code': 'SCREENSHOT_FAILED', 'message': result.get('error', 'Failed to capture screenshot')}}

        return result
