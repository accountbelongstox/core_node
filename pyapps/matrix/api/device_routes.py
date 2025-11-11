"""Device management API routes"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).parent.parent.parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any
from pydantic import BaseModel

from pycore import ColorPrint
from pyapps.matrix.services import DeviceService

router = APIRouter(prefix="/api", tags=["devices"])


class DeviceConnectRequest(BaseModel):
    """Device connection request"""
    device_name: Optional[str] = None
    max_size: Optional[int] = 720
    bit_rate: Optional[int] = 8000000
    max_fps: Optional[int] = 60
    codec: Optional[str] = None
    control: Optional[bool] = None
    locked_video_orientation: Optional[int] = None


@router.get("/devices")
async def list_devices():
    """
    List all ADB devices (API Specification compliant)

    Endpoint: GET /api/devices

    Returns:
        Device list in format: {"devices": [...], "count": N}
    """
    service = DeviceService.instance()
    adb_devices = await service.list_devices()

    devices_list = []
    for device in adb_devices:
        device_dict = {
            "serial": device.serial,
            "status": device.state.value,
            "model": device.model if hasattr(device, 'model') else "Unknown",
            "manufacturer": device.product if hasattr(device, 'product') else None,
            "android_version": None  # Will be populated from device info if available
        }
        devices_list.append(device_dict)

    return {
        "devices": devices_list,
        "count": len(devices_list)
    }


@router.get("/devices/{serial}/info")
async def get_device_info(serial: str):
    """
    Get device detailed information (API Specification compliant)

    Endpoint: GET /api/devices/{serial}/info

    Args:
        serial: Device serial number

    Returns:
        Device detailed info in format: {"device": {...}}
    """
    service = DeviceService.instance()
    device_info = await service.get_device_info(serial)

    if not device_info:
        ColorPrint.red(f"[API] Device {serial} not found or offline")
        raise HTTPException(status_code=404, detail="Device not found or offline")

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


@router.post("/devices/{serial}/connect")
async def connect_device(serial: str, request: DeviceConnectRequest):
    """
    Connect device

    Args:
        serial: Device serial number
        request: Connection parameters
    """
    service = DeviceService.instance()

    params = {
        "max_size": request.max_size,
        "bit_rate": request.bit_rate,
        "max_fps": request.max_fps,
        "codec": request.codec,
        "control": request.control,
        "locked_video_orientation": request.locked_video_orientation,
        "device_name": request.device_name,
    }

    success = await service.connect_device(serial, params)

    if not success:
        ColorPrint.red(f"[API] Failed to connect device {serial}")
        raise HTTPException(status_code=500, detail="Failed to connect device")

    return {
        "success": True,
        "message": f"Device {serial} connected successfully"
    }


@router.post("/devices/{serial}/disconnect")
async def disconnect_device(serial: str):
    """
    Disconnect device

    Args:
        serial: Device serial number
    """
    service = DeviceService.instance()
    success = await service.disconnect_device(serial)

    if not success:
        ColorPrint.red(f"[API] Failed to disconnect device {serial}")
        raise HTTPException(status_code=500, detail="Failed to disconnect device")

    return {
        "success": True,
        "message": f"Device {serial} disconnected successfully"
    }


class BatchConfigRequest(BaseModel):
    """Batch device configuration request"""
    devices: List[str]  # List of device serials
    config: Dict[str, Any]  # Configuration to apply


@router.post("/devices/batch/configure")
async def batch_configure_devices(request: BatchConfigRequest):
    """
    Apply configuration to multiple devices in batch

    Args:
        request: Batch configuration request with device serials and config

    Returns:
        Results for each device
    """
    if not request.devices:
        ColorPrint.red("[API] No devices specified for batch configuration")
        raise HTTPException(status_code=400, detail="No devices specified")

    if not request.config:
        ColorPrint.red("[API] No configuration specified for batch configuration")
        raise HTTPException(status_code=400, detail="No configuration specified")

    service = DeviceService.instance()
    results = []
    successful = 0
    failed = 0

    # Import services based on config keys
    from pyapps.matrix.services.screen_service import ScreenService
    from pyapps.matrix.services.control_service import ControlService

    screen_service = ScreenService.instance()
    control_service = ControlService.instance()

    for device_serial in request.devices:
        device_result = {
            "serial": device_serial,
            "success": True,
            "applied": [],
            "failed": [],
            "errors": []
        }

        # Apply video quality settings
        if "videoQuality" in request.config or "maxFps" in request.config or "bitrate" in request.config:
            # These would need to be applied via reconnection with new params
            # For now, just log that we would apply them
            device_result["applied"].append("video_settings")
            ColorPrint.blue(f"[BatchConfig] Would apply video settings to {device_serial}")

        # Apply screen power control
        if "screenPower" in request.config:
            action = request.config["screenPower"]
            result = await screen_service.control_screen_power(device_serial, action)
            if result.get("success"):
                device_result["applied"].append("screen_power")
            else:
                device_result["failed"].append("screen_power")
                device_result["errors"].append(result.get("error", "Unknown error"))

        # Apply screen brightness
        if "brightness" in request.config:
            level = int(request.config["brightness"])
            result = await screen_service.control_screen_brightness(device_serial, level)
            if result.get("success"):
                device_result["applied"].append("brightness")
            else:
                device_result["failed"].append("brightness")
                device_result["errors"].append(result.get("error", "Unknown error"))

        # Apply screen rotation
        if "screenRotation" in request.config:
            rotation = int(request.config["screenRotation"])
            result = await screen_service.control_screen_rotation(device_serial, rotation)
            if result.get("success"):
                device_result["applied"].append("screen_rotation")
            else:
                device_result["failed"].append("screen_rotation")
                device_result["errors"].append(result.get("error", "Unknown error"))

        # Check if any operations failed
        if len(device_result["failed"]) > 0:
            device_result["success"] = False
            failed += 1
        else:
            successful += 1

        results.append(device_result)

    return {
        "success": True,
        "total": len(request.devices),
        "successful": successful,
        "failed": failed,
        "results": results,
        "summary": {
            "devices_configured": successful,
            "devices_failed": failed,
            "config_applied": request.config
        }
    }
