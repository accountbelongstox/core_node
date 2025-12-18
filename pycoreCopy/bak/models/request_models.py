# -*- coding: utf-8 -*-
"""
Request Models
"""

from typing import Any, Optional
from pydantic import BaseModel, Field


class ModuleCallRequest(BaseModel):
    """Request model for module calling"""
    module: str = Field(..., description="Module path (e.g., 'pycore.pyutils.ocr.ocr_manager')")
    function: str = Field(..., description="Function path (e.g., 'ocr_manager.get_available_models')")
    args: list = Field(default_factory=list, description="Positional arguments")
    kwargs: dict = Field(default_factory=dict, description="Keyword arguments")
    use_file_import: bool = Field(default=False, description="Use file import instead of standard import")

    class Config:
        json_schema_extra = {
            "example": {
                "module": "pycore.pyutils.ocr.ocr_manager",
                "function": "ocr_manager.get_available_models",
                "args": [],
                "kwargs": {},
                "use_file_import": False
            }
        }


class ModuleCallResponse(BaseModel):
    """Response model for module calling"""
    success: bool
    result: Optional[Any] = None
    error: Optional[str] = None
    traceback: Optional[str] = None
