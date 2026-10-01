# -*- coding: utf-8 -*-
"""Per-tool prompt-source declarations: the one table of where every
supported agent keeps its history and which source format reads it.

Tool ids are the lowercase keys of ``agent_paths.AGENT_HISTORY_OFFICIAL_HOME_MARKERS``
(config ``enabled_tools``, planner filtering and UI checkboxes key on them).
"""

from __future__ import annotations

import os
from typing import List, Tuple

from pycore.pyctl.agent_history.sources.formats.chat_conversations import ChatLayout
from pycore.pyctl.agent_history.sources.formats.prompt_store_sqlite import (
    KV_STORE_FILE,
    KV_STORE_TABLE,
    KvStoreLayout,
    KvTable,
)
from pycore.pyctl.agent_history.sources.source_kit import load_json
from pycore.pyctl.agent_history.sources.source_specs import (
    FALLBACK_HOME,
    FALLBACK_NONE,
    FALLBACK_ROOT,
    SourceSpec,
    ToolSpec,
    editor_user_dirs,
)

FORMAT_BLOCK_TRANSCRIPT = "block_transcript"
FORMAT_CHAT_SESSION_FILE = "chat_session_file"
FORMAT_CONTENT_BLOCK_LOG = "content_block_log"
FORMAT_RESPONSE_ITEM_LOG = "response_item_log"
FORMAT_PROJECT_TEMP_JSON = "project_temp_json"
FORMAT_WIRE_EVENT_LOG = "wire_event_log"
FORMAT_MARKDOWN_ARTIFACTS = "markdown_artifacts"
FORMAT_MESSAGE_LIST = "message_list"
FORMAT_TYPED_ENTRY_LOG = "typed_entry_log"
FORMAT_PROMPT_STORE_SQLITE = "prompt_store_sqlite"
FORMAT_TYPED_HISTORY = "typed_history"

TYPED_HISTORY_TITLE = "Typed prompts (global history.jsonl)"
TYPED_HISTORY_RAW_ID = "global-typed-prompts"
# Key-value stores larger than this are skipped (whole-db JSON scans).
PROMPT_STORE_MAX_BYTES = 50 * 1024 * 1024

CLINE_EXTENSION_IDS = ("saoudrizwan.claude-dev", "cline.cline")

