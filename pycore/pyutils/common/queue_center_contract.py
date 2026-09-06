# -*- coding: utf-8 -*-
"""Shared Queue Center and distributed-task contract adapter.

The language-neutral source is ``config/queue_center_contract.json``. Keep this adapter,
the Laravel ``App\\Support\\QueueCenterContract`` adapter, and the TypeScript
``core/contracts/QueueCenterContract.ts`` adapter pointed at that file. The
mcp-chrome adapter is ``apps/mcp-chrome/app/chrome-extension/utils/queue-center-contract.ts``.

Changing a task status, execution lane, capability, wire field, or task-type route
must start in the JSON document. All four runtime adapters derive their values
from it; consumers must not introduce another literal vocabulary.
"""

import json
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Literal, Mapping, Optional, Tuple, TypedDict
from urllib.parse import quote

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_CONTRACT_PATH = _PROJECT_ROOT / "config" / "queue_center_contract.json"
_CONTRACT_DOCUMENT: Dict[str, Any] = json.loads(_CONTRACT_PATH.read_text(encoding="utf-8"))
_TASK_CONTRACT: Dict[str, Any] = _CONTRACT_DOCUMENT["task_contract"]

QueueCenterScope = str
QueueCenterSectionLifecycle = Literal["off", "starting", "on", "error"]


def http_transfer_contract() -> Dict[str, Any]:
    values = _CONTRACT_DOCUMENT.get("http_transfer") or {}
    return {
        "protocol": str(values.get("protocol") or "offset-v1"),
        "chunk_bytes": int(values.get("chunk_bytes") or 262144),
        "maximum_chunk_bytes": int(values.get("maximum_chunk_bytes") or 1048576),
        "connect_timeout_seconds": int(values.get("connect_timeout_seconds") or 15),
        "idle_timeout_seconds": int(values.get("idle_timeout_seconds") or 30),
        "retry_interval_ms": int(values.get("retry_interval_ms") or 250),
    }


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
    queue_position: int
    priority: int
    progress: float
    payload: Dict[str, Any]
    result: Optional[Dict[str, Any]]
    error: Optional[str]
    assigned_to: Optional[str]
    timeout_seconds: int
    retry_count: int
    max_retries: int
    assigned_at: Optional[str]
    timeout_at: Optional[str]
    completed_at: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]


class GlobalTaskCreateResult(TypedDict, total=False):
    task_id: str
    execution_type: str
    queue_position: int
    priority: int
    is_fast_tier: bool


class GlobalTaskEventRecord(TypedDict, total=False):
    id: object
    task_id: str
    event: str
    worker_id: Optional[str]
    attempt: Optional[int]
    detail: Optional[Dict[str, Any]]
    created_at: Optional[str]
    _id: object


class GlobalTaskCurrentPhase(TypedDict):
    phase: Optional[str]
    worker_id: Optional[str]
    elapsed_seconds: Optional[int]


class GlobalTaskDetailMetadata(TypedDict):
    total_attempts: int
    max_retries: int
    will_retry: bool
    estimated_timeout_in_seconds: Optional[int]


class GlobalTaskDetailBundle(TypedDict):
    task: GlobalTaskRecord
    events: List[GlobalTaskEventRecord]
    current_phase: GlobalTaskCurrentPhase
    metadata: GlobalTaskDetailMetadata


class GlobalTaskStatsRecord(TypedDict):
    total: int
    pending: int
    assigned: int
    processing: int
    completed: int
    completed_demo: int
    failed: int
    cancelled: int


class GlobalTaskWorkerRegistration(TypedDict, total=False):
    worker_id: str
    worker_name: str
    processor_types: List[str]
    capabilities: List[str]
    hostname: str
    platform: str
    metadata: Dict[str, Any]
    lease_capacity: int


class GlobalTaskWorkerResult(TypedDict, total=False):
    task_id: str
    worker_id: str
    attempt: int
    status: str
    progress: float
    result: Dict[str, Any]
    error: str


