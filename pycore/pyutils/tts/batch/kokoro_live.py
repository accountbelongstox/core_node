# -*- coding: utf-8 -*-
"""Live progress of the Kokoro word/phrase batch (KokoroLive).

The batch library reports group start, per-word generation, group end and batch
end here. One THREAD_BUS-backed owner holds the state; readers take immutable
snapshots (``snapshot`` / ``live_view``) without entering the model queue.
Every change wakes the model-live sampler through ``BusSignals.MODEL_LIVE_WAKE``.
"""

import math
import time
from typing import Any, Dict, List, Optional, Sequence

from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
import pycore.pyutils.tts.kokoro_engine as kokoro_engine

_RECENT_LIMIT = 30
_ENGINE = "kokoro"


class KokoroLiveStore:
    def __init__(self) -> None:
        self._batch_seq = 0
        self._revision = 0
        self._batch: Optional[Dict[str, Any]] = None
        self._md5s: List[str] = []
        self._recent: List[Dict[str, Any]] = []
        self._last_batch: Optional[Dict[str, Any]] = None
        init_serialized_owner(self, "pyutils.tts.kokoro_live.state", "KokoroLiveState")

    def _changed(self) -> None:
        self._revision += 1
        THREAD_BUS.signal(BusSignals.MODEL_LIVE_WAKE, True)

    @serialized_method
    def begin_batch(
        self,
        total_words: int,
        batch_size: int,
        device: str,
        md5s: Sequence[str] = (),
    ) -> int:
        self._batch_seq += 1
        size = max(1, int(batch_size))
        self._md5s = [str(item or "") for item in md5s]
        self._recent = []
        self._batch = {
            "batch_id": self._batch_seq,
            "engine": _ENGINE,
            "device": str(device or ""),
            "batch_size": size,
            "total_words": int(total_words),
            "done_words": 0,
            "failed_words": 0,
            "generated_words": 0,
            "current_group": 0,
            "total_groups": int(math.ceil(total_words / size)) if total_words else 0,
            "phase": "queued",
            "started_at": time.time(),
        }
        self._changed()
        return self._batch_seq

    @serialized_method
    def group_started(self, start_index: int, words: Sequence[str]) -> None:
        if self._batch is None:
            return
        size = int(self._batch["batch_size"])
        self._batch["current_group"] = int(start_index) // size + 1
        self._batch["phase"] = "generating"
        self._changed()

    @serialized_method
    def word_generated(self, index: int, word: str, ms: int, duration_ms: int) -> None:
        if self._batch is None:
            return
        self._batch["generated_words"] += 1
        entry = {
            "index": int(index),
            "word": str(word),
            "md5": self._md5s[index] if 0 <= index < len(self._md5s) else "",
            "ok": True,
            "ms": int(ms),
            "duration_ms": int(duration_ms),
            "rtf": round(ms / duration_ms, 3) if duration_ms > 0 else None,
        }
        self._recent.append(entry)
        del self._recent[:-_RECENT_LIMIT]
        self._changed()

    @serialized_method
    def group_finished(self, outcomes: Sequence[Dict[str, Any]]) -> None:
        if self._batch is None:
            return
        by_index = {entry["index"]: entry for entry in self._recent}
        for outcome in outcomes:
            index = int(outcome.get("index", -1))
            ok = bool(outcome.get("ok"))
            if ok:
                self._batch["done_words"] += 1
            else:
                self._batch["failed_words"] += 1
            entry = by_index.get(index)
            if entry is None:
                entry = {
                    "index": index,
                    "word": str(outcome.get("word") or ""),
                    "md5": self._md5s[index] if 0 <= index < len(self._md5s) else "",
                    "ok": ok,
                    "ms": 0,
                    "duration_ms": 0,
                    "rtf": None,
                }
                self._recent.append(entry)
                del self._recent[:-_RECENT_LIMIT]
            entry["ok"] = ok
            entry["encode_ms"] = int(outcome.get("encode_ms") or 0)
            if not ok:
                entry["error"] = str(outcome.get("error") or "")
        self._batch["phase"] = "between_groups"
        self._changed()

    @serialized_method
    def end_batch(
        self,
        elapsed_ms: int,
        merged_used: bool,
        fallback_used: bool,
        resources: Dict[str, Any],
    ) -> None:
        if self._batch is None:
            return
        finished = self._view_batch(self._batch)
        finished.update({
            "phase": "finished",
            "elapsed_ms": int(elapsed_ms),
            "merged_used": bool(merged_used),
            "fallback_used": bool(fallback_used),
            "finished_at": time.time(),
            "resources": dict(resources or {}),
        })
        seconds = elapsed_ms / 1000.0
        finished["words_per_s"] = (
            round(finished["done_words"] / seconds, 2) if seconds > 0 else 0.0
        )
        self._last_batch = finished
        self._batch = None
        self._changed()

    @staticmethod
    def _view_batch(batch: Dict[str, Any]) -> Dict[str, Any]:
        view = dict(batch)
        elapsed = max(0.0, time.time() - float(batch["started_at"]))
        view["elapsed_ms"] = int(elapsed * 1000)
        view["words_per_s"] = (
            round(batch["done_words"] / elapsed, 2) if elapsed > 0 else 0.0
        )
        return view

    @serialized_method
    def snapshot(self) -> Dict[str, Any]:
        return {
            "running": self._batch is not None,
            "revision": self._revision,
            "batch": self._view_batch(self._batch) if self._batch is not None else None,
            "recent": [dict(entry) for entry in self._recent],
            "last_batch": dict(self._last_batch) if self._last_batch is not None else None,
        }


kokoro_live = KokoroLiveStore()


def model_queue_depth() -> int:
    """Messages waiting on the kokoro model worker (never enters the queue)."""
    return THREAD_BUS.queue_size(kokoro_engine._MODEL_QUEUE)


def live_view() -> Dict[str, Any]:
    """KokoroLive: the batch store plus model load state and worker queue depth."""
    view = kokoro_live.snapshot()
    view["loaded"] = kokoro_engine.is_model_loaded()
    view["model_queue_depth"] = model_queue_depth()
    return view


__all__ = ["KokoroLiveStore", "kokoro_live", "live_view", "model_queue_depth"]
