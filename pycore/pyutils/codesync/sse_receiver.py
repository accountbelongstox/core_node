# -*- coding: utf-8 -*-
"""CLIENT-side lifecycle state for inbound Code Sync HTTP/SSE sessions."""

from typing import Any, Dict

from pycore.pyutils.codesync.runtime import (
    init_serialized_owner,
    log as ColorPrint,
    serialized_method,
)
from pycore.pyutils.codesync.sse_transport import code_sync_sse_broker


class SseReceiver:
    """Track the CLIENT HTTP routes that receive DEV frame sessions."""

    def __init__(self, manager: Any) -> None:
        self.m = manager
        self._running = False
        init_serialized_owner(self, "codesync.sse_receiver.state", "CodeSyncSseReceiverState")

    @serialized_method
    def start(self) -> None:
        if self._running:
            return
        self._running = True
        ColorPrint.green("[CodeSync SSE] CLIENT receiver routes ready")

    @serialized_method
    def stop(self) -> None:
        self._running = False

    @serialized_method
    def get_status(self) -> Dict[str, Any]:
        return {
            "running": self._running,
            "connected_sessions": code_sync_sse_broker.connected_sessions(),
        }


__all__ = ["SseReceiver"]
