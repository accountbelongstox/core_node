# -*- coding: utf-8 -*-
"""Pycore-owned Queue Center snapshot and Laravel incremental stream."""

from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from pycore.pyfoundations.http_sse import SseEventDecoder, is_sse_content_type
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
    start_bus_task,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.assist.service import assist_status
from pycore.pyctl.assist.wiring import resolve_selected_endpoint_for_ui
from pycore.pyctl.queue_center.control_service import get_control_intent
from pycore.pyctl.queue_center.task_center_sections import build_section_contracts
from pycore.pyctl.tts.laravel_audio_worker import (
    laravel_sentence_audio_worker,
    laravel_word_audio_worker,
)
from pycore.pyctl.tts.sentence_audio_auto import get_status as get_sentence_audio_status
from pycore.pyctl.tts.status_service import status as get_tts_status
from pycore.pyctl.tts.word_tts_auto import get_status as get_word_audio_status
from pycore.pyctl.translation.worker.worker import translation_worker_service
from pycore.pyutils.common.queue_bump_hub import queue_bump_hub
from pycore.pyutils.common.queue_center_contract import GLOBAL_TASK_LIMITS
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_QUEUE_CENTER_KEY,
    status_snapshot_cache,
)
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.rpc_v2.delivery import http_event_delivery_service


QUEUE_CENTER_SNAPSHOT_TOPIC = "queue_center.snapshot.changed"
QUEUE_CENTER_STREAM_PATH = "/api/queue-center/stream"
QUEUE_CENTER_PRIORITY_EVENTS = {
    "task.priority": "word_translation",
    "word_audio.priority": "word_audio",
    "sentence.priority": "sentence_audio",
    "word_image.priority": "word_media",
    "cover.priority": "cover",
    "poster.priority": "poster",
}
QUEUE_CENTER_CONTROL_EVENTS = frozenset(("stream.open", "ping", "stream.close"))
QUEUE_CENTER_SSE_EVENTS = QUEUE_CENTER_CONTROL_EVENTS | frozenset(
    QUEUE_CENTER_PRIORITY_EVENTS
)
QUEUE_CENTER_HEAD_LIMIT = 100
QUEUE_CENTER_REMOTE_SLICES = (
    ("overview", "/api/app_qy_v1/assist/overview", {}),
    ("queue_overview", "/api/queue-center/overview", {}),
    (
        "translation_queue",
        "/api/app_qy_v1/ai_tools/translation/queue/list",
        {"status": "pending", "limit": QUEUE_CENTER_HEAD_LIMIT},
    ),
    (
        "sentence_queue",
        "/api/app_qy_v1/ai_tools/tts/sentence/missing",
        {"page": 1, "per_page": GLOBAL_TASK_LIMITS["monitor"]},
    ),
)
QUEUE_CENTER_REMOTE_TIMEOUT_SECONDS = 8
QUEUE_CENTER_COLD_WAIT_SECONDS = (
    QUEUE_CENTER_REMOTE_TIMEOUT_SECONDS * len(QUEUE_CENTER_REMOTE_SLICES) + 2
)
QUEUE_CENTER_REFRESH_INTERVAL_SECONDS = 15.0
QUEUE_CENTER_RECONNECT_MIN_SECONDS = 1.0
QUEUE_CENTER_RECONNECT_MAX_SECONDS = 15.0
QUEUE_CENTER_REFRESH_SIGNAL = "queue_center.snapshot.refreshing"
QUEUE_CENTER_REFRESH_DONE_SIGNAL = "queue_center.snapshot.refresh.done"
QUEUE_CENTER_STOP_SIGNAL = "queue_center.snapshot.stop"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _response_data(response: Any) -> Dict[str, Any]:
    if response.status_code != 200:
        raise RuntimeError(f"Laravel Queue Center request failed: HTTP {response.status_code}")
    payload = response.json()
    if not isinstance(payload, dict):
        raise TypeError("Laravel Queue Center response must be an object")
    data = payload.get("data")
    return dict(data) if isinstance(data, dict) else dict(payload)


def _heartbeat_callbacks() -> List[Dict[str, Any]]:
    stats = shared_heartbeat_system.get_stats()
    heartbeat = stats.get("heartbeat") if isinstance(stats.get("heartbeat"), dict) else {}
    callbacks = heartbeat.get("callbacks") if isinstance(heartbeat.get("callbacks"), dict) else {}
    return [
        {"name": name, **dict(value)}
        for name, value in callbacks.items()
        if isinstance(value, dict)
    ]


