# -*- coding: utf-8 -*-
"""Register AI chat controllers on HTTP API."""

import time

from pycore.callmodule.rpc_routes.route_names import LOCAL_AI_CHAT
from pycore.pyctl.ai.ai_chat import chat_once
from pycore.pyctl.ai.ai_gateway import generate_text
from pycore.pyctl.ai_hub.test_record import record_result
from pycore.pyutils.common.model_manifest import CATEGORY_AI_TEXT

TEST_POPUP_SOURCE = "test-popup"
AUTO_PROVIDER = "auto"


def register_local_ai_chat_routes(server) -> None:
    """Register the AI chat controller."""

    def chat_handler(params, _request_id, _context):
        request = params
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
        started_at = time.time()
        if not provider or provider == AUTO_PROVIDER:
            result = generate_text(messages=messages, model=model, source=source)
        else:
            result = chat_once(provider, messages, model, source=source)
        if source == TEST_POPUP_SOURCE:
            record_result(
                CATEGORY_AI_TEXT,
                provider or AUTO_PROVIDER,
                {"provider": provider or AUTO_PROVIDER, "model": model, "text": messages[-1]["content"] if messages else ""},
                result,
                round((time.time() - started_at) * 1000),
                started_at,
            )
        return {"success": True, "data": result}

    server.post(path=LOCAL_AI_CHAT, handler=chat_handler)