QUEUE_CENTER_SCHEMA_VERSION = int(_CONTRACT_DOCUMENT["schema_version"])
QUEUE_CENTER_REALTIME: Dict[str, Any] = dict(_CONTRACT_DOCUMENT["realtime"])
QUEUE_CENTER_REALTIME_EVENTS: Dict[str, str] = {
    str(key): str(value)
    for key, value in QUEUE_CENTER_REALTIME["events"].items()
}
QUEUE_CENTER_DIFF_DELIVERY: Dict[str, Any] = dict(_CONTRACT_DOCUMENT["diff_delivery"])
QUEUE_CENTER_ENDPOINTS: Dict[str, str] = {
    str(key): str(value)
    for key, value in _CONTRACT_DOCUMENT["endpoints"].items()
}


def queue_center_endpoint(role: str, **tokens: Any) -> str:
    """Render one contract-owned Laravel endpoint path.

    Templates live in config/queue_center_contract.json ``endpoints``; token
    values are URL path segments and are percent-encoded here.
    """
    template = QUEUE_CENTER_ENDPOINTS.get(role)
    if not template:
        raise RuntimeError(f"Unknown Queue Center endpoint role: {role}")
    path = template
    for key, value in tokens.items():
        path = path.replace("{" + key + "}", quote(str(value), safe=""))
    return path
QUEUE_CENTER_DELIVERY_RECEIPT: Dict[str, Any] = dict(_CONTRACT_DOCUMENT["delivery_receipt"])
QUEUE_CENTER_CONTROL_NAMES: Tuple[str, ...] = tuple(_CONTRACT_DOCUMENT["control_names"])
QUEUE_CENTER_CAPABILITY_CLAIMANTS: Dict[str, Tuple[str, ...]] = {
    key: tuple(str(item) for item in value)
    for key, value in _CONTRACT_DOCUMENT["capability_claimants"].items()
}
QUEUE_CENTER_SECTION_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    key: dict(value)
    for key, value in _CONTRACT_DOCUMENT["section_scopes"].items()
}
QUEUE_CENTER_SCOPES: Tuple[QueueCenterScope, ...] = tuple(
    QUEUE_CENTER_SECTION_DEFINITIONS
)
QUEUE_CATEGORY_CATALOG: List[Dict[str, Any]] = []
for _category_definition in _CONTRACT_DOCUMENT["categories"]:
    _category = dict(_category_definition)
    _capability = _category.get("capability")
    _task_type = next(
        (
            definition
            for definition in _CONTRACT_DOCUMENT["task_contract"]["task_types"]
            if definition.get("key") == _category.get("laravel_task_type")
        ),
        {},
    )
    _category["claimants"] = list(
        _task_type.get(
            "claimants",
            QUEUE_CENTER_CAPABILITY_CLAIMANTS.get(
                str(_capability),
                (str(_category["primary_handler"]),),
            ),
        )
    )
    QUEUE_CATEGORY_CATALOG.append(_category)
QUEUE_COUNT_KEYS: Tuple[str, ...] = tuple(_CONTRACT_DOCUMENT["metric_semantics"].keys())


def _assert_queue_center_section_coverage() -> None:
    category_keys = {
        str(definition["key"])
        for definition in QUEUE_CATEGORY_CATALOG
    }
    missing_controls = set(QUEUE_CENTER_CONTROL_NAMES).difference(QUEUE_CENTER_SCOPES)
    if missing_controls:
        missing = ", ".join(sorted(missing_controls))
        raise RuntimeError(f"Queue Center controls missing section scopes: {missing}")
    for scope, definition in QUEUE_CENTER_SECTION_DEFINITIONS.items():
        category = definition.get("category")
        scope_category_keys = definition.get("category_keys")
        if not isinstance(category, str) or not category:
            raise RuntimeError(f"Queue Center section missing category: {scope}")
        if not isinstance(scope_category_keys, list) or not scope_category_keys:
            raise RuntimeError(f"Queue Center section missing category keys: {scope}")
        unknown_keys = {
            str(value)
            for value in scope_category_keys
            if str(value) not in category_keys
        }
        if unknown_keys:
            unknown = ", ".join(sorted(unknown_keys))
            raise RuntimeError(
                f"Queue Center section {scope} has unknown category keys: {unknown}"
            )


