# -*- coding: utf-8 -*-
"""
Translation Worker Service

A pycore worker that integrates with the Laravel backend's generic "worker task"
API. It registers itself as a worker that can handle ``remote_translation`` tasks,
periodically pulls pending translation tasks, translates the words with pycore's
existing async ``GoogleTranslator`` (see pyutils/translator/google_translator.py),
and posts the results back to Laravel.

------------------------------------------------------------------------------
Shared contract (frontend <-> Laravel backend <-> this pycore worker)
------------------------------------------------------------------------------
Laravel exposes (localhost, no auth):
  POST {base}/api/worker/register
       { worker_id, worker_name, processor_types:["remote_translation"],
         hostname, platform }
  POST {base}/api/worker/heartbeat   { worker_id }
  GET  {base}/api/worker/tasks/pull?worker_id=...
       -> { tasks:[ { task_id, app_name, task_type, execution_type,
                      payload, timeout_seconds, priority } ] }
  POST {base}/api/worker/tasks/result
       { task_id, worker_id, status:"completed"|"failed", progress?, result?, error? }

A translation task:
  task_type      = "word_translation"
  execution_type = "remote_translation"
  payload        = { words:[str], language:<source e.g. "en">,
                     target_language:<e.g. "zh">, word_count:int }

Result on success:
  result = { translations:[ {word, translation} ],
             target_language, provider:"google" }
  status = "completed"

Each ``payload.words`` entry is translated to ``payload.target_language``; the
source language is auto-detected (we pass src="auto" to GoogleTranslator).
------------------------------------------------------------------------------

Architecture (matches the existing tts_queue_poller_service.py pattern):
  - Singleton service registered as a PyHeartbeat callback (interval ~12s).
  - The heartbeat callback (poll_once) MUST stay light: it only registers (once),
    sends a heartbeat, pulls tasks, and hands the heavy translate+post work to a
    background thread via the pyctl desktop TaskManager (get_task_manager().
    execute_task) — the same mechanism VideoExtractController uses. This keeps the
    1s heartbeat thread responsive.
  - Enable/disable at runtime via the heartbeat management router:
      POST /api/heartbeat/enable/translation_worker
      POST /api/heartbeat/disable/translation_worker

------------------------------------------------------------------------------
Multi-pycore coordination model (N workers, no duplicate work)
------------------------------------------------------------------------------
Several pycore instances can run this worker against the SAME Laravel safely.
De-duplication has two complementary layers:

  (a) Laravel ATOMIC TASK CLAIM — one task → one worker. /api/worker/tasks/pull
      hands a given task to exactly one worker (atomic claim on the Laravel side),
      so two workers never process the SAME TASK. This is the primary guarantee.

  (b) WS WORD-COMPLETION BROADCAST (Phase C, this file's `mark_words_done` +
      `partition_words`). The same WORD can appear across DIFFERENT tasks issued to
      DIFFERENT pycores. When any pycore finishes a word, Laravel broadcasts
      `word.translated` over Reverb; TranslationWsClient feeds it into this worker's
      short-TTL "recently completed words" set (keyed by source+target language).
      Before translating, this worker SKIPS words already in that set and reports
      them as already-done in its result, so Laravel's write-back stays idempotent.
      This realizes "if one pycore succeeds, the others skip that word."

Each pycore has a stable, hostname-based `worker_id` (see `_build_worker_id`), so
Laravel can attribute claims/heartbeats per instance. Running N pycores therefore
scales throughput without double-translating a task (a) or a word (b).

Logging: uses pycore.pyfoundations.color_print.ColorPrint exclusively (the pycore
logging rule). Networking uses the lazily-imported third-party ``requests`` via
pycore.pyfoundations.third_party.get_third_package_requests (never a bare import).
This module never imports rpc_v2 / callmodule routers (no upward layer import).
"""

import asyncio
import base64
import heapq
import os
import platform
import random
import socket
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

# ColorPrint is the only allowed logger in pycore processors/services.
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
# requests is a third-party dep — always obtained through the lazy accessor.
from pycore.pyfoundations.third_party import get_third_package_requests
# Internal imports at file top (PYTHON_PYCORE.md §1.4). Both modules degrade
# gracefully themselves: google_translator guards googletrans with its own
# top-level try (GOOGLETRANS_AVAILABLE), task_manager is stdlib-only.
from pycore.pyutils.translator.google_translator import GoogleTranslator
from pycore.pyutils.translator.dictionary import get_dictionary_service
from pycore.pyctl.desktop.task_manager import get_task_manager
# Real (non-synthetic) pronunciation source chain, tried before TTS synthesis
# in the word_audio lane — see _process_audio_task.
from pycore.pyutils.external_apis.word_audio_client import find_pronunciation


# ============================================================
# Provider scaffold: Bing via Selenium (product decision — TODO)
# ============================================================

class BingSeleniumTranslator:
    """
    Bing translator provider — SELENIUM BROWSER-AUTOMATION SCAFFOLD (NOT IMPLEMENTED).

    Product decision: keep Bing as a documented, slot-in-able provider while Google
    stays the active default. This class intentionally has the intended public
    interface but a NOT-IMPLEMENTED body so it can be wired in later without any
    heavy selenium dependency on the active (Google) path.

    Why a browser is needed for server-side Bing:
        Bing Translator (https://www.bing.com/translator) has no stable, free,
        token-less REST endpoint equivalent to translate.googleapis.com. Its web
        client mints a short-lived per-session token ("IG"/"IID" + an anti-abuse
        token fetched from the page) and posts to an internal ttranslatev3 endpoint
        with those values plus the right cookies/referer. Reproducing that purely
        with requests is brittle and breaks whenever Bing rotates the token flow.
        Driving a real (headless) browser sidesteps that: the page itself acquires
        the token and performs the request, so we just read the translated DOM.

    Intended approach (when implemented):
        1. Lazy-create a headless Selenium WebDriver (Chrome/Edge) ONLY when this
           provider is selected — import selenium inside __init__/translate so the
           Google path never imports it. Do NOT add selenium to the active
           requirements; document it as an optional extra for the Bing path.
        2. Navigate to https://www.bing.com/translator?from=auto&to=<target>.
        3. Type/paste ``text`` into the source textarea (id="tta_input"), wait for
           the output textarea (id="tta_output") to populate (WebDriverWait on a
           non-empty value), then read the translated text back.
        4. Reuse one driver across calls (a pool/singleton) for throughput; add
           ret/back-off + a hard timeout; quit() the driver on shutdown.
        5. Map output to the same result shape the worker expects so it can be
           swapped for GoogleTranslator transparently.

    Where to plug it in:
        TranslationWorkerService._translate_words() selects the provider. To enable
        Bing, branch on a provider/config flag there, instantiate this class, and
        call translate(word, target) per word (or add a batch method). The worker's
        result ``provider`` field would then become "bing".
    """

    PROVIDER_NAME = "bing"

    def __init__(self, headless: bool = True):
        # No selenium import here on purpose — this is a scaffold only.
        self.headless = headless

    def translate(self, text: str, target: str, source: str = "auto") -> str:
        """Translate a single string to ``target`` via Bing (browser automation)."""
        raise NotImplementedError(
            "Bing via Selenium — TODO. This provider is a documented scaffold only; "
            "the worker uses GoogleTranslator (provider='google') by default. See the "
            "class docstring for the intended selenium-webdriver implementation."
        )

    def translate_batch(self, texts: List[str], target: str, source: str = "auto") -> List[str]:
        """Batch variant — TODO (loop translate() or one page + multiple inputs)."""
        raise NotImplementedError("Bing via Selenium — TODO (batch).")


# ============================================================
# Translation Worker Service (Singleton)
# ============================================================

