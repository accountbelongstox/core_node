"""File namespace handler"""

from typing import Dict, Any
from fastapi import WebSocket

from .base_handler import BaseHandler
from pyapps.matrix.services import FileService


class FileHandler(BaseHandler):
    """Handle file namespace requests"""

    def __init__(self):
        self.file_service = FileService.instance()
        super().__init__()

    def _register_actions(self):
        """Register file actions"""
        self.actions['push'] = self.handle_push
        self.actions['install_apk'] = self.handle_install_apk
        self.actions['uninstall_apk'] = self.handle_uninstall_apk
        self.actions['list_packages'] = self.handle_list_packages
        self.actions['get_transfer_status'] = self.handle_get_transfer_status

    async def handle_push(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Push file to device (Note: file content should be sent separately via REST API)"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        local_path = data.get('localPath')
        remote_path = data.get('remotePath')

        if not local_path or not remote_path:
            return {
                'error': {
                    'code': 'MISSING_PATHS',
                    'message': 'Both localPath and remotePath are required'
                }
            }

        result = await self.file_service.push_file(
            device_serial=serial,
            local_path=local_path,
            remote_path=remote_path
        )

        if not result.get("success"):
            return {'error': {'code': 'PUSH_FAILED', 'message': result.get('error', 'Failed to push file')}}

        return result

    async def handle_install_apk(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Install APK to device (Note: APK should be uploaded separately via REST API)"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        apk_path = data.get('apkPath')
        if not apk_path:
            return {'error': {'code': 'MISSING_APK_PATH', 'message': 'APK path required'}}

        reinstall = data.get('reinstall', False)

        result = await self.file_service.install_apk(
            device_serial=serial,
            apk_path=apk_path,
            reinstall=reinstall
        )

        if not result.get("success"):
            return {'error': {'code': 'INSTALL_FAILED', 'message': result.get('error', 'Failed to install APK')}}

        return result

    async def handle_uninstall_apk(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Uninstall APK from device"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        package_name = data.get('packageName')
        if not package_name:
            return {'error': {'code': 'MISSING_PACKAGE_NAME', 'message': 'Package name required'}}

        result = await self.file_service.uninstall_apk(
            device_serial=serial,
            package_name=package_name
        )

        if not result.get("success"):
            return {'error': {'code': 'UNINSTALL_FAILED', 'message': result.get('error', 'Failed to uninstall APK')}}

        return result

    async def handle_list_packages(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """List installed packages on device"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        filter_pattern = data.get('filter')

        result = await self.file_service.list_installed_packages(
            device_serial=serial,
            filter_pattern=filter_pattern
        )

        if not result.get("success"):
            return {'error': {'code': 'LIST_PACKAGES_FAILED', 'message': result.get('error', 'Failed to list packages')}}

        return result

    async def handle_get_transfer_status(self, data: Dict[str, Any], websocket: WebSocket) -> Dict[str, Any]:
        """Get file transfer task status"""
        task_id = data.get('taskId')
        if not task_id:
            return {'error': {'code': 'MISSING_TASK_ID', 'message': 'Task ID required'}}

        result = await self.file_service.get_transfer_status(task_id)

        if not result.get("success"):
            return {'error': {'code': 'TASK_NOT_FOUND', 'message': result.get('error', 'Task not found')}}

        return result
