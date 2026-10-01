# -*- coding: utf-8 -*-
"""Durable pycore -> Laravel delivery outbox: the composer producers use.

The model (kinds, namespaces, rows, steps, receipts, handler contract) is
documented in ``pyutils/laravel/delivery/model.py``. Components:
  * ``delivery.store``      - rows, kinds, receipts and drain flags (one owner)
  * ``delivery.scheduler``  - drains, claim/deliver/settle, offline watcher
  * ``delivery.breaker``    - server-error drain pause
  * ``delivery.reconciler`` - per-server inventory diff, online/switch edges
  * ``delivery.status``     - counters and overview

Nothing runs at import: ``start()`` (service startup path) registers the
online edge, migrates and activates the registered kinds.
"""

import copy
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.laravel.delivery.model import (
    RECONCILE_REASON_KIND,
    RECONCILE_REASON_MANUAL,
    RECONCILE_REASON_START,
    DeliveryKind,
    active_namespace,
    make_item_key,
    target_namespaces,
)
from pycore.pyutils.laravel.delivery.reconciler import delivery_reconciler
from pycore.pyutils.laravel.delivery.scheduler import delivery_scheduler
from pycore.pyutils.laravel.delivery.status import kind_stats, outbox_status
from pycore.pyutils.laravel.delivery.store import delivery_store, retain_payload
from pycore.pyutils.laravel.endpoint_manager import LARAVEL_ONLINE_EVENT, laravel_endpoint_manager