# Conversation documents of VS Code-family AI chat panels:
# - Cursor workspace aichat ``tabs`` -> ``bubbles`` and composer documents
#   (inline ``conversation``, or ``fullConversationHeadersOnly`` headers whose
#   bubbles are ``cursorDiskKV`` rows ``bubbleId:<composerId>:<bubbleId>``);
# - VS Code chat ``requests`` (``interactive.sessions`` values, chatSessions);
# - Trae ``memento/icube-ai-agent-storage`` (``list`` of sessions with ``messages``).
EDITOR_CHAT_LAYOUT = ChatLayout(
    container_fields=("tabs", "conversations", "allComposers", "composers", "sessions", "list"),
    message_fields=("bubbles", "messages", "conversation"),
    role_fields=("type", "role"),
    user_roles=(1, "1", "user"),
    text_fields=("text", "content"),
    request_fields=("requests",),
    request_ts_fields=("timestamp",),
    id_fields=("composerId", "id", "sessionId"),
    title_fields=("name", "title", "customTitle"),
    start_fields=("creationDate", "createdAt"),
    end_fields=("lastMessageDate", "lastUpdatedAt"),
    message_ts_fields=("createdAt", "timestamp"),
    message_ref_fields=("fullConversationHeadersOnly",),
    message_ref_id_field="bubbleId",
)
EDITOR_CHAT_KEYS = ("interactive.sessions", "%chat%", "%composer%")
# Per editor: app data dir names, remote-server dirs, extra ItemTable keys
# and extra key-value tables.
EDITOR_APPS = {
    "vscode": {"apps": ("Code", "Code - Insiders", "VSCodium"), "servers": (".vscode-server",)},
    "cursor": {
        "apps": ("Cursor",),
        "servers": (".cursor-server",),
        "keys": ("%aiService%", "%cursor%"),
        "tables": (KvTable("cursorDiskKV", ("composerData:%",), "bubbleId:{conversation}:{ref}"),),
    },
    "windsurf": {
        "apps": ("Windsurf", "Windsurf - Next"),
        "servers": (".windsurf-server",),
        "keys": ("%windsurf%", "%codeium%", "%cascade%"),
    },
    "trae": {
        "apps": ("Trae", "Trae CN"),
        "servers": (".trae-server", ".trae-cn-server"),
        "keys": ("memento/icube-ai-agent-storage", "memento/icube-ai%chat-storage%", "%ChatStore%", "%icube%", "%trae%"),
    },
    "antigravity": {
        "apps": ("Antigravity", "Antigravity IDE"),
        "servers": (".antigravity-server",),
        "keys": ("%antigravity%",),
    },
}
EDITOR_WORKSPACE_KV_FILES = (os.path.join("workspaceStorage", "*", KV_STORE_FILE),)
EDITOR_GLOBAL_KV_FILES = (os.path.join("globalStorage", KV_STORE_FILE),)
EDITOR_CHAT_SESSION_FILES = tuple(
    os.path.join(*parts, name)
    for parts in (("workspaceStorage", "*", "chatSessions"), ("globalStorage", "emptyWindowChatSessions"))
    for name in ("*.json", "*.jsonl")
)
# Agent work artifacts of the Antigravity editor, IDE and CLI (their
# ``conversations/*.pb`` blobs are encrypted; see markdown_artifacts).
ANTIGRAVITY_BRAIN_DIRS = tuple(
    os.path.join(".gemini", name, "brain") for name in ("antigravity", "antigravity-ide", "antigravity-cli")
)
# Global stores hold every composer of the editor (Cursor: often hundreds of MB).
GLOBAL_PROMPT_STORE_MAX_BYTES = 512 * 1024 * 1024

# Cline keeps its tasks in the globalStorage of whichever editor hosts it.
VSCODE_FAMILY_APPS = tuple(app for editor in EDITOR_APPS.values() for app in editor["apps"])
VSCODE_FAMILY_SERVERS = tuple(server for editor in EDITOR_APPS.values() for server in editor["servers"])


def editor_chat_sources(tool: str, fallback: str = FALLBACK_NONE) -> Tuple[SourceSpec, ...]:
    """Read-only key-value stores and chat-session files of one editor family."""
    editor = EDITOR_APPS[tool]
    user_dirs = editor_user_dirs(editor["apps"], editor["servers"])
    layout = KvStoreLayout(
        tables=(KvTable(KV_STORE_TABLE, EDITOR_CHAT_KEYS + tuple(editor.get("keys") or ())), *(editor.get("tables") or ())),
        chat=EDITOR_CHAT_LAYOUT,
    )
    return (
        SourceSpec(FORMAT_PROMPT_STORE_SQLITE, user_dirs, EDITOR_WORKSPACE_KV_FILES, fallback=fallback,
                   max_bytes=PROMPT_STORE_MAX_BYTES, options={"layout": layout}),
        SourceSpec(FORMAT_PROMPT_STORE_SQLITE, user_dirs, EDITOR_GLOBAL_KV_FILES, fallback=fallback,
                   max_bytes=GLOBAL_PROMPT_STORE_MAX_BYTES, options={"layout": layout}),
        SourceSpec(FORMAT_CHAT_SESSION_FILE, user_dirs, EDITOR_CHAT_SESSION_FILES, fallback=fallback,
                   options={"chat": EDITOR_CHAT_LAYOUT}),
    )


