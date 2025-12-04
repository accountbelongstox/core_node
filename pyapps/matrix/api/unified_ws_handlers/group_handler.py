"""Group namespace handler"""

from typing import Dict, Any
from fastapi import WebSocket

from .base_handler import BaseHandler
from pyapps.matrix.services import GroupService


class GroupHandler(BaseHandler):
    """Handle group namespace requests"""

    def __init__(self):
        self.group_service = GroupService.instance()
        super().__init__()

    def _register_actions(self):
        """Register group actions"""
        self.actions['batch_screenshot'] = self.handle_batch_screenshot
        self.actions['batch_start_recording'] = self.handle_batch_start_recording
        self.actions['batch_stop_recording'] = self.handle_batch_stop_recording
        self.actions['batch_systemkey'] = self.handle_batch_systemkey
        self.actions['batch_screen_control'] = self.handle_batch_screen_control
        self.actions['get_tree'] = self.handle_get_tree
        self.actions['update_tree'] = self.handle_update_tree

    async def handle_batch_screenshot(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Capture screenshots for all devices in a group"""
        group_id = data.get('groupId')
        if not group_id:
            return {'error': {'code': 'MISSING_GROUP_ID', 'message': 'Group ID required'}}

        format_type = data.get('format', 'png')

        result = await self.group_service.batch_screenshot(
            group_id=group_id,
            format=format_type
        )

        if not result.get("success"):
            return {'error': {'code': 'BATCH_SCREENSHOT_FAILED', 'message': result.get('error', 'Failed to batch screenshot')}}

        return result

    async def handle_batch_start_recording(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Start recording for all devices in a group"""
        group_id = data.get('groupId')
        if not group_id:
            return {'error': {'code': 'MISSING_GROUP_ID', 'message': 'Group ID required'}}

        quality = data.get('quality', 'high')
        max_duration = data.get('maxDuration', 1800)

        result = await self.group_service.batch_start_recording(
            group_id=group_id,
            quality=quality,
            max_duration=max_duration
        )

        if not result.get("success"):
            return {'error': {'code': 'BATCH_START_RECORDING_FAILED', 'message': result.get('error', 'Failed to batch start recording')}}

        return result

    async def handle_batch_stop_recording(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Stop recording for all devices in a group"""
        group_id = data.get('groupId')
        if not group_id:
            return {'error': {'code': 'MISSING_GROUP_ID', 'message': 'Group ID required'}}

        result = await self.group_service.batch_stop_recording(group_id=group_id)

        if not result.get("success"):
            return {'error': {'code': 'BATCH_STOP_RECORDING_FAILED', 'message': result.get('error', 'Failed to batch stop recording')}}

        return result

    async def handle_batch_systemkey(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Send system key event to all devices in a group"""
        group_id = data.get('groupId')
        if not group_id:
            return {'error': {'code': 'MISSING_GROUP_ID', 'message': 'Group ID required'}}

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

        result = await self.group_service.batch_system_key(
            group_id=group_id,
            action=action
        )

        if not result.get("success"):
            return {'error': {'code': 'BATCH_SYSTEMKEY_FAILED', 'message': result.get('error', 'Failed to batch system key')}}

        return result

    async def handle_batch_screen_control(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Batch screen control for all devices in a group"""
        group_id = data.get('groupId')
        if not group_id:
            return {'error': {'code': 'MISSING_GROUP_ID', 'message': 'Group ID required'}}

        control_type = data.get('controlType')
        if not control_type:
            return {'error': {'code': 'MISSING_CONTROL_TYPE', 'message': 'Control type required'}}

        params = data.get('params', {})

        # Validate control type
        valid_types = ['power', 'brightness', 'rotation']
        if control_type not in valid_types:
            return {
                'error': {
                    'code': 'INVALID_CONTROL_TYPE',
                    'message': f'Invalid control type. Must be one of: {", ".join(valid_types)}'
                }
            }

        # Validate params based on control type
        if control_type == "power":
            if "action" not in params:
                return {'error': {'code': 'MISSING_PARAMS', 'message': "Missing 'action' parameter for power control"}}
            if params["action"] not in ["on", "off", "toggle"]:
                return {
                    'error': {
                        'code': 'INVALID_PARAMS',
                        'message': "Invalid power action. Must be 'on', 'off', or 'toggle'"
                    }
                }
        elif control_type == "brightness":
            if "level" not in params:
                return {'error': {'code': 'MISSING_PARAMS', 'message': "Missing 'level' parameter for brightness control"}}
            if not 0 <= params["level"] <= 255:
                return {
                    'error': {
                        'code': 'INVALID_PARAMS',
                        'message': "Brightness level must be between 0 and 255"
                    }
                }
        elif control_type == "rotation":
            if "rotation" not in params:
                return {'error': {'code': 'MISSING_PARAMS', 'message': "Missing 'rotation' parameter for rotation control"}}
            if params["rotation"] not in [0, 90, 180, 270]:
                return {
                    'error': {
                        'code': 'INVALID_PARAMS',
                        'message': "Rotation must be 0, 90, 180, or 270 degrees"
                    }
                }

        result = await self.group_service.batch_screen_control(
            group_id=group_id,
            control_type=control_type,
            params=params
        )

        if not result.get("success"):
            return {'error': {'code': 'BATCH_SCREEN_CONTROL_FAILED', 'message': result.get('error', 'Failed to batch screen control')}}

        return result

    async def handle_get_tree(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Get hierarchical group tree structure"""
        result = await self.group_service.get_tree()

        if not result.get("success"):
            return {'error': {'code': 'GET_TREE_FAILED', 'message': result.get('error', 'Failed to get group tree')}}

        return result

    async def handle_update_tree(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Update entire group tree structure"""
        tree = data.get('tree')
        if tree is None:
            return {'error': {'code': 'MISSING_TREE', 'message': 'Tree structure required'}}

        result = await self.group_service.update_tree(tree)

        if not result.get("success"):
            return {'error': {'code': 'UPDATE_TREE_FAILED', 'message': result.get('error', 'Failed to update group tree')}}

        return result