class LaravelDeliveryOutbox:
    """Persist every pycore -> Laravel delivery until each step is accepted
    by the server (namespace) it belongs to."""

    # ------------------------------------------------------------------ #
    # lifecycle                                                           #
    # ------------------------------------------------------------------ #
    def start(self) -> None:
        """Service startup: subscribe to the online / switch edges, place
        v1 rows into their server namespace and activate every kind (drain,
        reconcile the active endpoint). Idempotent."""
        if not delivery_store.mark_started():
            return
        THREAD_BUS.register_event_handler(LARAVEL_ONLINE_EVENT, delivery_reconciler.on_laravel_online)
        laravel_endpoint_manager.register_endpoint_change_listener(delivery_reconciler.on_endpoint_switched)
        start_bus_task(self._start_background, thread_name="LaravelDeliveryStart")

    def _start_background(self) -> None:
        delivery_store.migrate_v1()
        for name in delivery_store.kinds():
            delivery_store.fold_replaced(name)
            self._seed(name)
            # Rows still waiting out a backoff of a previous process become
            # ready at once.
            delivery_store.hurry_pending(name)
        laravel_endpoint_manager.resolve()
        delivery_reconciler.reconcile(reason=RECONCILE_REASON_START)
        delivery_scheduler.kick()

    def _seed(self, kind: str) -> None:
        """Once per kind after the v1 upgrade: domain delivered-markers of
        the pre-namespace era count for the server they were delivered to
        (the stored selection) and for no other."""
        definition = delivery_store.definition(kind)
        if definition is None or definition.seed_markers is None:
            return
        namespace = delivery_store.seed_namespace(kind)
        if not namespace:
            return
        seeded = delivery_store.seed_state(namespace, kind, [
            {"key": make_item_key(str(entry.get("diff_kind") or definition.diff_kind or kind), str(entry["key"])),
             "hash": str(entry.get("hash") or "")}
            for entry in definition.seed_markers()
        ])
        if seeded:
            ColorPrint.cyan(f"[LaravelDelivery] kind={kind} seeded {seeded} delivered markers into {namespace}")

    def register(self, kind: DeliveryKind) -> None:
        """Register (or re-register) one feature's delivery kind. No I/O
        before ``start()``; afterwards the kind drains and reconciles the
        active endpoint at once."""
        if delivery_store.register_kind(kind):
            start_bus_task(self._activate, kind.name, thread_name=f"LaravelDeliveryActivate-{kind.name[:16]}")

    def _activate(self, kind: str) -> None:
        delivery_store.fold_replaced(kind)
        self._seed(kind)
        delivery_store.hurry_pending(kind)
        delivery_reconciler.reconcile(reason=RECONCILE_REASON_KIND, kinds=[kind])
        delivery_scheduler.kick(kind)

    # ------------------------------------------------------------------ #
    # producers                                                           #
    # ------------------------------------------------------------------ #
    def enqueue(
        self,
        kind: str,
        record: Dict[str, Any],
        payload_file: Optional[str] = None,
        kick: bool = True,
        only_new: bool = False,
        namespace: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Persist one delivery per target server (idempotent by
        ``delivery_id`` inside each namespace); returns the active server's
        row. A record with ``base_url`` belongs to that endpoint's server; a
        record without one fans out to ``target_namespaces()``. An optional
        payload file is retained as an immutable copy first. ``only_new``
        leaves an existing row untouched."""
        staged = copy.deepcopy(record)
        staged["kind"] = kind
        if payload_file:
            staged.update(retain_payload(kind, staged, payload_file))
        if namespace:
            namespaces = [namespace]
        elif staged.get("base_url") or staged.get("pin_base_url"):
            namespaces = [laravel_endpoint_manager.delivery_namespace(str(staged.get("base_url") or ""))]
        else:
            namespaces = target_namespaces()
        rows = [delivery_store.put(staged, name, only_new) for name in namespaces]
        if kick:
            delivery_scheduler.kick(kind)
        return rows[0]

    def kick(self, kind: Optional[str] = None) -> None:
        delivery_scheduler.kick(kind)

    def cached_hash(self, scope: str, key: str, signature: str, compute: Optional[Callable[[], str]] = None) -> str:
        return delivery_store.cached_hash(scope, key, signature, compute)

    def meta_value(self, key: str) -> str:
        return delivery_store.meta_value(key)

    def set_meta_value(self, key: str, value: str) -> None:
        delivery_store.set_meta_value(key, value)

    # ------------------------------------------------------------------ #
    # handler progress (same ``owner`` as the claim)                      #
    # ------------------------------------------------------------------ #
    def patch(self, delivery_id: str, patch: Dict[str, Any], owner: str = "") -> Optional[Dict[str, Any]]:
        return delivery_store.patch(delivery_id, patch, owner=owner)

    def mark_identity_delivered(self, delivery_id: str, owner: str, receipt: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return delivery_store.mark_identity_delivered(delivery_id, owner, receipt)

    def mark_step(self, delivery_id: str, owner: str, step: str) -> Optional[Dict[str, Any]]:
        return delivery_store.mark_step(delivery_id, owner, step)

    # ------------------------------------------------------------------ #
    # queries / operator                                                  #
    # ------------------------------------------------------------------ #
    def kinds(self) -> List[str]:
        return delivery_store.kinds()

    def running(self, kind: str) -> bool:
        return delivery_store.running(kind)

    def counts_by_group(self, kind: str, namespace: Optional[str] = None) -> Dict[str, Dict[str, int]]:
        """Per ``group_key`` of one server (default: the active one):
        pending / dead-letter row counts (GROUP BY)."""
        return delivery_store.group_counts(kind, namespace or active_namespace())

    def delivered_hashes(self, kind: str, keys: List[str], namespace: Optional[str] = None) -> Dict[str, str]:
        """Delivered-state content hash per item key on one server (default:
        the active one); a local view, not the server's authority."""
        return delivery_store.state_hashes(namespace or active_namespace(), kind, keys)

    def pending_group_keys(self, kind: str, keys: List[str]) -> List[str]:
        return delivery_store.pending_group_keys(kind, keys)

    def has_pending_group_prefix(self, kind: str, prefix: str) -> bool:
        return delivery_store.has_pending_group_prefix(kind, prefix)

    def retry_dead_letters(self, kind: str) -> int:
        return delivery_store.retry_dead_letters(kind)

    def stats(self, kind: str) -> Dict[str, Any]:
        return kind_stats(kind)

    def status(self) -> Dict[str, Any]:
        return outbox_status()

    def reconcile(self, namespace: Optional[str] = None, base_url: str = "",
                  reason: str = RECONCILE_REASON_MANUAL, kinds: Optional[List[str]] = None) -> None:
        delivery_reconciler.reconcile(namespace, base_url, reason, kinds)

    def reconcile_selected(self, reason: str = RECONCILE_REASON_MANUAL) -> None:
        delivery_reconciler.reconcile_selected(reason)

    def reconcile_once(self, kinds: List[str]) -> None:
        delivery_reconciler.reconcile_once(kinds)


laravel_delivery_outbox = LaravelDeliveryOutbox()


__all__ = ["LaravelDeliveryOutbox", "laravel_delivery_outbox"]
