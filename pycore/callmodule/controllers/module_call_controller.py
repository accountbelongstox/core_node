# -*- coding: utf-8 -*-
"""
Module Call Controller - Handle module calling requests
"""

from fastapi import HTTPException

from ..global_config import get_global_config
from ..models.request_models import ModuleCallRequest, ModuleCallResponse
from ..models.response_models import HistoryResponse
from ..services import ModuleCallService


class ModuleCallController:
    """Controller for module calling endpoints"""

    def __init__(self):
        self.config = get_global_config()
        self.service = ModuleCallService()

    def call_module(self, request: ModuleCallRequest) -> ModuleCallResponse:
        """
        Call a module function.

        Args:
            request: ModuleCallRequest with module, function, args, kwargs

        Returns:
            ModuleCallResponse with success status and result/error

        Raises:
            HTTPException: If API is disabled
        """
        # Check if API is enabled
        if not self.config.api_enabled:
            raise HTTPException(
                status_code=403,
                detail="API is currently disabled"
            )

        return self.service.call_module(request)

    def get_history(self) -> HistoryResponse:
        """Get call history"""
        return HistoryResponse(
            success=True,
            history=self.service.get_call_history()
        )
