#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Matrix API Manager - RPC v2 WebSocket Edition

Single entry point for all Matrix API routes.
All routes are registered as RPC v2 WebSocket endpoints.

Connection: ws://localhost:48000/rpc/ws
Protocol: RPC v2 (request/response with ACK mechanism)

Message Format:
    {
        "type": "request",
        "id": "req-001",
        "route": "device.list",
        "data": {...},
        "timestamp": 1733200000000
    }
"""

import sys
from pathlib import Path
from typing import Dict, Any
from datetime import datetime
import psutil
import platform

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pyheartbeat import get_heartbeat_system

# Import all services
from pyapps.matrix.services import (
    DeviceService,
    ScreenService,
    FileService,
    RecordingService,
    GroupService,
    ConfigService,
    ControlService,
    VideoStreamService,
)


def register_all_routes(rpc_server):
    """
    Register all Matrix RPC v2 routes

    This is the ONLY function called to register all Matrix API routes.
    Called by pylauncher after RPC v2 server initialization.

    Args:
        rpc_server: RPC v2 server instance (FastAPIRPCServer)
    """
    ColorPrint.blue("=" * 70)
    ColorPrint.blue("[Matrix API] Registering RPC v2 WebSocket routes...")
    ColorPrint.blue("=" * 70)

    # Register all route categories
    _register_health_routes(rpc_server)
    _register_heartbeat_routes(rpc_server)
    _register_device_routes(rpc_server)
    _register_screen_routes(rpc_server)
    _register_file_routes(rpc_server)
    _register_recording_routes(rpc_server)
    _register_group_routes(rpc_server)
    _register_config_routes(rpc_server)
    _register_control_routes(rpc_server)
    _register_video_routes(rpc_server)

    ColorPrint.green("=" * 70)
    ColorPrint.green("[Matrix API] All RPC v2 routes registered successfully")
    ColorPrint.green("=" * 70)


# ============================================================
# Health & System Routes
# ============================================================

def _register_health_routes(rpc_server):
    """Register health check routes"""

    async def health_check(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Basic health check"""
        return {
            "status": "healthy",
            "service": "Matrix",
            "version": "2.0.0",
            "protocol": "RPC v2 WebSocket",
            "timestamp": datetime.now().isoformat()
        }

    async def detailed_health(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Detailed health check with system information"""
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')

        return {
            "status": "healthy",
            "service": {
                "name": "Matrix",
                "version": "2.0.0",
                "description": "Android Device Mirroring and Group Control System",
                "protocol": "RPC v2 WebSocket"
            },
            "timestamp": datetime.now().isoformat(),
            "system": {
                "platform": platform.system(),
                "python_version": platform.python_version(),
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

    rpc_server.route('health', health_check, sync=True, description='Basic health check')
    rpc_server.route('health.detailed', detailed_health, sync=True, description='Detailed health check')


# ============================================================
# Heartbeat Routes
# ============================================================

def _register_heartbeat_routes(rpc_server):
    """Register heartbeat system routes"""

    async def get_heartbeat_info(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Get heartbeat tick count and last heartbeat time"""
        try:
            heartbeat_system = get_heartbeat_system()

            # Get heartbeat pusher stats
            if heartbeat_system._heartbeat_pusher:
                pusher_stats = heartbeat_system._heartbeat_pusher.get_stats()
                total_ticks = pusher_stats['total_ticks']
                uptime = pusher_stats['uptime']

                return {
                    "success": True,
                    "total_ticks": total_ticks,
                    "uptime_seconds": uptime,
                    "last_heartbeat_time": datetime.now().isoformat()
                }
            else:
                return {
                    'error': {
                        'code': 'HEARTBEAT_NOT_RUNNING',
                        'message': 'Heartbeat pusher is not running'
                    }
                }
        except Exception as e:
            return {
                'error': {
                    'code': 'HEARTBEAT_ERROR',
                    'message': f'Failed to get heartbeat info: {str(e)}'
                }
            }

    rpc_server.route('heartbeat.info', get_heartbeat_info, sync=True, description='Get heartbeat tick count and last heartbeat time')


# ============================================================
# Device Routes
# ============================================================

def _register_device_routes(rpc_server):
    """Register device management routes"""

    async def list_devices(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """List all ADB devices"""
        service = DeviceService.instance()
        adb_devices = await service.list_devices()

        devices_list = []
        for device in adb_devices:
            device_dict = {
                "serial": device.serial,
                "status": device.state.value,
                "model": device.model if hasattr(device, 'model') else "Unknown",
                "manufacturer": device.product if hasattr(device, 'product') else None,
            }
            devices_list.append(device_dict)

        return {
            "devices": devices_list,
            "count": len(devices_list)
        }

    async def get_device_info(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Get device detailed information"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        service = DeviceService.instance()
        device_info = await service.get_device_info(serial)

        if not device_info:
            return {'error': {'code': 'DEVICE_NOT_FOUND', 'message': 'Device not found or offline'}}

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

    async def connect_device(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Connect device"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        service = DeviceService.instance()
        params = {
            "max_size": data.get("max_size", 720),
            "bit_rate": data.get("bit_rate", 8000000),
            "max_fps": data.get("max_fps", 60),
            "codec": data.get("codec"),
            "control": data.get("control"),
            "locked_video_orientation": data.get("locked_video_orientation"),
            "device_name": data.get("device_name"),
        }

        success = await service.connect_device(serial, params)

        if not success:
            return {'error': {'code': 'CONNECT_FAILED', 'message': f'Failed to connect device {serial}'}}

        return {
            "success": True,
            "message": f"Device {serial} connected successfully"
        }

    async def disconnect_device(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Disconnect device"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        service = DeviceService.instance()
        success = await service.disconnect_device(serial)

        if not success:
            return {'error': {'code': 'DISCONNECT_FAILED', 'message': f'Failed to disconnect device {serial}'}}

        return {
            "success": True,
            "message": f"Device {serial} disconnected successfully"
        }

    async def batch_configure(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Batch configure multiple devices"""
        devices = data.get('devices', [])
        config = data.get('config', {})

        if not devices:
            return {'error': {'code': 'NO_DEVICES', 'message': 'No devices specified'}}
        if not config:
            return {'error': {'code': 'NO_CONFIG', 'message': 'No configuration specified'}}

        screen_service = ScreenService.instance()
        results = []
        successful = 0
        failed = 0

        for device_serial in devices:
            device_result = {
                "serial": device_serial,
                "success": True,
                "applied": [],
                "failed": [],
                "errors": []
            }

            # Apply screen configurations
            if "screenPower" in config:
                result = await screen_service.control_screen_power(device_serial, config["screenPower"])
                if result.get("success"):
                    device_result["applied"].append("screen_power")
                else:
                    device_result["failed"].append("screen_power")
                    device_result["errors"].append(result.get("error", "Unknown error"))

            if "brightness" in config:
                result = await screen_service.control_screen_brightness(device_serial, int(config["brightness"]))
                if result.get("success"):
                    device_result["applied"].append("brightness")
                else:
                    device_result["failed"].append("brightness")
                    device_result["errors"].append(result.get("error", "Unknown error"))

            if "screenRotation" in config:
                result = await screen_service.control_screen_rotation(device_serial, int(config["screenRotation"]))
                if result.get("success"):
                    device_result["applied"].append("screen_rotation")
                else:
                    device_result["failed"].append("screen_rotation")
                    device_result["errors"].append(result.get("error", "Unknown error"))

            if len(device_result["failed"]) > 0:
                device_result["success"] = False
                failed += 1
            else:
                successful += 1

            results.append(device_result)

        return {
            "success": True,
            "total": len(devices),
            "successful": successful,
            "failed": failed,
            "results": results
        }

    async def adb_device_list(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Get ADB device manager device list (auto-discovered devices)"""
        from pyapps.matrix.matrix_main import get_adb_heartbeat_thread

        adb_thread = get_adb_heartbeat_thread()
        if not adb_thread:
            return {'error': {'code': 'ADB_MANAGER_NOT_RUNNING', 'message': 'ADB Device Manager not running'}}

        device_table = adb_thread.get_device_table()
        all_devices = device_table.get_all_devices()

        devices_list = []
        for device_info in all_devices:
            devices_list.append({
                "serial": device_info.serial,
                "ip": device_info.ip,
                "connection_type": device_info.connection_type.value,
                "state": device_info.state.value,
                "is_root": device_info.is_root,
                "model": device_info.model,
                "android_version": device_info.android_version,
                "last_seen": device_info.last_seen,
                "connected_at": device_info.connected_at,
            })

        stats = device_table.get_stats()

        return {
            "devices": devices_list,
            "count": len(devices_list),
            "stats": stats
        }

    async def adb_device_stats(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Get ADB device manager statistics"""
        from pyapps.matrix.matrix_main import get_adb_heartbeat_thread

        adb_thread = get_adb_heartbeat_thread()
        if not adb_thread:
            return {'error': {'code': 'ADB_MANAGER_NOT_RUNNING', 'message': 'ADB Device Manager not running'}}

        device_table = adb_thread.get_device_table()
        stats = device_table.get_stats()

        return {
            "stats": stats,
            "heartbeat_running": adb_thread.is_running(),
            "total_ticks": adb_thread.get_total_ticks() if hasattr(adb_thread, 'get_total_ticks') else 0,
        }

    rpc_server.route('device.list', list_devices, sync=True, description='List all ADB devices')
    rpc_server.route('device.info', get_device_info, sync=False, description='Get device detailed information')
    rpc_server.route('device.connect', connect_device, sync=False, description='Connect device')
    rpc_server.route('device.disconnect', disconnect_device, sync=False, description='Disconnect device')
    rpc_server.route('device.batch_configure', batch_configure, sync=True, description='Batch configure devices')
    rpc_server.route('adb.device.list', adb_device_list, sync=True, description='Get auto-discovered ADB devices')
    rpc_server.route('adb.device.stats', adb_device_stats, sync=True, description='Get ADB device manager statistics')


# ============================================================
# Screen Control Routes
# ============================================================

def _register_screen_routes(rpc_server):
    """Register screen control routes"""

    async def control_power(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Control screen power"""
        serial = data.get('serial')
        action = data.get('action')

        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}
        if action not in ["on", "off", "toggle"]:
            return {'error': {'code': 'INVALID_ACTION', 'message': 'Action must be on, off, or toggle'}}

        screen_service = ScreenService.instance()
        result = await screen_service.control_screen_power(serial=serial, action=action)

        if not result.get("success"):
            return {'error': {'code': 'POWER_CONTROL_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def set_brightness(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Set screen brightness"""
        serial = data.get('serial')
        level = data.get('level')

        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}
        if level is None or not (0 <= level <= 255):
            return {'error': {'code': 'INVALID_LEVEL', 'message': 'Brightness level must be 0-255'}}

        screen_service = ScreenService.instance()
        result = await screen_service.control_screen_brightness(serial=serial, level=level)

        if not result.get("success"):
            return {'error': {'code': 'BRIGHTNESS_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def get_brightness(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Get screen brightness"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        screen_service = ScreenService.instance()
        result = await screen_service.get_screen_brightness(serial=serial)

        if not result.get("success"):
            return {'error': {'code': 'GET_BRIGHTNESS_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def set_rotation(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Set screen rotation"""
        serial = data.get('serial')
        rotation = data.get('rotation')

        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}
        if rotation not in [0, 90, 180, 270]:
            return {'error': {'code': 'INVALID_ROTATION', 'message': 'Rotation must be 0, 90, 180, or 270'}}

        screen_service = ScreenService.instance()
        result = await screen_service.control_screen_rotation(serial=serial, rotation=rotation)

        if not result.get("success"):
            return {'error': {'code': 'ROTATION_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def get_rotation(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Get screen rotation"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        screen_service = ScreenService.instance()
        result = await screen_service.get_screen_rotation(serial=serial)

        if not result.get("success"):
            return {'error': {'code': 'GET_ROTATION_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def enable_auto_rotation(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Enable auto-rotation"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        screen_service = ScreenService.instance()
        result = await screen_service.enable_auto_rotation(serial=serial)

        if not result.get("success"):
            return {'error': {'code': 'ENABLE_AUTO_ROTATION_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def disable_auto_rotation(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Disable auto-rotation"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        screen_service = ScreenService.instance()
        result = await screen_service.disable_auto_rotation(serial=serial)

        if not result.get("success"):
            return {'error': {'code': 'DISABLE_AUTO_ROTATION_FAILED', 'message': result.get("error", "Failed")}}

        return result

    rpc_server.route('screen.power', control_power, sync=False, description='Control screen power')
    rpc_server.route('screen.brightness.set', set_brightness, sync=False, description='Set screen brightness')
    rpc_server.route('screen.brightness.get', get_brightness, sync=False, description='Get screen brightness')
    rpc_server.route('screen.rotation.set', set_rotation, sync=False, description='Set screen rotation')
    rpc_server.route('screen.rotation.get', get_rotation, sync=False, description='Get screen rotation')
    rpc_server.route('screen.rotation.auto_enable', enable_auto_rotation, sync=False, description='Enable auto-rotation')
    rpc_server.route('screen.rotation.auto_disable', disable_auto_rotation, sync=False, description='Disable auto-rotation')


# ============================================================
# File Management Routes
# ============================================================

def _register_file_routes(rpc_server):
    """Register file management routes"""

    async def list_packages(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """List installed packages"""
        serial = data.get('serial')
        filter_pattern = data.get('filter')

        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        file_service = FileService.instance()
        result = await file_service.list_installed_packages(device_serial=serial, filter_pattern=filter_pattern)

        if not result.get("success"):
            return {'error': {'code': 'LIST_PACKAGES_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def uninstall_apk(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Uninstall APK"""
        serial = data.get('serial')
        package_name = data.get('packageName')

        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}
        if not package_name:
            return {'error': {'code': 'MISSING_PACKAGE', 'message': 'Package name required'}}

        file_service = FileService.instance()
        result = await file_service.uninstall_apk(device_serial=serial, package_name=package_name)

        if not result.get("success"):
            return {'error': {'code': 'UNINSTALL_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def transfer_status(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Get file transfer status"""
        task_id = data.get('taskId')
        if not task_id:
            return {'error': {'code': 'MISSING_TASK_ID', 'message': 'Task ID required'}}

        file_service = FileService.instance()
        result = await file_service.get_transfer_status(task_id)

        if not result.get("success"):
            return {'error': {'code': 'TASK_NOT_FOUND', 'message': result.get("error", "Task not found")}}

        return result

    rpc_server.route('file.packages', list_packages, sync=False, description='List installed packages')
    rpc_server.route('file.apk_uninstall', uninstall_apk, sync=False, description='Uninstall APK')
    rpc_server.route('file.transfer_status', transfer_status, sync=False, description='Get file transfer status')


# ============================================================
# Recording Routes
# ============================================================

def _register_recording_routes(rpc_server):
    """Register recording and screenshot routes"""

    async def start_recording(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Start screen recording"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        recording_service = RecordingService.instance()
        result = await recording_service.start_recording(
            serial=serial,
            quality=data.get('quality', 'high'),
            max_duration=data.get('maxDuration', 1800)
        )

        if not result.get("success"):
            return {'error': {'code': 'START_RECORDING_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def stop_recording(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Stop screen recording"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        recording_service = RecordingService.instance()
        result = await recording_service.stop_recording(serial=serial)

        if not result.get("success"):
            return {'error': {'code': 'STOP_RECORDING_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def recording_status(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Get recording status"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        recording_service = RecordingService.instance()
        recording_info = recording_service.get_recording_status(serial)

        return {
            "success": True,
            "isRecording": recording_info is not None,
            "recordingInfo": recording_info
        }

    async def capture_screenshot(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Capture screenshot"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        recording_service = RecordingService.instance()
        result = await recording_service.capture_screenshot(serial=serial, format=data.get('format', 'png'))

        if not result.get("success"):
            return {'error': {'code': 'SCREENSHOT_FAILED', 'message': result.get("error", "Failed")}}

        return result

    rpc_server.route('recording.start', start_recording, sync=False, description='Start screen recording')
    rpc_server.route('recording.stop', stop_recording, sync=False, description='Stop screen recording')
    rpc_server.route('recording.status', recording_status, sync=False, description='Get recording status')
    rpc_server.route('screenshot.capture', capture_screenshot, sync=False, description='Capture screenshot')


# ============================================================
# Group Batch Routes
# ============================================================

def _register_group_routes(rpc_server):
    """Register group batch operation routes"""

    async def batch_screenshot(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Batch screenshot"""
        group_id = data.get('groupId')
        if not group_id:
            return {'error': {'code': 'MISSING_GROUP_ID', 'message': 'Group ID required'}}

        group_service = GroupService.instance()
        result = await group_service.batch_screenshot(group_id=group_id, format=data.get('format', 'png'))

        if not result.get("success"):
            return {'error': {'code': 'BATCH_SCREENSHOT_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def batch_start_recording(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Batch start recording"""
        group_id = data.get('groupId')
        if not group_id:
            return {'error': {'code': 'MISSING_GROUP_ID', 'message': 'Group ID required'}}

        group_service = GroupService.instance()
        result = await group_service.batch_start_recording(
            group_id=group_id,
            quality=data.get('quality', 'high'),
            max_duration=data.get('maxDuration', 1800)
        )

        if not result.get("success"):
            return {'error': {'code': 'BATCH_START_RECORDING_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def batch_stop_recording(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Batch stop recording"""
        group_id = data.get('groupId')
        if not group_id:
            return {'error': {'code': 'MISSING_GROUP_ID', 'message': 'Group ID required'}}

        group_service = GroupService.instance()
        result = await group_service.batch_stop_recording(group_id=group_id)

        if not result.get("success"):
            return {'error': {'code': 'BATCH_STOP_RECORDING_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def batch_system_key(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Batch system key"""
        group_id = data.get('groupId')
        action = data.get('action')

        if not group_id:
            return {'error': {'code': 'MISSING_GROUP_ID', 'message': 'Group ID required'}}

        valid_actions = ['home', 'back', 'recent', 'power', 'volume_up', 'volume_down']
        if action not in valid_actions:
            return {'error': {'code': 'INVALID_ACTION', 'message': f'Must be one of: {", ".join(valid_actions)}'}}

        group_service = GroupService.instance()
        result = await group_service.batch_system_key(group_id=group_id, action=action)

        if not result.get("success"):
            return {'error': {'code': 'BATCH_SYSTEM_KEY_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def batch_screen_control(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Batch screen control"""
        group_id = data.get('groupId')
        control_type = data.get('controlType')
        params = data.get('params', {})

        if not group_id:
            return {'error': {'code': 'MISSING_GROUP_ID', 'message': 'Group ID required'}}

        valid_types = ['power', 'brightness', 'rotation']
        if control_type not in valid_types:
            return {'error': {'code': 'INVALID_CONTROL_TYPE', 'message': f'Must be one of: {", ".join(valid_types)}'}}

        group_service = GroupService.instance()
        result = await group_service.batch_screen_control(group_id=group_id, control_type=control_type, params=params)

        if not result.get("success"):
            return {'error': {'code': 'BATCH_SCREEN_CONTROL_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def get_tree(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Get group tree"""
        group_service = GroupService.instance()
        result = await group_service.get_tree()

        if not result.get("success"):
            return {'error': {'code': 'GET_TREE_FAILED', 'message': result.get("error", "Failed")}}

        return result

    async def update_tree(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Update group tree"""
        tree = data.get('tree')
        if not tree:
            return {'error': {'code': 'MISSING_TREE', 'message': 'Tree structure required'}}

        group_service = GroupService.instance()
        result = await group_service.update_tree(tree)

        if not result.get("success"):
            return {'error': {'code': 'UPDATE_TREE_FAILED', 'message': result.get("error", "Failed")}}

        return result

    rpc_server.route('group.batch_screenshot', batch_screenshot, sync=False, description='Batch screenshot')
    rpc_server.route('group.batch_start_recording', batch_start_recording, sync=False, description='Batch start recording')
    rpc_server.route('group.batch_stop_recording', batch_stop_recording, sync=False, description='Batch stop recording')
    rpc_server.route('group.batch_system_key', batch_system_key, sync=False, description='Batch system key')
    rpc_server.route('group.batch_screen_control', batch_screen_control, sync=False, description='Batch screen control')
    rpc_server.route('group.tree', get_tree, sync=True, description='Get group tree')
    rpc_server.route('group.tree_update', update_tree, sync=True, description='Update group tree')


# ============================================================
# Configuration Routes
# ============================================================

def _register_config_routes(rpc_server):
    """Register configuration management routes"""

    async def get_full(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Get full configuration"""
        service = ConfigService.instance()
        config = await service.get_config()
        return {"success": True, "config": config}

    async def get_global(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Get global configuration"""
        service = ConfigService.instance()
        global_config = await service.get_global()
        return {"success": True, "config": global_config}

    async def update_global(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Update global configuration"""
        service = ConfigService.instance()
        updated = await service.update_global(data)
        return {"success": True, "config": updated}

    async def get_device(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Get device configuration"""
        device_name = data.get('deviceName')
        if not device_name:
            return {'error': {'code': 'MISSING_DEVICE_NAME', 'message': 'Device name required'}}

        service = ConfigService.instance()
        config = await service.get_device_config(device_name)

        if config is None:
            return {'error': {'code': 'CONFIG_NOT_FOUND', 'message': 'Device configuration not found'}}

        return {"success": True, "device": device_name, "config": config}

    async def update_device(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Update device configuration"""
        device_name = data.get('deviceName')
        config = data.get('config', {})

        if not device_name:
            return {'error': {'code': 'MISSING_DEVICE_NAME', 'message': 'Device name required'}}

        service = ConfigService.instance()
        updated = await service.update_device_config(device_name, config)
        return {"success": True, "device": device_name, "config": updated}

    async def delete_device(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Delete device configuration"""
        device_name = data.get('deviceName')
        if not device_name:
            return {'error': {'code': 'MISSING_DEVICE_NAME', 'message': 'Device name required'}}

        service = ConfigService.instance()
        removed = await service.delete_device_config(device_name)

        if not removed:
            return {'error': {'code': 'CONFIG_NOT_FOUND', 'message': 'Device configuration not found'}}

        return {"success": True, "device": device_name}

    rpc_server.route('config.full', get_full, sync=True, description='Get full configuration')
    rpc_server.route('config.global', get_global, sync=True, description='Get global configuration')
    rpc_server.route('config.global_update', update_global, sync=True, description='Update global configuration')
    rpc_server.route('config.device', get_device, sync=False, description='Get device configuration')
    rpc_server.route('config.device_update', update_device, sync=False, description='Update device configuration')
    rpc_server.route('config.device_delete', delete_device, sync=False, description='Delete device configuration')


# ============================================================
# Control Routes (Touch, Key, Text Input)
# ============================================================

def _register_control_routes(rpc_server):
    """Register device control routes"""

    async def send_touch(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Send touch event"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        touch_data = {
            "action": data.get("action"),
            "pointerId": data.get("pointerId", 0),
            "x": data.get("x"),
            "y": data.get("y"),
            "pressure": data.get("pressure", 1.0),
            "screenWidth": data.get("screenWidth"),
            "screenHeight": data.get("screenHeight")
        }

        control_service = ControlService.instance()
        success = await control_service.send_touch_event(serial, touch_data)

        if not success:
            return {'error': {'code': 'TOUCH_FAILED', 'message': 'Failed to send touch event'}}

        return {"success": True}

    async def send_key(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Send key event"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        key_data = {
            "action": data.get("action"),
            "keyCode": data.get("keyCode"),
            "metaState": data.get("metaState", 0)
        }

        control_service = ControlService.instance()
        success = await control_service.send_key_event(serial, key_data)

        if not success:
            return {'error': {'code': 'KEY_FAILED', 'message': 'Failed to send key event'}}

        return {"success": True}

    async def send_text(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Send text input"""
        serial = data.get('serial')
        text = data.get('text', '')

        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}
        if not text:
            return {'error': {'code': 'MISSING_TEXT', 'message': 'Text content required'}}

        control_service = ControlService.instance()
        success = await control_service.send_text(serial, text)

        if not success:
            return {'error': {'code': 'TEXT_FAILED', 'message': 'Failed to send text'}}

        return {"success": True}

    async def send_swipe(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
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

        control_service = ControlService.instance()
        success = await control_service.send_swipe(serial, swipe_data)

        if not success:
            return {'error': {'code': 'SWIPE_FAILED', 'message': 'Failed to send swipe'}}

        return {"success": True}

    async def send_system_key(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Send system key"""
        serial = data.get('serial')
        action = data.get('action')

        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}
        if not action:
            return {'error': {'code': 'MISSING_ACTION', 'message': 'System key action required'}}

        valid_actions = ['home', 'back', 'recent', 'power', 'volume_up', 'volume_down']
        if action not in valid_actions:
            return {'error': {'code': 'INVALID_ACTION', 'message': f'Must be one of: {", ".join(valid_actions)}'}}

        control_service = ControlService.instance()
        success = await control_service.send_system_key(serial, action)

        if not success:
            return {'error': {'code': 'SYSTEMKEY_FAILED', 'message': f'Failed to send system key: {action}'}}

        return {"success": True, "action": action}

    async def set_clipboard(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Set device clipboard"""
        serial = data.get('serial')
        text = data.get('text', '')

        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}
        if not text:
            return {'error': {'code': 'MISSING_TEXT', 'message': 'Clipboard text required'}}

        control_service = ControlService.instance()
        success = await control_service.set_clipboard(serial, text)

        if not success:
            return {'error': {'code': 'CLIPBOARD_SET_FAILED', 'message': 'Failed to set clipboard'}}

        return {"success": True, "message": "Clipboard set successfully"}

    async def get_clipboard(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Get device clipboard"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        control_service = ControlService.instance()
        clipboard_text = await control_service.get_clipboard(serial)

        return {"success": True, "text": clipboard_text}

    rpc_server.route('control.touch', send_touch, sync=False, description='Send touch event')
    rpc_server.route('control.key', send_key, sync=False, description='Send key event')
    rpc_server.route('control.text', send_text, sync=False, description='Send text input')
    rpc_server.route('control.swipe', send_swipe, sync=False, description='Send swipe gesture')
    rpc_server.route('control.systemkey', send_system_key, sync=False, description='Send system key')
    rpc_server.route('control.clipboard_set', set_clipboard, sync=False, description='Set device clipboard')
    rpc_server.route('control.clipboard_get', get_clipboard, sync=False, description='Get device clipboard')


# ============================================================
# Video Stream Routes
# ============================================================

def _register_video_routes(rpc_server):
    """Register video streaming routes"""

    async def set_quality(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Change video quality"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        quality_params = {}
        if 'max_size' in data:
            quality_params['max_size'] = data['max_size']
        if 'bit_rate' in data:
            quality_params['bit_rate'] = data['bit_rate']
        if 'max_fps' in data:
            quality_params['max_fps'] = data['max_fps']

        if not quality_params:
            return {'error': {'code': 'MISSING_QUALITY_PARAMS', 'message': 'Quality parameters required'}}

        video_service = VideoStreamService.instance()
        await video_service.set_quality(serial, quality_params)

        return {"success": True, "message": "Video quality updated", "params": quality_params}

    async def pause_stream(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Pause video stream"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        video_service = VideoStreamService.instance()
        await video_service.pause(serial)

        return {"success": True, "message": "Video stream paused"}

    async def resume_stream(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
        """Resume video stream"""
        serial = data.get('serial')
        if not serial:
            return {'error': {'code': 'MISSING_SERIAL', 'message': 'Serial number required'}}

        video_service = VideoStreamService.instance()
        await video_service.resume(serial)

        return {"success": True, "message": "Video stream resumed"}

    rpc_server.route('video.quality', set_quality, sync=False, description='Change video quality')
    rpc_server.route('video.pause', pause_stream, sync=False, description='Pause video stream')
    rpc_server.route('video.resume', resume_stream, sync=False, description='Resume video stream')


__all__ = ['register_all_routes']
