# -*- coding: utf-8 -*-
"""
RPC Routes for ocr_status
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_OCR_STATUS_STATUS,
    UI_OCR_STATUS_TEST
)

def register_local_ocr_status_routes(server):
    """Register WS RPC handlers."""
    
    async def status_handler(params, request_id, context):
        # TODO: Implement native RPC handler for status
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_OCR_STATUS_STATUS, handler=status_handler, sync=False)

    async def test_handler(params, request_id, context):
        # TODO: Implement native RPC handler for test
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_OCR_STATUS_TEST, handler=test_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered ocr_status RPC routes")

__all__ = ["register_local_ocr_status_routes"]
