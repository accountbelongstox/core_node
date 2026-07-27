# -*- coding: utf-8 -*-
"""
AI Chat RPC Routes

WebSocket RPC handlers for the unified AI gateway.
"""

from pycore import ColorPrint
from pycore.pyctl.ai import chat_once, generate_text, gateway_status
from pycore.pyctl.ai.ai_rate_limits import rate_status
from pycore.pyctl.ai.ai_usage_log import usage_log
from pycore.callmodule.rpc_routes.route_names import (
    LOCAL_AI_CHAT,
    UI_AI_BALANCE,
    UI_AI_RATE_LIMITS,
    UI_AI_USAGE,
)

def register_local_ai_chat_routes(server):
    """Register the AI chat WS RPC handlers."""

    async def chat(params, request_id, context):
        params = params or {}
        messages = params.get("messages")
        message = params.get("message")
        
        msgs = [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in messages] if messages else []
        if not msgs and message:
            msgs = [{"role": "user", "content": message}]

        provider = (params.get("provider") or "").strip().lower()
        model = params.get("model")
        source = params.get("source") or "chat"

        try:
            if not provider or provider == "auto":
                res = generate_text(messages=msgs, model=model, source=source)
            else:
                res = chat_once(provider, msgs, model, source=source)
            return {"success": True, "data": res}
        except Exception as exc:
            return {"success": False, "errors": [str(exc)]}

    async def gateway(params, request_id, context):
        try:
            res = gateway_status()
            return {"success": True, "data": res}
        except Exception as exc:
            return {"success": False, "errors": [str(exc)]}

    async def rate_limits(params, request_id, context):
        params = params or {}
        try:
            res = rate_status(params.get("provider"))
            return {"success": True, "data": res}
        except Exception as exc:
            return {"success": False, "errors": [str(exc)]}

    async def usage(params, request_id, context):
        params = params or {}
        try:
            res = usage_log(params.get("limit", 100), params.get("kind"))
            return {"success": True, "data": res}
        except Exception as exc:
            return {"success": False, "errors": [str(exc)]}

    server.route(name=LOCAL_AI_CHAT, handler=chat, sync=False)
    server.route(name=UI_AI_BALANCE, handler=gateway, sync=False)
    server.route(name=UI_AI_RATE_LIMITS, handler=rate_limits, sync=False)
    server.route(name=UI_AI_USAGE, handler=usage, sync=False)

    ColorPrint.green("[ConfigBuilder] Registered local AI chat RPC routes")

__all__ = ["register_local_ai_chat_routes"]
