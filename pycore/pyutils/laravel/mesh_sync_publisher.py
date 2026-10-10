# -*- coding: utf-8 -*-
"""MeshSync publisher: the fan-out kind of the Laravel delivery outbox that carries MeshSync records
to every online Laravel server (the public domain and each mesh-forwarded ``/laravel-api``), each
asynchronously and durably on its own route. Any feature publishes with
``mesh_sync_publisher.publish(stream, key, payload, search_text)``; a server that was offline gets the
record from its peers through MeshSync replication (``laravel_main`` ``app/Apps/MeshSync``).

A record is ``{stream, key, version, deleted, payload, search_text}``; ``version`` is the writer's
microsecond clock and decides last-writer-wins on every server."""

from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.laravel.delivery.model import (
    OUTCOME_DEAD_LETTER,
    OUTCOME_DONE,
    OUTCOME_RETRY,
    DeliveryKind,
    fanout_namespaces,
    make_delivery_id,
)
from pycore.pyutils.laravel.delivery_outbox import laravel_delivery_outbox
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.laravel.mesh_sync_client import mesh_sync_client

MESH_SYNC_KIND = "mesh_sync"
MESH_SYNC_PARALLEL = 4
MESH_SYNC_BATCH_LIMIT = 100
RETRY_INITIAL_SECONDS = 5.0
RETRY_MAX_SECONDS = 600.0
# Servers whose reachability is not observed yet are probed in the background at most this often,
# so fan-out reaches every live server, not only the ones this machine happened to call.
PROBE_INTERVAL_SECONDS = 60.0
PROBE_AT_SIGNAL = "laravel.mesh_sync.probe_at"


class MeshSyncPublisher:
    def register(self) -> None:
        laravel_delivery_outbox.register(DeliveryKind(
            name=MESH_SYNC_KIND,
            deliver_batch=self._deliver,
            fanout=True,
            parallel=MESH_SYNC_PARALLEL,
            batch_limit=min(MESH_SYNC_BATCH_LIMIT, mesh_sync_client.limit("ingest_records")),
            retry_initial_seconds=RETRY_INITIAL_SECONDS,
            retry_max_seconds=RETRY_MAX_SECONDS,
        ))

    def publish(
        self,
        stream: str,
        key: str,
        payload: Optional[Dict[str, Any]],
        search_text: str = "",
        deleted: bool = False,
        version: Optional[int] = None,
    ) -> None:
        record_version = int(version if version is not None else time.time_ns() // 1000)
        record = {
            "stream": stream,
            "key": key,
            "version": record_version,
            "deleted": bool(deleted),
            "payload": None if deleted else payload,
            "search_text": "" if deleted else search_text,
        }
        self._probe_unobserved()
        laravel_delivery_outbox.enqueue(MESH_SYNC_KIND, {
            "delivery_id": make_delivery_id(MESH_SYNC_KIND, stream, key, record_version),
            "mesh_record": record,
        })

    @staticmethod
    def _probe_unobserved() -> None:
        now = time.time()
        if now - float(THREAD_BUS.get_signal(PROBE_AT_SIGNAL, 0.0) or 0.0) < PROBE_INTERVAL_SECONDS:
            return
        THREAD_BUS.signal(PROBE_AT_SIGNAL, now)
        for namespace in fanout_namespaces():
            if laravel_endpoint_manager.namespace_reachable(namespace) is None:
                start_bus_task(laravel_endpoint_manager.reprobe_namespace, namespace, thread_name="MeshSyncProbe")

    @staticmethod
    def _peers() -> List[Dict[str, str]]:
        """Reachable server routes this machine knows: each server learns the mesh routes from it."""
        return [
            {"base_url": str(server["url"]), "server_id": str(server["server_id"])}
            for server in laravel_endpoint_manager.known_servers()
            if server.get("reachable") and server.get("server_id")
        ]

    def _deliver(self, rows: List[Dict[str, Any]], owners: Dict[str, str]) -> Dict[str, Dict[str, Any]]:
        base_url = str(rows[0].get("base_url") or "")
        result = mesh_sync_client.push(base_url, [row["mesh_record"] for row in rows], self._peers())
        if not result["success"]:
            return {
                row["delivery_id"]: {
                    "status": OUTCOME_RETRY,
                    "error": str(result.get("error") or ""),
                    "server_error": bool(result.get("server_error")),
                }
                for row in rows
            }
        rejected = {
            (str(item.get("stream") or ""), str(item.get("key") or "")): str(item.get("error") or "")
            for item in result.get("rejected") or []
            if isinstance(item, dict)
        }
        outcomes: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            error = rejected.get((str(row["mesh_record"]["stream"]), str(row["mesh_record"]["key"])))
            outcomes[row["delivery_id"]] = (
                {"status": OUTCOME_DEAD_LETTER, "error": error} if error is not None else {"status": OUTCOME_DONE}
            )
        return outcomes


mesh_sync_publisher = MeshSyncPublisher()

__all__ = ["MESH_SYNC_KIND", "MeshSyncPublisher", "mesh_sync_publisher"]
