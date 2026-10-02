# -*- coding: utf-8 -*-
"""Delivery store: the one state owner of outbox rows, kinds, receipts and
drain flags. Every mutation runs on its THREAD_BUS owner thread, so a row
enqueued (``put``) and a drain ending (``end_drain``) are ordered."""

import copy
import hashlib
import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from pycore.database.repositories.laravel_delivery_repository import (
    NAMESPACE_SEPARATOR,
    STATE_DEAD_LETTER,
    STATE_PENDING,
    LaravelDeliveryRepository,
)
from pycore.pyfoundations.atomic_json_store import atomic_write_bytes
from pycore.pyfoundations.core_node_dirs import resolve_portable_path
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.system_paths import get_app_cache_dir
from pycore.pyutils.laravel.delivery.model import (
    DEFAULT_LEASE_SECONDS,
    DELIVERY_OUTBOX_FILE,
    DELIVERY_PROCESS_ID,
    DELIVERY_RECEIPT_PRUNE_INTERVAL_SECONDS,
    DELIVERY_RECEIPT_RETENTION_SECONDS,
    META_HASH_PREFIX,
    META_SEED_NAMESPACE,
    META_SEEDED_PREFIX,
    PAYLOAD_STAGE,
    RECEIPTS_IDENTITY,
    RETAINED_PAYLOAD_DIR_NAME,
    SIBLING_IN_FLIGHT_DEFER_SECONDS,
    SIBLING_SCAN_LIMIT,
    UNASSIGNED_MIGRATION_BATCH,
    DeliveryKind,
    _lease_active,
    _logical_id,
    _now,
    _record_transaction,
    _stored_id,
    make_delivery_id,
)
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager


def retained_payload_root() -> Path:
    return get_app_cache_dir().resolve() / RETAINED_PAYLOAD_DIR_NAME


def is_retained_payload(path: Path) -> bool:
    """True for a payload copy owned by the outbox: it is deleted once no
    row references it, so nothing durable may point at it."""
    return retained_payload_root() in Path(resolve_portable_path(str(path))).resolve().parents


def retain_payload(kind: str, record: Dict[str, Any], payload_file: str) -> Dict[str, Any]:
    """Immutable digest-named copy of one payload file under the cache root."""
    source_path = Path(payload_file).resolve()
    source_bytes = source_path.read_bytes()
    source_sha256 = hashlib.sha256(source_bytes).hexdigest()
    retained_key = str(record.get("identity") or "").strip() or str(record["delivery_id"])
    retained_path = (
        retained_payload_root()
        / kind
        / hashlib.sha1(retained_key.encode("utf-8")).hexdigest()
        / f"{source_sha256}{source_path.suffix or '.bin'}"
    )
    retained_path.parent.mkdir(parents=True, exist_ok=True)
    # The file name is the content digest; an existing file with another
    # digest is a torn copy and is replaced atomically.
    if not retained_path.is_file() or hashlib.sha256(retained_path.read_bytes()).hexdigest() != source_sha256:
        atomic_write_bytes(retained_path, source_bytes)
    return {"payload_path": str(retained_path), "payload_sha256": source_sha256}


