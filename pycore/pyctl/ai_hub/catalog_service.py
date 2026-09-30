# -*- coding: utf-8 -*-
"""AI hub catalog: every manifest entry joined with boot state, cheap runtime
state, tier info, capabilities and a normalized test-form schema.

Runtime state only reads cached status snapshots (no live probes): a category
whose snapshot was never built reports ``pending`` instead of triggering a scan.
"""

import time
from typing import Any, Dict, List, Optional

from pycore.pyctl.ai.ai_gateway import gateway_status
from pycore.pyctl.ai_hub import manifest_loader
from pycore.pyctl.ai_hub import test_service
from pycore.pyctl.tts.status_service import peek_status as peek_tts_status
from pycore.pyctl.tts.status_service import status as tts_status
from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_manifest import (
    CATEGORY_AI_IMAGE,
    CATEGORY_AI_TEXT,
    CATEGORY_LLM,
    CATEGORY_OCR,
    CATEGORY_STT,
    CATEGORY_TRANSLATE,
    CATEGORY_TTS,
    RUNTIME_SERVER,
    ModelEntry,
    normalize_model_id,
)
from pycore.pyutils.common.model_tiers import TIER_TABLE, engine_model, gpu_present
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_AI_KEY,
    STATUS_SNAPSHOT_LLM_KEY,
    status_snapshot_cache,
)
from pycore.pyutils.llm.status_service import status as llm_status
from pycore.pyutils.ocr_cluster.ocr.ocr_orchestrator import ocr_status
from pycore.pyutils.ocr_cluster.ocr_engine_params import OCR_ENGINE_TEST_PARAMS
from pycore.pyutils.stt.stt_engine_params import STT_ENGINE_TEST_PARAMS
from pycore.pyutils.stt.stt_orchestrator import stt_status
from pycore.pyutils.tts.tts_engine_params import TTS_ENGINE_TEST_PARAMS

CAPABILITY_IMAGE = "image"
FIELD_TEXTAREA = "textarea"
FIELD_TEXT = "text"
FIELD_SELECT = "select"
FIELD_NUMBER = "number"
LONG_TEXT_KEYS = frozenset({"text", "ocr_text", "description", "instruct", "prompt_text"})
NUMBER_KEYS = frozenset({"speed", "cfg_value", "timesteps"})
KEY_ALIASES = {"lang": "language"}
LABEL_KEY_PREFIX = "aiHub.field."
SCHEMA_META_TYPES = (bool, int, float, str)
ENTRY_STATE_PENDING = "pending"

_PARAM_TABLES = {
    CATEGORY_TTS: TTS_ENGINE_TEST_PARAMS,
    CATEGORY_STT: STT_ENGINE_TEST_PARAMS,
    CATEGORY_OCR: OCR_ENGINE_TEST_PARAMS,
}

_STATUS_SNAPSHOT_KEYS = {
    CATEGORY_LLM: STATUS_SNAPSHOT_LLM_KEY,
    CATEGORY_AI_TEXT: STATUS_SNAPSHOT_AI_KEY,
    CATEGORY_AI_IMAGE: STATUS_SNAPSHOT_AI_KEY,
}

_AI_CATEGORIES = (CATEGORY_AI_TEXT, CATEGORY_AI_IMAGE)


def _field(key: str, kind: str, **extra: Any) -> Dict[str, Any]:
    field = {
        "key": key,
        "type": kind,
        "label": key.replace("_", " ").capitalize(),
        "label_key": f"{LABEL_KEY_PREFIX}{key}",
    }
    field.update({name: value for name, value in extra.items() if value is not None})
    return field


def _table_field(key: str, table: Dict[str, Any]) -> Dict[str, Any]:
    prefix = KEY_ALIASES.get(key, key)
    options = table.get(f"{prefix}_options")
    default = table.get(f"{prefix}_default", table.get(f"{key}_default"))
    common = {
        "default": default,
        "placeholder": table.get(f"{prefix}_placeholder"),
        "hint": table.get(f"{prefix}_hint"),
    }
    if options:
        return _field(key, FIELD_SELECT, options=list(options), **common)
    if key in NUMBER_KEYS or any(f"{prefix}_{bound}" in table for bound in ("min", "max", "step")):
        return _field(
            key,
            FIELD_NUMBER,
            min=table.get(f"{prefix}_min"),
            max=table.get(f"{prefix}_max"),
            step=table.get(f"{prefix}_step"),
            **common,
        )
    kind = FIELD_TEXTAREA if key in LONG_TEXT_KEYS else FIELD_TEXT
    return _field(key, kind, max_chars=table.get(f"{prefix}_max_chars"), **common)


