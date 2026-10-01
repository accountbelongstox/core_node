# -*- coding: utf-8 -*-
"""AI hub route services: response-shaped wrappers over catalog, test, history
and boot so the route module stays a thin adapter."""

from typing import Any, Dict, Optional

from pycore.pyctl.ai_hub import boot_service, catalog_service, manifest_loader, probe_history, probe_service
from pycore.pyutils.common.keyset_cursor import keyset_request
from pycore.pyutils.common.model_boot import model_boot

ERROR_MISSING_PARAMS = "missing_params"
ERROR_NOT_FOUND = "not_found"


def _error(code: str, message: str) -> Dict[str, Any]:
    return {"success": False, "error": {"code": code, "message": message}}


def _match(params: Dict[str, Any]) -> Optional[str]:
    """History filter value: an entry key, or the canonical id of an entry."""
    name = str(params.get("id") or params.get("key") or "").strip()
    if not name:
        return None
    entry = manifest_loader.load().get(name, str(params.get("category") or "") or None)
    if entry is None:
        return name
    return entry.key if ":" in name else entry.id


def catalog(params: Dict[str, Any]) -> Dict[str, Any]:
    return {"success": True, "data": catalog_service.catalog(bool(params.get("refresh")))}


def test(params: Dict[str, Any]) -> Dict[str, Any]:
    name = str(params.get("id") or params.get("key") or "").strip()
    if not name:
        return _error(ERROR_MISSING_PARAMS, "id is required")
    return probe_service.run(
        name,
        params.get("params") if isinstance(params.get("params"), dict) else {},
        str(params.get("category") or "") or None,
    )


def history(params: Dict[str, Any]) -> Dict[str, Any]:
    after, limit = keyset_request(params)
    return {
        "success": True,
        "data": probe_history.list_records(
            after,
            limit,
            _match(params),
            str(params.get("category") or "") or None,
        ),
    }


def history_delete(params: Dict[str, Any]) -> Dict[str, Any]:
    record_id = str(params.get("record_id") or "").strip()
    if not record_id:
        return _error(ERROR_MISSING_PARAMS, "record_id is required")
    if not probe_history.delete_record(record_id):
        return _error(ERROR_NOT_FOUND, "record not found")
    return {"success": True, "data": {"removed": 1}}


def history_clear(params: Dict[str, Any]) -> Dict[str, Any]:
    removed = probe_history.clear_records(_match(params), str(params.get("category") or "") or None)
    return {"success": True, "data": {"removed": removed}}


def boot_status(params: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "success": True,
        "data": {"records": model_boot.records(str(params.get("category") or "") or None)},
    }


def boot_retry(params: Dict[str, Any]) -> Dict[str, Any]:
    name = str(params.get("id") or params.get("key") or "").strip() or None
    if name is not None and manifest_loader.load().get(name, str(params.get("category") or "") or None) is None:
        return _error(ERROR_NOT_FOUND, f"unknown model: {name}")
    return {
        "success": True,
        "data": {"records": boot_service.retry(name, str(params.get("category") or "") or None)},
    }


__all__ = [
    "boot_retry",
    "boot_status",
    "catalog",
    "history",
    "history_clear",
    "history_delete",
    "test",
]
