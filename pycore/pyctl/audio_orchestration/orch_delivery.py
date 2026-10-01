# -*- coding: utf-8 -*-
"""Audio orchestration kind of the shared Laravel delivery outbox.

  * ``audio_orch.output``   - assembled task output (task metadata + every
    finished segment mp3), for every source, uploaded idempotently to the
    Laravel orchestration ingest (W5 contract). Inventory = every deliverable
    task keyed by task id with its ``meta_hash`` (W7 diff kind
    ``orch_output``; a legacy server diffs locally against its delivered
    state).

Manifest word/sentence clips are local audio cache clips: they go through
the cache-level kind ``audio_cache.resource`` (``pyctl/tts/
audio_resource_delivery.py``). Every Laravel server (namespace) is completed
on its own; nothing here decides delivery from a local marker.
"""

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, Iterator, List, Optional, Tuple

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.common.queue_center_contract import http_transfer_contract, queue_center_endpoint
from pycore.pyutils.laravel.client import laravel_client, laravel_envelope
from pycore.pyutils.laravel.delivery_diff import DIFF_KIND_ORCH_OUTPUT, laravel_delivery_diff_client
from pycore.pyutils.laravel.endpoint_manager import laravel_endpoint_manager
from pycore.pyutils.laravel.delivery_outbox import (
    OUTCOME_DEAD_LETTER,
    OUTCOME_DONE,
    OUTCOME_RETRY,
    DeliveryKind,
    laravel_delivery_outbox,
)
from pycore.pyutils.common.client_key_auth import get_pycore_machine_id
from pycore.pyutils.laravel.progress_upload import laravel_progress_uploader
from pycore.pyctl.audio_orchestration import orch_sources, orch_store


OUTPUT_KIND = "audio_orch.output"
OUTPUT_DELIVERABLE_STATUSES = ("done", "failed")
# W5 contract (REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md).
ORCH_AUDIO_INGEST_TASKS_PATH = queue_center_endpoint("orch_audio_ingest_tasks")
ORCH_AUDIO_INGEST_SEGMENT_PATH = queue_center_endpoint("orch_audio_ingest_segment")
ORCH_AUDIO_MAX_SENTENCES = 5000
ORCH_AUDIO_MAX_RESOURCES = 2000
ORCH_AUDIO_MAX_SOURCE_TEXT = 200000
SEGMENT_HASH_CHUNK_BYTES = 1024 * 1024


