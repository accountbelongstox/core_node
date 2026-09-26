# -*- coding: utf-8 -*-
"""Durable pycore -> Laravel delivery outbox shared by every producer.

One store, one scheduler, per-feature kinds, one namespace per Laravel
server:

  * namespace - every row, delivered-state entry and metric belongs to one
                Laravel server (``server:<server_id>``, or ``url:<base_url>``
                for a legacy server without an id; adopted into the server
                namespace once its id is learned). Completion on one server
                never counts for another.
  * kind      - registered once per feature (``DeliveryKind``): its deliver
                handler (single or batch), optional ``inventory`` of local
                items ``{key, hash, record}``, ordered post-payload steps,
                parallelism, backoff bounds and receipt policy.
  * row       - one idempotent delivery keyed by ``<namespace>|<logical id>``;
                ``item_key`` names the inventory item it delivers, an
                optional ``identity`` names the payload/endpoint pair so rows
                sharing it transfer the bytes once; ``group_key`` groups rows
                for per-owner counts (e.g. one orchestration task).
  * payload   - optional immutable local file copied under the cache root
                before delivery (``payload_path`` / ``payload_sha256``).
  * steps     - ``identity_delivered`` (payload accepted) plus the kind's
                ordered ``steps``; the current one is the indexed ``stage``.
  * state     - per namespace: delivered ``item_key`` / ``identity`` with
                its content hash. Only an optimization inside one server
                (skip a re-transfer, local diff for legacy servers); the
                server's diff is the authority.
  * reconcile - on every offline -> online edge of any Laravel endpoint, on
                an identity change, on switching endpoints and at start, each
                inventory kind sends its inventory to the server's diff API
                (``delivery_diff``) and enqueues exactly the missing / stale
                items for that server. A server without the diff API falls
                back to a local diff against its namespace's delivered state
                (kinds with ``legacy_reconcile``, active endpoint only).

Nothing runs at import: ``start()`` (service startup path) registers the
online edge, migrates and activates the registered kinds.

Storage is the indexed repository ``database/repositories/
laravel_delivery_repository.py``: every query is keyed or indexed and
bounded; nothing loads a whole table.

Handler contract: ``deliver(row, owner) -> {"status": "done" | "retry" |
"dead_letter", "error"?: str, "retry_at"?: float}`` (anything else is a
retry); ``deliver_batch(rows, owners) -> {delivery_id: outcome}``. ``row
["base_url"]`` is the endpoint of the row's server. The handler may persist
intermediate progress with ``patch``/``mark_identity_delivered``/``mark_step``
using the same ``owner``; an exception counts as ``retry`` (or dead letter
when the kind's ``permanent_error`` says so).
"""

import copy
import hashlib
import os
import shutil
import threading
import time
import uuid
from contextlib import ExitStack, contextmanager
from dataclasses import dataclass
from functools import partial, wraps
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Iterator, List, Optional, Tuple

from pycore.database.repositories.laravel_delivery_repository import (
    NAMESPACE_SEPARATOR,
    STATE_DEAD_LETTER,
    STATE_PENDING,
    LaravelDeliveryRepository,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    map_bus_tasks,
    serialized_method,
    start_bus_task,
)
from pycore.pyfoundations.system_paths import APP_CONFIG_DIR, get_app_cache_dir
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.common.http_progress_upload import http_progress_client
from pycore.pyutils.laravel.delivery_diff import NEED_STALE, laravel_delivery_diff_client
from pycore.pyutils.laravel.endpoint_manager import (
    LARAVEL_ONLINE_EVENT,
    LARAVEL_ONLINE_SIGNAL,
    laravel_endpoint_manager,
)
from pycore.pyutils.laravel.identity import URL_NAMESPACE_PREFIX


DELIVERY_OUTBOX_FILE = APP_CONFIG_DIR / "laravel_delivery.sqlite3"
DELIVERY_PROCESS_ID = f"{os.getpid()}:{uuid.uuid4().hex}"
DEFAULT_LEASE_SECONDS = 180.0
SIBLING_IN_FLIGHT_DEFER_SECONDS = 1.0
SIBLING_SCAN_LIMIT = 50
DRAIN_IDLE_WAIT_SECONDS = 30.0
# A row whose server has no known endpoint waits this long (no attempt, no
# failure metric); the server's online edge hurries it.
SERVER_OFFLINE_DEFER_SECONDS = 60.0
UNASSIGNED_MIGRATION_BATCH = 500
LOCAL_DIFF_PAGE = 500
# Centralized receipt retention: identity receipts only save a re-transfer
# of bytes Laravel already accepted (Laravel ingest is idempotent too).
# Inventory state is never pruned by age (it is the legacy-server diff base).
DELIVERY_RECEIPT_RETENTION_SECONDS = 7 * 24 * 3600.0
DELIVERY_RECEIPT_PRUNE_INTERVAL_SECONDS = 3600.0
ACTIVE_DELIVERY_PREFIX = "laravel.delivery.active"
DRAIN_WAKE_PREFIX = "laravel.delivery.wake"
PAYLOAD_STAGE = "payload"
RECEIPTS_NONE = "none"
RECEIPTS_IDENTITY = "identity"
OUTCOME_DONE = "done"
OUTCOME_RETRY = "retry"
OUTCOME_DEAD_LETTER = "dead_letter"
ERROR_SERVER_OFFLINE = "laravel_server_offline"
DIFF_MODE_REMOTE = "remote"
DIFF_MODE_LOCAL = "local"
DIFF_STATE_RUNNING = "running"
DIFF_STATE_DONE = "done"
DIFF_STATE_FAILED = "failed"
RECONCILE_REASON_START = "start"
RECONCILE_REASON_SWITCH = "switch"
RECONCILE_REASON_MANUAL = "manual"
RECONCILE_REASON_KIND = "kind_registered"
# v1 -> v2 upgrade: the namespace of the endpoint pycore delivered to before
# namespacing (the stored selection), and per kind whether its domain
# delivered-markers were seeded into it.
META_SEED_NAMESPACE = "seed_namespace"
META_SEEDED_PREFIX = "seeded:"
META_HASH_PREFIX = "hash:"


DeliverHandler = Callable[[Dict[str, Any], str], Dict[str, Any]]
BatchDeliverHandler = Callable[[List[Dict[str, Any]], Dict[str, str]], Dict[str, Dict[str, Any]]]
InventoryProvider = Callable[[], Iterable[Dict[str, Any]]]


