"""File management HTTP API routes"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
from pathlib import Path

# Setup path
try:
    from .. import _path_setup
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from poly_apps.pyMatrix.services.file_service import FileService

router = APIRouter(prefix="/api/files", tags=["file-management"])


# Request models
class PushFileRequest(BaseModel):
    remotePath: str  # Remote path on device


class UninstallAPKRequest(BaseModel):
    packageName: str  # Package name to uninstall


# API Routes
@router.post("/devices/{serial}/push")
async def push_file_to_device(
    serial: str,
    file: UploadFile = File(...),
    remotePath: str = Form(...)
):
    """
    Push file to device

    Args:
        serial: Device serial number
        file: File to upload
        remotePath: Destination path on device (e.g., /sdcard/Download/file.txt)

    Returns:
        {
            "success": bool,
            "taskId": str,
            "localPath": str,
            "remotePath": str,
            "fileSize": int
        }
    """
    file_service = FileService.instance()

    try:
        # Read uploaded file
        content = await file.read()

        if len(content) == 0:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty"
            )

        # Save to temp directory
        local_path = await file_service.save_uploaded_file(
            content,
            file.filename
        )

        # Push to device
        result = await file_service.push_file(
            device_serial=serial,
            local_path=local_path,
            remote_path=remotePath
        )

        # Clean up temp file after push (success or failure)
        await file_service.cleanup_temp_file(local_path)

        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to push file to device")
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error pushing file: {str(e)}"
        )


@router.post("/devices/{serial}/apk/install")
async def install_apk_to_device(
    serial: str,
    file: UploadFile = File(...),
    reinstall: bool = Form(False)
):
    """
    Install APK to device

    Args:
        serial: Device serial number
        file: APK file to upload and install
        reinstall: Reinstall if already installed

    Returns:
        {
            "success": bool,
            "taskId": str,
            "apkPath": str,
            "output": str
        }
    """
    file_service = FileService.instance()

    try:
        # Validate file extension
        if not file.filename.lower().endswith('.apk'):
            raise HTTPException(
                status_code=400,
                detail="File must be an APK"
            )

        # Read uploaded file
        content = await file.read()

        if len(content) == 0:
            raise HTTPException(
                status_code=400,
                detail="Uploaded APK is empty"
            )

        # Save to temp directory
        apk_path = await file_service.save_uploaded_file(
            content,
            file.filename
        )

        # Install APK
        result = await file_service.install_apk(
            device_serial=serial,
            apk_path=apk_path,
            reinstall=reinstall
        )

        # Clean up temp file after install (success or failure)
        await file_service.cleanup_temp_file(apk_path)

        if not result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=result.get("error", "Failed to install APK")
            )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error installing APK: {str(e)}"
        )


@router.delete("/devices/{serial}/apk/uninstall")
async def uninstall_apk_from_device(serial: str, request: UninstallAPKRequest):
    """
    Uninstall APK from device

    Args:
        serial: Device serial number
        request: Uninstall request with package name

    Returns:
        {
            "success": bool,
            "packageName": str
        }
    """
    file_service = FileService.instance()

    result = await file_service.uninstall_apk(
        device_serial=serial,
        package_name=request.packageName
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to uninstall APK")
        )

    return result


@router.get("/devices/{serial}/packages")
async def list_installed_packages(
    serial: str,
    filter: Optional[str] = None
):
    """
    List installed packages on device

    Args:
        serial: Device serial number
        filter: Optional filter pattern (e.g., "com.example")

    Returns:
        {
            "success": bool,
            "packages": List[str],
            "count": int
        }
    """
    file_service = FileService.instance()

    result = await file_service.list_installed_packages(
        device_serial=serial,
        filter_pattern=filter
    )

    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Failed to list packages")
        )

    return result


@router.get("/transfer/{task_id}")
async def get_transfer_status(task_id: str):
    """
    Get file transfer task status

    Args:
        task_id: Task ID from push_file or install_apk response

    Returns:
        Task status information
    """
    file_service = FileService.instance()

    result = await file_service.get_transfer_status(task_id)

    if not result.get("success"):
        raise HTTPException(
            status_code=404,
            detail=result.get("error", "Task not found")
        )

    return result
