# -*- coding: utf-8 -*-
"""Engine plan, host-memory gate and concurrency of the audio workers."""

import time
from typing import (
    Any,
    Dict,
    List,
    Optional,
    Tuple,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.backoff_wait import Backoff
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyutils.tts.engine_policy import configured_tts_priority
import pycore.pyutils.tts.tts_status as tts_status
from pycore.pyutils.tts import runtime_profile
from pycore.pyutils.tts.engine_registry import tts_engine_registry
from pycore.pyutils.tts.tts_concurrency import (
    MAX_CONCURRENCY,
    effective_concurrency,
    recommended_concurrency,
)


# TTL for the cached engine probe (tts_status() probes EVERY engine; far too
# expensive per task).
_ENGINE_PROBE_TTL_S = 60.0
# Host-memory wait before a lane pops work its engine cannot load right now.
_MEMORY_WAIT_INITIAL_S = 5.0
_MEMORY_WAIT_MAX_S = 60.0
_MEMORY_WAKE_SIGNAL_PREFIX = "laravel_audio_worker.memory_wake"


class EngineMemoryPauses:
    """Per-engine memory-pause state shared by every audio lane, so a pause
    and its recovery are logged once per engine."""

    def __init__(self) -> None:
        self._paused: Dict[str, bool] = {}
        init_serialized_owner(self, "pyctl.tts.engine_memory_pauses", "EngineMemoryPausesThread")

    @serialized_method
    def transition(self, engine: str, paused: bool) -> bool:
        """Set the engine's pause state; True when it changed."""
        changed = self._paused.get(engine, False) != paused
        self._paused[engine] = paused
        return changed

    @serialized_method
    def paused(self, engine: str) -> bool:
        return bool(self._paused.get(engine))


engine_memory_pauses = EngineMemoryPauses()


class LaravelAudioWorkerEngineMixin:
    """Own the lane engine plan, memory gate and fan-out."""

    # Requests kept in flight per reported native batch slot. A server that
    # batches only what is pending when a batch starts needs more than one
    # batch in flight, or staggered lanes run it with batches of one.
    CAPACITY_BUFFER_FACTOR = 1

    def _required_engine(self) -> Optional[str]:
        """Effective pinned engine for this lane.

        The startup-pinned runtime profile wins over the class pin: on a GPU
        host the sentence lane keeps qwen3tts, on a CPU-only host the profile
        pins sentence/long text to kokoro. None for unpinned lanes (word)."""
        if self.REQUIRED_ENGINE is None:
            return None
        return runtime_profile.pinned_sentence_engine() or self.REQUIRED_ENGINE

    @serialized_method
    def _engine_plan(self) -> Tuple[Optional[str], List[str]]:
        """(planned engine, usable engine list) for this lane (60s TTL cache).

        ``tts_status.tts_status()`` probes EVERY engine - per-task calls
        stall synthesis on sequential availability checks, so the result is
        cached for _ENGINE_PROBE_TTL_S seconds (retired-worker pattern). The
        usable list drives multi-engine fan-out: with per-task engine rotation,
        each usable engine can synthesize a different word concurrently.
        """
        if self._required_engine():
            return self._required_engine(), [self._required_engine()]
        now = time.monotonic()
        if (
            self._engine_probe_cache is not None
            and now - self._engine_probe_ts < _ENGINE_PROBE_TTL_S
        ):
            return self._engine_probe_cache or None, list(self._usable_engines_cache)
        status = tts_status.tts_status(refresh=True)
        entries = {
            str(row.get("name") or ""): row
            for row in status.get("engines", [])
            if isinstance(row, dict)
        }
        usable: List[str] = []
        for candidate in configured_tts_priority(self.PRIORITY_PROFILE):
            row = entries.get(candidate) or {}
            concurrency_class = self._engine_concurrency_class(candidate)
            available = bool(row.get("available")) or (
                concurrency_class == "server" and bool(row.get("installed"))
            )
            if not available or float(row.get("cooldown_remaining") or 0) > 0:
                continue
            usable.append(candidate)
        engine = usable[0] if usable else ""
        self._engine_probe_cache = engine
        self._usable_engines_cache = list(usable)
        self._engine_probe_ts = now
        return engine or None, usable

    def _pinned_lane_engine(self) -> Optional[str]:
        """The one engine this lane synthesizes with (word batch or pin)."""
        if self.LANE == "word":
            return runtime_profile.WORD_BATCH_ENGINE
        return self._required_engine()

    def _await_engine_memory(self) -> bool:
        """Hold the lane while its pinned engine cannot load for lack of host
        memory, instead of popping tasks that would each fail at once. A model
        already resident is reused (the gate only guards a new load). Every
        parallel lane shares one pause state, so it is logged once.

        Returns False when the lane must stop draining (halt or shutdown)."""
        engine = self._pinned_lane_engine()
        if not engine:
            return True
        backoff = Backoff(_MEMORY_WAIT_INITIAL_S, _MEMORY_WAIT_MAX_S)
        while True:
            if self._lane_halt_requested() or THREAD_BUS.is_shutdown_requested():
                return False
            allowed, reason = tts_engine_registry.load_gate(engine)
            if allowed:
                if engine_memory_pauses.transition(engine, False):
                    ColorPrint.green(f"{self._log_prefix} host memory recovered; resuming {engine}")
                return True
            if engine_memory_pauses.transition(engine, True):
                ColorPrint.yellow(f"{self._log_prefix} lane paused: {reason}")
            THREAD_BUS.wait_signal(self._memory_wake_signal(), timeout=backoff.next_delay())
            THREAD_BUS.clear_signal(self._memory_wake_signal())

    def _memory_wake_signal(self) -> str:
        return f"{_MEMORY_WAKE_SIGNAL_PREFIX}.{self.LANE}"

    def wake_memory_wait(self) -> None:
        """End a memory-paused wait now (lane halt or shutdown)."""
        THREAD_BUS.signal(self._memory_wake_signal(), True)

    def request_stop(self, graceful: bool = True) -> None:
        super().request_stop(graceful)
        if not graceful:
            self.wake_memory_wait()

    def _planned_engine(self) -> Optional[str]:
        """First usable engine in this lane's priority profile."""
        return self._engine_plan()[0]

    def _usable_engines(self) -> List[str]:
        """Every currently usable engine in this lane's priority order."""
        return self._engine_plan()[1]

    @staticmethod
    def _engine_concurrency_class(engine: Optional[str]) -> str:
        """Concurrency class of the planned engine; unknown -> serial (safe)."""
        return tts_status.engine_concurrency(engine or "")

    def _effective_concurrency(self) -> Tuple[int, str]:
        """(effective fan-out, planned engine).

        Single-engine chains keep the engine-class value (serial forced to 1).
        Multi-engine chains (no REQUIRED_ENGINE pin) scale to the number of
        usable engines: per-task engine rotation starts each lane on a
        DIFFERENT engine, and same-engine work still serializes on that
        engine's managed lease, so several local models synthesize different
        words at the same time."""
        engine = self._planned_engine() or ""
        kind = self._engine_concurrency_class(engine)
        concurrency = effective_concurrency(kind, self.get_concurrency())
        limit = self._capacity_limit(engine)
        if self.get_concurrency() <= 0 and self._reported_capacity(engine):
            # Auto fan-out fills a server's reported native batch times the
            # lane's buffer factor, so the next batch is already queued.
            concurrency = limit
        if self._required_engine() is None:
            usable_count = len(self._usable_engines())
            if usable_count > 1:
                user_value = self.get_concurrency()
                multi = min(usable_count, self.CONCURRENCY_LIMIT)
                if user_value > 0:
                    concurrency = max(1, min(int(user_value), multi))
                else:
                    concurrency = max(concurrency, multi)
        return min(limit, concurrency), engine

    def _reported_capacity(self, engine: str) -> int:
        """The engine's last reported parallel capacity (refreshed once per
        drain cycle); 0 when it reports none."""
        capacity = self._engine_capacity.get()
        if capacity.get("engine") != engine:
            return 0
        return max(0, int(capacity.get("parallel") or 0))

    def _capacity_limit(self, engine: str) -> int:
        """Lane cap: the engine's reported native batch times the lane's
        buffer factor (never above MAX_CONCURRENCY), else CONCURRENCY_LIMIT."""
        reported = self._reported_capacity(engine)
        if not reported:
            return self.CONCURRENCY_LIMIT
        return min(MAX_CONCURRENCY, reported * max(1, int(self.CAPACITY_BUFFER_FACTOR)))

    def refresh_engine_capacity(self) -> None:
        """Read the planned engine's parallel capacity (one probe per cycle)."""
        engine = self._planned_engine() or ""
        adapter = tts_engine_registry.get(engine) if engine else None
        parallel = adapter.parallel_capacity() if adapter is not None else 0
        self._engine_capacity.set({"engine": engine, "parallel": parallel})

    def concurrency_status(self) -> Dict[str, Any]:
        """Return cached planning data without probing engines on a status RPC."""
        engine = self._required_engine() or self._engine_probe_cache or ""
        kind = self._engine_concurrency_class(engine)
        limit = self._capacity_limit(engine)
        # A reported capacity is the engine's own native batch, which auto fills.
        recommended = limit if self._reported_capacity(engine) else min(limit, recommended_concurrency(kind))
        concurrency = min(
            limit,
            effective_concurrency(kind, self._concurrency) if self._concurrency > 0 else recommended,
        )
        usable_count = len(self._usable_engines_cache)
        if self._required_engine() is None and usable_count > 1:
            multi = min(usable_count, self.CONCURRENCY_LIMIT)
            if self._concurrency > 0:
                concurrency = max(1, min(int(self._concurrency), multi))
            else:
                concurrency = max(concurrency, multi)
            recommended = max(recommended, multi)
        return {
            "concurrency": concurrency,
            "concurrency_recommended": recommended,
            "concurrency_limit": limit,
            "concurrency_engine": engine or None,
            "concurrency_class": kind,
            "usable_engines": list(self._usable_engines_cache),
        }

    @serialized_method
    def set_concurrency(self, concurrency: int) -> None:
        self._concurrency = max(0, int(concurrency))

    def get_concurrency(self) -> int:
        return self._concurrency

    @serialized_method
    def set_speaker(self, speaker: str) -> None:
        self._speaker = str(speaker or "").strip()

    def get_speaker(self) -> str:
        return self._speaker

    @serialized_method
    def invalidate_engine_plan(self) -> None:
        """Apply a changed engine order on the next worker cycle."""
        self._engine_probe_cache = None
        self._usable_engines_cache = []
        self._engine_probe_ts = 0.0


__all__ = ["LaravelAudioWorkerEngineMixin"]
