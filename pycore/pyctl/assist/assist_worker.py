# -*- coding: utf-8 -*-
"""
Assist-Laravel background worker — pycore claims generation work from the
SELECTED laravel_main endpoint, generates locally, and submits results back.

Capabilities (claim types):
  cover — AI cover images via the injected image generator (the app layer wires
          pyctl.ai.generate_image in — pyctl/* packages must not import each
          other, mirroring pyctl.desktop.ai_hooks composition).
  tts   — word/sentence audio via the existing TTS orchestrator
          (pycore.pyutils.tts.tts_orchestrator: edge → sherpa → melotts →
          gptsovits). The Laravel contract requires MP3 bytes; non-MP3 output
          is RELEASED with a clear error instead of being submitted.

Word TRANSLATIONS are deliberately NOT claimed here — they already ride the
existing TranslationWorkerService (/api/worker/tasks/pull pipeline). This
worker's master toggle gates that service too (see callmodule_main.py /
event_handlers.py: translation_worker_enabled_on_start()).

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
  - Circuit breaker: after CIRCUIT_FAIL_THRESHOLD consecutive server-side
    HTTP 5xx give-ups the breaker OPENS for CIRCUIT_COOLDOWN_SECONDS — the
    loop keeps running but skips claiming until the cooldown expires; any
    accepted 2xx response resets it.
  - Endpoint selection is INJECTED by the app layer (callmodule wires the
    LaravelEndpointManager resolver in via configure()); pyctl never imports
    callmodule. Without injection a stdlib fallback reads the stored
    ``laravel_api.current`` straight from user_data.json.

Settings (unified user-data store, section ``assist_laravel``):
    { enabled: bool (default False),
      capabilities: { cover: true, tts: true, translation: true },
      poll_interval_s: int (default 30, 5..600),
      batch_limit: int (default 3, 1..10) }

Logging: ColorPrint only (pycore rule). Networking: the lazily-loaded
third-party ``requests`` via pycore.pyfoundations.third_party — never a bare
import. All imports at file top (PYTHON_PYCORE.md §1.4).
"""

import base64
import math
import os
import random
import re
import socket
import tempfile
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party import get_third_package_requests
from pycore.pyfoundations.system_paths import get_user_data_store
from pycore.pyutils.security.machine_id import get_machine_id
from pycore.pyutils.tts import tts_orchestrator


# ============================================================
# Settings (unified user-data store, section "assist_laravel")
# ============================================================

USER_DATA_SECTION = "assist_laravel"

# Laravel assist API prefix (relative to the selected endpoint base URL).
ASSIST_API_PREFIX = "/api/app_qy_v1/assist"

POLL_INTERVAL_MIN, POLL_INTERVAL_MAX = 5, 600
BATCH_LIMIT_MIN, BATCH_LIMIT_MAX = 1, 10

DEFAULT_SETTINGS: Dict[str, Any] = {
    "enabled": False,
    "capabilities": {"cover": True, "tts": True, "translation": True},
    "poll_interval_s": 30,
    "batch_limit": 3,
}


def _clamp(value: Any, lo: int, hi: int, default: int) -> int:
    """Coerce ``value`` to an int clamped into [lo, hi]; ``default`` on junk."""
    try:
        return max(lo, min(hi, int(value)))
    except (TypeError, ValueError):
        return default


