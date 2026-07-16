# -*- coding: utf-8 -*-
"""
Assist-Laravel background worker - pycore claims generation work from the
SELECTED laravel_main endpoint, generates locally, and submits results back.

Capabilities (claim types):
  cover  - delegated to apps/mcp-chrome (Google Images); not claimed here.
  tts    - word/sentence audio via the existing TTS orchestrator
           (pycore.pyutils.tts.tts_orchestrator: edge -> sherpa -> melotts ->
           gptsovits). The Laravel contract requires MP3 bytes; non-MP3 output
           is RELEASED with a clear error instead of being submitted.
  poster - delegated to apps/mcp-chrome (Google Images); not claimed here.

Word TRANSLATIONS are deliberately NOT claimed here - they already ride the
existing TranslationWorkerService (/api/worker/tasks/pull pipeline). This
worker's master toggle gates that service too (see callmodule_main.py /
event_handlers.py: translation_worker_enabled_on_start()).

------------------------------------------------------------------------------
Module split (this file is the slim orchestrator + facade)
------------------------------------------------------------------------------
  assist_settings.py  settings contract + per-capability toggle gates.
  assist_payload.py   pure payload transforms + worker-id/time helpers.
  assist_handlers.py  _handle_cover / _handle_tts / _handle_poster (module
                      funcs taking a narrow ctx - never reach into locks).
  assist_worker.py    THIS FILE: AssistWorker singleton (loop, locks, wiring)
                      + re-exports of the public API.
  pyutils/worker_base.py  shared _short_err + CircuitBreaker mixin (assist_worker
                      inherits it; sibling retrofit deferred - see TODO there).

------------------------------------------------------------------------------
Laravel contract (base = the SELECTED laravel endpoint, see endpoint resolver)
------------------------------------------------------------------------------
  POST {base}/api/app_qy_v1/assist/claim
       { types:('cover'|'tts')[], limit?:1..10=3, claimer:str<=56 }
       -> { success, items:[ {type:'cover', id, payload:{name, prompt,
            size:'WxH', filename}} | {type:'tts', id, payload:{text, language,
            voice_type, speed, audio_relative_path}} ], lease_minutes:60 }
  POST {base}/api/app_qy_v1/assist/submit
       cover: { type:'cover', id, image_base64, mime?, claimer? }
       tts:   { type:'tts', id, audio_base64 (MP3, >=100 bytes), mime?,
                voice?, claimer? }
       -> { ok, status, already_done? }
  POST {base}/api/app_qy_v1/assist/release
       { type, ids:[], error?, claimer? } -> { success, released }
  GET  {base}/api/app_qy_v1/assist/status -> { success, cover:{...}, tts:{...},
       lease_minutes }

------------------------------------------------------------------------------
Architecture (mirrors TranslationWorkerService's structure)
------------------------------------------------------------------------------
  - Singleton with start()/stop() driving ONE daemon thread loop.
  - Jittered sleep (poll_interval_s * 0.8..1.2) between cycles; settings are
    re-read from the unified user-data store every cycle so interval /
    capability changes apply live without a restart.
  - Circuit breaker (inherited from pyutils.worker_base.CircuitBreaker): after
    CIRCUIT_FAIL_THRESHOLD consecutive server-side HTTP 5xx give-ups the breaker
    OPENS for CIRCUIT_COOLDOWN_SECONDS - the loop keeps running but skips
    claiming until the cooldown expires; any accepted 2xx response resets it.
  - Endpoint selection is INJECTED by the app layer (callmodule wires the
    LaravelEndpointManager resolver in via configure()); pyctl never imports
    callmodule. Without injection a stdlib fallback reads the stored
    ``laravel_api.current`` straight from user_data.json.

RISK - singleton + dual-lock state: AssistWorker holds _instance_lock (singleton),
_thread_lock (loop), _cycle_lock (serialize daemon loop vs POST /api/local/assist/cycle),
+ a parallel TTS track thread mutating private state. ALL these locks/state stay
on this class; handlers receive a ctx and never reach into locks.

Logging: ColorPrint only (pycore rule). Networking: the lazily-loaded
third-party ``requests`` via pycore.pyfoundations.third_party - never a bare
import. All imports at file top (PYTHON_PYCORE.md §1.4).
"""

