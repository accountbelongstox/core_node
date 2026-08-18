# -*- coding: utf-8 -*-
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class Operation:
    id: str
    kind: str
    scope: str
    status: str
    stage: str
    revision: int
    totals: Dict[str, Any] = field(default_factory=dict)
    timestamps: Dict[str, Any] = field(default_factory=dict)
    error_json: Optional[Dict[str, Any]] = None
    summary_json: Optional[Dict[str, Any]] = None
    owner_client_id: Optional[str] = None

    @classmethod
    def from_row(cls, row: tuple) -> Operation:
        return cls(
            id=row[0],
            kind=row[1],
            scope=row[2],
            status=row[3],
            stage=row[4],
            revision=row[5],
            totals=json.loads(row[6]) if row[6] else {},
            timestamps=json.loads(row[7]) if row[7] else {},
            error_json=json.loads(row[8]) if row[8] else None,
            summary_json=json.loads(row[9]) if row[9] else None,
            owner_client_id=str(row[10]) if len(row) > 10 and row[10] else None,
        )


@dataclass
class OperationItem:
    id: str
    operation_id: str
    item_key: str
    ordinal: int
    status: str
    stage: str
    progress: float
    attempts: int
    input_json: Optional[Dict[str, Any]] = None
    checkpoint_json: Optional[Dict[str, Any]] = None
    result_json: Optional[Dict[str, Any]] = None
    error_json: Optional[Dict[str, Any]] = None

    @classmethod
    def from_row(cls, row: tuple) -> OperationItem:
        return cls(
            id=row[0],
            operation_id=row[1],
            item_key=row[2],
            ordinal=row[3],
            status=row[4],
            stage=row[5],
            progress=row[6],
            attempts=row[7],
            input_json=json.loads(row[8]) if row[8] else None,
            checkpoint_json=json.loads(row[9]) if row[9] else None,
            result_json=json.loads(row[10]) if row[10] else None,
            error_json=json.loads(row[11]) if row[11] else None,
        )


@dataclass
class OperationEvent:
    seq: int
    event_id: str
    operation_id: str
    item_id: Optional[str]
    revision: int
    level: str
    event_type: str
    message: str
    payload_json: Optional[Dict[str, Any]] = None
    created_at: str = ""

    @classmethod
    def from_row(cls, row: tuple) -> OperationEvent:
        return cls(
            seq=row[0],
            event_id=row[1],
            operation_id=row[2],
            item_id=row[3],
            revision=row[4],
            level=row[5],
            event_type=row[6],
            message=row[7],
            payload_json=json.loads(row[8]) if row[8] else None,
            created_at=row[9],
        )


@dataclass
class UiSnapshot:
    profile_id: str
    scope: str
    schema_version: int
    revision: int
    state_json: Dict[str, Any] = field(default_factory=dict)
    updated_at: str = ""

    @classmethod
    def from_row(cls, row: tuple) -> UiSnapshot:
        return cls(
            profile_id=row[0],
            scope=row[1],
            schema_version=row[2],
            revision=row[3],
            state_json=json.loads(row[4]) if row[4] else {},
            updated_at=row[5],
        )


@dataclass
class ConsumerOffset:
    consumer_id: str
    stream: str
    last_acked_seq: int
    updated_at: str = ""

    @classmethod
    def from_row(cls, row: tuple) -> ConsumerOffset:
        return cls(
            consumer_id=row[0],
            stream=row[1],
            last_acked_seq=row[2],
            updated_at=row[3],
        )


@dataclass
class RemoteCursor:
    source_type: str
    source_id: str
    cursor_json: Dict[str, Any] = field(default_factory=dict)
    snapshot_json: Dict[str, Any] = field(default_factory=dict)
    revision: int = 0
    timestamps: Dict[str, Any] = field(default_factory=dict)
    error_json: Optional[Dict[str, Any]] = None

    @classmethod
    def from_row(cls, row: tuple) -> RemoteCursor:
        return cls(
            source_type=row[0],
            source_id=row[1],
            cursor_json=json.loads(row[2]) if row[2] else {},
            snapshot_json=json.loads(row[3]) if row[3] else {},
            revision=row[4],
            timestamps=json.loads(row[5]) if row[5] else {},
            error_json=json.loads(row[6]) if row[6] else None,
        )


@dataclass
class SystemEvent:
    seq: int
    event_id: str
    topic: str
    entity_type: Optional[str]
    entity_id: Optional[str]
    revision: int
    trace_id: Optional[str]
    payload_json: Optional[Dict[str, Any]] = None
    created_at: str = ""

    @classmethod
    def from_row(cls, row: tuple) -> SystemEvent:
        return cls(
            seq=row[0],
            event_id=row[1],
            topic=row[2],
            entity_type=row[3],
            entity_id=row[4],
            revision=row[5],
            trace_id=row[6],
            payload_json=json.loads(row[7]) if row[7] else None,
            created_at=row[8],
        )


__all__ = [
    "Operation",
    "OperationItem",
    "OperationEvent",
    "UiSnapshot",
    "ConsumerOffset",
    "RemoteCursor",
    "SystemEvent",
]