_assert_queue_center_section_coverage()

GLOBAL_TASK_STATUSES_BY_ROLE: Dict[str, str] = {
    str(key): str(value) for key, value in _TASK_CONTRACT["statuses"]["values"].items()
}
GLOBAL_TASK_STATUSES: Tuple[str, ...] = tuple(
    GLOBAL_TASK_STATUSES_BY_ROLE[role] for role in _TASK_CONTRACT["statuses"]["all"]
)
GLOBAL_TASK_LIVE_STATUSES: Tuple[str, ...] = tuple(
    GLOBAL_TASK_STATUSES_BY_ROLE[role] for role in _TASK_CONTRACT["statuses"]["live"]
)
GLOBAL_TASK_TERMINAL_STATUSES: Tuple[str, ...] = tuple(
    GLOBAL_TASK_STATUSES_BY_ROLE[role] for role in _TASK_CONTRACT["statuses"]["terminal"]
)
GLOBAL_TASK_WORKER_RESULT_STATUSES: Tuple[str, ...] = tuple(
    GLOBAL_TASK_STATUSES_BY_ROLE[role]
    for role in _TASK_CONTRACT["statuses"]["worker_reportable"]
)
GLOBAL_TASK_EVENTS_BY_ROLE: Dict[str, str] = {
    str(key): str(value) for key, value in _TASK_CONTRACT["events"]["values"].items()
}
GLOBAL_TASK_TERMINAL_EVENTS: Tuple[str, ...] = tuple(
    GLOBAL_TASK_EVENTS_BY_ROLE[role] for role in _TASK_CONTRACT["events"]["terminal"]
)
GLOBAL_TASK_STREAM_EVENTS_BY_ROLE: Dict[str, str] = {
    str(key): str(value) for key, value in _TASK_CONTRACT["stream_events"].items()
}
GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE: Dict[str, str] = {
    str(key): str(value) for key, value in _TASK_CONTRACT["execution_types"].items()
}
GLOBAL_TASK_EXECUTION_TYPES: Tuple[str, ...] = tuple(
    GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE.values()
)
GLOBAL_TASK_CAPABILITIES: Tuple[str, ...] = tuple(
    _CONTRACT_DOCUMENT["capability_claimants"].keys()
)
GLOBAL_TASK_CAPABILITIES_BY_ROLE: Dict[str, str] = {
    str(capability): str(capability)
    for capability in _CONTRACT_DOCUMENT["capability_claimants"].keys()
}
GLOBAL_TASK_PRIORITIES: Dict[str, int] = {
    str(key): int(value) for key, value in _TASK_CONTRACT["priorities"].items()
}
GLOBAL_TASK_PROGRESS_STAGES: Dict[str, int] = {
    str(key): int(value) for key, value in _TASK_CONTRACT["progress_stages"].items()
}
GLOBAL_TASK_PROGRESS_TOTAL = GLOBAL_TASK_PROGRESS_STAGES["completed"]
GLOBAL_TASK_LIMITS: Dict[str, int] = {
    str(key): int(value) for key, value in _TASK_CONTRACT["limits"].items()
}
GLOBAL_TASK_CAPABILITY_SINGLE_LANES: Dict[str, str] = {
    str(key): str(value)
    for key, value in _TASK_CONTRACT["capability_single_lanes"].items()
}
GLOBAL_TASK_FAST_LANE_CAPABILITIES: Tuple[str, ...] = tuple(
    str(value) for value in _TASK_CONTRACT["fast_lane_capabilities"]
)
GLOBAL_TASK_WIRE_SHAPES: Dict[str, Tuple[str, ...]] = {
    str(key): tuple(str(field) for field in value)
    for key, value in _TASK_CONTRACT["wire_shapes"].items()
}
_GLOBAL_TASK_WIRE_TYPED_DICTS: Dict[str, Any] = {
    "create_result": GlobalTaskCreateResult,
    "summary": GlobalTaskRecord,
    "worker_pull": GlobalTaskRecord,
    "status": GlobalTaskRecord,
    "detail": GlobalTaskRecord,
    "event": GlobalTaskEventRecord,
    "detail_bundle": GlobalTaskDetailBundle,
    "current_phase": GlobalTaskCurrentPhase,
    "detail_metadata": GlobalTaskDetailMetadata,
    "stats": GlobalTaskStatsRecord,
    "worker_registration": GlobalTaskWorkerRegistration,
    "worker_result": GlobalTaskWorkerResult,
}


