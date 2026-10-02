# -*- coding: utf-8 -*-
"""Laravel global-task intake: compact diff, bounded claim-pull, staged dispatch.

A changed queue diff is followed by a bounded claim-pull sized to the
worker's free capacity; claimed rows are staged in the persistent segment
store and dispatched to the local executor. The audio gap lanes do not come
through here: they lease their work (``work_leases``).
"""

import time
from typing import Any, Dict, List, Tuple

from pycore.pyfoundations.backoff_wait import Backoff
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.serialized_worker import SerializedValue, init_serialized_owner, serialized_method, start_bus_task
from pycore.pyutils.common.diff_task_segments import diff_task_segment_store
from pycore.pyutils.common.http_client import redacted_http_error
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_LIMITS,
    GLOBAL_TASK_TYPES_BY_KEY,
    lane_state_code,
    QUEUE_CENTER_DIFF_DELIVERY,
    queue_center_endpoint,
)
from pycore.pyutils.laravel.client import laravel_client, laravel_envelope
from pycore.pyutils.tts.audio_queue_model import AUDIO_QUEUE_CHANGED_SIGNAL
from pycore.pyctl.laravel.worker.claim_ledger import ClaimLedger
from pycore.pyctl.laravel.worker.host import LaravelWorkerHost
from pycore.pyctl.laravel.worker.registration import COMPUTE_CLASS_CPU_ONLY, COMPUTE_CLASS_GPU, WorkerRegistration
from pycore.pyctl.laravel.worker.task_claims import TaskClaims, display_task_id, segment_scope

DIFF_RETRY_INITIAL_SECONDS = 5.0
DIFF_RETRY_MAX_SECONDS = 60.0
# Version skew: a Laravel that predates a contract task type answers its typed
# routes 404 with error_code LARAVEL_TASK_TYPE_UNSUPPORTED. The type is skipped
# for that server and re-probed with Backoff instead of failing every cycle
# (and, for diff, every other type).
UNSUPPORTED_TASK_TYPE_CODE = "LARAVEL_TASK_TYPE_UNSUPPORTED"
# Live servers deployed before that error_code answer only English text
# ("Unknown task type" on worker routes, "Unknown queue" on the queue-center
# diff); delete these markers once every server sends the code.
UNKNOWN_TASK_TYPE_MARKERS = ("unknown task type", "unknown queue")
UNSUPPORTED_REPROBE_INITIAL_SECONDS = 300.0
UNSUPPORTED_REPROBE_MAX_SECONDS = 3600.0
# Idle intake: a timer-driven cycle that changed nothing and dispatched nothing
# backs off (5 s doubling to 2 min); any realtime wake (prefer_remote) or
# dispatched work resets it, so an idle lane never hot-loops on Laravel.
IDLE_PULL_INITIAL_SECONDS = 5.0
IDLE_PULL_MAX_SECONDS = 120.0
# Every staged row a cycle sees ends in exactly one bucket: dispatched,
# released back to Laravel, or skipped with one of these reason codes.
SKIP_TASK_ROW_INVALID = lane_state_code("skip_reason_codes", "TASK_ROW_INVALID")
SKIP_RESULT_PENDING = lane_state_code("skip_reason_codes", "RESULT_PENDING")
SKIP_CLAIM_GONE = lane_state_code("skip_reason_codes", "CLAIM_GONE")
RELEASE_LANE_HALTED = lane_state_code("skip_reason_codes", "LANE_HALTED")
RELEASE_LOCAL_REJECTED = lane_state_code("skip_reason_codes", "LOCAL_DISPATCH_REJECTED")
# Compute-class preference of task types (contract ``task_types[].compute``):
# a GPU node takes GPU work first; a CPU-only node never pulls gpu_required
# work and takes cpu_ok work before gpu_preferred.
COMPUTE_RANK = {
    COMPUTE_CLASS_GPU: {"gpu_required": 0, "gpu_preferred": 1, "cpu_ok": 2},
    COMPUTE_CLASS_CPU_ONLY: {"cpu_ok": 0, "gpu_preferred": 1},
}


def response_data(response: Any) -> Dict[str, Any]:
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError("Laravel worker API returned a non-object response")
    data = payload.get("data")
    return data if isinstance(data, dict) else payload


