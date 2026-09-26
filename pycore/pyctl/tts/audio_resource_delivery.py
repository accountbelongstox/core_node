# -*- coding: utf-8 -*-
"""Audio cache kind of the shared Laravel delivery outbox.

``audio_cache.resource``: every local word/sentence clip pycore holds (the
``audio_resource_ledger`` over the word/sentence caches, audio lane output
and orchestration manifests) is diffed against every Laravel server as W7
``word_audio`` / ``sentence_audio`` (presence only) and what a server lacks
is uploaded through the W7 batch endpoint (a legacy server, or a clip the
batch cannot carry, takes the single-clip upload). It replaces the former
orchestration-only ``audio_orch.resource`` kind.

Audio lane rows keep only their server-specific steps (task result/report to
the dispatching server, local history); they share the clip's delivered
state per server through ``shared_item`` so a clip is transferred once per
server whichever row carries it.
"""

import base64
import hashlib
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.strtools.normalization import media_content_id
from pycore.pyutils.laravel.delivery_diff import (
    BATCH_STORED_STATUSES,
    BATCH_TERMINAL_REJECTIONS,
    DIFF_KIND_SENTENCE_AUDIO,
    DIFF_KIND_WORD_AUDIO,
    laravel_delivery_diff_client,
)
from pycore.pyutils.laravel.delivery_outbox import (
    OUTCOME_DEAD_LETTER,
    OUTCOME_DONE,
    OUTCOME_RETRY,
    DeliveryKind,
    laravel_delivery_outbox,
)
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.laravel.progress_upload import laravel_progress_uploader
from pycore.pyutils.tts.audio_resource_ledger import audio_resource_ledger
from pycore.pyutils.tts.word_audio_cache import cache_root as word_audio_cache_root
from pycore.pyctl.audio_orchestration import orch_store
from pycore.pyctl.task_history.store import query_records
from pycore.pyctl.tts import word_audio_service


RESOURCE_KIND = "audio_cache.resource"
RETIRED_RESOURCE_KINDS = ("audio_orch.resource",)
DIFF_KINDS = {"word": DIFF_KIND_WORD_AUDIO, "sentence": DIFF_KIND_SENTENCE_AUDIO}
SENTENCE_REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/report"
DELIVERY_WORKER_ID = "pycore-audio-cache"
RESOURCE_BATCH_LIMIT = 200
BOOTSTRAP_META_KEY = "audio_cache.ledger_bootstrap"
BOOTSTRAP_HISTORY_LIMIT = 1000
LANE_HISTORY_WORKERS = ("tts_queue_poller", "tts_sentence_worker")


