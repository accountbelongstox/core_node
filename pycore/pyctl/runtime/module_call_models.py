# -*- coding: utf-8 -*-
"""
Module-call request and response models.
"""

from typing import Any, Optional
from pycore.pyfoundations.third_party.api import get_third_package_pydantic

pydantic = get_third_package_pydantic()
BaseModel = pydantic.BaseModel
Field = pydantic.Field


class ModuleCallRequest(BaseModel):
    """Request model for module calling"""
    module: str = Field(..., description="Module path (e.g., 'pycore.pyutils.common.ocr.manager')")
    function: str = Field(..., description="Function path (e.g., 'ocr_manager.get_available_models')")
    args: list = Field(default_factory=list, description="Positional arguments")
    kwargs: dict = Field(default_factory=dict, description="Keyword arguments")
    use_file_import: bool = Field(default=False, description="Use file import instead of standard import")

    class Config:
        json_schema_extra = {
            "example": {
                "module": "pycore.pyutils.common.ocr.manager",
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
