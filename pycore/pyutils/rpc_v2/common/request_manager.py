#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Request manager for rpc_v2.
"""

import time
import uuid
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.rpc_v2.constants import (
    DEFAULT_ACK_MAX_RETRIES,
    DEFAULT_ACK_RETRY_INTERVAL,
    REQUEST_MANAGER_MAX_SIZE,
)
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)


class RequestManager:
    def __init__(self):
        self.requests: Dict[str, Dict[str, Any]] = {}
        self.callbacks: Dict[str, Dict[str, Any]] = {}
        init_serialized_owner(
            self,
            'pyutils.rpc_v2.request_manager',
            'RPCRequestManagerThread',
        )

    @serialized_method
    def create_request(self, session_id: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        request_id = str(uuid.uuid4())
        self.requests[request_id] = {
            "id": request_id,
            "session_id": session_id,
            "created_at": time.time(),
            "status": "pending",
            "retries": 0,
            "max_retries": DEFAULT_ACK_MAX_RETRIES,
            "retry_interval": DEFAULT_ACK_RETRY_INTERVAL,
            "metadata": metadata or {},
        }
        return request_id

    @serialized_method
    def get_request(self, request_id: str) -> Optional[Dict[str, Any]]:
        request = self.requests.get(request_id)
        return dict(request) if request else None

    @serialized_method
    def update_request_status(self, request_id: str, status: str):
        request = self.requests.get(request_id)
        if request:
            request["status"] = status
            request["updated_at"] = time.time()

    @serialized_method
    def increment_retry(self, request_id: str) -> int:
        request = self.requests.get(request_id)
        if request:
            request["retries"] += 1
            return request["retries"]
        return 0

    @serialized_method
    def can_retry(self, request_id: str) -> bool:
        request = self.requests.get(request_id)
        return bool(request and request["retries"] < request["max_retries"])

    @serialized_method
    def register_callback(self, request_id: str, callback: Callable, context: Optional[Any] = None) -> bool:
        if not callable(callback):
            ColorPrint.red("[RequestManager] Callback must be callable")
            return False
        self.callbacks[request_id] = {"callback": callback, "context": context, "created_at": time.time()}
        return True

    @serialized_method
    def _get_callback_info(self, request_id: str) -> Optional[Dict[str, Any]]:
        """Return a detached callback record."""
        callback_info = self.callbacks.get(request_id)
        return dict(callback_info) if callback_info else None

    @serialized_method
    def _finish_callback(self, request_id: str) -> None:
        """Finalize one callback on the state-owner thread."""
        self.update_request_status(request_id, "completed")
        self.callbacks.pop(request_id, None)

    async def execute_callback(self, request_id: str, data: Any, error: Optional[Exception] = None) -> bool:
        callback_info = self._get_callback_info(request_id)
        if not callback_info:
            ColorPrint.yellow(f"[RequestManager] No callback found for request {request_id}")
            return False

        callback = callback_info["callback"]
        context = callback_info.get("context")
        try:
            if context:
                if error:
                    await callback(context, data, error)
                else:
                    await callback(context, data)
            else:
                if error:
                    await callback(data, error)
                else:
                    await callback(data)

            self._finish_callback(request_id)
            return True
        except Exception as exc:
            ColorPrint.red(f"[RequestManager] Callback execution error for {request_id}: {exc}")
            return False

    @serialized_method
    def remove_request(self, request_id: str):
        self.requests.pop(request_id, None)
        self.callbacks.pop(request_id, None)

    @serialized_method
    def get_requests_by_session(self, session_id: str) -> List[str]:
        return [rid for rid, req in self.requests.items() if req["session_id"] == session_id]

    @serialized_method
    def cleanup(self, max_age: float = 3600.0) -> int:
        now = time.time()
        expired = [
            rid
            for rid, req in self.requests.items()
            if now - req.get("created_at", now) > max_age and req.get("status") != "completed"
        ]
        for request_id in expired:
            self.remove_request(request_id)
        return len(expired)


default_request_manager = RequestManager()

__all__ = ["RequestManager", "default_request_manager"]
