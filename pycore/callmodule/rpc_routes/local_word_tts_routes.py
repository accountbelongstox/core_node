# -*- coding: utf-8 -*-
"""
RPC Routes for word_tts
"""

from pycore import ColorPrint
from pycore.callmodule.rpc_routes.route_names import (
    UI_WORD_TTS_STATUS,
    UI_WORD_TTS_CONFIG,
    UI_WORD_TTS_RUN_ONCE
)

def register_local_word_tts_routes(server):
    """Register WS RPC handlers."""
    
    async def status_handler(params, request_id, context):
        # TODO: Implement native RPC handler for status
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_WORD_TTS_STATUS, handler=status_handler, sync=False)

    async def config_handler(params, request_id, context):
        # TODO: Implement native RPC handler for config
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_WORD_TTS_CONFIG, handler=config_handler, sync=False)

    async def run_once_handler(params, request_id, context):
        # TODO: Implement native RPC handler for run_once
        return {"success": False, "error": "Not implemented yet"}
        
    server.route(name=UI_WORD_TTS_RUN_ONCE, handler=run_once_handler, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered word_tts RPC routes")

__all__ = ["register_local_word_tts_routes"]
