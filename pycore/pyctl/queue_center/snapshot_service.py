# -*- coding: utf-8 -*-
"""Pycore-owned Queue Center snapshot and Laravel Mercure exchange."""

from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import (
    init_serialized_owner,
    serialized_method,
)
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS
from pycore.pyheartbeat import heartbeat_system as shared_heartbeat_system
from pycore.pyctl.assist.service import assist_status
from pycore.pyctl.assist.wiring import resolve_selected_endpoint_for_ui
from pycore.pyctl.queue_center.control_service import get_control_intent
from pycore.pyctl.queue_center.lane_registry import LANE_REGISTRY, lane_worker
from pycore.pyctl.queue_center.task_center_sections import (
    build_section_contracts,
    queue_metrics,
)
from pycore.pyctl.tts.status_service import peek_status as peek_tts_status
from pycore.pyctl.tts.sentence_audio_auto import get_status as get_sentence_audio_status
from pycore.pyctl.tts.word_tts_auto import get_status as get_word_audio_status
from pycore.pyctl.translation.worker.worker import translation_worker_service
from pycore.pyutils.common.bounded_priority_rows import BoundedPriorityRows
from pycore.pyutils.common.queue_bump_hub import queue_bump_hub
from pycore.pyutils.common.mercure_client import (
    MERCURE_STATE_CONNECTING,
    MERCURE_STATE_OFFLINE,
    MERCURE_STATE_ONLINE,
    MercureSubscriber,
    MercureUpdate,
)
from pycore.pyutils.common.queue_center_contract import (
    GLOBAL_TASK_LIMITS,
    QUEUE_CENTER_DIFF_DELIVERY,
    QUEUE_CENTER_QUEUE_POSITION_CONTROLS,
    QUEUE_CENTER_REALTIME_EVENTS,
    queue_center_endpoint,
)
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_QUEUE_CENTER_KEY,
    status_snapshot_cache,
)
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.rpc_v2.delivery import http_event_delivery_service


QUEUE_CENTER_SNAPSHOT_TOPIC = "queue_center.snapshot.changed"
QUEUE_CENTER_EVENTS_PATH = queue_center_endpoint("queue_center_events")
QUEUE_CENTER_PRIORITY_EVENTS = {
    QUEUE_CENTER_REALTIME_EVENTS["task_priority"]: "word_translation",
    QUEUE_CENTER_REALTIME_EVENTS["word_image_priority"]: "word_media",
    QUEUE_CENTER_REALTIME_EVENTS["cover_priority"]: "cover",
    QUEUE_CENTER_REALTIME_EVENTS["poster_priority"]: "poster",
}
QUEUE_CENTER_HEAD_EVENTS = {
    QUEUE_CENTER_REALTIME_EVENTS["word_audio_head"]: "word_audio",
    QUEUE_CENTER_REALTIME_EVENTS["sentence_audio_head"]: "sentence_audio",
}
QUEUE_CENTER_HEAD_LIMIT = 100
QUEUE_CENTER_EVENT_ITEM_LIMIT = int(QUEUE_CENTER_DIFF_DELIVERY["data_segment_limit"])
QUEUE_CENTER_REMOTE_TIMEOUT_SECONDS = 8
# Shared-health gate for the realtime lane: reuse a fresh endpoint probe within
# this window, and idle this long between health re-probes while Laravel is down.
QUEUE_CENTER_ENDPOINT_HEALTH_TTL_SECONDS = 10.0
QUEUE_CENTER_ENDPOINT_IDLE_SECONDS = 10.0
QUEUE_CENTER_RECONNECT_MIN_SECONDS = 1.0
QUEUE_CENTER_RECONNECT_MAX_SECONDS = 15.0
# Hub heartbeat defaults to 40s; a read window well above it keeps healthy
# streams alive while a silent death still reconnects promptly.
QUEUE_CENTER_SSE_READ_TIMEOUT_SECONDS = 90.0
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


