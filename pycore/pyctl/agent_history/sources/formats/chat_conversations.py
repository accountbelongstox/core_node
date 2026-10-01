# -*- coding: utf-8 -*-
"""Editor AI-chat conversation documents, shared by the key-value prompt
store and the chat-session JSON files of VS Code-family editors.

A document is a conversation, a list of conversations, or an object holding
one under a declared container field. A conversation carries either
- a message list (``message_fields``): role + text per message (Cursor
  aichat ``bubbles``, composer ``conversation``), or message headers
  (``message_ref_fields``) whose bodies are separate store rows (Cursor
  composer ``fullConversationHeadersOnly`` -> ``bubbleId:<composer>:<bubble>``), or
- request/response pairs (``request_fields``): ``message.text`` (or its
  ``parts``) is the prompt and ``response`` items carry the reply as
  ``value`` / ``content.value`` strings (VS Code chat ``requests``).
Everything product-specific is declared in a ``ChatLayout``.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Tuple

from pycore.pyctl.agent_history.sources.source_kit import (
    SessionDraft,
    first_field,
    stringify_content,
    ts_to_epoch,
)


@dataclass(frozen=True)
class ChatLayout:
    container_fields: Tuple[str, ...]
    message_fields: Tuple[str, ...]
    role_fields: Tuple[str, ...]
    user_roles: Tuple[Any, ...]
    text_fields: Tuple[str, ...]
    request_fields: Tuple[str, ...]
    request_ts_fields: Tuple[str, ...]
    id_fields: Tuple[str, ...]
    title_fields: Tuple[str, ...]
    start_fields: Tuple[str, ...] = ()
    end_fields: Tuple[str, ...] = ()
    message_ts_fields: Tuple[str, ...] = ()
    # Message headers whose bodies live in separate store rows (resolved by
    # the store through ``RefResolver`` with the conversation id and the
    # header's ``message_ref_id_field``).
    message_ref_fields: Tuple[str, ...] = ()
    message_ref_id_field: str = ""


RefResolver = Callable[[str, str], Optional[Dict[str, Any]]]


def _first_list(document: Dict[str, Any], fields: Tuple[str, ...]) -> Optional[List[Any]]:
    for field in fields:
        value = document.get(field)
        if isinstance(value, list):
            return value
    return None


def conversations(document: Any, layout: ChatLayout) -> List[Dict[str, Any]]:
    if isinstance(document, list):
        return [x for x in document if isinstance(x, dict)]
    if not isinstance(document, dict):
        return []
    container = _first_list(document, layout.container_fields)
    if container is not None:
        return [x for x in container if isinstance(x, dict)]
    if any(k in document for k in layout.message_fields + layout.request_fields + layout.message_ref_fields):
        return [document]
    return []


def _response_text(response: Any) -> str:
    if isinstance(response, str):
        return response
    if not isinstance(response, list):
        return stringify_content(response)
    parts: List[str] = []
    for item in response:
        if isinstance(item, str):
            parts.append(item)
        elif isinstance(item, dict):
            value = item.get("value")
            if isinstance(value, dict):
                value = value.get("value")
            if value is None and isinstance(item.get("content"), dict):
                value = item["content"].get("value")
            if isinstance(value, str):
                parts.append(value)
    return "".join(parts)


def _add_requests(draft: SessionDraft, requests: List[Any], layout: ChatLayout) -> None:
    for index, request in enumerate(requests):
        if not isinstance(request, dict):
            continue
        message = request.get("message")
        if isinstance(message, dict):
            prompt = str(message.get("text") or "") or stringify_content(message.get("parts"))
        else:
            prompt = str(message or "")
        raw_ts = ts_to_epoch(first_field(request, layout.request_ts_fields))
        ts = raw_ts or draft.file_ts(index)
        draft.seen(ts)
        if prompt.strip():
            draft.add_prompt(ts, prompt.strip(), raw_ts <= 0)
            draft.add_turn(ts, "user", prompt.strip())
        reply = _response_text(request.get("response")).strip()
        if reply:
            draft.add_turn(ts, "assistant", reply)
        if draft.full():
            break


def _add_messages(draft: SessionDraft, messages: List[Any], layout: ChatLayout) -> None:
    for message in messages:
        if not isinstance(message, dict):
            continue
        text = str(first_field(message, layout.text_fields) or "").strip()
        if not text:
            continue
        raw_ts = ts_to_epoch(first_field(message, layout.message_ts_fields))
        ts = raw_ts or draft.mtime
        draft.seen(raw_ts)
        if first_field(message, layout.role_fields) in layout.user_roles:
            draft.add_prompt(ts, text, raw_ts <= 0)
            draft.add_turn(ts, "user", text)
        else:
            draft.add_turn(ts, "assistant", text)
        if draft.full():
            break


def conversation_session(
    conversation: Dict[str, Any],
    layout: ChatLayout,
    path: str,
    user: str,
    tool: str,
    fallback_id: str,
    project: str,
    resolve: Optional[RefResolver] = None,
) -> Optional[Dict[str, Any]]:
    conversation_id = str(first_field(conversation, layout.id_fields) or fallback_id)
    requests = _first_list(conversation, layout.request_fields)
    messages = _first_list(conversation, layout.message_fields)
    headers = _first_list(conversation, layout.message_ref_fields)
    if not messages and headers and resolve is not None:
        messages = [
            resolve(conversation_id, str(header.get(layout.message_ref_id_field) or ""))
            for header in headers
            if isinstance(header, dict) and header.get(layout.message_ref_id_field)
        ]
    if requests is None and messages is None:
        return None
    draft = SessionDraft(tool, user, path)
    if requests is not None:
        _add_requests(draft, requests, layout)
    else:
        _add_messages(draft, messages or [], layout)
    first = ts_to_epoch(first_field(conversation, layout.start_fields)) or draft.first_ts or draft.mtime
    last = ts_to_epoch(first_field(conversation, layout.end_fields)) or draft.last_ts or draft.mtime
    return draft.build(
        conversation_id,
        project=project,
        title=str(first_field(conversation, layout.title_fields) or ""),
        first_ts=first,
        last_ts=last,
    )


def document_sessions(
    document: Any,
    layout: ChatLayout,
    path: str,
    user: str,
    tool: str,
    fallback_id: str,
    project: str,
    resolve: Optional[RefResolver] = None,
) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for idx, conversation in enumerate(conversations(document, layout)):
        session = conversation_session(
            conversation, layout, path, user, tool, f"{fallback_id}-{idx}", project, resolve,
        )
        if session:
            out.append(session)
    return out


__all__ = ["ChatLayout", "RefResolver", "conversation_session", "conversations", "document_sessions"]
