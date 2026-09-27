# -*- coding: utf-8 -*-
"""Agent-history article kinds of the shared Laravel delivery outbox.

  * ``agent_history.article``       - full submit of a record the server
    does not have (W7 diff ``article`` reason ``missing``).
  * ``agent_history.article_audio`` - replacement of the published audio
    whose sha256 differs from the local mp3 (reason ``stale``).

Inventory = every local record keyed by its id with the sha256 of its local
mp3. Each Laravel server is diffed on its own; a legacy server diffs locally
against its delivered state (seeded once from the v1 ``uploaded`` /
``rebuild_uploaded`` flags). The record flags stay a local display of the
last upload, never the delivery authority.
"""

import base64
import hashlib
from typing import Any, Dict, Iterator

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyutils.laravel.delivery_diff import DIFF_KIND_ARTICLE
from pycore.pyutils.laravel.delivery_outbox import OUTCOME_DONE, DeliveryKind, laravel_delivery_outbox
from pycore.pyctl.agent_history.pipeline.config import get_config
from pycore.pyctl.agent_history.pipeline.laravel_stage import replace_audio_on_laravel, upload_to_laravel
import pycore.pyutils.agent_history.article_records as records


ARTICLE_KIND = "agent_history.article"
ARTICLE_AUDIO_KIND = "agent_history.article_audio"
RETRY_INITIAL_SECONDS = 2.0
RETRY_MAX_SECONDS = 300.0


