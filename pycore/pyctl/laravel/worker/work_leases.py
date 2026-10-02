# -*- coding: utf-8 -*-
"""Work leases of the gap lanes (contract ``work_leases``).

Laravel is the single scheduler: a node claims a disjoint batch of gap rows,
renews the lease while it works and settles each row by content key; rows
it does not finish are released or return to the pool when the lease
expires. ``WorkLeaseClient`` is the HTTP side, ``LeaseBook`` the node's
lease state on a THREAD_BUS owner.
"""

import time
from collections import deque
from typing import Any, Deque, Dict, List, Optional, Set, Tuple

from pycore.pyutils.common.http_client import RESPONSE_CONTROL
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.common.queue_center_contract import QUEUE_CENTER_WORK_LEASES, queue_center_endpoint
from pycore.pyutils.laravel.client import laravel_client, laravel_envelope

WORK_LEASE_LANES: Tuple[str, ...] = tuple(QUEUE_CENTER_WORK_LEASES["lanes"])
LEASE_TTL_SECONDS = float(QUEUE_CENTER_WORK_LEASES["lease_ttl_seconds"])
RENEW_AFTER_FRACTION = float(QUEUE_CENTER_WORK_LEASES["renew_after_fraction"])
PREFETCH_FRACTION = float(QUEUE_CENTER_WORK_LEASES["prefetch_fraction"])
EMPTY_RETRY_AFTER_SECONDS = float(QUEUE_CENTER_WORK_LEASES["empty_retry_after_seconds"])
THROUGHPUT_WINDOW_SECONDS = float(QUEUE_CENTER_WORK_LEASES["throughput_window_seconds"])
THROUGHPUT_MIN_SPAN_SECONDS = float(QUEUE_CENTER_WORK_LEASES["throughput_min_span_seconds"])
PROGRESS_STALL_SECONDS = float(QUEUE_CENTER_WORK_LEASES["progress_stall_seconds"])
BATCH_MAX = int(QUEUE_CENTER_WORK_LEASES["batch_max"])
WANT_MAX = int(QUEUE_CENTER_WORK_LEASES["want_max"])


def lease_reason_code(code: str) -> str:
    """One ``work_leases.reason_codes`` entry; a code missing from the
    contract fails loudly at import."""
    if code not in QUEUE_CENTER_WORK_LEASES["reason_codes"]:
        raise KeyError(f"work_leases.reason_codes has no {code}")
    return code


LEASE_LOST = lease_reason_code("LEASE_LOST")


def _data(response: Any) -> Dict[str, Any]:
    envelope = laravel_envelope(response)
    if response.status_code != 200 or envelope.get("success") is False:
        raise RuntimeError(
            f"work lease HTTP {response.status_code}: {envelope.get('error_code') or envelope.get('message') or ''}".rstrip(": ")
        )
    data = envelope.get("data")
    return data if isinstance(data, dict) else envelope


class WorkLeaseClient:
    """Claim / renew / release against the scheduling Laravel server."""

    @staticmethod
    def claim(base_url: str, request: Dict[str, Any]) -> Dict[str, Any]:
        return _data(laravel_client.post(queue_center_endpoint("work_lease_claim"), base_url=base_url, json=request, response=RESPONSE_CONTROL))

    @staticmethod
    def renew(base_url: str, worker_id: str, lease_ids: List[str]) -> Dict[str, Any]:
        return _data(laravel_client.post(
            queue_center_endpoint("work_lease_renew"), base_url=base_url,
            json={"worker_id": worker_id, "lease_ids": lease_ids}, response=RESPONSE_CONTROL,
        ))

    @staticmethod
    def release(base_url: str, worker_id: str, lease_id: str = "", rows: Optional[List[Dict[str, Any]]] = None) -> int:
        """``lease_id`` empty and no rows = every lease of the worker."""
        body: Dict[str, Any] = {"worker_id": worker_id}
        if lease_id:
            body["lease_id"] = lease_id
        if rows:
            body["rows"] = rows
        data = _data(laravel_client.post(queue_center_endpoint("work_lease_release"), base_url=base_url, json=body, response=RESPONSE_CONTROL))
        return int(data.get("released") or 0)


