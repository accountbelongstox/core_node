# -*- coding: utf-8 -*-
"""Startup verification of every AI model and provider (lazy-load probe).

``verify_all()`` verifies the whole manifest once at runtime start; blocked
entries are masked for the rest of the process. ``retry`` re-verifies one entry,
a category or every blocked entry on demand (the only way back without a restart).
"""

from typing import Any, Dict, List, Optional

import pycore.pyctl.ai_hub.manifest_loader as manifest_loader
from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.thread_bus_constants import BusSignals
from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_manifest import (
    BOOT_BLOCKED,
    BOOT_DEFERRED,
    BOOT_READY,
    ModelEntry,
)
from pycore.pyutils.common.status_snapshot_cache import (
    STATUS_SNAPSHOT_AI_KEY,
    STATUS_SNAPSHOT_AI_PROBE_KEY,
    STATUS_SNAPSHOT_CAPABILITIES_KEY,
    STATUS_SNAPSHOT_LLM_KEY,
    STATUS_SNAPSHOT_OCR_KEY,
    STATUS_SNAPSHOT_STT_KEY,
    STATUS_SNAPSHOT_TTS_ENGINE_PREFIX,
    STATUS_SNAPSHOT_TTS_KEY,
    status_snapshot_cache,
)
from pycore.pyutils.rpc_v2.delivery import http_event_delivery_service

_STATUS_KEYS = (
    STATUS_SNAPSHOT_AI_KEY,
    STATUS_SNAPSHOT_AI_PROBE_KEY,
    STATUS_SNAPSHOT_CAPABILITIES_KEY,
    STATUS_SNAPSHOT_LLM_KEY,
    STATUS_SNAPSHOT_OCR_KEY,
    STATUS_SNAPSHOT_STT_KEY,
    STATUS_SNAPSHOT_TTS_KEY,
)


def _invalidate_status() -> None:
    for key in _STATUS_KEYS:
        status_snapshot_cache.invalidate(key)
    status_snapshot_cache.invalidate_prefix(STATUS_SNAPSHOT_TTS_ENGINE_PREFIX)


def _publish(record: Dict[str, Any]) -> None:
    checked_at = int(float(record.get("checked_at") or 0.0) * 1000)
    http_event_delivery_service.publish_topic(
        BusSignals.AI_HUB_BOOT_CHANGED,
        record,
        audience="*",
        event_id=f"ai-hub-boot-{record.get('key')}-{checked_at}",
        entity_type="ai_hub_boot",
        entity_id=str(record.get("key") or ""),
        revision=checked_at,
    )


def _verify_entry(entry: ModelEntry) -> Dict[str, Any]:
    try:
        record = model_boot.verify(entry.id, entry.category)
    except Exception as exc:  # noqa: BLE001 - boundary: a raising check blocks the entry
        record = model_boot.verify_failed(entry.id, exc, entry.category)
    _publish(record)
    return record


def _summary(records: List[Dict[str, Any]]) -> str:
    counts = {BOOT_READY: 0, BOOT_DEFERRED: 0, BOOT_BLOCKED: 0}
    for record in records:
        state = str(record.get("state"))
        counts[state] = counts.get(state, 0) + 1
    blocked_names = ", ".join(
        f"{record.get('category')}/{record.get('id')}"
        for record in records
        if record.get("state") == BOOT_BLOCKED
    )
    line = (
        f"[ModelBoot] {len(records)} models verified: "
        f"{counts[BOOT_READY]} ready, {counts[BOOT_DEFERRED]} deferred, "
        f"{counts[BOOT_BLOCKED]} blocked"
    )
    return f"{line} ({blocked_names})" if blocked_names else line


def verify_all() -> List[Dict[str, Any]]:
    records = [_verify_entry(entry) for entry in manifest_loader.load().entries()]
    _invalidate_status()
    print_fn = ColorPrint.yellow if any(r.get("state") == BOOT_BLOCKED for r in records) else ColorPrint.green
    print_fn(_summary(records))
    return records


def retry(name: Optional[str] = None, category: Optional[str] = None) -> List[Dict[str, Any]]:
    """Re-verify one entry, or every blocked entry when no name is given."""
    manifest = manifest_loader.load()
    if name:
        entry = manifest.get(name, category)
        entries = [entry] if entry is not None else []
    else:
        entries = [
            entry for entry in manifest.entries(category)
            if model_boot.is_blocked(entry.id, entry.category)
        ]
    records = [_verify_entry(entry) for entry in entries]
    _invalidate_status()
    return records


__all__ = ["retry", "verify_all"]
