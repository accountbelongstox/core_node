# -*- coding: utf-8 -*-

from typing import Dict, Generic, Iterable, Optional, Tuple, TypeVar


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
    def __init__(self, name: str, *, managed_kind: Optional[str] = None) -> None:
        normalized_name = normalize_engine_name(name)
        if not normalized_name:
            raise ValueError("engine name is required")
        self.name = normalized_name
        self.managed_kind = normalize_engine_name(managed_kind or "") or None


EngineAdapterType = TypeVar("EngineAdapterType", bound=EngineAdapter)


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


__all__ = [
    "EngineAdapter",
    "EngineRegistry",
    "merge_engine_priority",
    "normalize_engine_name",
    "parse_engine_priority",
]