def _unknown_task_type(response: Any) -> bool:
    """404 from a typed route of a Laravel that does not know the type."""
    if response.status_code != 404:
        return False
    if str(laravel_envelope(response).get("error_code") or "") == UNSUPPORTED_TASK_TYPE_CODE:
        return True
    body = response.text.lower()
    return any(marker in body for marker in UNKNOWN_TASK_TYPE_MARKERS)


class UnsupportedTaskTypes:
    """(base_url, task_type) pairs the Laravel server does not know yet, on a
    THREAD_BUS state owner (written by pull/diff, read by status calls)."""

    def __init__(self, thread_name: str) -> None:
        self._entries: Dict[Tuple[str, str], Dict[str, Any]] = {}
        init_serialized_owner(self, "laravel.worker.unsupported_task_types", thread_name)

    @serialized_method
    def probe_due(self, base_url: str, task_type: str) -> bool:
        entry = self._entries.get((base_url, task_type))
        return entry is None or time.monotonic() >= float(entry["retry_at"])

    @serialized_method
    def mark(self, base_url: str, task_type: str) -> bool:
        """Schedule the next re-probe; True on the first mark (log once)."""
        entry = self._entries.get((base_url, task_type))
        first = entry is None
        if first:
            entry = {"backoff": Backoff(UNSUPPORTED_REPROBE_INITIAL_SECONDS, UNSUPPORTED_REPROBE_MAX_SECONDS)}
            self._entries[(base_url, task_type)] = entry
        entry["retry_at"] = time.monotonic() + entry["backoff"].next_delay()
        return first

    @serialized_method
    def unmark(self, base_url: str, task_type: str) -> bool:
        return self._entries.pop((base_url, task_type), None) is not None

    @serialized_method
    def clear(self) -> None:
        self._entries.clear()

    @serialized_method
    def task_types(self, base_url: str) -> List[str]:
        return sorted(task_type for url, task_type in self._entries if url == base_url)


def _task_rows(raw_tasks: Any) -> List[Dict[str, Any]]:
    return [dict(task) for task in raw_tasks if isinstance(task, dict)] if isinstance(raw_tasks, list) else []