GLOBAL_TASK_TYPE_CATALOG: Tuple[Dict[str, Any], ...] = tuple(
    dict(definition) for definition in _TASK_CONTRACT["task_types"]
)
GLOBAL_TASK_TYPES_BY_KEY: Dict[str, Dict[str, Any]] = {
    str(definition["key"]): definition for definition in GLOBAL_TASK_TYPE_CATALOG
}


def _build_task_types_by_name() -> Dict[str, Dict[str, Any]]:
    definitions: Dict[str, Dict[str, Any]] = {}
    for definition in GLOBAL_TASK_TYPE_CATALOG:
        ordering = definition.get("ordering")
        key = str(definition.get("key") or "").strip().lower()
        if not key or ordering not in ("queue_position", "priority"):
            raise RuntimeError(f"Queue Center task type has invalid ordering: {key}")
        for name in (key, *definition.get("aliases", [])):
            normalized = str(name).strip().lower()
            if not normalized or normalized in definitions:
                raise RuntimeError(
                    f"Queue Center task type name is duplicated: {normalized}"
                )
            definitions[normalized] = definition
    return definitions


GLOBAL_TASK_TYPES_BY_NAME: Dict[str, Dict[str, Any]] = _build_task_types_by_name()
_HISTORY_CONTRACT: Dict[str, Any] = _TASK_CONTRACT["history_buckets"]
GLOBAL_TASK_HISTORY_BUCKETS: Tuple[str, ...] = tuple(_HISTORY_CONTRACT["all"])

CALLBACK_QUEUE_ROLES: Dict[str, str] = dict(
    _CONTRACT_DOCUMENT["callback_queue_roles"]
)


def _assert_global_task_wire_dto_coverage() -> None:
    for shape, fields in GLOBAL_TASK_WIRE_SHAPES.items():
        typed_dict = _GLOBAL_TASK_WIRE_TYPED_DICTS.get(shape)
        if typed_dict is None:
            raise RuntimeError(f"Missing Queue Center DTO for wire shape: {shape}")
        missing = [field for field in fields if field not in typed_dict.__annotations__]
        if missing:
            missing_fields = ", ".join(missing)
            raise RuntimeError(
                f"Queue Center DTO drift detected for wire shape {shape}: {missing_fields}"
            )


_assert_global_task_wire_dto_coverage()


def get_queue_center_contract() -> Dict[str, Any]:
    """Return an isolated copy of the canonical JSON document."""
    return json.loads(json.dumps(_CONTRACT_DOCUMENT))


def task_type_definition(task_type: object) -> Optional[Dict[str, Any]]:
    """Return an isolated central task-type definition, if one exists."""
    key = str(task_type or "").strip().lower()
    definition = GLOBAL_TASK_TYPES_BY_NAME.get(key)
    return deepcopy(definition) if definition is not None else None


def task_type_claimants(task_type: object) -> Tuple[str, ...]:
    """Return the contract-owned claimant list for one task type."""
    definition = GLOBAL_TASK_TYPES_BY_NAME.get(str(task_type or "").strip().lower())
    if definition is None:
        return ()
    explicit = definition.get("claimants")
    if isinstance(explicit, list):
        return tuple(str(claimant) for claimant in explicit)
    capability = definition.get("capability")
    return QUEUE_CENTER_CAPABILITY_CLAIMANTS.get(str(capability), ())


def task_types_for_claimant(claimant: object, capability: object = None) -> Tuple[str, ...]:
    """Return task types assigned to a claimant, optionally for one capability."""
    claimant_name = str(claimant or "").strip().lower()
    capability_name = str(capability or "").strip()
    return tuple(
        str(definition["key"])
        for definition in GLOBAL_TASK_TYPE_CATALOG
        if (not capability_name or str(definition.get("capability") or "") == capability_name)
        and claimant_name in task_type_claimants(definition["key"])
    )


