"""Screen control HTTP API routes"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

# Setup path
try:
    from .. import _path_setup
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from poly_apps.pyMatrix.services.screen_service import ScreenService

router = APIRouter(prefix="/api/devices", tags=["screen"])


# Request models
class ScreenPowerRequest(BaseModel):
    action: str  # "on", "off", "toggle"


class ScreenBrightnessRequest(BaseModel):
    level: int  # 0-255


class ScreenRotationRequest(BaseModel):
    rotation: int  # 0, 90, 180, 270


# API Routes
@router.post("/{serial}/screen/power")
async def control_screen_power(serial: str, request: ScreenPowerRequest):
    """
    Control screen power

    Args:
        serial: Device serial number
        request: Power control action

    Returns:
        {
            "success": bool,
            "state": str ("on" or "off")
        }
    """
    if request.action not in ["on", "off", "toggle"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid action. Must be 'on', 'off', or 'toggle'"
        )

    screen_service = ScreenService.instance()

    result = await screen_service.control_screen_power(
        serial=serial,
        action=request.action
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to control screen power")
        )

    return result


@router.post("/{serial}/screen/brightness")
async def control_screen_brightness(serial: str, request: ScreenBrightnessRequest):
    """
    Control screen brightness

    Args:
        serial: Device serial number
        request: Brightness level (0-255)

    Returns:
        {
            "success": bool,
            "level": int (current brightness)
        }
    """
    if not 0 <= request.level <= 255:
        raise HTTPException(
            status_code=400,
            detail="Brightness level must be between 0 and 255"
        )

    screen_service = ScreenService.instance()

    result = await screen_service.control_screen_brightness(
        serial=serial,
        level=request.level
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to control screen brightness")
        )

    return result


@router.get("/{serial}/screen/brightness")
async def get_screen_brightness(serial: str):
    """
    Get current screen brightness

    Args:
        serial: Device serial number

    Returns:
        {
            "success": bool,
            "level": int (0-255)
        }
    """
    screen_service = ScreenService.instance()

    result = await screen_service.get_screen_brightness(serial=serial)

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to get screen brightness")
        )

    return result


@router.post("/{serial}/screen/rotation")
async def control_screen_rotation(serial: str, request: ScreenRotationRequest):
    """
    Control screen rotation

    Args:
        serial: Device serial number
        request: Rotation in degrees (0, 90, 180, 270)

    Returns:
        {
            "success": bool,
            "rotation": int (current rotation in degrees)
        }
    """
    if request.rotation not in [0, 90, 180, 270]:
        raise HTTPException(
            status_code=400,
            detail="Rotation must be 0, 90, 180, or 270 degrees"
        )

    screen_service = ScreenService.instance()

    result = await screen_service.control_screen_rotation(
        serial=serial,
        rotation=request.rotation
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to control screen rotation")
        )

    return result


@router.get("/{serial}/screen/rotation")
async def get_screen_rotation(serial: str):
    """
    Get current screen rotation

    Args:
        serial: Device serial number

    Returns:
        {
            "success": bool,
            "rotation": int (degrees: 0, 90, 180, 270)
        }
    """
    screen_service = ScreenService.instance()

    result = await screen_service.get_screen_rotation(serial=serial)

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to get screen rotation")
        )

    return result


@router.post("/{serial}/screen/auto-rotation/enable")
async def enable_auto_rotation(serial: str):
    """
    Enable automatic screen rotation

    Args:
        serial: Device serial number

    Returns:
        {
            "success": bool
        }
    """
    screen_service = ScreenService.instance()

    result = await screen_service.enable_auto_rotation(serial=serial)

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to enable auto-rotation")
        )

    return result


@router.post("/{serial}/screen/auto-rotation/disable")
async def disable_auto_rotation(serial: str):
    """
    Disable automatic screen rotation

    Args:
        serial: Device serial number

    Returns:
        {
            "success": bool
        }
    """
    screen_service = ScreenService.instance()

    result = await screen_service.disable_auto_rotation(serial=serial)

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to disable auto-rotation")
        )

    return result
