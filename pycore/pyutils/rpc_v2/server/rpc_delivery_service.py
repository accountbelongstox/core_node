# -*- coding: utf-8 -*-
"""
Durable RPC event delivery service (FIX V7).

Persists outbox + per-client delivery rows before attempting live WS send.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from pycore.database import StateRepository
from pycore.pyutils.rpc_v2.server.client_registry import ClientRegistry


class RpcDeliveryService:
    """Notify clients with durable at-least-once delivery semantics."""

    def __init__(
        self,
        repo: Optional[StateRepository] = None,
        client_registry: Optional[ClientRegistry] = None,
    ) -> None:
        self.repo = repo or StateRepository()
        self._registry = client_registry
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_client_registry(self, registry: ClientRegistry) -> None:
        self._registry = registry

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    def notify_client(
        self,
        client_id: str,
        topic: str,
        payload: Dict[str, Any],
        event_id: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        revision: int = 0,
        causation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        frame = self.repo.enqueue_client_event(
            client_id=client_id,
            topic=topic,
            payload=payload,
            event_id=event_id,
            entity_type=entity_type,
            entity_id=entity_id,
            revision=revision,
            causation_id=causation_id,
        )
        self._schedule_send(client_id, frame)
        return frame

    def notify_clients(
        self,
        client_ids: List[str],
        topic: str,
        payload: Dict[str, Any],
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        return [self.notify_client(client_id, topic, payload, **kwargs) for client_id in client_ids]

    def publish_topic(
        self,
        topic: str,
        payload: Dict[str, Any],
        audience: str = "*",
        **kwargs: Any,
    ) -> List[Dict[str, Any]]:
        client_ids = self._resolve_audience(audience)
        if not client_ids:
            return []
        return self.notify_clients(client_ids, topic, payload, **kwargs)

    def fanout_outbox_event(self, event_id: str) -> List[Dict[str, Any]]:
        """Create per-client delivery rows for an outbox event already committed."""
        outbox = self.repo.get_outbox_event(event_id)
        if not outbox:
            return []
        audience = str(outbox.get("audience") or "*")
        client_ids = self._resolve_audience(audience)
        if not client_ids:
            return []
        payload = outbox.get("payload") or {}
        topic = str(outbox.get("topic") or "operation.changed")
        frames: List[Dict[str, Any]] = []
        for client_id in client_ids:
            frame = self.repo.append_client_delivery(
                client_id=client_id,
                event_id=event_id,
                topic=topic,
                payload=payload,
            )
            self._schedule_send(client_id, frame)
            frames.append(frame)
        return frames

    def ack_event(self, client_id: str, event_id: str, seq: int) -> bool:
        return self.repo.ack_client_delivery(client_id, event_id, seq)

    def replay_unacked(
        self,
        client_id: str,
        after_seq: int = 0,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        if after_seq <= 0:
            after_seq = self.repo.get_client_offset(client_id)
        return self.repo.replay_unacked_deliveries(client_id, after_seq=after_seq, limit=limit)

    def get_client_offset(self, client_id: str) -> int:
        return self.repo.get_client_offset(client_id)

    def _resolve_audience(self, audience: str) -> List[str]:
        audience = str(audience or "*").strip()
        if audience.startswith("client:"):
            return [audience.split(":", 1)[1]]
        if audience != "*":
            return [audience]
        client_ids = set(self.repo.list_durable_client_ids())
        if self._registry is not None:
            client_ids.update(self._registry.get_clients_snapshot().keys())
        return list(client_ids)

    def _schedule_send(self, client_id: str, frame: Dict[str, Any]) -> None:
        if self._registry is None:
            return
        loop = self._loop
        if loop is None:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                return
        try:
            running = asyncio.get_running_loop()
            if running is loop:
                loop.create_task(self._send_frame(client_id, frame))
                return
        except RuntimeError:
            pass
        asyncio.run_coroutine_threadsafe(self._send_frame(client_id, frame), loop)

    async def _send_frame(self, client_id: str, frame: Dict[str, Any]) -> bool:
        if self._registry is None:
            return False
        sent = await self._registry.send_to_client(client_id, frame, track_stats=True)
        if sent:
            self.repo.mark_delivery_sent(client_id, str(frame.get("event_id") or ""))
        return sent


_SERVICE: Optional[RpcDeliveryService] = None


def get_rpc_delivery_service() -> RpcDeliveryService:
    global _SERVICE
    if _SERVICE is None:
        _SERVICE = RpcDeliveryService()
    return _SERVICE


__all__ = ["RpcDeliveryService", "get_rpc_delivery_service"]