class AudioResourceDelivery:
    """Register and feed the audio cache delivery kind."""

    def register(self) -> None:
        laravel_delivery_outbox.register(DeliveryKind(
            name=RESOURCE_KIND,
            deliver=self._deliver_resource,
            deliver_batch=self._deliver_resources,
            inventory=self._inventory,
            replaces=RETIRED_RESOURCE_KINDS,
            parallel=1,
            batch_limit=RESOURCE_BATCH_LIMIT,
            retry_initial_seconds=5.0,
            retry_max_seconds=300.0,
        ))

    # ------------------------------------------------------------------ #
    # keys + records                                                      #
    # ------------------------------------------------------------------ #
    @staticmethod
    def shared_item(ledger_row: Dict[str, Any]) -> Dict[str, str]:
        """``{kind, item_key}`` of one clip in this kind (for lane rows)."""
        return {
            "kind": RESOURCE_KIND,
            "item_key": laravel_delivery_outbox.item_key(DIFF_KINDS[ledger_row["kind"]], ledger_row["resource_key"]),
        }

    def _record(self, ledger_row: Dict[str, Any], group_key: str = "") -> Dict[str, Any]:
        item_key = self.shared_item(ledger_row)["item_key"]
        return {
            "delivery_id": laravel_delivery_outbox.delivery_id(RESOURCE_KIND, item_key, ""),
            "item_key": item_key,
            "state_kind": RESOURCE_KIND,
            "content_hash": "",
            "resource": {
                field: ledger_row.get(field)
                for field in ("kind", "language", "text", "variant", "provider", "resource_key")
            },
            "payload_path": str(ledger_row["path"]),
            "group_key": group_key,
        }

    def publish(
        self,
        kind: str,
        language: Optional[str],
        text: str,
        path: str,
        provider: str = "",
        variant: str = "",
        group_key: str = "",
        first_namespace: str = "",
        skip_namespace: str = "",
    ) -> Dict[str, Any]:
        """Record one new local clip and queue it for every target server
        (``first_namespace`` first, ``skip_namespace`` excluded - e.g. the
        lane's own server, whose lane row carries the clip)."""
        ledger_row = audio_resource_ledger.record(kind, language, text, path, provider, variant)
        if ledger_row is None:
            return {"queued": False}
        record = self._record(ledger_row, group_key)
        namespaces = [first_namespace] if first_namespace else []
        namespaces += [
            name for name in laravel_delivery_outbox.target_namespaces()
            if name not in namespaces and name != skip_namespace
        ]
        # The ledger path is already a durable cache file (no retained copy).
        rows = [laravel_delivery_outbox.enqueue(RESOURCE_KIND, record, namespace=name) for name in namespaces]
        if not rows:
            return {"queued": False, "ledger": ledger_row}
        if rows[0].get("already_delivered"):
            return {"queued": False, "already_uploaded": True, "ledger": ledger_row}
        return {"queued": True, "delivery_id": rows[0]["delivery_id"], "ledger": ledger_row}

    @staticmethod
    def pending_counts() -> Dict[str, int]:
        """Waiting + dead-letter clip rows per ``group_key`` on the active
        server (orchestration: generation id)."""
        return {
            key: entry["pending"] + entry["dead_letter"]
            for key, entry in laravel_delivery_outbox.counts_by_group(RESOURCE_KIND).items()
        }

    # ------------------------------------------------------------------ #
    # inventory                                                           #
    # ------------------------------------------------------------------ #
    def _inventory(self) -> Iterator[Dict[str, Any]]:
        self._bootstrap()
        for ledger_row in audio_resource_ledger.entries():
            if ledger_row["kind"] not in DIFF_KINDS:
                continue
            yield {
                "key": ledger_row["resource_key"],
                "diff_kind": DIFF_KINDS[ledger_row["kind"]],
                "hash": "",
                "record": self._record(ledger_row),
            }

    def _bootstrap(self) -> None:
        """Once: fold clips stored before the ledger existed into it (word
        cache files whose name keeps the word, orchestration manifests, lane
        task history). Sentence cache files carry no text and stay out."""
        if laravel_delivery_outbox.meta_value(BOOTSTRAP_META_KEY):
            return
        rows = [*self._word_cache_rows(), *self._manifest_rows(), *self._history_rows()]
        for start in range(0, len(rows), 1000):
            audio_resource_ledger.record_many(rows[start:start + 1000])
        laravel_delivery_outbox.set_meta_value(BOOTSTRAP_META_KEY, str(len(rows)))
        ColorPrint.cyan(f"[AudioCacheDelivery] ledger bootstrap recorded {len(rows)} existing clips")

    @staticmethod
    def _word_cache_rows() -> List[Dict[str, Any]]:
        """``<lang>/{word}_{provider}.mp3`` whose name is unambiguous: one
        separator, word and provider made of letters/digits only (a word the
        file name sanitizer changed cannot be recovered)."""
        rows: List[Dict[str, Any]] = []
        root = word_audio_cache_root()
        if not root.is_dir():
            return rows
        for language_dir in sorted(entry for entry in root.iterdir() if entry.is_dir()):
            for path in language_dir.glob("*.mp3"):
                word, _, provider = path.stem.partition("_")
                if path.stem.count("_") != 1 or not word.isalnum() or not provider.isalnum() or path.stat().st_size <= 0:
                    continue
                row = audio_resource_ledger.entry("word", language_dir.name, word, str(path), provider)
                if row is not None:
                    rows.append(row)
        return rows

    @staticmethod
    def _manifest_rows() -> List[Dict[str, Any]]:
        rows: List[Dict[str, Any]] = []
        for task in orch_store.list_tasks():
            manifest = orch_store.load_manifest(str(task.get("task_id") or ""))
            resolved = manifest.get("resolved") if isinstance(manifest.get("resolved"), dict) else {}
            meta = manifest.get("resource_meta") if isinstance(manifest.get("resource_meta"), dict) else {}
            for items in manifest.get("segment_items") or []:
                for item in items or []:
                    resource_id = str(item.get("resource_id") or "")
                    path = str(resolved.get(resource_id) or "")
                    if item.get("kind") not in DIFF_KINDS or not path or not Path(path).is_file():
                        continue
                    row = audio_resource_ledger.entry(
                        str(item["kind"]), item.get("language"), str(item.get("text") or ""), path,
                        str((meta.get(resource_id) or {}).get("provider") or "") or "cache",
                    )
                    if row is not None:
                        rows.append(row)
        return rows

    @staticmethod
    def _history_rows() -> List[Dict[str, Any]]:
        rows: List[Dict[str, Any]] = []
        for worker in LANE_HISTORY_WORKERS:
            for entry in query_records(limit=BOOTSTRAP_HISTORY_LIMIT, worker=worker).get("entries") or []:
                detail = entry.get("detail") if isinstance(entry.get("detail"), dict) else {}
                path = str(detail.get("audio_path") or "")
                kind = str(detail.get("audio_kind") or ("sentence" if worker == "tts_sentence_worker" else "word"))
                if not entry.get("success") or kind not in DIFF_KINDS or not path or not Path(path).is_file():
                    continue
                row = audio_resource_ledger.entry(
                    kind, entry.get("language"), str(entry.get("content") or ""), path,
                    str(detail.get("provider") or ""), str(detail.get("variant_key") or ""),
                )
                if row is not None:
                    rows.append(row)
        return rows

    # ------------------------------------------------------------------ #
    # delivery                                                            #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _deliver_resources(claimed: List[Dict[str, Any]], owners: Dict[str, str]) -> Dict[str, Dict[str, Any]]:
        """W7 batch upload (one manifest + one offset-v1 content stream per
        server batch); rows it does not take fall back to the single upload."""
        base_url = str(claimed[0].get("base_url") or "")
        server_id = str(laravel_endpoint_manager.server_identity(base_url).get("server_id") or "")
        outcomes: Dict[str, Dict[str, Any]] = {}
        by_kind: Dict[str, List[Dict[str, Any]]] = {}
        for row in claimed:
            resource = row["resource"]
            diff_kind = DIFF_KINDS[str(resource["kind"])]
            payload = Path(str(row.get("payload_path") or ""))
            if not payload.is_file():
                outcomes[row["delivery_id"]] = {"status": OUTCOME_DEAD_LETTER, "error": "cached audio is missing"}
                continue
            if not row.get("item_key") or not laravel_delivery_diff_client.supports(base_url, server_id, diff_kind):
                # Pre-namespace rows carry no wire key; legacy servers have no
                # batch endpoint: both take the single-clip path.
                continue
            content = payload.read_bytes()
            if not laravel_delivery_diff_client.batchable(base_url, server_id, len(content)):
                continue
            item = {
                "key": str(row["item_key"]).split(":", 1)[1],
                "content": content,
                "provider": resource.get("provider") or "cache",
                "delivery_id": row["delivery_id"],
            }
            item["cleaned_word" if resource["kind"] == "word" else "text"] = resource["text"]
            by_kind.setdefault(diff_kind, []).append(item)
        for diff_kind, items in by_kind.items():
            for batch in laravel_delivery_diff_client.split_batches(base_url, server_id, items):
                result = laravel_delivery_diff_client.upload_batch(base_url, diff_kind, batch)
                for item in batch:
                    status = (result.get("results") or {}).get(item["key"], "")
                    if not result.get("success"):
                        outcomes[item["delivery_id"]] = {"status": OUTCOME_RETRY, "error": str(result.get("error") or "")}
                    elif status in BATCH_STORED_STATUSES or status in BATCH_TERMINAL_REJECTIONS:
                        # no_target / invalid: the server has no row to fill
                        # for it; terminal, not retry-poison.
                        outcomes[item["delivery_id"]] = {"status": OUTCOME_DONE, "batch_status": status}
                    else:
                        outcomes[item["delivery_id"]] = {"status": OUTCOME_RETRY, "error": f"batch item {status or 'unreported'}"}
        return outcomes

    @staticmethod
    def _deliver_resource(claimed: Dict[str, Any], owner: str) -> Dict[str, Any]:
        """Single-clip upload (legacy server or unbatchable clip): sentence
        report (offset-v1) or word fill-missing upload, primary variant."""
        resource = claimed["resource"]
        base_url = claimed.get("base_url")
        payload_path = Path(str(claimed.get("payload_path") or ""))
        if not payload_path.is_file():
            return {"status": OUTCOME_DEAD_LETTER, "error": "cached audio is missing"}
        if resource.get("variant"):
            # Only the batch endpoint addresses variants; a legacy server
            # receives variants through its own lane tasks.
            return {"status": OUTCOME_DONE, "skipped": "variant_requires_batch"}
        payload = payload_path.read_bytes()
        if resource["kind"] == "sentence":
            receipt = laravel_progress_uploader.upload(
                SENTENCE_REPORT_PATH, payload,
                base_url=base_url,
                params={"content_id": media_content_id(resource["text"]), "text": resource["text"],
                        "language": resource["language"], "worker_id": DELIVERY_WORKER_ID,
                        "success": "true", "provider": resource.get("provider") or "cache"},
                reason="audio_cache_resource",
            )
            if not receipt.get("upload_complete"):
                raise RuntimeError("sentence_upload_incomplete")
            return {"status": OUTCOME_DONE}
        word_audio_service.word_audio_media(
            resource["text"], resource["language"], base_url=base_url, metadata_only=True,
        )
        receipt = word_audio_service.upload_word_audio({
            "md5": hashlib.md5(resource["text"].strip().lower().encode("utf-8")).hexdigest(),
            "lang": resource["language"], "provider": resource.get("provider") or "cache",
            "cleaned_word": resource["text"],
            "audio_base64": base64.b64encode(payload).decode("ascii"),
        }, base_url=base_url)
        receipt_status = (receipt.get("data") or {}).get("status")
        if receipt_status == "not_found":
            # No dictionary row for this (lang, md5): fill-missing does not
            # apply to arbitrary tokens; terminal, not retry-poison.
            ColorPrint.gray(f"[AudioCacheDelivery] delivery={claimed['delivery_id']} word not in dictionary; no fill needed")
        elif not receipt.get("success") or receipt_status not in ("stored", "exists"):
            raise RuntimeError(str(receipt.get("error") or receipt.get("message") or "word_upload_incomplete"))
        return {"status": OUTCOME_DONE}


audio_resource_delivery = AudioResourceDelivery()


__all__ = ["RESOURCE_KIND", "audio_resource_delivery"]
