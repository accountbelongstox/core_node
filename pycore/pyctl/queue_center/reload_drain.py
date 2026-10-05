# -*- coding: utf-8 -*-
"""Assist drain for the dev hot reload: stop intake, free unstarted leased rows, wait for in-flight work."""

from typing import Any, List

from pycore.pyctl.queue_center.lane_registry import LANE_REGISTRY

_ASSIST_LANES = ("word_audio", "sentence_audio", "phrase_audio", "assist_translation", "compute")


def _workers() -> List[Any]:
    return [LANE_REGISTRY[name]["worker"] for name in _ASSIST_LANES if name in LANE_REGISTRY]


def begin_drain() -> None:
    """Immediate lane stop: nothing new is taken, unstarted leased rows go back to the pool,
    tasks already synthesizing finish and report."""
    for worker in _workers():
        worker.request_stop(graceful=False)


def is_idle() -> bool:
    """True when no lane task is mid-generation."""
    return all(worker.inflight_count() == 0 for worker in _workers())


def keepalive() -> None:
    """Refresh each lane's server registration so a long drain keeps the node online."""
    for worker in _workers():
        worker.keep_registered()


__all__ = ["begin_drain", "is_idle", "keepalive"]
