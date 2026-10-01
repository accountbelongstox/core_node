# -*- coding: utf-8 -*-

from typing import Any, Dict, Generic, Iterable, List, Optional, Tuple, TypeVar

from pycore.pyutils.common.model_boot import model_boot
from pycore.pyutils.common.model_checks import dist_version
from pycore.pyutils.common.model_manifest import ModelEntry, model_manifest


def normalize_engine_name(name: str) -> str:
    return str(name or "").strip().lower()


def parse_engine_priority(value: str) -> Tuple[str, ...]:
    parts = str(value or "").replace(",", "->").split("->")
    return tuple(
        name for name in (normalize_engine_name(part) for part in parts) if name
    )


def merge_engine_priority(
    known: Iterable[str],
    requested: Optional[Iterable[str]] = None,
) -> Tuple[str, ...]:
    known_names = tuple(dict.fromkeys(
        name for name in (normalize_engine_name(item) for item in known) if name
    ))
    known_set = frozenset(known_names)
    selected = tuple(dict.fromkeys(
        name
        for name in (
            normalize_engine_name(item) for item in (requested or ())
        )
        if name in known_set
    ))
    return selected + tuple(name for name in known_names if name not in selected)


class EngineAdapter:
    """One engine of one manifest category. Subclasses implement ``probe()``
    (cheap readiness without the boot mask) and may extend ``status_row()``."""

    def __init__(self, name: str, category: str) -> None:
        normalized_name = normalize_engine_name(name)
        entry = model_manifest.get(normalized_name, category)
        if entry is None:
            raise ValueError(f"{category} engine missing from the model manifest: {name}")
        self.name = normalized_name
        self.category = category
        self.entry: ModelEntry = entry
        self.managed_kind = normalize_engine_name(entry.managed_kind or "") or None
        self.note = entry.note
        self.distribution = entry.distribution
        self.concurrency = entry.concurrency or "serial"

    def boot_blocked(self) -> bool:
        return model_boot.is_blocked(self.name, self.category)

    def boot_reason(self) -> Optional[str]:
        return model_boot.reason(self.name, self.category)

    def probe(self) -> bool:
        raise NotImplementedError

    def available(self) -> bool:
        return not self.boot_blocked() and bool(self.probe())

    def status_row(self, available: bool) -> Dict[str, Any]:
        row: Dict[str, Any] = {
            "name": self.name,
            "available": bool(available),
            "note": self.note,
            "boot": model_boot.record(self.name, self.category),
        }
        if self.distribution and available:
            row["version"] = dist_version(self.distribution)
        return row


EngineAdapterType = TypeVar("EngineAdapterType", bound=EngineAdapter)


def build_engine_panel(
    rows: Iterable[Dict[str, Any]],
    *,
    active: Optional[str] = None,
    **extra: Any,
) -> Dict[str, Any]:
    """The one engine status panel shape shared by TTS, STT, LLM and OCR:
    ``{success, best, active, available_count, engines: [{..., priority}]}``."""
    engines: List[Dict[str, Any]] = []
    for index, row in enumerate(rows):
        row["priority"] = index + 1
        engines.append(row)
    best = next((row["name"] for row in engines if row.get("available")), None)
    return {
        "success": True,
        "best": best,
        "active": best if active is None else active,
        "available_count": sum(1 for row in engines if row.get("available")),
        "engines": engines,
        **extra,
    }


class EngineRegistry(Generic[EngineAdapterType]):
    def __init__(self, adapters: Iterable[EngineAdapterType]) -> None:
        self._adapters: Dict[str, EngineAdapterType] = {}
        for adapter in adapters:
            if adapter.name in self._adapters:
                raise ValueError(f"duplicate engine adapter: {adapter.name}")
            self._adapters[adapter.name] = adapter

    def get(self, name: str) -> Optional[EngineAdapterType]:
        return self._adapters.get(normalize_engine_name(name))

    def names(self, managed_kind: Optional[str] = None) -> Tuple[str, ...]:
        normalized_kind = normalize_engine_name(managed_kind or "") or None
        return tuple(
            name
            for name, adapter in self._adapters.items()
            if normalized_kind is None or adapter.managed_kind == normalized_kind
        )

    def values(
        self,
        managed_kind: Optional[str] = None,
    ) -> Tuple[EngineAdapterType, ...]:
        normalized_kind = normalize_engine_name(managed_kind or "") or None
        return tuple(
            adapter for adapter in self._adapters.values()
            if normalized_kind is None or adapter.managed_kind == normalized_kind
        )

    def managed(self, name: str) -> bool:
        adapter = self.get(name)
        return bool(adapter and adapter.managed_kind)

    def merge_priority(
        self,
        requested: Optional[Iterable[str]] = None,
    ) -> Tuple[str, ...]:
        return merge_engine_priority(self.names(), requested)

    def priority(self) -> Tuple[str, ...]:
        """Runtime engine order; registries with a configurable chain override it."""
        return self.names()

    def available(self, name: str) -> bool:
        adapter = self.get(name)
        return bool(adapter and adapter.available())

    def best(self, priority: Optional[Iterable[str]] = None) -> Optional[str]:
        for name in (self.priority() if priority is None else priority):
            if self.available(name):
                return name
        return None

    def panel(
        self,
        priority: Optional[Iterable[str]] = None,
        **extra: Any,
    ) -> Dict[str, Any]:
        rows = []
        for name in (self.priority() if priority is None else priority):
            adapter = self.get(name)
            if adapter is not None:
                rows.append(adapter.status_row(adapter.available()))
        return build_engine_panel(rows, **extra)


__all__ = [
    "EngineAdapter",
    "EngineRegistry",
    "build_engine_panel",
    "merge_engine_priority",
    "normalize_engine_name",
    "parse_engine_priority",
]
