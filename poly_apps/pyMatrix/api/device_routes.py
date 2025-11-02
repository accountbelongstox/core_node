"""Device management API routes"""

# Setup path
try:
    from .. import _path_setup
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel

from poly_apps.pyMatrix.services import DeviceService

router = APIRouter(prefix="/devices", tags=["devices"])


class DeviceConnectRequest(BaseModel):
    """Device connection request"""
    device_name: Optional[str] = None
    max_size: Optional[int] = 720
    bit_rate: Optional[int] = 8000000
    max_fps: Optional[int] = 60
    codec: Optional[str] = None
    control: Optional[bool] = None
    locked_video_orientation: Optional[int] = None


@router.get("/list")
async def list_devices():
    """
    List all ADB devices

    Returns:
        Device list
    """
    service = DeviceService.instance()
    devices = await service.list_devices()

    return {
        "success": True,
        "devices": [
            {
                "serial": device.serial,
                "state": device.state.value,
                "model": device.model,
                "product": device.product
            }
            for device in devices
        ]
    }


@router.get("/{serial}/info")
async def get_device_info(serial: str):
    """
    Get device detailed information

    Args:
        serial: Device serial number
    """
    service = DeviceService.instance()
    device_info = await service.get_device_info(serial)

    if not device_info:
        raise HTTPException(status_code=404, detail="Device not found or offline")

    return {
        "success": True,
        "device": {
            "serial": device_info.serial,
            "model": device_info.model,
            "resolution": {
                "width": device_info.resolution.width,
                "height": device_info.resolution.height
            },
            "dpi": device_info.dpi,
            "android_version": device_info.android_version,
            "sdk_version": device_info.sdk_version
        }
    }


@router.post("/{serial}/connect")
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
        raise HTTPException(status_code=500, detail="Failed to connect device")

    return {
        "success": True,
        "message": f"Device {serial} connected successfully"
    }


@router.post("/{serial}/disconnect")
async def disconnect_device(serial: str):
    """
    Disconnect device

    Args:
        serial: Device serial number
    """
    service = DeviceService.instance()
    success = await service.disconnect_device(serial)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to disconnect device")

    return {
        "success": True,
        "message": f"Device {serial} disconnected successfully"
    }