class TranslationWorkerService:
    """
    Translation worker (singleton) that drives the Laravel worker-task pipeline.

    Lifecycle:
      - First poll (or get_*): registers with Laravel (/api/worker/register) using a
        stable hostname-based worker_id. Registration is retried on later polls if
        it has not yet succeeded (Laravel may not be up at start).
      - Each heartbeat tick (when enabled): poll_once() sends a heartbeat, pulls
        tasks, and dispatches each task to a TaskManager background thread so the
        actual translation + result POST never blocks the heartbeat thread.
    """

    _instance: Optional["TranslationWorkerService"] = None
    _instance_lock = threading.Lock()

    # ---- Execution-type lanes (must equal GlobalTask::EXECUTION_TYPES) ----
    # The shared interactive fast lane both pycore and chrome register for.
    TRANSLATION_FAST_PROCESSOR_TYPE = "remote_fast"
    # The legacy dedicated translation lane (still advertised for back-compat).
    TRANSLATION_PROCESSOR_TYPE = "remote_translation"
    # Local-TTS audio assist lane (word_audio rides this).
    AUDIO_EXECUTION_TYPE = "remote_audio"
    # Dedicated pycore-only retrieval/generation lanes (knob-gated, see config).
    SUBTITLE_EXECUTION_TYPE = "remote_subtitle"
    POSTER_EXECUTION_TYPE = "remote_poster"
    SENTENCE_AUDIO_EXECUTION_TYPE = "remote_sentence_audio"

    # task_type tags carried in payloads on these lanes.
    AUDIO_TASK_TYPE = "word_audio"
    # Word-image task_type. It rides the SHARED fast lane (remote_fast) with
    # capability='image' (NO dedicated execution_type) — claim is narrowed purely
    # by the 'image' capability, mirroring how ai_translate rides the fast lane.
    IMAGE_TASK_TYPE = "word_media"

    # Base processor types always advertised (fast + legacy translation). The
    # dedicated lanes are appended live by _effective_processor_types() when their
    # Config kill-switch AND layered user-data/assist toggle are on.
    PROCESSOR_TYPES = [TRANSLATION_FAST_PROCESSOR_TYPE, TRANSLATION_PROCESSOR_TYPE]

    DEFAULT_PROVIDER = "google"

    # Fast-drain burst cadence (overridden from Config at init).
    TRANSLATION_FAST_POLL_INTERVAL = 0.5
    TRANSLATION_FAST_DRAIN_WINDOW = 4.0
    TRANSLATION_FAST_POLL_JITTER = 0.25

    def __new__(cls, *args, **kwargs):
        """Singleton — one worker per process."""
        if cls._instance is None:
            with cls._instance_lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, laravel_api_url: str = "http://127.0.0.1:9000"):
        """
        Initialize the worker (idempotent — safe to call repeatedly).

        Args:
            laravel_api_url: Laravel worker-API base URL (no trailing slash).
        """
        if getattr(self, "_initialized", False):
            return

        # Candidate Laravel base URLs, tried in order until one answers. The
        # configured URL is preferred; the rest are sensible local/LAN fallbacks
        # (mirrors the frontend's endpoint-discovery list) so the worker keeps
        # working if Laravel moves host/port. Pinned to the first reachable one.
        self._candidates = self._build_candidates(laravel_api_url)
        self.api_url = self._candidates[0]
        self.worker_id = self._build_worker_id()
        self.worker_name = f"pycore-translation-{self.worker_id}"
        self.hostname = socket.gethostname()
        self.platform = platform.platform()

        self._registered = False
        # Connection-failure bookkeeping so we emit ONE clear "no reachable
        # Laravel" hint instead of a stack trace on every heartbeat tick.
        self._conn_fail_streak = 0
        self._conn_unreachable_warned = False
        # Backend circuit breaker state (see CIRCUIT_* constants). Streak counts
        # CONSECUTIVE server-side (HTTP 5xx) result-POST give-ups; the circuit is
        # open while monotonic time() < _circuit_open_until.
        self._result_5xx_streak = 0
        self._circuit_open_until = 0.0
        self._circuit_warned = False
        # Prompt-translation AI pause: when every AI provider is exhausted we stop
        # producing translations until monotonic time() passes this deadline.
        self._prompt_ai_pause_until = 0.0
        # Guards against dispatching the same task to two background threads while
        # an earlier dispatch is still in flight.
        self._inflight: set = set()
        self._inflight_lock = threading.Lock()
        self._http_timeout = 8  # seconds for register/heartbeat/pull/result calls

        # ---- Multi-pycore WORD-LEVEL coordination (Phase C) ----
        # Short-TTL set of words ALREADY translated by SOME pycore, keyed by
        # (source_language, target_language, word). Fed by TranslationWsClient from
        # Laravel's `word.translated` Reverb broadcast. Before translating, this
        # worker skips any word present here (another pycore did it) so the same
        # word is not re-translated across different tasks/pycores. See the module
        # docstring's coordination model. Maps key -> monotonic expiry time.
        self._done_words: Dict[Tuple[str, str, str], float] = {}
        self._done_words_lock = threading.Lock()
        # Default TTL for a done-word entry (seconds); the WS client may override
        # per-call. Kept here so the worker is self-contained if used standalone.
        self._done_word_ttl = 120

        # ---- Unified-task fast lane (2026-06-21) ----
        # Last advertised processor-type set; re-register fires when it changes
        # (live toggle of a dedicated lane).
        self._advertised_processor_types: Optional[List[str]] = None
        # Per-backend priority heap of CLAIMED-but-unprocessed tasks. heapq is a
        # min-heap; we push (-priority, seq, task) so the highest priority drains
        # first. Keyed by api_url so distinct backends never interleave.
        self._task_heaps: Dict[str, List[Any]] = {}
        self._heap_seq = 0
        self._heap_lock = threading.Lock()
        # Latest fast/urgent counters parsed from pull/heartbeat responses.
        self._pending_fast = 0
        self._pending_urgent = 0
        # Fast-drain burst guard so only ONE burst thread runs at a time.
        self._fast_drain_active = False
        self._fast_drain_lock = threading.Lock()
        # Pull fast-poll knobs from Config (fall back to class defaults).
        try:
            from pycore.callmodule.callmodule_config import Config as _Cfg
            self.TRANSLATION_FAST_POLL_INTERVAL = float(
                getattr(_Cfg, "TRANSLATION_FAST_POLL_INTERVAL",
                        self.TRANSLATION_FAST_POLL_INTERVAL))
            self.TRANSLATION_FAST_DRAIN_WINDOW = float(
                getattr(_Cfg, "TRANSLATION_FAST_DRAIN_WINDOW",
                        self.TRANSLATION_FAST_DRAIN_WINDOW))
            self.TRANSLATION_FAST_POLL_JITTER = float(
                getattr(_Cfg, "TRANSLATION_FAST_POLL_JITTER",
                        self.TRANSLATION_FAST_POLL_JITTER))
        except Exception:
            pass

        self._initialized = True
        ColorPrint.green(
            f"[TranslationWorker] Service initialized "
            f"(worker_id={self.worker_id}, candidates={self._candidates})"
        )

    # -------------------- identity --------------------

    @staticmethod
    def _build_worker_id() -> str:
        """
        Stable, hostname-based worker id (same across restarts on a host).

        MULTI-INSTANCE NOTE: Laravel keys claims/heartbeats by worker_id, so two
        pycore processes on the SAME host must not share one. Atomic task claim
        still prevents double work either way, but a shared id corrupts per-worker
        accounting (current_task_id, completed/failed counters) and offline
        detection. When running more than one pycore per host, set
        PYCORE_WORKER_INSTANCE to a stable per-instance tag (e.g. its rpc port);
        it is appended to the id. Single-instance hosts need no env and keep the
        old stable id.
        """
        host = socket.gethostname() or "host"
        safe = "".join(c if (c.isalnum() or c in "-_") else "-" for c in host).lower()
        instance = (os.getenv("PYCORE_WORKER_INSTANCE") or "").strip()
        if instance:
            safe_instance = "".join(
                c if (c.isalnum() or c in "-_") else "-" for c in instance
            ).lower()
            return f"pycore-translate-{safe}-{safe_instance}"
        return f"pycore-translate-{safe}"

    @staticmethod
    def _local_ipv4s() -> List[str]:
        """Best-effort list of this machine's non-loopback IPv4 addresses, used to
        decide whether a hardcoded LAN fallback is reachable (same subnet) before
        adding it as a candidate. Never raises."""
        ips = set()
        try:
            for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
                addr = (info[4] or [None])[0]
                if addr and not addr.startswith("127."):
                    ips.add(addr)
        except Exception:
            pass
        return sorted(ips)

    @staticmethod
    def _host_of(url: str) -> str:
        """Bare host (no scheme / port / path) from a URL."""
        host = (url or "").split("://", 1)[-1].split("/", 1)[0]
        return host.rsplit(":", 1)[0] if ":" in host else host

    @classmethod
    def _on_local_subnet(cls, url: str, local_ips: List[str]) -> bool:
        """True when the URL's IPv4 host shares a /24 with one of this machine's
        local addresses — i.e. the LAN fallback's environment actually exists."""
        parts = cls._host_of(url).split(".")
        if len(parts) != 4 or not all(p.isdigit() for p in parts):
            return False
        prefix = ".".join(parts[:3]) + "."
        return any(ip.startswith(prefix) for ip in local_ips)

    @classmethod
    def _build_candidates(cls, primary: str) -> List[str]:
        """
        Ordered, de-duplicated list of Laravel base URLs to try. The configured
        ``primary`` is first, then loopback defaults. The hardcoded LAN fallbacks
        are added ONLY when this machine actually sits on their subnet — otherwise
        they are unreachable from here and just stall the health sweep (SYN_SENT,
        timing out), so they are skipped.
        """
        local_defaults = [
            "http://127.0.0.1:9000",
            "http://localhost:9000",
        ]
        lan_fallbacks = [
            "http://192.168.50.3:9000",
            "http://192.168.50.2:9000",
        ]
        local_ips = cls._local_ipv4s()
        reachable_lan = [u for u in lan_fallbacks if cls._on_local_subnet(u, local_ips)]
        ordered: List[str] = []
        for url in [primary, *local_defaults, *reachable_lan]:
            u = (url or "").rstrip("/")
            if u and u not in ordered:
                ordered.append(u)
        return ordered

    # -------------------- HTTP helpers --------------------

    def _requests(self):
        """Lazily obtain the third-party requests module (pycore rule)."""
        return get_third_package_requests()

    @staticmethod
    def _short_err(exc: Exception) -> str:
        """
        Condense a noisy requests/urllib3 exception into a one-line reason, so we
        never dump a multi-line HTTPConnectionPool stack into the heartbeat log.
        """
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

    # -------------------- word-level coordination (multi-pycore) --------------------

    @staticmethod
    def _word_key(word: str, source_language: str, target_language: str) -> Tuple[str, str, str]:
        """Normalized key for the done-words set: (src, dest, word) all lowercased."""
        return (
            (source_language or "auto").lower(),
            (target_language or "").lower(),
            (word or "").strip().lower(),
        )

    def mark_words_done(
        self,
        words: List[str],
        source_language: str,
        target_language: str,
        ttl_seconds: Optional[int] = None,
    ) -> None:
        """
        Record words as ALREADY translated (by this or another pycore) so this
        worker skips them for a short TTL. Called by TranslationWsClient when a
        `word.translated` Reverb event arrives, AND locally after this worker
        finishes a task (so its own just-done words also dedup future tasks).

        Thread-safe; expired entries are pruned opportunistically.
        """
        if not words:
            return
        ttl = self._done_word_ttl if ttl_seconds is None else max(1, int(ttl_seconds))
        now = time.monotonic()
        expiry = now + ttl
        with self._done_words_lock:
            for w in words:
                if w:
                    self._done_words[self._word_key(w, source_language, target_language)] = expiry
            # Opportunistic prune so the set never grows unbounded.
            if len(self._done_words) > 4096:
                self._done_words = {k: e for k, e in self._done_words.items() if e > now}

    def partition_words(
        self,
        words: List[str],
        source_language: str,
        target_language: str,
    ) -> Tuple[List[str], List[str]]:
        """
        Split ``words`` into (to_translate, already_done) using the recently-
        completed-words set. ``already_done`` are words another pycore finished
        within the TTL — this worker will skip translating them and report them as
        already-done so Laravel's write-back is idempotent.
        """
        if not words:
            return [], []
        now = time.monotonic()
        to_translate: List[str] = []
        already_done: List[str] = []
        with self._done_words_lock:
            for w in words:
                exp = self._done_words.get(self._word_key(w, source_language, target_language))
                if exp and exp > now:
                    already_done.append(w)
                else:
                    to_translate.append(w)
        return to_translate, already_done

    def done_words_count(self) -> int:
        """Number of live (non-expired) entries in the done-words set."""
        now = time.monotonic()
        with self._done_words_lock:
            return sum(1 for e in self._done_words.values() if e > now)

    # -------------------- capability / lane gating (live toggles) --------------------

    @staticmethod
    def _cfg():
        """Lazily fetch the callmodule Config (kill-switch knobs)."""
        from pycore.callmodule.callmodule_config import Config
        return Config

    def _ai_translate_enabled(self) -> bool:
        """ai_translate capability: hard knob AND the assist ai_translate toggle."""
        try:
            if not bool(getattr(self._cfg(), "AI_TRANSLATE_ENABLED", True)):
                return False
        except Exception:
            pass
        try:
            from pycore.pyctl.assist import assist_capability_enabled
            return assist_capability_enabled("ai_translate", True)
        except Exception:
            return True

    def _audio_enabled(self) -> bool:
        """Audio (word TTS) lane: the assist 'tts' capability (master enabled AND
        capabilities.tts). While the assist_laravel section is absent the legacy
        default (advertise) applies."""
        try:
            from pycore.pyctl.assist import assist_capability_enabled
            return assist_capability_enabled("tts", True)
        except Exception:
            return True

    def _subtitle_enabled(self) -> bool:
        """Subtitle lane: hard knob AND the assist subtitle toggle."""
        try:
            if not bool(getattr(self._cfg(), "SUBTITLE_SEARCH_WORKER_ENABLED", True)):
                return False
        except Exception:
            pass
        try:
            from pycore.pyctl.assist import assist_capability_enabled
            return assist_capability_enabled("subtitle", True)
        except Exception:
            return True

    def _poster_enabled(self) -> bool:
        """Poster lane: hard knob AND the live media_sync.fetch_poster toggle AND the
        assist poster toggle — unified so the Queue Center poster switch is
        authoritative (was decoupled from the assist-queue poster claim)."""
        try:
            if not bool(getattr(self._cfg(), "POSTER_WORKER_ENABLED", True)):
                return False
        except Exception:
            pass
        try:
            from pycore.pyfoundations.system_paths import get_user_data_store
            section = get_user_data_store().get_section("media_sync") or {}
            if "fetch_poster" in section and not bool(section.get("fetch_poster")):
                return False
        except Exception:
            pass
        try:
            from pycore.pyctl.assist import assist_capability_enabled
            return assist_capability_enabled("poster", True)
        except Exception:
            return True

    def _sentence_audio_enabled(self) -> bool:
        """Sentence-audio lane: hard knob AND the assist sentence_audio toggle —
        now INDEPENDENT of the word-tts toggle (was a phantom alias of caps.tts)."""
        try:
            if not bool(getattr(self._cfg(), "SENTENCE_AUDIO_WORKER_ENABLED", True)):
                return False
        except Exception:
            pass
        try:
            from pycore.pyctl.assist import assist_capability_enabled
            return assist_capability_enabled("sentence_audio", True)
        except Exception:
            return True

    def _image_enabled(self) -> bool:
        """'image' capability (word media): hard knob AND the assist image toggle.

        Backed by the unified AI gateway (pyctl.ai.generate_image). NOT a fake
        capability: if no image provider is configured at runtime, generate_image
        returns success=False and the handler reports the task 'failed' so Laravel
        re-routes/re-pends it — never stranded.
        """
        try:
            if not bool(getattr(self._cfg(), "WORD_IMAGE_WORKER_ENABLED", True)):
                return False
        except Exception:
            pass
        try:
            from pycore.pyctl.assist import assist_capability_enabled
            return assist_capability_enabled("image", True)
        except Exception:
            return True

    def _effective_capabilities(self) -> List[str]:
        """Capabilities advertised on register AND status: audio,translate (+ai_translate,+image)."""
        caps = ["audio", "translate"]
        if self._ai_translate_enabled():
            caps.append("ai_translate")
        if self._image_enabled():
            caps.append("image")
        return caps

    def _effective_processor_types(self) -> List[str]:
        """The lane set advertised this tick.

        Always include the fast lane + legacy translation lane; append each
        dedicated lane only while its enable gate is live-on. Re-register fires when
        this set changes (handled in poll_once).
        """
        types = [self.TRANSLATION_FAST_PROCESSOR_TYPE, self.TRANSLATION_PROCESSOR_TYPE]
        if self._audio_enabled():
            types.append(self.AUDIO_EXECUTION_TYPE)
        if self._subtitle_enabled():
            types.append(self.SUBTITLE_EXECUTION_TYPE)
        if self._poster_enabled():
            types.append(self.POSTER_EXECUTION_TYPE)
        if self._sentence_audio_enabled():
            types.append(self.SENTENCE_AUDIO_EXECUTION_TYPE)
        # De-dup preserving order.
        seen: set = set()
        ordered: List[str] = []
        for t in types:
            if t not in seen:
                seen.add(t)
                ordered.append(t)
        return ordered

    # -------------------- Laravel worker API --------------------

    def _register(self) -> bool:
        """
        Register this worker with Laravel, discovering a reachable backend across
        the candidate URLs. The first candidate that answers is pinned as
        ``self.api_url`` for subsequent heartbeat/pull/result calls.

        Messaging: on success (or recovery) we log once. When NONE of the
        candidates are reachable we emit a single concise hint — "no reachable
        Laravel backend" with the tried list — and then stay quiet until the
        situation changes, instead of dumping a connection stack every tick.
        """
        if self._registered:
            return True

        requests = self._requests()
        last_reason = ""
        processor_types = self._effective_processor_types()
        capabilities = self._effective_capabilities()
        for base in self._candidates:
            try:
                resp = requests.post(
                    f"{base}/api/worker/register",
                    json={
                        "worker_id": self.worker_id,
                        "worker_name": self.worker_name,
                        "processor_types": processor_types,
                        "capabilities": capabilities,
                        "hostname": self.hostname,
                        "platform": self.platform,
                    },
                    timeout=self._http_timeout,
                )
                if resp.status_code in (200, 201):
                    self.api_url = base
                    self._registered = True
                    self._advertised_processor_types = list(processor_types)
                    if self._conn_unreachable_warned or self._conn_fail_streak:
                        ColorPrint.green(
                            f"[TranslationWorker] Reconnected to Laravel at {base} "
                            f"(after {self._conn_fail_streak} failed attempt(s))"
                        )
                    else:
                        ColorPrint.green(f"[TranslationWorker] Registered with Laravel at {base}")
                    self._conn_fail_streak = 0
                    self._conn_unreachable_warned = False
                    return True
                # Reachable but refused registration — report once, keep trying others.
                last_reason = f"HTTP {resp.status_code} from {base}"
            except Exception as e:
                last_reason = f"{base}: {self._short_err(e)}"
                continue

        # No candidate accepted us.
        self._conn_fail_streak += 1
        if not self._conn_unreachable_warned:
            self._conn_unreachable_warned = True
            ColorPrint.yellow(
                "[TranslationWorker] No reachable Laravel backend — could not connect to any of "
                f"{self._candidates}. Last: {last_reason}. Will keep retrying quietly "
                "(set LARAVEL_WORKER_API_URL to point at your Laravel :9000)."
            )
        return False

    def _note_fast_signals(self, body: Optional[Dict[str, Any]]) -> None:
        """Record pending_fast / pending_urgent counters from a pull/heartbeat body.

        These steer the jittered fast-drain burst (pending_fast>0) and surface in
        get_queue_status() for routers/local.
        """
        if not isinstance(body, dict):
            return
        try:
            self._pending_fast = int(body.get("pending_fast") or 0)
        except (TypeError, ValueError):
            self._pending_fast = 0
        try:
            self._pending_urgent = int(body.get("pending_urgent") or 0)
        except (TypeError, ValueError):
            self._pending_urgent = 0

    def _heartbeat(self) -> None:
        """Send a worker heartbeat (best-effort; a dropped connection forces
        re-discovery on the next tick rather than spamming the log).

        The heartbeat also carries the live capabilities (so Laravel keeps the
        worker's advertised set fresh) and its response carries pending_fast /
        pending_urgent which we fold into the fast-drain signal.
        """
        try:
            requests = self._requests()
            resp = requests.post(
                f"{self.api_url}/api/worker/heartbeat",
                json={
                    "worker_id": self.worker_id,
                    "capabilities": self._effective_capabilities(),
                },
                timeout=self._http_timeout,
            )
            if resp is not None and getattr(resp, "status_code", 0) == 200:
                data = resp.json() or {}
                body = data.get("data") if isinstance(data.get("data"), dict) else data
                self._note_fast_signals(body)
        except Exception as e:
            # Laravel likely went away — drop registration so _register re-discovers
            # (and emits the single "no reachable Laravel" hint) next tick.
            self._registered = False
            ColorPrint.yellow(f"[TranslationWorker] Heartbeat failed ({self._short_err(e)}); will re-discover")

    def _pull_tasks(self, base: Optional[str] = None, wait: int = 0) -> List[Dict[str, Any]]:
        """GET pending tasks for this worker. Returns [] on any error.

        ``wait`` MUST be sent (0 = immediate return; if omitted Laravel long-polls
        ~20s while the client's 8s HTTP timeout fires first). The fast-drain burst and
        the heartbeat tick both call this with wait=0 so a pull never blocks the loop.

        PRIORITY-SYNC NOTE: Laravel returns tasks in ``priority desc`` order, but the
        unified client ALSO folds every claimed task into a per-backend priority heap
        (so a bumped task drains first even if it arrived in an earlier pull). The pull
        response's pending_fast / pending_urgent counters are recorded to arm the
        jittered fast-drain burst, and the QueueMonitorService still surfaces bumps to
        the UI (`recently_bumped`). No task-processing logic is duplicated.

        Hardening (2026-06-22): only a real ConnectionError de-registers (forces
        re-discovery). A transient Timeout / other error just logs and stays
        registered — the next tick retries against the same pinned backend.
        """
        base = base or self.api_url
        try:
            requests = self._requests()
            resp = requests.get(
                f"{base}/api/worker/tasks/pull",
                params={"worker_id": self.worker_id, "wait": wait},
                timeout=self._http_timeout,
            )
            if resp.status_code == 200:
                data = resp.json() or {}
                # Worker API wraps the payload: { success, data:{ count, tasks }, ... }.
                # Accept both the wrapped and a bare { tasks } shape.
                body = data.get("data") if isinstance(data.get("data"), dict) else data
                self._note_fast_signals(body)
                tasks = (body or {}).get("tasks", []) or []
                return tasks
            ColorPrint.yellow(f"[TranslationWorker] Pull returned HTTP {resp.status_code}")
        except Exception as e:
            # Distinguish a hard connection failure (backend gone -> re-discover)
            # from a transient blip (timeout / read error -> keep registration).
            conn_error_cls = None
            try:
                conn_error_cls = self._requests().exceptions.ConnectionError
            except Exception:
                conn_error_cls = None
            if conn_error_cls is not None and isinstance(e, conn_error_cls):
                self._registered = False
                ColorPrint.yellow(
                    f"[TranslationWorker] Pull connection failed "
                    f"({self._short_err(e)}); will re-discover")
            else:
                ColorPrint.yellow(
                    f"[TranslationWorker] Pull transient error "
                    f"({self._short_err(e)}); will retry next tick")
        return []

    # Result-POST retry plan: a lost result leaves the task "assigned" on the
    # Laravel side until its timeout release, so transient failures (SQLite
    # "database is locked" -> HTTP 500, brief network blips) are worth retrying
    # here. 4xx responses are NOT retried: 409 means the task was reassigned /
    # not ours (another worker owns it now), other 4xx are contract errors a
    # retry cannot fix.
    RESULT_POST_ATTEMPTS = 3
    RESULT_POST_BACKOFF_SECONDS = (0.5, 1.5)

    # ---- Backend circuit breaker ----
    # A persistent SERVER-SIDE result-POST failure (HTTP 5xx every attempt) means
    # the backend cannot accept results AT ALL — e.g. a missing/broken table after
    # a half-finished DB migration. Without a breaker the worker keeps pulling and
    # re-translating every tick, burning LLM calls and flooding the broken backend
    # for results it can never store (the words never get marked done, so the
    # Laravel scanner re-enqueues them forever — an unbounded spiral that exhausted
    # the box once). After N consecutive server-side give-ups the breaker OPENS:
    # poll_once stops PULLING (still heartbeats to stay registered) for a cooldown,
    # then probes again. ANY accepted result resets it. 4xx/409 never trip it
    # (those are per-task, not backend-wide).
    CIRCUIT_FAIL_THRESHOLD = 3
    CIRCUIT_COOLDOWN_SECONDS = 120

    def _post_result(
        self,
        task_id: Any,
        status: str,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        progress: Optional[int] = None,
        attempts: Optional[int] = None,
    ) -> bool:
        """
        POST a task result (processing/completed/failed) back to Laravel.

        Retries transient failures (connection errors / HTTP 5xx) a few times
        with a short backoff; gives up on 4xx. Returns True when Laravel
        accepted the result. On final failure the task is NOT lost: Laravel's
        maintenance timer releases it back to pending at timeout_at and another
        worker re-claims it.

        ``attempts`` overrides the retry budget — best-effort progress pings
        pass 1 (a lost ping costs nothing; the next report or the final result
        carries the same information).
        """
        body: Dict[str, Any] = {
            "task_id": task_id,
            "worker_id": self.worker_id,
            "status": status,
        }
        if progress is not None:
            body["progress"] = progress
        if result is not None:
            body["result"] = result
        if error is not None:
            body["error"] = error

        requests = self._requests()
        last_note = ""
        last_was_5xx = False
        max_attempts = self.RESULT_POST_ATTEMPTS if attempts is None else max(1, int(attempts))
        for attempt in range(1, max_attempts + 1):
            try:
                resp = requests.post(
                    f"{self.api_url}/api/worker/tasks/result",
                    json=body,
                    timeout=self._http_timeout,
                )
                if resp.status_code in (200, 201):
                    ColorPrint.green(f"[TranslationWorker] Posted '{status}' for task {task_id}")
                    self._note_result_accepted()
                    return True
                if resp.status_code == 409:
                    # Task reassigned (we lost the claim, e.g. after a timeout
                    # release) — the new owner reports it; do not retry.
                    ColorPrint.yellow(
                        f"[TranslationWorker] Result for task {task_id} rejected (409: "
                        f"task reassigned / not ours) — dropping"
                    )
                    return False
                if 400 <= resp.status_code < 500:
                    ColorPrint.yellow(
                        f"[TranslationWorker] Result POST for task {task_id} -> "
                        f"HTTP {resp.status_code} (not retryable)"
                    )
                    return False
                last_note = f"HTTP {resp.status_code}"
                last_was_5xx = 500 <= resp.status_code < 600
            except Exception as e:
                last_note = self._short_err(e)
                last_was_5xx = False  # transport error, not a backend 5xx

            if attempt < max_attempts:
                delay = self.RESULT_POST_BACKOFF_SECONDS[
                    min(attempt - 1, len(self.RESULT_POST_BACKOFF_SECONDS) - 1)
                ]
                ColorPrint.yellow(
                    f"[TranslationWorker] Result POST for task {task_id} failed "
                    f"({last_note}); retry {attempt}/{max_attempts - 1} "
                    f"in {delay}s"
                )
                time.sleep(delay)

        if max_attempts > 1:
            ColorPrint.red(
                f"[TranslationWorker] Result POST for task {task_id} gave up after "
                f"{max_attempts} attempts ({last_note}); Laravel's timeout "
                f"release will re-queue the task"
            )
        # Only a real budgeted attempt that ended on a backend 5xx counts toward
        # the breaker. Best-effort single-shot pings (attempts=1) and transport
        # errors do not — the latter are already handled by the conn-fail hint.
        if max_attempts > 1 and last_was_5xx:
            self._note_result_server_error()
        return False

    # -------------------- backend circuit breaker --------------------

    def _note_result_accepted(self) -> None:
        """Laravel accepted a result — the backend write path works; reset breaker."""
        if self._result_5xx_streak or self._circuit_open_until:
            ColorPrint.green("[TranslationWorker] Backend accepted a result — circuit reset")
        self._result_5xx_streak = 0
        self._circuit_open_until = 0.0
        self._circuit_warned = False

    def _note_result_server_error(self) -> None:
        """A result POST exhausted its retries on HTTP 5xx; open the breaker at threshold."""
        self._result_5xx_streak += 1
        if self._result_5xx_streak >= self.CIRCUIT_FAIL_THRESHOLD:
            self._circuit_open_until = time.monotonic() + self.CIRCUIT_COOLDOWN_SECONDS
            if not self._circuit_warned:
                ColorPrint.red(
                    f"[TranslationWorker] Backend rejecting results "
                    f"({self._result_5xx_streak}x HTTP 5xx) — opening circuit: pausing "
                    f"task pulls for {self.CIRCUIT_COOLDOWN_SECONDS}s to stop burning "
                    f"translations the backend cannot store. Will probe again after cooldown."
                )
                self._circuit_warned = True

    def _circuit_is_open(self) -> bool:
        """True while the cooldown is active (skip pulling new work)."""
        return time.monotonic() < self._circuit_open_until

    # -------------------- per-backend priority heap --------------------

    @staticmethod
    def _task_priority(task: Dict[str, Any]) -> int:
        """Numeric priority of a pulled task (default 0). Higher drains first."""
        try:
            return int(task.get("priority") or 0)
        except (TypeError, ValueError):
            return 0

    def _enqueue_tasks(self, base: str, tasks: List[Dict[str, Any]]) -> int:
        """Push claimed tasks onto ``base``'s priority heap (max-by-priority).

        Skips a task already in flight (so a re-pull of an unreleased claim does not
        double-enqueue). Returns the number actually enqueued.
        """
        added = 0
        with self._heap_lock:
            heap = self._task_heaps.setdefault(base, [])
            for task in tasks:
                task_id = task.get("task_id")
                with self._inflight_lock:
                    if task_id in self._inflight:
                        continue
                self._heap_seq += 1
                # min-heap on (-priority, seq) => highest priority, then FIFO.
                heapq.heappush(heap, (-self._task_priority(task), self._heap_seq, task))
                added += 1
        return added

    def _drain_heap(self, base: str) -> None:
        """Dispatch every queued task for ``base``, highest priority first."""
        while True:
            with self._heap_lock:
                heap = self._task_heaps.get(base)
                if not heap:
                    return
                _neg_pri, _seq, task = heapq.heappop(heap)
            self._dispatch(task)

    def _heap_depth(self) -> int:
        """Total queued (claimed-but-undispatched) tasks across all backends."""
        with self._heap_lock:
            return sum(len(h) for h in self._task_heaps.values())

    # -------------------- jittered fast-drain burst --------------------

    def _maybe_start_fast_drain(self) -> None:
        """Arm a fast-drain burst when pending_fast>0 and none is already running."""
        if self._pending_fast <= 0:
            return
        with self._fast_drain_lock:
            if self._fast_drain_active:
                return
            self._fast_drain_active = True
        threading.Thread(
            target=self._fast_drain_loop, daemon=True, name="translate-fast-drain",
        ).start()

    def _fast_drain_loop(self) -> None:
        """Burst-PULL the fast lane while pending_fast persists.

        This loop ONLY pulls (wait=0) at TRANSLATION_FAST_POLL_INTERVAL with a small
        random jitter so N workers do not synchronize their pulls — it never sends a
        heartbeat (the ~12s heartbeat callback keeps the lease/registration fresh;
        duplicating it here would only add load). Claimed tasks are folded onto the
        per-backend priority heap and drained immediately. The burst runs for at most
        TRANSLATION_FAST_DRAIN_WINDOW, then yields back to the heartbeat cadence; a
        fresh pending_fast signal re-arms it.
        """
        try:
            deadline = time.monotonic() + self.TRANSLATION_FAST_DRAIN_WINDOW
            while time.monotonic() < deadline:
                if not self._registered or self._circuit_is_open():
                    break
                base = self.api_url
                tasks = self._pull_tasks(base, wait=0)
                if tasks:
                    self._enqueue_tasks(base, tasks)
                    self._drain_heap(base)
                    # A productive pull extends the burst window.
                    deadline = time.monotonic() + self.TRANSLATION_FAST_DRAIN_WINDOW
                if self._pending_fast <= 0 and not tasks:
                    break
                jitter = random.uniform(0, max(0.0, self.TRANSLATION_FAST_POLL_JITTER))
                time.sleep(self.TRANSLATION_FAST_POLL_INTERVAL + jitter)
        except Exception as e:
            ColorPrint.yellow(f"[TranslationWorker] fast-drain loop error: {e}")
        finally:
            with self._fast_drain_lock:
                self._fast_drain_active = False

    # -------------------- payload hygiene --------------------

    @staticmethod
    def _normalize_words(raw_words: Any) -> List[str]:
        """
        Coerce a task's ``payload.words`` into a clean list of strings.

        The word_translation contract is plain strings, but other producers on
        the same task substrate ship words as dicts (e.g. dictionary_explanation
        rows: {"word": ..., "md5": ..., "query_count": ...}). A mis-routed task
        of that shape used to crash this worker with
        "'dict' object has no attribute 'strip'" — tolerate it by extracting the
        word field instead. Non-string scalars and empties are dropped.
        """
        normalized: List[str] = []
        if not isinstance(raw_words, (list, tuple)):
            return normalized
        for entry in raw_words:
            word: Any = entry
            if isinstance(entry, dict):
                word = entry.get("word") or entry.get("content")
            if isinstance(word, str):
                word = word.strip()
                if word:
                    normalized.append(word)
        return normalized

    # -------------------- translation --------------------

    def _translate_words(self, words: List[str], target_language: str) -> List[Dict[str, str]]:
        """
        Translate ``words`` -> ``target_language`` (source auto-detected) and return
        the contract's translations list: [ {word, translation}, ... ].

        Engine chain (free/offline first, network last):
          1. ECDICT offline dictionary — instant, free, authoritative for known
             English words to Chinese/English (get_dictionary_service().translate).
          2. GoogleTranslator (async, on-disk cached) for the misses + every
             non-zh/en target. Runs in a private event loop (this executes on a
             TaskManager background thread with no running loop).
        """
        if not words:
            return []

        # 1) Offline dictionary pass — fill what ECDICT knows, queue the rest.
        dict_svc = get_dictionary_service()
        use_dict = dict_svc.available()
        pairs: List[Dict[str, str]] = [{"word": w, "translation": ""} for w in words]
        miss_idx: List[int] = []
        for i, word in enumerate(words):
            hit = dict_svc.translate(word, target_language) if use_dict else None
            if hit:
                pairs[i]["translation"] = hit
            else:
                miss_idx.append(i)

        if not miss_idx:
            ColorPrint.blue(f"[TranslationWorker] {len(words)} word(s) -> {target_language} "
                            f"via ECDICT (offline, 0 google calls)")
            return pairs

        # 2) Google for the dictionary misses only.
        misses = [words[i] for i in miss_idx]

        async def _run() -> List[str]:
            async with GoogleTranslator() as translator:
                results = await translator.translate_batch(
                    misses, src="auto", dest=target_language, use_cache=True
                )
            return [getattr(res, "translated_text", "") or "" for res in results]

        # We're on a background worker thread -> safe to spin a private event loop.
        google_out = asyncio.run(_run())
        for idx, translated in zip(miss_idx, google_out):
            pairs[idx]["translation"] = translated
        if use_dict:
            ColorPrint.blue(f"[TranslationWorker] {len(words)} word(s) -> {target_language} "
                            f"({len(words) - len(misses)} ECDICT / {len(misses)} google)")
        return pairs

    # -------------------- task processing --------------------

    def _process_task(self, task: Dict[str, Any]) -> None:
        """
        Process one claimed task and POST its result. Runs on a TaskManager
        background thread (off the heartbeat thread). Any failure -> POST 'failed'
        so Laravel re-routes/re-pends; nothing is ever silently dropped.

        Dispatch order (unified client):
          - capability == 'ai_translate'  -> _ai_translate_words (shared fast lane;
                                             task_type stays word_translation)
          - task_type == 'word_audio'     -> _process_audio_task (assist TTS)
          - task_type == 'word_media'     -> _process_image_task (AI gateway image)
          - task_type == 'subtitle_search'-> _process_subtitle_search_task
          - task_type == 'poster'         -> _process_poster_task
          - task_type == 'sentence_audio' -> _process_sentence_audio_task
          - task_type word_translation/'' -> google translate (legacy path)
          - anything else                 -> 'failed' (re-route)
        """
        task_id = task.get("task_id")
        try:
            task_type = task.get("task_type")
            capability = task.get("capability")

            # AI-translate capability: race on the shared fast lane. task_type stays
            # word_translation; only the PATH differs (AI gateway vs Google).
            if capability == "ai_translate":
                self._ai_translate_words(task)
                return

            if task_type == self.AUDIO_TASK_TYPE:
                self._process_audio_task(task)
                return
            if task_type == self.IMAGE_TASK_TYPE:
                self._process_image_task(task)
                return
            if task_type == "subtitle_search":
                self._process_subtitle_search_task(task)
                return
            if task_type == "poster":
                self._process_poster_task(task)
                return
            if task_type == "sentence_audio":
                self._process_sentence_audio_task(task)
                return
            if task_type == "prompt_translation":
                self._process_prompt_translation_task(task)
                return

            # The pull claims by execution_type, so a mis-tagged task of another
            # task_type can land here. Translating it would post a result shape
            # its real processor does not understand — report failed instead so
            # Laravel retries it toward the right consumer.
            if task_type not in (None, "", "word_translation"):
                ColorPrint.yellow(
                    f"[TranslationWorker] Task {task_id} has unsupported "
                    f"task_type '{task_type}' — reporting failed so it can be re-routed"
                )
                self._post_result(
                    task_id,
                    "failed",
                    error=(
                        f"pycore translation worker only processes word_translation "
                        f"tasks (got task_type={task_type!r})"
                    ),
                )
                return

            payload = task.get("payload") or {}
            words = self._normalize_words(payload.get("words"))
            target_language = payload.get("target_language") or "en"
            source_language = payload.get("language") or "auto"

            # WORD-LEVEL COORDINATION (multi-pycore): skip words another pycore
            # already finished (broadcast via Reverb `word.translated`). Those are
            # reported as already-done so Laravel's idempotent write-back keeps them.
            to_translate, already_done = self.partition_words(
                words, source_language, target_language
            )
            if already_done:
                ColorPrint.blue(
                    f"[TranslationWorker] Task {task_id}: skipping {len(already_done)} "
                    f"word(s) already translated by another pycore"
                )

            ColorPrint.blue(
                f"[TranslationWorker] Translating task {task_id}: "
                f"{len(to_translate)} word(s) -> {target_language}"
                + (f" ({len(already_done)} skipped)" if already_done else "")
            )

            # Best-effort liveness ping BEFORE the slow translate: marks the
            # task `processing` on Laravel (live in the dashboard) and RENEWS
            # its timeout lease, so a long batch under throttling is not
            # reclaimed mid-flight and double-translated. attempts=1 — a lost
            # ping costs nothing, the final result carries the real outcome.
            self._post_result(task_id, "processing", progress=5, attempts=1)

            translations = self._translate_words(to_translate, target_language)

            # Record our just-translated words so they dedup future tasks here too.
            if translations:
                self.mark_words_done(
                    [t["word"] for t in translations], source_language, target_language
                )

            # Skipped (already-done) words are NOT added to `translations`: sending
            # them with an empty string would violate the {word, translation}
            # contract and risk a blank overwrite on the backend. Report them in a
            # separate field purely for observability — the write-back ignores it.
            result = {
                "translations": translations,
                "target_language": target_language,
                "provider": self.DEFAULT_PROVIDER,  # "google"
            }
            if already_done:
                result["skipped_words"] = already_done
            self._post_result(task_id, "completed", result=result, progress=100)
        except Exception as e:
            ColorPrint.red(f"[TranslationWorker] Task {task_id} failed: {e}")
            self._post_result(task_id, "failed", error=str(e))
        finally:
            with self._inflight_lock:
                self._inflight.discard(task_id)

    # -------------------- AI-translate capability (shared fast lane) --------------------

    def _ai_provider_label(self) -> str:
        """Best-effort label for the active AI provider (fallback 'ai')."""
        try:
            from pycore.pyctl.ai import available_providers
            providers = available_providers() or []
            if providers:
                name = providers[0].get("name")
                if name:
                    return str(name)
        except Exception:
            pass
        return "ai"

    def _ai_translate_words(self, task: Dict[str, Any]) -> None:
        """Translate a word_translation task via the AI gateway (capability=ai_translate).

        Reuses ai_batch_translate.translate_lines; the real answering provider is
        surfaced into the result's ``provider`` field (best-effort fallback to the
        first available provider, else 'ai'). On import failure / zero pairs the task
        is reported 'failed' so it re-routes (e.g. to the chrome web-ai worker).
        """
        task_id = task.get("task_id")
        payload = task.get("payload") or {}
        words = self._normalize_words(payload.get("words"))
        target_language = payload.get("target_language") or "en"
        source_language = payload.get("language") or "auto"
        if not words:
            self._post_result(task_id, "failed", error="ai_translate task had no words")
            return
        try:
            from pycore.callmodule.services import ai_batch_translate
        except ImportError as e:
            ColorPrint.yellow(
                f"[TranslationWorker] ai_batch_translate unavailable ({e}); "
                f"reporting task {task_id} failed for re-route")
            self._post_result(task_id, "failed", error=f"ai_batch_translate unavailable: {e}")
            return

        self._post_result(task_id, "processing", progress=5, attempts=1)
        meta: Dict[str, Any] = {}
        try:
            pairs = ai_batch_translate.translate_lines(
                words, source_language, target_language,
                domain="text", source="ai_translate_worker", meta_out=meta,
            )
        except Exception as e:
            ColorPrint.red(f"[TranslationWorker] AI translate task {task_id} failed: {e}")
            self._post_result(task_id, "failed", error=str(e))
            return

        if not pairs:
            self._post_result(task_id, "failed",
                              error="ai_translate produced no translations")
            return

        provider_label = meta.get("provider") or self._ai_provider_label()
        result = {
            "translations": pairs,
            "target_language": target_language,
            "provider": provider_label,
        }
        self._post_result(task_id, "completed", result=result, progress=100)

    # -------------------- audio (assist TTS) lane --------------------

    def _synthesize_word_audio(self, text: str, language: str) -> Tuple[str, str]:
        """Synthesize ``text`` -> MP3 bytes (base64) via the pyutils TTS orchestrator.

        Returns (audio_base64, engine). Raises on failure (caller posts 'failed').
        """
        import base64
        import tempfile
        from pathlib import Path
        from pycore.pyutils.tts import tts_orchestrator

        fd, tmp_path = tempfile.mkstemp(prefix="worker_tts_", suffix=".mp3")
        os.close(fd)
        tmp = Path(tmp_path)
        try:
            synth = tts_orchestrator.synthesize(text, language, tmp)
            if not synth.get("success"):
                raise RuntimeError(synth.get("error") or "tts synthesis failed")
            audio = tmp.read_bytes() if tmp.exists() else b""
            if len(audio) < 100:
                raise RuntimeError(
                    f"engine '{synth.get('engine')}' produced {len(audio)} bytes")
            return base64.b64encode(audio).decode("ascii"), (synth.get("engine") or "unknown")
        finally:
            try:
                tmp.unlink()
            except OSError:
                pass

    def _process_audio_task(self, task: Dict[str, Any]) -> None:
        """word_audio task: real pronunciation source chain first, TTS fallback
        -> {audio_base64}.

        Guarded by _audio_enabled(): if assist TTS is disabled on this worker the task
        is reported 'failed' (so it re-routes) and recorded locally, never silently
        dropped.

        Tries word_audio_client.find_pronunciation() FIRST (Free Dictionary API ->
        Cambridge Dictionary -> Forvo, each independently guarded / never raises).
        On a real-source hit its audio bytes are used directly and the 'engine'
        result field carries the source's provider name (e.g.
        "free_dictionary_api", "cambridge_dictionary", "forvo") instead of a TTS
        engine name. Only when every real source misses does this fall through to
        the existing _synthesize_word_audio() -> tts_orchestrator.synthesize() path,
        unchanged.
        """
        task_id = task.get("task_id")
        if not self._audio_enabled():
            self._post_result(task_id, "failed", error="assist TTS disabled on this worker")
            self._record_task(task, self.AUDIO_TASK_TYPE, "failed",
                              posted_back=False, error="assist TTS disabled on this worker")
            return
        payload = task.get("payload") or {}
        text = (payload.get("text") or payload.get("word") or "").strip()
        language = (payload.get("language") or "en").strip() or "en"
        if not text:
            self._post_result(task_id, "failed", error="word_audio task had no text")
            return
        self._post_result(task_id, "processing", progress=5, attempts=1)

        real_source = None
        try:
            real_source = find_pronunciation(text, language)
        except Exception as e:  # noqa: BLE001 - real-source chain must never break this lane
            ColorPrint.yellow(
                f"[TranslationWorker] word_audio task {task_id} real-source lookup "
                f"skipped ({e}); falling back to TTS")

        if real_source:
            audio_b64 = base64.b64encode(real_source["audio_bytes"]).decode("ascii")
            engine = real_source["provider"]
            mime = real_source.get("mime") or "audio/mpeg"
        else:
            try:
                audio_b64, engine = self._synthesize_word_audio(text, language)
            except Exception as e:
                ColorPrint.red(f"[TranslationWorker] word_audio task {task_id} failed: {e}")
                self._post_result(task_id, "failed", error=str(e))
                self._record_task(task, self.AUDIO_TASK_TYPE, "failed",
                                  posted_back=True, error=str(e))
                return
            mime = "audio/mpeg"

        result = {"audio_base64": audio_b64, "mime": mime, "engine": engine}
        self._post_result(task_id, "completed", result=result, progress=100)
        self._record_task(task, self.AUDIO_TASK_TYPE, "completed", posted_back=True)

    # -------------------- subtitle-search lane --------------------

    def _process_subtitle_search_task(self, task: Dict[str, Any]) -> None:
        """subtitle_search task: SubtitleSearchController().search(...) -> {results}.

        SubtitleSearchController is a pycore module lost with the subsystem at this
        baseline — imported lazily so the worker still compiles/runs. If absent (or
        the lane is disabled / results empty) the task is reported 'failed' so it
        re-routes, never silently dropped.
        """
        task_id = task.get("task_id")
        if not self._subtitle_enabled():
            self._post_result(task_id, "failed", error="subtitle search disabled on this worker")
            return
        payload = task.get("payload") or {}
        query = payload.get("query") or payload.get("title") or ""
        if not query:
            self._post_result(task_id, "failed", error="subtitle_search task had no query")
            return
        try:
            from pycore.callmodule.controllers.subtitle_search_controller import (  # type: ignore
                SubtitleSearchController,
            )
        except ImportError as e:
            ColorPrint.yellow(
                f"[TranslationWorker] SubtitleSearchController unavailable ({e}); "
                f"reporting task {task_id} failed for re-route")
            self._post_result(task_id, "failed", error=f"SubtitleSearchController unavailable: {e}")
            return
        self._post_result(task_id, "processing", progress=5, attempts=1)
        try:
            results = SubtitleSearchController().search(
                query=query,
                languages=payload.get("languages"),
                year=payload.get("year"),
                season=payload.get("season"),
                episode=payload.get("episode"),
                moviehash=payload.get("moviehash"),
                limit=payload.get("limit"),
                record=payload.get("record"),
            )
        except Exception as e:
            ColorPrint.red(f"[TranslationWorker] subtitle_search task {task_id} failed: {e}")
            self._post_result(task_id, "failed", error=str(e))
            return
        # Accept either a bare list or a {results:[...]} shape from the controller.
        if isinstance(results, dict):
            rows = results.get("results") or []
        else:
            rows = results or []
        if not rows:
            self._post_result(task_id, "failed", error="subtitle_search found no results")
            return
        self._post_result(task_id, "completed", result={"results": rows}, progress=100)

    # -------------------- poster lane --------------------

    def _process_poster_task(self, task: Dict[str, Any]) -> None:
        """poster task: resolve title -> movie_poster_client.find_poster ->
        {image_base64, mime, provider, source_id}. Disabled / no-poster -> 'failed'.
        """
        task_id = task.get("task_id")
        if not self._poster_enabled():
            self._post_result(task_id, "failed", error="poster fetch disabled on this worker")
            return
        payload = task.get("payload") or {}
        title = (payload.get("title") or "").strip()
        year = payload.get("year")
        try:
            from pycore.pyutils.external_apis.movie_poster_client import (
                find_poster, parse_title_year,
            )
        except ImportError as e:
            self._post_result(task_id, "failed", error=f"movie_poster_client unavailable: {e}")
            return
        if not title:
            filename = (payload.get("filename") or "").strip()
            if filename:
                title, parsed_year = parse_title_year(filename)
                if year is None:
                    year = parsed_year
        if not title:
            self._post_result(task_id, "failed", error="poster task had no title/filename")
            return
        try:
            year_int = int(year) if year is not None else None
        except (TypeError, ValueError):
            year_int = None
        self._post_result(task_id, "processing", progress=5, attempts=1)
        try:
            poster = find_poster(title, year=year_int)
        except Exception as e:
            ColorPrint.red(f"[TranslationWorker] poster task {task_id} failed: {e}")
            self._post_result(task_id, "failed", error=str(e))
            return
        if not poster or not poster.get("image_base64"):
            self._post_result(task_id, "failed",
                              error=f"no poster found for '{title}'")
            return
        result = {
            "image_base64": poster.get("image_base64"),
            "mime": poster.get("mime") or "image/jpeg",
            "provider": poster.get("provider") or "tmdb",
            "source_id": poster.get("source_id"),
        }
        self._post_result(task_id, "completed", result=result, progress=100)

    # -------------------- word-image lane (shared fast lane) --------------------

    @staticmethod
    def _image_prompt_for_word(word: str, language: str) -> str:
        """Build a concise illustration prompt for a vocabulary word.

        Kept short + concrete so image providers return a clean, single-subject
        picture suitable as a word's sample art. Language is included so the prompt
        disambiguates homographs across libraries.
        """
        lang = (language or "en").strip() or "en"
        return (
            f"A clear, simple illustration that visually represents the meaning of "
            f"the {lang} word '{word}'. Single subject, plain background, no text."
        )

    def _process_image_task(self, task: Dict[str, Any]) -> None:
        """word_media task: generate a word illustration via the unified AI gateway.

        Result is shaped into the word_media WRITE-BACK contract that
        WordTranslationTaskProcessor -> AppQyV1WordTranslationWriteback::apply
        accepts (fill-missing/idempotent, image-only):
            { translations:[ {word, image_base64:[{base64,mime}]} ],
              target_language, provider }

        Guarded by _image_enabled(): disabled / no word / gateway failure (e.g. no
        image-capable provider configured) -> 'failed', so Laravel re-routes or
        re-pends the task. Never strands (this is why advertising 'image' is safe —
        a real processor exists; absence of a backend degrades to a clean failure).
        """
        task_id = task.get("task_id")
        if not self._image_enabled():
            self._post_result(task_id, "failed", error="word image disabled on this worker")
            return
        payload = task.get("payload") or {}
        words = self._normalize_words(payload.get("words"))
        word = words[0] if words else (payload.get("word") or "").strip()
        language = (payload.get("language") or "en").strip() or "en"
        target_language = payload.get("target_language") or language
        if not word:
            self._post_result(task_id, "failed", error="word_media task had no word")
            return
        try:
            from pycore.pyctl.ai import generate_image
        except ImportError as e:
            ColorPrint.yellow(
                f"[TranslationWorker] generate_image unavailable ({e}); "
                f"reporting task {task_id} failed for re-route")
            self._post_result(task_id, "failed", error=f"generate_image unavailable: {e}")
            return
        self._post_result(task_id, "processing", progress=5, attempts=1)
        try:
            gen = generate_image(
                prompt=self._image_prompt_for_word(word, language),
                size=payload.get("size"),
                model=payload.get("model"),
                source="word_media_worker",
            )
        except Exception as e:
            ColorPrint.red(f"[TranslationWorker] word_media task {task_id} failed: {e}")
            self._post_result(task_id, "failed", error=str(e))
            return
        image_b64 = (gen or {}).get("image_base64") if isinstance(gen, dict) else None
        if not gen or not gen.get("success") or not image_b64:
            err = (gen or {}).get("error") or "no image-capable provider produced an image"
            self._post_result(task_id, "failed", error=str(err))
            return
        result = {
            "translations": [{
                "word": word,
                "image_base64": [{
                    "base64": image_b64,
                    "mime": gen.get("mime") or "image/png",
                }],
            }],
            "target_language": target_language,
            "provider": gen.get("provider") or "ai",
        }
        self._post_result(task_id, "completed", result=result, progress=100)
        self._record_task(task, self.IMAGE_TASK_TYPE, "completed", posted_back=True)

    # -------------------- sentence-audio lane --------------------

    def _process_sentence_audio_task(self, task: Dict[str, Any]) -> None:
        """sentence_audio task: synthesize MP3 via the TTS orchestrator -> {audio_base64}.

        Reuses _synthesize_word_audio (same edge-tts MP3 path). Disabled / empty /
        synthesis failure -> 'failed' (re-route).
        """
        task_id = task.get("task_id")
        if not self._sentence_audio_enabled():
            self._post_result(task_id, "failed", error="sentence audio disabled on this worker")
            return
        payload = task.get("payload") or {}
        text = (payload.get("text") or payload.get("sentence") or "").strip()
        language = (payload.get("language") or "en").strip() or "en"
        if not text:
            self._post_result(task_id, "failed", error="sentence_audio task had no text")
            return
        self._post_result(task_id, "processing", progress=5, attempts=1)
        try:
            audio_b64, engine = self._synthesize_word_audio(text, language)
        except Exception as e:
            ColorPrint.red(f"[TranslationWorker] sentence_audio task {task_id} failed: {e}")
            self._post_result(task_id, "failed", error=str(e))
            return
        result = {"audio_base64": audio_b64, "mime": "audio/mpeg", "engine": engine}
        self._post_result(task_id, "completed", result=result, progress=100)

    # -------------------- prompt translation (dev-history assist) --------------------

    def _prompt_ai_paused(self) -> bool:
        return time.time() < self._prompt_ai_pause_until

    def _prompt_ai_pause(self, seconds: float = 120.0) -> None:
        self._prompt_ai_pause_until = time.time() + max(30.0, seconds)
        ColorPrint.yellow(
            f"[TranslationWorker] AI providers exhausted — pausing prompt "
            f"translation for ~{int(seconds)}s"
        )

    def _process_prompt_translation_task(self, task: Dict[str, Any]) -> None:
        """prompt_translation task: translate a non-English prompt to English.

        Masks code so it is never translated, asks the AI gateway for the English
        translation + a cleaned sentence + 3 fluent variants, and (best-effort)
        synthesizes English TTS. On AI exhaustion the worker PAUSES and reports the
        task failed so Laravel re-pends it until the rate window resets.
        """
        task_id = task.get("task_id")
        payload = task.get("payload") or {}
        text = (payload.get("text") or "").strip()
        prompt_id = payload.get("prompt_id") or ""
        src = (payload.get("source_lang") or "auto").strip() or "auto"
        want_audio = bool(payload.get("want_audio", True))

        if not text:
            self._post_result(task_id, "failed", error="prompt_translation task had no text")
            return

        # Honor an active pause: do not burn a claim while providers are exhausted.
        if self._prompt_ai_paused():
            self._post_result(task_id, "failed", error="AI providers paused (rate limit) — retry later")
            return

        self._post_result(task_id, "processing", progress=5, attempts=1)

        try:
            from pycore.pyutils.translator import prompt_translate
            tr = prompt_translate.translate_prompt(text, src=src)
        except Exception as e:
            ColorPrint.red(f"[TranslationWorker] prompt_translation {task_id} failed: {e}")
            self._post_result(task_id, "failed", error=str(e))
            return

        if not tr.get("success"):
            if tr.get("exhausted"):
                self._prompt_ai_pause(120.0)
            self._post_result(task_id, "failed", error=str(tr.get("error") or "translate failed"))
            return

        english = tr.get("english") or ""
        result: Dict[str, Any] = {
            "prompt_id": prompt_id,
            "detected_language": src,
            "english": english,
            "cleaned": tr.get("cleaned") or english,
            "variants": tr.get("variants") or [],
            "provider": tr.get("provider"),
        }

        # Best-effort English audio (same edge-tts path as sentence_audio). The
        # backend stores the bytes and serves them for the wordnew daily reading.
        if want_audio and self._sentence_audio_enabled():
            try:
                audio_b64, engine = self._synthesize_word_audio(english, "en")
                if audio_b64:
                    result["audio_base64"] = audio_b64
                    result["audio"] = {"language": "en", "engine": engine, "mime": "audio/mpeg"}
            except Exception as e:
                ColorPrint.yellow(f"[TranslationWorker] prompt audio synth skipped: {e}")

        self._post_result(task_id, "completed", result=result, progress=100)

    # -------------------- local task accounting --------------------

    def _record_task(
        self,
        task: Dict[str, Any],
        task_type: str,
        status: str,
        posted_back: bool = True,
        error: Optional[str] = None,
    ) -> None:
        """Best-effort local accounting hook for a processed task (never raises)."""
        try:
            ColorPrint.blue(
                f"[TranslationWorker] recorded {task_type} task "
                f"{task.get('task_id')} -> {status}"
                + (f" (posted_back={posted_back})" if not posted_back else "")
                + (f" error={error}" if error else "")
            )
        except Exception:
            pass

    @staticmethod
    def _local_task_label(task: Dict[str, Any]) -> str:
        """Map a pulled task to the local TaskManager lane label for the UI.

        Each new unified task_type gets its own lane so the local task-center UI can
        distinguish them; ai_translate keeps the translation lane (task_type stays
        word_translation).
        """
        if task.get("capability") == "ai_translate":
            return "remote_ai_translate"
        return {
            "word_audio": "remote_audio",
            "word_media": "remote_image",
            "subtitle_search": "remote_subtitle",
            "poster": "remote_poster",
            "sentence_audio": "remote_sentence_audio",
        }.get(task.get("task_type"), "remote_translation")

    def _dispatch(self, task: Dict[str, Any]) -> None:
        """
        Hand a task to a background thread via the pyctl desktop TaskManager so the
        heartbeat thread is never blocked by network + translation latency. Mirrors
        VideoExtractController.start()'s use of execute_task.
        """
        task_id = task.get("task_id")
        with self._inflight_lock:
            if task_id in self._inflight:
                return  # already being processed
            self._inflight.add(task_id)

        try:
            tm = get_task_manager()
            payload = task.get("payload") or {}
            input_data = {
                "remote_task_id": task_id,
                "app_name": task.get("app_name"),
                "task_type": task.get("task_type"),
                "execution_type": task.get("execution_type"),
                "capability": task.get("capability"),
                "words": self._normalize_words(payload.get("words")),
                "language": payload.get("language"),
                "target_language": payload.get("target_language"),
                "priority": task.get("priority"),
            }
            local_task_id = tm.create_task(
                task_type=self._local_task_label(task),
                input_data=input_data,
                estimated_time=None,
            )

            def executor(_local_task):
                # Return a small summary dict; the real result already went to Laravel.
                self._process_task(task)
                return {"remote_task_id": task_id, "dispatched": True}

            tm.execute_task(local_task_id, executor)
        except Exception as e:
            # If the TaskManager is unavailable, fall back to a plain daemon thread so
            # the worker still functions (heartbeat thread stays unblocked either way).
            ColorPrint.yellow(
                f"[TranslationWorker] TaskManager dispatch failed ({e}); using thread fallback"
            )
            threading.Thread(
                target=self._process_task, args=(task,),
                daemon=True, name=f"translate-{task_id}",
            ).start()

    # -------------------- heartbeat callback --------------------

    def poll_once(self) -> None:
        """
        PyHeartbeat callback (invoked every ~interval seconds WHEN ENABLED).

        Light by design: ensure registration, send heartbeat, pull tasks, dispatch
        each to a background thread. Idempotent and exception-safe — it must never
        raise into the heartbeat loop.
        """
        try:
            if not self._register():
                return  # not registered yet (Laravel down) — try again next tick

            # Live-toggle re-registration: if a dedicated lane was enabled/disabled
            # since the last register, re-advertise the new processor-type set so
            # Laravel starts/stops handing those lanes to this worker immediately.
            if (self._advertised_processor_types is not None
                    and self._effective_processor_types() != self._advertised_processor_types):
                ColorPrint.blue(
                    "[TranslationWorker] advertised lane set changed — re-registering")
                self._registered = False
                if not self._register():
                    return

            self._heartbeat()

            # Circuit breaker: while the backend is persistently rejecting results
            # (HTTP 5xx), keep heartbeating (stay registered) but STOP pulling new
            # work — translating more only burns LLM calls for results the backend
            # cannot store and re-floods it. The cooldown expires on its own so the
            # worker auto-probes; any accepted result resets it (_note_result_*).
            if self._circuit_is_open():
                return

            # Pull with wait=0 (immediate). Laravel orders by priority desc; we ALSO
            # fold the batch into the per-backend priority heap and drain highest
            # first so a bumped task processes ahead of older lower-priority ones.
            base = self.api_url
            tasks = self._pull_tasks(base, wait=0)
            if tasks:
                ColorPrint.green(f"[TranslationWorker] Pulled {len(tasks)} task(s)")
                # Every pulled task is already CLAIMED for this worker by Laravel's
                # atomic assign — enqueue everything; _process_task answers
                # unsupported types with 'failed' so they re-route, never leak.
                self._enqueue_tasks(base, tasks)
                self._drain_heap(base)

            # A pending_fast signal (from this pull or the heartbeat) arms a jittered
            # fast-drain burst so interactive requests are claimed near-instantly.
            self._maybe_start_fast_drain()
        except Exception as e:
            ColorPrint.red(f"[TranslationWorker] poll_once error: {e}")

    # -------------------- introspection --------------------

    def get_status(self) -> Dict[str, Any]:
        """Service status snapshot (read-only)."""
        with self._inflight_lock:
            inflight = len(self._inflight)
        return {
            "service": "Translation Worker",
            "api_url": self.api_url,
            "worker_id": self.worker_id,
            "processor_types": self._effective_processor_types(),
            "capabilities": self._effective_capabilities(),
            "provider": self.DEFAULT_PROVIDER,
            "registered": self._registered,
            "inflight_tasks": inflight,
            "done_words_cached": self.done_words_count(),
            "initialized": self._initialized,
            # Circuit breaker: open while the backend persistently rejects results.
            "circuit_open": self._circuit_is_open(),
            "result_5xx_streak": self._result_5xx_streak,
            # Fast-lane signal snapshot.
            "pending_fast": self._pending_fast,
            "pending_urgent": self._pending_urgent,
            "heap_depth": self._heap_depth(),
        }

    def get_queue_status(self) -> Dict[str, Any]:
        """Fast-lane / queue snapshot for routers + local UI.

        Surfaces the latest pending_fast / pending_urgent counters (from pull +
        heartbeat), the per-backend claimed-task heap depth, the fast-drain burst
        state, and the advertised lanes/capabilities — so the task-center overview is
        not blind to the interactive fast lane.
        """
        with self._heap_lock:
            per_backend = {b: len(h) for b, h in self._task_heaps.items()}
        with self._inflight_lock:
            inflight = len(self._inflight)
        return {
            "api_url": self.api_url,
            "registered": self._registered,
            "pending_fast": self._pending_fast,
            "pending_urgent": self._pending_urgent,
            "heap_depth": sum(per_backend.values()),
            "heap_per_backend": per_backend,
            "fast_drain_active": self._fast_drain_active,
            "inflight_tasks": inflight,
            "processor_types": self._effective_processor_types(),
            "capabilities": self._effective_capabilities(),
        }


# ============================================================
# Global singleton accessor
# ============================================================

def get_translation_worker_service(
    laravel_api_url: str = "http://127.0.0.1:9000",
) -> TranslationWorkerService:
    """
    Get the TranslationWorkerService singleton (idempotent).

    Args:
        laravel_api_url: Laravel worker-API base URL.

    Returns:
        The shared TranslationWorkerService instance.
    """
    return TranslationWorkerService(laravel_api_url)
