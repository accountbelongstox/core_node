# -*- coding: utf-8 -*-
"""Canonical Queue Center and distributed-task contract adapter.

The language-neutral source is ``config/queue_center_contract.json``. Keep this adapter,
the Laravel ``App\Support\QueueCenterContract`` adapter, and the TypeScript
``core/api-libs/pycore/QueueCenterContract.ts`` adapter pointed at that file. The
mcp-chrome adapter is ``apps/mcp-chrome/app/chrome-extension/utils/queue-center-contract.ts``.

Changing a task status, execution lane, capability, wire field, or task-type route
must start in the JSON document. All four runtime adapters derive their values
from it; consumers must not introduce another literal vocabulary.
"""

import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Literal, Mapping, Optional, Tuple, TypedDict

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_CONTRACT_PATH = _PROJECT_ROOT / "config" / "queue_center_contract.json"
_CONTRACT_DOCUMENT: Dict[str, Any] = json.loads(_CONTRACT_PATH.read_text(encoding="utf-8"))
_TASK_CONTRACT: Dict[str, Any] = _CONTRACT_DOCUMENT["task_contract"]

QueueCenterScope = Literal[
    "heartbeat",
    "assist_translation",
    "word_audio",
    "sentence_audio",
    "media_image",
]
QueueCenterSectionLifecycle = Literal["off", "starting", "on", "error"]


class QueueCenterToggleEnvelope(TypedDict):
    requested_by: Optional[str]
    enabled: bool
    reason: Optional[str]
    graceful_stop: bool
    paused_by_user: Optional[bool]


class QueueCenterControlMetrics(TypedDict):
    pending: int
    processing: int
    leased: int
    total: int


class QueueCenterWorkerMetrics(TypedDict):
    online: bool
    claimed: int
    ok: Optional[int]
    fail: Optional[int]
    last_heartbeat: Optional[str]


class QueueCenterSectionContract(TypedDict, total=False):
    type: QueueCenterScope
    category: str
    queue: QueueCenterControlMetrics
    worker: QueueCenterWorkerMetrics
    toggle: QueueCenterToggleEnvelope
    lifecycle: QueueCenterSectionLifecycle
    error_code: Optional[str]
    last_error: Optional[str]
    observed_at: Optional[str]
    age_s: Optional[float]
    stale: bool


class GlobalTaskRecord(TypedDict, total=False):
    """Language-neutral Laravel global-task wire model used by every consumer."""

    task_id: str
    app_name: str
    task_type: str
    execution_type: str
    capability: Optional[str]
    is_fast_tier: bool
    status: str
    priority: int
    progress: float
    payload: Dict[str, Any]
    result: Optional[Dict[str, Any]]
    error: Optional[str]
    assigned_to: Optional[str]
    timeout_seconds: int
    assigned_at: Optional[str]
    timeout_at: Optional[str]
    completed_at: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]


QUEUE_CENTER_SCHEMA_VERSION = int(_CONTRACT_DOCUMENT["schema_version"])
QUEUE_CENTER_CONTROL_NAMES: Tuple[str, ...] = tuple(_CONTRACT_DOCUMENT["control_names"])
QUEUE_CENTER_CAPABILITY_CLAIMANTS: Dict[str, Tuple[str, ...]] = {
    key: tuple(str(item) for item in value)
    for key, value in _CONTRACT_DOCUMENT["capability_claimants"].items()
}
QUEUE_CENTER_SECTION_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    key: dict(value)
    for key, value in _CONTRACT_DOCUMENT["section_scopes"].items()
}
QUEUE_CATEGORY_CATALOG: List[Dict[str, Any]] = []
for _category_definition in _CONTRACT_DOCUMENT["categories"]:
    _category = dict(_category_definition)
    _capability = _category.get("capability")
    _category["claimants"] = list(
        QUEUE_CENTER_CAPABILITY_CLAIMANTS.get(
            str(_capability),
            (str(_category["primary_handler"]),),
        )
    )
    QUEUE_CATEGORY_CATALOG.append(_category)
QUEUE_COUNT_KEYS: Tuple[str, ...] = tuple(_CONTRACT_DOCUMENT["metric_semantics"].keys())

