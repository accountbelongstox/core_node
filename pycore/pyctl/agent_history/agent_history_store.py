# -*- coding: utf-8 -*-
"""
Agent-history txt store reader and prompt editor.

DIFF read surface mirrors the queue-center contract: ID pages carry IDs +
status metadata only and are aligned by a revision marker; full rows are
materialized lazily for the requested page. No full loads cross the wire.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import pycore.pyctl.agent_history.agent_history_txt as txt
from pycore.pyctl.agent_history.agent_history_records import (
    IS_DEV_MACHINE,
    local_time_text,
    paginate,
    prompt_entry,
    prompt_session_id,
)
from pycore.pyctl.agent_history.agent_history_statistics import valid_generated_at
from pycore.pyctl.agent_history.snapshot_cache import (
    read_index_catalog,
    read_prompt_catalog,
    read_prompt_catalog_snapshot,
    session_summary,
)

MATERIALIZE_CAP = 100
ID_PAGE_SIZE_CAP = 1000
DEFAULT_PAGE_SIZE = 50
SESSION_ID_FIELDS = (
    "id",
    "tool",
    "os_user",
    "started_ts",
    "ended_ts",
    "prompt_count",
    "has_subagent",
)


def _paginate(items: List[Dict[str, Any]], page: int, page_size: int) -> Dict[str, Any]:
    result = paginate(items, page, page_size, ID_PAGE_SIZE_CAP)
    result.pop("page_size")
    return result


def _filter_prompts(
    prompts: List[Dict[str, Any]],
    tool: Optional[str] = None,
    user: Optional[str] = None,
    q: Optional[str] = None,
    tools: Optional[List[str]] = None,
    lang: Optional[str] = None,
) -> List[Dict[str, Any]]:
    needle = (q or "").strip().lower()
    allowed_tools = {
        str(item).strip().lower()
        for item in (tools or [])
        if str(item).strip()
    }
    filtered = []
    for p in prompts:
        if tool and p.get("tool") != tool:
            continue
        if not tool and allowed_tools and str(p.get("tool") or "").lower() not in allowed_tools:
            continue
        if user and p.get("os_user") != user:
            continue
        if lang and p.get("lang") != lang:
            continue
        if needle and needle not in (p.get("text") or "").lower():
            continue
        filtered.append(p)
    return filtered


def _wanted_ids(ids: List[str]) -> List[str]:
    return [str(value) for value in (ids or []) if str(value or "")][:MATERIALIZE_CAP]


class AgentHistoryStore:
    """Read surface and prompt edit overlay of the agent-history txt store."""

    @staticmethod
    def _index_catalog() -> Dict[str, Any]:
        """Session summaries parsed once per persistent index revision."""
        data = read_index_catalog().get("data") or {}
        return data if isinstance(data, dict) else {}

    @staticmethod
    def _store_header(index: Dict[str, Any]) -> Dict[str, Any]:
        state = txt.read_state()
        counts = state.get("counts") or {}
        if not isinstance(counts, dict):
            counts = {}
        if not counts.get("sessions"):
            counts["sessions"] = index.get("sessions_count") or len(index.get("sessions") or [])
        return {
            "is_dev_machine": index.get("is_dev_machine", IS_DEV_MACHINE),
            "generated_at": valid_generated_at(index.get("generated_at")) or valid_generated_at(state.get("generated_at")),
            "tools": index.get("tools") or [],
            "users": index.get("users") or [],
            "langs": index.get("langs") or [],
            "counts": counts,
        }

    def read_index(self) -> Dict[str, Any]:
        index = self._index_catalog()
        result = self._store_header(index)
        result["sessions"] = [
            session_summary(session)
            for session in (index.get("sessions") or [])
            if isinstance(session, dict)
        ]
        return result

    def read_prompts(
        self,
        tool: Optional[str] = None,
        user: Optional[str] = None,
        limit: int = DEFAULT_PAGE_SIZE,
        offset: int = 0,
        q: Optional[str] = None,
        lang: Optional[str] = None,
        tools: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        filtered = _filter_prompts(read_prompt_catalog(), tool, user, q, tools, lang)
        limit = max(1, limit) if limit > 0 else DEFAULT_PAGE_SIZE
        offset = max(0, offset)
        return {
            "items": filtered[offset: offset + limit],
            "total": len(filtered),
            "limit": limit,
            "offset": offset,
        }

    def read_session_id_pages(
        self,
        tool: Optional[str] = None,
        user: Optional[str] = None,
        q: Optional[str] = None,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        since_revision: str = "",
    ) -> Dict[str, Any]:
        snapshot = read_index_catalog()
        revision = str(snapshot.get("revision") or "missing")
        if since_revision and since_revision == revision:
            return {"revision": revision, "unchanged": True}
        index = snapshot.get("data") or {}
        needle = (q or "").strip().lower()
        filtered = []
        for s in index.get("sessions") or []:
            if not isinstance(s, dict):
                continue
            if tool and s.get("tool") != tool:
                continue
            if user and s.get("os_user") != user:
                continue
            if needle:
                hay = f"{s.get('title') or ''} {s.get('project') or ''} {s.get('tool') or ''} {s.get('os_user') or ''}".lower()
                if needle not in hay:
                    continue
            filtered.append(s)
        result = self._store_header(index)
        result["revision"] = revision
        result.update(_paginate(filtered, page, page_size))
        result["items"] = [
            {field: s.get(field) for field in SESSION_ID_FIELDS}
            for s in result["items"]
        ]
        return result

    def read_session_page(self, ids: List[str]) -> Dict[str, Any]:
        by_id = read_index_catalog().get("by_id") or {}
        items = [by_id[sid] for sid in _wanted_ids(ids) if sid in by_id]
        return {"items": items, "total": len(items)}

    def read_prompt_id_pages(
        self,
        tool: Optional[str] = None,
        user: Optional[str] = None,
        q: Optional[str] = None,
        tools: Optional[List[str]] = None,
        page: int = 1,
        page_size: int = DEFAULT_PAGE_SIZE,
        since_revision: str = "",
    ) -> Dict[str, Any]:
        prompt_snapshot = read_prompt_catalog_snapshot()
        revision = str(prompt_snapshot.get("revision") or "missing")
        if since_revision and since_revision == revision:
            return {"revision": revision, "unchanged": True}
        filtered = _filter_prompts(prompt_snapshot.get("items") or [], tool, user, q, tools)
        result = self._store_header(self._index_catalog())
        result["revision"] = revision
        result.update(_paginate(filtered, page, page_size))
        result["items"] = [
            {key: value for key, value in p.items() if key != "text"}
            for p in result["items"]
        ]
        return result

    def read_prompt_page(self, ids: List[str]) -> Dict[str, Any]:
        """Materialize prompt text for one page from the per-session txt files."""
        wanted = _wanted_ids(ids)
        edits = txt.read_edits()
        session_ids: List[str] = []
        for pid in wanted:
            sid = prompt_session_id(pid) or pid
            if sid not in session_ids:
                session_ids.append(sid)
        blocks: Dict[str, Dict[str, Any]] = {}
        metas: Dict[str, Dict[str, Any]] = {}
        for sid in session_ids:
            detail = txt.read_session(sid)
            if not detail:
                continue
            metas[sid] = detail
            for p in detail.get("prompts") or []:
                if p.get("id"):
                    blocks[str(p["id"])] = p
        items: List[Dict[str, Any]] = []
        for pid in wanted:
            block = blocks.get(pid)
            if block is None:
                continue
            sid = prompt_session_id(pid) or pid
            edit = edits.get(pid)
            if edit and edit.get("text") is not None:
                block = {**block, "text": edit["text"], "edited": True}
            items.append(prompt_entry({**block, "id": pid}, metas.get(sid) or {}, sid))
        return {"items": items, "total": len(items)}

    def update_prompt(self, prompt_id: str, text: str) -> Optional[Dict[str, Any]]:
        session_id = prompt_session_id(prompt_id)
        if not session_id:
            return None
        edits = txt.read_edits()
        edits[prompt_id] = {"text": text, "edited_at": local_time_text()}
        txt.write_edits(edits)

        prompts = txt.read_prompts()
        for p in prompts:
            if p.get("id") == prompt_id:
                p["text"] = text
                p["edited"] = True
        txt.write_prompts(prompts)

        detail = txt.read_session(session_id)
        if detail:
            for p in detail.get("prompts") or []:
                if p.get("id") == prompt_id:
                    p["text"] = text
                    p["edited"] = True
            txt.write_session(session_id, detail)
        return {"id": prompt_id, "text": text, "edited": True}


agent_history_store = AgentHistoryStore()