def queue_consumer_slice_limit(task_type: object) -> int:
    """Return the canonical bounded pull size for one queue."""
    limits = QUEUE_CENTER_DIFF_DELIVERY.get("consumer_batch_limits") or {}
    return max(
        1,
        int(
            limits.get(str(task_type or ""))
            or QUEUE_CENTER_DIFF_DELIVERY.get("consumer_slice_default")
            or GLOBAL_TASK_LIMITS["worker_pull_default"]
        ),
    )


def task_execution_type(task_type: object, fallback: str = "remote_translation") -> str:
    """Resolve a Laravel task_type to its centrally assigned execution lane."""
    definition = task_type_definition(task_type)
    return str(definition.get("execution_type") or fallback) if definition else fallback


def task_capability(task_type: object) -> Optional[str]:
    """Resolve a task type's fixed capability; ``None`` means lane-only routing."""
    definition = task_type_definition(task_type)
    capability = definition.get("capability") if definition else None
    return str(capability) if capability else None


def task_ordering(task_type: object) -> str:
    """Return the single ordering authority for a task type.

    ``queue_position`` means Laravel-owned Queue Center head ordering;
    ``priority`` means the contract-defined numeric task priority. No caller
    may branch on literal audio task-type lists.
    """
    definition = task_type_definition(task_type)
    if definition is None:
        return "priority"
    ordering = definition.get("ordering")
    if ordering in ("queue_position", "priority"):
        return str(ordering)
    raise RuntimeError(f"Queue Center task type has invalid ordering: {task_type}")


def is_queue_position_ordered(task_type: object) -> bool:
    """Whether a task type orders strictly by Laravel-owned queue_position."""
    return task_ordering(task_type) == "queue_position"


def task_language_priority(task_type: object) -> Tuple[str, ...]:
    """Language priority tiers for a task type (empty tuple = no tiering).

    SPECIAL OPTIMIZATION (specially optimized script, 特殊优化的脚本):
    tiered lanes complete EVERY task of the first tier before any task of a
    later tier, ahead of the lane's queue_position/priority ordering. The
    canonical data is config/queue_center_contract.json (language_priority);
    mirror of QueueCenterContract::taskLanguagePriority().
    """
    definition = task_type_definition(task_type)
    if definition is None:
        return ()
    tiers = definition.get("language_priority")
    if not isinstance(tiers, list):
        return ()
    normalized = []
    for language in tiers:
        value = str(language or "").strip().lower()
        if value:
            normalized.append(value)
    return tuple(normalized)


def task_language_tier_rank(task: Mapping[str, Any], fallback_task_type: object = None) -> int:
    """Ascending language-tier rank of one task record (0 = first tier).

    Untiered task types and languages outside every tier rank last (1) so the
    tiered languages complete first, matching the Laravel claim-head SQL
    (CASE WHEN lower(trim(payload->>'language')) IN (tiers) THEN 0 ELSE 1 END).
    ``fallback_task_type`` covers lane-scoped queues whose task dicts may not
    carry task_type themselves.
    """
    tiers = task_language_priority(task.get("task_type") or fallback_task_type)
    if not tiers:
        return 1
    language = str((task.get("payload") or {}).get("language") or "").strip().lower()
    return 0 if language in tiers else 1


QUEUE_CENTER_QUEUE_POSITION_CONTROLS: Tuple[str, ...] = tuple(
    scope
    for scope in QUEUE_CENTER_CONTROL_NAMES
    if is_queue_position_ordered(scope)
)
QUEUE_CENTER_QUEUE_POSITION_TASK_ALIASES: Tuple[str, ...] = tuple(
    str(alias)
    for definition in GLOBAL_TASK_TYPE_CATALOG
    if definition.get("ordering") == "queue_position"
    for alias in definition.get("aliases", [])
)


def task_order_value(task: Mapping[str, Any]) -> int:
    """Read the contract-owned ordering value from one task record."""
    field = task_ordering(task.get("task_type"))
    return int(task.get(field) or 0)


