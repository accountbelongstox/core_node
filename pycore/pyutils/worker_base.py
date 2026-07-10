# -*- coding: utf-8 -*-
"""
Shared worker primitives for pycore background workers.

Holds the two pieces duplicated verbatim across the Laravel-pulled workers
(AssistWorker today; the translation/tts siblings are a LATER reuse batch - see
TODO below):

  * _short_err     - one-line condenser for noisy requests/urllib3 exceptions.
  * CircuitBreaker - mixin: backend HTTP-5xx circuit breaker.

The breaker opens after CIRCUIT_FAIL_THRESHOLD consecutive server-side give-ups
and skips claiming/pulling for CIRCUIT_COOLDOWN_SECONDS; any accepted 2xx
resets it. State lives on the host instance (initialized once via
_init_circuit_breaker()); the host sets _circuit_log_prefix for its own tag.

REUSE-FIRST TODO: the callmodule siblings
  - callmodule/services/translation_worker/base_laravel_worker.py
  - callmodule/services/tts_sentence_worker_service.py
  - callmodule/services/tts_queue_poller_service.py
each carry their OWN copy of _short_err + a circuit breaker (with subtly
different state field names: _result_5xx_streak / _note_result_*). Retrofit
them to inherit CircuitBreaker in a LATER reuse batch - NOT in this split.
Their contracts differ (generic /api/worker/* vs dedicated claim/submit
endpoints; result-POST retry vs single-shot submit), so the merge needs its
own validation. Leave per-worker __init__ alone and do NOT merge
_build_worker_id vs _build_claimer - different shapes (worker_id is
hostname-only; claimer folds in a machine-id prefix and is capped <=56 chars).
"""

import time

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint


def _short_err(exc: Exception) -> str:
    """One-line condensation of noisy requests/urllib3 exceptions.

    Same hygiene as the AssistWorker/TranslationWorkerService copies: never
    dump a multi-line HTTPConnectionPool stack into the worker log."""
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


class CircuitBreaker:
    """Mixin: backend HTTP-5xx circuit breaker for Laravel-pulled workers.

    After CIRCUIT_FAIL_THRESHOLD consecutive server-side (HTTP 5xx) give-ups
    the breaker OPENS for CIRCUIT_COOLDOWN_SECONDS - the host loop keeps
    running but skips claiming/pulling until the cooldown expires; any accepted
    2xx response (_note_server_ok) resets it.

    The host MUST call _init_circuit_breaker() once in __init__ and may set
    _circuit_log_prefix (default "[Worker]") for its log tag. _note_server_error
    records the note via the host's _record_error hook when present (AssistWorker
    exposes one for its status endpoint) but never requires it.
    """

    CIRCUIT_FAIL_THRESHOLD = 3
    CIRCUIT_COOLDOWN_SECONDS = 120

    # Log prefix - host overrides (e.g. AssistWorker sets "[AssistWorker]").
    _circuit_log_prefix = "[Worker]"

    def _init_circuit_breaker(self) -> None:
        """Reset breaker state (call once from the host __init__)."""
        self._server_5xx_streak = 0
        self._circuit_open_until = 0.0

    def _note_server_ok(self) -> None:
        """Any accepted 2xx - backend write path works; reset the breaker."""
        if self._server_5xx_streak or self._circuit_open_until:
            ColorPrint.green(
                f"{self._circuit_log_prefix} Backend answered OK - circuit reset")
        self._server_5xx_streak = 0
        self._circuit_open_until = 0.0

    def _note_server_error(self, note: str) -> None:
        """A server-side HTTP 5xx give-up; open the breaker at the threshold."""
        self._server_5xx_streak += 1
        # Hook: let the host record the error for its status endpoint (present
        # on AssistWorker as _record_error). Best-effort - never required.
        recorder = getattr(self, "_record_error", None)
        if callable(recorder):
            recorder(note)
        ColorPrint.yellow(
            f"{self._circuit_log_prefix} Server error ({note}) - "
            f"streak {self._server_5xx_streak}/{self.CIRCUIT_FAIL_THRESHOLD}")
        if (self._server_5xx_streak >= self.CIRCUIT_FAIL_THRESHOLD
                and not self._circuit_is_open()):
            self._circuit_open_until = time.monotonic() + self.CIRCUIT_COOLDOWN_SECONDS
            ColorPrint.red(
                f"{self._circuit_log_prefix} Backend rejecting requests "
                f"({self._server_5xx_streak}x HTTP 5xx) - circuit OPEN for "
                f"{self.CIRCUIT_COOLDOWN_SECONDS}s (no claims until cooldown)")

    def _circuit_is_open(self) -> bool:
        """True while the cooldown is active (skip claiming new work)."""
        return time.monotonic() < self._circuit_open_until

    def _circuit_cooldown_remaining(self) -> int:
        """Seconds left on the open circuit (0 when closed)."""
        return max(0, int(self._circuit_open_until - time.monotonic()))
