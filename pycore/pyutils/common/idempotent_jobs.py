# -*- coding: utf-8 -*-
"""Client-keyed idempotent jobs: a repeat call with the same ``client_task_id``
attaches to the in-flight job or replays its cached successful result; a
repeat whose request fingerprint differs is rejected."""

import time
from typing import Any, Awaitable, Callable, Dict, Optional, Tuple

from pycore.pyfoundations.serialized_worker import await_bus_task, init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

CLIENT_TASK_ID_PARAM = "client_task_id"
IDEMPOTENT_REPLAY_FIELD = "idempotent_replay"
_DEFAULT_TTL_SECONDS = 600.0
_DEFAULT_MAX_ENTRIES = 1000
_DEFAULT_ATTACH_TIMEOUT_SECONDS = 900.0
_STATE_RUNNING = "running"
_STATE_DONE = "done"
_CLAIM_OWNER = "owner"
_CLAIM_CONFLICT = "conflict"
CLIENT_TASK_ID_CONFLICT_CODE = "client_task_id_payload_mismatch"


class ClientTaskIdConflict(ValueError):
    """The id was already used for a request with a different fingerprint."""

    code = CLIENT_TASK_ID_CONFLICT_CODE


class IdempotentJobs:
    """One keyed job table per service; state lives on its THREAD_BUS owner thread."""

    def __init__(
        self,
        scope: str,
        ttl_seconds: float = _DEFAULT_TTL_SECONDS,
        max_entries: int = _DEFAULT_MAX_ENTRIES,
        attach_timeout_seconds: float = _DEFAULT_ATTACH_TIMEOUT_SECONDS,
    ) -> None:
        self.scope = scope
        self.ttl_seconds = float(ttl_seconds)
        self.max_entries = int(max_entries)
        self.attach_timeout_seconds = float(attach_timeout_seconds)
        self._entries: Dict[str, Dict[str, Any]] = {}
        init_serialized_owner(self, f"pyutils.common.idempotent_jobs.{scope}", "IdempotentJobsThread")

    def _signal_name(self, key: str) -> str:
        return f"pyutils.common.idempotent_jobs.{self.scope}.{key}"

    def _purge(self, now: float) -> None:
        expired = [
            key for key, entry in self._entries.items()
            if entry["state"] == _STATE_DONE and now - entry["at"] > self.ttl_seconds
        ]
        done = sorted(
            (entry["at"], key) for key, entry in self._entries.items()
            if entry["state"] == _STATE_DONE and key not in expired
        )
        overflow = max(0, len(self._entries) - len(expired) - self.max_entries)
        for key in expired + [key for _, key in done[:overflow]]:
            self._entries.pop(key, None)
            THREAD_BUS.clear_signal(self._signal_name(key))

    @serialized_method
    def _claim(self, key: str, fingerprint: str) -> Tuple[str, Any]:
        now = time.monotonic()
        self._purge(now)
        entry = self._entries.get(key)
        if entry is not None:
            if entry["fingerprint"] != fingerprint:
                return _CLAIM_CONFLICT, None
            return entry["state"], entry.get("result")
        self._entries[key] = {"state": _STATE_RUNNING, "at": now, "fingerprint": fingerprint}
        THREAD_BUS.clear_signal(self._signal_name(key))
        return _CLAIM_OWNER, None

    @serialized_method
    def _settle(self, key: str, result: Any, cache: bool) -> None:
        if cache:
            fingerprint = self._entries.get(key, {}).get("fingerprint", "")
            self._entries[key] = {
                "state": _STATE_DONE,
                "at": time.monotonic(),
                "result": result,
                "fingerprint": fingerprint,
            }
        else:
            self._entries.pop(key, None)
        THREAD_BUS.signal(self._signal_name(key), result)

    async def run_async(
        self,
        client_task_id: Optional[str],
        job: Callable[[], Awaitable[Any]],
        job_key: Optional[str] = None,
        fingerprint: str = "",
    ) -> Any:
        """Run a coroutine job once per id on the RPC event loop; owner-thread
        calls and attach waits run off the loop. ``job_key`` (default: the id)
        keys the table, e.g. client + route + id at the RPC dispatch layer;
        ``fingerprint`` (a request digest) must match on every repeat, else
        ClientTaskIdConflict is raised."""
        task_id = str(client_task_id or "").strip()
        if not task_id:
            return await job()
        key = str(job_key or task_id)
        state, cached = await await_bus_task(
            self._claim, key, str(fingerprint), thread_name="IdempotentClaimThread",
        )
        if state == _CLAIM_CONFLICT:
            raise ClientTaskIdConflict(f"{self.scope} job {task_id} was submitted with a different request")
        if state == _STATE_DONE:
            return self._replay(task_id, cached)
        if state == _STATE_RUNNING:
            attached = await await_bus_task(
                THREAD_BUS.wait_signal,
                self._signal_name(key),
                self.attach_timeout_seconds,
                thread_name="IdempotentAttachThread",
            )
            if attached is None:
                return {
                    "success": False,
                    "error": f"in-flight {self.scope} job {task_id} did not finish",
                    CLIENT_TASK_ID_PARAM: task_id,
                }
            return self._replay(task_id, attached)
        result: Any = {"success": False, "error": f"{self.scope} job {task_id} raised"}
        try:
            result = await job()
        finally:
            await await_bus_task(
                self._settle,
                key,
                result,
                bool(isinstance(result, dict) and result.get("success")),
                thread_name="IdempotentSettleThread",
            )
        return {**result, CLIENT_TASK_ID_PARAM: task_id} if isinstance(result, dict) else result

    @staticmethod
    def _replay(task_id: str, result: Any) -> Any:
        if not isinstance(result, dict):
            return result
        return {**result, CLIENT_TASK_ID_PARAM: task_id, IDEMPOTENT_REPLAY_FIELD: True}


__all__ = [
    "CLIENT_TASK_ID_CONFLICT_CODE",
    "CLIENT_TASK_ID_PARAM",
    "ClientTaskIdConflict",
    "IDEMPOTENT_REPLAY_FIELD",
    "IdempotentJobs",
]