class AgentHistoryDelivery:
    """Register and feed the agent-history article delivery kinds."""

    def register(self) -> None:
        laravel_delivery_outbox.register(DeliveryKind(
            name=ARTICLE_KIND,
            deliver=self._deliver_article,
            inventory=self._inventory,
            legacy_reconcile=True,
            seed_markers=self._seed_markers,
            diff_kind=DIFF_KIND_ARTICLE,
            stale_kind=ARTICLE_AUDIO_KIND,
            ready=self._enabled,
            retry_initial_seconds=RETRY_INITIAL_SECONDS,
            retry_max_seconds=RETRY_MAX_SECONDS,
        ))
        laravel_delivery_outbox.register(DeliveryKind(
            name=ARTICLE_AUDIO_KIND,
            deliver=self._deliver_article_audio,
            ready=self._enabled,
            retry_initial_seconds=RETRY_INITIAL_SECONDS,
            retry_max_seconds=RETRY_MAX_SECONDS,
        ))

    @staticmethod
    def _enabled() -> bool:
        cfg = get_config()
        return bool(cfg.get("enabled") and cfg.get("extract_as_article"))

    @staticmethod
    def audio_sha256(record_id: str) -> str:
        """sha256 of the record's local mp3 ('' = no audio), cached per
        file size + mtime."""
        path = records.audio_path(record_id)
        if path is None:
            return ""
        stat = path.stat()
        return laravel_delivery_outbox.cached_hash(
            ARTICLE_KIND, record_id, f"{stat.st_size}-{stat.st_mtime_ns}",
            lambda: hashlib.sha256(path.read_bytes()).hexdigest(),
        )

    @staticmethod
    def _record(kind: str, record_id: str, audio_sha256: str) -> Dict[str, Any]:
        item_key = laravel_delivery_outbox.item_key(DIFF_KIND_ARTICLE, record_id)
        return {
            "delivery_id": laravel_delivery_outbox.delivery_id(kind, item_key, audio_sha256),
            "item_key": item_key,
            "state_kind": ARTICLE_KIND,
            "content_hash": audio_sha256,
            "record_id": record_id,
        }

    def enqueue_record(self, record_id: str) -> None:
        """A new or regenerated record: per target server, a full submit
        when that server has not received it yet, else an audio replacement."""
        audio_sha256 = self.audio_sha256(record_id)
        item_key = laravel_delivery_outbox.item_key(DIFF_KIND_ARTICLE, record_id)
        for namespace in laravel_delivery_outbox.target_namespaces():
            delivered = laravel_delivery_outbox.delivered_hashes(ARTICLE_KIND, [item_key], namespace)
            kind = ARTICLE_AUDIO_KIND if item_key in delivered else ARTICLE_KIND
            laravel_delivery_outbox.enqueue(kind, self._record(kind, record_id, audio_sha256), namespace=namespace)

    def _inventory(self) -> Iterator[Dict[str, Any]]:
        for row in records.load_index()["records"]:
            record_id = str(row.get("id") or "")
            if not record_id:
                continue
            audio_sha256 = self.audio_sha256(record_id)
            yield {
                "key": record_id,
                "hash": audio_sha256,
                "wire": {"key": record_id, **({"sha256": audio_sha256} if audio_sha256 else {})},
                "record": {"record_id": record_id},
            }

    def _seed_markers(self) -> Iterator[Dict[str, Any]]:
        """v1 flags: an uploaded record is on the pre-upgrade server with
        its current audio, unless a rebuilt audio still awaited replacement
        (then its hash is unknown and the local diff reports it stale)."""
        for row in records.load_index()["records"]:
            record_id = str(row.get("id") or "")
            if not record_id or not row.get("uploaded"):
                continue
            pending_rebuild = bool(row.get("tts_chunked")) and not records.is_rebuild_upload_current(row)
            yield {"key": record_id, "hash": "" if pending_rebuild else self.audio_sha256(record_id)}

    def tick(self) -> None:
        """Heartbeat entry: diff the active server once the feature is on
        (a no-op after the first diff of this process) and restart idle
        drains."""
        if not self._enabled():
            return
        laravel_delivery_outbox.reconcile_once([ARTICLE_KIND])
        laravel_delivery_outbox.kick(ARTICLE_KIND)
        laravel_delivery_outbox.kick(ARTICLE_AUDIO_KIND)

    @staticmethod
    def _deliver_article(claimed: Dict[str, Any], owner: str) -> Dict[str, Any]:
        record_id = str(claimed.get("record_id") or "")
        record = records.get_record(record_id)
        if record is None:
            return {"status": OUTCOME_DONE}
        audio_bytes = records.read_audio(record_id)
        audio: Dict[str, Any] = {}
        if audio_bytes:
            audio["audio_base64"] = base64.b64encode(audio_bytes).decode("ascii")
            audio["engine"] = record.get("tts_engine") or "local"
            audio["model"] = record.get("tts_model")
            audio["chunked"] = bool(record.get("tts_chunked"))
        laravel_data = upload_to_laravel(
            {
                "title_en": record.get("title_en"),
                "title_cn": record.get("title_cn"),
                "reference_cn": record.get("reference_cn"),
                "article_en": record.get("article_en"),
            },
            audio,
            "",
            record_id,
            base_url=str(claimed.get("base_url") or ""),
        )
        records.mark_uploaded(record_id, laravel_data)
        ColorPrint.green(
            f"[AgentHistoryPipeline] upload succeeded for record {record_id} @ {claimed.get('base_url')}: "
            f"{laravel_data.get('article_id')}"
        )
        return {"status": OUTCOME_DONE}

    @staticmethod
    def _deliver_article_audio(claimed: Dict[str, Any], owner: str) -> Dict[str, Any]:
        record_id = str(claimed.get("record_id") or "")
        record = records.get_record(record_id)
        if record is None:
            return {"status": OUTCOME_DONE}
        audio_bytes = records.read_audio(record_id) or b""
        if not audio_bytes:
            # The local audio is gone: a multi-sentence record is regenerated
            # by the rebuild lane (which enqueues again); nothing to send now.
            if bool(record.get("tts_chunked")):
                records.clear_rebuild_marker(record_id)
            return {"status": OUTCOME_DONE}
        laravel_data = replace_audio_on_laravel(record, audio_bytes, base_url=str(claimed.get("base_url") or ""))
        # A durable writeback receipt (writeback_pending) is accepted too:
        # Laravel finalizes the idempotent replacement asynchronously.
        records.mark_rebuild_uploaded(record_id, laravel_data)
        ColorPrint.green(
            f"[AgentHistoryPipeline] audio replaced on Laravel for record {record_id} @ {claimed.get('base_url')}: "
            f"{laravel_data.get('article_id')}"
            + (" (finalizing asynchronously)" if laravel_data.get("writeback_pending") else "")
        )
        return {"status": OUTCOME_DONE}


agent_history_delivery = AgentHistoryDelivery()


__all__ = ["ARTICLE_AUDIO_KIND", "ARTICLE_KIND", "agent_history_delivery"]
