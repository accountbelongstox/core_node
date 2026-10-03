# -*- coding: utf-8 -*-
"""Study-gen translation driver: claims segments from Laravel, translates their slots, submits.

Runs the existing row-lease protocol (claim -> submit -> release) of
/api/app_qy_v1/study-gen so every translated slot lands through
AppQyV1StudyGenWriteback (sentences_{lang} row + slot lang_content_ids).
Google (batch transport, googletrans fallback) translates; the AI gateway is an
opt-in fallback. A segment is submitted only when every non-empty slot is
translated, otherwise it is released so a later pass retries it.

    python -m pycore.pyctl.translation.study_gen_backfill --source-key <key> --languages zh
"""

import argparse
import asyncio
import os
import sys
import threading
import time
from typing import Any, Dict, List, Optional

import pycore.pyctl.translation.ai_batch_translate as ai_batch_translate
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.http_client import RESPONSE_CONTROL
from pycore.pyutils.laravel.client import laravel_client
from pycore.pyutils.translator.google_batch_client import google_batch_client
from pycore.pyutils.translator.google_translator import GoogleTranslator

STUDY_GEN_API = "/api/app_qy_v1/study-gen"
DEFAULT_SOURCE_TYPE = "book"
DEFAULT_CLAIMER = "pycore-google-translate"
DEFAULT_TARGET_CHARS = 500
DEFAULT_WORKERS = 2
CLAIM_LIMIT = 3
REQUEST_TIMEOUT_SECONDS = 120.0
SUBMIT_PROVIDER = "google"
SUBMIT_PROVIDER_AI = "google+ai"
GOOGLE_RETRY_WAIT_SECONDS = 30.0
NETWORK_RETRY_WAIT_SECONDS = 10.0
MAX_CONSECUTIVE_FAILURES = 12
PROGRESS_EVERY_SEGMENTS = 10