import random
import threading
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyutils.worker_base import CircuitBreaker, _short_err

# Public API re-export (the package __init__ imports these from THIS module so
# the split is transparent to every caller). See assist_settings for the
# settings contract + per-capability toggle gates.
from .assist_settings import (
    ASSIST_API_PREFIX,
    BATCH_LIMIT_MAX,
    BATCH_LIMIT_MIN,
    DEFAULT_SETTINGS,
    POLL_INTERVAL_MAX,
    POLL_INTERVAL_MIN,
    USER_DATA_SECTION,
    assist_capability_enabled,
    assist_settings_exist,
    load_assist_settings,
    save_assist_settings,
    translation_worker_enabled_on_start,
)
from .assist_payload import _blank_cycle_result, _build_claimer, _now_iso
from . import assist_handlers


# ============================================================
# Assist worker (singleton)
# ============================================================

class AssistWorker(CircuitBreaker):
    """
    Singleton background worker for the Laravel assist queue (tts only;
    cover/poster delegated to apps/mcp-chrome).

    Lifecycle:
      configure(...)  - app layer injects the endpoint resolver + image
                        generator (idempotent; safe to call repeatedly).
      start()/stop()  - start/stop the daemon polling thread.
      run_cycle()     - execute ONE claim->generate->submit cycle synchronously
                        (used by the loop AND by POST /api/local/assist/cycle).
    """

    _instance: Optional["AssistWorker"] = None
    _instance_lock = threading.Lock()

    # Claim types this worker can serve. Cover/poster image work is delegated to
    # apps/mcp-chrome — only TTS is claimed here.
    CLAIMABLE_TYPES = ("tts",)

    # HTTP timeouts (seconds). Submit carries base64 images/audio - give it room.
    CLAIM_TIMEOUT = 8
    SUBMIT_TIMEOUT = 60
    RELEASE_TIMEOUT = 8
    # Bounded wait for the parallel TTS track (run_cycle). 15min is well under the
    # 60-min claim lease; a hung TTS engine is left on the background thread so the
    # cycle lock (and POST /cycle) is never frozen forever.
    TTS_TRACK_TIMEOUT_S = 900

    # CIRCUIT_FAIL_THRESHOLD / CIRCUIT_COOLDOWN_SECONDS inherited from
    # CircuitBreaker (pyutils.worker_base).

    def __new__(cls, *args, **kwargs):
        """Singleton - one assist worker per process."""
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return

        # App-layer injections (see configure()).
        self._endpoint_resolver: Optional[Callable[[], Optional[Dict[str, Any]]]] = None
        self._image_generator: Optional[Callable[..., Dict[str, Any]]] = None
        # Optional history recorder (app layer wires the pyctl TaskManager in;
        # pyctl.assist must not import pyctl.desktop). Records one finished unit
        # per assist item so the Queue Center shows per-capability history.
        self._task_recorder: Optional[Callable[..., None]] = None

        self.claimer = _build_claimer()

        # Thread loop state.
        self._thread: Optional[threading.Thread] = None
        self._thread_lock = threading.Lock()
        self._stop_event = threading.Event()
        # Serializes cycles (the loop vs. POST /cycle) - never two at once.
        self._cycle_lock = threading.Lock()

        # Circuit breaker state (state + methods from the CircuitBreaker mixin).
        self._circuit_log_prefix = "[AssistWorker]"
        self._init_circuit_breaker()

        # Counters / introspection (guarded by _state_lock).
        self._state_lock = threading.Lock()
        self._counters = {"claimed": 0, "submitted": 0, "released": 0, "failures": 0}
        self._last_error: Optional[str] = None
        self._last_cycle_at: Optional[str] = None

        self._initialized = True
        ColorPrint.green(f"[AssistWorker] Initialized (claimer={self.claimer})")

    # -------------------- app-layer wiring --------------------

    def configure(
        self,
        endpoint_resolver: Optional[Callable[[], Optional[Dict[str, Any]]]] = None,
        image_generator: Optional[Callable[..., Dict[str, Any]]] = None,
        task_recorder: Optional[Callable[..., None]] = None,
    ) -> None:
        """
        Inject app-layer collaborators (idempotent).

        endpoint_resolver: () -> {"base_url": str, "label": str} | None - the
            SELECTED laravel endpoint (callmodule wires LaravelEndpointManager).
        image_generator: pyctl.ai.generate_image-compatible callable returning
            { success, provider, model, image_base64, mime, latency_ms, error }.
        task_recorder: (capability, title, ok, detail, error) -> None - records
            one finished assist unit to the pyctl TaskManager (app layer wires it;
            pyctl.assist must not import pyctl.desktop).
        """
        if endpoint_resolver is not None:
            self._endpoint_resolver = endpoint_resolver
        if image_generator is not None:
            self._image_generator = image_generator
        if task_recorder is not None:
            self._task_recorder = task_recorder

    def _record_history(self, capability: str, title: str, ok: bool,
                        detail: Optional[Dict[str, Any]] = None,
                        error: Optional[str] = None) -> None:
        """Record one finished assist unit (best-effort; never breaks a cycle)."""
        recorder = self._task_recorder
        if recorder is None:
            return
        try:
            recorder(capability=capability, title=str(title or ""), ok=bool(ok),
                     detail=detail or {}, error=error)
        except Exception as e:  # noqa: BLE001 - history is best-effort
            ColorPrint.yellow(f"[AssistWorker] history record failed: {e}")

    def resolve_endpoint(self) -> Optional[Dict[str, Any]]:
        """
        The SELECTED laravel endpoint as {"base_url", "label"} or None.

        Prefers the injected resolver (LaravelEndpointManager: stored-first
        probe + sweep). Fallback (resolver not wired yet): read the stored
        ``laravel_api.current`` / first candidate straight from the unified
        user-data store - same source of truth, no probing.
        """
        if self._endpoint_resolver is not None:
            try:
                return self._endpoint_resolver()
            except Exception as e:  # noqa: BLE001 - resolver must never kill a cycle
                ColorPrint.yellow(f"[AssistWorker] Endpoint resolver failed: {_short_err(e)}")
                return None
        section = get_user_data_store().get_section("laravel_api") or {}
        current = (section.get("current") or "").strip().rstrip("/")
        if current:
            return {"base_url": current, "label": "stored"}
        endpoints = [u for u in (section.get("endpoints") or []) if isinstance(u, str) and u.strip()]
        if endpoints:
            return {"base_url": endpoints[0].strip().rstrip("/"), "label": "first-candidate"}
        return None

    # -------------------- lifecycle --------------------

    def is_running(self) -> bool:
        """True while the polling thread is alive."""
        thread = self._thread
        return bool(thread and thread.is_alive())

    def start(self) -> bool:
        """
        Start the daemon polling loop (idempotent). Returns True if running.

        Restart-after-stop is race-free: each loop thread owns the Event it was
        created with. If a stop is pending on the live thread, that thread is
        left to die at its next wakeup and a FRESH thread with a FRESH event is
        spawned - any momentary overlap is harmless because run_cycle() is
        serialized by _cycle_lock.
        """
        with self._thread_lock:
            if self.is_running() and not self._stop_event.is_set():
                return True
            self._stop_event = threading.Event()
            self._thread = threading.Thread(
                target=self._run_loop, args=(self._stop_event,),
                daemon=True, name="assist-laravel-worker")
            self._thread.start()
            ColorPrint.green("[AssistWorker] Polling loop started")
            return True

    def stop(self) -> None:
        """Signal the polling loop to stop (idempotent; does not join - the
        thread exits at its next wakeup, daemon=True covers process exit)."""
        with self._thread_lock:
            if not self.is_running():
                return
            self._stop_event.set()
            ColorPrint.blue("[AssistWorker] Polling loop stop requested")

    def _run_loop(self, stop_event: threading.Event) -> None:
        """Daemon loop: cycle (when enabled) then jittered sleep. Settings are
        re-read every iteration so changes apply live without a restart.
        ``stop_event`` is THIS thread's own event (see start())."""
        while not stop_event.is_set():
            settings = load_assist_settings()
            try:
                if settings["enabled"]:
                    self.run_cycle(settings)
            except Exception as e:  # noqa: BLE001 - the loop must never die
                ColorPrint.red(f"[AssistWorker] Cycle crashed: {e}")
                self._record_error(f"cycle crashed: {e}")
            # Jittered sleep (0.8x..1.2x) so multiple pycores don't sync up.
            interval = settings["poll_interval_s"] * random.uniform(0.8, 1.2)
            if stop_event.wait(interval):
                break
        ColorPrint.blue("[AssistWorker] Polling loop exited")

    # -------------------- one cycle --------------------

    def run_cycle(self, settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        ONE claim -> generate -> submit/release cycle (synchronous).

        Returns { ok, processed, submitted, released, errors:[str] } - the
        exact shape POST /api/local/assist/cycle relays. Never raises for
        per-item failures; those are released back to Laravel and reported in
        ``errors``.
        """
        result: Dict[str, Any] = _blank_cycle_result()
        with self._cycle_lock:
            settings = settings or load_assist_settings()
            with self._state_lock:
                self._last_cycle_at = _now_iso()

            caps = settings["capabilities"]
            types = [t for t in self.CLAIMABLE_TYPES if caps.get(t)]
            if not types:
                return result  # nothing claimable (translation rides its own worker)

            if self._circuit_is_open():
                result["ok"] = False
                result["errors"].append(
                    f"circuit open - backend returned HTTP 5xx "
                    f"{self._server_5xx_streak}x; retrying in "
                    f"{self._circuit_cooldown_remaining()}s")
                return result

            endpoint = self.resolve_endpoint()
            if not endpoint or not endpoint.get("base_url"):
                msg = "no Laravel endpoint selected/resolvable (laravel_api.current)"
                self._record_error(msg)
                result["ok"] = False
                result["errors"].append(msg)
                return result
            base = endpoint["base_url"]

            items = self._claim(base, types, settings["batch_limit"], result)

            # Run the cover track and the TTS track CONCURRENTLY. TTS synthesis
            # is serialized process-wide by the edge-tts lock and can be slow, so
            # a claimed TTS batch must never stall claimed cover work (and vice
            # versa) - these are two independent parallel request streams. Each
            # track accumulates into its OWN sub-result; the worker's counters are
            # already guarded by _state_lock, so submit/release stay race-free and
            # only the plain sub-result dicts (never shared) are merged after join.
            cover_items = [i for i in items if i.get("type") == "cover"]
            tts_items = [i for i in items if i.get("type") == "tts"]
            other_items = [i for i in items if i.get("type") not in ("cover", "tts")]

            cover_result = _blank_cycle_result()
            tts_result = _blank_cycle_result()
            tts_thread = threading.Thread(
                target=self._run_track, args=(base, tts_items, tts_result),
                daemon=True, name="assist-tts-track")
            tts_thread.start()
            # Cover (+ any unsupported) items run on THIS thread, in parallel.
            self._run_track(base, cover_items + other_items, cover_result)
            # Bounded join: a hung TTS engine (unbounded sherpa/melotts local
            # compute) used to hold _cycle_lock forever, freezing the assist loop
            # and every POST /api/local/assist/cycle. 15min is well under the 60-min
            # claim lease; on timeout the daemon track keeps running in the
            # background (its submits still land; unfinished items lease-expire) and
            # the cycle lock is released. tts_result is NOT merged when the thread
            # is still alive (it may still be mutating that dict).
            tts_thread.join(timeout=self.TTS_TRACK_TIMEOUT_S)
            tts_timed_out = tts_thread.is_alive()

            for sub in (cover_result,):
                result["processed"] += sub["processed"]
                result["submitted"] += sub["submitted"]
                result["released"] += sub["released"]
                result["errors"].extend(sub["errors"])
                if not sub["ok"]:
                    result["ok"] = False
            if tts_timed_out:
                ColorPrint.red(
                    f"[AssistWorker] TTS track did not finish within "
                    f"{self.TTS_TRACK_TIMEOUT_S}s; leaving it on the background "
                    f"thread (unfinished items will lease-expire). Cycle lock released.")
                result["ok"] = False
                result["errors"].append(
                    f"tts track timed out after {self.TTS_TRACK_TIMEOUT_S}s")
            else:
                result["processed"] += tts_result["processed"]
                result["submitted"] += tts_result["submitted"]
                result["released"] += tts_result["released"]
                result["errors"].extend(tts_result["errors"])
                if not tts_result["ok"]:
                    result["ok"] = False
        return result

    def _run_track(self, base: str, items: List[Dict[str, Any]],
                   result: Dict[str, Any]) -> None:
        """Process one track's claimed items sequentially into ``result``.

        Cover and TTS tracks call this on SEPARATE threads (see run_cycle) so the
        slow, lock-serialized TTS engine never blocks fast cover generation. The
        per-type handlers live in assist_handlers and receive ``self`` as a
        narrow ctx (they call only submit/release/record_history/claimer -
        never the worker's locks).
        """
        for item in items:
            item_type = item.get("type")
            item_id = item.get("id")
            result["processed"] += 1
            try:
                if item_type == "cover":
                    assist_handlers._handle_cover(self, base, item, result)
                elif item_type == "tts":
                    assist_handlers._handle_tts(self, base, item, result)
                elif item_type == "poster":
                    assist_handlers._handle_poster(self, base, item, result)
                else:
                    self._release(base, str(item_type), item_id,
                                  f"unsupported assist item type '{item_type}'", result)
            except Exception as e:  # noqa: BLE001 - release instead of stranding the lease
                ColorPrint.red(f"[AssistWorker] {item_type}#{item_id} crashed: {e}")
                self._release(base, str(item_type), item_id,
                              f"pycore handler crashed: {e}", result)

    # -------------------- Laravel assist API --------------------

    def _claim(self, base: str, types: List[str], limit: int,
               result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """POST /assist/claim; returns claimed items ([] on any failure)."""
        requests = get_third_package_requests()
        try:
            resp = requests.post(
                f"{base}{ASSIST_API_PREFIX}/claim",
                json={"types": types, "limit": limit, "claimer": self.claimer},
                timeout=self.CLAIM_TIMEOUT,
            )
        except Exception as e:  # noqa: BLE001 - network failure, not a 5xx
            msg = f"claim failed: {_short_err(e)}"
            self._record_error(msg)
            result["ok"] = False
            result["errors"].append(msg)
            return []
        if 500 <= resp.status_code < 600:
            self._note_server_error(f"claim -> HTTP {resp.status_code}")
            result["ok"] = False
            result["errors"].append(f"claim -> HTTP {resp.status_code}")
            return []
        if resp.status_code != 200:
            msg = f"claim -> HTTP {resp.status_code}"
            self._record_error(msg)
            result["ok"] = False
            result["errors"].append(msg)
            return []
        self._note_server_ok()
        try:
            data = resp.json() or {}
        except Exception as e:  # noqa: BLE001 - non-JSON 200 must not strand the batch
            msg = f"claim returned non-JSON 200: {_short_err(e)}"
            self._record_error(msg)
            result["ok"] = False
            result["errors"].append(msg)
            return []
        items = data.get("items") or []
        if items:
            with self._state_lock:
                self._counters["claimed"] += len(items)
            ColorPrint.green(
                f"[AssistWorker] Claimed {len(items)} item(s) "
                f"({', '.join(sorted({str(i.get('type')) for i in items}))}) from {base}")
        return items

    def _submit(self, base: str, body: Dict[str, Any], result: Dict[str, Any]) -> bool:
        """POST /assist/submit; on rejection the item is released instead so
        Laravel can reassign it. Returns True when the result was accepted."""
        item_type, item_id = body.get("type"), body.get("id")
        requests = get_third_package_requests()
        try:
            resp = requests.post(
                f"{base}{ASSIST_API_PREFIX}/submit", json=body, timeout=self.SUBMIT_TIMEOUT)
        except Exception as e:  # noqa: BLE001
            msg = f"submit {item_type}#{item_id} failed: {_short_err(e)}"
            self._record_error(msg)
            result["ok"] = False
            result["errors"].append(msg)
            with self._state_lock:
                self._counters["failures"] += 1
            # Release so the item re-queues promptly instead of waiting out the
            # 60-min lease (best-effort: if the network is down release fails too,
            # and the lease still expires on its own).
            self._release(base, str(item_type), item_id, msg, result)
            return False

        if resp.status_code in (200, 201):
            data = resp.json() or {}
            if data.get("ok"):
                self._note_server_ok()
                with self._state_lock:
                    self._counters["submitted"] += 1
                result["submitted"] += 1
                note = " (already done)" if data.get("already_done") else ""
                ColorPrint.green(f"[AssistWorker] Submitted {item_type}#{item_id}{note}")
                return True
            self._release(base, str(item_type), item_id,
                          f"submit rejected: {data.get('status') or data}", result)
            return False

        if 500 <= resp.status_code < 600:
            self._note_server_error(f"submit {item_type}#{item_id} -> HTTP {resp.status_code}")
            result["ok"] = False
            result["errors"].append(f"submit {item_type}#{item_id} -> HTTP {resp.status_code}")
            with self._state_lock:
                self._counters["failures"] += 1
            return False

        # 4xx - a contract-level rejection; release so the item is not stranded.
        self._release(base, str(item_type), item_id,
                      f"submit rejected (HTTP {resp.status_code})", result)
        return False

    def _release(self, base: str, item_type: str, item_id: Any,
                 error: str, result: Dict[str, Any],
                 extra: Optional[Dict[str, Any]] = None) -> None:
        """POST /assist/release for one failed item (best-effort: a lost
        release just means the 60-minute lease expires server-side).

        ``extra`` forwards type-specific fields the contract requires on the
        release body (e.g. poster's ``media_type``) without changing the shape
        for cover/tts releases.
        """
        with self._state_lock:
            self._counters["failures"] += 1
            self._last_error = f"{item_type}#{item_id}: {error}"
        result["errors"].append(f"{item_type}#{item_id}: {error}")
        ColorPrint.yellow(f"[AssistWorker] Releasing {item_type}#{item_id}: {error}")
        requests = get_third_package_requests()
        body: Dict[str, Any] = {
            "type": item_type, "ids": [item_id],
            "error": error[:500], "claimer": self.claimer,
        }
        if extra:
            body.update(extra)
        try:
            resp = requests.post(
                f"{base}{ASSIST_API_PREFIX}/release",
                json=body,
                timeout=self.RELEASE_TIMEOUT,
            )
            if resp.status_code == 200:
                self._note_server_ok()
                with self._state_lock:
                    self._counters["released"] += 1
                result["released"] += 1
            elif 500 <= resp.status_code < 600:
                self._note_server_error(f"release -> HTTP {resp.status_code}")
            else:
                ColorPrint.yellow(
                    f"[AssistWorker] Release {item_type}#{item_id} -> HTTP {resp.status_code}")
        except Exception as e:  # noqa: BLE001
            ColorPrint.yellow(
                f"[AssistWorker] Release {item_type}#{item_id} failed "
                f"({_short_err(e)}); lease will expire server-side")

    # -------------------- introspection --------------------

    def _record_error(self, message: str) -> None:
        """Remember the most recent error for the status endpoint."""
        with self._state_lock:
            self._last_error = message

    def get_status(self) -> Dict[str, Any]:
        """Worker status snapshot (running, circuit, counters, last_*)."""
        with self._state_lock:
            counters = dict(self._counters)
            last_error = self._last_error
            last_cycle_at = self._last_cycle_at
        return {
            "running": self.is_running(),
            "circuit": {
                "open": self._circuit_is_open(),
                "cooldown_s": self._circuit_cooldown_remaining(),
            },
            "counters": counters,
            "last_error": last_error,
            "last_cycle_at": last_cycle_at,
            "claimer": self.claimer,
        }


# ============================================================
# Global singleton accessor
# ============================================================

def get_assist_worker() -> AssistWorker:
    """Get the AssistWorker singleton (idempotent)."""
    return AssistWorker()
