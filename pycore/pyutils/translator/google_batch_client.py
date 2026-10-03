#!/usr/bin/env python3

import json
import threading
import time
from typing import Dict, List, Tuple
from urllib.parse import urlencode

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.http_client import HttpError, RESPONSE_CONTROL, http_client

GOOGLE_BATCH_URL = "https://clients5.google.com/translate_a/t"
GOOGLE_BATCH_CLIENT = "dict-chrome-ex"
AUTO_LANGUAGE = "auto"
MAX_ITEMS_PER_REQUEST = 50
MAX_CHARS_PER_REQUEST = 20000
MIN_REQUEST_INTERVAL_SECONDS = 0.15
REQUEST_TIMEOUT_SECONDS = 30.0
ATTEMPTS_PER_REQUEST = 2
RETRY_BACKOFF_SECONDS = 1.5
FAILURES_BEFORE_COOLDOWN = 3
COOLDOWN_SECONDS = 120.0
FORM_CONTENT_TYPE = "application/x-www-form-urlencoded; charset=utf-8"
HTTP_RETRY_STATUSES = frozenset({429, 500, 502, 503, 504})


class GoogleBatchClient:
    """Keyless Google Translate batch transport (the endpoint the Chrome translate extension uses).

    One POST carries many texts and works on every TLS stack, unlike the
    translate.googleapis.com gtx endpoint googletrans uses, which Google answers
    with HTTP 429 for some clients' TLS handshakes. The client chunks, throttles,
    retries once and opens a short cooldown after repeated failures so callers
    fall back to the next provider quickly.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._next_request_at = 0.0
        self._consecutive_failures = 0
        self._cooldown_until = 0.0

    def available(self) -> bool:
        return time.monotonic() >= self._cooldown_until

    @staticmethod
    def google_code(language: str) -> str:
        value = str(language or "").strip().replace("_", "-")
        if not value or value.lower() == AUTO_LANGUAGE:
            return AUTO_LANGUAGE
        head, _, tail = value.partition("-")
        return head.lower() + ("-" + tail.upper() if tail else "")

    def translate(self, texts: List[str], src: str, dest: str) -> List[Tuple[str, str]]:
        """Return (translation, detected_source) per text; ('', '') where Google gave nothing."""
        results: List[Tuple[str, str]] = [("", "")] * len(texts)
        unique_indices: Dict[str, List[int]] = {}
        for index, text in enumerate(texts):
            if isinstance(text, str) and text.strip():
                unique_indices.setdefault(text, []).append(index)
        if not unique_indices:
            return results
        if not self.available():
            ColorPrint.yellow(
                f"[GoogleBatch] cooldown active ({self._cooldown_until - time.monotonic():.0f}s left); "
                f"skipping {len(unique_indices)} text(s)"
            )
            return results
        source = self.google_code(src)
        target = self.google_code(dest)
        for chunk in self._chunks(list(unique_indices)):
            translated = self._request_chunk(chunk, source, target)
            if translated is None:
                if not self.available():
                    break
                continue
            for text, pair in zip(chunk, translated):
                for index in unique_indices[text]:
                    results[index] = pair
        return results

    @staticmethod
    def _chunks(texts: List[str]) -> List[List[str]]:
        chunks: List[List[str]] = []
        current: List[str] = []
        current_chars = 0
        for text in texts:
            if current and (len(current) >= MAX_ITEMS_PER_REQUEST or current_chars + len(text) > MAX_CHARS_PER_REQUEST):
                chunks.append(current)
                current = []
                current_chars = 0
            current.append(text)
            current_chars += len(text)
        if current:
            chunks.append(current)
        return chunks

    def _throttle(self) -> None:
        with self._lock:
            now = time.monotonic()
            wait = self._next_request_at - now
            self._next_request_at = max(now, self._next_request_at) + MIN_REQUEST_INTERVAL_SECONDS
        if wait > 0:
            time.sleep(wait)

    def _request_chunk(self, chunk: List[str], source: str, target: str) -> "List[Tuple[str, str]] | None":
        body = urlencode([("q", text) for text in chunk]).encode("utf-8")
        query = {"client": GOOGLE_BATCH_CLIENT, "sl": source, "tl": target}
        error = ""
        for attempt in range(1, ATTEMPTS_PER_REQUEST + 1):
            self._throttle()
            started = time.perf_counter()
            try:
                response = http_client.request(
                    "POST", GOOGLE_BATCH_URL, query=query, body=body,
                    headers={"Content-Type": FORM_CONTENT_TYPE},
                    timeout=REQUEST_TIMEOUT_SECONDS, response=RESPONSE_CONTROL,
                )
            except HttpError as exc:
                error = f"transport: {exc}"
            else:
                elapsed = time.perf_counter() - started
                if response.status_code == 200:
                    parsed = self._parse(response.text, chunk, source)
                    if parsed is not None:
                        self._consecutive_failures = 0
                        ColorPrint.blue(
                            f"[GoogleBatch] {source}->{target} {len(chunk)} text(s) "
                            f"{sum(len(text) for text in chunk)} chars in {elapsed:.2f}s"
                        )
                        return parsed
                    error = "unexpected response shape"
                else:
                    error = f"http {response.status_code}"
                    if response.status_code not in HTTP_RETRY_STATUSES:
                        break
            if attempt < ATTEMPTS_PER_REQUEST:
                time.sleep(RETRY_BACKOFF_SECONDS * attempt)
        self._consecutive_failures += 1
        ColorPrint.yellow(
            f"[GoogleBatch] {source}->{target} chunk of {len(chunk)} failed ({error}); "
            f"consecutive failures={self._consecutive_failures}"
        )
        if self._consecutive_failures >= FAILURES_BEFORE_COOLDOWN:
            self._cooldown_until = time.monotonic() + COOLDOWN_SECONDS
            self._consecutive_failures = 0
            ColorPrint.yellow(f"[GoogleBatch] cooldown {COOLDOWN_SECONDS:.0f}s after repeated failures")
        return None

    @staticmethod
    def _parse(text: str, chunk: List[str], source: str) -> "List[Tuple[str, str]] | None":
        try:
            data = json.loads(text)
        except ValueError:
            return None
        if not isinstance(data, list) or len(data) != len(chunk):
            return None
        pairs: List[Tuple[str, str]] = []
        for entry in data:
            if isinstance(entry, str):
                pairs.append((entry.strip(), source))
            elif isinstance(entry, list) and entry and isinstance(entry[0], str):
                detected = entry[1] if len(entry) > 1 and isinstance(entry[1], str) else source
                pairs.append((entry[0].strip(), detected))
            else:
                return None
        return pairs


google_batch_client = GoogleBatchClient()

__all__ = ["GoogleBatchClient", "google_batch_client"]