class StudyGenBackfill:
    def __init__(
        self,
        source_type: str,
        source_key: str,
        languages: List[str],
        claimer: str = DEFAULT_CLAIMER,
        base_url: Optional[str] = None,
        target_chars: int = DEFAULT_TARGET_CHARS,
        workers: int = DEFAULT_WORKERS,
        ai_fallback: bool = False,
        max_segments: int = 0,
    ) -> None:
        self.source_type = source_type
        self.source_key = source_key
        self.languages = languages
        self.claimer = claimer
        self.base_url = base_url
        self.target_chars = target_chars
        self.workers = max(1, workers)
        self.ai_fallback = ai_fallback
        self.max_segments = max_segments
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._started = time.monotonic()
        self._done_segments = 0
        self._failed_segments = 0
        self._slots_translated = 0
        self._consecutive_failures = 0
        self._claimed_segments = 0

    def _post(self, endpoint: str, body: Dict[str, Any]) -> Dict[str, Any]:
        response = laravel_client.post(
            f"{STUDY_GEN_API}/{endpoint}", base_url=self.base_url, json=body,
            timeout=REQUEST_TIMEOUT_SECONDS, response=RESPONSE_CONTROL, log_line=False,
        )
        try:
            data = response.json()
        except ValueError:
            data = {}
        data = data if isinstance(data, dict) else {}
        data["_status"] = response.status_code
        return data

    def _claim(self) -> List[Dict[str, Any]]:
        data = self._post("claim", {
            "claimer": self.claimer, "source_type": self.source_type, "source_key": self.source_key,
            "limit": CLAIM_LIMIT, "languages": self.languages, "target_chars": self.target_chars,
        })
        if data.get("_status") != 200 or not data.get("success"):
            ColorPrint.red(f"[StudyGenBackfill] claim failed status={data.get('_status')} error={data.get('error')}")
            return []
        return list(data.get("items") or [])

    def _release(self, segment_index: int, error: str) -> None:
        self._post("release", {
            "source_type": self.source_type, "source_key": self.source_key,
            "segment_indexes": [segment_index], "claimer": self.claimer, "error": error[:1900],
        })

    def _translate(self, texts: List[str], source_language: str, target_language: str) -> Dict[str, str]:
        async def run() -> List[str]:
            async with GoogleTranslator() as translator:
                results = await translator.translate_batch(
                    texts, src=source_language, dest=target_language, use_cache=False
                )
            return [result.translated_text or "" for result in results]

        outputs = asyncio.run(run())
        translated = {text: out for text, out in zip(texts, outputs) if out}
        missing = [text for text in texts if text not in translated]
        if missing and self.ai_fallback:
            for row in ai_batch_translate.translate_lines(
                missing, source_language, target_language, source="study_gen_backfill"
            ):
                translated[row["word"]] = row["translation"]
        return translated

    def _translate_items(self, items: List[Dict[str, Any]]) -> Dict[tuple, Dict[str, str]]:
        """One Google call per (source, target) language pair across all claimed segments."""
        texts_by_pair: Dict[tuple, List[str]] = {}
        for item in items:
            source_language = str(item.get("primary_language") or "auto")
            for target in item.get("target_languages") or []:
                bucket = texts_by_pair.setdefault((source_language, str(target)), [])
                bucket.extend(str(slot["text"]) for slot in item.get("slots") or [] if str(slot.get("text") or "").strip())
        return {
            pair: self._translate(list(dict.fromkeys(texts)), pair[0], pair[1])
            for pair, texts in texts_by_pair.items()
        }

    def _process(self, item: Dict[str, Any], translated_by_pair: Dict[tuple, Dict[str, str]]) -> bool:
        segment_index = int(item["segment_index"])
        source_language = str(item.get("primary_language") or "auto")
        slots = [slot for slot in item.get("slots") or [] if str(slot.get("text") or "").strip()]
        targets = [str(code) for code in item.get("target_languages") or []]
        langs_by_seq: Dict[int, Dict[str, Dict[str, str]]] = {int(slot["seq"]): {} for slot in slots}
        for target in targets:
            translated = translated_by_pair.get((source_language, target), {})
            missing = [slot for slot in slots if str(slot["text"]) not in translated]
            if missing:
                self._release(segment_index, f"google translate returned nothing for {len(missing)}/{len(slots)} slot(s) -> {target}")
                ColorPrint.yellow(
                    f"[StudyGenBackfill] segment {segment_index} released: {len(missing)}/{len(slots)} untranslated ({target})"
                )
                return False
            for slot in slots:
                langs_by_seq[int(slot["seq"])][target] = {"text": translated[str(slot["text"])]}
        body = {
            "source_type": self.source_type, "source_key": self.source_key, "segment_index": segment_index,
            "claimer": self.claimer, "provider": SUBMIT_PROVIDER_AI if self.ai_fallback else SUBMIT_PROVIDER,
            "languages": targets,
            "slots": [{"seq": seq, "langs": langs} for seq, langs in langs_by_seq.items() if langs],
        }
        data = self._post("submit", body)
        if data.get("_status") != 200 or not data.get("ok"):
            self._release(segment_index, f"submit failed status={data.get('_status')} error={data.get('error')}")
            ColorPrint.red(f"[StudyGenBackfill] segment {segment_index} submit failed status={data.get('_status')} error={data.get('error')}")
            return False
        with self._lock:
            self._slots_translated += len(body["slots"])
        return True

    def _wait_for_google(self) -> None:
        deadline = time.monotonic() + GOOGLE_RETRY_WAIT_SECONDS
        while time.monotonic() < deadline and not self._stop.is_set():
            time.sleep(1.0)
        while not google_batch_client.available() and not self._stop.is_set():
            time.sleep(2.0)

    def _record(self, success: bool) -> None:
        with self._lock:
            if success:
                self._done_segments += 1
                self._consecutive_failures = 0
            else:
                self._failed_segments += 1
                self._consecutive_failures += 1
            if self._consecutive_failures >= MAX_CONSECUTIVE_FAILURES:
                ColorPrint.red(f"[StudyGenBackfill] aborting after {self._consecutive_failures} consecutive failed segments")
                self._stop.set()
            if self._done_segments and self._done_segments % PROGRESS_EVERY_SEGMENTS == 0 and success:
                elapsed = max(1.0, time.monotonic() - self._started)
                ColorPrint.green(
                    f"[StudyGenBackfill] done={self._done_segments} failed={self._failed_segments} "
                    f"slots={self._slots_translated} rate={self._slots_translated / elapsed * 3600:.0f} slots/h"
                )

    def _worker(self) -> None:
        while not self._stop.is_set():
            with self._lock:
                if self.max_segments and self._claimed_segments >= self.max_segments:
                    return
            try:
                items = self._claim()
            except OSError as exc:
                ColorPrint.yellow(f"[StudyGenBackfill] claim transport error: {exc}")
                self._record(False)
                time.sleep(NETWORK_RETRY_WAIT_SECONDS)
                continue
            if not items:
                return
            with self._lock:
                self._claimed_segments += len(items)
            try:
                translated_by_pair = self._translate_items(items)
            except Exception as exc:  # noqa: BLE001 - lease must be released whatever the provider raised
                ColorPrint.red(f"[StudyGenBackfill] translate failed, releasing {len(items)} segment(s): {exc}")
                for item in items:
                    self._release(int(item["segment_index"]), f"translate error: {exc}")
                self._record(False)
                self._wait_for_google()
                continue
            for item in items:
                success = self._process(item, translated_by_pair)
                self._record(success)
                if not success:
                    self._wait_for_google()

    def run(self) -> Dict[str, Any]:
        threads = [threading.Thread(target=self._worker, name=f"study-gen-backfill-{n}") for n in range(self.workers)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()
        elapsed = time.monotonic() - self._started
        summary = {
            "done_segments": self._done_segments, "failed_segments": self._failed_segments,
            "slots_translated": self._slots_translated, "seconds": round(elapsed, 1),
        }
        ColorPrint.green(f"[StudyGenBackfill] finished {summary}")
        return summary


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Translate study-gen segments with Google and submit them to Laravel.")
    parser.add_argument("--source-key", required=True)
    parser.add_argument("--source-type", default=DEFAULT_SOURCE_TYPE)
    parser.add_argument("--languages", default="zh", help="comma separated target languages")
    parser.add_argument("--base-url", default=None, help="Laravel origin; default is the selected server")
    parser.add_argument("--target-chars", type=int, default=DEFAULT_TARGET_CHARS)
    parser.add_argument("--workers", type=int, default=DEFAULT_WORKERS)
    parser.add_argument("--max-segments", type=int, default=0, help="stop after claiming this many segments (0 = all)")
    parser.add_argument("--ai-fallback", action="store_true", help="translate Google misses with the AI gateway")
    args = parser.parse_args(argv)
    languages = [code.strip() for code in args.languages.split(",") if code.strip()]
    summary = StudyGenBackfill(
        args.source_type, args.source_key, languages, base_url=args.base_url,
        target_chars=args.target_chars, workers=args.workers,
        ai_fallback=args.ai_fallback, max_segments=args.max_segments,
    ).run()
    return 0 if summary["failed_segments"] == 0 else 1


if __name__ == "__main__":
    code = main()
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(code)
