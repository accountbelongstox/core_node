# -*- coding: utf-8 -*-
"""Machine-readable contract of the pycore relay."""

from __future__ import annotations

import hashlib
import json
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional

from pycore.pyfoundations.system_paths import get_core_node_root
from pycore.pyfoundations.text_eol import normalize_eol
from pycore.pyutils.common.relay_activity_log import relay_activity_log


RELAY_CONTRACT_PATH = (
    get_core_node_root() / "config" / "pycore_relay_contract.json"
).resolve()
RELAY_CONTRACT_REQUIRED_SECTIONS = (
    "signature_profile",
    "request_digest_profile",
    "response_digest_profile",
    "endpoints",
    "public_urls",
    "topics",
    "events",
    "event_payload_profiles",
    "device_events",
    "hub_profile",
    "frame_profile",
    "durations",
    "limits",
    "rate_limits",
    "headers",
    "delivery_guarantees",
    "route_policy_matching",
    "route_policy_profiles",
    "route_policies",
    "errors",
    "capabilities",
    "capability_providers",
)
RELAY_ROUTE_PROFILE_REQUIRED_FIELDS = (
    "exposure",
    "permission",
    "payload",
    "timeout_seconds",
    "delivery",
)
RELAY_REQUIRED_ENDPOINTS = {
    "enrollment_create",
    "enrollment_status",
    "device_heartbeat",
    "device_event",
    "device_request_blob_download",
    "device_response_blob_allocate",
    "device_response_blob_chunk",
    "device_response_blob_finalize",
    "owner_enrollment_claim",
    "owner_device_roster",
    "owner_pairing_create",
    "owner_pairing_renew",
    "owner_pairing_revoke",
    "owner_grant",
    "owner_frames",
    "owner_telemetry",
    "owner_stats",
    "owner_request_blob_allocate",
    "owner_request_blob_chunk",
    "owner_request_blob_finalize",
    "owner_response_blob_download",
}
RELAY_REQUIRED_TOPICS = {"request", "response", "owner_events"}
RELAY_REQUIRED_EVENTS = {
    "request_frame",
    "response_frame",
    "credential_revoked",
    "pairing_changed",
    "device_presence",
    "terminal_changed",
    "agent_history_prompt_new",
    "agent_history_prompt_derived",
    "agent_history_config_changed",
    "pycore_events",
}
RELAY_FRAME_KIND_ACK = "ack"
RELAY_FRAME_KIND_PROGRESS = "progress"
RELAY_FRAME_KIND_RESULT = "result"
RELAY_DELIVERY_READ = "read"
RELAY_DELIVERY_IDEMPOTENT_WRITE = "idempotent_write"
RELAY_DELIVERY_AT_MOST_ONCE = "at_most_once_action"
RELAY_HTTP_METHODS = ("GET", "POST")
RELAY_ROUTE_MATCH_KINDS = ("exact", "prefix", "suffix")


def _origin_parts(value: str) -> urllib.parse.SplitResult:
    return urllib.parse.urlsplit(str(value or ""))


