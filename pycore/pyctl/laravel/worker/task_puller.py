# -*- coding: utf-8 -*-
"""Laravel task intake: diff mirror (full sync), bounded claim-pull, staged dispatch.

Full-sync lanes mirror the entire pending claim order from one diff
(``sync=1`` -> ``ordered_task_ids``), keep the backlog in the persistent
segment store plus the local queue for offline processing, claim
just-in-time at task start, and apply later diffs incrementally. Other lanes
follow a changed diff with a bounded claim-pull.
"""

import time
from typing import Any, Dict, List, Set

from pycore.pyfoundations.backoff_wait import Backoff
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import SerializedValue, start_bus_task
from pycore.pyutils.common.diff_task_segments import DATA_LIMIT, STAGED_TASK_LIMIT, diff_task_segment_store
from pycore.pyutils.common.http_client import redacted_http_error
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_LIMITS,
    QUEUE_CENTER_DIFF_DELIVERY,
    QUEUE_CENTER_DIFF_SYNC_LOG_KEYS,
    queue_center_endpoint,
)
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyctl.laravel.worker.claim_ledger import ClaimLedger
from pycore.pyctl.laravel.worker.host import LaravelWorkerHost
from pycore.pyctl.laravel.worker.registration import WorkerRegistration
from pycore.pyctl.laravel.worker.task_claims import TaskClaims, display_task_id, segment_scope

DIFF_RETRY_INITIAL_SECONDS = 5.0
DIFF_RETRY_MAX_SECONDS = 60.0


def response_data(response: Any) -> Dict[str, Any]:
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError("Laravel worker API returned a non-object response")
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def _task_rows(raw_tasks: Any) -> List[Dict[str, Any]]:
    return [dict(task) for task in raw_tasks if isinstance(task, dict)] if isinstance(raw_tasks, list) else []


