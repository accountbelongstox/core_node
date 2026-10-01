# -*- coding: utf-8 -*-
"""Delivery reconciler: Laravel-driven inventory diff per server (remote
diff API, else a local diff for legacy servers) and the online / endpoint
switch edges that trigger it."""

import copy
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method, start_bus_task
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.laravel.delivery.model import (
    DIFF_MODE_LOCAL,
    DIFF_MODE_REMOTE,
    DIFF_STATE_DONE,
    DIFF_STATE_FAILED,
    DIFF_STATE_RUNNING,
    LOCAL_DIFF_PAGE,
    RECONCILE_INVENTORY_PAGE,
    RECONCILE_REASON_KIND,
    RECONCILE_REASON_MANUAL,
    RECONCILE_REASON_SWITCH,
    WATCH_WAKE_SIGNAL,
    DeliveryKind,
    _now,
    active_namespace,
    make_item_key,
)
from pycore.pyutils.laravel.delivery.scheduler import delivery_scheduler
from pycore.pyutils.laravel.delivery.store import delivery_store
from pycore.pyutils.laravel.delivery_diff import NEED_STALE, laravel_delivery_diff_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.laravel.identity import URL_NAMESPACE_PREFIX


class DeliveryReconciler:
    def __init__(self) -> None:
        self._reconciling: Dict[str, List[Optional[List[str]]]] = {}
        self._diff_status: Dict[str, Dict[str, Dict[str, Any]]] = {}
        init_serialized_owner(self, "laravel.delivery.reconciler", "LaravelDeliveryReconcilerState")

    @serialized_method
    def diff_status(self, namespace: str, kind: str) -> Dict[str, Any]:
        return copy.deepcopy((self._diff_status.get(namespace) or {}).get(kind) or {})

    @serialized_method
    def diff_namespaces(self, kind: str) -> List[str]:
        return [namespace for namespace, entries in self._diff_status.items() if kind in entries]

    @serialized_method
    def _begin_reconcile(self, namespace: str, kinds: Optional[List[str]]) -> bool:
        """Single flight per server; a request during a run is queued and
        runs right after it (``None`` = every kind)."""
        if namespace in self._reconciling:
            self._reconciling[namespace].append(kinds)
            return False
        self._reconciling[namespace] = []
        return True

    @serialized_method
    def _next_reconcile(self, namespace: str) -> Tuple[bool, Optional[List[str]]]:
        queued = self._reconciling.get(namespace) or []
        if not queued:
            self._reconciling.pop(namespace, None)
            return False, None
        self._reconciling[namespace] = []
        if any(entry is None for entry in queued):
            return True, None
        return True, sorted({name for entry in queued for name in entry})

    @serialized_method
    def reconciling_namespaces(self) -> List[str]:
        return sorted(self._reconciling)

    @serialized_method
    def _note_diff(self, namespace: str, kind: str, patch: Dict[str, Any]) -> None:
        entry = self._diff_status.setdefault(namespace, {}).setdefault(kind, {})
        entry.update(copy.deepcopy(patch))

    def reconcile(
        self,
        namespace: Optional[str] = None,
        base_url: str = "",
        reason: str = RECONCILE_REASON_MANUAL,
        kinds: Optional[List[str]] = None,
    ) -> None:
        """Bring one server (default: the active endpoint's) complete in the
        background: diff every inventory kind, enqueue what it misses."""
        if not delivery_store.started() or THREAD_BUS.is_shutdown_requested():
            return
        base_url = base_url or (laravel_endpoint_manager.route_for_namespace(namespace) if namespace else "")
        base_url = base_url or laravel_endpoint_manager.get_active_base_url()
        namespace = namespace or laravel_endpoint_manager.delivery_namespace(base_url)
        if reason != RECONCILE_REASON_MANUAL and namespace != active_namespace():
            # Reconcile enqueues what a server misses: only the selected server
            # is kept complete; an operator may still ask for another one.
            return
        if not self._begin_reconcile(namespace, kinds):
            return
        start_bus_task(
            self._reconcile_loop, namespace, base_url, reason, kinds,
            thread_name=f"LaravelDeliveryReconcile-{namespace[-12:]}",
        )

    def reconcile_selected(self, reason: str = RECONCILE_REASON_MANUAL) -> None:
        """Reconcile the server the UI selected."""
        server = laravel_endpoint_manager.server_identity()
        self.reconcile(server["namespace"], server["url"], reason)

    def reconcile_once(self, kinds: List[str]) -> None:
        """Reconcile the active server for the kinds not diffed (or failed)
        there in this process, e.g. a kind whose ``ready`` just turned on."""
        namespace = active_namespace()
        pending = [name for name in kinds if not self._diffed(namespace, name)]
        if pending:
            self.reconcile(namespace, reason=RECONCILE_REASON_KIND, kinds=pending)

    @serialized_method
    def _diffed(self, namespace: str, kind: str) -> bool:
        state = ((self._diff_status.get(namespace) or {}).get(kind) or {}).get("state")
        return state in (DIFF_STATE_RUNNING, DIFF_STATE_DONE)

    def _reconcile_loop(self, namespace: str, base_url: str, reason: str, kinds: Optional[List[str]]) -> None:
        again = True
        try:
            while again and not THREAD_BUS.is_shutdown_requested():
                self._reconcile_server(namespace, base_url, reason, kinds)
                again, kinds = self._next_reconcile(namespace)
        finally:
            if again:
                # Failed or interrupted run (a finished one already left).
                self._end_reconcile(namespace)

    @serialized_method
    def _end_reconcile(self, namespace: str) -> None:
        self._reconciling.pop(namespace, None)

    def _reconcile_server(self, namespace: str, base_url: str, reason: str, kinds: Optional[List[str]]) -> None:
        if laravel_endpoint_manager.is_reachable(base_url) is False:
            return
        server = laravel_endpoint_manager.server_identity(base_url)
        server_id = str(server.get("server_id") or "")
        try:
            remote = bool(server_id) and bool(laravel_delivery_diff_client.info(base_url, server_id)["available"])
        except Exception as error:  # noqa: BLE001 - unreachable server: its next online edge reconciles again
            ColorPrint.yellow(f"[LaravelDelivery] reconcile {namespace} deferred: {error}")
            return
        local = not remote and base_url == laravel_endpoint_manager.get_active_base_url()
        enqueued_total = 0
        for name in (kinds or delivery_store.kinds()):
            definition = delivery_store.definition(name)
            if definition is None or definition.inventory is None:
                continue
            if definition.ready is not None and not definition.ready():
                continue
            if not remote and not (local and definition.legacy_reconcile):
                continue
            try:
                enqueued_total += self._reconcile_kind(definition, namespace, base_url, server_id, reason, remote)
            except Exception as error:  # noqa: BLE001 - one kind's failed diff never blocks the others
                ColorPrint.yellow(f"[LaravelDelivery] reconcile {namespace} kind={name} failed: {error}")
                self._note_diff(namespace, name, {"state": DIFF_STATE_FAILED, "error": str(error)[:300], "finished_at": _now()})
        for name in (kinds or delivery_store.kinds()):
            delivery_store.hurry_pending(name, namespace)
        if enqueued_total:
            ColorPrint.cyan(
                f"[LaravelDelivery] reconcile {namespace} ({reason}, {DIFF_MODE_REMOTE if remote else DIFF_MODE_LOCAL} diff) "
                f"enqueued={enqueued_total}"
            )
        delivery_scheduler.kick()

    def _reconcile_kind(
        self, definition: DeliveryKind, namespace: str, base_url: str, server_id: str, reason: str, remote: bool,
    ) -> int:
        """Inventory -> diff (remote per wire kind, else local) -> enqueue
        missing into the kind and stale into its ``stale_kind``, one bounded
        inventory page at a time so a large inventory never sits in memory."""
        kind = definition.name
        self._note_diff(namespace, kind, {
            "state": DIFF_STATE_RUNNING, "mode": DIFF_MODE_REMOTE if remote else DIFF_MODE_LOCAL,
            "reason": reason, "base_url": base_url, "phase": "inventory", "started_at": _now(),
            "finished_at": None, "processed": 0, "total": 0, "missing": 0, "stale": 0, "rejected": 0,
            "enqueued": 0, "error": "",
        })
        totals = {"total": 0, "processed": 0, "missing": 0, "stale": 0, "rejected": 0, "enqueued": 0}
        items: Dict[str, Dict[str, Any]] = {}
        wire: Dict[str, List[Dict[str, Any]]] = {}
        for item in definition.inventory():
            key = str(item.get("key") or "")
            if not key:
                continue
            diff_kind = str(item.get("diff_kind") or definition.diff_kind or kind)
            item_key = make_item_key(diff_kind, key)
            items[item_key] = {"hash": str(item.get("hash") or ""), "record": item.get("record") or {}}
            wire.setdefault(diff_kind, []).append(dict(item.get("wire") or {"key": key}))
            if len(items) >= RECONCILE_INVENTORY_PAGE:
                if not self._reconcile_page(definition, namespace, base_url, server_id, remote, items, wire, totals):
                    return totals["enqueued"]
                items, wire = {}, {}
        if items and not self._reconcile_page(definition, namespace, base_url, server_id, remote, items, wire, totals):
            return totals["enqueued"]
        self._note_diff(namespace, kind, {"state": DIFF_STATE_DONE, "phase": "done", "finished_at": _now(), **totals})
        return totals["enqueued"]

    def _reconcile_page(
        self,
        definition: DeliveryKind,
        namespace: str,
        base_url: str,
        server_id: str,
        remote: bool,
        items: Dict[str, Dict[str, Any]],
        wire: Dict[str, List[Dict[str, Any]]],
        totals: Dict[str, int],
    ) -> bool:
        """Diff and enqueue one inventory page; False when the diff failed."""
        kind = definition.name
        base = totals["processed"]
        totals["total"] += len(items)
        self._note_diff(namespace, kind, {"total": totals["total"], "phase": "diff"})
        missing: List[str] = []
        stale: List[str] = []
        if remote:
            done = 0
            for diff_kind, wire_items in wire.items():
                if not laravel_delivery_diff_client.supports(base_url, server_id, diff_kind):
                    self._note_diff(namespace, kind, {"error": f"server has no diff kind {diff_kind}"})
                    continue
                offset = base + done
                result = laravel_delivery_diff_client.diff(
                    base_url, server_id, diff_kind, wire_items,
                    progress=lambda update, start=offset: self._note_diff(namespace, kind, {"processed": start + int(update["processed"])}),
                )
                if not result.get("success"):
                    self._note_diff(namespace, kind, {
                        "state": DIFF_STATE_FAILED, "error": str(result.get("error") or "diff_failed"), "finished_at": _now(),
                    })
                    return False
                done += len(wire_items)
                totals["rejected"] += len(result["rejected"])
                for need in result["need"]:
                    item_key = make_item_key(diff_kind, str(need.get("key") or ""))
                    if item_key in items:
                        (stale if need.get("reason") == NEED_STALE else missing).append(item_key)
        else:
            missing, stale = self._local_diff(namespace, kind, {key: entry["hash"] for key, entry in items.items()}, base)
        for target, keys in ((kind, missing), (definition.stale_kind or kind, stale)):
            for start in range(0, len(keys), LOCAL_DIFF_PAGE):
                page = keys[start:start + LOCAL_DIFF_PAGE]
                totals["enqueued"] += delivery_store.enqueue_inventory(target, kind, namespace, {key: items[key] for key in page})
                self._note_diff(namespace, kind, {"phase": "enqueue", "enqueued": totals["enqueued"]})
        totals["processed"] += len(items)
        totals["missing"] += len(missing)
        totals["stale"] += len(stale)
        return True

    def _local_diff(self, namespace: str, kind: str, hashes: Dict[str, str], base: int = 0) -> Tuple[List[str], List[str]]:
        keys = list(hashes)
        missing: List[str] = []
        stale: List[str] = []
        for start in range(0, len(keys), LOCAL_DIFF_PAGE):
            page = keys[start:start + LOCAL_DIFF_PAGE]
            delivered = delivery_store.state_hashes(namespace, kind, page)
            for key in page:
                if key not in delivered:
                    missing.append(key)
                elif delivered[key] != hashes[key]:
                    stale.append(key)
            self._note_diff(namespace, kind, {"processed": base + start + len(page)})
        return missing, stale

    def on_laravel_online(self, payload: Any = None) -> None:
        """Offline -> online (or new server identity) edge of one endpoint:
        adopt its URL-namespaced state into its server namespace, then
        reconcile that server."""
        payload = payload if isinstance(payload, dict) else {}
        base_url = str(payload.get("base_url") or "")
        namespace = str(payload.get("namespace") or "") or laravel_endpoint_manager.delivery_namespace(base_url)
        previous = str(payload.get("previous_namespace") or "")
        if previous and previous != namespace and previous.startswith(URL_NAMESPACE_PREFIX):
            moved = delivery_store.adopt(previous, namespace)
            if moved:
                ColorPrint.cyan(f"[LaravelDelivery] {previous} identified as {namespace}; adopted {moved} entries")
        ColorPrint.cyan(
            f"[LaravelDelivery] Laravel {payload.get('reason') or 'online'} {base_url or 'default'} "
            f"({namespace}); reconciling"
        )
        for name in delivery_store.kinds():
            delivery_store.hurry_pending(name, namespace)
        delivery_scheduler.kick()
        self.reconcile(namespace, base_url, str(payload.get("reason") or "online"))

    def on_endpoint_switched(self, base_url: str) -> None:
        """The selection changed: rows parked for the newly selected server
        become deliverable at once, and a watcher waiting on the old one is
        woken to re-evaluate."""
        THREAD_BUS.signal(WATCH_WAKE_SIGNAL, True)
        for name in delivery_store.kinds():
            delivery_store.hurry_pending(name, laravel_endpoint_manager.delivery_namespace(base_url))
        self.reconcile(laravel_endpoint_manager.delivery_namespace(base_url), base_url, RECONCILE_REASON_SWITCH)
        delivery_scheduler.kick()


delivery_reconciler = DeliveryReconciler()
