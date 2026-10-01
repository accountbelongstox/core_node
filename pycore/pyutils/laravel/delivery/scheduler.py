# -*- coding: utf-8 -*-
"""Delivery scheduler: per-kind drains, row claim/deliver/settle, the
offline-server watcher and the server-error breaker gate."""

import threading
import time
from contextlib import ExitStack, contextmanager
from functools import partial
from typing import Any, Dict, Iterator, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, map_bus_tasks, serialized_method, start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.http_client import http_client
from pycore.pyutils.laravel.delivery.breaker import delivery_breaker
from pycore.pyutils.laravel.delivery.model import (
    ACTIVE_DELIVERY_PREFIX,
    DELIVERY_PROCESS_ID,
    DRAIN_IDLE_WAIT_SECONDS,
    DRAIN_WAKE_PREFIX,
    ERROR_SERVER_OFFLINE,
    OUTCOME_DEAD_LETTER,
    OUTCOME_DONE,
    OUTCOME_RETRY,
    OUTCOME_SOURCE_GONE,
    SERVER_OFFLINE_DEFER_SECONDS,
    SERVER_WATCH_SECONDS,
    WATCH_WAKE_SIGNAL,
    DeliveryKind,
    _now,
    active_namespace,
    deliverable_namespaces,
    retry_delay,
)
from pycore.pyutils.laravel.delivery.store import delivery_store
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager


