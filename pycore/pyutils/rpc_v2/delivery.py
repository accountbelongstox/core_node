# -*- coding: utf-8 -*-
"""Thread-safe event delivery bridge for active RPC servers."""

from __future__ import annotations

import asyncio
import threading
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple

from pycore.pyfoundations.thread_bus_constants import BusSignals


EventPublisher = Callable[..., Awaitable[Dict[str, Any]]]
DeliveryBinding = Tuple[asyncio.AbstractEventLoop, EventPublisher]


class RpcDeliveryService:
    """Publish domain events to every active RPC server event journal."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self._bindings: Dict[str, DeliveryBinding] = {}
        self._log_stream_bindings: set[str] = set()

    def bind(
        self,
        binding_id: str,
        loop: asyncio.AbstractEventLoop,
        publisher: EventPublisher,
    ) -> None:
        with self._lock:
            self._bindings[str(binding_id)] = (loop, publisher)

    def unbind(self, binding_id: str) -> None:
        with self._lock:
            self._bindings.pop(str(binding_id), None)

    def enable_log_stream(self, binding_id: str) -> bool:
        with self._lock:
            was_empty = not self._log_stream_bindings
            self._log_stream_bindings.add(str(binding_id))
            return was_empty

    def disable_log_stream(self, binding_id: str) -> bool:
        with self._lock:
            self._log_stream_bindings.discard(str(binding_id))
            return not self._log_stream_bindings

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
        with self._lock:
            bindings = tuple(self._bindings.values())
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


rpc_delivery_service = RpcDeliveryService()


__all__ = ["rpc_delivery_service"]
