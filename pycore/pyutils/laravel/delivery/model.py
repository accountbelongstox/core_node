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
"dead_letter", "error"?: str, "retry_at"?: float, "server_error"?: bool}``
(any other status is a retry; ``server_error`` marks an HTTP 5xx answer and
feeds the drain breaker); ``deliver_batch(rows, owners) -> {delivery_id: outcome}``. ``row
["base_url"]`` is the endpoint of the row's server. The handler may persist
intermediate progress with ``patch``/``mark_identity_delivered``/``mark_step``
using the same ``owner``; an exception counts as ``retry`` (or dead letter
when the kind's ``permanent_error`` says so).
"""

from dataclasses import dataclass
from functools import wraps
import os
import time
import uuid
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple

from pycore.database.repositories.laravel_delivery_repository import NAMESPACE_SEPARATOR
from pycore.pyfoundations.backoff_wait import Backoff
from pycore.pyfoundations.system_paths import APP_CONFIG_DIR
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager


DELIVERY_OUTBOX_FILE = APP_CONFIG_DIR / "laravel_delivery.sqlite3"
RETAINED_PAYLOAD_DIR_NAME = "laravel_delivery"
DELIVERY_PROCESS_ID = f"{os.getpid()}:{uuid.uuid4().hex}"
DEFAULT_LEASE_SECONDS = 180.0
SIBLING_IN_FLIGHT_DEFER_SECONDS = 1.0
SIBLING_SCAN_LIMIT = 50
DRAIN_IDLE_WAIT_SECONDS = 30.0
# A row whose server has no reachable route waits this long (no attempt, no
# failure metric); the server's online edge hurries it.
SERVER_OFFLINE_DEFER_SECONDS = 60.0
# Server-error breaker: after this many consecutive HTTP 5xx outcomes of one
# kind (``"server_error": True`` in the outcome) its drain pauses with an
# exponential Backoff instead of hammering a failing Laravel; any delivered row
# closes the breaker.
SERVER_ERROR_STREAK_THRESHOLD = 3
SERVER_ERROR_PAUSE_INITIAL_SECONDS = 15.0
SERVER_ERROR_PAUSE_MAX_SECONDS = 300.0
# While a server that should receive rows is offline, one watcher re-probes it
# on this cadence; its online edge reconciles and resumes the drains.
SERVER_WATCH_SECONDS = 30.0
WATCH_WAKE_SIGNAL = "laravel.delivery.watch.wake"
UNASSIGNED_MIGRATION_BATCH = 500
LOCAL_DIFF_PAGE = 500
# Inventory items held in memory per reconcile step (one diff + enqueue round).
RECONCILE_INVENTORY_PAGE = 10000
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
# The local source of the row is gone (its file was evicted): there is nothing
# to deliver and nothing to retry, so the row is dropped instead of dead-lettered;
# the inventory only lists items that still exist.
OUTCOME_SOURCE_GONE = "source_gone"
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



def make_delivery_id(kind: str, *parts: Any) -> str:
    return ":".join([str(kind), *(str(part if part is not None else "").strip() for part in parts)])


def make_item_key(diff_kind: str, key: str) -> str:
    """Outbox item key of one inventory item (``<diff kind>:<wire key>``)."""
    return f"{diff_kind}:{key}"


def retry_delay(attempts: int, initial_seconds: float, maximum_seconds: float) -> float:
    return Backoff(initial_seconds, maximum_seconds).delay_for(attempts)


def active_namespace() -> str:
    """The server the UI selected: the one authority for where data goes."""
    return laravel_endpoint_manager.selected_namespace()


def target_namespaces() -> List[str]:
    """Servers a new item goes to: the UI-selected server only."""
    return [laravel_endpoint_manager.selected_namespace()]


def deliverable_namespaces(kind: str) -> List[str]:
    """Servers whose rows of ``kind`` may be attempted now: the selected
    server only, and only while one of its routes may be up. Rows of any
    other server (pinned ones included) stay parked until that server is
    selected again; its Laravel leases re-dispatch the work meanwhile."""
    selected = active_namespace()
    return [selected] if laravel_endpoint_manager.namespace_reachable(selected) is not False else []