class DeliveryScheduler:
    def __init__(self) -> None:
        self._watching = False
        init_serialized_owner(self, "laravel.delivery.scheduler", "LaravelDeliverySchedulerState")

    def kick(self, kind: Optional[str] = None) -> None:
        """Start the drain of one kind (or all kinds) when rows of a
        deliverable server are waiting (no-op before ``start()``), and make
        sure a watcher runs while a server that should receive rows is
        offline."""
        if THREAD_BUS.is_shutdown_requested():
            return
        for name in ([kind] if kind else delivery_store.kinds()):
            THREAD_BUS.signal(f"{DRAIN_WAKE_PREFIX}.{name}", True)
            if delivery_store.begin_drain(name, deliverable_namespaces(name)):
                start_bus_task(self._drain, name, thread_name=f"LaravelDelivery-{name[:24]}")
        self._ensure_watcher([kind] if kind else None)

    def offline_namespaces(self, kinds: Optional[List[str]] = None) -> List[str]:
        """The selected server when it holds rows but has no reachable route
        (the only server rows are delivered to)."""
        selected = active_namespace()
        waiting = any(delivery_store.has_pending_in(kind, [selected]) for kind in (kinds or delivery_store.kinds()))
        return [selected] if waiting and laravel_endpoint_manager.namespace_reachable(selected) is False else []

    @serialized_method
    def _begin_watch(self) -> bool:
        if self._watching:
            return False
        self._watching = True
        return True

    @serialized_method
    def _end_watch(self) -> None:
        self._watching = False

    def _ensure_watcher(self, kinds: Optional[List[str]] = None) -> None:
        if self._watching or not delivery_store.started() or not self.offline_namespaces(kinds):
            return
        if self._begin_watch():
            start_bus_task(self._watch_servers, thread_name="LaravelDeliveryWatch")

    def _watch_servers(self) -> None:
        """One bounded probe per offline server per ``SERVER_WATCH_SECONDS``.
        A recovered server raises its online edge (reconcile + hurry + kick);
        the loop ends once no server is waiting."""
        try:
            while not THREAD_BUS.is_shutdown_requested():
                offline = self.offline_namespaces()
                if not offline:
                    return
                for namespace in offline:
                    laravel_endpoint_manager.reprobe_namespace(namespace)
                if not self.offline_namespaces():
                    return
                THREAD_BUS.clear_signal(WATCH_WAKE_SIGNAL)
                THREAD_BUS.wait_signal(WATCH_WAKE_SIGNAL, timeout=SERVER_WATCH_SECONDS)
        finally:
            self._end_watch()

    def _drain(self, kind: str) -> None:
        finished = False
        try:
            finished = self._drain_rows(kind)
        finally:
            if not finished:
                delivery_store.end_drain(kind, force=True)
        # The drain ends while rows wait for a server that went offline: the
        # watcher takes over re-probing it.
        self._ensure_watcher([kind])

    def _drain_rows(self, kind: str) -> bool:
        definition = delivery_store.definition(kind)
        wake = f"{DRAIN_WAKE_PREFIX}.{kind}"
        while definition is not None and not THREAD_BUS.is_shutdown_requested():
            if definition.ready is not None and not definition.ready():
                return False
            THREAD_BUS.clear_signal(wake)
            pause = delivery_breaker.pause_seconds(kind)
            if pause > 0:
                THREAD_BUS.wait_signal(wake, timeout=pause)
                continue
            namespaces = deliverable_namespaces(kind)
            ready = self._unique_identities(delivery_store.list_ready(kind, definition.batch_limit, namespaces))
            if ready:
                if definition.deliver_batch is not None:
                    groups: Dict[str, List[Dict[str, Any]]] = {}
                    for row in ready:
                        groups.setdefault(str(row.get("namespace") or ""), []).append(row)
                    work = list(groups.values())
                    handler = partial(self._deliver_group, definition)
                else:
                    work = ready
                    handler = partial(self._deliver_one, definition)
                map_bus_tasks(
                    handler,
                    work,
                    max_workers=min(max(1, definition.parallel), len(work)),
                    thread_prefix=f"LaravelDelivery-{kind[:16]}",
                )
                continue
            if delivery_store.end_drain(kind, namespaces):
                return True
            next_attempt = delivery_store.next_attempt_at(kind, namespaces)
            timeout = (
                min(DRAIN_IDLE_WAIT_SECONDS, max(0.5, next_attempt - _now()))
                if next_attempt
                else DRAIN_IDLE_WAIT_SECONDS
            )
            THREAD_BUS.wait_signal(wake, timeout=timeout)
        return False

    @staticmethod
    def _unique_identities(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen = set()
        unique = []
        for row in rows:
            key = (str(row.get("namespace") or ""), str(row.get("identity") or "") or str(row.get("delivery_id") or ""))
            if key in seen:
                continue
            seen.add(key)
            unique.append(row)
        return unique

    @staticmethod
    def _target_base_url(row: Dict[str, Any]) -> str:
        """Pinned rows (a task of one endpoint) keep their endpoint while it is
        not known to be down; every other row, and a pinned row whose endpoint
        just failed, goes through a live route of its server (same database)."""
        pinned = str(row.get("base_url") or "") if row.get("pin_base_url") else ""
        if pinned and laravel_endpoint_manager.is_reachable(pinned) is not False:
            return pinned
        return laravel_endpoint_manager.route_for_namespace(str(row.get("namespace") or ""))

    def _begin_row(self, record: Dict[str, Any], owner: str) -> Optional[Dict[str, Any]]:
        """Claim one row and bind its server endpoint; a row of a server
        without a known endpoint waits (no attempt counted)."""
        delivery_id = str(record.get("delivery_id") or "")
        claimed = delivery_store.claim(delivery_id, owner)
        if not claimed:
            return None
        base_url = self._target_base_url(claimed)
        if not base_url:
            delivery_store.release(
                delivery_id, owner, error=ERROR_SERVER_OFFLINE,
                retry_at=_now() + SERVER_OFFLINE_DEFER_SECONDS, count_failure=False,
            )
            return None
        attempts = int(claimed.get("delivery_attempts") or 0) + 1
        delivery_store.patch(delivery_id, {"delivery_attempts": attempts, "last_attempt_at": _now(), "base_url": base_url}, owner=owner)
        claimed["delivery_attempts"] = attempts
        claimed["base_url"] = base_url
        return claimed

    def _failure_outcome(self, definition: DeliveryKind, row: Dict[str, Any], error: Exception) -> Dict[str, Any]:
        """A failure while the row's server is unreachable is the server's
        outage, not the row's: it is deferred without counting an attempt or a
        failure (the watcher and the online edge resume it)."""
        delivery_id = str(row.get("delivery_id") or "")
        permanent = definition.permanent_error is not None and definition.permanent_error(str(error))
        offline = not permanent and laravel_endpoint_manager.is_reachable(str(row.get("base_url") or "")) is False
        ColorPrint.yellow(
            f"[LaravelDelivery] kind={definition.name} delivery={delivery_id} "
            f"{'dead-lettered' if permanent else 'deferred (server offline)' if offline else 'deferred'}: {error}"
        )
        outcome = {"status": OUTCOME_DEAD_LETTER if permanent else OUTCOME_RETRY, "error": str(error)}
        if offline:
            outcome["offline"] = True
        return outcome

    def _deliver_one(self, definition: DeliveryKind, record: Dict[str, Any]) -> Dict[str, Any]:
        delivery_id = str(record.get("delivery_id") or "")
        owner = f"{DELIVERY_PROCESS_ID}:{delivery_id}:{time.monotonic_ns()}"
        with self.delivery_scope(delivery_id, owner):
            claimed = self._begin_row(record, owner)
            if not claimed:
                return {"delivery_id": delivery_id, "processed": False}
            try:
                outcome = definition.deliver(claimed, owner) or {}
            except Exception as error:  # noqa: BLE001 - one row's failure defers only that row
                outcome = self._failure_outcome(definition, claimed, error)
        return self._settle(definition, claimed, owner, outcome)

    def _deliver_group(self, definition: DeliveryKind, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """One batch request per server for small items; each row keeps its
        own lease, outcome and retry."""
        owners = {
            str(record.get("delivery_id") or ""): f"{DELIVERY_PROCESS_ID}:{record.get('delivery_id')}:{time.monotonic_ns()}"
            for record in records
        }
        # Claim first, then register lease renewal for the rows actually
        # claimed: a row this batch did not claim has no lease of ours, and a
        # renewal callback for it would abort the shared upload of the others.
        claimed = [row for row in (self._begin_row(record, owners[str(record.get("delivery_id") or "")]) for record in records) if row]
        if not claimed:
            return []
        with ExitStack() as scopes:
            for row in claimed:
                scopes.enter_context(self.delivery_scope(str(row["delivery_id"]), owners[str(row["delivery_id"])], strict=False))
            try:
                outcomes = definition.deliver_batch(claimed, {row["delivery_id"]: owners[row["delivery_id"]] for row in claimed}) or {}
            except Exception as error:  # noqa: BLE001 - a failed batch defers its rows
                outcomes = {row["delivery_id"]: self._failure_outcome(definition, row, error) for row in claimed}
            # Rows the batch did not take (legacy server, unbatchable size)
            # go through the single-row handler.
            for row in claimed:
                if row["delivery_id"] in outcomes or definition.deliver is None:
                    continue
                try:
                    outcomes[row["delivery_id"]] = definition.deliver(row, owners[row["delivery_id"]]) or {}
                except Exception as error:  # noqa: BLE001 - one row's failure defers only that row
                    outcomes[row["delivery_id"]] = self._failure_outcome(definition, row, error)
        return [
            self._settle(definition, row, owners[row["delivery_id"]], outcomes.get(row["delivery_id"]) or {})
            for row in claimed
        ]

    def _settle(self, definition: DeliveryKind, claimed: Dict[str, Any], owner: str, outcome: Dict[str, Any]) -> Dict[str, Any]:
        delivery_id = str(claimed.get("delivery_id") or "")
        status = str(outcome.get("status") or OUTCOME_RETRY)
        error = str(outcome.get("error") or "")
        if outcome.get("server_error") or status == OUTCOME_DONE:
            delivery_breaker.note(definition.name, bool(outcome.get("server_error")))
        if status == OUTCOME_DONE:
            if not delivery_store.complete(delivery_id, owner):
                return {"delivery_id": delivery_id, "processed": True, "success": False, "error": "delivery_ownership_changed"}
            if definition.on_delivered is not None:
                definition.on_delivered(claimed, outcome)
            return {"delivery_id": delivery_id, "processed": True, "success": True}
        if status == OUTCOME_SOURCE_GONE:
            if delivery_store.drop(delivery_id, owner):
                ColorPrint.gray(f"[LaravelDelivery] kind={definition.name} delivery={delivery_id} dropped: {error or 'local source is gone'}")
            return {"delivery_id": delivery_id, "processed": True, "success": False, "dropped": True, "error": error}
        if status == OUTCOME_DEAD_LETTER:
            delivery_store.mark_dead_letter(delivery_id, owner, error)
        elif outcome.get("offline"):
            delivery_store.defer_offline(delivery_id, owner, error)
        else:
            retry_at = float(outcome.get("retry_at") or 0.0) or _now() + retry_delay(
                int(claimed.get("delivery_attempts") or 1), definition.retry_initial_seconds, definition.retry_max_seconds,
            )
            delivery_store.release(delivery_id, owner, error=error, retry_at=retry_at)
        return {"delivery_id": delivery_id, "processed": True, "success": False, "error": error}

    @contextmanager
    def delivery_scope(self, delivery_id: str, owner: str, strict: bool = True) -> Iterator[None]:
        """Keep one claimed row's lease alive while its transfer makes
        progress. ``strict`` aborts the transfer when the row lost its lease
        (single-row delivery); a shared batch transfer is not strict, so one
        row losing its lease never aborts the other rows' upload (its own
        settle reports the lost ownership)."""
        active_signal = f"{ACTIVE_DELIVERY_PREFIX}.{owner}"
        THREAD_BUS.signal(active_signal, threading.current_thread())
        try:
            with http_client.transfer_observer(partial(delivery_store.renew, delivery_id, owner, strict=strict)):
                yield
        finally:
            THREAD_BUS.clear_signal(active_signal)


delivery_scheduler = DeliveryScheduler()
