# -*- coding: utf-8 -*-
"""Live load / queue / progress monitor of the local models (model_live).

``snapshot()`` is the one payload of the ``ui/model_live/snapshot`` route and of
the ``model_live.changed`` topic: system CPU/RAM/GPU, the normalized qwen3tts
queue (QwenLive), the kokoro word batch (KokoroLive) and a per-engine
loaded/in-flight/queue-depth map. A sampler thread publishes it at most once per
second, only while a UI client watches (``watch``) or a qwen job / kokoro batch
is active, and sleeps on a THREAD_BUS signal otherwise.
"""

import threading
import time
from typing import Any, Dict

from pycore.pyctl.desktop.video_extract_service import video_extract_service
from pycore.pyctl.tts.laravel_audio_worker import laravel_word_audio_worker
from pycore.pyfoundations.serialized_worker import SerializedValue
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.common.managed_service import managed_services
from pycore.pyutils.rpc.delivery import http_event_delivery_service
import pycore.pyutils.tts.qwen.engine as qwen_engine
import pycore.pyutils.tts.qwen.live as qwen_live
from pycore.pyutils.tts.batch.kokoro_live import kokoro_live, live_view as kokoro_live_view
from pycore.pyutils.tts.qwen.config import ENGINE_NAME as QWEN_ENGINE_NAME

MODEL_LIVE_TOPIC = BusSignals.MODEL_LIVE_CHANGED
_STOP_SIGNAL = "model_live.sampler.stop"
_MANAGED_CATEGORIES = ("tts", "stt", "llm")
_QWEN_CACHE_SECONDS = 1.0
_PUBLISH_INTERVAL_SECONDS = 1.0
_WATCH_TTL_DEFAULT_SECONDS = 30.0
_WATCH_TTL_MAX_SECONDS = 120.0
_KOKORO_ENGINE = "kokoro"


