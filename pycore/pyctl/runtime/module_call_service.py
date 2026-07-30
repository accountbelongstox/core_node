# -*- coding: utf-8 -*-
"""
Module Call Service - Business logic for calling modules
"""

import traceback
from typing import Any

from pycore.pyutils.rpc_v2.module_loader import ModuleLoader
from pycore.pyctl.runtime.global_config import global_config
from pycore.pyctl.runtime.module_call_models import ModuleCallRequest, ModuleCallResponse


module_loader = ModuleLoader(global_config.pycore_root)


def call_module(request: ModuleCallRequest) -> ModuleCallResponse:
    """Call a module function and record the result."""
    try:
        result = module_loader.call_module_function(
            module_path=request.module,
            function_path=request.function,
            args=request.args,
            kwargs=request.kwargs,
            use_file_import=request.use_file_import,
        )
        global_config.add_call_history(request.module, request.function, True)
        return ModuleCallResponse(success=True, result=result)
    except Exception as error:
        global_config.add_call_history(
            request.module,
            request.function,
            False,
            str(error),
        )
        error_detail = traceback.format_exc() if global_config.debug_mode else str(error)
        return ModuleCallResponse(
            success=False,
            error=str(error),
            traceback=error_detail if global_config.debug_mode else None,
        )


__all__ = ["call_module", "module_loader"]
