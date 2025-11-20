"""Recording and screenshot HTTP API routes"""

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

from pyapps.matrix.services.recording_service import RecordingService

router = APIRouter(prefix="/api/devices", tags=["recording"])


# Request models
class StartRecordingRequest(BaseModel):
    quality: Optional[str] = "high"  # high, medium, low
    maxDuration: Optional[int] = 1800  # 30 minutes default


class ScreenshotRequest(BaseModel):
    format: Optional[str] = "png"  # png or jpg


# API Routes
@router.post("/{serial}/recording/start")
async def start_recording(serial: str, request: StartRecordingRequest):
    """
    Start screen recording

    Args:
        serial: Device serial number
        request: Recording configuration

    Returns:
        {
            "success": bool,
            "recordingId": str,
            "startTime": str (ISO8601)
        }
    """
    recording_service = RecordingService.instance()

    result = await recording_service.start_recording(
        serial=serial,
        quality=request.quality,
        max_duration=request.maxDuration
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to start recording")
        )

    return result


@router.post("/{serial}/recording/stop")
async def stop_recording(serial: str):
    """
    Stop screen recording

    Args:
        serial: Device serial number

    Returns:
        {
            "success": bool,
            "recordingId": str,
            "duration": float (seconds),
            "fileSize": int (bytes),
            "filePath": str
        }
    """
    recording_service = RecordingService.instance()

    result = await recording_service.stop_recording(serial=serial)

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to stop recording")
        )

    return result


@router.get("/{serial}/recording/status")
async def get_recording_status(serial: str):
    """
    Get current recording status

    Args:
        serial: Device serial number

    Returns:
        {
            "isRecording": bool,
            "recordingInfo": dict (if recording)
        }
    """
    recording_service = RecordingService.instance()

    recording_info = recording_service.get_recording_status(serial)

    return {
        "success": True,
        "isRecording": recording_info is not None,
        "recordingInfo": recording_info
    }


@router.post("/{serial}/screenshot")
async def capture_screenshot(serial: str, request: ScreenshotRequest):
    """
    Capture screenshot

    Args:
        serial: Device serial number
        request: Screenshot configuration

    Returns:
        {
            "success": bool,
            "screenshotId": str,
            "filePath": str,
            "timestamp": str (ISO8601)
        }
    """
    recording_service = RecordingService.instance()

    result = await recording_service.capture_screenshot(
        serial=serial,
        format=request.format
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to capture screenshot")
        )

    return result