class RelayContract:
    """Load, validate, and expose the relay configuration without local defaults."""

    def __init__(self, path: Path = RELAY_CONTRACT_PATH) -> None:
        self.path = path.resolve()
        self.raw_bytes = self.path.read_bytes()
        document = json.loads(self.raw_bytes.decode("utf-8"))
        if not isinstance(document, dict):
            raise ValueError("Relay contract root must be an object")
        for section in RELAY_CONTRACT_REQUIRED_SECTIONS:
            if section not in document:
                raise ValueError(f"Relay contract section is required: {section}")
        self._require_named_values(document["endpoints"], RELAY_REQUIRED_ENDPOINTS, "endpoint")
        self._require_named_values(document["topics"], RELAY_REQUIRED_TOPICS, "topic")
        self._require_named_values(document["events"], RELAY_REQUIRED_EVENTS, "event")
        if len(set(document["events"].values())) != len(document["events"]):
            raise ValueError("Relay event values must be unique")
        api_parts = _origin_parts(document["public_urls"].get("laravel_api_origin"))
        hub_parts = _origin_parts(document["public_urls"].get("mercure_hub"))
        if api_parts.scheme != "https" or not api_parts.netloc or api_parts.path or api_parts.query or api_parts.fragment:
            raise ValueError("Relay public Laravel API origin is invalid")
        if (
            hub_parts.scheme != api_parts.scheme
            or hub_parts.netloc != api_parts.netloc
            or hub_parts.path != str(document["hub_profile"].get("hub_path") or "")
            or hub_parts.query
            or hub_parts.fragment
        ):
            raise ValueError("Relay public hub URL is invalid")
        for event_name in document["events"]:
            if event_name in ("request_frame", "response_frame"):
                continue
            fields = document["event_payload_profiles"].get(event_name)
            if not isinstance(fields, list) or not fields:
                raise ValueError(f"Relay event payload profile is required: {event_name}")
        self._validate_frame_profile(document)
        self._validate_routes(document)
        for name in ("max_deadline_seconds", "min_deadline_seconds", "ack_timeout_seconds", "stall_window_seconds", "progress_min_interval_seconds"):
            if float(document["durations"][name]) <= 0:
                raise ValueError(f"Relay duration must be positive: {name}")
        if float(document["durations"]["stall_window_seconds"]) < 3 * float(document["durations"]["progress_min_interval_seconds"]):
            raise ValueError("Relay stall window must span at least three progress intervals")
        self.document: Dict[str, Any] = document
        # CRLF -> LF before hashing so every checkout computes the same digest.
        self.digest = hashlib.sha256(normalize_eol(self.raw_bytes)).hexdigest()

    @staticmethod
    def _validate_frame_profile(document: Dict[str, Any]) -> None:
        frame = document["frame_profile"]
        limits = document["limits"]
        for name in (
            "request_fields",
            "request_body_fields",
            "response_fields",
            "response_body_fields",
            "response_part_fields",
            "response_timing_fields",
            "response_progress_fields",
            "response_kinds",
        ):
            if not isinstance(frame.get(name), list) or not frame[name]:
                raise ValueError(f"Relay frame profile list is required: {name}")
        if int(frame.get("version") or 0) <= 0:
            raise ValueError("Relay frame version is invalid")
        if (
            frame.get("time_unit") != "unix_milliseconds"
            or frame.get("digest_algorithm") != "sha256"
            or frame.get("body_encoding") != "base64"
        ):
            raise ValueError("Relay frame encoding profile is invalid")
        if set(frame["response_kinds"]) != {RELAY_FRAME_KIND_ACK, RELAY_FRAME_KIND_PROGRESS, RELAY_FRAME_KIND_RESULT}:
            raise ValueError("Relay frame kinds are invalid")
        for name in ("frame_bytes", "inline_body_bytes", "max_parts", "response_inline_bytes", "device_max_concurrent_requests", "device_dedupe_entries"):
            if int(limits[name]) <= 0:
                raise ValueError(f"Relay limit must be positive: {name}")
        if int(limits["inline_body_bytes"]) >= int(limits["frame_bytes"]):
            raise ValueError("Relay inline body limit exceeds the frame limit")
        encoded_total = -(-int(limits["response_inline_bytes"]) // 3) * 4
        if -(-encoded_total // int(limits["inline_body_bytes"])) > int(limits["max_parts"]):
            raise ValueError("Relay inline response exceeds the part capacity")

    @staticmethod
    def _validate_routes(document: Dict[str, Any]) -> None:
        profiles = document["route_policy_profiles"]
        guarantees = {str(value) for value in document["delivery_guarantees"]}
        matching = document["route_policy_matching"]
        if list(matching.get("precedence") or []) != list(RELAY_ROUTE_MATCH_KINDS):
            raise ValueError("Relay route policy precedence is invalid")
        if str(matching.get("tie_breaker") or "") != "longest-value-then-first-declared":
            raise ValueError("Relay route policy tie breaker is invalid")
        if str(matching.get("default_profile") or "") not in profiles:
            raise ValueError("Relay default route profile is invalid")
        for name, profile in profiles.items():
            for field in RELAY_ROUTE_PROFILE_REQUIRED_FIELDS:
                if field not in profile:
                    raise ValueError(f"Relay route profile field is required: {name}.{field}")
            if str(profile["delivery"]) not in guarantees:
                raise ValueError(f"Relay delivery guarantee is invalid: {name}")
        route_keys = set()
        for policy in document["route_policies"]:
            match_kind = str(policy.get("match") or "")
            match_value = str(policy.get("value") or "")
            if match_kind not in RELAY_ROUTE_MATCH_KINDS or not match_value:
                raise ValueError("Relay route policy match is invalid")
            if str(policy.get("profile") or "") not in profiles:
                raise ValueError(f"Relay route policy profile is required: {policy.get('profile')}")
            methods = tuple(sorted(str(value).upper() for value in policy.get("methods") or []))
            if not methods or any(value not in RELAY_HTTP_METHODS for value in methods):
                raise ValueError("Relay route policy methods are invalid")
            route_key = (match_kind, match_value, methods)
            if route_key in route_keys:
                raise ValueError("Relay route policy is duplicated")
            route_keys.add(route_key)

    @staticmethod
    def _require_named_values(values: Any, required_names: set, value_kind: str) -> None:
        if not isinstance(values, dict):
            raise ValueError(f"Relay {value_kind} collection must be an object")
        missing = sorted(name for name in required_names if not str(values.get(name) or ""))
        if missing:
            raise ValueError(f"Relay required {value_kind} is missing: {missing[0]}")

    @property
    def protocol_version(self) -> str:
        return str(self.document["protocol_version"])

    @property
    def frame_version(self) -> int:
        return int(self.document["frame_profile"]["version"])

    def endpoint(self, name: str, **tokens: Any) -> str:
        template = str(self.document["endpoints"].get(name) or "")
        if not template:
            raise KeyError(f"Relay endpoint is not defined: {name}")
        return template.format(**{key: str(value) for key, value in tokens.items()})

    def event(self, name: str) -> str:
        value = str(self.document["events"].get(name) or "")
        if not value:
            raise KeyError(f"Relay event is not defined: {name}")
        return value

    def duration(self, name: str) -> float:
        return float(self.document["durations"][name])

    def limit(self, name: str) -> int:
        return int(self.document["limits"][name])

    def rate_limit(self, name: str) -> int:
        return int(self.document["rate_limits"][name])

    def error_status(self, name: str) -> int:
        return int(self.document["errors"][name])

    def signature_header(self, name: str) -> str:
        value = str(self.document["signature_profile"]["headers"].get(name) or "")
        if not value:
            raise KeyError(f"Relay signature header is not defined: {name}")
        return value

    def allowed_headers(self, direction: str) -> List[str]:
        return [str(value).lower() for value in self.document["headers"][f"{direction}_allow"]]

    def capabilities(self) -> List[str]:
        return [str(value) for value in self.document.get("capabilities") or []]

    def capability_digest(self, capabilities: Optional[List[str]] = None) -> str:
        values = self.capabilities() if capabilities is None else [str(value) for value in capabilities]
        return hashlib.sha256("\n".join(sorted(set(values))).encode("utf-8")).hexdigest()

    def canonical_path(self, path: str) -> str:
        raw_path = str(path or "")
        if "?" in raw_path or "#" in raw_path:
            raise ValueError("relay_signature_path_query_fragment_forbidden")
        if raw_path.startswith("//") or "\\" in raw_path:
            raise ValueError("relay_signature_path_separator_invalid")
        for index, character in enumerate(raw_path):
            if character != "%":
                continue
            encoded = raw_path[index + 1 : index + 3]
            if len(encoded) != 2 or any(value not in "0123456789abcdefABCDEF" for value in encoded):
                raise ValueError("relay_signature_path_percent_invalid")
            if encoded.lower() in ("2f", "5c"):
                raise ValueError("relay_signature_path_encoded_separator_forbidden")
        one_slash_path = "/" + raw_path.lstrip("/")
        decoded = urllib.parse.unquote_to_bytes(one_slash_path).decode("utf-8")
        if any(ord(character) < 32 or ord(character) == 127 for character in decoded):
            raise ValueError("relay_signature_path_control_character_forbidden")
        safe = str(self.document["signature_profile"]["canonicalization"]["path_safe_characters"])
        return urllib.parse.quote(decoded, safe=safe, encoding="utf-8", errors="strict")

    @staticmethod
    def canonical_query(query: Mapping[str, Any]) -> str:
        pairs = []
        for raw_key in sorted(query, key=lambda item: str(item)):
            if not isinstance(raw_key, str):
                raise ValueError("relay_signature_query_key_not_string")
            value = query[raw_key]
            if isinstance(value, (list, tuple)):
                if any(not isinstance(item, str) for item in value):
                    raise ValueError("relay_signature_query_value_not_string")
                pairs.extend((raw_key, item) for item in value)
                continue
            if not isinstance(value, str):
                raise ValueError("relay_signature_query_value_not_string")
            pairs.append((raw_key, value))
        pairs.sort(key=lambda item: (item[0], item[1]))
        return urllib.parse.urlencode(pairs, doseq=False, encoding="utf-8", errors="strict")

    def request_digest(
        self,
        method: str,
        path: str,
        query: Mapping[str, Any],
        headers: Mapping[str, Any],
        body_present: bool,
        body_sha256: str,
        body_length: int,
    ) -> str:
        canonical = json.dumps(
            {
                "method": str(method).upper(),
                "path": self.canonical_path(path),
                "query": self.canonical_query(query),
                "headers": {
                    str(key).lower(): str(value)
                    for key, value in sorted(dict(headers).items(), key=lambda item: str(item[0]).lower())
                },
                "body_present": bool(body_present),
                "body_sha256": str(body_sha256),
                "body_length": int(body_length),
            },
            ensure_ascii=False,
            allow_nan=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        return hashlib.sha256(canonical).hexdigest()

    def route_policy(self, path: str, method: str) -> Dict[str, Any]:
        normalized_path = str(path or "").strip().strip("/")
        normalized_method = str(method or "GET").upper()
        precedence = self.document["route_policy_matching"]["precedence"]
        weights = {str(kind): len(precedence) - index for index, kind in enumerate(precedence)}
        matches = []
        for declaration_index, item in enumerate(self.document["route_policies"]):
            if normalized_method not in {str(value).upper() for value in item.get("methods") or []}:
                continue
            match_kind = str(item["match"])
            raw_value = str(item["value"]).strip()
            if match_kind == "exact":
                match_value = raw_value.strip("/")
                matched = normalized_path == match_value
            elif match_kind == "prefix":
                match_value = raw_value.lstrip("/")
                matched = normalized_path.startswith(match_value)
            else:
                match_value = raw_value.rstrip("/")
                matched = normalized_path.endswith(match_value)
            if matched:
                matches.append((weights[match_kind], len(match_value), -declaration_index, item))
        if matches:
            item = max(matches, key=lambda value: value[:3])[3]
            return {**dict(item), **self.document["route_policy_profiles"][str(item["profile"])]}
        default_profile = str(self.document["route_policy_matching"]["default_profile"])
        return {
            **self.document["route_policy_profiles"][default_profile],
            "match": "default",
            "value": normalized_path,
            "methods": [normalized_method],
            "profile": default_profile,
        }


relay_contract = RelayContract()
relay_activity_log.success(
    "contract.loaded",
    path=relay_contract.path,
    protocol_version=relay_contract.protocol_version,
    contract_digest=relay_contract.digest,
)


__all__ = [
    "RELAY_DELIVERY_AT_MOST_ONCE",
    "RELAY_DELIVERY_IDEMPOTENT_WRITE",
    "RELAY_DELIVERY_READ",
    "RELAY_FRAME_KIND_ACK",
    "RELAY_FRAME_KIND_PROGRESS",
    "RELAY_FRAME_KIND_RESULT",
    "RelayContract",
    "relay_contract",
]
