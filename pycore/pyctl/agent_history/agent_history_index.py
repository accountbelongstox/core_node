# -*- coding: utf-8 -*-
"""Agent-history extract store: sessions, flat prompt list, per-source state
and store meta in ``<agent_history store>/agent_history.sqlite3``.

Every call runs on the store's own serialized owner thread. The committed
revision is published as a THREAD_BUS signal so readers key their caches on
it without an owner hop. The pre-SQLite ``index.txt`` / ``prompts.txt`` /
``state.txt`` files are imported once (``txt_imported`` meta key) and never
read again; per-session transcripts stay in ``sessions/<id>.txt``.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence

import pycore.pyctl.agent_history.agent_history_txt as txt
from pycore.database.repositories.agent_history_store_repository import AgentHistoryStoreRepository
from pycore.pyctl.agent_history.agent_history_records import local_time_text
from pycore.pyctl.agent_history.root_spool import SPOOL_FILE_MODE
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.serialized_worker import init_serialized_owner, serialized_method
from pycore.pyfoundations.thread_bus.bus import THREAD_BUS

STORE_DATABASE_FILE = "agent_history.sqlite3"
SQLITE_SIDE_FILE_SUFFIXES = ("", "-wal", "-shm")
META_TXT_IMPORTED = "txt_imported"
META_GENERATED_AT = "generated_at"
META_SIGNATURE = "signature"
META_SCHEMA_REVISION = "extractor_schema_revision"
META_IS_DEV_MACHINE = "is_dev_machine"
META_COUNTS = "counts"
_REVISION_SIGNAL = "pyctl.agent_history.store_revision"


class AgentHistoryIndex:
    """Owner of the extract-store SQLite connection."""

    def __init__(self) -> None:
        self._repository: Optional[AgentHistoryStoreRepository] = None
        init_serialized_owner(self, "pyctl.agent_history.index", "AgentHistoryIndex")

    def _repo(self) -> AgentHistoryStoreRepository:
        if self._repository is not None:
            return self._repository
        path = txt.store_dir() / STORE_DATABASE_FILE
        repository = AgentHistoryStoreRepository(path)
        if not repository.meta(META_TXT_IMPORTED):
            self._import_txt(repository)
        for suffix in SQLITE_SIDE_FILE_SUFFIXES:
            side = Path(f"{path}{suffix}")
            if side.exists():
                txt.restrict_mode(side, SPOOL_FILE_MODE, "Store database")
        self._repository = repository
        THREAD_BUS.signal(_REVISION_SIGNAL, repository.revision())
        return repository

    @staticmethod
    def _import_txt(repository: AgentHistoryStoreRepository) -> None:
        """One-shot import of the pre-SQLite txt index, prompt list and state."""
        state = txt.read_legacy_state()
        index = txt.read_legacy_index()
        prompts = txt.read_legacy_prompts()
        sources = state.get("sources") if isinstance(state.get("sources"), dict) else {}
        repository.commit_pass(
            [],
            [session for session in index.get("sessions") or [] if session.get("id")],
            list(reversed(prompts)),
            [],
            {str(path): info for path, info in sources.items() if isinstance(info, dict)},
            {
                META_GENERATED_AT: str(state.get("generated_at") or index.get("generated_at") or ""),
                META_SIGNATURE: str(state.get("signature") or ""),
                META_SCHEMA_REVISION: str(state.get("extractor_schema_revision") or ""),
                META_IS_DEV_MACHINE: str(state.get("is_dev_machine") or ""),
            },
        )
        repository.set_meta(META_TXT_IMPORTED, local_time_text())
        ColorPrint.blue(
            f"[AgentHistory] Store imported legacy txt sessions={len(index.get('sessions') or [])} "
            f"prompts={len(prompts)} sources={len(sources)}"
        )

    def revision(self) -> str:
        value = THREAD_BUS.get_signal(_REVISION_SIGNAL, None)
        if value is None:
            value = self._open_revision()
        return f"rev:{int(value)}"

    @serialized_method
    def _open_revision(self) -> int:
        return self._repo().revision()

    @serialized_method
    def state(self) -> Dict[str, Any]:
        """Extract-pass header: signature, schema revision, counts, sources."""
        repository = self._repo()
        meta = repository.meta_all()
        try:
            counts = json.loads(meta.get(META_COUNTS) or "{}")
        except ValueError as exc:
            ColorPrint.yellow(f"[AgentHistory] Store counts meta is not JSON: {exc}")
            counts = {}
        return {
            "generated_at": meta.get(META_GENERATED_AT, ""),
            "signature": meta.get(META_SIGNATURE, ""),
            "extractor_schema_revision": meta.get(META_SCHEMA_REVISION, ""),
            "is_dev_machine": meta.get(META_IS_DEV_MACHINE, ""),
            "counts": counts if isinstance(counts, dict) else {},
            "sources": repository.sources(),
        }

    @serialized_method
    def sources(self) -> Dict[str, Dict[str, Any]]:
        return self._repo().sources()

    @serialized_method
    def existing_prompt_ids(self, prompt_ids: Sequence[str]) -> set:
        return self._repo().existing_prompt_ids(prompt_ids)

    @serialized_method
    def commit_pass(
        self,
        replaced_session_ids: Sequence[str],
        sessions: Sequence[Dict[str, Any]],
        prompts: Sequence[Dict[str, Any]],
        removed_source_paths: Sequence[str],
        sources: Dict[str, Dict[str, Any]],
        meta: Dict[str, str],
    ) -> Dict[str, int]:
        revision, counts = self._repo().commit_pass(
            replaced_session_ids, sessions, prompts, removed_source_paths, sources, meta,
        )
        THREAD_BUS.signal(_REVISION_SIGNAL, revision)
        return counts

    @serialized_method
    def header(self) -> Dict[str, Any]:
        """Index header for readers: generated_at, tools, users, langs, counts."""
        repository = self._repo()
        meta = repository.meta_all()
        try:
            counts = json.loads(meta.get(META_COUNTS) or "{}")
        except ValueError as exc:
            ColorPrint.yellow(f"[AgentHistory] Store counts meta is not JSON: {exc}")
            counts = {}
        return {
            "generated_at": meta.get(META_GENERATED_AT, ""),
            "is_dev_machine": meta.get(META_IS_DEV_MACHINE, ""),
            "counts": counts if isinstance(counts, dict) else {},
            **repository.distinct_values(),
        }

    @serialized_method
    def sessions(self) -> List[Dict[str, Any]]:
        return self._repo().sessions()

    @serialized_method
    def prompt_query(
        self,
        tool: Optional[str] = None,
        user: Optional[str] = None,
        lang: Optional[str] = None,
        needle: str = "",
        tools: Sequence[str] = (),
        offset: int = 0,
        limit: Optional[int] = None,
        with_text: bool = True,
    ) -> Dict[str, Any]:
        total, items = self._repo().prompt_query(tool, user, lang, needle, tools, offset, limit, with_text)
        return {"total": total, "items": items}

    @serialized_method
    def set_prompt_text(self, prompt_id: str, text: str) -> None:
        THREAD_BUS.signal(_REVISION_SIGNAL, self._repo().set_prompt_text(prompt_id, text))


agent_history_index = AgentHistoryIndex()


__all__ = ["AgentHistoryIndex", "agent_history_index"]
