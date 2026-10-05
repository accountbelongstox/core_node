# -*- coding: utf-8 -*-
"""Elastic pool of long-lived Thread-subclass workers fed through THREAD_BUS.

``submit`` never starts a thread and never waits: it hands the job to an idle
worker, or queues it and asks the pool's grower thread for one more worker.
Every worker takes queued jobs first, then idles; an idle worker retires after
``idle_seconds``. An idle worker is claimed with a THREAD_BUS signal, so a job
is never sent to a worker that is retiring.
"""

from __future__ import annotations

import threading
import traceback
import uuid
from typing import Callable

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

Job = Callable[[], None]


class _PoolNames:
    def __init__(self, pool_name: str) -> None:
        base = f"pyfoundations.elastic_pool.{pool_name}.{uuid.uuid4().hex}"
        self.pending = f"{base}.pending"
        self.idle = f"{base}.idle"
        self.grow = f"{base}.grow"
        self.worker_prefix = f"{base}.worker."


class ElasticWorkerThread(threading.Thread):
    def __init__(self, names: _PoolNames, thread_name: str, idle_seconds: float) -> None:
        super().__init__(name=thread_name, daemon=True)
        self._names = names
        self._idle_seconds = idle_seconds
        self._inbox = f"{names.worker_prefix}{uuid.uuid4().hex}"
        self._idle_signal = f"{self._inbox}.idle"

    def run(self) -> None:
        while True:
            job = THREAD_BUS.receive_message(self._names.pending)
            if job is None:
                job = self._wait_for_job()
            if job is None:
                THREAD_BUS.clear_queue(self._inbox)
                return
            self._run_job(job)

    def _wait_for_job(self) -> "Job | None":
        THREAD_BUS.signal(self._idle_signal, True)
        THREAD_BUS.send_message(self._names.idle, (self._inbox, self._idle_signal))
        job = THREAD_BUS.receive_message(self._inbox, block=True, timeout=self._idle_seconds)
        if job is not None:
            return job
        if THREAD_BUS.clear_signal(self._idle_signal):
            return None
        return THREAD_BUS.receive_message(self._inbox, block=True)

    def _run_job(self, job: Job) -> None:
        try:
            job()
        except Exception as exc:
            trace = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)).rstrip()
            ColorPrint.red(f"[ElasticWorkerPool] job failed thread={self.name} error={exc!r}\n{trace}")


class ElasticWorkerGrowerThread(threading.Thread):
    def __init__(self, names: _PoolNames, thread_name: str, idle_seconds: float) -> None:
        super().__init__(name=f"{thread_name}Grower", daemon=True)
        self._names = names
        self._worker_name = thread_name
        self._idle_seconds = idle_seconds

    def run(self) -> None:
        while True:
            THREAD_BUS.receive_message(self._names.grow, block=True)
            try:
                ElasticWorkerThread(self._names, self._worker_name, self._idle_seconds).start()
            except RuntimeError as exc:
                ColorPrint.red(f"[ElasticWorkerPool] cannot start worker {self._worker_name}: {exc}")


class ElasticWorkerPool:
    """Jobs run on reusable worker threads named ``thread_name``."""

    def __init__(self, thread_name: str, idle_seconds: float) -> None:
        self._names = _PoolNames(thread_name)
        ElasticWorkerGrowerThread(self._names, thread_name, float(idle_seconds)).start()

    def submit(self, job: Job) -> None:
        while True:
            claim = THREAD_BUS.receive_message(self._names.idle)
            if claim is None:
                break
            inbox, idle_signal = claim
            if THREAD_BUS.clear_signal(idle_signal):
                THREAD_BUS.send_message(inbox, job)
                return
        THREAD_BUS.send_message(self._names.pending, job)
        THREAD_BUS.send_message(self._names.grow, True)


__all__ = ["ElasticWorkerPool"]