PI_AGENT_DIRECTORY = os.path.join(".pi", "agent")
PI_DEFAULT_SESSION_DIRECTORY = "sessions"
PI_SESSION_ENV = "PI_CODING_AGENT_SESSION_DIR"
PI_SETTINGS_FILE = "settings.json"


def _agent_root(home: str, user: str) -> str:
    if os.name != "nt":
        return os.path.join(home, PI_AGENT_DIRECTORY)
    system_drive = str(os.environ.get("SystemDrive") or "C:").rstrip("\\/")
    windows_agent_root = os.path.join(system_drive + os.sep, "Users", user, PI_AGENT_DIRECTORY)
    if os.path.isdir(windows_agent_root):
        return windows_agent_root
    return os.path.join(home, PI_AGENT_DIRECTORY)


def _resolve_session_root(value: str, agent_root: str, home: str) -> str:
    path = value.strip()
    if path == "~":
        return home
    if path.startswith("~/") or path.startswith("~\\"):
        return os.path.join(home, path[2:])
    if os.path.isabs(path):
        return path
    return os.path.join(agent_root, path)


def pi_session_roots(home: str, user: str) -> List[str]:
    agent_root = _agent_root(home, user)
    session_home = os.path.dirname(os.path.dirname(agent_root))
    settings_path = os.path.join(agent_root, PI_SETTINGS_FILE)
    settings = load_json(settings_path) if os.path.isfile(settings_path) else None
    configured = os.environ.get(PI_SESSION_ENV) or (
        settings.get("sessionDir") if isinstance(settings, dict) else ""
    )
    roots: List[str] = []
    if configured:
        roots.append(_resolve_session_root(str(configured), agent_root, session_home))
    roots.append(os.path.join(agent_root, PI_DEFAULT_SESSION_DIRECTORY))
    return list(dict.fromkeys(os.path.realpath(root) for root in roots if root))


GENERIC_MESSAGE_OPTIONS = {
    "containers": ("messages", "conversation", "history", "turns"),
    "skip_types": ("session",),
    "role_fields": ("role", "type"),
    "role_map": {
        "user": "user", "human": "user", "prompt": "user",
        "toolresult": "tool_result", "tool_result": "tool_result",
        "system": "system",
    },
    "default_role": "assistant",
    "text_fields": ("content", "text"),
    "ts_fields": ("timestamp", "ts", "created_at"),
}

