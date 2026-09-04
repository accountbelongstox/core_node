# -*- coding: utf-8 -*-
"""Versioned machine-readable contract for Pycore Relay V2."""

from __future__ import annotations

import hashlib
import json
import time
import urllib.parse
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Mapping, Optional

from pycore.pyfoundations.system_paths import get_core_node_root
from pycore.pyutils.codesync.textnorm import normalize_eol
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
    "claim_generation_profile",
    "mercure_profile",
    "lease_profile",
    "durations",
    "limits",
    "rate_limits",
    "headers",
    "operation_states",
    "operation_transitions",
    "transition_guards",
    "result_outcomes",
    "retry_policies",
    "route_policy_matching",
    "route_policy_profiles",
    "route_policies",
    "capabilities",
)
RELAY_ROUTE_PROFILE_REQUIRED_FIELDS = (
    "exposure",
    "permission",
    "payload",
    "timeout_seconds",
    "retry",
)
RELAY_LEASE_RESPONSE_REQUIRED_FIELDS = {
    "state",
    "revision",
    "claim_epoch",
    "server_time",
    "lease_expires_at",
}
RELAY_CLAIM_GENERATION_FIELDS = (
    "operation_revision",
    "claim_epoch",
    "lease_owner",
)
RELAY_REQUIRED_ENDPOINTS = {
    "enrollment_create",
    "enrollment_status",
    "device_heartbeat",
    "device_event",
    "device_hub_authorization",
    "operation_claim",
    "operation_execution_start",
    "operation_lease_renew",
    "operation_result",
    "device_request_blob_download",
    "device_response_blob_allocate",
    "device_response_blob_chunk",
    "device_response_blob_finalize",
    "owner_enrollment_claim",
    "owner_device_roster",
    "owner_pairing_create",
    "owner_pairing_renew",
    "owner_pairing_revoke",
    "owner_hub_authorization",
    "owner_operation_admit",
    "owner_operation_status",
    "owner_operation_cancel",
    "owner_request_blob_allocate",
    "owner_request_blob_chunk",
    "owner_request_blob_finalize",
    "owner_response_blob_download",
}
RELAY_REQUIRED_TOPICS = {
    "device_wake",
    "owner_roster",
    "pairing_operation",
}
RELAY_REQUIRED_EVENTS = {
    "operation_available",
    "operation_status",
    "credential_revoked",
    "pairing_changed",
    "terminal_changed",
}