class TaskPuller:
    """Diff probe and bounded pull for one worker."""

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
        # Read by status/RPC threads: published copy-on-write (never mutated).
        self._queue_progress = SerializedValue({}, name=f"{thread_name}QueueProgress")
        self._type_cursor = 0
        self._queue_diff_cursors: Dict[str, int] = {}
        self._diff_probe_count = 0
        self._diff_state_by_type: Dict[str, bool] = {}
        self._diff_checks_since_state: Dict[str, int] = {}
        self._diff_backoff = Backoff(DIFF_RETRY_INITIAL_SECONDS, DIFF_RETRY_MAX_SECONDS)
        self._diff_recovery = SerializedValue({}, name=f"{thread_name}DiffRecovery")
        self._pull_guard = SerializedValue(False, name=f"{thread_name}PullGuard")
        self._unsupported = UnsupportedTaskTypes(f"{thread_name}UnsupportedTypes")
        # Written only inside the pull guard (one cycle at a time).
        self._pull_again = SerializedValue(False, name=f"{thread_name}PullAgain")
        self._idle_backoff = Backoff(IDLE_PULL_INITIAL_SECONDS, IDLE_PULL_MAX_SECONDS)
        self._idle_until = 0.0
        self._last_dispatch = SerializedValue({}, name=f"{thread_name}LastDispatch")

    @property
    def queue_progress(self) -> Dict[str, Dict[str, Any]]:
        return self._queue_progress.get()

    @property
    def last_dispatch(self) -> Dict[str, Any]:
        return self._last_dispatch.get()

    # -------------------- version skew --------------------

    def _probe_due(self, base_url: str, task_type: str) -> bool:
        return self._unsupported.probe_due(base_url, task_type)

    def _note_unsupported(self, base_url: str, task_type: str) -> None:
        if self._unsupported.mark(base_url, task_type):
            ColorPrint.yellow(
                f"{self._host.log_prefix} {UNSUPPORTED_TASK_TYPE_CODE}: {base_url} does not know task type "
                f"{task_type}; skipped, re-probing with backoff"
            )

    def _note_supported(self, base_url: str, task_type: str) -> None:
        if self._unsupported.unmark(base_url, task_type):
            ColorPrint.green(f"{self._host.log_prefix} {base_url} now supports task type {task_type}")

    def reset_unsupported_task_types(self) -> None:
        """A (re)registration or endpoint change may face a newly deployed
        Laravel: probe every type again at once."""
        self._unsupported.clear()

    def unsupported_task_types(self) -> List[str]:
        """Task types the active Laravel server does not know (status/UI)."""
        return self._unsupported.task_types(self._host.active_base_url())

    # -------------------- capacity --------------------

    def pull_capacity(self) -> int:
        """Maximum tasks that may be claimed in the next cycle."""
        reserve = max(0, int(QUEUE_CENTER_DIFF_DELIVERY.get("head_reserve") or 0))
        target = max(1, int(self._host.PULL_LIMIT) - reserve)
        return max(0, target - self._host.inflight_count())

    def diff_pull_capacity(self) -> int:
        """Claim capacity including the slot reserved for a changed queue head."""
        return max(0, int(self._host.PULL_LIMIT) - self._host.inflight_count())

    def _compute_rank(self, task_type: str) -> int:
        """Preference rank of one task type on this node; -1 = never pull."""
        ranks = COMPUTE_RANK.get(self._host.compute_identity["compute_class"], COMPUTE_RANK[COMPUTE_CLASS_CPU_ONLY])
        compute = str((GLOBAL_TASK_TYPES_BY_KEY.get(task_type) or {}).get("compute") or "cpu_ok")
        return ranks.get(compute, -1)

    def _compute_ordered(self, task_types: List[str]) -> List[str]:
        """Task types this node may pull, in compute-class preference order."""
        return sorted((task_type for task_type in task_types if self._compute_rank(task_type) >= 0), key=self._compute_rank)

    def _ordered_task_types(self) -> List[str]:
        """Compute-class order; types of one class rotate per cycle so they
        share the pull capacity."""
        if self._host.lane_halt_requested():
            return []
        task_types = self._compute_ordered(self._host.pull_task_types())
        self._type_cursor += 1
        ordered: List[str] = []
        for rank in sorted({self._compute_rank(task_type) for task_type in task_types}):
            group = [task_type for task_type in task_types if self._compute_rank(task_type) == rank]
            offset = self._type_cursor % len(group)
            ordered.extend(group[offset:] + group[:offset])
        return ordered

    # -------------------- pull triggers --------------------

    def request_pull(self, prefer_remote: bool = False) -> None:
        """Coalesce event-driven pulls on the shared bus: a wake that lands
        while a cycle runs is remembered and runs once right after it, so a
        change is never lost between cycles."""
        if self._pull_guard.compare_and_set(False, True):
            start_bus_task(self._run_claimed_pull, bool(prefer_remote), thread_name=f"{self._thread_name}PullThread")
        elif prefer_remote:
            self._pull_again.set(True)

    def pull_once(self, prefer_remote: bool = False) -> Dict[str, Any]:
        """Serialize one immediate pull cycle across timer and realtime wakes."""
        if not self._pull_guard.compare_and_set(False, True):
            if prefer_remote:
                self._pull_again.set(True)
            return {"ok": True, "processed": 0, "reason": "pull_inflight"}
        return self._run_claimed_pull(prefer_remote)

    def _run_claimed_pull(self, prefer_remote: bool = False) -> Dict[str, Any]:
        try:
            result = self._host.run_pull_cycle(prefer_remote)
            while self._pull_again.compare_and_set(True, False):
                result = self._host.run_pull_cycle(True)
            return result
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
        if outcome["changed"]:
            # New remote work always ends the idle backoff.
            self._idle_backoff.reset()
            self._idle_until = 0.0
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
            "ok": False, "changed": False,
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
        """Run ONE diff round over the lane's task types (no pull follow-up)."""
        base_url = self._host.active_base_url()
        scope = segment_scope(self._host, base_url)
        changed = False
        for task_type in task_types:
            if not self._probe_due(base_url, task_type):
                continue
            cursor = max(
                int(self._queue_diff_cursors.get(task_type, 0)),
                diff_task_segment_store.remote_cursor(scope, task_type),
            )
            params: Dict[str, Any] = {"cursor": cursor, **self._host.offer_params()}
            response = laravel_client.get(
                queue_center_endpoint("queue_center_queue_diff", queue=task_type),
                base_url=base_url,
                params=params,
                log_line=False,
            )
            if _unknown_task_type(response):
                self._note_unsupported(base_url, task_type)
                continue
            if response.status_code != 200:
                raise RuntimeError(f"Laravel queue diff failed for {task_type}: HTTP {response.status_code}")
            self._note_supported(base_url, task_type)
            self._host.laravel_online(base_url)
            data = response_data(response)
            lane_changed = bool(data.get("changed"))
            self._log_diff_state(task_type, response.status_code, lane_changed)
            self.record_queue_progress(task_type, data.get("progress"))
            changed = changed or lane_changed
        return {"changed": changed, "base_url": base_url, "scope": scope}

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
        """Keep Laravel's progress as sent: the contract ``progress_template``
        ({total, done, failed, pending, cursor, updated_at, languages?})."""
        if isinstance(progress, dict):
            self._queue_progress.set({**self._queue_progress.get(), task_type: dict(progress)})

    # -------------------- dispatch --------------------

    def _dispatch_staged(
        self, tasks: List[Dict[str, Any]], base_url: str, scope: str, validate_claim: bool = False,
    ) -> Dict[str, Any]:
        """Hand staged rows to the local queue. Every row ends dispatched,
        released back to Laravel or skipped with a reason code."""
        report: Dict[str, Any] = {"dispatched": 0, "released": {}, "skipped": {}}

        def count(bucket: str, code: str, amount: int = 1) -> None:
            report[bucket][code] = report[bucket].get(code, 0) + amount

        if self._host.lane_halt_requested():
            releasable = [task for task in tasks if str(task.get("task_id") or "").strip()]
            if releasable:
                self._claims.release(releasable)
                count("released", RELEASE_LANE_HALTED, len(releasable))
            return report
        for task in tasks:
            task_id = str(task.get("task_id") or "")
            task_type = str(task.get("task_type") or "")
            if not task_id or not task_type:
                count("skipped", SKIP_TASK_ROW_INVALID)
                continue
            if validate_claim and not self._claims.validate(task_type, task_id, base_url):
                diff_task_segment_store.consume(scope, task_id)
                count("skipped", SKIP_CLAIM_GONE)
                continue
            accepted = self._host.accept_task(task, base_url)
            if accepted.get("success"):
                report["dispatched"] += 1
                continue
            self._claims.release([task])
            diff_task_segment_store.consume(scope, task_id)
            count("released", RELEASE_LOCAL_REJECTED)
            ColorPrint.yellow(
                f"{self._host.log_prefix} {RELEASE_LOCAL_REJECTED}: task {display_task_id(task_id)} "
                f"released ({accepted.get('error') or 'worker busy'})"
            )
        return report

    @staticmethod
    def _merge_reports(*reports: Dict[str, Any]) -> Dict[str, Any]:
        merged: Dict[str, Any] = {"dispatched": 0, "released": {}, "skipped": {}}
        for report in reports:
            merged["dispatched"] += int(report.get("dispatched") or 0)
            for bucket in ("released", "skipped"):
                for code, amount in (report.get(bucket) or {}).items():
                    merged[bucket][code] = merged[bucket].get(code, 0) + int(amount)
        return merged

    def _recover(self, scope: str, base_url: str, capacity: int) -> Tuple[List[Dict[str, Any]], int]:
        """Staged rows to dispatch again, and how many were held back because
        their terminal result already waits in the outbox (finished work,
        e.g. after a restart: never re-run; the result's settle consumes it)."""
        recovered = diff_task_segment_store.pending(scope, capacity) if capacity > 0 else []
        finished = set(self._host.pending_result_task_ids([str(task.get("task_id") or "") for task in recovered]))
        runnable = [task for task in recovered if str(task.get("task_id") or "") not in finished]
        if runnable:
            self._ledger.remember(runnable, base_url)
        return runnable, len(recovered) - len(runnable)

    def _finish_cycle(self, result: Dict[str, Any], changed: bool) -> Dict[str, Any]:
        """Idle backoff bookkeeping plus the cycle's dispatch accounting."""
        report = result.get("dispatch") or {}
        if report.get("dispatched") or changed:
            self._idle_backoff.reset()
            self._idle_until = 0.0
        else:
            self._idle_until = time.monotonic() + self._idle_backoff.next_delay()
        if report.get("released") or report.get("skipped"):
            ColorPrint.yellow(
                f"{self._host.log_prefix} dispatch dispatched={report.get('dispatched', 0)} "
                f"released={report.get('released')} skipped={report.get('skipped')}"
            )
        self._last_dispatch.set({**report, "at": time.time()})
        if report.get("dispatched") or report.get("released") or report.get("skipped") or changed:
            # Lane-state publishers coalesce this signal into one push.
            THREAD_BUS.signal(AUDIO_QUEUE_CHANGED_SIGNAL, {"reason": "intake", "at": time.time()})
        return result

    def pull_cycle(self, prefer_remote: bool = False) -> Dict[str, Any]:
        """One intake cycle. No intake while the backend breaker is open, and
        a timer-driven cycle waits out the idle backoff; a realtime wake
        (prefer_remote) always runs."""
        if self._host.results_blocked():
            return {"ok": False, "processed": 0, "reason": "result_circuit_open"}
        if not prefer_remote and time.monotonic() < self._idle_until:
            return {"ok": True, "processed": 0, "reason": "idle_backoff"}
        return self._bounded_cycle(prefer_remote)

    def _bounded_cycle(self, prefer_remote: bool) -> Dict[str, Any]:
        task_types = self._ordered_task_types()
        capacity = self.diff_pull_capacity() if prefer_remote else self.pull_capacity()
        if not task_types or capacity <= 0:
            return {"ok": True, "processed": 0, "reason": "no_capacity" if task_types else "no_task_types"}
        base_url = self._host.active_base_url()
        scope = segment_scope(self._host, base_url)
        reports: List[Dict[str, Any]] = []
        held = 0
        recovered: List[Dict[str, Any]] = []
        if not prefer_remote:
            recovered, held = self._recover(scope, base_url, capacity)
        recovered_count = len(recovered)
        if recovered:
            reports.append(self._dispatch_staged(recovered, base_url, scope, validate_claim=True))
            capacity = max(0, capacity - recovered_count)
        remote_capacity = min(capacity, diff_task_segment_store.available_capacity(scope))
        remaining = remote_capacity
        pulled = 0
        for task_type in task_types:
            if remaining <= 0:
                break
            if not self._probe_due(base_url, task_type):
                continue
            params = self._host.identity_params()
            params["capabilities_present"] = 1
            params["limit"] = max(1, min(int(remaining), GLOBAL_TASK_LIMITS["worker_pull"]))
            response = laravel_client.post(
                queue_center_endpoint("worker_task_pull", task_type=task_type),
                base_url=base_url,
                json=params,
            )
            if _unknown_task_type(response):
                self._note_unsupported(base_url, task_type)
                continue
            if response.status_code != 200:
                raise RuntimeError(f"Laravel worker pull failed for {task_type}: HTTP {response.status_code}")
            self._note_supported(base_url, task_type)
            data = response_data(response)
            self.record_queue_progress(task_type, data.get("progress"))
            tasks = _task_rows(data.get("tasks"))
            staged = diff_task_segment_store.stage(scope, tasks) if tasks else []
            if staged:
                self._ledger.remember(staged, base_url)
                pulled += len(staged)
            queue_cursor = int(
                data.get("queue_cursor")
                or self._queue_diff_cursors.get(task_type, 0)
                or diff_task_segment_store.remote_cursor(scope, task_type)
            )
            self._queue_diff_cursors[task_type] = queue_cursor
            diff_task_segment_store.set_remote_cursor(scope, task_type, queue_cursor)
            if staged:
                reports.append(self._dispatch_staged(staged, base_url, scope))
                remaining = max(0, remote_capacity - pulled)
        if prefer_remote:
            recovered, held_now = self._recover(scope, base_url, max(0, capacity - pulled))
            held += held_now
            recovered_count += len(recovered)
            if recovered:
                reports.append(self._dispatch_staged(recovered, base_url, scope, validate_claim=True))
        report = self._merge_reports(*reports)
        if held:
            report["skipped"][SKIP_RESULT_PENDING] = report["skipped"].get(SKIP_RESULT_PENDING, 0) + held
        if pulled:
            progress = self.queue_progress.get(task_types[0], {})
            progress_label = (
                f" progress={int(progress.get('done') or 0)}/{int(progress.get('total') or 0)}" if progress else ""
            )
            ColorPrint.blue(
                f"{self._host.log_prefix} Pulled {pulled} task(s), dispatched {report['dispatched']}{progress_label}"
            )
        return self._finish_cycle({
            "ok": True, "processed": report["dispatched"], "pulled": pulled,
            "recovered": recovered_count, "dispatch": report,
        }, changed=bool(pulled))
