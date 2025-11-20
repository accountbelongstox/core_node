#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Request manager for rpc_v2.
"""

import threading
import time
import uuid
from typing import Any, Callable, Dict, List, Optional

from pycore import ColorPrint
from pycore.pyutils.rpc_v2.constants import (
    DEFAULT_ACK_MAX_RETRIES,
    DEFAULT_ACK_RETRY_INTERVAL,
    REQUEST_MANAGER_MAX_SIZE,
)


class RequestManager:
    def __init__(self):
        self.requests: Dict[str, Dict[str, Any]] = {}
        self.callbacks: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()

    def create_request(self, session_id: str, metadata: Optional[Dict[str, Any]] = None) -> str:
        with self._lock:
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

    def get_request(self, request_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self.requests.get(request_id)

    def update_request_status(self, request_id: str, status: str):
        with self._lock:
            request = self.requests.get(request_id)
            if request:
                request["status"] = status
                request["updated_at"] = time.time()

    def increment_retry(self, request_id: str) -> int:
        with self._lock:
            request = self.requests.get(request_id)
            if request:
                request["retries"] += 1
                return request["retries"]
            return 0

    def can_retry(self, request_id: str) -> bool:
        with self._lock:
            request = self.requests.get(request_id)
            return bool(request and request["retries"] < request["max_retries"])

    def register_callback(self, request_id: str, callback: Callable, context: Optional[Any] = None) -> bool:
        with self._lock:
            if not callable(callback):
                ColorPrint.red("[RequestManager] Callback must be callable")
                return False
            self.callbacks[request_id] = {"callback": callback, "context": context, "created_at": time.time()}
            return True

    async def execute_callback(self, request_id: str, data: Any, error: Optional[Exception] = None) -> bool:
        with self._lock:
            callback_info = self.callbacks.get(request_id)
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

            with self._lock:
                self.update_request_status(request_id, "completed")
                self.callbacks.pop(request_id, None)
            return True
        except Exception as exc:
            ColorPrint.red(f"[RequestManager] Callback execution error for {request_id}: {exc}")
            return False

    def remove_request(self, request_id: str):
        with self._lock:
            self.requests.pop(request_id, None)
            self.callbacks.pop(request_id, None)

    def get_requests_by_session(self, session_id: str) -> List[str]:
        with self._lock:
            return [rid for rid, req in self.requests.items() if req["session_id"] == session_id]

    def cleanup(self, max_age: float = 3600.0) -> int:
        with self._lock:
            now = time.time()
            expired = [
                rid
                for rid, req in self.requests.items()
                if now - req.get("created_at", now) > max_age and req.get("status") != "completed"
            ]
            for rid in expired:
                self.remove_request(rid)
            return len(expired)


default_request_manager = RequestManager()

__all__ = ["RequestManager", "default_request_manager"]
