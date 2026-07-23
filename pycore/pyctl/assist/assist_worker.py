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
                      funcs taking a narrow ctx).
  assist_worker.py    THIS FILE: AssistWorker singleton (loop, bus wiring)
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

Threading follows PYTHON_PYCORE.md: named Thread subclasses own long-running
work, cycle/state serialization and all cross-thread data use THREAD_BUS.

Logging: ColorPrint only (pycore rule). Networking: the lazily-loaded
third-party ``requests`` via pycore.pyfoundations.third_party - never a bare
import. All imports at file top (PYTHON_PYCORE.md §1.4).
"""

import random
import threading
import time
from typing import Any, Callable, Dict, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus import THREAD_BUS
from pycore.callmodule.services.sync.laravel_client import get_laravel_client
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyutils.worker_base import CircuitBreaker, _short_err
from pycore.pyfoundations.serialized_worker import (
    SerializedWorkerThread,
    call_serialized,
)

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


_CONFIG_SIGNAL = 'pyctl.assist.config'
_STATE_SIGNAL = 'pyctl.assist.state'
_RUNNING_SIGNAL = 'pyctl.assist.running'
_STOP_SIGNAL = 'pyctl.assist.stop'
_LOOP_QUEUE = 'pyctl.assist.loop.start'
_CYCLE_QUEUE = 'pyctl.assist.cycle'
_STATE_QUEUE = 'pyctl.assist.state.update'
_CYCLE_WORKER = SerializedWorkerThread(_CYCLE_QUEUE, 'AssistCycleThread')
_STATE_WORKER = SerializedWorkerThread(_STATE_QUEUE, 'AssistStateThread')
_CYCLE_WORKER.start()
_STATE_WORKER.start()


class AssistLoopThread(threading.Thread):
    """Run the assist poll loop after receiving its worker through THREAD_BUS."""

    def __init__(self) -> None:
        super().__init__(name='AssistLaravelThread', daemon=True)

    def run(self) -> None:
        payload = THREAD_BUS.receive_message(_LOOP_QUEUE)
        if not isinstance(payload, dict):
            return
        worker = payload.get('worker')
        try:
            worker._run_loop()
        finally:
            THREAD_BUS.signal(_RUNNING_SIGNAL, False)


class AssistTrackThread(threading.Thread):
    """Process one assist item track using THREAD_BUS work and result data."""

    def __init__(self, queue_name: str, response_signal: str) -> None:
        super().__init__(name='AssistTTSTrackThread', daemon=True)
        self._queue_name = queue_name
        self._response_signal = response_signal

    def run(self) -> None:
        payload = THREAD_BUS.receive_message(self._queue_name)
        if not isinstance(payload, dict):
            return
        result = _blank_cycle_result()
        payload['worker']._run_track(
            payload.get('base', ''),
            payload.get('items', []),
            result,
        )
        if time.time() <= float(payload.get('deadline') or 0.0):
            THREAD_BUS.signal(self._response_signal, result)
        THREAD_BUS.clear_queue(self._queue_name)


def _increment_state_counter(name: str, amount: int = 1) -> None:
    """Increment one assist counter on the state-owner thread."""
    state = dict(THREAD_BUS.get_signal(_STATE_SIGNAL, {}) or {})
    counters = dict(state.get('counters', {}) or {})
    counters[name] = int(counters.get(name, 0)) + amount
    state['counters'] = counters
    THREAD_BUS.signal(_STATE_SIGNAL, state)


def _set_state_value(name: str, value: Any) -> None:
    """Set one assist status value on the state-owner thread."""
    state = dict(THREAD_BUS.get_signal(_STATE_SIGNAL, {}) or {})
    state[name] = value
    THREAD_BUS.signal(_STATE_SIGNAL, state)


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
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return

        self.claimer = _build_claimer()
        if THREAD_BUS.get_signal(_CONFIG_SIGNAL) is None:
            THREAD_BUS.signal(_CONFIG_SIGNAL, {})
        if THREAD_BUS.get_signal(_STATE_SIGNAL) is None:
            THREAD_BUS.signal(_STATE_SIGNAL, {
                'counters': {
                    "claimed": 0,
                    "submitted": 0,
                    "released": 0,
                    "failures": 0,
                },
                'last_error': None,
                'last_cycle_at': None,
            })

        # Circuit breaker state (state + methods from the CircuitBreaker mixin).
        self._circuit_log_prefix = "[AssistWorker]"
        self._init_circuit_breaker()

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
        config = dict(THREAD_BUS.get_signal(_CONFIG_SIGNAL, {}) or {})
        if endpoint_resolver is not None:
            config['endpoint_resolver'] = endpoint_resolver
        if image_generator is not None:
            config['image_generator'] = image_generator
        if task_recorder is not None:
            config['task_recorder'] = task_recorder
        THREAD_BUS.signal(_CONFIG_SIGNAL, config)

    def _record_history(self, capability: str, title: str, ok: bool,
                        detail: Optional[Dict[str, Any]] = None,
                        error: Optional[str] = None) -> None:
        """Record one finished assist unit (best-effort; never breaks a cycle)."""
        config = THREAD_BUS.get_signal(_CONFIG_SIGNAL, {}) or {}
        recorder = config.get('task_recorder')
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
        config = THREAD_BUS.get_signal(_CONFIG_SIGNAL, {}) or {}
        endpoint_resolver = config.get('endpoint_resolver')
        if endpoint_resolver is not None:
            try:
                return endpoint_resolver()
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
        return bool(THREAD_BUS.get_signal(_RUNNING_SIGNAL, False))

    def start(self) -> bool:
        """Start the daemon polling loop idempotently."""
        if self.is_running():
            return True
        THREAD_BUS.clear_signal(_STOP_SIGNAL)
        THREAD_BUS.signal(_RUNNING_SIGNAL, True)
        THREAD_BUS.send_message(_LOOP_QUEUE, {'worker': self})
        AssistLoopThread().start()
        ColorPrint.green("[AssistWorker] Polling loop started")
        return True

    def stop(self) -> None:
        """Signal the polling loop to stop (idempotent; does not join - the
        thread exits at its next wakeup, daemon=True covers process exit)."""
        if not self.is_running():
            return
        THREAD_BUS.signal(_STOP_SIGNAL, True)
        ColorPrint.blue("[AssistWorker] Polling loop stop requested")

    def _run_loop(self) -> None:
        """Daemon loop: cycle (when enabled) then jittered sleep. Settings are
        re-read every iteration so changes apply live without a restart.
        Stop control is received through THREAD_BUS."""
        while not THREAD_BUS.has_signal(_STOP_SIGNAL):
            settings = load_assist_settings()
            try:
                if settings["enabled"]:
                    self.run_cycle(settings)
            except Exception as e:  # noqa: BLE001 - the loop must never die
                ColorPrint.red(f"[AssistWorker] Cycle crashed: {e}")
                self._record_error(f"cycle crashed: {e}")
            # Jittered sleep (0.8x..1.2x) so multiple pycores don't sync up.
            interval = settings["poll_interval_s"] * random.uniform(0.8, 1.2)
            if THREAD_BUS.wait_signal(_STOP_SIGNAL, timeout=interval):
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
        timeout = self.TTS_TRACK_TIMEOUT_S + self.SUBMIT_TIMEOUT + self.RELEASE_TIMEOUT + 30
        return call_serialized(
            _CYCLE_QUEUE,
            self._run_cycle,
            settings,
            timeout=timeout,
        )

    def _run_cycle(self, settings: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute one cycle on the THREAD_BUS-owned cycle worker."""
        result: Dict[str, Any] = _blank_cycle_result()
        settings = settings or load_assist_settings()
        self._set_state('last_cycle_at', _now_iso())

        caps = settings["capabilities"]
        types = [t for t in self.CLAIMABLE_TYPES if caps.get(t)]
        if not types:
            return result

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
        cover_items = [i for i in items if i.get("type") == "cover"]
        tts_items = [i for i in items if i.get("type") == "tts"]
        other_items = [i for i in items if i.get("type") not in ("cover", "tts")]
        cover_result = _blank_cycle_result()
        tts_result: Optional[Dict[str, Any]] = None

        if tts_items:
            track_id = str(time.time_ns())
            track_queue = f'pyctl.assist.track.{track_id}'
            track_response = f'{track_queue}.response'
            deadline = time.time() + self.TTS_TRACK_TIMEOUT_S
            THREAD_BUS.send_message(track_queue, {
                'worker': self,
                'base': base,
                'items': tts_items,
                'deadline': deadline,
            })
            AssistTrackThread(track_queue, track_response).start()

        self._run_track(base, cover_items + other_items, cover_result)
        if tts_items:
            tts_result = THREAD_BUS.wait_signal(
                track_response,
                timeout=self.TTS_TRACK_TIMEOUT_S,
            )
            THREAD_BUS.clear_signal(track_response)

        for sub in (cover_result,):
            self._merge_cycle_result(result, sub)
        if tts_items and not isinstance(tts_result, dict):
            ColorPrint.red(
                f"[AssistWorker] TTS track did not finish within "
                f"{self.TTS_TRACK_TIMEOUT_S}s; unfinished items will lease-expire.")
            result["ok"] = False
            result["errors"].append(
                f"tts track timed out after {self.TTS_TRACK_TIMEOUT_S}s")
        elif isinstance(tts_result, dict):
            self._merge_cycle_result(result, tts_result)
        return result

    @staticmethod
    def _merge_cycle_result(result: Dict[str, Any], sub: Dict[str, Any]) -> None:
        """Merge a completed track snapshot into the cycle result."""
        result["processed"] += sub["processed"]
        result["submitted"] += sub["submitted"]
        result["released"] += sub["released"]
        result["errors"].extend(sub["errors"])
        if not sub["ok"]:
            result["ok"] = False

    def _run_track(self, base: str, items: List[Dict[str, Any]],
                   result: Dict[str, Any]) -> None:
        """Process one track's claimed items sequentially into ``result``.

        Cover and TTS tracks run independently so slow TTS work never blocks
        cover generation. The
        per-type handlers live in assist_handlers and receive ``self`` as a
        narrow ctx (they call only submit/release/record_history/claimer -
        never the worker's state storage).
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

    def _increment_counter(self, name: str, amount: int = 1) -> None:
        """Increment a status counter through the state-owner queue."""
        call_serialized(_STATE_QUEUE, _increment_state_counter, name, amount)

    def _set_state(self, name: str, value: Any) -> None:
        """Publish one status field through the state-owner queue."""
        call_serialized(_STATE_QUEUE, _set_state_value, name, value)

    def _claim(self, base: str, types: List[str], limit: int,
               result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """POST /assist/claim; returns claimed items ([] on any failure)."""
        try:
            resp = get_laravel_client().post(
                f"{ASSIST_API_PREFIX}/claim",
                base_url=base,
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
            self._increment_counter("claimed", len(items))
            ColorPrint.green(
                f"[AssistWorker] Claimed {len(items)} item(s) "
                f"({', '.join(sorted({str(i.get('type')) for i in items}))}) from {base}")
        return items

    def _submit(self, base: str, body: Dict[str, Any], result: Dict[str, Any]) -> bool:
        """POST /assist/submit; on rejection the item is released instead so
        Laravel can reassign it. Returns True when the result was accepted."""
        item_type, item_id = body.get("type"), body.get("id")
        try:
            resp = get_laravel_client().post(
                f"{ASSIST_API_PREFIX}/submit", base_url=base, json=body, timeout=self.SUBMIT_TIMEOUT)
        except Exception as e:  # noqa: BLE001
            msg = f"submit {item_type}#{item_id} failed: {_short_err(e)}"
            self._record_error(msg)
            result["ok"] = False
            result["errors"].append(msg)
            self._increment_counter("failures")
            # Release so the item re-queues promptly instead of waiting out the
            # 60-min lease (best-effort: if the network is down release fails too,
            # and the lease still expires on its own).
            self._release(base, str(item_type), item_id, msg, result)
            return False

        if resp.status_code in (200, 201):
            data = resp.json() or {}
            if data.get("ok"):
                self._note_server_ok()
                self._increment_counter("submitted")
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
            self._increment_counter("failures")
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
        self._increment_counter("failures")
        self._set_state("last_error", f"{item_type}#{item_id}: {error}")
        result["errors"].append(f"{item_type}#{item_id}: {error}")
        ColorPrint.yellow(f"[AssistWorker] Releasing {item_type}#{item_id}: {error}")
        body: Dict[str, Any] = {
            "type": item_type, "ids": [item_id],
            "error": error[:500], "claimer": self.claimer,
        }
        if extra:
            body.update(extra)
        try:
            resp = get_laravel_client().post(
                f"{ASSIST_API_PREFIX}/release",
                base_url=base,
                json=body,
                timeout=self.RELEASE_TIMEOUT,
            )
            if resp.status_code == 200:
                self._note_server_ok()
                self._increment_counter("released")
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
        self._set_state("last_error", message)

    def get_status(self) -> Dict[str, Any]:
        """Worker status snapshot (running, circuit, counters, last_*)."""
        state = dict(THREAD_BUS.get_signal(_STATE_SIGNAL, {}) or {})
        counters = dict(state.get('counters', {}) or {})
        last_error = state.get('last_error')
        last_cycle_at = state.get('last_cycle_at')
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
