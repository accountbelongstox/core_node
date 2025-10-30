"""设备管理 API 路由"""

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
    """设备连接请求"""
    max_size: Optional[int] = 720
    bit_rate: Optional[int] = 8000000
    max_fps: Optional[int] = 60


@router.get("/list")
async def list_devices():
    """
    列出所有 ADB 设备

    Returns:
        设备列表
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
    获取设备详细信息

    Args:
        serial: 设备序列号
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
    连接设备

    Args:
        serial: 设备序列号
        request: 连接参数
    """
    service = DeviceService.instance()

    params = {
        "max_size": request.max_size,
        "bit_rate": request.bit_rate,
        "max_fps": request.max_fps
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
    断开设备

    Args:
        serial: 设备序列号
    """
    service = DeviceService.instance()
    success = await service.disconnect_device(serial)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to disconnect device")

    return {
        "success": True,
        "message": f"Device {serial} disconnected successfully"
    }