GLOBAL_TASK_STATUSES: Tuple[str, ...] = tuple(_TASK_CONTRACT["statuses"]["all"])
GLOBAL_TASK_LIVE_STATUSES: Tuple[str, ...] = tuple(_TASK_CONTRACT["statuses"]["live"])
GLOBAL_TASK_TERMINAL_STATUSES: Tuple[str, ...] = tuple(_TASK_CONTRACT["statuses"]["terminal"])
GLOBAL_TASK_WORKER_RESULT_STATUSES: Tuple[str, ...] = tuple(
    _TASK_CONTRACT["statuses"]["worker_reportable"]
)
GLOBAL_TASK_EXECUTION_TYPES: Tuple[str, ...] = tuple(_TASK_CONTRACT["execution_types"])
GLOBAL_TASK_CAPABILITIES: Tuple[str, ...] = tuple(
    _CONTRACT_DOCUMENT["capability_claimants"].keys()
)
GLOBAL_TASK_PRIORITIES: Dict[str, int] = {
    str(key): int(value) for key, value in _TASK_CONTRACT["priorities"].items()
}
GLOBAL_TASK_CAPABILITY_SINGLE_LANES: Dict[str, str] = {
    str(key): str(value)
    for key, value in _TASK_CONTRACT["capability_single_lanes"].items()
}
GLOBAL_TASK_WIRE_SHAPES: Dict[str, Tuple[str, ...]] = {
    str(key): tuple(str(field) for field in value)
    for key, value in _TASK_CONTRACT["wire_shapes"].items()
}
GLOBAL_TASK_TYPE_CATALOG: Tuple[Dict[str, Any], ...] = tuple(
    dict(definition) for definition in _TASK_CONTRACT["task_types"]
)
GLOBAL_TASK_TYPES_BY_KEY: Dict[str, Dict[str, Any]] = {
    str(definition["key"]): definition for definition in GLOBAL_TASK_TYPE_CATALOG
}
_HISTORY_CONTRACT: Dict[str, Any] = _TASK_CONTRACT["history_buckets"]
GLOBAL_TASK_HISTORY_BUCKETS: Tuple[str, ...] = tuple(_HISTORY_CONTRACT["all"])

CALLBACK_QUEUE_ROLES: Dict[str, str] = {
    "translation_worker": "consumer",
    "translation_queue_monitor": "monitor",
    "translation_ws_client": "signal",
    "tts_queue_poller": "consumer",
    "tts_sentence_worker": "consumer",
    "ai_rate_reset": "maintainer",
    "agent_history_extraction": "maintainer",
    "agent_history_pipeline": "maintainer",
}


def get_queue_center_contract() -> Dict[str, Any]:
    """Return an isolated copy of the canonical JSON document."""
    return json.loads(json.dumps(_CONTRACT_DOCUMENT))


def task_type_definition(task_type: object) -> Optional[Dict[str, Any]]:
    """Return an isolated central task-type definition, if one exists."""
    key = str(task_type or "").strip().lower()
    definition = GLOBAL_TASK_TYPES_BY_KEY.get(key)
    return deepcopy(definition) if definition is not None else None


def task_execution_type(task_type: object, fallback: str = "remote_translation") -> str:
    """Resolve a Laravel task_type to its centrally assigned execution lane."""
    definition = task_type_definition(task_type)
    return str(definition.get("execution_type") or fallback) if definition else fallback


def task_capability(task_type: object) -> Optional[str]:
    """Resolve a task type's fixed capability; ``None`` means lane-only routing."""
    definition = task_type_definition(task_type)
    capability = definition.get("capability") if definition else None
    return str(capability) if capability else None


def task_types_for_execution(execution_type: str) -> Tuple[str, ...]:
    """Return task types assigned to one central execution lane."""
    return tuple(
        str(definition["key"])
        for definition in GLOBAL_TASK_TYPE_CATALOG
        if definition.get("execution_type") == execution_type
    )