def _table_hints(table: Dict[str, Any]) -> Dict[str, Any]:
    field_prefixes = tuple(f"{KEY_ALIASES.get(key, key)}_" for key in table.get("fields") or ())
    return {
        name: value
        for name, value in table.items()
        if isinstance(value, SCHEMA_META_TYPES)
        and not name.startswith(field_prefixes)
    }


def _table_schema(entry: ModelEntry) -> Optional[Dict[str, Any]]:
    tables = _PARAM_TABLES.get(entry.category)
    if tables is None:
        return None
    wanted = normalize_model_id(entry.id)
    aliases = {normalize_model_id(name) for name in entry.names()}
    for engine, table in tables.items():
        if normalize_model_id(engine) in aliases or normalize_model_id(engine) == wanted:
            return {
                "fields": [_table_field(key, table) for key in table.get("fields") or ()],
                "hints": _table_hints(table),
            }
    return {"fields": [], "hints": {}}


def _ai_schema(entry: ModelEntry) -> Dict[str, Any]:
    image_only = entry.category == CATEGORY_AI_IMAGE
    fields: List[Dict[str, Any]] = []
    if not image_only and CAPABILITY_IMAGE in entry.capabilities:
        fields.append(_field(
            "mode",
            FIELD_SELECT,
            options=[
                {"value": mode, "label_key": f"aiHub.mode.{mode}"}
                for mode in (test_service.MODE_TEXT, test_service.MODE_IMAGE)
            ],
            default=test_service.MODE_TEXT,
        ))
    prompt_key = "prompt" if image_only else "text"
    fields.append(_field(
        prompt_key,
        FIELD_TEXTAREA,
        default=None if image_only else test_service.DEFAULT_CHAT_PROMPT,
    ))
    fields.append(_field("model", FIELD_TEXT))
    if image_only or CAPABILITY_IMAGE in entry.capabilities:
        visible = None if image_only else {"mode": test_service.MODE_IMAGE}
        fields.append(_field("size", FIELD_TEXT, default="1:1", visible_when=visible))
    return {"fields": fields, "hints": {}}


def _simple_schema(entry: ModelEntry) -> Dict[str, Any]:
    if entry.category == CATEGORY_TRANSLATE:
        return {
            "fields": [
                _field("text", FIELD_TEXTAREA, default=test_service.DEFAULT_TRANSLATE_TEXT),
                _field("src", FIELD_TEXT, default="auto"),
                _field("dest", FIELD_TEXT, default=test_service.DEFAULT_TRANSLATE_TARGET),
            ],
            "hints": {},
        }
    return {
        "fields": [
            _field("text", FIELD_TEXTAREA, default=test_service.DEFAULT_CHAT_PROMPT),
            _field("model", FIELD_TEXT),
        ],
        "hints": {},
    }


def test_schema(entry: ModelEntry) -> Optional[Dict[str, Any]]:
    """Form schema of one entry's test, or None when it has no test."""
    if not test_service.supports(entry):
        return None
    if entry.category in _PARAM_TABLES:
        return _table_schema(entry)
    if entry.category in _AI_CATEGORIES:
        return _ai_schema(entry)
    return _simple_schema(entry)


def tier(entry: ModelEntry) -> Optional[Dict[str, Any]]:
    row = TIER_TABLE.get(entry.tier_engine) if entry.tier_engine else None
    if not row:
        return None
    return {
        "gpu": row["gpu"],
        "cpu": row["cpu"],
        "active": engine_model(entry.tier_engine, gpu_present()),
        "env": row.get("env"),
    }


def _snapshot(category: str) -> Optional[Dict[str, Any]]:
    if category == CATEGORY_TTS:
        return peek_tts_status()
    if category == CATEGORY_STT:
        return stt_status()
    if category == CATEGORY_OCR:
        return ocr_status()
    return status_snapshot_cache.peek(_STATUS_SNAPSHOT_KEYS[category])