class RelayContract:
    """Load, validate, and expose Relay configuration without local defaults."""

    def __init__(self, path: Path = RELAY_CONTRACT_PATH) -> None:
        self.path = path.resolve()
        self.raw_bytes = self.path.read_bytes()
        document = json.loads(self.raw_bytes.decode("utf-8"))
        if not isinstance(document, dict):
            raise ValueError("Relay contract root must be an object")
        for section in RELAY_CONTRACT_REQUIRED_SECTIONS:
            if section not in document:
                raise ValueError(f"Relay contract section is required: {section}")
        if int(document.get("schema_version") or 0) != 2:
            raise ValueError("Relay contract schema_version must be 2")
        self._require_named_values(
            document["endpoints"],
            RELAY_REQUIRED_ENDPOINTS,
            "endpoint",
        )
        self._require_named_values(
            document["topics"],
            RELAY_REQUIRED_TOPICS,
            "topic",
        )
        self._require_named_values(
            document["events"],
            RELAY_REQUIRED_EVENTS,
            "event",
        )
        if len(set(document["events"].values())) != len(document["events"]):
            raise ValueError("Relay event values must be unique")
        public_urls = document["public_urls"]
        api_origin = str(public_urls.get("laravel_api_origin") or "")
        mercure_hub = str(public_urls.get("mercure_hub") or "")
        api_parts = urllib.parse.urlsplit(api_origin)
        hub_parts = urllib.parse.urlsplit(mercure_hub)
        if (
            api_parts.scheme != "https"
            or not api_parts.netloc
            or api_parts.path
            or api_parts.query
            or api_parts.fragment
            or api_parts.username is not None
            or api_parts.password is not None
        ):
            raise ValueError("Relay public Laravel API origin is invalid")
        if (
            hub_parts.scheme != api_parts.scheme
            or hub_parts.netloc != api_parts.netloc
            or hub_parts.path
            != str(document["mercure_profile"].get("hub_path") or "")
            or hub_parts.query
            or hub_parts.fragment
            or hub_parts.username is not None
            or hub_parts.password is not None
        ):
            raise ValueError("Relay public Mercure hub URL is invalid")
        generation_profile = document["claim_generation_profile"]
        if tuple(generation_profile.get("fields") or ()) != (
            RELAY_CLAIM_GENERATION_FIELDS
        ):
            raise ValueError("Relay claim generation fields are invalid")
        query_bound_endpoints = {
            str(value)
            for value in generation_profile.get("query_bound_endpoints") or []
        }
        if query_bound_endpoints != {
            "device_request_blob_download",
            "device_response_blob_chunk",
        }:
            raise ValueError("Relay query-bound generation endpoints are invalid")
        event_payload_profiles = document["event_payload_profiles"]
        for event_name in document["events"]:
            fields = event_payload_profiles.get(event_name)
            if not isinstance(fields, list) or not fields:
                raise ValueError(
                    f"Relay event payload profile is required: {event_name}"
                )
        lease_profile = document["lease_profile"]
        if not isinstance(lease_profile, dict):
            raise ValueError("Relay lease_profile must be an object")
        if str(lease_profile.get("timestamp_format") or "") != (
            "rfc3339-with-required-offset"
        ):
            raise ValueError("Relay lease timestamp format is invalid")
        for response_name in (
            "execution_start_response_fields",
            "renew_response_fields",
        ):
            fields = {
                str(value)
                for value in lease_profile.get(response_name) or []
            }
            if not RELAY_LEASE_RESPONSE_REQUIRED_FIELDS.issubset(fields):
                raise ValueError(
                    f"Relay lease response fields are incomplete: {response_name}"
                )
        profiles = document["route_policy_profiles"]
        if not isinstance(profiles, dict):
            raise ValueError("Relay route_policy_profiles must be an object")
        matching = document["route_policy_matching"]
        if list(matching.get("precedence") or []) != [
            "exact",
            "prefix",
            "suffix",
        ]:
            raise ValueError("Relay route policy precedence is invalid")
        if str(matching.get("tie_breaker") or "") != (
            "longest-value-then-first-declared"
        ):
            raise ValueError("Relay route policy tie breaker is invalid")
        if str(matching.get("default_profile") or "") not in profiles:
            raise ValueError("Relay default route profile is invalid")
        retry_policies = {str(value) for value in document["retry_policies"]}
        route_keys = set()
        for policy in document["route_policies"]:
            match_kind = str(policy.get("match") or "")
            match_value = str(policy.get("value") or "")
            if match_kind not in ("exact", "prefix", "suffix") or not match_value:
                raise ValueError("Relay route policy match is invalid")
            profile_name = str(policy.get("profile") or "")
            profile = profiles.get(profile_name)
            if not isinstance(profile, dict):
                raise ValueError(
                    f"Relay route policy profile is required: {profile_name}"
                )
            for field in RELAY_ROUTE_PROFILE_REQUIRED_FIELDS:
                if field not in profile:
                    raise ValueError(
                        f"Relay route profile field is required: "
                        f"{profile_name}.{field}"
                    )
                if field in policy and policy[field] != profile[field]:
                    raise ValueError(
                        f"Relay route policy conflicts with profile: "
                        f"{policy.get('value')}.{field}"
                    )
            methods = tuple(
                sorted(str(value).upper() for value in policy.get("methods") or [])
            )
            if not methods or any(value not in ("GET", "POST") for value in methods):
                raise ValueError("Relay route policy methods are invalid")
            route_key = (
                match_kind,
                match_value,
                methods,
            )
            if route_key in route_keys:
                raise ValueError("Relay route policy is duplicated")
            route_keys.add(route_key)
            if str(profile.get("retry") or "") not in retry_policies:
                raise ValueError(
                    f"Relay retry policy is invalid: {profile_name}"
                )
        states = {str(value) for value in document["operation_states"]}
        transition_states = {
            str(value) for value in document["operation_transitions"]
        }
        if states != transition_states:
            raise ValueError("Relay operation transitions must cover every state")
        for source, targets in document["operation_transitions"].items():
            unknown_targets = {str(value) for value in targets}.difference(states)
            if unknown_targets:
                raise ValueError(
                    f"Relay transition target is unknown: {source}"
                )
        lease_seconds = float(document["durations"]["operation_lease_seconds"])
        renew_seconds = float(
            document["durations"]["operation_lease_renew_seconds"]
        )
        guard_seconds = float(
            document["durations"]["operation_lease_expiry_guard_seconds"]
        )
        shutdown_wait_seconds = float(
            document["durations"]["operation_lease_shutdown_wait_seconds"]
        )
        if (
            renew_seconds <= 0
            or guard_seconds <= 0
            or shutdown_wait_seconds <= 0
            or lease_seconds <= renew_seconds + guard_seconds
        ):
            raise ValueError("Relay operation lease durations are invalid")
        if int(document["limits"]["terminal_screenshot_capture_batch"]) <= 0:
            raise ValueError("Relay terminal capture batch limit is invalid")
        self.document: Dict[str, Any] = document
        # Contract identity follows the Code Sync wire form: text files are
        # canonicalized to LF before hashing so a Windows CRLF checkout and the
        # LF coordinator compute the same digest (raw-byte hashing made the
        # digests permanently diverge -> contract_digest_conflict).
        self.digest = hashlib.sha256(normalize_eol(self.raw_bytes)).hexdigest()

    @staticmethod
    def _require_named_values(
        values: Any,
        required_names: set[str],
        value_kind: str,
    ) -> None:
        if not isinstance(values, dict):
            raise ValueError(f"Relay {value_kind} collection must be an object")
        missing = sorted(
            name for name in required_names if not str(values.get(name) or "")
        )
        if missing:
            raise ValueError(
                f"Relay required {value_kind} is missing: {missing[0]}"
            )

    @property
    def protocol_version(self) -> str:
        return str(self.document["protocol_version"])

    def endpoint(self, name: str, **tokens: Any) -> str:
        template = str(self.document["endpoints"].get(name) or "")
        if not template:
            raise KeyError(f"Relay endpoint is not defined: {name}")
        return template.format(**{key: str(value) for key, value in tokens.items()})

    def topic(self, name: str, **tokens: Any) -> str:
        template = str(self.document["topics"].get(name) or "")
        if not template:
            raise KeyError(f"Relay topic is not defined: {name}")
        resolved_tokens = {key: str(value) for key, value in tokens.items()}
        resolved_tokens["laravel_api_origin"] = self.public_url(
            "laravel_api_origin"
        )
        return template.format(**resolved_tokens)

    def public_url(self, name: str) -> str:
        value = str(self.document["public_urls"].get(name) or "")
        if not value:
            raise KeyError(f"Relay public URL is not defined: {name}")
        return value

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

    def event_payload_fields(self, name: str) -> List[str]:
        values = self.document["event_payload_profiles"].get(name)
        if not isinstance(values, list) or not values:
            raise KeyError(f"Relay event payload profile is not defined: {name}")
        return [str(value) for value in values]

    def generation_query(
        self,
        endpoint_name: str,
        operation_revision: int,
        claim_epoch: int,
        lease_owner: str,
    ) -> Dict[str, str]:
        profile = self.document["claim_generation_profile"]
        endpoint_names = {
            str(value) for value in profile["query_bound_endpoints"]
        }
        values = (
            str(int(operation_revision)),
            str(int(claim_epoch)),
            str(lease_owner),
        )
        if endpoint_name not in endpoint_names:
            raise KeyError(
                f"Relay endpoint has no query generation profile: {endpoint_name}"
            )
        if int(operation_revision) < 1 or int(claim_epoch) < 1 or not str(lease_owner):
            raise ValueError("relay_claim_generation_invalid")
        return dict(zip(RELAY_CLAIM_GENERATION_FIELDS, values))

    def signature_header(self, name: str) -> str:
        headers = self.document["signature_profile"]["headers"]
        value = str(headers.get(name) or "")
        if not value:
            raise KeyError(f"Relay signature header is not defined: {name}")
        return value

    def allowed_headers(self, direction: str) -> List[str]:
        values = self.document["headers"][f"{direction}_allow"]
        return [str(value).lower() for value in values]

    def mercure(self, name: str) -> Any:
        if name not in self.document["mercure_profile"]:
            raise KeyError(f"Relay Mercure profile value is not defined: {name}")
        return self.document["mercure_profile"][name]

    def capabilities(self) -> List[str]:
        return [str(value) for value in self.document.get("capabilities") or []]

    def capability_digest(self, capabilities: Optional[List[str]] = None) -> str:
        values = (
            self.capabilities()
            if capabilities is None
            else [str(value) for value in capabilities]
        )
        return hashlib.sha256(
            "\n".join(sorted(set(values))).encode("utf-8")
        ).hexdigest()

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
            if len(encoded) != 2 or any(
                value not in "0123456789abcdefABCDEF" for value in encoded
            ):
                raise ValueError("relay_signature_path_percent_invalid")
            if encoded.lower() in ("2f", "5c"):
                raise ValueError("relay_signature_path_encoded_separator_forbidden")
        one_slash_path = "/" + raw_path.lstrip("/")
        decoded = urllib.parse.unquote_to_bytes(one_slash_path).decode("utf-8")
        if any(ord(character) < 32 or ord(character) == 127 for character in decoded):
            raise ValueError("relay_signature_path_control_character_forbidden")
        safe = str(
            self.document["signature_profile"]["canonicalization"][
                "path_safe_characters"
            ]
        )
        return urllib.parse.quote(
            decoded,
            safe=safe,
            encoding="utf-8",
            errors="strict",
        )

    @staticmethod
    def canonical_query(query: Mapping[str, Any]) -> str:
        pairs = []
        for raw_key in sorted(query, key=lambda item: str(item)):
            if not isinstance(raw_key, str):
                raise ValueError("relay_signature_query_key_not_string")
            key = raw_key
            value = query[raw_key]
            if isinstance(value, (list, tuple)):
                if any(not isinstance(item, str) for item in value):
                    raise ValueError("relay_signature_query_value_not_string")
                pairs.extend((key, item) for item in value)
                continue
            if not isinstance(value, str):
                raise ValueError("relay_signature_query_value_not_string")
            pairs.append((key, value))
        pairs.sort(key=lambda item: (item[0], item[1]))
        return urllib.parse.urlencode(
            pairs,
            doseq=False,
            encoding="utf-8",
            errors="strict",
        )

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
                    for key, value in sorted(
                        dict(headers).items(),
                        key=lambda item: str(item[0]).lower(),
                    )
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

    def lease_deadline(self, server_time: str, lease_expires_at: str) -> float:
        server_datetime = self.rfc3339_datetime(server_time)
        expiry_datetime = self.rfc3339_datetime(lease_expires_at)
        lease_remaining_seconds = (
            expiry_datetime - server_datetime
        ).total_seconds()
        usable_seconds = lease_remaining_seconds - self.duration(
            "operation_lease_expiry_guard_seconds"
        )
        if usable_seconds <= 0:
            raise RuntimeError("relay_operation_lease_expired")
        if usable_seconds <= self.duration("operation_lease_renew_seconds"):
            raise RuntimeError("relay_operation_lease_too_short")
        if lease_remaining_seconds > self.duration("operation_lease_seconds"):
            raise RuntimeError("relay_operation_lease_duration_invalid")
        return time.monotonic() + usable_seconds

    @staticmethod
    def rfc3339_datetime(value: str) -> datetime:
        timestamp = str(value or "").strip()
        if not timestamp:
            raise RuntimeError("relay_operation_lease_timestamp_missing")
        normalized = timestamp[:-1] + "+00:00" if timestamp.endswith("Z") else timestamp
        try:
            parsed = datetime.fromisoformat(normalized)
        except ValueError as error:
            raise RuntimeError("relay_operation_lease_timestamp_invalid") from error
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise RuntimeError("relay_operation_lease_timestamp_offset_missing")
        return parsed

    def transition_allowed(self, source: str, target: str) -> bool:
        transitions = self.document["operation_transitions"]
        return str(target) in {
            str(value) for value in transitions.get(str(source), [])
        }

    def route_policy(self, path: str, method: str) -> Dict[str, Any]:
        normalized_path = str(path or "").strip().strip("/")
        normalized_method = str(method or "GET").upper()
        precedence = {
            str(value): len(self.document["route_policy_matching"]["precedence"])
            - index
            for index, value in enumerate(
                self.document["route_policy_matching"]["precedence"]
            )
        }
        matches = []
        for declaration_index, item in enumerate(self.document["route_policies"]):
            methods = {str(value).upper() for value in item.get("methods") or []}
            if normalized_method not in methods:
                continue
            match_kind = str(item.get("match") or "exact")
            raw_match_value = str(item.get("value") or "").strip()
            match_value = (
                raw_match_value.strip("/")
                if match_kind == "exact"
                else raw_match_value.lstrip("/")
                if match_kind == "prefix"
                else raw_match_value.rstrip("/")
                if match_kind == "suffix"
                else raw_match_value
            )
            matched = (
                normalized_path == match_value
                if match_kind == "exact"
                else normalized_path.startswith(match_value)
                if match_kind == "prefix"
                else normalized_path.endswith(match_value)
                if match_kind == "suffix"
                else False
            )
            if matched:
                matches.append(
                    (
                        int(precedence.get(match_kind) or 0),
                        len(match_value),
                        -declaration_index,
                        item,
                    )
                )
        if matches:
            item = max(matches, key=lambda value: value[:3])[3]
            profile = dict(
                self.document["route_policy_profiles"][str(item["profile"])]
            )
            return {**dict(item), **profile}
        default_profile = str(
            self.document["route_policy_matching"]["default_profile"]
        )
        denied = dict(self.document["route_policy_profiles"][default_profile])
        return {
            **denied,
            "match": "default",
            "value": normalized_path,
            "methods": [normalized_method],
            "profile": default_profile,
        }


relay_contract = RelayContract()
relay_activity_log.success(
    "contract.loaded",
    path=relay_contract.path,
    schema_version=relay_contract.document["schema_version"],
    protocol_version=relay_contract.protocol_version,
    contract_digest=relay_contract.digest,
)


__all__ = ["RelayContract", "relay_contract"]