def task_order_key(task: Mapping[str, Any]) -> Tuple[int]:
    """Return a stable ascending-sort key for descending contract order."""
    return (task_language_tier_rank(task), -task_order_value(task),)


def task_prompt_payload_field(task_type: object) -> str:
    """Return the primary prompt key declared for a task type."""
    definition = task_type_definition(task_type) or {}
    return str(definition.get("prompt_payload_field") or "question")


def task_prompt_text(task_type: object, payload: Mapping[str, Any]) -> str:
    """Read a prompt using the central primary field plus legacy fallbacks."""
    fields = dict.fromkeys((
        task_prompt_payload_field(task_type),
        "text",
        "source_text",
        "question",
        "prompt",
    ))
    for field in fields:
        value = payload.get(field)
        if isinstance(value, str) and value.strip():
            return value
    return ""


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
    "QUEUE_CENTER_REALTIME",
    "QUEUE_CENTER_REALTIME_EVENTS",
    "QUEUE_CENTER_QUEUE_POSITION_CONTROLS",
    "QUEUE_CENTER_QUEUE_POSITION_TASK_ALIASES",
    "QUEUE_CENTER_DIFF_DELIVERY",
    "QUEUE_CENTER_ENDPOINTS",
    "queue_center_endpoint",
    "QUEUE_CENTER_SECTION_DEFINITIONS",
    "QUEUE_CENTER_SCOPES",
    "QUEUE_COUNT_KEYS",
    "GLOBAL_TASK_CAPABILITIES",
    "GLOBAL_TASK_CAPABILITIES_BY_ROLE",
    "GLOBAL_TASK_CAPABILITY_SINGLE_LANES",
    "GLOBAL_TASK_EXECUTION_TYPES",
    "GLOBAL_TASK_EXECUTION_TYPES_BY_ROLE",
    "GLOBAL_TASK_EVENTS_BY_ROLE",
    "GLOBAL_TASK_HISTORY_BUCKETS",
    "GLOBAL_TASK_FAST_LANE_CAPABILITIES",
    "GLOBAL_TASK_LIMITS",
    "GLOBAL_TASK_LIVE_STATUSES",
    "GLOBAL_TASK_PRIORITIES",
    "GLOBAL_TASK_PROGRESS_STAGES",
    "GLOBAL_TASK_PROGRESS_TOTAL",
    "GLOBAL_TASK_STATUSES",
    "GLOBAL_TASK_STATUSES_BY_ROLE",
    "GLOBAL_TASK_STREAM_EVENTS_BY_ROLE",
    "GLOBAL_TASK_TERMINAL_STATUSES",
    "GLOBAL_TASK_TERMINAL_EVENTS",
    "GLOBAL_TASK_TYPE_CATALOG",
    "GLOBAL_TASK_TYPES_BY_KEY",
    "GLOBAL_TASK_TYPES_BY_NAME",
    "GLOBAL_TASK_WIRE_SHAPES",
    "GLOBAL_TASK_WORKER_RESULT_STATUSES",
    "GlobalTaskCurrentPhase",
    "GlobalTaskCreateResult",
    "GlobalTaskDetailBundle",
    "GlobalTaskDetailMetadata",
    "GlobalTaskEventRecord",
    "GlobalTaskRecord",
    "GlobalTaskStatsRecord",
    "GlobalTaskWorkerRegistration",
    "GlobalTaskWorkerResult",
    "QueueCenterControlMetrics",
    "QueueCenterScope",
    "QueueCenterSectionContract",
    "QueueCenterSectionLifecycle",
    "QueueCenterToggleEnvelope",
    "QueueCenterWorkerMetrics",
    "build_empty_queue_contract",
    "category_keys_for_scope",
    "get_queue_center_contract",
    "http_transfer_contract",
    "is_queue_position_ordered",
    "normalize_task_history_type",
    "project_task_record",
    "queue_consumer_slice_limit",
    "task_capability",
    "task_execution_type",
    "task_local_label",
    "task_ordering",
    "task_order_key",
    "task_order_value",
    "task_prompt_payload_field",
    "task_prompt_text",
    "task_type_definition",
    "task_type_claimants",
    "task_types_for_claimant",
    "task_types_for_execution",
]