class TaskPuller:
    """Diff/full-sync mirror and bounded pull for one worker."""

    def __init__(
        self,
        host: LaravelWorkerHost,
        ledger: ClaimLedger,
        claims: TaskClaims,
        registration: WorkerRegistration,
        thread_name: str,
    ) -> None:
        self._host = host
        self._ledger = ledger
        self._claims = claims
        self._registration = registration
        self._thread_name = thread_name
        self.queue_progress: Dict[str, Dict[str, Any]] = {}
        self._type_cursor = 0
        self._queue_diff_cursors: Dict[str, int] = {}
        # Flipped by the first diff carrying ordered_task_ids. A CHANGED diff
        # without them proves the backend has no sync support; only then may
        # a full-sync lane use the bounded claim-pull.
        self.sync_backend_capable = False
        self._sync_backend_legacy = False
        # A stored cursor is trustworthy only after this process materialized
        # the mirror from an ordered diff; other lanes re-sync from cursor 0.
        self._mirror_bootstrapped: Set[str] = set()
        self._reconciled_scopes: Set[str] = set()
        self._diff_probe_count = 0
        self._diff_state_by_type: Dict[str, bool] = {}
        self._diff_checks_since_state: Dict[str, int] = {}
        self._diff_sync_log_state: Dict[str, Any] = {}
        self._diff_backoff = Backoff(DIFF_RETRY_INITIAL_SECONDS, DIFF_RETRY_MAX_SECONDS)
        self._diff_recovery = SerializedValue({}, name=f"{thread_name}DiffRecovery")
        self._pull_guard = SerializedValue(False, name=f"{thread_name}PullGuard")

    # -------------------- capacity --------------------

    def pull_capacity(self) -> int:
        """Maximum tasks that may be claimed in the next cycle."""
        reserve = max(0, int(QUEUE_CENTER_DIFF_DELIVERY.get("head_reserve") or 0))
        target = max(1, int(self._host.PULL_LIMIT) - reserve)
        return max(0, target - self._host.inflight_count())

    def diff_pull_capacity(self) -> int:
        """Claim capacity including the slot reserved for a changed queue head."""
        return max(0, int(self._host.PULL_LIMIT) - self._host.inflight_count())

    def sync_active(self) -> bool:
        return self._host.full_sync_enabled() and self.sync_backend_capable

    def _ordered_task_types(self) -> List[str]:
        """Rotate multi-type pulls without mutating the declared type set."""
        if self._host.lane_halt_requested():
            return []
        task_types = self._host.pull_task_types()
        if len(task_types) < 2:
            return task_types
        offset = self._type_cursor % len(task_types)
        self._type_cursor = (offset + 1) % len(task_types)
        return task_types[offset:] + task_types[:offset]

    # -------------------- pull triggers --------------------

    def request_pull(self, prefer_remote: bool = False) -> None:
        """Coalesce one event-driven immediate pull on the shared bus."""
        if self._pull_guard.compare_and_set(False, True):
            start_bus_task(self._run_claimed_pull, bool(prefer_remote), thread_name=f"{self._thread_name}PullThread")

    def pull_once(self, prefer_remote: bool = False) -> Dict[str, Any]:
        """Serialize one immediate pull cycle across timer and realtime wakes."""
        if not self._pull_guard.compare_and_set(False, True):
            return {"ok": True, "processed": 0, "reason": "pull_inflight"}
        return self._run_claimed_pull(prefer_remote)

    def _run_claimed_pull(self, prefer_remote: bool = False) -> Dict[str, Any]:
        try:
            return self._host.run_pull_cycle(prefer_remote)
        finally:
            self._pull_guard.set(False)

    def poll_diff_once(self) -> Dict[str, Any]:
        """Poll compact queue revisions and sync/pull only what changed."""
        if self._host.lane_halt_requested():
            return {"ok": True, "changed": False, "processed": 0}
        task_types = self._host.pull_task_types()
        if not task_types:
            return {"ok": True, "changed": False, "processed": 0}
        outcome = self.sync_mirror(task_types)
        if outcome["synced"]:
            return {**self.pull_once(), "changed": True, "synced": True}
        if outcome["changed"] and self.diff_pull_capacity() > 0:
            return {**self.pull_once(prefer_remote=True), "changed": True}
        if not outcome["changed"] and self.pull_capacity() > 0 and diff_task_segment_store.has_pending(outcome["scope"]):
            return {**self.pull_once(), "changed": False, "recovered_local": True}
        return {"ok": True, "changed": outcome["changed"], "processed": 0}

    # -------------------- diff mirror --------------------

    def sync_mirror(self, task_types: List[str]) -> Dict[str, Any]:
        """One diff round with offline backoff; an unreachable backend keeps
        the local mirror processing."""
        base_url = self._host.active_base_url()
        self._registration.ensure(base_url)
        recovery = self._diff_recovery.get() or {}
        outcome = {
            "ok": False, "changed": False, "synced": False,
            "scope": segment_scope(self._host, base_url), "error": str(recovery.get("error") or ""),
        }
        if recovery.get("base_url") == base_url and time.monotonic() < float(recovery.get("retry_after") or 0.0):
            return outcome
        try:
            outcome = self.fetch_mirror(task_types)
        except (OSError, RuntimeError, ValueError) as exc:
            error = redacted_http_error(exc)
            self._diff_recovery.set({
                "base_url": base_url,
                "retry_after": time.monotonic() + self._diff_backoff.next_delay(),
                "error": error,
            })
            if recovery.get("base_url") != base_url or recovery.get("error") != error:
                ColorPrint.yellow(f"{self._host.log_prefix} diff sync unavailable ({error}); processing the local mirror")
            outcome["error"] = error
            return outcome
        self._diff_backoff.reset()
        self._diff_recovery.set({})
        outcome["ok"] = True
        return outcome

    def fetch_mirror(self, task_types: List[str]) -> Dict[str, Any]:
        """Run ONE diff round over the lane's task types (no pull follow-up).
        The only cursor writer of full-sync lanes."""
        base_url = self._host.active_base_url()
        scope = segment_scope(self._host, base_url)
        full_sync = self._host.full_sync_enabled()
        changed = False
        synced = False
        for task_type in task_types:
            bootstrap = full_sync and task_type not in self._mirror_bootstrapped
            cursor = 0 if bootstrap else max(
                int(self._queue_diff_cursors.get(task_type, 0)),
                diff_task_segment_store.remote_cursor(scope, task_type),
            )
            params: Dict[str, Any] = {"cursor": cursor, **self._host.offer_params()}
            if full_sync:
                params["sync"] = 1
            response = laravel_client.get(
                queue_center_endpoint("queue_center_queue_diff", queue=task_type),
                base_url=base_url,
                params=params,
                log_line=False,
            )
            if response.status_code != 200:
                raise RuntimeError(f"Laravel queue diff failed for {task_type}: HTTP {response.status_code}")
            self._host.laravel_online(base_url)
            data = response_data(response)
            if full_sync:
                self._mirror_bootstrapped.add(task_type)
            lane_changed = bool(data.get("changed"))
            self._log_diff_state(task_type, response.status_code, lane_changed)
            self.record_queue_progress(task_type, data.get("progress"))
            if not lane_changed:
                continue
            changed = True
            ordered_ids = data.get("ordered_task_ids")
            if isinstance(ordered_ids, list):
                self.sync_backend_capable = True
                self._sync_backend_legacy = False
            elif full_sync:
                self._sync_backend_legacy = True
            if full_sync and isinstance(ordered_ids, list):
                if not self._apply_ordered_diff(scope, task_type, ordered_ids, base_url):
                    continue
                new_cursor = int(data.get("cursor") or 0)
                if new_cursor > 0:
                    self._queue_diff_cursors[task_type] = new_cursor
                    diff_task_segment_store.set_remote_cursor(scope, task_type, new_cursor)
                synced = True
        return {"changed": changed, "synced": synced, "base_url": base_url, "scope": scope}

    def _log_diff_state(self, task_type: str, status_code: int, lane_changed: bool) -> None:
        self._diff_probe_count += 1
        self._diff_checks_since_state[task_type] = self._diff_checks_since_state.get(task_type, 0) + 1
        previous = self._diff_state_by_type.get(task_type)
        if previous is None or previous != lane_changed:
            ColorPrint.gray(
                f"{self._host.log_prefix} diff[{status_code}]->{'true' if lane_changed else 'false'} "
                f"checks_since_change={self._diff_checks_since_state[task_type]} total_checks={self._diff_probe_count}"
            )
            self._diff_state_by_type[task_type] = lane_changed
            self._diff_checks_since_state[task_type] = 0

    def record_queue_progress(self, task_type: str, progress: Any) -> None:
        """Keep scalar metrics and nested tier dictionaries (language_tiers)."""
        if not isinstance(progress, dict):
            return
        entry: Dict[str, Any] = {
            str(key): int(value or 0) for key, value in progress.items() if isinstance(value, (int, float))
        }
        for key, value in progress.items():
            if isinstance(value, dict):
                entry[str(key)] = {
                    str(tier_key): {
                        str(metric): int(metric_value or 0)
                        for metric, metric_value in tier_value.items()
                        if isinstance(metric_value, (int, float))
                    }
                    for tier_key, tier_value in value.items()
                    if isinstance(tier_value, dict)
                }
        self.queue_progress[task_type] = entry

    def _apply_ordered_diff(self, scope: str, task_type: str, ordered_ids: List[Any], base_url: str) -> bool:
        """Materialize only the IDs the mirror lacks (page-data), drop staged
        rows that left the pending set, re-align the local order. False when
        page-data rejects this queue (the other queues still sync)."""
        seen: Set[str] = set()
        ordered: List[str] = []
        for raw_id in ordered_ids:
            task_id = str(raw_id or "").strip()
            if task_id and task_id not in seen:
                seen.add(task_id)
                ordered.append(task_id)
        known = diff_task_segment_store.held_task_ids(scope, task_type)
        missing = [task_id for task_id in ordered if task_id not in known]
        vanished = [task_id for task_id in known if task_id not in seen]
        staged_total = 0
        for offset in range(0, len(missing), DATA_LIMIT):
            chunk = missing[offset:offset + DATA_LIMIT]
            response = laravel_client.get(
                queue_center_endpoint("queue_center_queue_page_data", queue=task_type),
                base_url=base_url,
                params=[("ids[]", task_id) for task_id in chunk] + list(self._host.offer_params().items()),
                log_line=False,
            )
            if response.status_code != 200:
                failure = f"page-data HTTP {response.status_code}"
                if self._diff_sync_log_state.get(task_type) != failure:
                    self._diff_sync_log_state[task_type] = failure
                    ColorPrint.yellow(f"{self._host.log_prefix} sync[{task_type}] skipped: Laravel queue {failure}")
                return False
            tasks = _task_rows(response_data(response).get("items"))
            for task in tasks:
                if not str(task.get("task_type") or "").strip():
                    task["task_type"] = task_type
            # Staged for a later dispatch sweep, so never born delivered-marked.
            staged = diff_task_segment_store.stage(scope, tasks, mark_delivered=False) if tasks else []
            if staged:
                self._ledger.remember(staged, base_url)
                staged_total += len(staged)
        if vanished:
            diff_task_segment_store.consume_many(scope, vanished)
        reordered = diff_task_segment_store.apply_order(scope, task_type, ordered)
        self._host.apply_local_queue_order(task_type, ordered)
        keys = QUEUE_CENTER_DIFF_SYNC_LOG_KEYS
        sync_values = dict(zip(keys, (staged_total, len(vanished), len(ordered), reordered)))
        if self._diff_sync_log_state.get(task_type) != sync_values:
            self._diff_sync_log_state[task_type] = sync_values
            ColorPrint.blue(
                f"{self._host.log_prefix} sync[{task_type}] +{sync_values[keys[0]]} -{sync_values[keys[1]]} "
                f"order={sync_values[keys[2]]} reorder={sync_values[keys[3]]}"
            )
        return True

    # -------------------- dispatch --------------------

    def _dispatch_staged(
        self, tasks: List[Dict[str, Any]], base_url: str, scope: str,
        validate_claim: bool = False, allow_backlog: bool = False,
    ) -> int:
        if self._host.lane_halt_requested():
            # A stop landed while this pull was in flight: hand the staged
            # claims straight back to Laravel.
            releasable = [task for task in tasks if str(task.get("task_id") or "").strip()]
            if releasable:
                self._claims.release(releasable)
            return 0
        dispatched = 0
        for task in tasks:
            task_id = str(task.get("task_id") or "")
            task_type = str(task.get("task_type") or "")
            if not task_id or not task_type:
                continue
            if validate_claim and not self._claims.validate(task_type, task_id, base_url):
                diff_task_segment_store.consume(scope, task_id)
                continue
            accepted = self._host.accept_task(task, base_url, allow_backlog=allow_backlog)
            if accepted.get("success"):
                dispatched += 1
                continue
            self._claims.release([task])
            diff_task_segment_store.consume(scope, task_id)
            ColorPrint.yellow(
                f"{self._host.log_prefix} Local dispatch rejected task {display_task_id(task_id)}: "
                f"{accepted.get('error') or 'worker busy'}"
            )
        return dispatched

    def _recover(self, scope: str, base_url: str, capacity: int) -> List[Dict[str, Any]]:
        recovered = diff_task_segment_store.pending(scope, capacity) if capacity > 0 else []
        if recovered:
            self._ledger.remember(recovered, base_url)
        return recovered

    def pull_cycle(self, prefer_remote: bool = False) -> Dict[str, Any]:
        """Pull and recover one bounded segment, preferring a changed remote
        head. Full-sync lanes never claim-pull here (it would move the cursor
        past revisions the mirror has not materialized). No intake while the
        backend breaker is open (results keep failing with HTTP 5xx)."""
        if self._host.results_blocked():
            return {"ok": False, "processed": 0, "reason": "result_circuit_open"}
        if self._host.full_sync_enabled() and not self._sync_backend_legacy:
            return self._full_sync_cycle()
        task_types = self._ordered_task_types()
        capacity = self.diff_pull_capacity() if prefer_remote else self.pull_capacity()
        if not task_types or capacity <= 0:
            return {"ok": True, "processed": 0}
        base_url = self._host.active_base_url()
        scope = segment_scope(self._host, base_url)
        processed = 0
        recovered = [] if prefer_remote else self._recover(scope, base_url, capacity)
        recovered_count = len(recovered)
        if recovered:
            processed += self._dispatch_staged(recovered, base_url, scope, validate_claim=True)
            capacity = max(0, capacity - recovered_count)
        remote_capacity = min(capacity, diff_task_segment_store.available_capacity(scope))
        remaining = remote_capacity
        pulled = 0
        for task_type in task_types:
            if remaining <= 0:
                break
            params = self._host.identity_params()
            params["capabilities_present"] = 1
            params["limit"] = max(1, min(int(remaining), GLOBAL_TASK_LIMITS["worker_pull"]))
            response = laravel_client.post(
                queue_center_endpoint("worker_task_pull", task_type=task_type),
                base_url=base_url,
                json=params,
            )
            if response.status_code != 200:
                raise RuntimeError(f"Laravel worker pull failed for {task_type}: HTTP {response.status_code}")
            data = response_data(response)
            self.record_queue_progress(task_type, data.get("progress"))
            tasks = _task_rows(data.get("tasks"))
            staged = diff_task_segment_store.stage(scope, tasks) if tasks else []
            if staged:
                self._ledger.remember(staged, base_url)
                pulled += len(staged)
            if not self._host.full_sync_enabled():
                queue_cursor = int(
                    data.get("queue_cursor")
                    or self._queue_diff_cursors.get(task_type, 0)
                    or diff_task_segment_store.remote_cursor(scope, task_type)
                )
                self._queue_diff_cursors[task_type] = queue_cursor
                diff_task_segment_store.set_remote_cursor(scope, task_type, queue_cursor)
            if staged:
                processed += self._dispatch_staged(staged, base_url, scope)
                remaining = max(0, remote_capacity - pulled)
        if prefer_remote:
            recovered = self._recover(scope, base_url, max(0, capacity - pulled))
            recovered_count += len(recovered)
            processed += self._dispatch_staged(recovered, base_url, scope, validate_claim=True) if recovered else 0
        if pulled:
            progress = self.queue_progress.get(task_types[0], {})
            progress_label = (
                f" progress={int(progress.get('completed') or 0)}/{int(progress.get('total') or 0)}" if progress else ""
            )
            ColorPrint.blue(f"{self._host.log_prefix} Pulled {pulled} task(s), dispatched {processed}{progress_label}")
        return {"ok": True, "processed": processed, "pulled": pulled, "recovered": recovered_count}

    def _full_sync_cycle(self) -> Dict[str, Any]:
        """Refresh the ordered mirror, then sweep every dispatchable staged
        row into the local queue; claims happen just-in-time at task start."""
        task_types = self._host.pull_task_types()
        if not task_types:
            return {"ok": True, "processed": 0}
        base_url = self._host.active_base_url()
        scope = segment_scope(self._host, base_url)
        self.sync_mirror(task_types)
        # Stale in-process delivery marks are cleared once after startup.
        if scope not in self._reconciled_scopes:
            diff_task_segment_store.requeue_all(scope)
            self._reconciled_scopes.add(scope)
        recovered = self._recover(scope, base_url, STAGED_TASK_LIMIT)
        if not recovered:
            ColorPrint.gray(f"{self._host.log_prefix} full-sync mirror ready but no dispatchable tasks (scope={scope})")
            return {"ok": True, "processed": 0}
        processed = self._dispatch_staged(recovered, base_url, scope, allow_backlog=True)
        ColorPrint.blue(
            f"{self._host.log_prefix} full-sync dispatch recovered={len(recovered)} "
            f"processed={processed} local_capacity={self.pull_capacity()}"
        )
        return {"ok": True, "processed": processed, "recovered": len(recovered)}
