"""Configuration management routes"""

# Setup path
try:
    from .. import _path_setup  # noqa: F401
except ImportError:
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from pyapps.matrix.services import ConfigService

router = APIRouter(prefix="/config", tags=["config"])


class ConfigPayload(BaseModel):
    max_size: Optional[int] = Field(default=None, ge=120, le=4320)
    bit_rate: Optional[int] = Field(default=None, ge=100000, le=20000000)
    max_fps: Optional[int] = Field(default=None, ge=1, le=120)
    codec: Optional[str] = Field(default=None, pattern="^(h264|h265|av1)$")
    control: Optional[bool] = None
    locked_video_orientation: Optional[int] = Field(default=None, ge=-1, le=3)


@router.get("")
async def get_full_config():
    service = ConfigService.instance()
    config = await service.get_config()
    return {
        "success": True,
        "config": config,
    }


@router.get("/global")
async def get_global_config():
    service = ConfigService.instance()
    global_config = await service.get_global()
    return {
        "success": True,
        "config": global_config,
    }


@router.patch("/global")
async def update_global_config(payload: ConfigPayload):
    service = ConfigService.instance()
    updated = await service.update_global(payload.dict(exclude_unset=True))
    return {
        "success": True,
        "config": updated,
    }


@router.get("/device/{device_name}")
async def get_device_config(device_name: str):
    service = ConfigService.instance()
    config = await service.get_device_config(device_name)
    if config is None:
        raise HTTPException(status_code=404, detail="Device configuration not found")
    return {
        "success": True,
        "device": device_name,
        "config": config,
    }


@router.patch("/device/{device_name}")
async def update_device_config(device_name: str, payload: ConfigPayload):
    service = ConfigService.instance()
    updated = await service.update_device_config(device_name, payload.dict(exclude_unset=True))
    return {
        "success": True,
        "device": device_name,
        "config": updated,
    }


@router.delete("/device/{device_name}")
async def delete_device_config(device_name: str):
    service = ConfigService.instance()
    removed = await service.delete_device_config(device_name)
    if not removed:
        raise HTTPException(status_code=404, detail="Device configuration not found")
    return {
        "success": True,
        "device": device_name,
    }
