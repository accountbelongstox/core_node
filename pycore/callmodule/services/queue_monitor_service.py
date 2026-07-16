# -*- coding: utf-8 -*-
"""
Translation Queue Monitor Service

A pycore monitor + control proxy for Laravel's translation QUEUE. It lets the
pycore UI VIEW and STEER the queue and, critically, perceive qyApp-driven
priority changes in real time.

------------------------------------------------------------------------------
Shared contract (pycore UI <-> this monitor <-> Laravel queue API)
------------------------------------------------------------------------------
Laravel exposes (server-side reachable, mirroring /api/worker/*; no user token):
  GET  {base}/api/app_qy_v1/ai_tools/translation/queue/list?status=pending&limit=100
       -> { summary:{pending,processing,completed,failed,total},
            items:[ { task_id, words, word_count, language, target_language,
                      priority, status, created_at, age_seconds, assigned_to } ] }
  POST {base}/api/app_qy_v1/ai_tools/translation/queue/priority { task_id, priority }
  POST {base}/api/app_qy_v1/ai_tools/translation/queue/stack
       { words, language, target_language, priority? }

`{base}` is the SAME Laravel backend the UI selects via LaravelEndpointManager
(user_data.json ``laravel_api.current`` / stored-first resolve). The monitor
reads that resolver live on every request so tray/UI endpoint switches apply
without restart.

------------------------------------------------------------------------------
Architecture (mirrors translation_worker_service.py / tts_queue_poller_service.py)
------------------------------------------------------------------------------
  - Singleton service registered as a PyHeartbeat callback (interval ~5s, ENABLED
    by default). Toggle at runtime via the heartbeat management router:
      POST /api/heartbeat/enable/translation_queue_monitor
      POST /api/heartbeat/disable/translation_queue_monitor
  - poll_once() is LIGHT and EXCEPTION-SAFE: it GETs the queue list, caches the
    latest snapshot, and diffs priorities against the previous snapshot to detect
    PRIORITY BUMPS. It never raises into the heartbeat thread.
  - Priority-bump detection: a task whose priority INCREASED vs the previous
    snapshot is flagged `recently_bumped` for a short TTL (~30s) and a concise
    ColorPrint line is emitted ("queue: task X priority 0->100"). This is the
    HTTP-polling form of "pycore perceives qyApp-driven priority changes in real
    time". Phase C ADDS a WebSocket push path: TranslationWsClient
    (translation_ws_client_service.py) subscribes to Laravel's Reverb broadcasts and
    calls apply_task_queued / apply_task_priority / apply_task_completed on this
    monitor, updating the cached snapshot INSTANTLY (no 5s wait). The HTTP poll is
    retained as the slower fallback/reconciler if the WS drops.
  - Quiet when Laravel is unreachable: one concise notice, then silence until it
    recovers (same style as the worker).

Logging: ColorPrint only (pycore rule). Networking: third-party `requests` via
get_third_package_requests() (never a bare import). This module imports only
pyfoundations + the sibling worker service (same layer) — never rpc_v2 / routers.
"""

import threading
import time
from typing import Any, Dict, List, Optional

# ColorPrint is the only allowed logger in pycore processors/services.
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
# requests is a third-party dep — always obtained through the lazy accessor.
from pycore.pyfoundations.third_party import get_third_package_requests
# Reuse the shared Laravel endpoint resolver (same as the UI laravel_api.* RPCs).
from pycore.callmodule.services.sync.laravel_endpoint_manager import (
    get_laravel_endpoint_manager,
    resolve_laravel_base_url,
)
from pycore.callmodule.services.queue_bump_hub import get_queue_bump_hub


# Laravel queue-API path prefix (server-side, mirrors /api/worker/*).
_QUEUE_API_PREFIX = "/api/app_qy_v1/ai_tools/translation/queue"


