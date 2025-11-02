"""Group batch operations HTTP API routes"""

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

from poly_apps.pyMatrix.services.group_service import GroupService

router = APIRouter(prefix="/api/groups", tags=["group-batch"])


# Request models
class BatchScreenshotRequest(BaseModel):
    format: Optional[str] = "png"  # png or jpg


class BatchRecordingStartRequest(BaseModel):
    quality: Optional[str] = "high"  # high, medium, low
    maxDuration: Optional[int] = 1800  # 30 minutes default


class BatchSystemKeyRequest(BaseModel):
    action: str  # home, back, recent, power, volume_up, volume_down


class BatchScreenControlRequest(BaseModel):
    controlType: str  # power, brightness, rotation
    params: dict  # Control parameters


# API Routes
@router.post("/{group_id}/batch/screenshot")
async def batch_screenshot(group_id: str, request: BatchScreenshotRequest):
    """
    Capture screenshots for all devices in a group

    Args:
        group_id: Group ID
        request: Screenshot configuration

    Returns:
        {
            "success": bool,
            "groupId": str,
            "totalDevices": int,
            "successful": int,
            "failed": int,
            "results": List[Dict]
        }
    """
    group_service = GroupService.instance()

    result = await group_service.batch_screenshot(
        group_id=group_id,
        format=request.format
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to batch screenshot")
        )

    return result


@router.post("/{group_id}/batch/recording/start")
async def batch_start_recording(group_id: str, request: BatchRecordingStartRequest):
    """
    Start recording for all devices in a group

    Args:
        group_id: Group ID
        request: Recording configuration

    Returns:
        {
            "success": bool,
            "groupId": str,
            "totalDevices": int,
            "successful": int,
            "failed": int,
            "results": List[Dict]
        }
    """
    group_service = GroupService.instance()

    result = await group_service.batch_start_recording(
        group_id=group_id,
        quality=request.quality,
        max_duration=request.maxDuration
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to batch start recording")
        )

    return result


@router.post("/{group_id}/batch/recording/stop")
async def batch_stop_recording(group_id: str):
    """
    Stop recording for all devices in a group

    Args:
        group_id: Group ID

    Returns:
        {
            "success": bool,
            "groupId": str,
            "totalDevices": int,
            "successful": int,
            "failed": int,
            "results": List[Dict]
        }
    """
    group_service = GroupService.instance()

    result = await group_service.batch_stop_recording(group_id=group_id)

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to batch stop recording")
        )

    return result


@router.post("/{group_id}/batch/systemkey")
async def batch_system_key(group_id: str, request: BatchSystemKeyRequest):
    """
    Send system key event to all devices in a group

    Args:
        group_id: Group ID
        request: System key action

    Returns:
        {
            "success": bool,
            "groupId": str,
            "action": str,
            "totalDevices": int,
            "successful": int,
            "failed": int
        }
    """
    # Validate action
    valid_actions = ['home', 'back', 'recent', 'power', 'volume_up', 'volume_down']
    if request.action not in valid_actions:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid action. Must be one of: {', '.join(valid_actions)}"
        )

    group_service = GroupService.instance()

    result = await group_service.batch_system_key(
        group_id=group_id,
        action=request.action
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to batch system key")
        )

    return result


@router.post("/{group_id}/batch/screen-control")
async def batch_screen_control(group_id: str, request: BatchScreenControlRequest):
    """
    Batch screen control for all devices in a group

    Args:
        group_id: Group ID
        request: Screen control configuration

    Returns:
        {
            "success": bool,
            "groupId": str,
            "controlType": str,
            "totalDevices": int,
            "successful": int,
            "failed": int
        }
    """
    # Validate control type
    valid_types = ['power', 'brightness', 'rotation']
    if request.controlType not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid control type. Must be one of: {', '.join(valid_types)}"
        )

    # Validate params based on control type
    if request.controlType == "power":
        if "action" not in request.params:
            raise HTTPException(
                status_code=400,
                detail="Missing 'action' parameter for power control"
            )
        if request.params["action"] not in ["on", "off", "toggle"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid power action. Must be 'on', 'off', or 'toggle'"
            )
    elif request.controlType == "brightness":
        if "level" not in request.params:
            raise HTTPException(
                status_code=400,
                detail="Missing 'level' parameter for brightness control"
            )
        if not 0 <= request.params["level"] <= 255:
            raise HTTPException(
                status_code=400,
                detail="Brightness level must be between 0 and 255"
            )
    elif request.controlType == "rotation":
        if "rotation" not in request.params:
            raise HTTPException(
                status_code=400,
                detail="Missing 'rotation' parameter for rotation control"
            )
        if request.params["rotation"] not in [0, 90, 180, 270]:
            raise HTTPException(
                status_code=400,
                detail="Rotation must be 0, 90, 180, or 270 degrees"
            )

    group_service = GroupService.instance()

    result = await group_service.batch_screen_control(
        group_id=group_id,
        control_type=request.controlType,
        params=request.params
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to batch screen control")
        )

    return result
