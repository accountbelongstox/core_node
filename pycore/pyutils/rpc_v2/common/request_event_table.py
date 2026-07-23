#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Request event table for RPC v2.
"""

import time
from dataclasses import dataclass, field, replace
from enum import Enum
from typing import Any, Dict, List, Optional

from pycore import ColorPrint
from pycore.pyutils.rpc_v2.constants import (
    REQUEST_EVENT_MAX_SIZE,
    REQUEST_EVENT_TTL,
    DEFAULT_ACK_MAX_RETRIES,
    DEFAULT_ACK_RETRY_INTERVAL,
)
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)


class RequestStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    NOTIFIED = "notified"
    ACK_PENDING = "ack_pending"
    ACK_RECEIVED = "ack_received"
    STORED = "stored"


@dataclass
class RequestEvent:
    request_id: str
    route: str
    params: Dict[str, Any]
    client_id: Optional[str] = None
    client_type: str = "unknown"
    status: RequestStatus = RequestStatus.PENDING
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    result: Optional[Any] = None
    error: Optional[str] = None
    retry_count: int = 0
    max_retries: int = DEFAULT_ACK_MAX_RETRIES
    retry_interval: float = DEFAULT_ACK_RETRY_INTERVAL
    last_notify_attempt: Optional[float] = None
    notify_attempts: int = 0


class RequestEventTable:
    def __init__(self, max_size: int = REQUEST_EVENT_MAX_SIZE, debug: bool = True):
        self.max_size = max_size
        self.debug = debug
        self.events: Dict[str, RequestEvent] = {}
        init_serialized_owner(
            self,
            'pyutils.rpc_v2.request_event_table',
            'RPCRequestEventTableThread',
        )
        if self.debug:
            ColorPrint.green(f"[RequestEventTable] Initialized (max_size={max_size})")

    @serialized_method
    def create_event(
        self, request_id: str, route: str, params: Dict[str, Any], client_id: Optional[str] = None, client_type: str = "unknown"
    ) -> RequestEvent:
        if len(self.events) >= self.max_size:
            self._cleanup_oldest()
        event = RequestEvent(
            request_id=request_id,
            route=route,
            params=params,
            client_id=client_id,
            client_type=client_type,
        )
        self.events[request_id] = event
        if self.debug:
            ColorPrint.blue(
                f"[RequestEventTable] Created event id={request_id[:8]} route={route} client={client_type}"
            )
        return replace(event, params=dict(event.params))

    @serialized_method
    def get_event(self, request_id: str) -> Optional[RequestEvent]:
        event = self.events.get(request_id)
        return replace(event, params=dict(event.params)) if event else None

    @serialized_method
    def update_status(self, request_id: str, status: RequestStatus):
        event = self.events.get(request_id)
        if not event:
            return
        event.status = status
        now = time.time()
        if status == RequestStatus.PROCESSING and not event.started_at:
            event.started_at = now
        elif status in (RequestStatus.COMPLETED, RequestStatus.FAILED):
            event.completed_at = now

    @serialized_method
    def set_result(self, request_id: str, result: Any, error: Optional[str] = None):
        event = self.events.get(request_id)
        if not event:
            return
        event.result = result
        event.error = error
        event.status = RequestStatus.FAILED if error else RequestStatus.COMPLETED
        event.completed_at = time.time()

    @serialized_method
    def increment_notify_attempt(self, request_id: str) -> int:
        event = self.events.get(request_id)
        if not event:
            return 0
        event.notify_attempts += 1
        event.last_notify_attempt = time.time()
        return event.notify_attempts

    def mark_notified(self, request_id: str):
        self.update_status(request_id, RequestStatus.NOTIFIED)

    def mark_stored(self, request_id: str):
        self.update_status(request_id, RequestStatus.STORED)

    @serialized_method
    def get_pending_notifications(self, client_id: Optional[str] = None) -> List[RequestEvent]:
        events = []
        for event in self.events.values():
            if event.status == RequestStatus.COMPLETED and (client_id is None or event.client_id == client_id):
                events.append(replace(event, params=dict(event.params)))
        return events

    @serialized_method
    def delete_event(self, request_id: str) -> bool:
        return self.events.pop(request_id, None) is not None

    @serialized_method
    def cleanup(self, max_age: float = REQUEST_EVENT_TTL) -> int:
        now = time.time()
        expired = []
        for request_id, event in self.events.items():
            if event.status in (RequestStatus.NOTIFIED, RequestStatus.STORED):
                if event.completed_at and now - event.completed_at > max_age:
                    expired.append(request_id)
            elif event.status in (RequestStatus.PENDING, RequestStatus.PROCESSING):
                if now - event.created_at > max_age * 2:
                    expired.append(request_id)
        for request_id in expired:
            self.events.pop(request_id, None)
        while len(self.events) > self.max_size:
            self._cleanup_oldest()
        return len(expired)

    @serialized_method
    def get_stats(self) -> Dict[str, Any]:
        stats: Dict[str, Any] = {"total": len(self.events), "max_size": self.max_size, "by_status": {}, "by_client_type": {}}
        for event in self.events.values():
            stats["by_status"][event.status.value] = stats["by_status"].get(event.status.value, 0) + 1
            stats["by_client_type"][event.client_type] = stats["by_client_type"].get(event.client_type, 0) + 1
        return stats

    def _cleanup_oldest(self):
        if not self.events:
            return
        oldest_id = min(self.events, key=lambda rid: self.events[rid].created_at)
        self.events.pop(oldest_id, None)


default_request_event_table = RequestEventTable()

__all__ = ["RequestEventTable", "RequestEvent", "RequestStatus", "default_request_event_table"]