def task_local_label(task_type: object, capability: object = None) -> str:
    """Resolve the pycore local TaskManager label for one Laravel task."""
    if str(capability or "") == "ai_translate":
        return "remote_ai_translate"
    definition = task_type_definition(task_type)
    if definition:
        return str(definition.get("pycore_local_label") or "remote_translation")
    return "remote_translation"


def project_task_record(raw: Mapping[str, Any], shape: str) -> GlobalTaskRecord:
    """Project an arbitrary mapping onto a central global-task wire shape."""
    fields = GLOBAL_TASK_WIRE_SHAPES.get(shape)
    if fields is None:
        raise ValueError(f"Unknown global-task wire shape: {shape}")
    return {field: raw.get(field) for field in fields}  # type: ignore[return-value]


def normalize_task_history_type(raw_task_type: object) -> str:
    """Map raw and legacy task names to the shared completed-history bucket."""
    fallback = str(_HISTORY_CONTRACT["fallback"])
    task_type = str(raw_task_type or "").strip().lower()
    if not task_type:
        return fallback
    if task_type in GLOBAL_TASK_HISTORY_BUCKETS:
        return task_type

    exact_aliases = _HISTORY_CONTRACT.get("exact_aliases", {})
    exact = exact_aliases.get(task_type)
    if exact:
        return str(exact)

    for rule in _HISTORY_CONTRACT.get("token_rules", []):
        all_tokens = tuple(str(token) for token in rule.get("all", []))
        any_tokens = tuple(str(token) for token in rule.get("any", []))
        if all(token in task_type for token in all_tokens) and (
            not any_tokens or any(token in task_type for token in any_tokens)
        ):
            return str(rule["bucket"])
    return fallback


def category_keys_for_scope(scope: QueueCenterScope) -> Tuple[str, ...]:
    raw = QUEUE_CENTER_SECTION_DEFINITIONS.get(scope, {}).get("category_keys", [])
    return tuple(str(value) for value in raw)


def build_empty_queue_contract(
    scope: QueueCenterScope,
    observed_at: Optional[str] = None,
) -> QueueCenterSectionContract:
    definition = QUEUE_CENTER_SECTION_DEFINITIONS[scope]
    contract: QueueCenterSectionContract = {
        "type": scope,
        "category": str(definition["category"]),
        "observed_at": observed_at,
    }
    contract.update(deepcopy(_CONTRACT_DOCUMENT["section_contract_defaults"]))
    return contract


__all__ = [
    "CALLBACK_QUEUE_ROLES",
    "QUEUE_CATEGORY_CATALOG",
    "QUEUE_CENTER_CONTROL_NAMES",
    "QUEUE_CENTER_CAPABILITY_CLAIMANTS",
    "QUEUE_CENTER_SCHEMA_VERSION",
    "QUEUE_CENTER_SECTION_DEFINITIONS",
    "QUEUE_COUNT_KEYS",
    "GLOBAL_TASK_CAPABILITIES",
    "GLOBAL_TASK_CAPABILITY_SINGLE_LANES",
    "GLOBAL_TASK_EXECUTION_TYPES",
    "GLOBAL_TASK_HISTORY_BUCKETS",
    "GLOBAL_TASK_LIVE_STATUSES",
    "GLOBAL_TASK_PRIORITIES",
    "GLOBAL_TASK_STATUSES",
    "GLOBAL_TASK_TERMINAL_STATUSES",
    "GLOBAL_TASK_TYPE_CATALOG",
    "GLOBAL_TASK_TYPES_BY_KEY",
    "GLOBAL_TASK_WIRE_SHAPES",
    "GLOBAL_TASK_WORKER_RESULT_STATUSES",
    "GlobalTaskRecord",
    "QueueCenterControlMetrics",
    "QueueCenterScope",
    "QueueCenterSectionContract",
    "QueueCenterSectionLifecycle",
    "QueueCenterToggleEnvelope",
    "QueueCenterWorkerMetrics",
    "build_empty_queue_contract",
    "category_keys_for_scope",
    "get_queue_center_contract",
    "normalize_task_history_type",
    "project_task_record",
    "task_capability",
    "task_execution_type",
    "task_local_label",
    "task_type_definition",
    "task_types_for_execution",
]