class QueueMonitorService:
    """
    Translation queue monitor (singleton).

    Caches the latest queue snapshot from Laravel and flags tasks whose priority
    was just bumped (qyApp-driven) so the UI can highlight them in real time. Also
    backs the control proxy (priority / stack) routes — those reuse this service's
    shared base URL + the same `requests` helper.
    """

    _instance: Optional["QueueMonitorService"] = None
    _instance_lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        """Singleton — one monitor per process."""
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, laravel_api_url: str = "http://127.0.0.1:9000", bump_ttl_seconds: int = 30):
        """
        Initialize the monitor (idempotent — safe to call repeatedly).

        Args:
            laravel_api_url: Laravel base URL (no trailing slash). Passed straight
                through to the shared worker so both agree on the backend.
            bump_ttl_seconds: how long a task stays flagged `recently_bumped`.
        """
        if getattr(self, "_initialized", False):
            return

        # Laravel base URL comes from LaravelEndpointManager (UI-selected).
        self._bump_ttl = max(1, int(bump_ttl_seconds))
        self._http_timeout = 6  # seconds for list/priority/stack calls

        # Cached snapshot state (protected by _lock).
        self._lock = threading.Lock()
        self._snapshot: Dict[str, Any] = {"summary": {}, "items": []}
        self._snapshot_ts = 0.0          # monotonic time of the last successful poll
        self._laravel_reachable = False
        # task_id -> last seen priority (for bump diffing across snapshots).
        self._prev_priority: Dict[Any, float] = {}
        # task_id -> monotonic expiry time of its `recently_bumped` flag.
        self._bumped_until: Dict[Any, float] = {}

        # One-shot "unreachable" notice bookkeeping (quiet after the first hint).
        self._unreachable_warned = False

        # ---- Phase C WS push state ----
        # Live WebSocket connection status (set by TranslationWsClient). Surfaced
        # additively in the snapshot as `ws_connected` so the UI can show whether
        # real-time updates are flowing (vs falling back to the 5s HTTP poll).
        self._ws_connected = False

        self._initialized = True
        ColorPrint.green(
            f"[QueueMonitor] Service initialized "
            f"(base={self._base_url()}, bump_ttl={self._bump_ttl}s)"
        )

    # -------------------- base URL / HTTP helpers --------------------

    def _base_url(self) -> str:
        """Active Laravel base URL (cached winner — no blocking resolve on request path)."""
        return get_laravel_endpoint_manager().get_active_base_url().rstrip("/")

    def _poll_base_url(self) -> str:
        """Full resolve for heartbeat poll only (may sweep when all endpoints are down)."""
        return resolve_laravel_base_url().rstrip("/")

    @staticmethod
    def _short_err(exc: Exception) -> str:
        """Condense a noisy requests exception into a one-line reason."""
        name = type(exc).__name__
        text = str(exc)
        low = text.lower()
        if "actively refused" in low or "refused" in low or "ConnectionRefused" in name:
            return "connection refused (Laravel not listening)"
        if "timed out" in low or "timeout" in low.replace("connecttimeout", ""):
            return "timed out"
        if "max retries" in low or "newconnectionerror" in low or "failed to establish" in low:
            return "host unreachable"
        if "name or service not known" in low or "getaddrinfo" in low:
            return "host not resolvable"
        return text.splitlines()[0][:120] if text else name

    def _requests(self):
        """Lazily obtain the third-party requests module (pycore rule)."""
        return get_third_package_requests()

    # -------------------- bump detection --------------------

    @staticmethod
    def _as_float(value: Any, default: float = 0.0) -> float:
        """Coerce a possibly-missing/string priority to float for comparison."""
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    def _apply_bump_detection(self, items: List[Dict[str, Any]]) -> None:
        """
        Diff each task's priority vs the previous snapshot. A task whose priority
        INCREASED is flagged `recently_bumped` for `_bump_ttl` seconds and logged
        once. Must be called under `self._lock`.
        """
        now = time.monotonic()
        new_prev: Dict[Any, float] = {}

        for item in items:
            task_id = item.get("task_id")
            priority = self._as_float(item.get("priority"))
            new_prev[task_id] = priority

            prior = self._prev_priority.get(task_id)
            if prior is not None and priority > prior:
                # qyApp (or anyone) bumped this task — flag + announce once.
                self._bumped_until[task_id] = now + self._bump_ttl
                words = item.get("words") or []
                label = ", ".join(words[:2]) if words else str(task_id)
                get_queue_bump_hub().record(
                    lane="translation",
                    item_id=str(task_id),
                    label=label,
                    old_priority=prior,
                    new_priority=priority,
                    meta={
                        "language": item.get("language"),
                        "target_language": item.get("target_language"),
                        "word_count": item.get("word_count"),
                    },
                )
                ColorPrint.blue(
                    f"[QueueMonitor] queue: task {task_id} priority "
                    f"{int(prior) if prior.is_integer() else prior}->"
                    f"{int(priority) if priority.is_integer() else priority}"
                )

        # Replace the baseline with the current snapshot's priorities.
        self._prev_priority = new_prev
        # Drop expired bump flags (and any flag for a task no longer in the queue).
        self._bumped_until = {
            tid: exp
            for tid, exp in self._bumped_until.items()
            if exp > now and tid in new_prev
        }

    def _decorate_items(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Return a shallow copy of items with the `recently_bumped` bool added."""
        now = time.monotonic()
        out: List[Dict[str, Any]] = []
        for item in items:
            decorated = dict(item)
            exp = self._bumped_until.get(item.get("task_id"))
            decorated["recently_bumped"] = bool(exp and exp > now)
            out.append(decorated)
        return out

    # -------------------- polling --------------------

    def _fetch_list(self, status: str = "pending", limit: int = 100) -> Optional[Dict[str, Any]]:
        """
        GET the queue list from Laravel. Returns the parsed body
        ({ summary, items }) on success, or None on any error/non-200.

        Accepts both a bare { summary, items } shape and a wrapped
        { success, data:{ summary, items } } shape (mirrors the worker's pull,
        which accepts both wrapped and bare payloads).
        """
        base = self._base_url()
        return self._fetch_list_at(base, status=status, limit=limit)

    def _fetch_list_at(
        self,
        base: str,
        status: str = "pending",
        limit: int = 100,
    ) -> Optional[Dict[str, Any]]:
        try:
            requests = self._requests()
            resp = requests.get(
                f"{base}{_QUEUE_API_PREFIX}/list",
                params={"status": status, "limit": limit},
                timeout=self._http_timeout,
            )
            if resp.status_code == 200:
                data = resp.json() or {}
                body = data.get("data") if isinstance(data.get("data"), dict) else data
                return body or {}
            if not self._unreachable_warned:
                self._unreachable_warned = True
                ColorPrint.yellow(
                    f"[QueueMonitor] queue/list at {base} returned HTTP {resp.status_code} "
                    "(queue API not available yet?); staying quiet until it recovers."
                )
            return None
        except Exception as e:
            if not self._unreachable_warned:
                self._unreachable_warned = True
                ColorPrint.yellow(
                    f"[QueueMonitor] No reachable Laravel queue API at {base} "
                    f"({self._short_err(e)}); will keep polling quietly."
                )
            return None

    def poll_once(self) -> None:
        """
        PyHeartbeat callback (invoked every ~interval seconds WHEN ENABLED).

        Light + exception-safe: GET the queue list, cache the snapshot, run
        bump-detection. NEVER raises into the heartbeat loop.
        """
        try:
            body = self._fetch_list_at(self._poll_base_url())
            if body is None:
                with self._lock:
                    self._laravel_reachable = False
                return

            summary = body.get("summary") or {}
            items = body.get("items") or []

            with self._lock:
                self._apply_bump_detection(items)
                self._snapshot = {"summary": summary, "items": items}
                self._snapshot_ts = time.monotonic()
                if not self._laravel_reachable and self._unreachable_warned:
                    # Recovered after a prior notice — say so once, then reset.
                    ColorPrint.green(f"[QueueMonitor] Reconnected to Laravel queue API at {self._base_url()}")
                self._laravel_reachable = True
                self._unreachable_warned = False
        except Exception as e:
            # Never propagate into the heartbeat thread.
            ColorPrint.red(f"[QueueMonitor] poll_once error: {e}")

    # -------------------- WS real-time push (Phase C) --------------------
    #
    # TranslationWsClient calls these from its background thread when Reverb
    # broadcasts arrive, so the cached snapshot reflects changes INSTANTLY instead
    # of waiting for the next 5s HTTP poll. The HTTP poll remains the safety-net
    # reconciler: if the WS drops, poll_once() re-syncs the full list. All updates
    # are best-effort and reuse the same `_lock` + bump-detection logic.

    def set_ws_connected(self, connected: bool) -> None:
        """Record live WS connection status (surfaced as snapshot.ws_connected)."""
        with self._lock:
            self._ws_connected = bool(connected)

    def _find_item(self, items: List[Dict[str, Any]], task_id: Any) -> Optional[Dict[str, Any]]:
        """Locate an item by task_id (string-compared, since ids may be int/str)."""
        sid = str(task_id)
        for it in items:
            if str(it.get("task_id")) == sid:
                return it
        return None

    def apply_task_queued(self, data: Dict[str, Any]) -> None:
        """
        Handle a Reverb `task.queued` event: insert/update the task in the cached
        snapshot so the UI sees it without waiting for the poll. Reuses the same
        item shape the HTTP list returns (best-effort fields from the broadcast).
        """
        task_id = data.get("task_id")
        if task_id is None:
            return
        words = data.get("words") or []
        with self._lock:
            items = self._snapshot.get("items") or []
            existing = self._find_item(items, task_id)
            new_item = {
                "task_id": task_id,
                "words": words,
                "word_count": data.get("word_count") or len(words),
                "language": data.get("language"),
                "target_language": data.get("target_language"),
                "priority": data.get("priority", 0),
                "status": "pending",
            }
            if existing:
                existing.update({k: v for k, v in new_item.items() if v is not None})
            else:
                items.append(new_item)
            self._snapshot["items"] = items
            self._snapshot_ts = time.monotonic()
            # Run bump-detection so a higher-priority (re)queue is flagged too.
            self._apply_bump_detection(items)
        ColorPrint.blue(f"[QueueMonitor] WS task.queued -> task {task_id} ({len(words)} word(s))")

    def apply_task_priority(self, data: Dict[str, Any]) -> None:
        """
        Handle a Reverb `task.priority` event: update the task's priority in the
        snapshot and flag it `recently_bumped` (reusing bump-detection) if it rose.
        """
        task_id = data.get("task_id")
        if task_id is None or "priority" not in data:
            return
        new_priority = self._as_float(data.get("priority"))
        with self._lock:
            items = self._snapshot.get("items") or []
            existing = self._find_item(items, task_id)
            if existing is not None:
                existing["priority"] = data.get("priority")
            else:
                items.append({"task_id": task_id, "priority": data.get("priority"), "status": "pending"})
            self._snapshot["items"] = items
            self._snapshot_ts = time.monotonic()
            # Bump-detection compares against the previous priority and flags + logs
            # an increase as `recently_bumped` (same logic the HTTP poll uses).
            self._apply_bump_detection(items)

    def apply_task_completed(self, data: Dict[str, Any]) -> None:
        """
        Handle a Reverb `task.completed` event: mark the task completed in the
        snapshot (and drop it from the pending view on the next poll/reconcile).
        """
        task_id = data.get("task_id")
        if task_id is None:
            return
        with self._lock:
            items = self._snapshot.get("items") or []
            existing = self._find_item(items, task_id)
            if existing is not None:
                existing["status"] = "completed"
            # Clear any bump flag for a now-completed task.
            self._bumped_until.pop(task_id, None)
            self._snapshot["items"] = items
            self._snapshot_ts = time.monotonic()
        ColorPrint.blue(f"[QueueMonitor] WS task.completed -> task {task_id}")

    # -------------------- snapshot accessor (for the GET route) --------------------

    def get_snapshot(self, refresh: bool = False) -> Dict[str, Any]:
        """
        Return the cached queue snapshot decorated with `recently_bumped`, plus
        `laravel_reachable` and `age_ms`. ``refresh=True`` forces a fresh poll
        first (used by GET .../queue?refresh=1).

        Shape (the UI contract — keep stable; `ws_connected` is ADDITIVE):
            { summary:{...}, items:[ {..., recently_bumped:bool} ],
              laravel_reachable:bool, age_ms:float, ws_connected:bool }
        """
        if refresh:
            self.poll_once()

        with self._lock:
            items = self._decorate_items(self._snapshot.get("items") or [])
            summary = dict(self._snapshot.get("summary") or {})
            reachable = self._laravel_reachable
            ws_connected = self._ws_connected
            ts = self._snapshot_ts

        age_ms = round((time.monotonic() - ts) * 1000, 1) if ts else None
        return {
            "summary": summary,
            "items": items,
            "laravel_reachable": reachable,
            # Additive field: whether the real-time Reverb WS is connected. The
            # existing fields above are unchanged (backward-compatible).
            "ws_connected": ws_connected,
            "age_ms": age_ms,
        }

    # -------------------- control proxy (for the POST routes) --------------------

    def set_priority(self, task_id: Any, priority: int) -> Dict[str, Any]:
        """
        Proxy POST .../queue/priority to Laravel. Returns a uniform envelope:
            { success:bool, status:int?, data:<laravel body>?, error:str? }
        """
        return self._post_proxy("priority", {"task_id": task_id, "priority": priority})

    def stack(
        self,
        words: Any,
        language: str,
        target_language: str,
        priority: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Proxy POST .../queue/stack to Laravel (enqueue a translation request).
        `priority` is optional and only forwarded when provided.
        """
        payload: Dict[str, Any] = {
            "words": words,
            "language": language,
            "target_language": target_language,
        }
        if priority is not None:
            payload["priority"] = priority
        return self._post_proxy("stack", payload)

    def _proxy_laravel_task_get(self, task_id: Any, suffix: str) -> Dict[str, Any]:
        """
        Proxy GET /api/task/{taskId}/{suffix} from Laravel (suffix = status|detail).

        Returns a uniform envelope:
            { success:bool, task:<dict>?, bundle:<dict>?, error:str?, laravel_reachable:bool }
        """
        base = self._base_url()
        url = f"{base}/api/task/{task_id}/{suffix}"
        try:
            requests = self._requests()
            resp = requests.get(url, timeout=self._http_timeout)
            try:
                body = resp.json()
            except Exception:
                body = None
            if resp.status_code != 200:
                err = None
                if isinstance(body, dict):
                    err = body.get("message") or body.get("error")
                return {
                    "success": False,
                    "error": err or f"HTTP {resp.status_code}",
                    "laravel_reachable": True,
                }
            task = None
            bundle = None
            if isinstance(body, dict):
                data = body.get("data")
                if isinstance(data, dict):
                    task = data.get("task")
                    if suffix == "detail":
                        bundle = data
            if not task:
                return {
                    "success": False,
                    "error": "Task payload missing from Laravel response",
                    "laravel_reachable": True,
                }
            out: Dict[str, Any] = {
                "success": True,
                "task": task,
                "laravel_reachable": True,
            }
            if bundle is not None:
                out["bundle"] = bundle
            return out
        except Exception as e:
            reason = self._short_err(e)
            ColorPrint.yellow(f"[QueueMonitor] task {suffix} failed ({reason})")
            return {"success": False, "error": reason, "laravel_reachable": False}

    def get_task_detail(self, task_id: Any) -> Dict[str, Any]:
        """
        Proxy GET /api/task/{taskId}/status from Laravel (full global_tasks row).

        Falls back to GET /api/task/{taskId}/detail when /status misses (same
        laravel_main TaskController row, richer bundle on the detail path).

        Returns a uniform envelope:
            { success:bool, task:<dict>?, error:str?, laravel_reachable:bool }
        """
        result = self._proxy_laravel_task_get(task_id, "status")
        if result.get("success"):
            return result
        fallback = self._proxy_laravel_task_get(task_id, "detail")
        if fallback.get("success"):
            return fallback
        return result

    def get_task_full_detail(self, task_id: Any) -> Dict[str, Any]:
        """
        Proxy GET /api/task/{taskId}/detail — task + events + phase bundle.

        Falls back to GET /api/task/{taskId}/status when /detail is unavailable.
        Returns the same uniform envelope as get_task_detail; on success from
        /detail also includes ``bundle`` (events + current_phase + metadata).
        """
        result = self._proxy_laravel_task_get(task_id, "detail")
        if result.get("success"):
            return result
        return self._proxy_laravel_task_get(task_id, "status")

    def _post_proxy(self, action: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Shared POST helper for the priority/stack control proxies."""
        base = self._base_url()
        url = f"{base}{_QUEUE_API_PREFIX}/{action}"
        try:
            requests = self._requests()
            resp = requests.post(url, json=payload, timeout=self._http_timeout)
            try:
                data = resp.json()
            except Exception:
                data = None
            ok = resp.status_code in (200, 201)
            if ok:
                ColorPrint.green(f"[QueueMonitor] queue/{action} -> HTTP {resp.status_code}")
            else:
                ColorPrint.yellow(f"[QueueMonitor] queue/{action} -> HTTP {resp.status_code}")
            return {
                "success": ok,
                "status": resp.status_code,
                "data": data,
            }
        except Exception as e:
            reason = self._short_err(e)
            ColorPrint.yellow(f"[QueueMonitor] queue/{action} failed ({reason})")
            return {"success": False, "error": reason}

    # -------------------- introspection --------------------

    def get_status(self) -> Dict[str, Any]:
        """Service status snapshot (read-only)."""
        with self._lock:
            return {
                "service": "Translation Queue Monitor",
                "base_url": self._base_url(),
                "laravel_reachable": self._laravel_reachable,
                "ws_connected": self._ws_connected,
                "cached_items": len(self._snapshot.get("items") or []),
                "recently_bumped": sum(
                    1 for exp in self._bumped_until.values() if exp > time.monotonic()
                ),
                "bump_ttl_seconds": self._bump_ttl,
                "initialized": self._initialized,
            }


# ============================================================
# Global singleton accessor
# ============================================================

def get_queue_monitor_service(
    laravel_api_url: str = "http://127.0.0.1:9000",
    bump_ttl_seconds: int = 30,
) -> QueueMonitorService:
    """
    Get the QueueMonitorService singleton (idempotent).

    Args:
        laravel_api_url: Laravel base URL (shared with the translation worker).
        bump_ttl_seconds: how long a bumped task stays flagged.

    Returns:
        The shared QueueMonitorService instance.
    """
    return QueueMonitorService(laravel_api_url, bump_ttl_seconds)