class _QueueCenterTokenProvider:
    """Own the Queue Center topic token independently from machine relay."""

    def __init__(
        self,
        service: "_QueueCenterSnapshotService",
        endpoint: str,
        connection: Dict[str, Any],
    ) -> None:
        self._service = service
        self._endpoint = endpoint
        self._token = str(connection.get("token") or "")

    def __call__(self, force_refresh: bool = False) -> str:
        connection: Dict[str, Any] = {}

        if force_refresh or not self._token:
            connection = self._service.realtime_connection(self._endpoint)
            self._token = str(connection.get("token") or "")
        if not self._token:
            raise RuntimeError("Laravel Queue Center subscriber token is unavailable")
        return self._token


class _QueueCenterRealtimeThread(threading.Thread):
    """Consume Queue Center Mercure updates without occupying a Laravel worker.

    The shared ``MercureSubscriber`` owns reconnects, Last-Event-ID resume
    and authorized cursor recovery; this thread only gates on endpoint health, re-derives
    the server-issued hub connection per start, and reconciles missed rows
    over the events endpoint around every reconnect.
    """

    def __init__(self, service: "_QueueCenterSnapshotService") -> None:
        super().__init__(name="QueueCenterRealtimeThread", daemon=True)
        self._service = service
        self._last_error = ""

    def stop(self) -> None:
        THREAD_BUS.signal(QUEUE_CENTER_STOP_SIGNAL, True)

    def run(self) -> None:
        while not THREAD_BUS.is_shutdown_requested() and not THREAD_BUS.get_signal(
            QUEUE_CENTER_STOP_SIGNAL,
            False,
        ):
            endpoint = self._service.realtime_endpoint()
            if not endpoint:
                # Every Laravel candidate is down: idle on the shared health
                # record instead of burning HTTP timeouts per reconnect.
                self._note_failure("Laravel endpoint unreachable - realtime paused")
                self._pause(QUEUE_CENTER_ENDPOINT_IDLE_SECONDS)
                continue
            try:
                connection = self._service.realtime_connection(endpoint)
                self._service.replay_realtime_events(endpoint)
                subscriber = MercureSubscriber(
                    str(connection["hub_url"]),
                    [str(topic) for topic in (connection.get("topics") or [])],
                    token_provider=_QueueCenterTokenProvider(
                        self._service,
                        endpoint,
                        connection,
                    ),
                    on_update=self._dispatch_update,
                    on_state_change=lambda state, detail: self._on_hub_state(
                        endpoint, state, detail
                    ),
                    reconnect_min_seconds=QUEUE_CENTER_RECONNECT_MIN_SECONDS,
                    reconnect_max_seconds=QUEUE_CENTER_RECONNECT_MAX_SECONDS,
                    read_timeout=QUEUE_CENTER_SSE_READ_TIMEOUT_SECONDS,
                )
                subscriber.run(self._should_exit_stream)
            except Exception as exc:  # noqa: BLE001 - loop must survive
                self._note_failure(str(exc))
                self._pause(QUEUE_CENTER_RECONNECT_MIN_SECONDS)
            if self._should_exit_stream():
                return

    def _should_exit_stream(self) -> bool:
        """Stop the whole thread on bus shutdown; only the stream on drift."""
        if THREAD_BUS.is_shutdown_requested() or THREAD_BUS.get_signal(
            QUEUE_CENTER_STOP_SIGNAL,
            False,
        ):
            return True
        # An endpoint switch invalidates the live stream (hub URL, topics);
        # the outer loop re-derives and re-subscribes against the new winner.
        return not self._service.realtime_endpoint()

    def _on_hub_state(self, endpoint: str, state: str, detail: str) -> None:
        if state == MERCURE_STATE_ONLINE:
            self._note_recovery(endpoint)
            self._service.note_realtime_connected(endpoint, detail)
            self._service.replay_realtime_events(endpoint)
        elif state == MERCURE_STATE_OFFLINE:
            self._service.note_realtime_disconnected(detail)
            self._note_failure(detail)
        elif state == MERCURE_STATE_CONNECTING and self._last_error:
            self._last_error = ""

    def _dispatch_update(self, update: MercureUpdate) -> None:
        payload = update.json() if update.data else {}
        if not isinstance(payload, dict):
            return
        row = payload.get("data") if isinstance(payload.get("data"), dict) else {}
        event_name = str(update.type or payload.get("event") or "")
        cursor = int(row.get("_id") or 0)
        if event_name == QUEUE_CENTER_REALTIME_EVENTS["worker_presence"]:
            self._service.advance_stream_cursor(cursor)
            return
        if event_name == QUEUE_CENTER_REALTIME_EVENTS["queue_changed"]:
            self._service.advance_stream_cursor(cursor)
            self._service.wake_workers()
            return
        if event_name in QUEUE_CENTER_HEAD_EVENTS:
            self._service.apply_head_event(event_name, row, cursor)
            return
        if event_name in QUEUE_CENTER_PRIORITY_EVENTS:
            self._service.apply_priority_event(event_name, row, cursor)

    def _note_failure(self, message: str) -> None:
        """Record one realtime failure; log only NEW error states (no spam)."""
        if message != self._last_error:
            self._last_error = message
            ColorPrint.yellow(f"[QueueCenterCache] realtime reconnect: {message}")

    def _note_recovery(self, endpoint: str) -> None:
        """Clear the logged failure once a fresh stream is established."""
        if self._last_error:
            self._last_error = ""
            ColorPrint.green(f"[QueueCenterCache] realtime reconnected to {endpoint}")

    @staticmethod
    def _pause(seconds: float) -> None:
        THREAD_BUS.wait_signal(QUEUE_CENTER_STOP_SIGNAL, timeout=seconds)



