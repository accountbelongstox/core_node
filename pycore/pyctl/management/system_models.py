# -*- coding: utf-8 -*-
"""
System Management Models
"""

from typing import Any, Dict, Optional
from pycore.pyfoundations.third_party.api import get_third_package_pydantic


pydantic = get_third_package_pydantic()
BaseModel = pydantic.BaseModel
Field = pydantic.Field


# ========== System Configuration ==========

class SystemConfig(BaseModel):
    """System configuration model"""
    system: Dict[str, Any] = Field(..., description="System-level configuration")
    local_processing: Optional[Dict[str, Any]] = Field(None, description="Local processing configuration")

    class Config:
        json_schema_extra = {
            "example": {
                "system": {
                    "debug": False,
                    "log_level": "INFO",
                    "max_connections": 100
                },
                "local_processing": {
                    "enabled": True,
                    "auto_upload": True
                }
            }
        }
