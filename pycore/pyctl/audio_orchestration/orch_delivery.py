# -*- coding: utf-8 -*-
"""Audio orchestration kinds of the shared Laravel delivery outbox.

  * ``audio_orch.resource`` - manifest word/sentence clips in the Laravel
    word/sentence audio stores. Inventory = every resolved manifest clip of
    every task (W7 diff kinds ``word_audio`` / ``sentence_audio``, presence
    only); small clips go through the W7 batch upload, a legacy server gets
    the per-clip domain report (and no reconnect diff, as before).
  * ``audio_orch.output``   - assembled task output (task metadata + every
    finished segment mp3), for every source, uploaded idempotently to the
    Laravel orchestration ingest (W5 contract). Inventory = every deliverable
    task keyed by task id with its ``meta_hash`` (W7 diff kind
    ``orch_output``; a legacy server diffs locally against its delivered
    state).

Every Laravel server (namespace) is completed on its own; nothing here
decides delivery from a local marker.
"""

import base64
import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.queue_center_contract import http_transfer_contract
from pycore.pyutils.common.strtools.normalization import media_content_id
from pycore.pyutils.laravel.client import laravel_client, laravel_envelope
from pycore.pyutils.laravel.delivery_diff import (
    BATCH_STORED_STATUSES,
    BATCH_TERMINAL_REJECTIONS,
    DIFF_KIND_ORCH_OUTPUT,
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
from pycore.pyutils.laravel.identity import get_pycore_machine_id
from pycore.pyutils.laravel.progress_upload import laravel_progress_uploader
from pycore.pyctl.audio_orchestration import orch_sources, orch_store
from pycore.pyctl.tts import word_audio_service


RESOURCE_KIND = "audio_orch.resource"
OUTPUT_KIND = "audio_orch.output"
SENTENCE_REPORT_PATH = "/api/app_qy_v1/ai_tools/tts/sentence/report"
OUTPUT_DELIVERABLE_STATUSES = ("done", "failed")
DELIVERY_WORKER_ID = "pycore-audio-orchestration"
RESOURCE_BATCH_LIMIT = 200
# W5 contract (REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md).
ORCH_AUDIO_INGEST_TASKS_PATH = "/api/app_qy_v1/orch_audio/ingest/tasks"
ORCH_AUDIO_INGEST_SEGMENT_PATH = "/api/app_qy_v1/orch_audio/ingest/segment-audio"
ORCH_AUDIO_MAX_SENTENCES = 5000
ORCH_AUDIO_MAX_RESOURCES = 2000
ORCH_AUDIO_MAX_SOURCE_TEXT = 200000
RESOURCE_DIFF_KINDS = {"word": DIFF_KIND_WORD_AUDIO, "sentence": DIFF_KIND_SENTENCE_AUDIO}


class OrchDelivery:
    """Register and feed the orchestration delivery kinds."""

    def register(self) -> None:
        laravel_delivery_outbox.register(DeliveryKind(
            name=RESOURCE_KIND,
            deliver=self._deliver_resource,
            deliver_batch=self._deliver_resources,
            inventory=self._resource_inventory,
            parallel=1,
            batch_limit=RESOURCE_BATCH_LIMIT,
            retry_initial_seconds=5.0,
            retry_max_seconds=300.0,
        ))
        laravel_delivery_outbox.register(DeliveryKind(
            name=OUTPUT_KIND,
            deliver=self._deliver_output,
            inventory=self._output_inventory,
            legacy_reconcile=True,
            seed_markers=self._output_seed_markers,
            diff_kind=DIFF_KIND_ORCH_OUTPUT,
            permanent_error=lambda error: str(error).startswith("HTTP 422"),
            parallel=1,
            retry_initial_seconds=5.0,
            retry_max_seconds=300.0,
        ))

    # ------------------------------------------------------------------ #
    # manifest resources                                                  #
    # ------------------------------------------------------------------ #
    @staticmethod
    def resource_key(resource: Dict[str, Any]) -> str:
        """W7 ``word_audio`` / ``sentence_audio`` key of one clip."""
        language = str(resource.get("language") or "en").strip().lower() or "en"
        text = str(resource.get("text") or "")
        if resource.get("kind") == "sentence":
            return f"{language}:{media_content_id(text)}"
        return f"{language}:{hashlib.md5(text.strip().lower().encode('utf-8')).hexdigest()}"

    def _resource_record(self, resource: Dict[str, Any], generation_id: str) -> Dict[str, Any]:
        diff_kind = RESOURCE_DIFF_KINDS[str(resource["kind"])]
        key = self.resource_key(resource)
        item_key = laravel_delivery_outbox.item_key(diff_kind, key)
        return {
            "delivery_id": laravel_delivery_outbox.delivery_id(RESOURCE_KIND, item_key, ""),
            "item_key": item_key,
            "state_kind": RESOURCE_KIND,
            "content_hash": "",
            "resource": {
                field: resource.get(field)
                for field in ("kind", "language", "text", "provider", "resource_id")
            },
            "payload_path": str(resource.get("audio_path") or ""),
            "group_key": generation_id,
        }

    def synchronize_audio(self, resource: Dict[str, Any], base_url: Optional[str]) -> Dict[str, Any]:
        """Queue one newly generated clip for every target server (the
        generation's endpoint first)."""
        record = self._resource_record(resource, str(resource.get("generation_id") or ""))
        namespace = laravel_endpoint_manager.delivery_namespace(base_url or "")
        rows = [
            laravel_delivery_outbox.enqueue(RESOURCE_KIND, record, payload_file=str(resource["audio_path"]), namespace=name)
            for name in [namespace, *[name for name in laravel_delivery_outbox.target_namespaces() if name != namespace]]
        ]
        if rows[0].get("already_delivered"):
            return {"success": True, "queued": False, "already_uploaded": True}
        return {"success": True, "queued": True, "delivery_id": rows[0]["delivery_id"]}

    def _resource_inventory(self) -> Iterator[Dict[str, Any]]:
        seen = set()
        for task in orch_store.list_tasks():
            manifest = orch_store.load_manifest(str(task.get("task_id") or ""))
            resolved = manifest.get("resolved") if isinstance(manifest.get("resolved"), dict) else {}
            meta = manifest.get("resource_meta") if isinstance(manifest.get("resource_meta"), dict) else {}
            generation_id = str(manifest.get("generation_id") or "")
            for items in manifest.get("segment_items") or []:
                for item in items or []:
                    resource_id = str(item.get("resource_id") or "")
                    audio_path = str(resolved.get(resource_id) or "")
                    if item.get("kind") not in RESOURCE_DIFF_KINDS or not item.get("text") or resource_id in seen:
                        continue
                    if not audio_path or not Path(audio_path).is_file():
                        continue
                    seen.add(resource_id)
                    resource = {
                        **item, "audio_path": audio_path,
                        "provider": str((meta.get(resource_id) or {}).get("provider") or "") or "cache",
                    }
                    yield {
                        "key": self.resource_key(resource),
                        "diff_kind": RESOURCE_DIFF_KINDS[str(item["kind"])],
                        "hash": "",
                        "record": self._resource_record(resource, generation_id),
                    }

    @staticmethod
    def pending_resource_counts() -> Dict[str, int]:
        return {
            key: entry["pending"] + entry["dead_letter"]
            for key, entry in laravel_delivery_outbox.counts_by_group(RESOURCE_KIND).items()
        }

    @staticmethod
    def _deliver_resources(claimed: List[Dict[str, Any]], owners: Dict[str, str]) -> Dict[str, Dict[str, Any]]:
        """W7 batch upload (one request + one offset-v1 content stream per
        server batch); rows it does not take fall back to the single upload."""
        base_url = str(claimed[0].get("base_url") or "")
        server_id = str(laravel_endpoint_manager.server_identity(base_url).get("server_id") or "")
        outcomes: Dict[str, Dict[str, Any]] = {}
        by_kind: Dict[str, List[Dict[str, Any]]] = {}
        for row in claimed:
            resource = row["resource"]
            diff_kind = RESOURCE_DIFF_KINDS[str(resource["kind"])]
            payload = Path(str(row.get("payload_path") or ""))
            if not payload.is_file():
                outcomes[row["delivery_id"]] = {"status": OUTCOME_DEAD_LETTER, "error": "cached audio is missing"}
                continue
            if not laravel_delivery_diff_client.supports(base_url, server_id, diff_kind):
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
        resource = claimed["resource"]
        base_url = claimed.get("base_url")
        payload_path = Path(str(claimed.get("payload_path") or ""))
        if not payload_path.is_file():
            return {"status": OUTCOME_DEAD_LETTER, "error": "cached audio is missing"}
        payload = payload_path.read_bytes()
        if resource["kind"] == "sentence":
            receipt = laravel_progress_uploader.upload(
                SENTENCE_REPORT_PATH, payload,
                base_url=base_url,
                params={"content_id": media_content_id(resource["text"]), "text": resource["text"],
                        "language": resource["language"], "worker_id": DELIVERY_WORKER_ID,
                        "success": "true", "provider": resource.get("provider") or "cache"},
                reason="audio_orchestration_manifest",
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
            # apply to arbitrary book tokens; terminal, not retry-poison.
            ColorPrint.gray(f"[AudioOrch] delivery={claimed['delivery_id']} word not in dictionary; no fill needed")
        elif not receipt.get("success") or receipt_status not in ("stored", "exists"):
            raise RuntimeError(str(receipt.get("error") or receipt.get("message") or "word_upload_incomplete"))
        return {"status": OUTCOME_DONE}

    # ------------------------------------------------------------------ #
    # task output                                                         #
    # ------------------------------------------------------------------ #
    @staticmethod
    def _done_segments(task: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [
            segment for segment in (task.get("segments") or [])
            if segment.get("status") == "done"
            and segment.get("output")
            and Path(str(segment["output"])).is_file()
        ]

    def _output_signature(self, task: Dict[str, Any]) -> str:
        """Cheap version of one task output: generation + every finished
        segment file (index, size, mtime); '' = nothing deliverable."""
        if str(task.get("status") or "") not in OUTPUT_DELIVERABLE_STATUSES:
            return ""
        segments = self._done_segments(task)
        if not segments:
            return ""
        return hashlib.sha1("|".join([
            str(task.get("generation_id") or "legacy"),
            *(
                f"{int(segment['index'])}:{Path(str(segment['output'])).stat().st_size}:"
                f"{Path(str(segment['output'])).stat().st_mtime_ns}"
                for segment in segments
            ),
        ]).encode("utf-8")).hexdigest()

    def _output_payload(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """W5 ingest task + the finished segment bytes by index."""
        contents = {int(segment["index"]): Path(str(segment["output"])).read_bytes() for segment in self._done_segments(task)}
        planned = {int(segment.get("index") or 0): segment for segment in (task.get("segments") or [])}
        segments = [self._segment_payload(index, content, planned.get(index) or {}) for index, content in sorted(contents.items())]
        return {
            "ingest": self._ingest_task(task, segments, str(task.get("generation_id") or "legacy")),
            "contents": contents,
        }

    def output_meta_hash(self, task: Dict[str, Any], compute: bool = True) -> str:
        """``meta_hash`` of the task's current output ('' = none), cached
        per output version (``compute=False``: cached value only)."""
        signature = self._output_signature(task)
        if not signature:
            return ""
        return laravel_delivery_outbox.cached_hash(
            OUTPUT_KIND, str(task.get("task_id") or ""), signature,
            (lambda: self._output_payload(task)["ingest"]["meta_hash"]) if compute else None,
        )

    @staticmethod
    def _output_record(task: Dict[str, Any], meta_hash: str) -> Dict[str, Any]:
        task_id = str(task.get("task_id") or "")
        item_key = laravel_delivery_outbox.item_key(DIFF_KIND_ORCH_OUTPUT, task_id)
        return {
            "delivery_id": laravel_delivery_outbox.delivery_id(OUTPUT_KIND, item_key, meta_hash),
            "item_key": item_key,
            "state_kind": OUTPUT_KIND,
            "content_hash": meta_hash,
            "group_key": task_id,
            "task_id": task_id,
            "generation_id": str(task.get("generation_id") or "legacy"),
            "source": orch_sources.task_source(task),
        }

    def enqueue_task_output(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """End of a run: queue the output for every target server."""
        meta_hash = self.output_meta_hash(task)
        if not meta_hash:
            return {"queued": False}
        row = laravel_delivery_outbox.enqueue(OUTPUT_KIND, self._output_record(task, meta_hash))
        return {"queued": not row.get("already_delivered"), "delivery_id": row["delivery_id"]}

    def _output_inventory(self) -> Iterator[Dict[str, Any]]:
        for task in orch_store.list_tasks():
            meta_hash = self.output_meta_hash(task)
            if not meta_hash:
                continue
            task_id = str(task.get("task_id") or "")
            yield {
                "key": task_id,
                "hash": meta_hash,
                "wire": {"key": task_id, "meta_hash": meta_hash},
                "record": self._output_record(task, meta_hash),
            }

    @staticmethod
    def _output_seed_markers() -> Iterator[Dict[str, Any]]:
        """v1 per-task ``output_delivery`` markers (un-namespaced): delivered
        to the server selected before the upgrade."""
        for task in orch_store.list_tasks():
            marker = task.get("output_delivery")
            if isinstance(marker, dict) and marker.get("meta_hash") and marker.get("generation_id") == str(task.get("generation_id") or "legacy"):
                yield {"key": str(task.get("task_id") or ""), "hash": str(marker["meta_hash"])}

    def output_counts(self, tasks: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Dict[str, int]]:
        """Per task on the active server: waiting / dead-letter upload rows
        (GROUP BY) and whether its current output is delivered there."""
        tasks = orch_store.list_tasks() if tasks is None else tasks
        groups = laravel_delivery_outbox.counts_by_group(OUTPUT_KIND)
        keys = {
            str(task.get("task_id") or ""): laravel_delivery_outbox.item_key(DIFF_KIND_ORCH_OUTPUT, str(task.get("task_id") or ""))
            for task in tasks
        }
        delivered = laravel_delivery_outbox.delivered_hashes(OUTPUT_KIND, list(keys.values()))
        counts: Dict[str, Dict[str, int]] = {}
        for task in tasks:
            task_id = str(task.get("task_id") or "")
            entry = groups.get(task_id) or {}
            meta_hash = self.output_meta_hash(task, compute=False)
            counts[task_id] = {
                "pending": int(entry.get("pending") or 0),
                "dead_letter": int(entry.get("dead_letter") or 0),
                "delivered": 1 if meta_hash and delivered.get(keys[task_id]) == meta_hash else 0,
            }
        return counts

    @staticmethod
    def _task_resources(task_id: str) -> List[Dict[str, Any]]:
        seen = set()
        resources = []
        for items in orch_store.load_manifest(task_id).get("segment_items") or []:
            for item in items or []:
                key = (str(item.get("kind") or ""), str(item.get("language") or ""), str(item.get("text") or ""))
                if key[0] not in ("word", "sentence") or not key[2] or key in seen:
                    continue
                seen.add(key)
                resources.append({"kind": key[0], "text": key[2], "language": key[1] or "en"})
                if len(resources) >= ORCH_AUDIO_MAX_RESOURCES:
                    return resources
        return resources

    def _ingest_task(self, task: Dict[str, Any], segments: List[Dict[str, Any]], generation_id: str) -> Dict[str, Any]:
        """W5 ``Task`` payload; ``meta_hash`` covers every field plus the
        pycore generation id."""
        task_id = str(task.get("task_id") or "")
        book = task.get("book") or {}
        # None = sentences not cached locally: the field is omitted so Laravel
        # keeps what it has (an explicit [] would clear it).
        sentences = orch_sources.cached_task_sentences(task)
        resources = self._task_resources(task_id)
        payload: Dict[str, Any] = {
            "task_id": task_id,
            "source": orch_sources.task_source(task),
            "name": str(task.get("name") or "")[:255],
            "language": str(book.get("language") or (sentences[0].get("language") if sentences else "") or "en"),
            "status": str(task.get("status") or ""),
            "source_ref": {
                **(task.get("source_ref") or {}),
                **({"book": {"source_key": book.get("source_key"), "title": book.get("title")}} if book else {}),
            },
            "segments": segments,
            "pattern": task.get("pattern") or [],
            "created_at": task.get("created_at"),
            "updated_at": task.get("updated_at"),
            "generation_started_at": task.get("generation_started_at"),
            "generation_finished_at": task.get("generation_finished_at"),
        }
        if sentences:
            payload["sentences"] = [
                {
                    "seq": sentence.get("seq"),
                    "language": sentence.get("language"),
                    "text": sentence.get("text"),
                    "languages": sentence.get("languages") or {},
                }
                for sentence in sentences[:ORCH_AUDIO_MAX_SENTENCES]
            ]
        if resources:
            payload["resources"] = resources
        if task.get("source_text"):
            payload["source_text"] = str(task["source_text"])[:ORCH_AUDIO_MAX_SOURCE_TEXT]
        # ``updated_at`` moves on every local save; it is sent but kept out of
        # the hash so an unchanged output stays ``unchanged`` on Laravel.
        canonical = json.dumps(
            {**{key: value for key, value in payload.items() if key != "updated_at"}, "generation_id": generation_id},
            sort_keys=True, ensure_ascii=True, default=str,
        )
        payload["meta_hash"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        return payload

    @staticmethod
    def _segment_payload(index: int, content: bytes, planned: Dict[str, Any]) -> Dict[str, Any]:
        """W5 segment entry; tasks assembled before clip timing existed send
        ``timeline: []`` (no re-assembly). Unknown optional fields are omitted."""
        payload = {
            "index": index,
            "sha256": hashlib.sha256(content).hexdigest(),
            "bytes": len(content),
            "start": planned.get("start"),
            "end": planned.get("end"),
            "status": "done",
            "started_at": planned.get("started_at"),
            "finished_at": planned.get("finished_at"),
            "duration_ms": planned.get("duration_ms"),
            "timeline": list(planned.get("timeline") or []),
        }
        return {key: value for key, value in payload.items() if value is not None}

    def _deliver_output(self, claimed: Dict[str, Any], owner: str) -> Dict[str, Any]:
        task = orch_store.get_task(str(claimed.get("task_id") or ""))
        if not task or not self._output_signature(task):
            # Task deleted or no longer deliverable: nothing to send.
            return {"status": OUTCOME_DONE, "superseded": True}
        base_url = str(claimed.get("base_url") or "")
        payload = self._output_payload(task)
        ingest = payload["ingest"]
        contents = payload["contents"]
        laravel_delivery_outbox.cached_hash(
            OUTPUT_KIND, str(claimed["task_id"]), self._output_signature(task), lambda: ingest["meta_hash"],
        )
        if ingest["meta_hash"] != claimed.get("content_hash"):
            # The output changed since enqueue: deliver (and record) the
            # current version.
            laravel_delivery_outbox.patch(claimed["delivery_id"], {"content_hash": ingest["meta_hash"]}, owner=owner)
        machine_id = get_pycore_machine_id()
        response = laravel_client.post(
            ORCH_AUDIO_INGEST_TASKS_PATH,
            base_url=base_url,
            json={"machine_id": machine_id, "tasks": [ingest]},
            activity_timeout=http_transfer_contract(),
        )
        body = laravel_envelope(response)
        if response.status_code == 422:
            return {"status": OUTCOME_DEAD_LETTER, "error": f"HTTP 422 {body.get('error_code') or ''}".strip()}
        if response.status_code >= 400 or not body.get("success"):
            return {"status": OUTCOME_RETRY, "error": f"HTTP {response.status_code} {body.get('error_code') or ''}".strip()}
        results = (body.get("data") or {}).get("tasks") or [{}]
        missing = [int(index) for index in (results[0].get("segments_missing") or []) if int(index) in contents]
        for index in missing:
            receipt = laravel_progress_uploader.upload(
                ORCH_AUDIO_INGEST_SEGMENT_PATH,
                contents[index],
                base_url=base_url,
                params={"machine_id": machine_id, "task_id": claimed["task_id"], "index": index},
                reason="audio_orchestration_output",
            )
            if not receipt.get("upload_complete"):
                raise RuntimeError(f"segment {index} upload incomplete")
        ColorPrint.green(
            f"[AudioOrch] output delivered task={claimed['task_id']} @ {base_url} "
            f"{results[0].get('result') or ''} uploaded={len(missing)}/{len(contents)} segments"
        )
        return {"status": OUTCOME_DONE, "meta_hash": ingest["meta_hash"]}


orch_delivery = OrchDelivery()


__all__ = ["OUTPUT_KIND", "RESOURCE_KIND", "orch_delivery"]