class _QueueCenterSnapshotService:
    """Own one bounded Queue Center snapshot for every UI client."""

    def __init__(self) -> None:
        self._thread: Optional[_QueueCenterRealtimeThread] = None
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
    def start(self) -> None:
        if self._thread is not None and self._thread.is_alive():
            return
        THREAD_BUS.clear_signal(QUEUE_CENTER_STOP_SIGNAL)
        self._thread = _QueueCenterRealtimeThread(self)
        self._thread.start()
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

    def realtime_endpoint(self) -> str:
        """Health-aware realtime target; '' while every candidate is down.

        Reuses the endpoint manager's shared probe record when fresh, else
        runs its stored-first resolve (single-flight, negative-TTL paced), so a
        healthy local Laravel failover wins automatically. The realtime lane
        follows the same health truth as the workers instead of blind-retrying
        the stored URL.
        """
        stored = self.endpoint()
        if not stored:
            return ""
        last = laravel_endpoint_manager.last_probe_result(stored)
        checked_ms = int(last.get("last_checked") or 0)
        age_s = max(0.0, time.time() - checked_ms / 1000.0) if checked_ms else None
        if age_s is not None and age_s <= QUEUE_CENTER_ENDPOINT_HEALTH_TTL_SECONDS:
            return stored if last.get("healthy") else ""
        resolved = laravel_endpoint_manager.resolve()
        if resolved and resolved != stored:
            return resolved
        refreshed = laravel_endpoint_manager.last_probe_result(stored)
        return stored if refreshed.get("healthy") else ""

    def realtime_connection(self, endpoint: Optional[str] = None) -> Dict[str, Any]:
        base = str(endpoint or self.endpoint()).rstrip("/")
        if not base:
            raise RuntimeError("Laravel endpoint is unavailable")
        response = laravel_client.get(
            queue_center_endpoint("queue_center_overview"),
            base_url=base,
            timeout=QUEUE_CENTER_REMOTE_TIMEOUT_SECONDS,
        )
        overview = _response_data(response)
        connection = overview.get("realtime")
        if not isinstance(connection, dict):
            raise RuntimeError("Laravel Queue Center realtime configuration is unavailable")
        return dict(connection)

    def replay_realtime_events(self, endpoint: str) -> None:
        cursor = self.stream_cursor()
        has_more = True
        while has_more:
            response = laravel_client.get(
                QUEUE_CENTER_EVENTS_PATH,
                base_url=endpoint,
                params={
                    "cursor": cursor,
                    "limit": GLOBAL_TASK_LIMITS["event_batch"],
                },
                timeout=QUEUE_CENTER_REMOTE_TIMEOUT_SECONDS,
            )
            replay = _response_data(response)
            events = (
                replay.get("events")
                if isinstance(replay.get("events"), list)
                else []
            )
            for row in events:
                if not isinstance(row, dict):
                    continue
                event_name = str(row.get("event") or "")
                payload = row.get("data") if isinstance(row.get("data"), dict) else {}
                event_cursor = int(row.get("id") or payload.get("_id") or 0)
                if event_name in QUEUE_CENTER_HEAD_EVENTS:
                    self.apply_head_event(event_name, payload, event_cursor)
                elif event_name in QUEUE_CENTER_PRIORITY_EVENTS:
                    self.apply_priority_event(event_name, payload, event_cursor)
                elif event_name == QUEUE_CENTER_REALTIME_EVENTS["worker_presence"]:
                    self.advance_stream_cursor(event_cursor)
                elif event_name == QUEUE_CENTER_REALTIME_EVENTS["queue_changed"]:
                    self.advance_stream_cursor(event_cursor)
                    self.wake_workers()
            next_cursor = int(replay.get("cursor") or 0)
            has_more = bool(replay.get("has_more"))
            if has_more and next_cursor <= cursor:
                raise RuntimeError("Laravel Queue Center replay cursor did not advance")
            cursor = max(cursor, next_cursor)
            self.advance_stream_cursor(cursor)

    @staticmethod
    def wake_workers() -> None:
        for control in LANE_REGISTRY:
            entry = LANE_REGISTRY[control]
            if not shared_heartbeat_system.is_callback_enabled(
                entry["heartbeat_callback"]
            ):
                continue
            worker = lane_worker(control)
            if worker is not None:
                worker.request_pull()

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
        # pycore never mirrors Laravel-owned queue rows into this snapshot.
        # The browser reads Laravel directly; the shared Mercure stream
        # wakes local workers without retaining an HTTP request.
        snapshot = status_snapshot_cache.peek(STATUS_SNAPSHOT_QUEUE_CENTER_KEY)
        return self._with_local_state(snapshot or self._empty_snapshot())

    def request_refresh(self) -> None:
        # Remote Laravel mirroring is retired. The browser reads Laravel-owned
        # queue data directly; pycore only serves its own worker state from this
        # snapshot. Keeping this method as a no-op prevents accidental Laravel
        # polling from legacy callers.
        pass

    def note_realtime_connected(self, endpoint: str, detail: str = "") -> None:
        def updater(snapshot: Dict[str, Any]) -> Dict[str, Any]:
            snapshot["laravelReachable"] = True
            snapshot["laravelActiveEndpoint"] = endpoint
            cache = dict(snapshot.get("cache") or {})
            cache["realtime_connected"] = True
            cache["realtime_detail"] = str(detail or "")[:500]
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
        bump_action = str(payload.get("bump") or "bumped")
        move_to_head = bump_action in ("bumped", "head", "queue")
        old_priority = payload.get("old_priority")
        old_priority = int(old_priority) if isinstance(old_priority, (int, float)) else None
        label = self._priority_label(payload, task_id, queue)
        batch_items = payload.get("items")
        if not task_id and isinstance(batch_items, list):
            for batch_item in batch_items[:QUEUE_CENTER_EVENT_ITEM_LIMIT]:
                if not isinstance(batch_item, dict):
                    continue
                batch_task_id = str(batch_item.get("task_id") or "").strip()
                if not batch_task_id:
                    continue
                batch_priority = int(batch_item.get("priority") or priority)
                self._set_worker_priority(
                    queue,
                    batch_task_id,
                    batch_priority,
                    move_to_head,
                )
        if task_id:
            self._set_worker_priority(queue, task_id, priority, move_to_head)
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
            if queue == "word_translation" and task_id:
                snapshot["translation"] = self._update_translation_row(
                    snapshot.get("translation"),
                    task_id,
                    priority,
                    move_to_head,
                )
            return snapshot

        snapshot = status_snapshot_cache.update(
            STATUS_SNAPSHOT_QUEUE_CENTER_KEY,
            updater,
        )
        self._publish_changed(event_name, snapshot)

    def apply_head_event(
        self,
        event_name: str,
        payload: Dict[str, Any],
        cursor: int,
    ) -> None:
        if cursor > 0 and cursor <= self.stream_cursor():
            return
        queue = QUEUE_CENTER_HEAD_EVENTS[event_name]
        raw_items = payload.get("items")
        items = (
            [dict(item) for item in raw_items if isinstance(item, dict)]
            if isinstance(raw_items, list)
            else [dict(payload)]
        )
        items = items[:QUEUE_CENTER_EVENT_ITEM_LIMIT]
        applied: list[Dict[str, Any]] = []
        for item in items:
            task_id = str(item.get("task_id") or "").strip()
            if not task_id:
                continue
            queue_position = int(item.get("queue_position") or 0)
            worker = lane_worker(
                "sentence_audio" if queue == "sentence_audio" else "word_audio"
            )
            if worker is None:
                continue
            worker.set_cached_task_head(task_id, queue_position)
            applied.append({
                **item,
                "task_id": task_id,
                "queue_position": queue_position,
            })
        if applied:
            worker.request_pull(prefer_remote=True)

        def updater(snapshot: Dict[str, Any]) -> Dict[str, Any]:
            cache = dict(snapshot.get("cache") or {})
            cache["warm"] = bool(cache.get("warm"))
            cache["revision"] = int(cache.get("revision") or 0) + 1
            cache["stream_cursor"] = max(int(cache.get("stream_cursor") or 0), cursor)
            cache["realtime_connected"] = True
            cache["event_count"] = int(cache.get("event_count") or 0) + 1
            heads = dict(cache.get("queue_heads") or {})
            current = list(heads.get(queue) or [])
            applied_ids = {item["task_id"] for item in applied}
            current = [
                item for item in current
                if str(item.get("task_id") or "") not in applied_ids
            ]
            received_at = time.time()
            event_items = [{
                "task_id": item["task_id"],
                "label": self._priority_label(item, item["task_id"], queue),
                "language": item.get("language"),
                "queue_position": item["queue_position"],
                "cursor": cursor,
                "received_at": received_at,
                "payload": item,
            } for item in applied]
            heads[queue] = [*event_items, *current][:QUEUE_CENTER_HEAD_LIMIT]
            cache["queue_heads"] = heads
            snapshot["cache"] = cache
            snapshot["generatedAt"] = _utc_now()
            snapshot["laravelReachable"] = True
            return snapshot

        snapshot = status_snapshot_cache.update(
            STATUS_SNAPSHOT_QUEUE_CENTER_KEY,
            updater,
        )
        self._publish_changed(event_name, snapshot)

    @staticmethod
    def _set_worker_priority(
        queue: str,
        task_id: str,
        priority: int,
        move_to_head: bool,
    ) -> None:
        worker = translation_worker_service
        worker.set_cached_task_priority(task_id, priority, move_to_head)
        worker.request_pull()

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
        thread = self._thread
        if thread is not None:
            thread.request_reconnect()

    def _with_local_state(self, snapshot: Dict[str, Any]) -> Dict[str, Any]:
        result = dict(snapshot)
        word_audio = get_word_audio_status()
        sentence_audio = get_sentence_audio_status()
        assist = assist_status(include_laravel=False)
        tts = peek_tts_status()
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
        )
        queue_overview = snapshot.get("queueOverview") if isinstance(snapshot.get("queueOverview"), dict) else {}
        for scope in QUEUE_CENTER_QUEUE_POSITION_CONTROLS:
            metrics = queue_metrics(queue_overview, scope)
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
    def _update_translation_row(
        translation: Any,
        task_id: str,
        priority: int,
        move_to_head: bool,
    ) -> Dict[str, Any]:
        snapshot = dict(translation) if isinstance(translation, dict) else {}
        snapshot["items"] = BoundedPriorityRows.update(
            snapshot.get("items"),
            [{"task_id": task_id}],
            "priority",
            priority,
            QUEUE_CENTER_HEAD_LIMIT,
            move_to_head,
        )
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


queue_center_snapshot_service = _QueueCenterSnapshotService()


__all__ = [
    "QUEUE_CENTER_SNAPSHOT_TOPIC",
    "queue_center_snapshot_service",
]