class ModelLiveService:
    def __init__(self) -> None:
        self._sequence = SerializedValue(0, "ModelLiveSequenceState")
        self._watch_until = SerializedValue(0.0, "ModelLiveWatchState")
        self._qwen_cache = SerializedValue((0.0, None), "ModelLiveQwenCacheState")
        self._running = SerializedValue(False, "ModelLiveSamplerRunningState")

    def _next_revision(self) -> int:
        while True:
            current = int(self._sequence.get() or 0)
            if self._sequence.compare_and_set(current, current + 1):
                return current + 1

    def wake(self) -> None:
        THREAD_BUS.signal(BusSignals.MODEL_LIVE_WAKE, True)

    def watch(self, active: bool, ttl_s: Any = None) -> Dict[str, Any]:
        """Declare (or withdraw) UI interest; interest expires after ``ttl_s``."""
        ttl = _WATCH_TTL_DEFAULT_SECONDS
        if isinstance(ttl_s, (int, float)) and ttl_s > 0:
            ttl = min(float(ttl_s), _WATCH_TTL_MAX_SECONDS)
        self._watch_until.set(time.monotonic() + ttl if active else 0.0)
        self.start()
        self.wake()
        return {"watching": bool(active), "ttl_s": ttl if active else 0.0}

    def _watching(self) -> bool:
        return float(self._watch_until.get() or 0.0) > time.monotonic()

    def qwen_live(self) -> Dict[str, Any]:
        """QwenLive with a 1 s cache; the server is asked only while it runs."""
        stamped, cached = self._qwen_cache.get()
        now = time.monotonic()
        if cached is not None and now - stamped < _QWEN_CACHE_SECONDS:
            return cached
        if managed_services.peek_running(QWEN_ENGINE_NAME):
            live = qwen_live.normalize_status(qwen_engine.get_status())
        else:
            live = qwen_live.offline_live()
        self._qwen_cache.set((now, live))
        return live

    @staticmethod
    def _system() -> Dict[str, Any]:
        raw = video_extract_service.system_resources()
        memory = raw.get("mem") if isinstance(raw.get("mem"), dict) else {}
        return {
            "cpu_percent": raw.get("cpu_percent"),
            "mem_percent": memory.get("percent"),
            "mem_used_mb": memory.get("used_mb"),
            "mem_total_mb": memory.get("total_mb"),
            "gpus": [dict(gpu) for gpu in (raw.get("gpus") or []) if isinstance(gpu, dict)],
        }

    @staticmethod
    def _kokoro() -> Dict[str, Any]:
        live = kokoro_live_view()
        counts = laravel_word_audio_worker.live_counts()
        live["queue"] = {
            "queued": counts["queued"],
            "processing": counts["processing"],
            "model_queue_depth": live["model_queue_depth"],
        }
        live["cycle_running"] = counts["cycle_running"]
        live["backend_progress"] = counts.get("backend_progress")
        return live

    def _engines(self, qwen: Dict[str, Any], kokoro: Dict[str, Any]) -> Dict[str, Any]:
        engines: Dict[str, Any] = {}
        for category in _MANAGED_CATEGORIES:
            for name, kind in managed_services.service_kinds(category).items():
                state = managed_services.peek_runtime_status(name)
                engines[name] = {
                    "category": category,
                    "kind": kind,
                    "loaded": bool(state.get("running")),
                    "in_flight": int(state.get("in_flight") or 0),
                    "queue_depth": 0,
                    "idle_remaining_s": state.get("idle_remaining_s"),
                }
        if QWEN_ENGINE_NAME in engines:
            queue = qwen["queue"]
            engines[QWEN_ENGINE_NAME]["queue_depth"] = queue["pending"]
        if _KOKORO_ENGINE in engines:
            engines[_KOKORO_ENGINE]["queue_depth"] = kokoro["model_queue_depth"]
        return engines

    def snapshot(self, advance: bool = False) -> Dict[str, Any]:
        qwen = self.qwen_live()
        kokoro = self._kokoro()
        revision = self._next_revision() if advance else int(self._sequence.get() or 0)
        return {
            "success": True,
            "revision": revision,
            "sampled_at": time.time(),
            "system": self._system(),
            "qwen3tts": qwen,
            "kokoro": kokoro,
            "engines": self._engines(qwen, kokoro),
        }

    def publish(self) -> None:
        snapshot = self.snapshot(advance=True)
        http_event_delivery_service.publish_topic(
            MODEL_LIVE_TOPIC,
            snapshot,
            audience="*",
            entity_type="model_live",
            entity_id="live",
            revision=snapshot["revision"],
        )

    def sampling_active(self) -> bool:
        """UI watching, a kokoro batch running, or a qwen job queued/running."""
        if self._watching():
            return True
        _stamped, cached = self._qwen_cache.get()
        if cached is not None and qwen_live.live_active(cached):
            return True
        return bool(kokoro_live.snapshot()["running"])

    def start(self) -> None:
        """Start the sampler thread once (idempotent)."""
        if not self._running.compare_and_set(False, True):
            return
        THREAD_BUS.clear_signal(_STOP_SIGNAL)
        ModelLiveSamplerThread(self).start()
        THREAD_BUS.register_shutdown_handler(
            self.stop,
            priority=60,
            name="model_live_sampler",
        )

    def stop(self) -> None:
        THREAD_BUS.signal(_STOP_SIGNAL, True)
        self.wake()

    def sampler_stopped(self) -> None:
        self._running.set(False)


class ModelLiveSamplerThread(threading.Thread):
    """Publish while active, at most once per second; block when idle."""

    def __init__(self, service: ModelLiveService) -> None:
        super().__init__(name="ModelLiveSamplerThread", daemon=True)
        self._service = service

    @staticmethod
    def _stopping() -> bool:
        return THREAD_BUS.is_shutdown_requested() or bool(
            THREAD_BUS.get_signal(_STOP_SIGNAL, False)
        )

    def run(self) -> None:
        while not self._stopping():
            active = self._service.sampling_active()
            woke = THREAD_BUS.wait_signal(
                BusSignals.MODEL_LIVE_WAKE,
                timeout=_PUBLISH_INTERVAL_SECONDS if active else None,
            )
            THREAD_BUS.clear_signal(BusSignals.MODEL_LIVE_WAKE)
            if self._stopping():
                break
            if woke is None and not self._service.sampling_active():
                continue
            self._service.publish()
            THREAD_BUS.wait_signal(_STOP_SIGNAL, timeout=_PUBLISH_INTERVAL_SECONDS)
        self._service.sampler_stopped()


model_live_service = ModelLiveService()


__all__ = ["MODEL_LIVE_TOPIC", "ModelLiveService", "model_live_service"]
