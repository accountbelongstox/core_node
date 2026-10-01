# -*- coding: utf-8 -*-
"""Wire-protocol session JSONL (Kimi CLI / Kimi Code ``sessions/<workdir>/<id>/wire.jsonl``).

Layout: ``sessions/<workdir-dir>/<session-id>/wire.jsonl`` and
``.../agents/main|agent-*/wire.jsonl`` next to ``state.json``
({"title","workDir","lastPrompt","createdAt"}).

The first line is {"type":"metadata"}; current CLIs record prompts as
{"type":"turn.prompt","input":[{type,text}],"time":ms} (plus "turn.steer" for
mid-turn steering) and assistant replies as streamed
{"type":"context.append_loop_event","event":{"type":"content.part",
"part":{"type":"text|think","text"},"turnId"}} events (think parts are
skipped). Legacy wires carry both roles via
{"type":"context.append_message","message":{"role","content":[...]}}; when
turn.prompt events exist the mirrored append_message user turns are dropped.

Only human input is a prompt: wire protocol 1.5 tags every user-role record
with ``origin.kind``; the declared ``human_origin_kind`` is typed input, while
"system_trigger" (subagent task text, agents/agent-*/wire.jsonl), "task"
(background-task notifications) and "injection" (system reminders) are kept
as ``system`` turns. Records without ``origin`` fall back to the shared
injected-prefix filter.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List

from pycore.pyctl.agent_history.sources.source_kit import (
    MAX_TURNS,
    SessionDraft,
    is_injected_prompt,
    load_json,
    load_jsonl,
    make_turn,
    one,
    path_segment_after,
    stringify_content,
    ts_to_epoch,
)
from pycore.pyctl.agent_history.sources.source_specs import SourceSpec

PROMPT_EVENTS = ("turn.prompt", "turn.steer")


def _session_dir(path: str) -> str:
    d = os.path.dirname(path)
    if os.path.basename(os.path.dirname(d)) == "agents":
        return os.path.dirname(os.path.dirname(d))
    return d


def _is_subagent_wire(path: str) -> bool:
    parts = path.replace("\\", "/").split("/")
    return "agents" in parts and "main" not in parts


def _is_human(origin: Any, text: str, human_kind: str) -> bool:
    if isinstance(origin, dict) and origin.get("kind"):
        return str(origin.get("kind")) == human_kind
    return not is_injected_prompt(text)


def parse(path: str, user: str, tool: str, spec: SourceSpec) -> List[Dict[str, Any]]:
    rows = load_jsonl(path)
    if not rows:
        return []
    human_kind = str(spec.options["human_origin_kind"])
    draft = SessionDraft(tool, user, path)
    mtime = draft.mtime
    session_dir = _session_dir(path)
    state = load_json(os.path.join(session_dir, "state.json"))
    state = state if isinstance(state, dict) else {}
    session_id = os.path.basename(session_dir)
    project = str(state.get("workDir") or "") or path_segment_after(path, "sessions")
    created = ts_to_epoch(state.get("createdAt"))
    is_sub = _is_subagent_wire(path)

    prompts: List[Dict[str, Any]] = []
    prompt_turns: List[Dict[str, Any]] = []
    legacy_prompts: List[Dict[str, Any]] = []
    legacy_user_turns: List[Dict[str, Any]] = []
    legacy_assistant_turns: List[Dict[str, Any]] = []
    assistant_parts: Dict[str, Dict[str, Any]] = {}
    has_prompt_events = False
    for e in rows:
        etype = str(e.get("type") or "")
        if etype in PROMPT_EVENTS:
            has_prompt_events = True
            text = stringify_content(e.get("input")).strip()
            if not text:
                continue
            raw_ts = ts_to_epoch(e.get("time"))
            ts = raw_ts or mtime
            draft.seen(ts)
            if _is_human(e.get("origin"), text, human_kind) and not is_sub:
                prompts.append({"ts": ts, "text": text, "estimated": raw_ts <= 0})
                prompt_turns.append(make_turn(ts, "user", text, is_sub))
            else:
                prompt_turns.append(make_turn(ts, "system", text, is_sub))
        elif etype == "context.append_loop_event":
            ev = e.get("event") or {}
            part = ev.get("part") or {}
            if str(ev.get("type")) != "content.part" or str(part.get("type")) != "text" or part.get("encrypted"):
                continue
            text = str(part.get("text") or "").strip()
            if not text:
                continue
            ts = ts_to_epoch(e.get("time")) or mtime
            draft.seen(ts)
            bucket = assistant_parts.setdefault(str(ev.get("turnId") or ""), {"ts": ts, "texts": []})
            bucket["ts"] = max(bucket["ts"], ts)
            bucket["texts"].append(text)
        elif etype == "context.append_message":
            msg = e.get("message") or {}
            role = str(msg.get("role") or "")
            text = stringify_content(msg.get("content")).strip()
            if role not in ("user", "assistant") or not text:
                continue
            raw_ts = ts_to_epoch(e.get("timestamp") or e.get("ts") or msg.get("timestamp") or e.get("time"))
            ts = raw_ts or mtime
            draft.seen(ts)
            if role == "assistant":
                legacy_assistant_turns.append(make_turn(ts, "assistant", text, is_sub))
                continue
            human = _is_human(msg.get("origin"), text, human_kind) and not is_sub
            legacy_user_turns.append(make_turn(ts, "user" if human else "system", text, is_sub))
            if human:
                legacy_prompts.append({"ts": ts, "text": text, "estimated": raw_ts <= 0})

    # Newer CLIs mirror prompts as turn.prompt AND context.append_message;
    # prefer turn.prompt. Legacy sessions keep the append_message user turns.
    if not has_prompt_events:
        prompt_turns, prompts = legacy_user_turns, legacy_prompts
    turns = prompt_turns + [
        make_turn(bucket["ts"], "assistant", "\n\n".join(bucket["texts"]), is_sub)
        for bucket in assistant_parts.values()
    ]
    # Older wires carried replies inside context.append_message; use them
    # only when the loop-event stream has none.
    if not assistant_parts:
        turns += legacy_assistant_turns
    turns.sort(key=lambda t: (int(t.get("ts") or 0), 0 if t.get("role") == "user" else 1))
    for p in prompts:
        draft.add_prompt(p["ts"], p["text"], p["estimated"])
    draft.turns = turns[:MAX_TURNS]
    draft.has_subagent = is_sub
    return one(draft.build(
        session_id,
        project=project,
        title=str(state.get("title") or "") or session_id,
        first_ts=draft.first_ts or created or mtime,
        last_ts=draft.last_ts or created or mtime,
    ))


__all__ = ["parse"]