@dataclass
class DeliveryKind:
    name: str
    deliver: Optional[DeliverHandler] = None
    deliver_batch: Optional[BatchDeliverHandler] = None
    inventory: Optional[InventoryProvider] = None
    legacy_reconcile: bool = False
    seed_markers: Optional[InventoryProvider] = None
    diff_kind: str = ""
    stale_kind: str = ""
    # Retired kinds whose rows / state / metrics fold into this kind.
    replaces: Tuple[str, ...] = ()
    on_delivered: Optional[Callable[[Dict[str, Any], Dict[str, Any]], None]] = None
    ready: Optional[Callable[[], bool]] = None
    permanent_error: Optional[Callable[[str], bool]] = None
    steps: Tuple[str, ...] = ()
    parallel: int = 1
    batch_limit: int = 25
    retry_initial_seconds: float = 5.0
    retry_max_seconds: float = 300.0
    receipts: str = RECEIPTS_NONE


def _now() -> float:
    return time.time()


def _active_delivery(owner: str) -> bool:
    worker = THREAD_BUS.get_signal(f"{ACTIVE_DELIVERY_PREFIX}.{owner}")
    return worker is not None and worker.is_alive()


def _lease_active(row: Dict[str, Any], now: float) -> bool:
    """A lease blocks only while its owner can still act: this process's
    running delivery, or another process's unexpired lease is ignored at
    restart (single pycore per data dir) by the repository query."""
    if str(row.get("lease_process") or "") == DELIVERY_PROCESS_ID:
        return _active_delivery(str(row.get("lease_owner") or "")) or float(row.get("lease_until") or 0) > now
    return False


def _stored_id(namespace: str, logical_id: str) -> str:
    return f"{namespace}{NAMESPACE_SEPARATOR}{logical_id}"


def _logical_id(delivery_id: str) -> str:
    return str(delivery_id).split(NAMESPACE_SEPARATOR, 1)[-1]


def _record_transaction(method: Any) -> Any:
    @wraps(method)
    def transaction(instance: Any, /, *args: Any, **kwargs: Any) -> Any:
        with instance._repository().transaction():
            return method(instance, *args, **kwargs)
    return transaction


