# -*- coding: utf-8 -*-
"""Terminal history in MeshSync: every sent message (stream ``terminal.sent``) and unsent draft
(``terminal.draft``) of this machine's terminals goes to every Laravel server through the MeshSync
publisher, so the global terminal search still finds them while this machine is offline.

Keys carry the signing machine id: ``<machine>:<terminal>:<log id>`` and ``<machine>:<terminal>``; a
deleted log and an emptied draft are published as deleted. A one-time backfill publishes the history stored before.
"""

from __future__ import annotations

import platform
import socket
from typing import Any, Dict

from pycore.pyctl.terminal.terminal_state_repository import (
    CHANGE_DRAFT,
    CHANGE_LOG,
    CHANGE_LOG_DELETED,
    SEARCH_HIT_DRAFT,
    SEARCH_HIT_SENT,
    terminal_state_repository,
)
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import start_bus_task
from pycore.pyutils.common.client_key_auth import get_pycore_machine_id
from pycore.pyutils.laravel.delivery_outbox import laravel_delivery_outbox
from pycore.pyutils.laravel.mesh_sync_client import mesh_sync_client
from pycore.pyutils.laravel.mesh_sync_publisher import mesh_sync_publisher

LABEL = "TerminalMeshSync"
STREAM_SENT = mesh_sync_client.streams["terminal_sent"]
STREAM_DRAFT = mesh_sync_client.streams["terminal_draft"]
BACKFILL_META_KEY = "terminal_mesh_sync_backfilled"
BACKFILL_DONE = "1"
BACKFILL_PAGE = 500
STATUS_SENT = "sent"


class TerminalMeshSync:
    def start(self) -> None:
        """Service start (after the outbox): publish every change from now on, and the stored history once."""
        terminal_state_repository.add_change_listener(self._on_change)
        if laravel_delivery_outbox.meta_value(BACKFILL_META_KEY) != BACKFILL_DONE:
            start_bus_task(self._backfill, thread_name="TerminalMeshSyncBackfill")

    @staticmethod
    def _machine() -> Dict[str, str]:
        return {
            "machine_id": get_pycore_machine_id(),
            "machine_name": socket.gethostname(),
            "platform": platform.system().lower(),
        }

    def _on_change(self, change: Dict[str, Any]) -> None:
        start_bus_task(self._publish_change, change, thread_name="TerminalMeshSync")

    def _publish_change(self, change: Dict[str, Any]) -> None:
        if change["change"] == CHANGE_LOG:
            self._publish_log(int(change["terminal_number"]), str(change["log_id"]), change["values"], str(change["content"]))
        elif change["change"] == CHANGE_LOG_DELETED:
            self._delete_log(int(change["terminal_number"]), str(change["log_id"]))
        elif change["change"] == CHANGE_DRAFT:
            self._publish_draft(int(change["terminal_number"]), str(change["title"]), str(change["date"]), str(change["text"]))

    def _publish_log(self, terminal_number: int, log_id: str, values: Dict[str, Any], content: str) -> None:
        machine = self._machine()
        mesh_sync_publisher.publish(
            STREAM_SENT,
            f"{machine['machine_id']}:{terminal_number}:{log_id}",
            {
                **machine,
                "terminal_number": terminal_number,
                "log_id": log_id,
                "title": str(values.get("title") or ""),
                "date": str(values.get("date") or ""),
                "status": str(values.get("status") or ""),
                "source": str(values.get("source") or ""),
                "error_code": str(values.get("error_code") or ""),
                "content": content,
            },
            content,
        )

    def _delete_log(self, terminal_number: int, log_id: str) -> None:
        mesh_sync_publisher.publish(
            STREAM_SENT,
            f"{get_pycore_machine_id()}:{terminal_number}:{log_id}",
            None,
            deleted=True,
        )

    def _publish_draft(self, terminal_number: int, title: str, date: str, text: str) -> None:
        machine = self._machine()
        mesh_sync_publisher.publish(
            STREAM_DRAFT,
            f"{machine['machine_id']}:{terminal_number}",
            {**machine, "terminal_number": terminal_number, "title": title, "date": date, "content": text},
            text,
            deleted=not text,
        )

    def search(self, query: str, limit: int) -> Dict[str, Any]:
        """MeshSync terminal records containing ``query`` as search hits of the terminal search
        (``kind`` sent or draft) with the ``machine`` they were written on."""
        needle = query.strip()
        if not needle:
            return {"success": True, "query": query, "results": []}
        result = mesh_sync_client.search(needle, [STREAM_SENT, STREAM_DRAFT], limit)
        hits = [self._hit(record) for record in result["records"] if isinstance(record.get("payload"), dict)]
        return {
            "success": bool(result["success"]),
            "query": query,
            "results": hits,
            "error_code": result["error"] or None,
        }

    @staticmethod
    def _hit(record: Dict[str, Any]) -> Dict[str, Any]:
        payload = record["payload"]
        draft = record.get("stream") == STREAM_DRAFT
        status = str(payload.get("status") or "")
        return {
            "id": SEARCH_HIT_DRAFT if draft else str(payload.get("log_id") or ""),
            "terminal_number": int(payload.get("terminal_number") or 0),
            "title": str(payload.get("title") or ""),
            "date": str(payload.get("date") or ""),
            "status": SEARCH_HIT_DRAFT if draft else status,
            "kind": SEARCH_HIT_DRAFT if draft else SEARCH_HIT_SENT,
            "source": str(payload.get("source") or ""),
            "success": not draft and status == STATUS_SENT,
            "error_code": str(payload.get("error_code") or "") or None,
            "content": str(payload.get("content") or ""),
            "machine": {
                "machine_id": str(payload.get("machine_id") or ""),
                "machine_name": str(payload.get("machine_name") or ""),
                "platform": str(payload.get("platform") or ""),
            },
        }

    def _backfill(self) -> None:
        after_terminal = 0
        after_log = 0
        published = 0
        page = terminal_state_repository.logs_page(after_terminal, after_log, BACKFILL_PAGE)
        while page:
            for entry in page:
                self._publish_log(int(entry["terminal_number"]), str(entry["log_id"]), entry, str(entry["content"]))
            published += len(page)
            after_terminal = int(page[-1]["terminal_number"])
            after_log = int(page[-1]["log_id"])
            page = terminal_state_repository.logs_page(after_terminal, after_log, BACKFILL_PAGE)
        for draft in terminal_state_repository.drafts():
            self._publish_draft(
                int(draft["terminal_number"]),
                str(draft["custom_title"] or draft["title"] or ""),
                str(draft["updated_at"] or ""),
                str(draft["draft"]),
            )
            published += 1
        laravel_delivery_outbox.set_meta_value(BACKFILL_META_KEY, BACKFILL_DONE)
        ColorPrint.green(f"[{LABEL}] backfill queued {published} terminal record(s) for every Laravel server")


terminal_mesh_sync = TerminalMeshSync()

__all__ = ["TerminalMeshSync", "terminal_mesh_sync"]