def _merge_settings(raw: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Merge a raw section dict over DEFAULT_SETTINGS with validation/clamping."""
    raw = raw if isinstance(raw, dict) else {}
    caps_raw = raw.get("capabilities")
    caps_raw = caps_raw if isinstance(caps_raw, dict) else {}
    caps = {
        key: bool(caps_raw.get(key, default))
        for key, default in DEFAULT_SETTINGS["capabilities"].items()
    }
    return {
        "enabled": bool(raw.get("enabled", DEFAULT_SETTINGS["enabled"])),
        "capabilities": caps,
        "poll_interval_s": _clamp(
            raw.get("poll_interval_s"), POLL_INTERVAL_MIN, POLL_INTERVAL_MAX,
            DEFAULT_SETTINGS["poll_interval_s"]),
        "batch_limit": _clamp(
            raw.get("batch_limit"), BATCH_LIMIT_MIN, BATCH_LIMIT_MAX,
            DEFAULT_SETTINGS["batch_limit"]),
    }


def assist_settings_exist() -> bool:
    """True when the ``assist_laravel`` section is PRESENT in user_data.json.

    Used by the translation-worker gating to preserve pre-upgrade behaviour:
    while the key is entirely absent the translation worker keeps its legacy
    Config-driven default; once the key exists the assist toggle rules.
    """
    return get_user_data_store().get(USER_DATA_SECTION) is not None


def load_assist_settings() -> Dict[str, Any]:
    """Effective settings: stored section merged over defaults (validated)."""
    return _merge_settings(get_user_data_store().get_section(USER_DATA_SECTION))


def save_assist_settings(patch: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Apply ``patch`` on top of the stored settings and persist the FULL merged,
    validated document (so the section is always complete and clamped on disk).
    ``patch.capabilities`` is merged per-key, not replaced wholesale.
    Returns the effective settings after saving.
    """
    store = get_user_data_store()
    current = store.get_section(USER_DATA_SECTION)
    patch = patch if isinstance(patch, dict) else {}
    merged_raw = dict(current)
    for key in ("enabled", "poll_interval_s", "batch_limit"):
        if key in patch:
            merged_raw[key] = patch[key]
    if isinstance(patch.get("capabilities"), dict):
        caps = dict(current.get("capabilities") or {})
        caps.update(patch["capabilities"])
        merged_raw["capabilities"] = caps
    effective = _merge_settings(merged_raw)
    store.set_section(USER_DATA_SECTION, effective)
    return effective


def translation_worker_enabled_on_start(legacy_default: bool) -> bool:
    """
    Master-toggle gate for the EXISTING TranslationWorkerService.

    - Section absent (fresh upgrade, key never written): return
      ``legacy_default`` — i.e. Config.TRANSLATION_WORKER_ENABLED_ON_START —
      preserving today's behaviour exactly.
    - Section present: the assist toggle rules —
      ``enabled AND capabilities.translation``.
    """
    if not assist_settings_exist():
        return bool(legacy_default)
    settings = load_assist_settings()
    return bool(settings["enabled"] and settings["capabilities"].get("translation", True))


# ============================================================
# Payload helpers (pure functions, easy to reason about)
# ============================================================

# Gateway aspect-ratio shape (pyctl.ai.ai_gateway._ASPECT_RATIO_RE): "W:H" <=99.
_ASPECT_RE = re.compile(r"^\d{1,2}:\d{1,2}$")
_PIXEL_SIZE_RE = re.compile(r"^(\d{2,5})\s*[xX×]\s*(\d{2,5})$")
# Ratios the image providers actually understand, used when an exact gcd
# reduction does not fit the gateway's 2-digit "W:H" shape.
_COMMON_RATIOS: Tuple[Tuple[int, int], ...] = (
    (1, 1), (16, 9), (9, 16), (4, 3), (3, 4), (3, 2), (2, 3), (21, 9),
)


def _size_to_aspect(size: Any) -> Optional[str]:
    """
    Map the Laravel payload's ``size`` ('WxH', e.g. '1024x1024') to the image
    gateway's aspect-ratio form ('1:1'). Already-ratio values pass through;
    unparseable values return None (provider default applies).
    """
    if not size:
        return None
    s = str(size).strip()
    if _ASPECT_RE.match(s):
        return s
    m = _PIXEL_SIZE_RE.match(s)
    if not m:
        return None
    w, h = int(m.group(1)), int(m.group(2))
    if w <= 0 or h <= 0:
        return None
    g = math.gcd(w, h)
    aw, ah = w // g, h // g
    if aw <= 99 and ah <= 99:
        return f"{aw}:{ah}"
    ratio = w / h
    best = min(_COMMON_RATIOS, key=lambda t: abs(t[0] / t[1] - ratio))
    return f"{best[0]}:{best[1]}"


def _speed_to_rate(speed: Any) -> Optional[str]:
    """
    Map the Laravel payload's ``speed`` (a factor like 1.0 / 0.8, or an
    already-formed '-20%') to the orchestrator's edge-style signed percentage.
    None/1.0/junk -> None (engine default).
    """
    if speed in (None, ""):
        return None
    if isinstance(speed, str) and speed.strip().endswith("%"):
        return speed.strip()
    try:
        factor = float(speed)
    except (TypeError, ValueError):
        return None
    if factor <= 0:
        return None
    pct = int(round((factor - 1.0) * 100))
    if pct == 0:
        return None
    return f"{pct:+d}%"


def _looks_like_mp3(data: bytes) -> bool:
    """Cheap MP3 sniff: ID3 container header or a raw MPEG frame-sync."""
    if not data or len(data) < 4:
        return False
    if data[:3] == b"ID3":
        return True
    return data[0] == 0xFF and (data[1] & 0xE0) == 0xE0


def _short_err(exc: Exception) -> str:
    """One-line condensation of noisy requests/urllib3 exceptions
    (same hygiene as TranslationWorkerService._short_err)."""
    name = type(exc).__name__
    text = str(exc)
    low = text.lower()
    if "refused" in low or "ConnectionRefused" in name:
        return "connection refused (Laravel not listening)"
    if "timed out" in low or "timeout" in low.replace("connecttimeout", ""):
        return "timed out"
    if "max retries" in low or "newconnectionerror" in low or "failed to establish" in low:
        return "host unreachable"
    if "name or service not known" in low or "getaddrinfo" in low:
        return "host not resolvable"
    return text.splitlines()[0][:120] if text else name


def _build_claimer() -> str:
    """
    Stable claimer id: 'pycore-' + hostname + machine-id prefix, sanitized and
    <= 56 chars (the Laravel contract's claimer cap). The machine id comes from
    the existing pyutils.security.machine_id helper (registry MachineGuid /
    /etc/machine-id backed), so the id survives restarts on the same box.
    """
    host = socket.gethostname() or "host"
    safe_host = "".join(c if (c.isalnum() or c in "-_") else "-" for c in host).lower()
    mid = get_machine_id()[:12]
    return f"pycore-{safe_host[:36]}-{mid}"  # 7 + <=36 + 1 + 12 <= 56


def _now_iso() -> str:
    """UTC timestamp for last_cycle_at (second precision, ISO-8601)."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _blank_cycle_result() -> Dict[str, Any]:
    """Fresh accumulator for a cycle (and for each parallel per-type track)."""
    return {"ok": True, "processed": 0, "submitted": 0, "released": 0, "errors": []}


# ============================================================
# Assist worker (singleton)
# ============================================================

class AssistWorker:
    """
    Singleton background worker for the Laravel assist queue (cover + tts).

    Lifecycle:
      configure(...)  — app layer injects the endpoint resolver + image
                        generator (idempotent; safe to call repeatedly).
      start()/stop()  — start/stop the daemon polling thread.
      run_cycle()     — execute ONE claim->generate->submit cycle synchronously
                        (used by the loop AND by POST /api/local/assist/cycle).
    """

    _instance: Optional["AssistWorker"] = None
    _instance_lock = threading.Lock()

    # Claim types this worker can serve (translation rides the existing
    # TranslationWorkerService — never claimed here).
    CLAIMABLE_TYPES = ("cover", "tts")

    # Circuit breaker: consecutive server-side (HTTP 5xx) give-ups before the
    # worker stops claiming for a cooldown (mirrors TranslationWorkerService).
    CIRCUIT_FAIL_THRESHOLD = 3
    CIRCUIT_COOLDOWN_SECONDS = 120

    # HTTP timeouts (seconds). Submit carries base64 images/audio — give it room.
    CLAIM_TIMEOUT = 8
    SUBMIT_TIMEOUT = 60
    RELEASE_TIMEOUT = 8

    def __new__(cls, *args, **kwargs):
        """Singleton — one assist worker per process."""
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

        self.claimer = _build_claimer()

        # Thread loop state.
        self._thread: Optional[threading.Thread] = None
        self._thread_lock = threading.Lock()
        self._stop_event = threading.Event()
        # Serializes cycles (the loop vs. POST /cycle) — never two at once.
        self._cycle_lock = threading.Lock()

        # Circuit breaker state.
        self._server_5xx_streak = 0
        self._circuit_open_until = 0.0

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
    ) -> None:
        """
        Inject app-layer collaborators (idempotent).

        endpoint_resolver: () -> {"base_url": str, "label": str} | None — the
            SELECTED laravel endpoint (callmodule wires LaravelEndpointManager).
        image_generator: pyctl.ai.generate_image-compatible callable returning
            { success, provider, model, image_base64, mime, latency_ms, error }.
        """
        if endpoint_resolver is not None:
            self._endpoint_resolver = endpoint_resolver
        if image_generator is not None:
            self._image_generator = image_generator

    def resolve_endpoint(self) -> Optional[Dict[str, Any]]:
        """
        The SELECTED laravel endpoint as {"base_url", "label"} or None.

        Prefers the injected resolver (LaravelEndpointManager: stored-first
        probe + sweep). Fallback (resolver not wired yet): read the stored
        ``laravel_api.current`` / first candidate straight from the unified
        user-data store — same source of truth, no probing.
        """
        if self._endpoint_resolver is not None:
            try:
                return self._endpoint_resolver()
            except Exception as e:  # noqa: BLE001 — resolver must never kill a cycle
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
        spawned — any momentary overlap is harmless because run_cycle() is
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
        """Signal the polling loop to stop (idempotent; does not join — the
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
            except Exception as e:  # noqa: BLE001 — the loop must never die
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

        Returns { ok, processed, submitted, released, errors:[str] } — the
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
                    f"circuit open — backend returned HTTP 5xx "
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
            # versa) — these are two independent parallel request streams. Each
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
            tts_thread.join()

            for sub in (cover_result, tts_result):
                result["processed"] += sub["processed"]
                result["submitted"] += sub["submitted"]
                result["released"] += sub["released"]
                result["errors"].extend(sub["errors"])
                if not sub["ok"]:
                    result["ok"] = False
        return result

    def _run_track(self, base: str, items: List[Dict[str, Any]],
                   result: Dict[str, Any]) -> None:
        """Process one track's claimed items sequentially into ``result``.

        Cover and TTS tracks call this on SEPARATE threads (see run_cycle) so the
        slow, lock-serialized TTS engine never blocks fast cover generation.
        """
        for item in items:
            item_type = item.get("type")
            item_id = item.get("id")
            result["processed"] += 1
            try:
                if item_type == "cover":
                    self._handle_cover(base, item, result)
                elif item_type == "tts":
                    self._handle_tts(base, item, result)
                else:
                    self._release(base, str(item_type), item_id,
                                  f"unsupported assist item type '{item_type}'", result)
            except Exception as e:  # noqa: BLE001 — release instead of stranding the lease
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
        except Exception as e:  # noqa: BLE001 — network failure, not a 5xx
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
        data = resp.json() or {}
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

        # 4xx — a contract-level rejection; release so the item is not stranded.
        self._release(base, str(item_type), item_id,
                      f"submit rejected (HTTP {resp.status_code})", result)
        return False

    def _release(self, base: str, item_type: str, item_id: Any,
                 error: str, result: Dict[str, Any]) -> None:
        """POST /assist/release for one failed item (best-effort: a lost
        release just means the 60-minute lease expires server-side)."""
        with self._state_lock:
            self._counters["failures"] += 1
            self._last_error = f"{item_type}#{item_id}: {error}"
        result["errors"].append(f"{item_type}#{item_id}: {error}")
        ColorPrint.yellow(f"[AssistWorker] Releasing {item_type}#{item_id}: {error}")
        requests = get_third_package_requests()
        try:
            resp = requests.post(
                f"{base}{ASSIST_API_PREFIX}/release",
                json={"type": item_type, "ids": [item_id],
                      "error": error[:500], "claimer": self.claimer},
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

    # -------------------- item handlers --------------------

    def _handle_cover(self, base: str, item: Dict[str, Any], result: Dict[str, Any]) -> None:
        """cover item: payload {name, prompt, size:'WxH', filename} -> image."""
        item_id = item.get("id")
        payload = item.get("payload") or {}
        if self._image_generator is None:
            self._release(base, "cover", item_id,
                          "image generator not wired (app layer did not configure pyctl.ai)",
                          result)
            return
        prompt = (payload.get("prompt") or "").strip()
        if not prompt:
            name = (payload.get("name") or "").strip()
            if not name:
                self._release(base, "cover", item_id, "empty cover prompt", result)
                return
            prompt = f"Book cover illustration for '{name}'"
        out = self._image_generator(
            prompt=prompt,
            size=_size_to_aspect(payload.get("size")),
            source="assist-cover",
        )
        if out.get("success") and out.get("image_base64"):
            self._submit(base, {
                "type": "cover",
                "id": item_id,
                "image_base64": out["image_base64"],
                "mime": out.get("mime") or "image/png",
                "claimer": self.claimer,
            }, result)
        else:
            self._release(base, "cover", item_id,
                          out.get("error") or "image generation failed", result)

    def _handle_tts(self, base: str, item: Dict[str, Any], result: Dict[str, Any]) -> None:
        """tts item: payload {text, language, voice_type, speed,
        audio_relative_path} -> MP3 via the TTS orchestrator.

        The Laravel contract requires MP3 (>=100 bytes). The orchestrator's
        engines all target an .mp3 output, but a misbehaving engine that emits
        WAV/empty bytes is caught by the magic-byte sniff and RELEASED with a
        clear 'produced non-mp3' error — never submitted as invalid audio.
        (voice_type is informational: the orchestrator picks its voice from
        ``language``; the engine that produced the audio is reported back as
        ``voice``.)
        """
        item_id = item.get("id")
        payload = item.get("payload") or {}
        text = (payload.get("text") or "").strip()
        if not text:
            self._release(base, "tts", item_id, "empty tts text", result)
            return
        language = (payload.get("language") or "en").strip() or "en"
        rate = _speed_to_rate(payload.get("speed"))

        fd, tmp_path = tempfile.mkstemp(prefix="assist_tts_", suffix=".mp3")
        os.close(fd)
        tmp = Path(tmp_path)
        try:
            synth = tts_orchestrator.synthesize(text, language, tmp, rate=rate)
            if not synth.get("success"):
                self._release(base, "tts", item_id,
                              synth.get("error") or "tts synthesis failed", result)
                return
            engine = synth.get("engine") or "unknown"
            audio = tmp.read_bytes() if tmp.exists() else b""
            if len(audio) < 100 or not _looks_like_mp3(audio):
                self._release(
                    base, "tts", item_id,
                    f"engine '{engine}' produced non-mp3 audio "
                    f"({len(audio)} bytes) — not submitting invalid bytes", result)
                return
            self._submit(base, {
                "type": "tts",
                "id": item_id,
                "audio_base64": base64.b64encode(audio).decode("ascii"),
                "mime": "audio/mpeg",
                "voice": engine,
                "claimer": self.claimer,
            }, result)
        finally:
            try:
                tmp.unlink()
            except OSError:
                pass

    # -------------------- circuit breaker --------------------

    def _note_server_ok(self) -> None:
        """Any accepted 2xx — backend write path works; reset the breaker."""
        if self._server_5xx_streak or self._circuit_open_until:
            ColorPrint.green("[AssistWorker] Backend answered OK — circuit reset")
        self._server_5xx_streak = 0
        self._circuit_open_until = 0.0

    def _note_server_error(self, note: str) -> None:
        """A server-side HTTP 5xx give-up; open the breaker at the threshold."""
        self._server_5xx_streak += 1
        self._record_error(note)
        ColorPrint.yellow(
            f"[AssistWorker] Server error ({note}) — "
            f"streak {self._server_5xx_streak}/{self.CIRCUIT_FAIL_THRESHOLD}")
        if (self._server_5xx_streak >= self.CIRCUIT_FAIL_THRESHOLD
                and not self._circuit_is_open()):
            self._circuit_open_until = time.monotonic() + self.CIRCUIT_COOLDOWN_SECONDS
            ColorPrint.red(
                f"[AssistWorker] Backend rejecting requests "
                f"({self._server_5xx_streak}x HTTP 5xx) — circuit OPEN for "
                f"{self.CIRCUIT_COOLDOWN_SECONDS}s (no claims until cooldown)")

    def _circuit_is_open(self) -> bool:
        """True while the cooldown is active (skip claiming new work)."""
        return time.monotonic() < self._circuit_open_until

    def _circuit_cooldown_remaining(self) -> int:
        """Seconds left on the open circuit (0 when closed)."""
        return max(0, int(self._circuit_open_until - time.monotonic()))

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