class LaravelDeliveryOutbox:
    """Persist every pycore -> Laravel delivery until each step is accepted
    by the server (namespace) it belongs to."""

    def __init__(self) -> None:
        self._repo: Optional[LaravelDeliveryRepository] = None
        self._kinds: Dict[str, DeliveryKind] = {}
        self._draining: set = set()
        self._reconciling: Dict[str, List[Optional[List[str]]]] = {}
        self._diff_status: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self._receipts_pruned_at = 0.0
        self._started = False
        init_serialized_owner(self, "laravel.delivery_outbox", "LaravelDeliveryOutboxState")

    # ------------------------------------------------------------------ #
    # store                                                               #
    # ------------------------------------------------------------------ #
    def _repository(self) -> LaravelDeliveryRepository:
        if self._repo is None:
            self._repo = LaravelDeliveryRepository(DELIVERY_OUTBOX_FILE)
        return self._repo

    def _stage(self, row: Dict[str, Any]) -> str:
        if not row.get("identity_delivered"):
            return PAYLOAD_STAGE
        definition = self._kinds.get(str(row.get("kind") or ""))
        done = row.get("steps") or {}
        return next((step for step in (definition.steps if definition else ()) if not done.get(step)), "")

    def _save(self, row: Dict[str, Any]) -> None:
        row["stage"] = self._stage(row)
        row["updated_at"] = _now()
        self._repository().put(row)

    # ------------------------------------------------------------------ #
    # lifecycle                                                           #
    # ------------------------------------------------------------------ #
    def start(self) -> None:
        """Service startup: subscribe to the online / switch edges, place
        v1 rows into their server namespace and activate every kind (drain,
        reconcile the active endpoint). Idempotent."""
        if not self._mark_started():
            return
        THREAD_BUS.register_event_handler(LARAVEL_ONLINE_EVENT, self._on_laravel_online)
        laravel_endpoint_manager.register_endpoint_change_listener(self._on_endpoint_switched)
        start_bus_task(self._start_background, thread_name="LaravelDeliveryStart")

    @serialized_method
    def _mark_started(self) -> bool:
        if self._started:
            return False
        self._started = True
        return True

    @serialized_method
    def started(self) -> bool:
        return self._started

    def _start_background(self) -> None:
        self._migrate_v1()
        for name in self.kinds():
            self._fold_replaced(name)
            self._seed(name)
            # Rows still waiting out a backoff of a previous process become
            # ready at once.
            self.hurry_pending(name)
        laravel_endpoint_manager.resolve()
        self.reconcile(reason=RECONCILE_REASON_START)
        self.kick()

    @serialized_method
    def _migrate_v1(self) -> None:
        """v1 rows carry no namespace: a row that recorded its endpoint goes
        to that endpoint's namespace, any other row to the active endpoint's
        (where v1 would have delivered it). The seed namespace for domain
        delivered-markers is the stored selection."""
        repo = self._repository()
        if repo.previous_schema_version == 1 and not repo.meta(META_SEED_NAMESPACE):
            repo.set_meta(META_SEED_NAMESPACE, laravel_endpoint_manager.delivery_namespace(
                laravel_endpoint_manager.peek_stored_base_url(),
            ))
        moved = 0
        with repo.transaction():
            while True:
                rows = repo.unassigned(UNASSIGNED_MIGRATION_BATCH)
                if not rows:
                    break
                for row in rows:
                    namespace = laravel_endpoint_manager.delivery_namespace(str(row.get("base_url") or ""))
                    repo.delete(str(row["delivery_id"]))
                    row["namespace"] = namespace
                    row["pin_base_url"] = bool(row.get("base_url"))
                    row["delivery_id"] = _stored_id(namespace, str(row["delivery_id"]))
                    repo.put(row)
                    moved += 1
        if moved:
            ColorPrint.cyan(f"[LaravelDelivery] assigned {moved} un-namespaced deliveries to their Laravel server")

    def _seed(self, kind: str) -> None:
        """Once per kind after the v1 upgrade: domain delivered-markers of
        the pre-namespace era count for the server they were delivered to
        (the stored selection) and for no other."""
        definition = self._definition(kind)
        if definition is None or definition.seed_markers is None:
            return
        namespace = self._seed_namespace(kind)
        if not namespace:
            return
        seeded = self._seed_state(namespace, kind, [
            {"key": self.item_key(str(entry.get("diff_kind") or definition.diff_kind or kind), str(entry["key"])),
             "hash": str(entry.get("hash") or "")}
            for entry in definition.seed_markers()
        ])
        if seeded:
            ColorPrint.cyan(f"[LaravelDelivery] kind={kind} seeded {seeded} delivered markers into {namespace}")

    @serialized_method
    def _fold_replaced(self, kind: str) -> None:
        definition = self._kinds.get(kind)
        for retired in (definition.replaces if definition else ()):
            moved = self._repository().rename_kind(retired, kind)
            if moved:
                ColorPrint.cyan(f"[LaravelDelivery] folded {moved} entries of retired kind {retired} into {kind}")

    @serialized_method
    def _seed_namespace(self, kind: str) -> str:
        repo = self._repository()
        return "" if repo.meta(META_SEEDED_PREFIX + kind) else repo.meta(META_SEED_NAMESPACE)

    @serialized_method
    def _seed_state(self, namespace: str, kind: str, entries: List[Dict[str, Any]]) -> int:
        repo = self._repository()
        seeded = repo.seed_state(namespace, kind, entries, _now())
        repo.set_meta(META_SEEDED_PREFIX + kind, str(int(_now())))
        return seeded

    def cached_hash(self, scope: str, key: str, signature: str, compute: Optional[Callable[[], str]] = None) -> str:
        """Content hash of one local item, recomputed only when its cheap
        ``signature`` (e.g. size + mtime) changes; persisted so inventories
        do not re-read every file after a restart. Without ``compute`` a
        miss answers ''."""
        meta_key = f"{META_HASH_PREFIX}{scope}:{key}"
        cached = self.meta_value(meta_key)
        if cached.startswith(f"{signature}{NAMESPACE_SEPARATOR}"):
            return cached[len(signature) + 1:]
        if compute is None:
            return ""
        value = str(compute() or "")
        self.set_meta_value(meta_key, f"{signature}{NAMESPACE_SEPARATOR}{value}")
        return value

    @serialized_method
    def meta_value(self, key: str) -> str:
        """Small persisted outbox-side value (e.g. a kind's one-time
        bootstrap marker)."""
        return self._repository().meta(key)

    @serialized_method
    def set_meta_value(self, key: str, value: str) -> None:
        self._repository().set_meta(key, value)

    # ------------------------------------------------------------------ #
    # kinds                                                               #
    # ------------------------------------------------------------------ #
    @serialized_method
    def register(self, kind: DeliveryKind) -> None:
        """Register (or re-register) one feature's delivery kind. No I/O
        before ``start()``; afterwards the kind drains and reconciles the
        active endpoint at once."""
        self._kinds[kind.name] = kind
        if self._started:
            start_bus_task(self._activate, kind.name, thread_name=f"LaravelDeliveryActivate-{kind.name[:16]}")

    def _activate(self, kind: str) -> None:
        self._fold_replaced(kind)
        self._seed(kind)
        self.hurry_pending(kind)
        self.reconcile(reason=RECONCILE_REASON_KIND, kinds=[kind])
        self.kick(kind)

    @serialized_method
    def kinds(self) -> List[str]:
        return sorted(self._kinds)

    @serialized_method
    def _definition(self, kind: str) -> Optional[DeliveryKind]:
        return self._kinds.get(kind)

    @staticmethod
    def delivery_id(kind: str, *parts: Any) -> str:
        return ":".join([str(kind), *(str(part if part is not None else "").strip() for part in parts)])

    @staticmethod
    def item_key(diff_kind: str, key: str) -> str:
        """Outbox item key of one inventory item (``<diff kind>:<wire key>``)."""
        return f"{diff_kind}:{key}"

    @staticmethod
    def retry_delay(attempts: int, initial_seconds: float, maximum_seconds: float) -> float:
        exponent = max(0, min(int(attempts) - 1, 8))
        return min(float(maximum_seconds), float(initial_seconds) * (2 ** exponent))

    # ------------------------------------------------------------------ #
    # namespaces                                                          #
    # ------------------------------------------------------------------ #
    @staticmethod
    def active_namespace() -> str:
        return laravel_endpoint_manager.delivery_namespace()

    @staticmethod
    def target_namespaces() -> List[str]:
        """Servers a new item goes to: the active endpoint's plus every
        other configured server currently observed reachable."""
        namespaces = [laravel_endpoint_manager.delivery_namespace()]
        for server in laravel_endpoint_manager.known_servers():
            if server.get("reachable") and server["namespace"] not in namespaces:
                namespaces.append(server["namespace"])
        return namespaces

    # ------------------------------------------------------------------ #
    # enqueue                                                             #
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
            staged.update(self._retain_payload(kind, staged, payload_file))
        if namespace:
            namespaces = [namespace]
        elif staged.get("base_url") or staged.get("pin_base_url"):
            namespaces = [laravel_endpoint_manager.delivery_namespace(str(staged.get("base_url") or ""))]
        else:
            namespaces = self.target_namespaces()
        rows = [self._put(staged, name, only_new) for name in namespaces]
        if kick:
            self.kick(kind)
        return rows[0]

    @staticmethod
    def _retain_payload(kind: str, record: Dict[str, Any], payload_file: str) -> Dict[str, Any]:
        source_path = Path(payload_file).resolve()
        source_sha256 = hashlib.sha256(source_path.read_bytes()).hexdigest()
        retained_key = str(record.get("identity") or "").strip() or str(record["delivery_id"])
        retained_path = (
            get_app_cache_dir().resolve()
            / "laravel_delivery"
            / kind
            / hashlib.sha1(retained_key.encode("utf-8")).hexdigest()
            / f"{source_sha256}{source_path.suffix or '.bin'}"
        )
        retained_path.parent.mkdir(parents=True, exist_ok=True)
        if retained_path.is_file():
            if hashlib.sha256(retained_path.read_bytes()).hexdigest() != source_sha256:
                raise ValueError("retained payload digest conflicts with the staged delivery")
        else:
            shutil.copy2(str(source_path), str(retained_path))
        return {"payload_path": str(retained_path), "payload_sha256": source_sha256}

    def _inherit_identity(self, row: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Adopt a delivered identity of the SAME server from its state
        entry or a live sibling; returns the live siblings (bounded)."""
        identity = str(row.get("identity") or "").strip()
        if not identity:
            return []
        kind = str(row.get("kind") or "")
        namespace = str(row.get("namespace") or "")
        sha256 = str(row.get("payload_sha256") or "")
        siblings = self._repository().identity_rows(
            kind, namespace, identity, str(row["delivery_id"]), sha256, SIBLING_SCAN_LIMIT,
        )
        if row.get("identity_delivered"):
            return siblings
        shared = row.get("shared_item") or {}
        if shared.get("kind") and shared.get("item_key") and self._repository().get_state(
            namespace, str(shared["kind"]), str(shared["item_key"]),
        ):
            # The same clip already reached this server through the kind
            # that owns it (e.g. the audio cache batch): no second transfer.
            row["identity_delivered"] = True
            row["identity_receipt"] = {"uploaded": True, "error": "", "via": str(shared["kind"])}
            return siblings
        receipt = self._repository().get_state(namespace, kind, identity)
        if receipt and (not sha256 or not receipt["content_hash"] or receipt["content_hash"] == sha256):
            row["identity_delivered"] = True
            row["identity_receipt"] = receipt["receipt"]
            return siblings
        for sibling in siblings:
            if sibling.get("identity_delivered"):
                row["identity_delivered"] = True
                row["identity_receipt"] = copy.deepcopy(sibling.get("identity_receipt") or {})
                break
        return siblings

    @serialized_method
    @_record_transaction
    def _put(self, record: Dict[str, Any], namespace: str, only_new: bool = False) -> Dict[str, Any]:
        logical_id = str(record.get("delivery_id") or "").strip()
        kind = str(record.get("kind") or "").strip()
        if not logical_id or not kind or not namespace:
            raise ValueError("delivery requires delivery_id, kind and a Laravel server namespace")
        delivery_id = _stored_id(namespace, logical_id)
        current = self._repository().get(delivery_id) or {}
        if current and only_new:
            return current
        item_key = str(record.get("item_key") or "")
        if item_key and not current:
            delivered = self._repository().get_state(namespace, str(record.get("state_kind") or kind), item_key)
            if delivered is not None and delivered["content_hash"] == str(record.get("content_hash") or ""):
                # Local optimization inside this server only; the server's
                # diff re-opens the item when it is actually missing.
                return {"delivery_id": delivery_id, "namespace": namespace, "already_delivered": True}
        current_sha256 = str(current.get("payload_sha256") or "")
        proposed_sha256 = str(record.get("payload_sha256") or "")
        if current_sha256 and proposed_sha256 and current_sha256 != proposed_sha256:
            raise ValueError("delivery payload digest conflicts with the idempotent step")
        row = copy.deepcopy(current)
        row.update(copy.deepcopy(record))
        row["delivery_id"] = delivery_id
        row["namespace"] = namespace
        row.setdefault("created_at", _now())
        row.setdefault("state", STATE_PENDING)
        row.setdefault("identity_delivered", False)
        row.setdefault("identity_receipt", {})
        row.setdefault("steps", {})
        row.setdefault("delivery_attempts", 0)
        row.setdefault("next_attempt_at", 0.0)
        if current:
            for key in ("created_at", "state", "identity_delivered", "identity_receipt", "lease_owner", "lease_process", "lease_until"):
                row[key] = copy.deepcopy(current[key])
            row["steps"] = {
                **(record.get("steps") or {}),
                **{name: True for name, done in (current.get("steps") or {}).items() if done},
            }
            row["delivery_attempts"] = max(int(current.get("delivery_attempts") or 0), int(record.get("delivery_attempts") or 0))
            current_payload = str(current.get("payload_path") or "")
            if current_payload and os.path.isfile(current_payload):
                row["payload_path"] = current_payload
                row["payload_sha256"] = current_sha256
        self._inherit_identity(row)
        self._save(row)
        return copy.deepcopy(row)

    # ------------------------------------------------------------------ #
    # lease                                                               #
    # ------------------------------------------------------------------ #
    @contextmanager
    def delivery_scope(self, delivery_id: str, owner: str) -> Iterator[None]:
        active_signal = f"{ACTIVE_DELIVERY_PREFIX}.{owner}"
        THREAD_BUS.signal(active_signal, threading.current_thread())
        try:
            with http_progress_client.transfer_scope(partial(self.renew, delivery_id, owner)):
                yield
        finally:
            THREAD_BUS.clear_signal(active_signal)

    @serialized_method
    @_record_transaction
    def claim(
        self,
        delivery_id: str,
        owner: str,
        lease_seconds: float = DEFAULT_LEASE_SECONDS,
    ) -> Optional[Dict[str, Any]]:
        row = self._repository().get(str(delivery_id))
        now = _now()
        if not row or row["state"] != STATE_PENDING or _lease_active(row, now):
            return None
        for sibling in self._inherit_identity(row):
            if _lease_active(sibling, now):
                # One transfer per identity in flight; the sibling's receipt
                # is inherited on the next claim.
                row["next_attempt_at"] = now + SIBLING_IN_FLIGHT_DEFER_SECONDS
                self._save(row)
                return None
        row["lease_owner"] = str(owner)
        row["lease_process"] = DELIVERY_PROCESS_ID
        row["lease_until"] = now + max(1.0, float(lease_seconds))
        self._save(row)
        return copy.deepcopy(row)

    @serialized_method
    @_record_transaction
    def renew(self, delivery_id: str, owner: str, progress: Dict[str, Any]) -> None:
        row = self._repository().get(str(delivery_id))
        now = _now()
        if row is None or str(row.get("lease_owner") or "") != owner:
            raise RuntimeError("Laravel delivery ownership changed during upload")
        if float(row.get("lease_until") or 0) - now > DEFAULT_LEASE_SECONDS / 2:
            return
        row["lease_until"] = now + DEFAULT_LEASE_SECONDS
        self._save(row)

    @serialized_method
    @_record_transaction
    def patch(self, delivery_id: str, patch: Dict[str, Any], owner: str = "") -> Optional[Dict[str, Any]]:
        row = self._repository().get(str(delivery_id))
        if not row:
            if owner:
                raise RuntimeError("Laravel delivery record disappeared during delivery")
            return None
        if owner and str(row.get("lease_owner") or "") != str(owner):
            raise RuntimeError("Laravel delivery ownership changed during delivery")
        row.update(copy.deepcopy(patch))
        self._save(row)
        return copy.deepcopy(row)

    def mark_identity_delivered(self, delivery_id: str, owner: str, receipt: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        return self.patch(delivery_id, {
            "identity_delivered": True,
            "identity_receipt": dict(receipt or {}),
            "last_error": "",
        }, owner=owner)

    @serialized_method
    @_record_transaction
    def mark_step(self, delivery_id: str, owner: str, step: str) -> Optional[Dict[str, Any]]:
        row = self._repository().get(str(delivery_id))
        if not row or str(row.get("lease_owner") or "") != str(owner):
            raise RuntimeError("Laravel delivery ownership changed during delivery")
        row["steps"] = {**(row.get("steps") or {}), str(step): True}
        row["last_error"] = ""
        self._save(row)
        return copy.deepcopy(row)

    def _unlease(self, row: Dict[str, Any], **fields: Any) -> None:
        row.update(fields)
        row.update({"lease_owner": "", "lease_process": "", "lease_until": 0.0})
        self._save(row)

    @serialized_method
    @_record_transaction
    def release(
        self, delivery_id: str, owner: str, *, error: str = "", retry_at: float = 0.0, count_failure: bool = True,
    ) -> Optional[Dict[str, Any]]:
        row = self._repository().get(str(delivery_id))
        if not row or str(row.get("lease_owner") or "") != str(owner):
            return None
        self._unlease(row, last_error=str(error or "")[:500], next_attempt_at=max(0.0, float(retry_at)))
        if count_failure:
            self._repository().note_metrics(row["namespace"], row["kind"], _now(), False, str(error or ""), False)
        return copy.deepcopy(row)

    @serialized_method
    @_record_transaction
    def complete(self, delivery_id: str, owner: str = "") -> bool:
        row = self._repository().get(str(delivery_id))
        if not row or (owner and str(row.get("lease_owner") or "") != str(owner)):
            return False
        kind = row["kind"]
        namespace = row["namespace"]
        definition = self._kinds.get(kind)
        now = _now()
        identity = str(row.get("identity") or "").strip()
        item_key = str(row.get("item_key") or "").strip()
        if item_key:
            self._repository().put_state(
                namespace, str(row.get("state_kind") or kind), item_key, str(row.get("content_hash") or ""), {"delivery_id": _logical_id(delivery_id)}, now,
            )
        elif definition is not None and definition.receipts == RECEIPTS_IDENTITY and identity and row.get("identity_delivered"):
            self._repository().put_state(
                namespace, kind, identity, str(row.get("payload_sha256") or ""), dict(row.get("identity_receipt") or {}), now,
            )
        shared = row.get("shared_item") or {}
        if shared.get("kind") and shared.get("item_key") and (row.get("identity_receipt") or {}).get("uploaded"):
            # This row carried the clip itself: the owning kind sees it as
            # delivered to this server and does not upload it again.
            self._repository().put_state(
                namespace, str(shared["kind"]), str(shared["item_key"]), "", {"via": kind}, now,
            )
        self._repository().delete(str(delivery_id))
        self._repository().note_metrics(namespace, kind, now, True, "", False)
        if now - self._receipts_pruned_at >= DELIVERY_RECEIPT_PRUNE_INTERVAL_SECONDS:
            self._receipts_pruned_at = now
            pruned = self._repository().prune_state(
                [name for name, entry in self._kinds.items() if entry.receipts == RECEIPTS_IDENTITY],
                now - DELIVERY_RECEIPT_RETENTION_SECONDS,
            )
            if pruned:
                ColorPrint.gray(f"[LaravelDelivery] pruned {pruned} delivery receipts past retention")
        return True

    @serialized_method
    @_record_transaction
    def mark_dead_letter(self, delivery_id: str, owner: str, error: str) -> bool:
        row = self._repository().get(str(delivery_id))
        if not row or str(row.get("lease_owner") or "") != str(owner):
            return False
        self._unlease(row, state=STATE_DEAD_LETTER, last_error=str(error or "")[:500], next_attempt_at=0.0)
        self._repository().note_metrics(row["namespace"], row["kind"], _now(), False, str(error or ""), True)
        return True

    # ------------------------------------------------------------------ #
    # queries (indexed, bounded)                                          #
    # ------------------------------------------------------------------ #
    @serialized_method
    def list_ready(self, kind: str, limit: int = 100) -> List[Dict[str, Any]]:
        now = _now()
        return [
            row for row in self._repository().ready(kind, now, DELIVERY_PROCESS_ID, limit)
            if not _lease_active(row, now)
        ]

    def counts_by_group(self, kind: str, namespace: Optional[str] = None) -> Dict[str, Dict[str, int]]:
        """Per ``group_key`` of one server (default: the active one):
        pending / dead-letter row counts (GROUP BY)."""
        return self._group_counts(kind, namespace or self.active_namespace())

    @serialized_method
    def _group_counts(self, kind: str, namespace: str) -> Dict[str, Dict[str, int]]:
        return self._repository().group_counts(kind, namespace)

    def delivered_hashes(self, kind: str, keys: List[str], namespace: Optional[str] = None) -> Dict[str, str]:
        """Delivered-state content hash per item key on one server (default:
        the active one); a local view, not the server's authority."""
        return self._state_hashes(namespace or self.active_namespace(), kind, keys)

    @serialized_method
    def _state_hashes(self, namespace: str, kind: str, keys: List[str]) -> Dict[str, str]:
        return self._repository().state_hashes(namespace, kind, keys)

    @serialized_method
    def retry_dead_letters(self, kind: str) -> int:
        return self._repository().retry_dead_letters(kind, _now())

    @serialized_method
    def hurry_pending(self, kind: str, namespace: Optional[str] = None) -> int:
        """Reset the backoff of every waiting row of the kind (reconnect)."""
        return self._repository().hurry(kind, _now(), namespace)

    @serialized_method
    def stats(self, kind: str) -> Dict[str, Any]:
        definition = self._kinds.get(kind)
        now = _now()
        groups = self._repository().stage_counts(kind, now)
        namespaces = sorted(
            {group["namespace"] for group in groups}
            | {namespace for namespace, entries in self._diff_status.items() if kind in entries}
        )
        steps = (definition.steps if definition else ())
        by_namespace: Dict[str, Dict[str, Any]] = {}
        for namespace in namespaces:
            scoped = [group for group in groups if group["namespace"] == namespace]
            by_namespace[namespace] = self._scoped_stats(kind, namespace, scoped, steps)
        pending = [group for group in groups if group["state"] == STATE_PENDING]
        by_stage: Dict[str, int] = {PAYLOAD_STAGE: 0, **{step: 0 for step in steps}}
        for group in pending:
            if group["stage"]:
                by_stage[group["stage"]] = by_stage.get(group["stage"], 0) + group["count"]
        return {
            "kind": kind,
            "registered": definition is not None,
            "inventory": definition is not None and definition.inventory is not None,
            "total": sum(group["count"] for group in groups),
            "pending": sum(group["count"] for group in pending),
            "in_flight": sum(group["leased"] for group in pending),
            "dead_letter": sum(group["count"] for group in groups if group["state"] == STATE_DEAD_LETTER),
            "delivered_receipts": sum(entry["delivered_state"] for entry in by_namespace.values()),
            "by_stage": by_stage,
            "oldest_pending_at": min((group["oldest"] for group in pending), default=None),
            "next_retry_at": min((group["next_attempt_at"] for group in pending), default=None) or None,
            "last_error": next((entry["last_error"] for entry in by_namespace.values() if entry["last_error"]), ""),
            "delivered": sum(entry["delivered"] for entry in by_namespace.values()),
            "failures": sum(entry["failures"] for entry in by_namespace.values()),
            "last_delivered_at": max((entry["last_delivered_at"] or 0 for entry in by_namespace.values()), default=0) or None,
            "last_failure": next((entry["last_failure"] for entry in by_namespace.values() if entry["last_failure"]), ""),
            "last_failure_at": max((entry["last_failure_at"] or 0 for entry in by_namespace.values()), default=0) or None,
            "running": kind in self._draining,
            "by_namespace": by_namespace,
        }

    def _scoped_stats(self, kind: str, namespace: str, groups: List[Dict[str, Any]], steps: Tuple[str, ...]) -> Dict[str, Any]:
        pending = [group for group in groups if group["state"] == STATE_PENDING]
        by_stage: Dict[str, int] = {PAYLOAD_STAGE: 0, **{step: 0 for step in steps}}
        for group in pending:
            if group["stage"]:
                by_stage[group["stage"]] = by_stage.get(group["stage"], 0) + group["count"]
        metrics = self._repository().metrics(namespace, kind)
        return {
            "pending": sum(group["count"] for group in pending),
            "in_flight": sum(group["leased"] for group in pending),
            "dead_letter": sum(group["count"] for group in groups if group["state"] == STATE_DEAD_LETTER),
            "by_stage": by_stage,
            "next_retry_at": min((group["next_attempt_at"] for group in pending), default=None) or None,
            "delivered_state": self._repository().state_count(namespace, kind),
            "last_error": self._repository().last_error(kind, namespace),
            "delivered": int(metrics.get("delivered") or 0),
            "failures": int(metrics.get("failures") or 0),
            "last_delivered_at": metrics.get("last_delivered_at"),
            "last_failure": metrics.get("last_error") or "",
            "last_failure_at": metrics.get("last_error_at"),
            "diff": copy.deepcopy((self._diff_status.get(namespace) or {}).get(kind) or {}),
        }

    def status(self) -> Dict[str, Any]:
        online = THREAD_BUS.get_signal(LARAVEL_ONLINE_SIGNAL) or {}
        return {
            "kinds": {name: self.stats(name) for name in self.kinds()},
            "servers": laravel_endpoint_manager.known_servers(),
            "active_namespace": self.active_namespace(),
            "reconciling": self._reconciling_namespaces(),
            "laravel_online_at": online.get("at") if isinstance(online, dict) else None,
            "laravel_base_url": laravel_endpoint_manager.get_active_base_url(),
        }

    @serialized_method
    def running(self, kind: str) -> bool:
        return kind in self._draining

    # ------------------------------------------------------------------ #
    # scheduler                                                           #
    # ------------------------------------------------------------------ #
    @serialized_method
    def _begin_drain(self, kind: str) -> bool:
        if (
            not self._started
            or kind in self._draining
            or kind not in self._kinds
            or not self._repository().has_pending(kind)
        ):
            return False
        self._draining.add(kind)
        return True

    @serialized_method
    def _end_drain(self, kind: str, force: bool = False) -> bool:
        """Atomic with ``_put`` on the owner thread: a row enqueued before
        this check keeps the drain alive, one enqueued after it starts a new
        drain through ``kick``."""
        if not force and self._repository().has_pending(kind):
            return False
        self._draining.discard(kind)
        return True

    @serialized_method
    def _next_attempt_at(self, kind: str) -> Optional[float]:
        return self._repository().next_attempt_at(kind)

    def kick(self, kind: Optional[str] = None) -> None:
        """Start the drain of one kind (or all kinds) when rows are waiting
        (no-op before ``start()``)."""
        if THREAD_BUS.is_shutdown_requested():
            return
        for name in ([kind] if kind else self.kinds()):
            THREAD_BUS.signal(f"{DRAIN_WAKE_PREFIX}.{name}", True)
            if self._begin_drain(name):
                start_bus_task(self._drain, name, thread_name=f"LaravelDelivery-{name[:24]}")

    def _drain(self, kind: str) -> None:
        finished = False
        try:
            finished = self._drain_rows(kind)
        finally:
            if not finished:
                self._end_drain(kind, force=True)

    def _drain_rows(self, kind: str) -> bool:
        definition = self._definition(kind)
        wake = f"{DRAIN_WAKE_PREFIX}.{kind}"
        while definition is not None and not THREAD_BUS.is_shutdown_requested():
            if definition.ready is not None and not definition.ready():
                return False
            THREAD_BUS.clear_signal(wake)
            ready = self._unique_identities(self.list_ready(kind, definition.batch_limit))
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
            if self._end_drain(kind):
                return True
            next_attempt = self._next_attempt_at(kind)
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
        """Pinned rows (a task of one endpoint) keep their endpoint; every
        other row goes through an endpoint of its server."""
        if row.get("pin_base_url") and row.get("base_url"):
            return str(row["base_url"])
        return laravel_endpoint_manager.base_url_for_namespace(str(row.get("namespace") or ""))

    def _begin_row(self, record: Dict[str, Any], owner: str) -> Optional[Dict[str, Any]]:
        """Claim one row and bind its server endpoint; a row of a server
        without a known endpoint waits (no attempt counted)."""
        delivery_id = str(record.get("delivery_id") or "")
        claimed = self.claim(delivery_id, owner)
        if not claimed:
            return None
        base_url = self._target_base_url(claimed)
        if not base_url:
            self.release(
                delivery_id, owner, error=ERROR_SERVER_OFFLINE,
                retry_at=_now() + SERVER_OFFLINE_DEFER_SECONDS, count_failure=False,
            )
            return None
        attempts = int(claimed.get("delivery_attempts") or 0) + 1
        self.patch(delivery_id, {"delivery_attempts": attempts, "last_attempt_at": _now(), "base_url": base_url}, owner=owner)
        claimed["delivery_attempts"] = attempts
        claimed["base_url"] = base_url
        return claimed

    def _failure_outcome(self, definition: DeliveryKind, delivery_id: str, error: Exception) -> Dict[str, Any]:
        permanent = definition.permanent_error is not None and definition.permanent_error(str(error))
        ColorPrint.yellow(
            f"[LaravelDelivery] kind={definition.name} delivery={delivery_id} "
            f"{'dead-lettered' if permanent else 'deferred'}: {error}"
        )
        return {"status": OUTCOME_DEAD_LETTER if permanent else OUTCOME_RETRY, "error": str(error)}

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
                outcome = self._failure_outcome(definition, delivery_id, error)
        return self._settle(definition, claimed, owner, outcome)

    def _deliver_group(self, definition: DeliveryKind, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """One batch request per server for small items; each row keeps its
        own lease, outcome and retry."""
        owners = {
            str(record.get("delivery_id") or ""): f"{DELIVERY_PROCESS_ID}:{record.get('delivery_id')}:{time.monotonic_ns()}"
            for record in records
        }
        with ExitStack() as scopes:
            for delivery_id, owner in owners.items():
                scopes.enter_context(self.delivery_scope(delivery_id, owner))
            claimed = [row for row in (self._begin_row(record, owners[str(record.get("delivery_id") or "")]) for record in records) if row]
            if not claimed:
                return []
            try:
                outcomes = definition.deliver_batch(claimed, {row["delivery_id"]: owners[row["delivery_id"]] for row in claimed}) or {}
            except Exception as error:  # noqa: BLE001 - a failed batch defers its rows
                outcomes = {row["delivery_id"]: self._failure_outcome(definition, row["delivery_id"], error) for row in claimed}
            # Rows the batch did not take (legacy server, unbatchable size)
            # go through the single-row handler.
            for row in claimed:
                if row["delivery_id"] in outcomes or definition.deliver is None:
                    continue
                try:
                    outcomes[row["delivery_id"]] = definition.deliver(row, owners[row["delivery_id"]]) or {}
                except Exception as error:  # noqa: BLE001 - one row's failure defers only that row
                    outcomes[row["delivery_id"]] = self._failure_outcome(definition, row["delivery_id"], error)
        return [
            self._settle(definition, row, owners[row["delivery_id"]], outcomes.get(row["delivery_id"]) or {})
            for row in claimed
        ]

    def _settle(self, definition: DeliveryKind, claimed: Dict[str, Any], owner: str, outcome: Dict[str, Any]) -> Dict[str, Any]:
        delivery_id = str(claimed.get("delivery_id") or "")
        status = str(outcome.get("status") or OUTCOME_RETRY)
        error = str(outcome.get("error") or "")
        if status == OUTCOME_DONE:
            if not self.complete(delivery_id, owner):
                return {"delivery_id": delivery_id, "processed": True, "success": False, "error": "delivery_ownership_changed"}
            if definition.on_delivered is not None:
                definition.on_delivered(claimed, outcome)
            return {"delivery_id": delivery_id, "processed": True, "success": True}
        if status == OUTCOME_DEAD_LETTER:
            self.mark_dead_letter(delivery_id, owner, error)
        else:
            retry_at = float(outcome.get("retry_at") or 0.0) or _now() + self.retry_delay(
                int(claimed.get("delivery_attempts") or 1), definition.retry_initial_seconds, definition.retry_max_seconds,
            )
            self.release(delivery_id, owner, error=error, retry_at=retry_at)
        return {"delivery_id": delivery_id, "processed": True, "success": False, "error": error}

    # ------------------------------------------------------------------ #
    # reconcile (Laravel-driven diff)                                     #
    # ------------------------------------------------------------------ #
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
    def _reconciling_namespaces(self) -> List[str]:
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
        if not self.started() or THREAD_BUS.is_shutdown_requested():
            return
        base_url = base_url or (laravel_endpoint_manager.base_url_for_namespace(namespace) if namespace else "")
        base_url = base_url or laravel_endpoint_manager.get_active_base_url()
        namespace = namespace or laravel_endpoint_manager.delivery_namespace(base_url)
        if not self._begin_reconcile(namespace, kinds):
            return
        start_bus_task(
            self._reconcile_loop, namespace, base_url, reason, kinds,
            thread_name=f"LaravelDeliveryReconcile-{namespace[-12:]}",
        )

    def reconcile_reachable(self, reason: str = RECONCILE_REASON_MANUAL) -> None:
        """Reconcile every configured server currently observed reachable
        (and the active one)."""
        seen = set()
        for server in [laravel_endpoint_manager.server_identity(), *laravel_endpoint_manager.known_servers()]:
            if server["namespace"] in seen or server.get("reachable") is False:
                continue
            seen.add(server["namespace"])
            self.reconcile(server["namespace"], server["url"], reason)

    def reconcile_once(self, kinds: List[str]) -> None:
        """Reconcile the active server for the kinds not diffed (or failed)
        there in this process, e.g. a kind whose ``ready`` just turned on."""
        namespace = self.active_namespace()
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
        for name in (kinds or self.kinds()):
            definition = self._definition(name)
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
        for name in (kinds or self.kinds()):
            self.hurry_pending(name, namespace)
        if enqueued_total:
            ColorPrint.cyan(
                f"[LaravelDelivery] reconcile {namespace} ({reason}, {DIFF_MODE_REMOTE if remote else DIFF_MODE_LOCAL} diff) "
                f"enqueued={enqueued_total}"
            )
        self.kick()

    def _reconcile_kind(
        self, definition: DeliveryKind, namespace: str, base_url: str, server_id: str, reason: str, remote: bool,
    ) -> int:
        """Inventory -> diff (remote per wire kind, else local) -> enqueue
        missing into the kind and stale into its ``stale_kind``."""
        kind = definition.name
        self._note_diff(namespace, kind, {
            "state": DIFF_STATE_RUNNING, "mode": DIFF_MODE_REMOTE if remote else DIFF_MODE_LOCAL,
            "reason": reason, "base_url": base_url, "phase": "inventory", "started_at": _now(),
            "finished_at": None, "processed": 0, "total": 0, "missing": 0, "stale": 0, "rejected": 0,
            "enqueued": 0, "error": "",
        })
        items: Dict[str, Dict[str, Any]] = {}
        wire: Dict[str, List[Dict[str, Any]]] = {}
        for item in definition.inventory():
            key = str(item.get("key") or "")
            if not key:
                continue
            diff_kind = str(item.get("diff_kind") or definition.diff_kind or kind)
            item_key = self.item_key(diff_kind, key)
            items[item_key] = {"hash": str(item.get("hash") or ""), "record": item.get("record") or {}}
            wire.setdefault(diff_kind, []).append(dict(item.get("wire") or {"key": key}))
        self._note_diff(namespace, kind, {"total": len(items), "phase": "diff"})
        missing: List[str] = []
        stale: List[str] = []
        rejected = 0
        if remote:
            done = 0
            for diff_kind, wire_items in wire.items():
                if not laravel_delivery_diff_client.supports(base_url, server_id, diff_kind):
                    self._note_diff(namespace, kind, {"error": f"server has no diff kind {diff_kind}"})
                    continue
                offset = done
                result = laravel_delivery_diff_client.diff(
                    base_url, server_id, diff_kind, wire_items,
                    progress=lambda update, base=offset: self._note_diff(namespace, kind, {"processed": base + int(update["processed"])}),
                )
                if not result.get("success"):
                    self._note_diff(namespace, kind, {
                        "state": DIFF_STATE_FAILED, "error": str(result.get("error") or "diff_failed"), "finished_at": _now(),
                    })
                    return 0
                done += len(wire_items)
                rejected += len(result["rejected"])
                for need in result["need"]:
                    item_key = self.item_key(diff_kind, str(need.get("key") or ""))
                    if item_key in items:
                        (stale if need.get("reason") == NEED_STALE else missing).append(item_key)
        else:
            missing, stale = self._local_diff(namespace, kind, {key: entry["hash"] for key, entry in items.items()})
        enqueued = 0
        for target, keys in ((kind, missing), (definition.stale_kind or kind, stale)):
            for start in range(0, len(keys), LOCAL_DIFF_PAGE):
                page = keys[start:start + LOCAL_DIFF_PAGE]
                enqueued += self._enqueue_diff(target, kind, namespace, {key: items[key] for key in page})
                self._note_diff(namespace, kind, {"phase": "enqueue", "enqueued": enqueued})
        self._note_diff(namespace, kind, {
            "state": DIFF_STATE_DONE, "phase": "done", "processed": len(items), "missing": len(missing),
            "stale": len(stale), "rejected": rejected, "enqueued": enqueued, "finished_at": _now(),
        })
        return enqueued

    def _local_diff(self, namespace: str, kind: str, hashes: Dict[str, str]) -> Tuple[List[str], List[str]]:
        keys = list(hashes)
        missing: List[str] = []
        stale: List[str] = []
        for start in range(0, len(keys), LOCAL_DIFF_PAGE):
            page = keys[start:start + LOCAL_DIFF_PAGE]
            delivered = self._state_hashes(namespace, kind, page)
            for key in page:
                if key not in delivered:
                    missing.append(key)
                elif delivered[key] != hashes[key]:
                    stale.append(key)
            self._note_diff(namespace, kind, {"processed": start + len(page)})
        return missing, stale

    @serialized_method
    @_record_transaction
    def _enqueue_diff(self, kind: str, state_kind: str, namespace: str, items: Dict[str, Dict[str, Any]]) -> int:
        """The server's answer wins: its delivered-state entries for these
        keys are dropped and each key gets a pending row of ``kind`` (an
        existing row is kept; a dead letter stays for the operator). The row
        writes its delivered state under the inventory kind ``state_kind``."""
        repo = self._repository()
        keys = list(items)
        repo.forget_state(namespace, state_kind, keys)
        existing = repo.pending_item_keys(namespace, kind, keys)
        enqueued = 0
        for key, entry in items.items():
            if not entry["record"] or key in existing:
                continue
            staged = copy.deepcopy(entry["record"])
            staged["kind"] = kind
            staged["item_key"] = key
            staged["state_kind"] = state_kind
            staged["content_hash"] = entry["hash"]
            staged.setdefault("delivery_id", self.delivery_id(kind, key, entry["hash"]))
            self._put(staged, namespace)
            enqueued += 1
        return enqueued

    def _on_laravel_online(self, payload: Any = None) -> None:
        """Offline -> online (or new server identity) edge of one endpoint:
        adopt its URL-namespaced state into its server namespace, then
        reconcile that server."""
        payload = payload if isinstance(payload, dict) else {}
        base_url = str(payload.get("base_url") or "")
        namespace = str(payload.get("namespace") or "") or laravel_endpoint_manager.delivery_namespace(base_url)
        previous = str(payload.get("previous_namespace") or "")
        if previous and previous != namespace and previous.startswith(URL_NAMESPACE_PREFIX):
            moved = self._adopt(previous, namespace)
            if moved:
                ColorPrint.cyan(f"[LaravelDelivery] {previous} identified as {namespace}; adopted {moved} entries")
        ColorPrint.cyan(
            f"[LaravelDelivery] Laravel {payload.get('reason') or 'online'} {base_url or 'default'} "
            f"({namespace}); reconciling"
        )
        self.reconcile(namespace, base_url, str(payload.get("reason") or "online"))

    @serialized_method
    def _adopt(self, source: str, target: str) -> int:
        return self._repository().adopt_namespace(source, target)

    def _on_endpoint_switched(self, base_url: str) -> None:
        self.reconcile(laravel_endpoint_manager.delivery_namespace(base_url), base_url, RECONCILE_REASON_SWITCH)


laravel_delivery_outbox = LaravelDeliveryOutbox()


__all__ = [
    "DELIVERY_PROCESS_ID",
    "DELIVERY_RECEIPT_RETENTION_SECONDS",
    "DeliveryKind",
    "OUTCOME_DEAD_LETTER",
    "OUTCOME_DONE",
    "OUTCOME_RETRY",
    "PAYLOAD_STAGE",
    "RECEIPTS_IDENTITY",
    "RECEIPTS_NONE",
    "laravel_delivery_outbox",
]
