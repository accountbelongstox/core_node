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
import os
import platform
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
from pycore.pyctl.desktop.task_manager import get_task_manager


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

    # processor type advertised to Laravel (must match the contract).
    PROCESSOR_TYPES = ["remote_translation"]
    DEFAULT_PROVIDER = "google"

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
        for base in self._candidates:
            try:
                resp = requests.post(
                    f"{base}/api/worker/register",
                    json={
                        "worker_id": self.worker_id,
                        "worker_name": self.worker_name,
                        "processor_types": self.PROCESSOR_TYPES,
                        "hostname": self.hostname,
                        "platform": self.platform,
                    },
                    timeout=self._http_timeout,
                )
                if resp.status_code in (200, 201):
                    self.api_url = base
                    self._registered = True
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

    def _heartbeat(self) -> None:
        """Send a worker heartbeat (best-effort; a dropped connection forces
        re-discovery on the next tick rather than spamming the log)."""
        try:
            requests = self._requests()
            requests.post(
                f"{self.api_url}/api/worker/heartbeat",
                json={"worker_id": self.worker_id},
                timeout=self._http_timeout,
            )
        except Exception as e:
            # Laravel likely went away — drop registration so _register re-discovers
            # (and emits the single "no reachable Laravel" hint) next tick.
            self._registered = False
            ColorPrint.yellow(f"[TranslationWorker] Heartbeat failed ({self._short_err(e)}); will re-discover")

    def _pull_tasks(self) -> List[Dict[str, Any]]:
        """GET pending tasks for this worker. Returns [] on any error.

        PRIORITY-SYNC NOTE: this pull does NOT re-sort tasks locally — it relies on
        Laravel assigning/returning tasks in ``priority desc`` order. So a task that
        qyApp bumps to a higher priority is handed to this worker BEFORE lower-priority
        tasks on the next pull, i.e. high-priority (bumped) words are processed first
        automatically. Priority-sync to the UI is achieved by two complementary parts:
          (a) Laravel orders this pull by priority (the worker honours that order), and
          (b) the QueueMonitorService (queue_monitor_service.py) polls the queue list
              and surfaces priority bumps to the pycore UI (`recently_bumped`) in real
              time. No task-processing logic is duplicated between the two.
        """
        try:
            requests = self._requests()
            resp = requests.get(
                f"{self.api_url}/api/worker/tasks/pull",
                params={"worker_id": self.worker_id},
                timeout=self._http_timeout,
            )
            if resp.status_code == 200:
                data = resp.json() or {}
                # Worker API wraps the payload: { success, data:{ count, tasks }, ... }.
                # Accept both the wrapped and a bare { tasks } shape.
                body = data.get("data") if isinstance(data.get("data"), dict) else data
                tasks = (body or {}).get("tasks", []) or []
                return tasks
            ColorPrint.yellow(f"[TranslationWorker] Pull returned HTTP {resp.status_code}")
        except Exception as e:
            self._registered = False
            ColorPrint.yellow(f"[TranslationWorker] Pull failed ({self._short_err(e)}); will re-discover")
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

        Uses pycore's existing async GoogleTranslator (translate_batch, with the
        translator's own on-disk caching). Runs the async work inside a fresh event
        loop because this executes on a TaskManager background thread (no running
        loop there). Provider selection happens here — Google is the default; the
        BingSeleniumTranslator scaffold above is where Bing would be slotted in.
        """
        if not words:
            return []

        async def _run() -> List[Dict[str, str]]:
            async with GoogleTranslator() as translator:
                results = await translator.translate_batch(
                    words, src="auto", dest=target_language, use_cache=True
                )
            pairs: List[Dict[str, str]] = []
            for original, res in zip(words, results):
                # translate_batch returns TranslationResult objects (with .error on failure).
                translated = getattr(res, "translated_text", "") or ""
                pairs.append({"word": original, "translation": translated})
            return pairs

        # We're on a background worker thread -> safe to spin a private event loop.
        return asyncio.run(_run())

    # -------------------- task processing --------------------

    def _process_task(self, task: Dict[str, Any]) -> None:
        """
        Translate one task and POST its result. Runs on a TaskManager background
        thread (off the heartbeat thread). Any failure -> POST status 'failed'.
        """
        task_id = task.get("task_id")
        try:
            # The pull claims by execution_type, so a mis-tagged task of another
            # task_type can land here. Translating it would post a result shape
            # its real processor does not understand — report failed instead so
            # Laravel retries it toward the right consumer.
            task_type = task.get("task_type")
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
                "words": self._normalize_words(payload.get("words")),
                "language": payload.get("language"),
                "target_language": payload.get("target_language"),
                "priority": task.get("priority"),
            }
            local_task_id = tm.create_task(
                task_type="remote_translation",
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

            self._heartbeat()

            # Circuit breaker: while the backend is persistently rejecting results
            # (HTTP 5xx), keep heartbeating (stay registered) but STOP pulling new
            # work — translating more only burns LLM calls for results the backend
            # cannot store and re-floods it. The cooldown expires on its own so the
            # worker auto-probes; any accepted result resets it (_note_result_*).
            if self._circuit_is_open():
                return

            tasks = self._pull_tasks()
            if not tasks:
                return

            ColorPrint.green(f"[TranslationWorker] Pulled {len(tasks)} task(s)")
            for task in tasks:
                # Every pulled task is already CLAIMED for this worker by
                # Laravel's atomic assign — silently skipping one would strand it
                # in "assigned" until the timeout release. Dispatch everything;
                # _process_task answers unsupported task types with a 'failed'
                # result so they re-route instead of leaking.
                self._dispatch(task)
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
            "processor_types": self.PROCESSOR_TYPES,
            "provider": self.DEFAULT_PROVIDER,
            "registered": self._registered,
            "inflight_tasks": inflight,
            "done_words_cached": self.done_words_count(),
            "initialized": self._initialized,
            # Circuit breaker: open while the backend persistently rejects results.
            "circuit_open": self._circuit_is_open(),
            "result_5xx_streak": self._result_5xx_streak,
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
