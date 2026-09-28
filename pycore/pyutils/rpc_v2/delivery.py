# -*- coding: utf-8 -*-
"""ThreadBus-owned event delivery bridge for active HTTP/SSE servers."""

from __future__ import annotations

import asyncio
from collections import deque
from typing import Any, Awaitable, Callable, Deque, Dict, Optional, Tuple

from pycore.pyfoundations.network_constants import HTTP_EVENT_PRE_BIND_BUFFER_MAX
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.thread_bus_constants import BusSignals


EventPublisher = Callable[..., Awaitable[Dict[str, Any]]]
DeliveryBinding = Tuple[asyncio.AbstractEventLoop, EventPublisher]
BufferedEvent = Tuple[str, Dict[str, Any], str, Optional[str], Dict[str, Any]]
HTTP_EVENT_DELIVERY_STATE_QUEUE = "rpc.v2.http_event_delivery.state"
HTTP_EVENT_DELIVERY_STATE_THREAD = "RpcV2HttpEventDeliveryStateThread"


class HttpEventDeliveryService:
    """Publish domain events to every active SSE event journal."""

    def __init__(self) -> None:
        self._bindings: Dict[str, DeliveryBinding] = {}
        self._log_stream_bindings: set[str] = set()
        # Bounded pre-bind buffer: events published before the first SSE
        # server binds (startup logs) wait here and flush on the first bind.
        self._pre_bind_buffer: Deque[BufferedEvent] = deque(
            maxlen=HTTP_EVENT_PRE_BIND_BUFFER_MAX,
        )
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
        binding_key = str(binding_id)
        is_first_binding = not self._bindings
        self._bindings[binding_key] = (loop, publisher)
        if is_first_binding:
            self._flush_pre_bind_buffer()

    @serialized_method
    def _flush_pre_bind_buffer(self) -> None:
        if not self._pre_bind_buffer:
            return
        buffered = tuple(self._pre_bind_buffer)
        self._pre_bind_buffer.clear()
        for loop, publisher in self._bindings_snapshot():
            if loop.is_closed():
                continue
            for topic, payload, audience, event_id, metadata in buffered:
                loop.call_soon_threadsafe(
                    self._publish_on_loop,
                    publisher,
                    topic,
                    dict(payload),
                    audience,
                    event_id,
                    dict(metadata),
                )

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

    @serialized_method
    def _snapshot_or_buffer(
        self,
        topic: str,
        payload: Dict[str, Any],
        audience: str,
        event_id: Optional[str],
        metadata: Dict[str, Any],
    ) -> Tuple[DeliveryBinding, ...]:
        """Return live bindings, or buffer the event when none exist yet.

        Runs on the owner thread like bind(), so an event can never slip
        between the first bind and its pre-bind flush.
        """
        bindings = tuple(self._bindings.values())
        if not bindings:
            self._pre_bind_buffer.append((topic, payload, audience, event_id, metadata))
        return bindings

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
        bindings = self._snapshot_or_buffer(
            str(topic or ""),
            event_payload,
            str(audience or "*"),
            event_id,
            event_metadata,
        )
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
