# -*- coding: utf-8 -*-
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict

from pycore.pyfoundations.atomic_json_store import AtomicJsonStore


JsonValues = Dict[str, str]
ValueNormalizer = Callable[[Any], JsonValues]


class RevisionedJsonStore:
    """Atomic JSON document store with optimistic revision checks."""

    def __init__(
        self,
        path: Path,
        schema_version: int,
        normalize_values: ValueNormalizer,
    ) -> None:
        self.schema_version = schema_version
        self.normalize_values = normalize_values
        self.store = AtomicJsonStore(path, self._empty_document)

    def read(self) -> Dict[str, Any]:
        exists = self.store.exists()
        return self._normalize_document(self.store.read(), exists)

    def write(
        self,
        values: JsonValues,
        base_revision: int,
        initialize_only: bool = False,
    ) -> Dict[str, Any]:
        exists = self.store.exists()
        current = self._normalize_document(self.store.read(), exists)
        normalized_values = self.normalize_values(values)
        if initialize_only and exists:
            return {**current, "accepted": False, "conflict": True}
        if exists and normalized_values == current["values"]:
            return {
                **current,
                "accepted": True,
                "conflict": False,
                "changed": False,
            }
        if exists and base_revision != int(current["revision"]):
            return {**current, "accepted": False, "conflict": True}
        document = {
            "schema_version": self.schema_version,
            "revision": int(current["revision"]) + 1,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "values": normalized_values,
        }
        self.store.write(document)
        return {
            **self._normalize_document(document, True),
            "accepted": True,
            "conflict": False,
            "changed": True,
        }

    def _empty_document(self) -> Dict[str, Any]:
        return {
            "schema_version": self.schema_version,
            "revision": 0,
            "updated_at": "",
            "values": {},
        }

    def _normalize_document(
        self,
        document: Dict[str, Any],
        exists: bool,
    ) -> Dict[str, Any]:
        return {
            "exists": exists,
            "schema_version": int(
                document.get("schema_version") or self.schema_version
            ),
            "revision": int(document.get("revision") or 0),
            "updated_at": str(document.get("updated_at") or ""),
            "values": self.normalize_values(document.get("values")),
        }


__all__ = ["RevisionedJsonStore"]
