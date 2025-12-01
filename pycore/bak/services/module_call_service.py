# -*- coding: utf-8 -*-
"""
Module Call Service - Business logic for calling modules
"""

import traceback
from typing import Any

from ..core.module_loader import ModuleLoader
from ..global_config import get_global_config
from ..models.request_models import ModuleCallRequest, ModuleCallResponse


class ModuleCallService:
    """Service for handling module calls"""

    def __init__(self):
        self.loader = ModuleLoader()
        self.config = get_global_config()

    def call_module(self, request: ModuleCallRequest) -> ModuleCallResponse:
        """
        Call a module function with the given request.

        Args:
            request: ModuleCallRequest with module, function, args, kwargs

        Returns:
            ModuleCallResponse with success status and result/error
        """
        try:
            # Call the module function
            result = self.loader.call_module_function(
                module_path=request.module,
                function_path=request.function,
                args=request.args,
                kwargs=request.kwargs,
                use_file_import=request.use_file_import
            )

            # Log success
            self.config.add_call_history(request.module, request.function, True)

            return ModuleCallResponse(
                success=True,
                result=result
            )

        except Exception as e:
            # Log failure
            self.config.add_call_history(request.module, request.function, False, str(e))

            error_detail = traceback.format_exc() if self.config.debug_mode else str(e)

            return ModuleCallResponse(
                success=False,
                error=str(e),
                traceback=error_detail if self.config.debug_mode else None
            )

    def get_call_history(self) -> list:
        """Get call history"""
        return self.config.call_history

    def get_status(self) -> dict:
        """Get service status"""
        return self.config.get_status()
