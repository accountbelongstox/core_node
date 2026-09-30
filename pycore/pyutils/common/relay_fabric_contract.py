# -*- coding: utf-8 -*-
"""Read-only adapter for the Relay Fabric V3 contract."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any, Dict, List

from pycore.pyfoundations.system_paths import get_core_node_root
from pycore.pyutils.codesync.textnorm import normalize_eol
from pycore.pyutils.common.relay_activity_log import relay_activity_log
from pycore.pyutils.common.relay_contract import relay_contract


RELAY_FABRIC_CONTRACT_PATH = (
    get_core_node_root() / "config" / "pycore_relay_fabric_contract.json"
).resolve()
RELAY_FABRIC_SCHEMA_VERSION = 1
RELAY_FABRIC_PROTOCOL_MAJOR = "3"
RELAY_FABRIC_LANE_FAST = "fast"
RELAY_FABRIC_LANE_DURABLE = "durable"
RELAY_FABRIC_REQUIRED_SECTIONS = (
    "endpoints",
    "topics",
    "event_types",
    "envelope",
    "limits",
    "durations",
    "lanes",
    "errors",
)
RELAY_FABRIC_REQUIRED_ENDPOINTS = ("device_heartbeat",)
RELAY_FABRIC_REQUIRED_TOPICS = ("request", "response")
RELAY_FABRIC_REQUIRED_EVENT_TYPES = ("request", "response")
RELAY_FABRIC_REQUIRED_ENVELOPE_LISTS = (
    "request_fields",
    "request_body_fields",
    "response_fields",
    "response_body_fields",
    "response_part_fields",
    "response_timing_fields",
)
RELAY_FABRIC_REQUIRED_LIMITS = (
    "frame_bytes",
    "inline_body_bytes",
    "max_parts",
    "response_total_bytes",
    "device_max_concurrent_requests",
    "device_dedupe_entries",
)
RELAY_FABRIC_REQUIRED_DURATIONS = (
    "grant_refresh_margin_seconds",
    "device_heartbeat_seconds",
    "device_dedupe_seconds",
    "publish_timeout_seconds",
)
RELAY_FABRIC_REQUIRED_ERRORS = (
    "route_denied",
    "lane_durable_required",
    "device_fabric_unavailable",
    "frame_too_large",
)


class RelayFabricContract:
    """Load, validate, and expose Relay Fabric V3 configuration."""

    def __init__(self, path: Path = RELAY_FABRIC_CONTRACT_PATH) -> None:
        self.path = path.resolve()
        self.raw_bytes = self.path.read_bytes()
        document = json.loads(self.raw_bytes.decode("utf-8"))
        if not isinstance(document, dict):
            raise ValueError("Relay fabric contract root must be an object")
        for section in RELAY_FABRIC_REQUIRED_SECTIONS:
            if not isinstance(document.get(section), dict):
                raise ValueError(f"Relay fabric contract section is required: {section}")
        if int(document.get("schema_version") or 0) != RELAY_FABRIC_SCHEMA_VERSION:
            raise ValueError("Relay fabric contract schema_version is invalid")
        if not str(document.get("protocol_version") or "").startswith(
            RELAY_FABRIC_PROTOCOL_MAJOR + "."
        ):
            raise ValueError("Relay fabric contract protocol_version is invalid")
        self._require_names(document["endpoints"], RELAY_FABRIC_REQUIRED_ENDPOINTS, "endpoint")
        self._require_names(document["topics"], RELAY_FABRIC_REQUIRED_TOPICS, "topic")
        self._require_names(document["event_types"], RELAY_FABRIC_REQUIRED_EVENT_TYPES, "event type")
        self._require_names(document["limits"], RELAY_FABRIC_REQUIRED_LIMITS, "limit")
        self._require_names(document["durations"], RELAY_FABRIC_REQUIRED_DURATIONS, "duration")
        self._require_names(document["errors"], RELAY_FABRIC_REQUIRED_ERRORS, "error")
        if len(set(document["event_types"].values())) != len(document["event_types"]):
            raise ValueError("Relay fabric event types must be unique")
        envelope = document["envelope"]
        if int(envelope.get("version") or 0) != int(RELAY_FABRIC_PROTOCOL_MAJOR):
            raise ValueError("Relay fabric envelope version is invalid")
        for name in RELAY_FABRIC_REQUIRED_ENVELOPE_LISTS:
            if not isinstance(envelope.get(name), list) or not envelope[name]:
                raise ValueError(f"Relay fabric envelope list is required: {name}")
        if (
            envelope.get("time_unit") != "unix_milliseconds"
            or envelope.get("digest_algorithm") != "sha256"
            or envelope.get("body_encoding") != "base64"
        ):
            raise ValueError("Relay fabric envelope encoding profile is invalid")
        limits = document["limits"]
        for name in RELAY_FABRIC_REQUIRED_LIMITS:
            if int(limits[name]) <= 0:
                raise ValueError(f"Relay fabric limit must be positive: {name}")
        if int(limits["inline_body_bytes"]) >= int(limits["frame_bytes"]):
            raise ValueError("Relay fabric inline body limit exceeds the frame limit")
        encoded_total = -(-int(limits["response_total_bytes"]) // 3) * 4
        if -(-encoded_total // int(limits["inline_body_bytes"])) > int(limits["max_parts"]):
            raise ValueError("Relay fabric response total exceeds the part capacity")
        for name in RELAY_FABRIC_REQUIRED_DURATIONS:
            if float(document["durations"][name]) <= 0:
                raise ValueError(f"Relay fabric duration must be positive: {name}")
        lanes = document["lanes"]
        if not isinstance(lanes.get("route_policy_profiles"), dict):
            raise ValueError("Relay fabric lane profiles are required")
        if not isinstance(lanes.get("fast_retry_policies"), list):
            raise ValueError("Relay fabric fast retry policies are required")
        allowed_lanes = (RELAY_FABRIC_LANE_FAST, RELAY_FABRIC_LANE_DURABLE)
        if lanes.get("default") not in allowed_lanes or any(
            value not in allowed_lanes for value in lanes["route_policy_profiles"].values()
        ):
            raise ValueError("Relay fabric lane values are invalid")
        self.document: Dict[str, Any] = document
        # Same canonicalization as the V2 adapter: CRLF -> LF before hashing.
        self.digest = hashlib.sha256(normalize_eol(self.raw_bytes)).hexdigest()

    @staticmethod
    def _require_names(values: Dict[str, Any], names: tuple, kind: str) -> None:
        for name in names:
            if name not in values or values[name] in (None, ""):
                raise ValueError(f"Relay fabric {kind} is required: {name}")

    @property
    def protocol_version(self) -> str:
        return str(self.document["protocol_version"])

    @property
    def envelope_version(self) -> int:
        return int(self.document["envelope"]["version"])

    def endpoint(self, name: str) -> str:
        value = str(self.document["endpoints"].get(name) or "")
        if not value:
            raise KeyError(f"Relay fabric endpoint is not defined: {name}")
        return value

    def topic(self, name: str, **tokens: Any) -> str:
        template = str(self.document["topics"].get(name) or "")
        if not template:
            raise KeyError(f"Relay fabric topic is not defined: {name}")
        resolved = {key: str(value) for key, value in tokens.items()}
        resolved["laravel_api_origin"] = relay_contract.public_url("laravel_api_origin")
        return template.format(**resolved)

    def event_type(self, name: str) -> str:
        value = str(self.document["event_types"].get(name) or "")
        if not value:
            raise KeyError(f"Relay fabric event type is not defined: {name}")
        return value

    def limit(self, name: str) -> int:
        return int(self.document["limits"][name])

    def duration(self, name: str) -> float:
        return float(self.document["durations"][name])

    def envelope_fields(self, name: str) -> List[str]:
        values = self.document["envelope"].get(name)
        if not isinstance(values, list) or not values:
            raise KeyError(f"Relay fabric envelope list is not defined: {name}")
        return [str(value) for value in values]

    def error_status(self, name: str) -> int:
        return int(self.document["errors"][name])

    def lane_for_profile(self, profile: str) -> str:
        lanes = self.document["lanes"]
        return str(lanes["route_policy_profiles"].get(str(profile), lanes["default"]))

    def fast_retry_policies(self) -> List[str]:
        return [str(value) for value in self.document["lanes"]["fast_retry_policies"]]

    def fast_allowed(self, profile: str, retry_policy: str) -> bool:
        return (
            self.lane_for_profile(profile) == RELAY_FABRIC_LANE_FAST
            and str(retry_policy) in self.fast_retry_policies()
        )


relay_fabric_contract = RelayFabricContract()
relay_activity_log.info(
    "fabric.contract.loaded",
    path=relay_fabric_contract.path,
    protocol_version=relay_fabric_contract.protocol_version,
    contract_digest=relay_fabric_contract.digest,
)


__all__ = [
    "RELAY_FABRIC_LANE_DURABLE",
    "RELAY_FABRIC_LANE_FAST",
    "RelayFabricContract",
    "relay_fabric_contract",
]
