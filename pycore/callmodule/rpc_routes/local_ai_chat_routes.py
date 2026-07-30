# -*- coding: utf-8 -*-
"""Register AI chat controllers on RPC v2."""

from pycore.callmodule.rpc_routes.route_names import LOCAL_AI_CHAT
from pycore.pyctl.ai.ai_chat import chat_once
from pycore.pyctl.ai.ai_gateway import generate_text
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


def register_local_ai_chat_routes(server) -> None:
    """Register the AI chat controller."""

    def chat_handler(params, _request_id, _context):
        request = params or {}
        messages = [
            {
                "role": item.get("role", "user"),
                "content": item.get("content", ""),
            }
            for item in request.get("messages") or []
        ]
        if not messages and request.get("message"):
            messages = [{"role": "user", "content": request["message"]}]
        provider = str(request.get("provider") or "").strip().lower()
        model = request.get("model")
        source = request.get("source") or "chat"
        if not provider or provider == "auto":
            result = generate_text(messages=messages, model=model, source=source)
        else:
            result = chat_once(provider, messages, model, source=source)
        return {"success": True, "data": result}

    server.route(name=LOCAL_AI_CHAT, handler=chat_handler)
    ColorPrint.green("[ConfigBuilder] Registered local AI chat RPC route")