class LeaseBook:
    """Leases one lane worker holds: lease -> deadline and open item keys,
    key -> (lease, row), rows to release, and the completion window that
    feeds the throughput hint."""

    def __init__(self, name: str) -> None:
        self._leases: Dict[str, Dict[str, Any]] = {}
        self._items: Dict[str, Dict[str, Any]] = {}
        self._to_release: List[Dict[str, Any]] = []
        self._done: Deque[float] = deque()
        self._last_batch = 0
        self._claim_after = 0.0
        self._idle_after = 0.0
        self._pooled: List[Dict[str, Any]] = []
        self._lost = {"leases": 0, "rows": 0}
        init_serialized_owner(self, f"laravel.worker.lease_book.{name}", f"{name}LeaseBookThread")

    @serialized_method
    def add(self, lease_id: str, ttl_seconds: float, items: List[Dict[str, Any]]) -> None:
        """Record one granted lease; ``items`` = ``[{key, lane, row_id}]``."""
        now = time.monotonic()
        lease = self._leases.setdefault(lease_id, {"keys": set(), "ttl": ttl_seconds})
        lease.update({"ttl": ttl_seconds, "granted_at": now, "expires_at": now + ttl_seconds})
        for item in items:
            lease["keys"].add(item["key"])
            self._items[item["key"]] = {"lease_id": lease_id, "lane": item["lane"], "row_id": item["row_id"]}
        self._last_batch = len(items)

    @serialized_method
    def note_claim(self, retry_after: float, pooled: List[Dict[str, Any]]) -> None:
        """Server answer of a claim: next routine claim not before ``retry_after``
        (an urgent wake, i.e. a promoted row, still claims at once)."""
        self._claim_after = 0.0
        self._idle_after = time.monotonic() + max(0.0, retry_after)
        self._pooled = list(pooled)

    @serialized_method
    def defer_claim(self, seconds: float) -> None:
        self._claim_after = time.monotonic() + max(0.0, seconds)

    @serialized_method
    def claim_due(self, floor: int, urgent: bool) -> bool:
        """Claim when the open items fell to the prefetch level (urgent: a
        priority wake, any time the server allows)."""
        now = time.monotonic()
        if now < self._claim_after:
            return False
        if urgent:
            return True
        if now < self._idle_after:
            return False
        return len(self._items) <= max(int(floor), int(self._last_batch * PREFETCH_FRACTION))

    @serialized_method
    def renew_due(self) -> List[str]:
        now = time.monotonic()
        return [
            lease_id for lease_id, lease in self._leases.items()
            if now >= lease["granted_at"] + lease["ttl"] * RENEW_AFTER_FRACTION
        ]

    @serialized_method
    def renewed(self, lease_id: str, ttl_seconds: float) -> None:
        lease = self._leases.get(lease_id)
        if lease is not None:
            now = time.monotonic()
            lease.update({"ttl": ttl_seconds, "granted_at": now, "expires_at": now + ttl_seconds})

    @serialized_method
    def lost(self, lease_ids: List[str]) -> Set[str]:
        """Forget leases the server no longer holds for us; their keys."""
        keys: Set[str] = set()
        for lease_id in lease_ids:
            lease = self._leases.pop(lease_id, None)
            if lease is None:
                continue
            keys |= lease["keys"]
            for key in lease["keys"]:
                self._items.pop(key, None)
            self._lost["leases"] += 1
            self._lost["rows"] += len(lease["keys"])
        return keys

    @serialized_method
    def settle(self, outcomes: Dict[str, bool]) -> int:
        """Items reached a terminal state (any generator). A success closes
        the row through its content report; a failure goes back to the pool."""
        now = time.monotonic()
        settled = 0
        for key, ok in outcomes.items():
            item = self._items.pop(key, None)
            if item is None:
                continue
            settled += 1
            lease = self._leases.get(item["lease_id"])
            if lease is not None:
                lease["keys"].discard(key)
                if not lease["keys"]:
                    self._leases.pop(item["lease_id"], None)
            if ok:
                self._done.append(now)
            else:
                self._to_release.append(item)
        while self._done and self._done[0] < now - THROUGHPUT_WINDOW_SECONDS:
            self._done.popleft()
        return settled

    @serialized_method
    def take_releases(self) -> List[Dict[str, Any]]:
        rows, self._to_release = self._to_release, []
        return rows

    @serialized_method
    def requeue_releases(self, rows: List[Dict[str, Any]]) -> None:
        self._to_release.extend(rows)

    @serialized_method
    def held_ids(self) -> List[str]:
        return sorted(self._leases)

    @serialized_method
    def open_keys(self) -> Set[str]:
        return set(self._items)

    @serialized_method
    def clear(self) -> Set[str]:
        """Drop every lease (released server-side by the caller); their keys."""
        keys = set(self._items)
        self._leases.clear()
        self._items.clear()
        self._to_release.clear()
        return keys

    @serialized_method
    def throughput_per_hour(self) -> int:
        """Completions per hour over the window, measured over the span the
        window actually covers (a fresh node is not under-rated)."""
        now = time.monotonic()
        while self._done and self._done[0] < now - THROUGHPUT_WINDOW_SECONDS:
            self._done.popleft()
        if not self._done:
            return 0
        span = max(THROUGHPUT_MIN_SPAN_SECONDS, now - self._done[0])
        return int(len(self._done) * 3600.0 / span)

    @serialized_method
    def status(self) -> Dict[str, Any]:
        return {
            "leases": len(self._leases),
            "items_leased": len(self._items),
            "last_batch": self._last_batch,
            "done_per_hour": self.throughput_per_hour(),
            "claim_in_seconds": max(0.0, round(max(self._claim_after, self._idle_after) - time.monotonic(), 1)),
            "pooled": list(self._pooled),
            "lost": {"reason_code": LEASE_LOST, **self._lost} if self._lost["leases"] else None,
        }


work_lease_client = WorkLeaseClient()


__all__ = [
    "BATCH_MAX",
    "EMPTY_RETRY_AFTER_SECONDS",
    "LEASE_LOST",
    "LEASE_TTL_SECONDS",
    "LeaseBook",
    "PROGRESS_STALL_SECONDS",
    "WANT_MAX",
    "WORK_LEASE_LANES",
    "WorkLeaseClient",
    "lease_reason_code",
    "work_lease_client",
]