TOOL_SPECS: Tuple[ToolSpec, ...] = (
    ToolSpec("claude", (
        SourceSpec(FORMAT_CONTENT_BLOCK_LOG, (os.path.join(".claude", "projects"),), ("*/*.jsonl",),
                   options={"human_origin_kind": "human", "dedupe_window_s": 300}),
        SourceSpec(FORMAT_TYPED_HISTORY, (".claude",), ("history.jsonl",),
                   options={"text_fields": ("display",), "ts_fields": ("timestamp",), "name_field": "project",
                            "raw_id": TYPED_HISTORY_RAW_ID, "title": TYPED_HISTORY_TITLE}),
    )),
    ToolSpec("codex", (
        # Official layout: sessions/YYYY/MM/DD/rollout-*.jsonl; archived
        # sessions keep the same shape (codex-rs/rollout SESSIONS_SUBDIR /
        # ARCHIVED_SESSIONS_SUBDIR).
        SourceSpec(FORMAT_RESPONSE_ITEM_LOG,
                   (os.path.join(".codex", "sessions"), os.path.join(".codex", "archived_sessions")),
                   walk="*rollout*.jsonl", walk_depth=7, follow_links=False),
        SourceSpec(FORMAT_TYPED_HISTORY, (".codex",), ("history.jsonl",),
                   options={"text_fields": ("text", "display"), "ts_fields": ("ts", "timestamp"),
                            "raw_id": TYPED_HISTORY_RAW_ID, "title": TYPED_HISTORY_TITLE}),
    )),
    ToolSpec("pi", (
        SourceSpec(FORMAT_TYPED_ENTRY_LOG, pi_session_roots, ("**/*.jsonl",), options={"article_words": 600}),
    )),
    ToolSpec("gemini", (
        SourceSpec(FORMAT_PROJECT_TEMP_JSON, (os.path.join(".gemini", "tmp"),), (
            "*/logs.json",
            "*/checkpoints/*.json",
            "*/chats/session-*.json",
            "*/chats/session-*.jsonl",
            "*/*.json",
        ), options={"chat": {
            "role_fields": ("type", "role"),
            "role_map": {"user": "user", "gemini": "assistant", "assistant": "assistant", "model": "assistant"},
            "text_fields": ("content", "message"),
            "ts_fields": ("timestamp",),
            "start_field": "startTime",
            "end_field": "lastUpdated",
            "id_field": "sessionId",
            "project_from_dir": True,
            "project_skip_dirs": ("chats", "checkpoints"),
        }}),
    )),
    ToolSpec("cursor", (
        SourceSpec(FORMAT_BLOCK_TRANSCRIPT, (os.path.join(".cursor", "projects"),), (
            os.path.join("*", "agent-transcripts", "*", "*.jsonl"),
            os.path.join("*", "agent-transcripts", "*.jsonl"),
        ), options={"query_tag": "user_query", "strip_tags": ("timestamp",),
                    "project_anchor": "projects", "container_dir": "agent-transcripts"}),
        *editor_chat_sources("cursor", FALLBACK_HOME),
    )),
    ToolSpec("kimi", (
        SourceSpec(FORMAT_WIRE_EVENT_LOG, (".kimi-code", ".kimi"), (
            os.path.join("sessions", "*", "*", "wire.jsonl"),
            os.path.join("sessions", "*", "*", "agents", "*", "wire.jsonl"),
        ), options={"human_origin_kind": "user"}),
        # The input-recall list repeats wire prompts without times: read only
        # for roots that have no wire session.
        SourceSpec(FORMAT_TYPED_HISTORY, (".kimi-code", ".kimi"), (os.path.join("user-history", "*.jsonl"),),
                   fallback=FALLBACK_ROOT,
                   options={"text_fields": ("content",), "ts_fields": ("timestamp",), "skip_prefixes": ("/",),
                            "raw_id": "user-history-{stem}", "title": "Typed prompts (kimi user-history)"}),
    )),
    ToolSpec("antigravity", (
        SourceSpec(FORMAT_MARKDOWN_ARTIFACTS, ANTIGRAVITY_BRAIN_DIRS, ("*",),
                   directories=True, options={"title_file": "task.md"}),
        *editor_chat_sources("antigravity"),
    )),
    ToolSpec("cline", (
        SourceSpec(FORMAT_MESSAGE_LIST,
                   editor_user_dirs(VSCODE_FAMILY_APPS, VSCODE_FAMILY_SERVERS, sub="globalStorage"),
                   tuple(os.path.join(ext, "tasks", "*", "api_conversation_history.json") for ext in CLINE_EXTENSION_IDS),
                   options={**GENERIC_MESSAGE_OPTIONS, "containers": (), "skip_types": (),
                            "raw_id": "parent_dir", "project": "cline"}),
    )),
    ToolSpec("vscode", editor_chat_sources("vscode")),
    ToolSpec("windsurf", editor_chat_sources("windsurf")),
    ToolSpec("trae", editor_chat_sources("trae")),
    ToolSpec("agent", (
        SourceSpec(FORMAT_MESSAGE_LIST, (".agent",), (os.path.join("**", "*.jsonl"), os.path.join("**", "*.json")),
                   options=GENERIC_MESSAGE_OPTIONS),
        SourceSpec(FORMAT_MESSAGE_LIST, (os.path.join(".openclaw", "agents"),), (os.path.join("*", "sessions", "*.jsonl"),),
                   options=GENERIC_MESSAGE_OPTIONS),
    )),
)


__all__ = ["TOOL_SPECS"]
