# -*- coding: utf-8 -*-
"""
Module Call Router - Module calling API routes
"""

from pycore.pyfoundations.third_party import get_third_package_fastapi

fastapi = get_third_package_fastapi()

from ..controllers import ModuleCallController
from ..models.request_models import ModuleCallRequest, ModuleCallResponse
from ..models.response_models import HistoryResponse

APIRouter = fastapi.APIRouter
module_call_router = APIRouter(prefix="/api", tags=["Module Call"])

# Initialize controller
module_call_controller = ModuleCallController()


@module_call_router.post("/call", response_model=ModuleCallResponse)
async def call_module(request: ModuleCallRequest):
    """
    Call a pycore module function.

    Args:
        request: ModuleCallRequest with module path, function, args, kwargs

    Returns:
        ModuleCallResponse: Result or error from the function call

    Example:
        ```json
        {
            "module": "pycore.pyutils.ocr.ocr_manager",
            "function": "ocr_manager.get_available_models",
            "args": [],
            "kwargs": {},
            "use_file_import": false
        }
        ```
    """
    return module_call_controller.call_module(request)


@module_call_router.get("/history", response_model=HistoryResponse)
async def get_history():
    """
    Get module call history.

    Returns:
        HistoryResponse: List of recent module calls with status
    """
    return module_call_controller.get_history()