class OrchDelivery:
    """Register and feed the orchestration output kind."""

    def register(self) -> None:
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
            f"sentences:{orch_sources.task_sentences_version(task)}",
            *(
                f"{int(segment['index'])}:{Path(str(segment['output'])).stat().st_size}:"
                f"{Path(str(segment['output'])).stat().st_mtime_ns}"
                for segment in segments
            ),
        ]).encode("utf-8")).hexdigest()

    @staticmethod
    def _file_digest(path: Path) -> Tuple[str, int]:
        """sha256 and size of one segment file, streamed in chunks."""
        digest = hashlib.sha256()
        size = 0
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(SEGMENT_HASH_CHUNK_BYTES), b""):
                digest.update(chunk)
                size += len(chunk)
        return digest.hexdigest(), size

    def _output_payload(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """W5 ingest task + the finished segment files by index (never all
        segment bytes in memory; uploads read one segment at a time)."""
        paths = {int(segment["index"]): Path(str(segment["output"])) for segment in self._done_segments(task)}
        planned = {int(segment.get("index") or 0): segment for segment in (task.get("segments") or [])}
        segments = [
            self._segment_payload(index, *self._file_digest(path), planned.get(index) or {})
            for index, path in sorted(paths.items())
        ]
        return {
            "ingest": self._ingest_task(task, segments, str(task.get("generation_id") or "legacy")),
            "paths": paths,
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
    def _segment_payload(index: int, sha256: str, size: int, planned: Dict[str, Any]) -> Dict[str, Any]:
        """W5 segment entry; tasks assembled before clip timing existed send
        ``timeline: []`` (no re-assembly). Unknown optional fields are omitted."""
        payload = {
            "index": index,
            "sha256": sha256,
            "bytes": size,
            "start": planned.get("start"),
            "end": planned.get("end"),
            "status": "done",
            "started_at": planned.get("started_at"),
            "finished_at": planned.get("finished_at"),
            "duration_ms": planned.get("duration_ms"),
            "timeline": list(planned.get("timeline") or []),
        }
        return {key: value for key, value in payload.items() if value is not None}

    @staticmethod
    def _server_needs_output(base_url: str, task_id: str, meta_hash: str) -> bool:
        """Ask the server (W7 diff, one small request) whether it still needs
        this task output: metadata current and every segment stored. A retry
        starts here because the previous attempt may have been ingested even
        though its response never arrived; the heavy ingest is only re-sent
        for what the server really lacks."""
        server_id = str(laravel_endpoint_manager.server_identity(base_url).get("server_id") or "")
        if not server_id or not laravel_delivery_diff_client.supports(base_url, server_id, DIFF_KIND_ORCH_OUTPUT):
            return True
        result = laravel_delivery_diff_client.diff(
            base_url, server_id, DIFF_KIND_ORCH_OUTPUT, [{"key": task_id, "meta_hash": meta_hash}],
        )
        if not result.get("success") or result.get("rejected"):
            return True
        return any(str(need.get("key") or "") == task_id for need in result.get("need") or [])

    def _deliver_output(self, claimed: Dict[str, Any], owner: str) -> Dict[str, Any]:
        task = orch_store.get_task(str(claimed.get("task_id") or ""))
        if not task or not self._output_signature(task):
            # Task deleted or no longer deliverable: nothing to send.
            return {"status": OUTCOME_DONE, "superseded": True}
        base_url = str(claimed.get("base_url") or "")
        payload = self._output_payload(task)
        ingest = payload["ingest"]
        paths = payload["paths"]
        laravel_delivery_outbox.cached_hash(
            OUTPUT_KIND, str(claimed["task_id"]), self._output_signature(task), lambda: ingest["meta_hash"],
        )
        if ingest["meta_hash"] != claimed.get("content_hash"):
            # The output changed since enqueue: deliver (and record) the
            # current version.
            laravel_delivery_outbox.patch(claimed["delivery_id"], {"content_hash": ingest["meta_hash"]}, owner=owner)
        if int(claimed.get("delivery_attempts") or 1) > 1 and not self._server_needs_output(
            base_url, str(claimed["task_id"]), ingest["meta_hash"],
        ):
            ColorPrint.green(
                f"[AudioOrch] output already complete on server task={claimed['task_id']} @ {base_url}; no re-upload"
            )
            return {"status": OUTCOME_DONE, "meta_hash": ingest["meta_hash"]}
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
        missing = [int(index) for index in (results[0].get("segments_missing") or []) if int(index) in paths]
        for index in missing:
            receipt = laravel_progress_uploader.upload(
                ORCH_AUDIO_INGEST_SEGMENT_PATH,
                paths[index].read_bytes(),
                base_url=base_url,
                params={"machine_id": machine_id, "task_id": claimed["task_id"], "index": index},
                reason="audio_orchestration_output",
            )
            if not receipt.get("upload_complete"):
                raise RuntimeError(f"segment {index} upload incomplete")
        ColorPrint.green(
            f"[AudioOrch] output delivered task={claimed['task_id']} @ {base_url} "
            f"{results[0].get('result') or ''} uploaded={len(missing)}/{len(paths)} segments"
        )
        return {"status": OUTCOME_DONE, "meta_hash": ingest["meta_hash"]}


orch_delivery = OrchDelivery()


__all__ = ["OUTPUT_KIND", "orch_delivery"]