class DeliveryStore:
    """Rows, kinds, receipts, metrics and drain flags on one owner thread."""

    def __init__(self) -> None:
        self._repo: Optional[LaravelDeliveryRepository] = None
        self._kinds: Dict[str, DeliveryKind] = {}
        self._draining: set = set()
        self._receipts_pruned_at = 0.0
        self._started = False
        init_serialized_owner(self, "laravel.delivery.store", "LaravelDeliveryStoreState")

    @serialized_method
    def register_kind(self, kind: DeliveryKind) -> bool:
        """Register (or re-register) one kind; True when the outbox already
        started (the caller activates the kind at once)."""
        self._kinds[kind.name] = kind
        return self._started

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

    @serialized_method
    def mark_started(self) -> bool:
        if self._started:
            return False
        self._started = True
        return True

    @serialized_method
    def started(self) -> bool:
        return self._started

    @serialized_method
    def migrate_v1(self) -> None:
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

    @serialized_method
    def fold_replaced(self, kind: str) -> None:
        definition = self._kinds.get(kind)
        for retired in (definition.replaces if definition else ()):
            moved = self._repository().rename_kind(retired, kind)
            if moved:
                ColorPrint.cyan(f"[LaravelDelivery] folded {moved} entries of retired kind {retired} into {kind}")

    @serialized_method
    def seed_namespace(self, kind: str) -> str:
        repo = self._repository()
        return "" if repo.meta(META_SEEDED_PREFIX + kind) else repo.meta(META_SEED_NAMESPACE)

    @serialized_method
    def seed_state(self, namespace: str, kind: str, entries: List[Dict[str, Any]]) -> int:
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

    @serialized_method
    def kinds(self) -> List[str]:
        return sorted(self._kinds)

    @serialized_method
    def definition(self, kind: str) -> Optional[DeliveryKind]:
        return self._kinds.get(kind)

    def _release_payload(self, row: Dict[str, Any]) -> None:
        """Delete a retained payload copy once no row references it."""
        payload_path = str(row.get("payload_path") or "")
        if not payload_path or self._repository().payload_referenced(
            str(row.get("kind") or ""),
            str(row.get("identity") or "").strip(),
            _logical_id(str(row.get("delivery_id") or "")),
            str(row.get("payload_sha256") or ""),
        ):
            return
        retained = Path(payload_path)
        if retained.is_file():
            retained.unlink()
        if retained.parent.is_dir() and not any(retained.parent.iterdir()):
            retained.parent.rmdir()

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
    def put(self, record: Dict[str, Any], namespace: str, only_new: bool = False) -> Dict[str, Any]:
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
        replaced: Dict[str, Any] = {}
        if current_sha256 and proposed_sha256 and current_sha256 != proposed_sha256:
            if _lease_active(current, _now()):
                # The old bytes are being delivered right now; the next diff
                # re-opens the item for the new bytes.
                return copy.deepcopy(current)
            # New bytes for the same delivery (e.g. a re-synthesis): the new
            # payload restarts the delivery from its first step.
            replaced = current
            current = {}
            current_sha256 = ""
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
        if replaced:
            self._release_payload(replaced)
        return copy.deepcopy(row)

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
    def renew(self, delivery_id: str, owner: str, progress: Dict[str, Any], strict: bool = True) -> None:
        row = self._repository().get(str(delivery_id))
        now = _now()
        if row is None or str(row.get("lease_owner") or "") != owner:
            if not strict:
                return
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
        self._release_payload(row)
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

    @serialized_method
    @_record_transaction
    def drop(self, delivery_id: str, owner: str) -> bool:
        """Remove a row whose local source is gone (no metric, no state)."""
        row = self._repository().get(str(delivery_id))
        if not row or str(row.get("lease_owner") or "") != str(owner):
            return False
        self._repository().delete(str(delivery_id))
        self._release_payload(row)
        return True

    @serialized_method
    @_record_transaction
    def defer(self, delivery_id: str, owner: str, reason: str, delay: float, error: str = "") -> Optional[Dict[str, Any]]:
        """Release a row whose server cannot take it now (offline, schema
        pending): the outage is not the row's failure, so the attempt is given
        back, no failure is counted and the row waits ``delay`` seconds."""
        row = self._repository().get(str(delivery_id))
        if not row or str(row.get("lease_owner") or "") != str(owner):
            return None
        self._unlease(
            row,
            last_error=f"{reason}: {error}"[:500],
            next_attempt_at=_now() + max(0.0, float(delay)),
            delivery_attempts=max(0, int(row.get("delivery_attempts") or 1) - 1),
        )
        return copy.deepcopy(row)

    @serialized_method
    def list_ready(self, kind: str, limit: int = 100, namespaces: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        now = _now()
        return [
            row for row in self._repository().ready(kind, now, DELIVERY_PROCESS_ID, limit, namespaces)
            if not _lease_active(row, now)
        ]

    @serialized_method
    def group_counts(self, kind: str, namespace: str) -> Dict[str, Dict[str, int]]:
        return self._repository().group_counts(kind, namespace)

    @serialized_method
    def state_hashes(self, namespace: str, kind: str, keys: List[str]) -> Dict[str, str]:
        return self._repository().state_hashes(namespace, kind, keys)

    @serialized_method
    def pending_group_keys(self, kind: str, keys: List[str]) -> List[str]:
        """Group keys among ``keys`` that still have a pending row of ``kind``."""
        return self._repository().pending_group_keys(kind, keys)

    @serialized_method
    def retry_dead_letters(self, kind: str) -> int:
        return self._repository().retry_dead_letters(kind, _now())

    @serialized_method
    def hurry_pending(self, kind: str, namespace: Optional[str] = None) -> int:
        """Reset the backoff of every waiting row of the kind (reconnect)."""
        return self._repository().hurry(kind, _now(), namespace)

    @serialized_method
    def running(self, kind: str) -> bool:
        return kind in self._draining

    @serialized_method
    def begin_drain(self, kind: str, namespaces: List[str]) -> bool:
        if (
            not self._started
            or kind in self._draining
            or kind not in self._kinds
            or not self._repository().has_pending(kind, namespaces)
        ):
            return False
        self._draining.add(kind)
        return True

    @serialized_method
    def end_drain(self, kind: str, namespaces: Optional[List[str]] = None, force: bool = False) -> bool:
        """Atomic with ``put`` on the owner thread: a row enqueued before
        this check keeps the drain alive, one enqueued after it starts a new
        drain through ``kick``."""
        if not force and self._repository().has_pending(kind, namespaces):
            return False
        self._draining.discard(kind)
        return True

    @serialized_method
    def next_attempt_at(self, kind: str, namespaces: Optional[List[str]] = None) -> Optional[float]:
        return self._repository().next_attempt_at(kind, namespaces)

    @serialized_method
    def has_pending_in(self, kind: str, namespaces: List[str]) -> bool:
        return self._repository().has_pending(kind, namespaces)

    @serialized_method
    @_record_transaction
    def enqueue_inventory(self, kind: str, state_kind: str, namespace: str, items: Dict[str, Dict[str, Any]]) -> int:
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
            staged.setdefault("delivery_id", make_delivery_id(kind, key, entry["hash"]))
            self.put(staged, namespace)
            enqueued += 1
        return enqueued

    @serialized_method
    def adopt(self, source: str, target: str) -> int:
        return self._repository().adopt_namespace(source, target)

    @serialized_method
    def has_pending_group_prefix(self, kind: str, prefix: str) -> bool:
        return self._repository().has_pending_group_prefix(kind, prefix)

    @serialized_method
    def metric_namespaces(self, kind: str) -> List[str]:
        return self._repository().metric_namespaces(kind)

    @serialized_method
    def stage_counts(self, kind: str) -> List[Dict[str, Any]]:
        return self._repository().stage_counts(kind, _now())

    @serialized_method
    def scoped_metrics(self, kind: str, namespace: str) -> Dict[str, Any]:
        """Delivered-state count, last row error and metrics of one kind on one server."""
        return {
            "delivered_state": self._repository().state_count(namespace, kind),
            "last_error": self._repository().last_error(kind, namespace),
            "metrics": self._repository().metrics(namespace, kind),
        }


delivery_store = DeliveryStore()