def _queue_metrics(queue_overview: Dict[str, Any], scope: str) -> Optional[Dict[str, int]]:
    queues = queue_overview.get("queues") if isinstance(queue_overview.get("queues"), dict) else {}
    metrics = queues.get(scope)
    if not isinstance(metrics, dict):
        return None
    pending = int(metrics.get("pending") or 0)
    leased = int(metrics.get("assigned") or metrics.get("leased") or 0)
    processing = int(metrics.get("processing") or 0)
    return {
        "pending": pending,
        "leased": leased,
        "processing": processing,
        "total": pending + leased + processing,
    }


class QueueCenterRealtimeThread(threading.Thread):
    """Consume Laravel queue-head events and patch the Pycore cache."""

    def __init__(self, service: "QueueCenterSnapshotService") -> None:
        super().__init__(name="QueueCenterRealtimeThread", daemon=True)
        self._service = service
        self._active_response: Any = None
        self._decoder = SseEventDecoder()

    def stop(self) -> None:
        THREAD_BUS.signal(QUEUE_CENTER_STOP_SIGNAL, True)
        response = self._active_response
        if response is not None:
            try:
                response.close()
            except Exception as exc:
                ColorPrint.yellow(f"[QueueCenterCache] stream close failed: {exc}")

    def run(self) -> None:
        reconnect_seconds = QUEUE_CENTER_RECONNECT_MIN_SECONDS
        while not THREAD_BUS.is_shutdown_requested() and not THREAD_BUS.get_signal(
            QUEUE_CENTER_STOP_SIGNAL,
            False,
        ):
            refresh_after_close = False
            try:
                endpoint = self._service.endpoint()
                if not endpoint:
                    raise RuntimeError("Laravel endpoint is unavailable")
                cursor = self._service.stream_cursor()
                params = {"cursor": cursor} if cursor > 0 else {}
                response = laravel_client.get_stream(
                    QUEUE_CENTER_STREAM_PATH,
                    base_url=endpoint,
                    params=params,
                    timeout=60,
                )
                self._active_response = response
                if response.status_code != 200:
                    raise RuntimeError(
                        f"Laravel Queue Center stream failed: HTTP {response.status_code}"
                    )
                content_type = response.headers.get("Content-Type")
                if not is_sse_content_type(content_type):
                    raise RuntimeError(
                        "Laravel Queue Center stream returned unexpected content type: "
                        f"{content_type or 'missing'}"
                    )
                self._service.note_realtime_connected(endpoint)
                self._service.request_refresh_if_due()
                reconnect_seconds = QUEUE_CENTER_RECONNECT_MIN_SECONDS
                refresh_after_close = self._consume(response, endpoint)
            except Exception as exc:
                self._service.note_realtime_disconnected(str(exc))
                ColorPrint.yellow(f"[QueueCenterCache] realtime reconnect: {exc}")
                THREAD_BUS.wait_signal(QUEUE_CENTER_STOP_SIGNAL, timeout=reconnect_seconds)
                reconnect_seconds = min(
                    QUEUE_CENTER_RECONNECT_MAX_SECONDS,
                    reconnect_seconds * 2,
                )
            finally:
                response = self._active_response
                self._active_response = None
                if response is not None:
                    try:
                        response.close()
                    except Exception as exc:
                        ColorPrint.yellow(f"[QueueCenterCache] stream cleanup failed: {exc}")
            if refresh_after_close and not THREAD_BUS.is_shutdown_requested() and not THREAD_BUS.get_signal(
                QUEUE_CENTER_STOP_SIGNAL,
                False,
            ):
                self._service.refresh_if_due(wait_for_existing=True)

    def _consume(self, response: Any, endpoint: str) -> bool:
        self._decoder.reset()
        for raw_line in response.iter_lines(decode_unicode=True):
            if THREAD_BUS.is_shutdown_requested() or THREAD_BUS.get_signal(
                QUEUE_CENTER_STOP_SIGNAL,
                False,
            ) or self._service.endpoint() != endpoint:
                return False
            event = self._decoder.feed_line(raw_line)
            if event is None:
                continue
            event_name, data, _event_id = event
            if self._dispatch(event_name, data):
                return True
        raise ConnectionError("Laravel Queue Center stream ended before stream.close")

    def _dispatch(self, event_name: str, data: str) -> bool:
        if event_name not in QUEUE_CENTER_SSE_EVENTS:
            return False
        try:
            payload = json.loads(data)
        except json.JSONDecodeError as exc:
            ColorPrint.yellow(f"[QueueCenterCache] invalid SSE frame: {exc}")
            return False
        if not isinstance(payload, dict):
            return False
        cursor = int(payload.get("_id") or payload.get("cursor") or 0)
        if event_name in QUEUE_CENTER_CONTROL_EVENTS:
            self._service.advance_stream_cursor(cursor)
            return event_name == "stream.close"
        if event_name in QUEUE_CENTER_PRIORITY_EVENTS:
            self._service.apply_priority_event(event_name, payload, cursor)
        return False