def warm_snapshots() -> None:
    """Build the cached snapshots the catalog reads (same getters the status
    routes use, no forced refresh)."""
    tts_status()
    llm_status()
    gateway_status()


def _status_rows(category: str) -> Optional[List[Dict[str, Any]]]:
    snapshot = _snapshot(category)
    if not isinstance(snapshot, dict) or snapshot.get("pending"):
        return None
    rows = snapshot.get("providers" if category in _AI_CATEGORIES else "engines")
    return [row for row in rows or [] if isinstance(row, dict)]


def _runtime_index() -> Dict[str, Dict[str, Dict[str, Any]]]:
    index: Dict[str, Dict[str, Dict[str, Any]]] = {}
    for category in (CATEGORY_TTS, CATEGORY_STT, CATEGORY_OCR, CATEGORY_LLM, CATEGORY_AI_TEXT, CATEGORY_AI_IMAGE):
        rows = _status_rows(category)
        if rows is not None:
            index[category] = {normalize_model_id(row.get("name")): row for row in rows}
    return index


def _runtime_state(entry: ModelEntry, row: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if row is None:
        return {"pending": True}
    managed = bool(row.get("server_engine"))
    running = row.get("server_running") if managed else row.get("model_loaded")
    available = row.get("available")
    if entry.category in _AI_CATEGORIES:
        available = bool(row.get("available")) or bool(row.get("configured"))
    state = {
        "installed": row.get("installed", row.get("configured")),
        "available": available,
        "running": running,
        "model_loaded": row.get("model_loaded"),
        "in_flight": row.get("in_flight"),
        "enabled": row.get("server_enabled"),
        "idle_remaining_s": row.get("server_idle_remaining_s", row.get("model_idle_remaining_s")),
        "version": row.get("version"),
        "model": row.get("model"),
        "paused": row.get("paused"),
    }
    reason = row.get("disabled_reason")
    if reason:
        state["reason"] = str(reason)
        state["reason_code"] = row.get("disabled_reason_code")
        state["reason_params"] = row.get("disabled_reason_params")
    return {name: value for name, value in state.items() if value is not None}


def _boot_view(entry: ModelEntry) -> Dict[str, Any]:
    record = model_boot.record(entry.id, entry.category)
    return {
        name: record[name]
        for name in ("state", "reason", "reason_code", "reason_params", "checked_at")
        if name in record
    }


def entry_view(entry: ModelEntry, runtime_index: Dict[str, Dict[str, Dict[str, Any]]]) -> Dict[str, Any]:
    supported = test_service.supports(entry)
    row = runtime_index.get(entry.category, {}).get(normalize_model_id(entry.id))
    return {
        "id": entry.id,
        "key": entry.key,
        "category": entry.category,
        "runtime": entry.runtime,
        "note": entry.note,
        "aliases": list(entry.aliases),
        "meta": {
            "managed_kind": entry.managed_kind,
            "concurrency": entry.concurrency,
            "distribution": entry.distribution,
            "cloud": entry.cloud,
            "tiered": entry.tiered,
            "languages": sorted(entry.languages),
            "capabilities": list(entry.capabilities),
            "dispatch_tier": entry.dispatch_tier,
            "library_name": entry.library_name,
        },
        "tier": tier(entry),
        "boot": _boot_view(entry),
        "runtime_state": _runtime_state(entry, row),
        "capabilities": {
            "test": supported,
            "history": supported,
            "power": entry.managed_kind == RUNTIME_SERVER,
            "live": entry.live,
        },
        "test_schema": test_schema(entry),
    }


def catalog(refresh: bool = False) -> Dict[str, Any]:
    if refresh:
        warm_snapshots()
    manifest = manifest_loader.load()
    runtime_index = _runtime_index()
    return {
        "generated_at": time.time(),
        "categories": [
            {
                "id": category,
                "entries": [entry_view(entry, runtime_index) for entry in manifest.entries(category)],
            }
            for category in manifest.categories()
        ],
    }


__all__ = ["catalog", "entry_view", "test_schema", "tier", "warm_snapshots"]
