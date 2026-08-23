# -*- coding: utf-8 -*-
"""ThreadBus-owned event delivery bridge for active HTTP/SSE servers."""

from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple

from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.thread_bus_constants import BusSignals


EventPublisher = Callable[..., Awaitable[Dict[str, Any]]]
DeliveryBinding = Tuple[asyncio.AbstractEventLoop, EventPublisher]
HTTP_EVENT_DELIVERY_STATE_QUEUE = "rpc.v2.http_event_delivery.state"
HTTP_EVENT_DELIVERY_STATE_THREAD = "RpcV2HttpEventDeliveryStateThread"


class HttpEventDeliveryService:
    """Publish domain events to every active SSE event journal."""

    def __init__(self) -> None:
        self._bindings: Dict[str, DeliveryBinding] = {}
        self._log_stream_bindings: set[str] = set()
        init_serialized_owner(
            self,
            HTTP_EVENT_DELIVERY_STATE_QUEUE,
            HTTP_EVENT_DELIVERY_STATE_THREAD,
        )

    @serialized_method
    def bind(
        self,
        binding_id: str,
        loop: asyncio.AbstractEventLoop,
        publisher: EventPublisher,
    ) -> None:
        self._bindings[str(binding_id)] = (loop, publisher)

    @serialized_method
    def unbind(self, binding_id: str) -> None:
        self._bindings.pop(str(binding_id), None)

    @serialized_method
    def enable_log_stream(self, binding_id: str) -> bool:
        was_empty = not self._log_stream_bindings
        self._log_stream_bindings.add(str(binding_id))
        return was_empty

    @serialized_method
    def disable_log_stream(self, binding_id: str) -> bool:
        self._log_stream_bindings.discard(str(binding_id))
        return not self._log_stream_bindings

    @serialized_method
    def _bindings_snapshot(self) -> Tuple[DeliveryBinding, ...]:
        return tuple(self._bindings.values())

    def publish_topic(
        self,
        topic: str,
        payload: Dict[str, Any],
        audience: str = "*",
        **metadata: Any,
    ) -> None:
        event_id_value = metadata.pop("event_id", None)
        event_id = str(event_id_value) if event_id_value else None
        event_payload = dict(payload or {})
        event_metadata = dict(metadata)
        bindings = self._bindings_snapshot()
        for loop, publisher in bindings:
            if loop.is_closed():
                continue
            loop.call_soon_threadsafe(
                self._publish_on_loop,
                publisher,
                str(topic or ""),
                event_payload,
                str(audience or "*"),
                event_id,
                event_metadata,
            )

    def publish_log(
        self,
        message: Any,
        color_type: str = "white",
        log_level: Optional[str] = None,
    ) -> None:
        self.publish_topic(
            BusSignals.PYCORE_LOG,
            {
                "message": message,
                "color": color_type or "white",
                "level": log_level or "INFO",
            },
        )

    @staticmethod
    def _publish_on_loop(
        publisher: EventPublisher,
        topic: str,
        payload: Dict[str, Any],
        audience: str,
        event_id: Optional[str],
        metadata: Dict[str, Any],
    ) -> None:
        asyncio.create_task(
            publisher(
                topic,
                payload,
                audience=audience,
                event_id=event_id,
                metadata=metadata,
            )
        )


http_event_delivery_service = HttpEventDeliveryService()


__all__ = ["http_event_delivery_service"]