class QueueCenterSnapshotService:
    """Own one bounded Queue Center snapshot for every UI client."""

    def __init__(self) -> None:
        self._refresh_generation = 0
        self._thread: Optional[QueueCenterRealtimeThread] = None
        init_serialized_owner(
            self,
            "queue_center.snapshot.state",
            "QueueCenterSnapshotStateThread",
        )
        THREAD_BUS.clear_signal(QUEUE_CENTER_STOP_SIGNAL)
        laravel_endpoint_manager.register_endpoint_change_listener(
            self.on_endpoint_changed
        )

    @serialized_method
    def _claim_refresh(self) -> Tuple[bool, int]:
        if THREAD_BUS.get_signal(QUEUE_CENTER_REFRESH_SIGNAL, False):
            return False, self._refresh_generation
        self._refresh_generation += 1
        THREAD_BUS.signal(QUEUE_CENTER_REFRESH_SIGNAL, True)
        THREAD_BUS.clear_signal(QUEUE_CENTER_REFRESH_DONE_SIGNAL)
        return True, self._refresh_generation

    @serialized_method
    def _finish_refresh(self, generation: int) -> None:
        if generation != self._refresh_generation:
            return
        THREAD_BUS.signal(QUEUE_CENTER_REFRESH_SIGNAL, False)
        THREAD_BUS.signal(
            QUEUE_CENTER_REFRESH_DONE_SIGNAL,
            {"generation": generation, "completed": True},
        )

    @serialized_method
    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        THREAD_BUS.clear_signal(QUEUE_CENTER_STOP_SIGNAL)
        self._thread = QueueCenterRealtimeThread(self)
        self._thread.start()
        self.request_refresh()
        THREAD_BUS.register_shutdown_handler(
            self.stop,
            priority=60,
            name="queue_center_snapshot",
        )

    def stop(self) -> None:
        thread = self._thread
        if thread is not None:
            thread.stop()

    def endpoint(self) -> str:
        selected = resolve_selected_endpoint_for_ui(monitor_reachable=False) or {}
        return str(selected.get("base_url") or "").rstrip("/")

    def stream_cursor(self) -> int:
        snapshot = status_snapshot_cache.peek(STATUS_SNAPSHOT_QUEUE_CENTER_KEY) or {}
        cache = snapshot.get("cache") if isinstance(snapshot.get("cache"), dict) else {}
        return int(cache.get("stream_cursor") or 0)

    def advance_stream_cursor(self, cursor: int) -> None:
        if cursor <= 0:
            return

        def updater(snapshot: Dict[str, Any]) -> Dict[str, Any]:
            cache = dict(snapshot.get("cache") or {})
            cache["stream_cursor"] = max(int(cache.get("stream_cursor") or 0), cursor)
            snapshot["cache"] = cache
            return snapshot

        status_snapshot_cache.update(STATUS_SNAPSHOT_QUEUE_CENTER_KEY, updater)

    def get_snapshot(self, request_refresh: bool = False) -> Dict[str, Any]:
        self.start()
        snapshot = status_snapshot_cache.peek(STATUS_SNAPSHOT_QUEUE_CENTER_KEY)
        cache = snapshot.get("cache") if isinstance(snapshot, dict) and isinstance(snapshot.get("cache"), dict) else {}
        remote_attempted = float(cache.get("last_refresh_attempt_at") or 0) > 0
        if snapshot is None or not remote_attempted:
            snapshot = self.refresh_remote(wait_for_existing=True)
        elif request_refresh:
            self.request_refresh()
        return self._with_local_state(snapshot or self._empty_snapshot())

    def request_refresh(self) -> None:
        start_bus_task(
            self.refresh_remote,
            thread_name="QueueCenterSnapshotRefreshThread",
        )

    def request_refresh_if_due(self) -> None:
        start_bus_task(
            self.refresh_if_due,
            thread_name="QueueCenterSnapshotRefreshIfDueThread",
        )

    def refresh_if_due(self, wait_for_existing: bool = False) -> Dict[str, Any]:
        snapshot = status_snapshot_cache.peek(STATUS_SNAPSHOT_QUEUE_CENTER_KEY) or {}
        cache = snapshot.get("cache") if isinstance(snapshot.get("cache"), dict) else {}
        last_attempt = float(cache.get("last_refresh_attempt_at") or 0)
        if last_attempt > 0 and time.time() - last_attempt < QUEUE_CENTER_REFRESH_INTERVAL_SECONDS:
            return snapshot
        return self.refresh_remote(wait_for_existing=wait_for_existing)

    def refresh_remote(self, wait_for_existing: bool = False) -> Dict[str, Any]:
        claimed, generation = self._claim_refresh()
        if not claimed:
            if wait_for_existing:
                THREAD_BUS.wait_signal(
                    QUEUE_CENTER_REFRESH_DONE_SIGNAL,
                    timeout=QUEUE_CENTER_COLD_WAIT_SECONDS,
                )
            return status_snapshot_cache.peek(STATUS_SNAPSHOT_QUEUE_CENTER_KEY) or self._empty_snapshot()

        try:
            refresh_started_at = time.time()
            endpoint = self.endpoint()
            current = status_snapshot_cache.peek(STATUS_SNAPSHOT_QUEUE_CENTER_KEY) or self._empty_snapshot()
            slices = {
                "overview": current.get("overview"),
                "queue_overview": current.get("queueOverview"),
                "translation_queue": current.get("translation"),
                "sentence_queue": current.get("sentenceQueue"),
            }
            errors: Dict[str, str] = {}
            successes = 0
            successful_names: set[str] = set()
            if endpoint:
                for name, path, params in QUEUE_CENTER_REMOTE_SLICES:
                    try:
                        response = laravel_client.get(
                            path,
                            base_url=endpoint,
                            params=params,
                            timeout=QUEUE_CENTER_REMOTE_TIMEOUT_SECONDS,
                        )
                        slices[name] = _response_data(response)
                        successes += 1
                        successful_names.add(name)
                    except Exception as exc:
                        error_key = {
                            "queue_overview": "queue_metrics",
                            "translation_queue": "translation",
                        }.get(name, name)
                        errors[error_key] = str(exc)
                        ColorPrint.yellow(
                            f"[QueueCenterCache] {name} refresh failed: {exc}"
                        )
            else:
                errors["laravel"] = "LARAVEL_ENDPOINT_UNAVAILABLE"

            refreshed_at = time.time()
            base_cursor = self.stream_cursor()

            def merge(latest: Dict[str, Any]) -> Dict[str, Any]:
                latest_cache = dict(latest.get("cache") or {})
                latest_cursor = int(latest_cache.get("stream_cursor") or 0)
                next_snapshot = dict(latest)
                if slices["overview"] is not None:
                    next_snapshot["overview"] = (
                        self._normalize_overview(
                            dict(slices["overview"]),
                            True,
                            refreshed_at,
                        )
                        if "overview" in successful_names
                        else dict(slices["overview"])
                    )
                if slices["queue_overview"] is not None:
                    next_snapshot["queueOverview"] = dict(slices["queue_overview"])
                if slices["sentence_queue"] is not None:
                    next_snapshot["sentenceQueue"] = (
                        self._normalize_sentence_queue(dict(slices["sentence_queue"]))
                        if "sentence_queue" in successful_names
                        else dict(slices["sentence_queue"])
                    )
                if slices["translation_queue"] is not None:
                    next_snapshot["translation"] = (
                        self._normalize_translation_queue(
                            dict(slices["translation_queue"]),
                            bool(latest_cache.get("realtime_connected")),
                            int(latest_cache.get("event_count") or 0),
                        )
                        if "translation_queue" in successful_names
                        else dict(slices["translation_queue"])
                    )
                queue_heads = latest_cache.get("queue_heads")
                queue_heads = queue_heads if isinstance(queue_heads, dict) else {}
                for item in reversed(list(queue_heads.get("sentence_audio") or [])):
                    if (
                        not isinstance(item, dict)
                        or float(item.get("received_at") or 0) < refresh_started_at
                    ):
                        continue
                    event_payload = item.get("payload")
                    next_snapshot["sentenceQueue"] = self._promote_sentence_row(
                        next_snapshot.get("sentenceQueue"),
                        event_payload if isinstance(event_payload, dict) else item,
                    )
                for item in reversed(list(queue_heads.get("word_translation") or [])):
                    if (
                        not isinstance(item, dict)
                        or not item.get("task_id")
                        or float(item.get("received_at") or 0) < refresh_started_at
                    ):
                        continue
                    next_snapshot["translation"] = self._promote_translation_row(
                        next_snapshot.get("translation"),
                        str(item["task_id"]),
                        int(item.get("priority") or 0),
                    )
                next_snapshot["generatedAt"] = _utc_now()
                next_snapshot["laravelReachable"] = successes > 0
                next_snapshot["laravelActiveEndpoint"] = endpoint or None
                next_snapshot["errors"] = errors
                next_snapshot["cache"] = {
                    **latest_cache,
                    "warm": successes > 0 or bool(latest_cache.get("warm")),
                    "revision": int(latest_cache.get("revision") or 0) + 1,
                    "stream_cursor": max(base_cursor, latest_cursor),
                    "last_remote_refresh_at": refreshed_at if successes > 0 else latest_cache.get("last_remote_refresh_at"),
                    "last_refresh_attempt_at": refreshed_at,
                    "source": "pycore",
                }
                return next_snapshot

            snapshot = status_snapshot_cache.update(
                STATUS_SNAPSHOT_QUEUE_CENTER_KEY,
                merge,
            )
            self._publish_changed("remote_refresh", snapshot)
            return snapshot
        finally:
            self._finish_refresh(generation)

    def note_realtime_connected(self, endpoint: str) -> None:
        def updater(snapshot: Dict[str, Any]) -> Dict[str, Any]:
            snapshot["laravelReachable"] = True
            snapshot["laravelActiveEndpoint"] = endpoint
            cache = dict(snapshot.get("cache") or {})
            cache["realtime_connected"] = True
            snapshot["cache"] = cache
            return snapshot

        status_snapshot_cache.update(STATUS_SNAPSHOT_QUEUE_CENTER_KEY, updater)

    def note_realtime_disconnected(self, error: str) -> None:
        def updater(snapshot: Dict[str, Any]) -> Dict[str, Any]:
            cache = dict(snapshot.get("cache") or {})
            cache["realtime_connected"] = False
            cache["realtime_error"] = error[:240]
            snapshot["cache"] = cache
            return snapshot

        status_snapshot_cache.update(STATUS_SNAPSHOT_QUEUE_CENTER_KEY, updater)

    def apply_priority_event(
        self,
        event_name: str,
        payload: Dict[str, Any],
        cursor: int,
    ) -> None:
        if cursor > 0 and cursor <= self.stream_cursor():
            return
        queue = QUEUE_CENTER_PRIORITY_EVENTS[event_name]
        task_id = str(payload.get("task_id") or "").strip()
        priority = int(payload.get("priority") or 0)
        move_to_head = str(payload.get("bump") or "bumped") != "reprioritized"
        old_priority = payload.get("old_priority")
        old_priority = int(old_priority) if isinstance(old_priority, (int, float)) else None
        label = self._priority_label(payload, task_id, queue)
        if task_id and queue in ("word_audio", "sentence_audio"):
            worker = (
                laravel_word_audio_worker
                if queue == "word_audio"
                else laravel_sentence_audio_worker
            )
            if move_to_head:
                worker.promote_cached_task(task_id, priority)
            else:
                worker.reprioritize_cached_task(task_id, priority)
        elif task_id:
            if move_to_head:
                translation_worker_service.promote_cached_task(task_id, priority)
            else:
                translation_worker_service.reprioritize_cached_task(task_id, priority)
        if move_to_head:
            queue_bump_hub.record(
                queue,
                task_id or f"event-{cursor}",
                label,
                old_priority if old_priority is not None else "queue",
                priority or "head",
                payload,
            )

        def updater(snapshot: Dict[str, Any]) -> Dict[str, Any]:
            cache = dict(snapshot.get("cache") or {})
            cache["warm"] = bool(cache.get("warm"))
            cache["revision"] = int(cache.get("revision") or 0) + 1
            cache["stream_cursor"] = max(int(cache.get("stream_cursor") or 0), cursor)
            cache["realtime_connected"] = True
            cache["event_count"] = int(cache.get("event_count") or 0) + 1
            heads = dict(cache.get("queue_heads") or {})
            current_heads = list(heads.get(queue) or [])
            event_item = {
                "task_id": task_id or None,
                "label": label,
                "language": payload.get("language"),
                "priority": priority,
                "cursor": cursor,
                "received_at": time.time(),
                "payload": dict(payload),
            }
            current_heads = [
                item for item in current_heads
                if str(item.get("task_id") or "") != task_id or not task_id
            ]
            heads[queue] = (
                [event_item, *current_heads][:QUEUE_CENTER_HEAD_LIMIT]
                if move_to_head
                else current_heads
            )
            cache["queue_heads"] = heads
            snapshot["cache"] = cache
            snapshot["generatedAt"] = _utc_now()
            snapshot["laravelReachable"] = True
            if queue == "sentence_audio" and task_id:
                snapshot["sentenceQueue"] = self._promote_sentence_row(
                    snapshot.get("sentenceQueue"),
                    payload,
                )
            if queue == "word_translation" and task_id:
                snapshot["translation"] = (
                    self._promote_translation_row(
                        snapshot.get("translation"),
                        task_id,
                        priority,
                    )
                    if move_to_head
                    else self._reprioritize_translation_row(
                        snapshot.get("translation"),
                        task_id,
                        priority,
                    )
                )
            return snapshot

        snapshot = status_snapshot_cache.update(
            STATUS_SNAPSHOT_QUEUE_CENTER_KEY,
            updater,
        )
        self._publish_changed(event_name, snapshot)
        if payload.get("batch") or not move_to_head:
            self.request_refresh()

    @staticmethod
    def _priority_label(payload: Dict[str, Any], task_id: str, queue: str) -> str:
        direct = (
            payload.get("word")
            or payload.get("text")
            or payload.get("content_id")
            or payload.get("md5")
            or task_id
        )
        if direct:
            return str(direct)
        items = payload.get("items")
        if isinstance(items, list) and items:
            first = items[0]
            if isinstance(first, dict):
                value = first.get("word") or first.get("id") or first.get("md5")
                if value:
                    return str(value)
        count = int(payload.get("count") or 0)
        return f"{queue} ({count})" if count > 0 else queue

    def on_endpoint_changed(self, _new_url: str) -> None:
        status_snapshot_cache.invalidate(STATUS_SNAPSHOT_QUEUE_CENTER_KEY)
        self.request_refresh()

    def _with_local_state(self, snapshot: Dict[str, Any]) -> Dict[str, Any]:
        result = dict(snapshot)
        word_audio = get_word_audio_status()
        sentence_audio = get_sentence_audio_status()
        assist = assist_status(include_laravel=False)
        tts = get_tts_status()
        result["wordAudio"] = word_audio
        result["sentenceAudio"] = sentence_audio
        result["assist"] = assist
        result["tts"] = tts
        result["pycoreReachable"] = True
        result["workerApiUrl"] = (
            (assist.get("endpoint") or {}).get("base_url")
            if isinstance(assist.get("endpoint"), dict)
            else None
        )
        sentence_queue = dict(result.get("sentenceQueue") or {})
        sentence_queue["worker"] = sentence_audio.get("worker")
        sentence_queue["bumps"] = queue_bump_hub.snapshot()
        result["sentenceQueue"] = sentence_queue
        translation = result.get("translation")
        cache = result.get("cache") if isinstance(result.get("cache"), dict) else {}
        if isinstance(translation, dict):
            translation = dict(translation)
            translation["event_connected"] = bool(cache.get("realtime_connected"))
            translation["event_count"] = int(cache.get("event_count") or 0)
            result["translation"] = translation
        result["sectionContracts"] = self._section_contracts(
            result,
            assist,
            word_audio,
            sentence_audio,
        )
        return self._apply_snapshot_age(result)

    def _section_contracts(
        self,
        snapshot: Dict[str, Any],
        assist: Dict[str, Any],
        word_audio: Dict[str, Any],
        sentence_audio: Dict[str, Any],
    ) -> Dict[str, Any]:
        callback_names = {
            "assist_translation": "translation_worker",
            "word_audio": "tts_queue_poller",
            "sentence_audio": "tts_sentence_worker",
        }
        configured = {
            "assist_translation": bool(assist.get("processor_enabled")),
            "word_audio": bool(word_audio.get("processor_enabled")),
            "sentence_audio": bool(sentence_audio.get("processor_enabled")),
        }
        controls: Dict[str, Any] = {}
        for scope, callback_name in callback_names.items():
            controls[scope] = {
                **get_control_intent(scope),
                "configured": configured[scope],
                "running": shared_heartbeat_system.is_callback_enabled(callback_name),
            }
        errors = snapshot.get("errors") if isinstance(snapshot.get("errors"), dict) else {}
        contracts = build_section_contracts(
            controls,
            errors,
            str(snapshot.get("generatedAt") or _utc_now()),
            snapshot.get("overview") if isinstance(snapshot.get("overview"), dict) else {},
            {"scheduler": {"callbacks": _heartbeat_callbacks()}},
        )
        queue_overview = snapshot.get("queueOverview") if isinstance(snapshot.get("queueOverview"), dict) else {}
        for scope in ("word_audio", "sentence_audio"):
            metrics = _queue_metrics(queue_overview, scope)
            if metrics is not None:
                contracts[scope]["queue"] = metrics
        contracts["word_audio"]["worker"].update({
            "online": bool(word_audio.get("processor_enabled")),
            "claimed": int((word_audio.get("worker") or {}).get("total_claimed") or 0),
            "ok": int((word_audio.get("worker") or {}).get("total_succeeded") or 0),
            "fail": int((word_audio.get("worker") or {}).get("total_failed") or 0),
        })
        contracts["sentence_audio"]["worker"].update({
            "online": bool(sentence_audio.get("processor_enabled")),
            "claimed": int((sentence_audio.get("worker") or {}).get("total_claimed") or 0),
            "ok": int((sentence_audio.get("worker") or {}).get("total_succeeded") or 0),
            "fail": int((sentence_audio.get("worker") or {}).get("total_failed") or 0),
        })
        return contracts

    @staticmethod
    def _normalize_overview(
        overview: Dict[str, Any],
        reachable: bool,
        observed_at: float,
    ) -> Dict[str, Any]:
        overview["laravel_reachable"] = reachable
        overview["laravel_snapshot_age_s"] = 0
        overview["source"] = "pycore_cache"
        overview["degraded"] = not reachable
        overview["stale"] = not reachable
        overview["age_s"] = 0
        overview["observed_at"] = overview.get("observed_at") or datetime.fromtimestamp(
            observed_at,
            tz=timezone.utc,
        ).isoformat()
        overview["engines"] = overview.get("engines") or {}
        return overview

    @staticmethod
    def _normalize_sentence_queue(payload: Dict[str, Any]) -> Dict[str, Any]:
        queue = payload.get("queue") if isinstance(payload.get("queue"), dict) else payload
        queue = dict(queue)
        queue["laravel_reachable"] = True
        queue["snapshot_age_s"] = 0
        return {"success": True, "queue": queue}

    @staticmethod
    def _normalize_translation_queue(
        payload: Dict[str, Any],
        event_connected: bool,
        event_count: int,
    ) -> Dict[str, Any]:
        payload["laravel_reachable"] = True
        payload["event_connected"] = event_connected
        payload["event_count"] = event_count
        payload["age_ms"] = 0
        return payload

    @staticmethod
    def _promote_translation_row(
        translation: Any,
        task_id: str,
        priority: int,
    ) -> Dict[str, Any]:
        snapshot = dict(translation) if isinstance(translation, dict) else {}
        items = [dict(item) for item in snapshot.get("items") or [] if isinstance(item, dict)]
        matching = [
            item for item in items
            if str(item.get("task_id") or "") == task_id
        ]
        if not matching:
            return snapshot
        row = matching[0]
        row["priority"] = priority
        row["recently_bumped"] = True
        snapshot["items"] = [
            row,
            *[item for item in items if str(item.get("task_id") or "") != task_id],
        ][:QUEUE_CENTER_HEAD_LIMIT]
        return snapshot

    @staticmethod
    def _reprioritize_translation_row(
        translation: Any,
        task_id: str,
        priority: int,
    ) -> Dict[str, Any]:
        snapshot = dict(translation) if isinstance(translation, dict) else {}
        items = [dict(item) for item in snapshot.get("items") or [] if isinstance(item, dict)]
        for item in items:
            if str(item.get("task_id") or "") != task_id:
                continue
            item["priority"] = priority
            item["recently_bumped"] = False
            break
        items.sort(key=lambda item: int(item.get("priority") or 0), reverse=True)
        snapshot["items"] = items[:QUEUE_CENTER_HEAD_LIMIT]
        return snapshot

    @staticmethod
    def _promote_sentence_row(
        sentence_queue: Any,
        payload: Dict[str, Any],
    ) -> Dict[str, Any]:
        snapshot = dict(sentence_queue) if isinstance(sentence_queue, dict) else {"success": True}
        queue = dict(snapshot.get("queue") or {})
        items = [dict(item) for item in queue.get("items") or [] if isinstance(item, dict)]
        task_id = str(payload.get("task_id") or "")
        content_id = str(payload.get("content_id") or "")
        language = str(payload.get("language") or "")
        matching = [
            item for item in items
            if str(item.get("task_id") or "") == task_id
            or (
                content_id
                and str(item.get("content_id") or "") == content_id
                and str(item.get("language") or "") == language
            )
        ]
        row = matching[0] if matching else {
            "task_id": task_id,
            "content_id": content_id,
            "language": language,
            "text": payload.get("text"),
            "tts_status": "pending",
        }
        row["tts_priority"] = int(payload.get("priority") or 0)
        row["recently_bumped"] = True
        queue["items"] = [row, *[item for item in items if item is not row]][:QUEUE_CENTER_HEAD_LIMIT]
        snapshot["queue"] = queue
        return snapshot

    @staticmethod
    def _apply_snapshot_age(snapshot: Dict[str, Any]) -> Dict[str, Any]:
        cache = snapshot.get("cache") if isinstance(snapshot.get("cache"), dict) else {}
        last_remote = float(cache.get("last_remote_refresh_at") or 0)
        age = max(0.0, time.time() - last_remote) if last_remote > 0 else None
        snapshot["laravelSnapshotAgeS"] = age
        overview = snapshot.get("overview")
        if isinstance(overview, dict):
            overview = dict(overview)
            overview["age_s"] = age
            overview["laravel_snapshot_age_s"] = age
            overview["stale"] = not bool(snapshot.get("laravelReachable"))
            overview["degraded"] = not bool(snapshot.get("laravelReachable"))
            snapshot["overview"] = overview
        sentence_queue = snapshot.get("sentenceQueue")
        if isinstance(sentence_queue, dict) and isinstance(sentence_queue.get("queue"), dict):
            sentence_queue = dict(sentence_queue)
            queue = dict(sentence_queue["queue"])
            queue["snapshot_age_s"] = age
            queue["laravel_reachable"] = bool(snapshot.get("laravelReachable"))
            sentence_queue["queue"] = queue
            snapshot["sentenceQueue"] = sentence_queue
        translation = snapshot.get("translation")
        if isinstance(translation, dict):
            translation = dict(translation)
            translation["age_ms"] = int(age * 1000) if age is not None else 0
            translation["laravel_reachable"] = bool(snapshot.get("laravelReachable"))
            snapshot["translation"] = translation
        return snapshot

    @staticmethod
    def _publish_changed(reason: str, snapshot: Dict[str, Any]) -> None:
        cache = snapshot.get("cache") if isinstance(snapshot.get("cache"), dict) else {}
        http_event_delivery_service.publish_topic(
            QUEUE_CENTER_SNAPSHOT_TOPIC,
            {
                "reason": reason,
                "revision": int(cache.get("revision") or 0),
                "generated_at": snapshot.get("generatedAt"),
            },
        )

    @staticmethod
    def _empty_snapshot() -> Dict[str, Any]:
        return {
            "generatedAt": _utc_now(),
            "pycoreReachable": True,
            "laravelReachable": False,
            "laravelActiveEndpoint": None,
            "overview": None,
            "queueOverview": None,
            "translation": None,
            "sentenceQueue": None,
            "wordAudio": None,
            "sentenceAudio": None,
            "assist": None,
            "tts": None,
            "recent": None,
            "workerApiUrl": None,
            "sectionContracts": {},
            "errors": {},
            "cache": {
                "warm": False,
                "revision": 0,
                "stream_cursor": 0,
                "realtime_connected": False,
                "event_count": 0,
                "source": "pycore",
            },
        }


queue_center_snapshot_service = QueueCenterSnapshotService()


__all__ = [
    "QUEUE_CENTER_SNAPSHOT_TOPIC",
    "QueueCenterSnapshotService",
    "queue_center_snapshot_service",
]
